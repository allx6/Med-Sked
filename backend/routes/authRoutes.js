const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const emailService = require('../services/emailService');
const {
  createEmailVerificationService,
  EmailVerificationError,
} = require('../services/emailVerificationService');
const {
  createPasswordResetService,
  PasswordResetError,
  GENERIC_REQUEST_MESSAGE,
} = require('../services/passwordResetService');
const LoginAttemptState = require('../models/LoginAttemptState');
const {
  createLoginAttemptProtection,
  createMongoLoginAttemptStore,
} = require('../services/loginAttemptProtection');

const router = express.Router();
const ADMIN_MFA_CODE_LIFETIME_MS = 10 * 60 * 1000;
const ADMIN_MFA_RESEND_COOLDOWN_MS = 60 * 1000;
const ADMIN_MFA_MAX_ATTEMPTS = 5;
const emailVerificationService = createEmailVerificationService({
  User,
  emailService,
});
const passwordResetService = createPasswordResetService({
  User,
  emailService,
});
const loginAttemptProtection = createLoginAttemptProtection({
  store: createMongoLoginAttemptStore(LoginAttemptState),
  secret: () => process.env.JWT_SECRET,
});

const logAuthFailure = (operation, error) => {
  const errorCode = typeof error?.code === 'string'
    && /^[A-Z0-9_]{1,32}$/.test(error.code)
    ? error.code
    : undefined;
  const command = typeof error?.command === 'string'
    && /^[A-Z0-9_ -]{1,32}$/i.test(error.command)
    ? error.command
    : undefined;
  let failureReason;
  if (error?.message === 'Email configuration is incomplete.') {
    failureReason = 'SMTP_CONFIGURATION_INCOMPLETE';
  } else if (error?.message === 'Email sender is not configured.') {
    failureReason = 'EMAIL_FROM_MISSING';
  } else if (errorCode === 'EAUTH') {
    failureReason = 'SMTP_AUTHENTICATION_REJECTED';
  } else if (errorCode === 'ECONNECTION' || errorCode === 'ETIMEDOUT') {
    failureReason = 'SMTP_CONNECTION_FAILED';
  }

  console.error(`${operation} failed:`, {
    errorName: error?.name || 'UnknownError',
    ...(failureReason ? { failureReason } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(Number.isInteger(error?.responseCode) ? { responseCode: error.responseCode } : {}),
    ...(command ? { command } : {}),
    emailConfig: {
      smtpHostConfigured: Boolean(process.env.SMTP_HOST),
      smtpPortConfigured: Boolean(process.env.SMTP_PORT),
      smtpUserConfigured: Boolean(process.env.SMTP_USER),
      smtpPasswordConfigured: Boolean(process.env.SMTP_PASSWORD),
      emailFromConfigured: Boolean(process.env.EMAIL_FROM),
    },
  });
};

const generatePatientId = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let candidate;

  do {
    candidate = 'MSK-';

    for (let i = 0; i < 6; i += 1) {
      candidate += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (await User.exists({ patientId: candidate }));

  return candidate;
};

const ensurePatientId = async (user) => {
  if (user.role === 'patient' && !user.patientId) {
    user.patientId = await generatePatientId();
    await user.save();
  }
};

const createAuthenticationPayload = (user) => ({
  token: jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      purpose: 'access',
      sessionVersion: Number(user.authTokenVersion || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  ),
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    patientId: user.patientId,
    role: user.role,
  },
});

const createMfaChallenge = (user) => jwt.sign(
  {
    userId: user._id.toString(),
    role: user.role,
    purpose: 'mfa_challenge',
  },
  process.env.JWT_SECRET,
  { expiresIn: '10m' }
);

const getAdminPublicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
});

const verifyMfaChallenge = (token) => {
  if (typeof token !== 'string' || !token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.purpose === 'mfa_challenge'
      && decoded.role === 'admin'
      ? decoded
      : null;
  } catch (error) {
    return null;
  }
};

const findAdminForMfa = (userId) => User.findOne({
  _id: userId,
  role: 'admin',
  emailVerified: true,
  accountStatus: { $ne: 'deactivated' },
}).select(
  '+adminMfaOtpHash +adminMfaOtpExpiresAt +adminMfaOtpAttempts +adminMfaOtpLastSentAt +authTokenVersion'
);

class AdminMfaError extends Error {
  constructor(status, code, message, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const issueAdminMfaCode = async (userId) => {
  const user = await findAdminForMfa(userId);
  if (!user) {
    throw new AdminMfaError(401, 'ADMIN_MFA_UNAVAILABLE', 'Administrator sign-in is unavailable.');
  }

  const now = Date.now();
  const lastSentAt = user.adminMfaOtpLastSentAt
    ? new Date(user.adminMfaOtpLastSentAt).getTime()
    : null;
  if (
    lastSentAt !== null
    && now - lastSentAt < ADMIN_MFA_RESEND_COOLDOWN_MS
  ) {
    return {
      user,
      retryAfterSeconds: Math.ceil(
        (ADMIN_MFA_RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000
      ),
    };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const sentAt = new Date(now);
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      role: 'admin',
      emailVerified: true,
      accountStatus: { $ne: 'deactivated' },
      adminMfaOtpLastSentAt: user.adminMfaOtpLastSentAt || null,
    },
    {
      $set: {
        adminMfaOtpHash: codeHash,
        adminMfaOtpExpiresAt: new Date(now + ADMIN_MFA_CODE_LIFETIME_MS),
        adminMfaOtpAttempts: 0,
        adminMfaOtpLastSentAt: sentAt,
        mfaEnabled: false,
      },
      $unset: {
        mfaSecretEncrypted: 1,
        mfaPendingSecretEncrypted: 1,
        mfaPendingSecretExpiresAt: 1,
        mfaRecoveryCodeHashes: 1,
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw new AdminMfaError(
      409,
      'ADMIN_MFA_CODE_CHANGED',
      'Unable to issue a sign-in code. Please try signing in again.'
    );
  }

  try {
    await emailService.sendAdminLoginCode(user.email, code);
  } catch (error) {
    await User.updateOne(
      { _id: user._id, adminMfaOtpHash: codeHash },
      {
        $unset: {
          adminMfaOtpHash: 1,
          adminMfaOtpExpiresAt: 1,
          adminMfaOtpLastSentAt: 1,
        },
        $set: { adminMfaOtpAttempts: 0 },
      }
    );
    logAuthFailure('Administrator sign-in code email', error);
    throw new AdminMfaError(
      503,
      'ADMIN_MFA_EMAIL_FAILED',
      'Unable to send the sign-in code. Please try again.'
    );
  }

  return { user: updated, retryAfterSeconds: 0 };
};

const createAdminMfaChallengeResponse = (user, retryAfterSeconds = 0) => ({
  message: 'A sign-in code has been sent to your verified email address.',
  mfaRequired: true,
  challengeToken: createMfaChallenge(user),
  retryAfterSeconds,
  user: getAdminPublicUser(user),
});


// =====================================================
// REGISTER
// POST /api/auth/register
// =====================================================

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      termsAccepted,
    } = req.body;


    // =====================================================
    // VALIDATION
    // =====================================================

    if (termsAccepted !== true) {
      return res.status(400).json({
        message: 'You must accept the MedSked Terms & Conditions.',
      });
    }

    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        message:
          'Name, email, password, and account type are required.',
      });
    }

    // =====================================================
    // VALID ROLE
    // =====================================================

    if (
      role !== 'patient' &&
      role !== 'caregiver'
    ) {
      return res.status(400).json({
        message:
          'Invalid account type.',
      });
    }


    // =====================================================
    // PASSWORD VALIDATION
    // =====================================================

    if (password.length < 6) {
      return res.status(400).json({
        message:
          'Password must be at least 6 characters.',
      });
    }

    if (typeof name !== 'string' || !/^[A-Za-z]{1,10}$/.test(name)) {
      return res.status(400).json({
        message:
          'Username must contain only letters and be no more than 10 characters.',
      });
    }


    // =====================================================
    // NORMALIZE DATA
    // =====================================================

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();


    // =====================================================
    // CHECK EMPTY VALUES
    // =====================================================

    if (!normalizedName) {
      return res.status(400).json({
        message:
          'Name cannot be empty.',
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        message:
          'Email cannot be empty.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message:
          'Please enter a valid email address.',
      });
    }


    // =====================================================
    // CHECK DUPLICATE EMAIL
    // =====================================================

    const existingEmail =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingEmail) {
      return res.status(409).json({
        message:
          'An account with this email already exists.',
      });
    }


    // =====================================================
    // CREATE USERNAME FROM NAME
    // =====================================================

    let baseUsername =
      normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');


    // If the name contains only unsupported characters
    // such as symbols, prevent an empty username.

    if (!baseUsername) {
      return res.status(400).json({
        message:
          'Please enter a valid name.',
      });
    }


    // =====================================================
    // CHECK USERNAME
    // =====================================================

    let username =
      baseUsername;

    let counter = 1;

    while (
      await User.findOne({
        username,
      })
    ) {
      username =
        `${baseUsername}${counter}`;

      counter++;
    }


    // =====================================================
    // HASH PASSWORD
    // =====================================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );


    // =====================================================
    // GENERATE UNIQUE PATIENT ID
    // =====================================================

    let patientId = null;

    if (role === 'patient') {
      patientId = await generatePatientId();
    }

    // =====================================================
    // CREATE USER
    // =====================================================

    const userData = {
      username,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      emailVerified: false,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    };

    if (patientId) {
      userData.patientId = patientId;
    }

    const user = await User.create(userData);

    await emailVerificationService.sendInitialVerificationCode(normalizedEmail);

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      message: 'Verification code sent. Please verify your email to continue.',
      verificationRequired: true,
      email: normalizedEmail,
    });

  } catch (error) {
    if (error instanceof EmailVerificationError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        verificationRequired: error.code === 'VERIFICATION_EMAIL_SEND_FAILED',
        ...(error.code === 'VERIFICATION_EMAIL_SEND_FAILED'
          ? { email: req.body.email.trim().toLowerCase() }
          : {}),
      });
    }
    logAuthFailure('Register', error);

    return res.status(500).json({
      message:
        'Failed to create account.',
    });
  }
});


// =====================================================
// LOGIN
// POST /api/auth/login
// =====================================================

router.post('/login', async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message:
          'Email and password are required.',
      });
    }


    // =====================================================
    // NORMALIZE EMAIL
    // =====================================================

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
      });
    }

    const retryAfterSeconds = await loginAttemptProtection.getRetryAfter(
      normalizedEmail,
      req.ip
    );
    if (retryAfterSeconds > 0) {
      return res.status(429).json({
        code: 'LOGIN_ATTEMPTS_EXCEEDED',
        message: 'Too many failed authentication attempts. Please try again later.',
        retryAfterSeconds,
      });
    }


    // =====================================================
    // FIND USER
    // =====================================================

    const user =
      await User.findOne({
        email:
          normalizedEmail,
      }).select('+authTokenVersion');


    if (!user) {
      await loginAttemptProtection.recordFailedLogin(normalizedEmail, req.ip);
      return res.status(401).json({
        message:
          'Invalid email or password.',
      });
    }


    // =====================================================
    // CHECK PASSWORD
    // =====================================================

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );


    if (!passwordMatches) {
      await loginAttemptProtection.recordFailedLogin(normalizedEmail, req.ip);
      return res.status(401).json({
        message:
          'Invalid email or password.',
      });
    }

    if (user.accountStatus === 'deactivated') {
      await loginAttemptProtection.recordFailedLogin(normalizedEmail, req.ip);
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    if (user.emailVerified !== true) {
      return res.status(403).json({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Please verify your email before logging in.',
        verificationRequired: true,
        email: user.email,
      });
    }

    await ensurePatientId(user);
    if (user.role === 'admin') {
      const mfaChallenge = await issueAdminMfaCode(user._id);
      return res.json(createAdminMfaChallengeResponse(
        mfaChallenge.user,
        mfaChallenge.retryAfterSeconds
      ));
    }

    const authentication = createAuthenticationPayload(user);
    await loginAttemptProtection.clearAccountFailures(normalizedEmail);


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({
      message:
        'Login successful.',
      ...authentication,
    });

  } catch (error) {
    if (error instanceof AdminMfaError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }
    logAuthFailure('Login', error);

    return res.status(500).json({
      message:
        'Failed to log in.',
    });
  }
});

router.post('/mfa/verify', async (req, res) => {
  try {
    const challenge = verifyMfaChallenge(req.body?.challengeToken);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!challenge) {
      return res.status(401).json({ message: 'Administrator sign-in challenge is invalid or expired.' });
    }

    const user = await findAdminForMfa(challenge.userId);
    if (!user) {
      return res.status(401).json({ message: 'Administrator sign-in challenge is invalid or expired.' });
    }

    const retryAfterSeconds = await loginAttemptProtection.getRetryAfter(user.email, req.ip);
    if (retryAfterSeconds > 0) {
      return res.status(429).json({
        code: 'MFA_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect sign-in codes. Please try again later.',
        retryAfterSeconds,
      });
    }

    if (
      !user.adminMfaOtpHash
      || !user.adminMfaOtpExpiresAt
      || new Date(user.adminMfaOtpExpiresAt).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        code: 'ADMIN_MFA_CODE_EXPIRED',
        message: 'That sign-in code has expired. Request a new code.',
      });
    }

    if ((user.adminMfaOtpAttempts || 0) >= ADMIN_MFA_MAX_ATTEMPTS) {
      return res.status(429).json({
        code: 'ADMIN_MFA_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect codes. Request a new sign-in code.',
      });
    }

    const verified = /^\d{6}$/.test(code)
      && await bcrypt.compare(code, user.adminMfaOtpHash);
    if (!verified) {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          role: 'admin',
          emailVerified: true,
          accountStatus: { $ne: 'deactivated' },
          adminMfaOtpHash: user.adminMfaOtpHash,
          adminMfaOtpExpiresAt: { $gt: new Date() },
          adminMfaOtpAttempts: { $lt: ADMIN_MFA_MAX_ATTEMPTS },
        },
        { $inc: { adminMfaOtpAttempts: 1 } },
        { returnDocument: 'after' }
      );
      await loginAttemptProtection.recordFailedLogin(user.email, req.ip);
      if (!updatedUser || updatedUser.adminMfaOtpAttempts >= ADMIN_MFA_MAX_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id, adminMfaOtpHash: user.adminMfaOtpHash },
          { $unset: { adminMfaOtpHash: 1, adminMfaOtpExpiresAt: 1 } }
        );
        return res.status(429).json({
          code: 'ADMIN_MFA_ATTEMPTS_EXCEEDED',
          message: 'Too many incorrect codes. Request a new sign-in code.',
        });
      }
      return res.status(401).json({
        code: 'ADMIN_MFA_CODE_INVALID',
        message: 'The sign-in code is incorrect.',
      });
    }

    const authenticatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        role: 'admin',
        emailVerified: true,
        accountStatus: { $ne: 'deactivated' },
        adminMfaOtpHash: user.adminMfaOtpHash,
        adminMfaOtpExpiresAt: { $gt: new Date() },
        adminMfaOtpAttempts: { $lt: ADMIN_MFA_MAX_ATTEMPTS },
      },
      {
        $set: { adminMfaOtpAttempts: 0 },
        $unset: {
          adminMfaOtpHash: 1,
          adminMfaOtpExpiresAt: 1,
          adminMfaOtpLastSentAt: 1,
        },
      },
      { returnDocument: 'after' }
    );
    if (!authenticatedUser) {
      return res.status(401).json({
        code: 'ADMIN_MFA_CODE_INVALID',
        message: 'The sign-in code is invalid or has expired. Request a new code.',
      });
    }

    await loginAttemptProtection.clearAccountFailures(user.email);
    return res.json({
      message: 'Administrator sign-in verified.',
      ...createAuthenticationPayload(authenticatedUser),
    });
  } catch (error) {
    if (error instanceof AdminMfaError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }
    logAuthFailure('Administrator MFA verification', error);
    return res.status(500).json({ message: 'Unable to verify the sign-in code.' });
  }
});

router.post('/mfa/resend', async (req, res) => {
  try {
    const challenge = verifyMfaChallenge(req.body?.challengeToken);
    if (!challenge) {
      return res.status(401).json({ message: 'Administrator sign-in challenge is invalid or expired.' });
    }

    const user = await findAdminForMfa(challenge.userId);
    if (!user) {
      return res.status(401).json({ message: 'Administrator sign-in challenge is invalid or expired.' });
    }
    const retryAfterSeconds = await loginAttemptProtection.getRetryAfter(user.email, req.ip);
    if (retryAfterSeconds > 0) {
      return res.status(429).json({
        code: 'MFA_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect sign-in codes. Please try again later.',
        retryAfterSeconds,
      });
    }

    const result = await issueAdminMfaCode(challenge.userId);
    return res.json({
      message: result.retryAfterSeconds > 0
        ? 'A code was recently sent. Check your email or wait before requesting another.'
        : 'A new sign-in code has been sent to your verified email address.',
      challengeToken: createMfaChallenge(result.user),
      retryAfterSeconds: result.retryAfterSeconds,
    });
  } catch (error) {
    if (error instanceof AdminMfaError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }
    logAuthFailure('Administrator sign-in code resend', error);
    return res.status(500).json({ message: 'Unable to resend the sign-in code.' });
  }
});

router.get('/session', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose && decoded.purpose !== 'access') {
      return res.status(401).json({ message: 'Invalid or expired authentication token' });
    }
    const user = await User.findById(decoded.userId)
      .select('_id username email role patientId accountStatus +authTokenVersion');

    if (!user) {
      return res.status(401).json({ message: 'Session is invalid.' });
    }
    if (
      user.accountStatus === 'deactivated'
      || Number(user.authTokenVersion || 0) !== Number(decoded.sessionVersion || 0)
    ) {
      return res.status(401).json({ message: 'Session is invalid.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    return res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        patientId: user.patientId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Session validation failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (typeof email !== 'string' || typeof otp !== 'string') {
      return res.status(400).json({
        code: 'VERIFICATION_INPUT_REQUIRED',
        message: 'Email and 6-digit verification code are required.',
      });
    }

    const verifiedUser = await emailVerificationService.verifyEmail(email, otp);
    await ensurePatientId(verifiedUser);
    if (verifiedUser.role === 'admin') {
      const mfaChallenge = await issueAdminMfaCode(verifiedUser._id);
      return res.json({
        message: 'Email verified successfully.',
        ...createAdminMfaChallengeResponse(
          mfaChallenge.user,
          mfaChallenge.retryAfterSeconds
        ),
      });
    }
    return res.json({
      message: 'Email verified successfully.',
      ...createAuthenticationPayload(verifiedUser),
    });
  } catch (error) {
    if (error instanceof AdminMfaError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }
    if (error instanceof EmailVerificationError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      });
    }
    logAuthFailure('Email verification', error);
    return res.status(500).json({
      message: 'Unable to verify your email. Please try again.',
    });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        code: 'VERIFICATION_EMAIL_REQUIRED',
        message: 'Email is required.',
      });
    }

    await emailVerificationService.requestVerificationCode(email);
    return res.json({
      message: 'A new verification code has been sent.',
    });
  } catch (error) {
    if (error instanceof EmailVerificationError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      });
    }
    logAuthFailure('Verification email resend', error);
    return res.status(500).json({
      message: 'Unable to send the verification email. Please try again.',
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (
    typeof email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      code: 'INVALID_EMAIL',
      message: 'Please enter a valid email address.',
    });
  }

  try {
    await passwordResetService.requestPasswordReset(email);
    return res.status(202).json({
      message: GENERIC_REQUEST_MESSAGE,
    });
  } catch (error) {
    logAuthFailure('Password reset request', error);
    return res.status(202).json({
      message: GENERIC_REQUEST_MESSAGE,
    });
  }
});

router.post('/verify-password-reset', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (
      typeof email !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof otp !== 'string'
    ) {
      return res.status(400).json({
        code: 'PASSWORD_RESET_INPUT_INVALID',
        message: 'Enter a valid email and 6-digit reset code.',
      });
    }

    const resetAuthorization = await passwordResetService.verifyPasswordResetCode(
      email,
      otp
    );
    return res.json({
      resetAuthorization,
      expiresInSeconds: 600,
    });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      });
    }
    logAuthFailure('Password reset code verification', error);
    return res.status(500).json({
      message: 'Unable to verify the reset code. Please try again.',
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { resetAuthorization, newPassword } = req.body || {};
    await passwordResetService.resetPassword(resetAuthorization, newPassword);
    return res.json({
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }
    logAuthFailure('Password reset', error);
    return res.status(500).json({
      message: 'Unable to reset your password. Please try again.',
    });
  }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;