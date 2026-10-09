const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESET_AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  'If an account exists for this email, a password reset code has been sent.';

class PasswordResetError extends Error {
  constructor(status, code, message, retryAfterSeconds) {
    super(message);
    this.name = 'PasswordResetError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const hashAuthorization = (authorization) => crypto
  .createHash('sha256')
  .update(authorization)
  .digest('hex');

const createPasswordResetService = ({
  User,
  emailService,
  randomInt = crypto.randomInt,
  randomBytes = crypto.randomBytes,
  hashOtp = (otp) => bcrypt.hash(otp, 10),
  compareOtp = bcrypt.compare,
  hashPassword = (password) => bcrypt.hash(password, 10),
  now = () => Date.now(),
  logEmailFailure = (error) => console.error('Password reset email delivery failed:', error),
}) => {
  const generateOtp = () => String(randomInt(0, 1000000)).padStart(6, '0');

  const requestPasswordReset = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedEmail,
      emailVerified: true,
    });

    if (!user) {
      return;
    }

    const nowMs = now();
    const lastSentMs = user.passwordResetLastSentAt
      ? new Date(user.passwordResetLastSentAt).getTime()
      : null;
    if (
      lastSentMs !== null
      && nowMs - lastSentMs < RESEND_COOLDOWN_MS
    ) {
      return;
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const sentAt = new Date(nowMs);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        email: normalizedEmail,
        emailVerified: true,
        passwordResetLastSentAt: user.passwordResetLastSentAt || null,
      },
      {
        $set: {
          passwordResetOtpHash: otpHash,
          passwordResetOtpExpires: new Date(nowMs + OTP_LIFETIME_MS),
          passwordResetAttempts: 0,
          passwordResetLastSentAt: sentAt,
        },
        $unset: {
          passwordResetAuthorizationHash: 1,
          passwordResetAuthorizationExpires: 1,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return;
    }

    try {
      await emailService.sendPasswordResetEmail(normalizedEmail, otp);
    } catch (error) {
      await User.updateOne(
        {
          _id: user._id,
          passwordResetOtpHash: otpHash,
        },
        {
          $unset: {
            passwordResetOtpHash: 1,
            passwordResetOtpExpires: 1,
          },
          $set: {
            passwordResetAttempts: 0,
          },
        }
      );
      logEmailFailure(error);
    }
  };

  const verifyPasswordResetCode = async (email, otp) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedEmail,
      emailVerified: true,
    });

    if (!user || !/^\d{6}$/.test(otp)) {
      throw new PasswordResetError(
        400,
        'PASSWORD_RESET_CODE_INVALID',
        'That reset code is incorrect.'
      );
    }
    if ((user.passwordResetAttempts || 0) >= MAX_ATTEMPTS) {
      throw new PasswordResetError(
        429,
        'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
        'Too many incorrect attempts. Please request a new reset code.'
      );
    }
    if (!user.passwordResetOtpHash || !user.passwordResetOtpExpires) {
      throw new PasswordResetError(
        400,
        'PASSWORD_RESET_CODE_MISSING',
        'That reset code is incorrect. Please request a new code.'
      );
    }
    if (new Date(user.passwordResetOtpExpires).getTime() <= now()) {
      throw new PasswordResetError(
        400,
        'PASSWORD_RESET_CODE_EXPIRED',
        'That reset code has expired. Please request a new code.'
      );
    }

    const matches = await compareOtp(otp, user.passwordResetOtpHash);
    if (!matches) {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          emailVerified: true,
          passwordResetOtpHash: user.passwordResetOtpHash,
          passwordResetOtpExpires: { $gt: new Date(now()) },
          passwordResetAttempts: { $lt: MAX_ATTEMPTS },
        },
        { $inc: { passwordResetAttempts: 1 } },
        { new: true }
      );

      if (!updatedUser) {
        throw new PasswordResetError(
          429,
          'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
          'Too many incorrect attempts. Please request a new reset code.'
        );
      }
      if (updatedUser.passwordResetAttempts >= MAX_ATTEMPTS) {
        await User.updateOne(
          {
            _id: user._id,
            passwordResetOtpHash: user.passwordResetOtpHash,
            passwordResetAttempts: { $gte: MAX_ATTEMPTS },
          },
          {
            $unset: {
              passwordResetOtpHash: 1,
              passwordResetOtpExpires: 1,
            },
          }
        );
        throw new PasswordResetError(
          429,
          'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
          'Too many incorrect attempts. Please request a new reset code.'
        );
      }

      throw new PasswordResetError(
        400,
        'PASSWORD_RESET_CODE_INVALID',
        'That reset code is incorrect.'
      );
    }

    const resetAuthorization = randomBytes(32).toString('base64url');
    const verifiedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: true,
        passwordResetOtpHash: user.passwordResetOtpHash,
        passwordResetOtpExpires: { $gt: new Date(now()) },
        passwordResetAttempts: { $lt: MAX_ATTEMPTS },
      },
      {
        $set: {
          passwordResetAuthorizationHash: hashAuthorization(resetAuthorization),
          passwordResetAuthorizationExpires: new Date(
            now() + RESET_AUTHORIZATION_LIFETIME_MS
          ),
          passwordResetAttempts: 0,
        },
        $unset: {
          passwordResetOtpHash: 1,
          passwordResetOtpExpires: 1,
        },
      },
      { new: true }
    );

    if (!verifiedUser) {
      throw new PasswordResetError(
        400,
        'PASSWORD_RESET_CODE_INVALID',
        'That reset code is incorrect.'
      );
    }

    return resetAuthorization;
  };

  const resetPassword = async (resetAuthorization, newPassword) => {
    if (typeof resetAuthorization !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(resetAuthorization)) {
      throw new PasswordResetError(
        401,
        'PASSWORD_RESET_AUTHORIZATION_INVALID',
        'This password reset session is invalid or expired. Please start again.'
      );
    }
    const authorizationHash = hashAuthorization(resetAuthorization);
    const nowMs = now();
    const authorizedUser = await User.findOne({
      passwordResetAuthorizationHash: authorizationHash,
      passwordResetAuthorizationExpires: { $gt: new Date(nowMs) },
      emailVerified: true,
    });
    if (!authorizedUser) {
      throw new PasswordResetError(
        401,
        'PASSWORD_RESET_AUTHORIZATION_INVALID',
        'This password reset session is invalid or expired. Please start again.'
      );
    }
    if (typeof newPassword !== 'string' || !newPassword) {
      throw new PasswordResetError(
        400,
        'PASSWORD_REQUIRED',
        'Password is required.'
      );
    }
    if (/\s/.test(newPassword) || newPassword.length < 6) {
      throw new PasswordResetError(
        400,
        'PASSWORD_REQUIREMENTS_NOT_MET',
        'Password must be at least 6 characters and cannot contain spaces.'
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: authorizedUser._id,
        passwordResetAuthorizationHash: authorizationHash,
        passwordResetAuthorizationExpires: { $gt: new Date(nowMs) },
        emailVerified: true,
      },
      {
        $set: {
          password: passwordHash,
        },
        $unset: {
          passwordResetOtpHash: 1,
          passwordResetOtpExpires: 1,
          passwordResetAttempts: 1,
          passwordResetLastSentAt: 1,
          passwordResetAuthorizationHash: 1,
          passwordResetAuthorizationExpires: 1,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new PasswordResetError(
        401,
        'PASSWORD_RESET_AUTHORIZATION_INVALID',
        'This password reset session is invalid or expired. Please start again.'
      );
    }
  };

  return {
    generateOtp,
    requestPasswordReset,
    verifyPasswordResetCode,
    resetPassword,
  };
};

module.exports = {
  createPasswordResetService,
  PasswordResetError,
  OTP_LIFETIME_MS,
  RESET_AUTHORIZATION_LIFETIME_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
  GENERIC_REQUEST_MESSAGE,
};
