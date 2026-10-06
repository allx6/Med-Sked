const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

class EmailVerificationError extends Error {
  constructor(status, code, message, retryAfterSeconds) {
    super(message);
    this.name = 'EmailVerificationError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const createEmailVerificationService = ({
  User,
  emailService,
  randomInt = crypto.randomInt,
  hashOtp = (otp) => bcrypt.hash(otp, 10),
  compareOtp = bcrypt.compare,
  now = () => Date.now(),
}) => {
  const generateOtp = () => String(randomInt(0, 1000000)).padStart(6, '0');

  const issueCode = async (user, enforceCooldown) => {
    const nowMs = now();
    const lastSentAt = user.emailVerificationLastSentAt;
    const lastSentMs = lastSentAt ? new Date(lastSentAt).getTime() : null;

    if (enforceCooldown && lastSentMs !== null) {
      const remainingMs = RESEND_COOLDOWN_MS - (nowMs - lastSentMs);
      if (remainingMs > 0) {
        throw new EmailVerificationError(
          429,
          'VERIFICATION_RESEND_COOLDOWN',
          'Please wait before requesting another verification code.',
          Math.ceil(remainingMs / 1000)
        );
      }
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const sentAt = new Date(nowMs);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: { $ne: true },
        emailVerificationLastSentAt: lastSentAt || null,
      },
      {
        $set: {
          emailVerificationOtpHash: otpHash,
          emailVerificationExpires: new Date(nowMs + OTP_LIFETIME_MS),
          emailVerificationAttempts: 0,
          emailVerificationLastSentAt: sentAt,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      const currentUser = await User.findOne({ email: user.email });
      if (currentUser?.emailVerified === true) {
        throw new EmailVerificationError(
          409,
          'EMAIL_ALREADY_VERIFIED',
          'That email is already verified.'
        );
      }

      const currentLastSentMs = currentUser?.emailVerificationLastSentAt
        ? new Date(currentUser.emailVerificationLastSentAt).getTime()
        : null;
      const retryMs = currentLastSentMs === null
        ? 0
        : RESEND_COOLDOWN_MS - (nowMs - currentLastSentMs);
      if (enforceCooldown && retryMs > 0) {
        throw new EmailVerificationError(
          429,
          'VERIFICATION_RESEND_COOLDOWN',
          'Please wait before requesting another verification code.',
          Math.ceil(retryMs / 1000)
        );
      }

      throw new EmailVerificationError(
        409,
        'VERIFICATION_CODE_CHANGED',
        'Unable to send the verification email. Please try again.'
      );
    }

    try {
      await emailService.sendVerificationEmail(user.email, otp);
    } catch {
      await User.updateOne(
        {
          _id: user._id,
          emailVerificationOtpHash: otpHash,
        },
        {
          $unset: {
            emailVerificationOtpHash: 1,
            emailVerificationExpires: 1,
            emailVerificationLastSentAt: 1,
          },
          $set: {
            emailVerificationAttempts: 0,
          },
        }
      );
      throw new EmailVerificationError(
        503,
        'VERIFICATION_EMAIL_SEND_FAILED',
        'Unable to send the verification email. Please try again.'
      );
    }
  };

  const requestVerificationCode = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new EmailVerificationError(
        404,
        'VERIFICATION_ACCOUNT_NOT_FOUND',
        'Unable to send the verification email. Please check the email address.'
      );
    }
    if (user.emailVerified === true) {
      throw new EmailVerificationError(
        409,
        'EMAIL_ALREADY_VERIFIED',
        'That email is already verified.'
      );
    }

    await issueCode(user, true);
  };

  const sendInitialVerificationCode = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.emailVerified === true) {
      throw new EmailVerificationError(
        409,
        'VERIFICATION_ACCOUNT_UNAVAILABLE',
        'Unable to send the verification email. Please try again.'
      );
    }

    await issueCode(user, false);
  };

  const verifyEmail = async (email, otp) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_INVALID',
        'That verification code is incorrect.'
      );
    }
    if (user.emailVerified === true) {
      throw new EmailVerificationError(
        409,
        'EMAIL_ALREADY_VERIFIED',
        'That email is already verified.'
      );
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_FORMAT_INVALID',
        'Please enter the 6-digit verification code.'
      );
    }
    if (!user.emailVerificationOtpHash || !user.emailVerificationExpires) {
      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_MISSING',
        'Request a new verification code to continue.'
      );
    }
    if (new Date(user.emailVerificationExpires).getTime() <= now()) {
      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_EXPIRED',
        'That verification code has expired. Please request a new code.'
      );
    }
    if ((user.emailVerificationAttempts || 0) >= MAX_ATTEMPTS) {
      throw new EmailVerificationError(
        429,
        'VERIFICATION_ATTEMPTS_EXCEEDED',
        'Too many incorrect attempts. Please request a new code.'
      );
    }

    const matches = await compareOtp(otp, user.emailVerificationOtpHash);
    if (!matches) {
      const update = await User.updateOne(
        {
          _id: user._id,
          emailVerified: { $ne: true },
          emailVerificationOtpHash: user.emailVerificationOtpHash,
          emailVerificationExpires: { $gt: new Date(now()) },
          emailVerificationAttempts: { $lt: MAX_ATTEMPTS },
        },
        { $inc: { emailVerificationAttempts: 1 } }
      );

      if ((update.matchedCount ?? update.n) === 0) {
        throw new EmailVerificationError(
          429,
          'VERIFICATION_ATTEMPTS_EXCEEDED',
          'Too many incorrect attempts. Please request a new code.'
        );
      }

      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_INVALID',
        'That verification code is incorrect.'
      );
    }

    const verifiedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerified: { $ne: true },
        emailVerificationOtpHash: user.emailVerificationOtpHash,
        emailVerificationExpires: { $gt: new Date(now()) },
        emailVerificationAttempts: { $lt: MAX_ATTEMPTS },
      },
      {
        $set: {
          emailVerified: true,
          emailVerificationAttempts: 0,
        },
        $unset: {
          emailVerificationOtpHash: 1,
          emailVerificationExpires: 1,
          emailVerificationLastSentAt: 1,
        },
      },
      { new: true }
    );

    if (!verifiedUser) {
      throw new EmailVerificationError(
        400,
        'VERIFICATION_CODE_INVALID',
        'That verification code is incorrect.'
      );
    }
  };

  return {
    generateOtp,
    requestVerificationCode,
    sendInitialVerificationCode,
    verifyEmail,
  };
};

module.exports = {
  createEmailVerificationService,
  EmailVerificationError,
  OTP_LIFETIME_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
};
