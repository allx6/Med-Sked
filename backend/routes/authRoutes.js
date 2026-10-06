const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

const router = express.Router();
const emailVerificationService = createEmailVerificationService({
  User,
  emailService,
});
const passwordResetService = createPasswordResetService({
  User,
  emailService,
});

const logAuthFailure = (operation, error) => {
  console.error(`${operation} failed:`, {
    errorName: error?.name || 'UnknownError',
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
    } = req.body;


    // =====================================================
    // VALIDATION
    // =====================================================

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
      !email ||
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

    const normalizedEmail =
      email.trim().toLowerCase();


    // =====================================================
    // FIND USER
    // =====================================================

    const user =
      await User.findOne({
        email:
          normalizedEmail,
      });


    if (!user) {
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
      return res.status(401).json({
        message:
          'Invalid email or password.',
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Please verify your email before logging in.',
        verificationRequired: true,
        email: user.email,
      });
    }

    if (user.role === 'patient' && !user.patientId) {
      user.patientId = await generatePatientId();
      await user.save();
    }


    // =====================================================
    // CREATE JWT
    // =====================================================

    const token =
      jwt.sign(
        {
          userId:
            user._id.toString(),

          username:
            user.username,

          role:
            user.role,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: '7d',
        }
      );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({
      message:
        'Login successful.',

      token,

      user: {
        id:
          user._id,

        username:
          user.username,

        email:
          user.email,

        patientId:
          user.patientId,

        role:
          user.role,
      },
    });

  } catch (error) {
    logAuthFailure('Login', error);

    return res.status(500).json({
      message:
        'Failed to log in.',
    });
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

    await emailVerificationService.verifyEmail(email, otp);
    return res.json({
      message: 'Email verified successfully.',
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