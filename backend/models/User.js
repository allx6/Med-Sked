const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    patientId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        'patient',
        'caregiver',
        'admin',
      ],
      default: 'patient',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active',
      index: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deactivationReason: {
      type: String,
      maxlength: 500,
      default: null,
    },
    deactivationRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrivilegedActionRequest',
      default: null,
    },
    authTokenVersion: {
      type: Number,
      default: 0,
    },

    termsAccepted: {
      type: Boolean,
      default: false,
    },

    termsAcceptedAt: {
      type: Date,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecretEncrypted: {
      type: String,
      select: false,
    },
    mfaPendingSecretEncrypted: {
      type: String,
      select: false,
    },
    mfaPendingSecretExpiresAt: {
      type: Date,
      select: false,
    },
    mfaRecoveryCodeHashes: {
      type: [String],
      default: [],
      select: false,
    },
    adminMfaOtpHash: {
      type: String,
      select: false,
    },
    adminMfaOtpExpiresAt: {
      type: Date,
      select: false,
    },
    adminMfaOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    adminMfaOtpLastSentAt: {
      type: Date,
      select: false,
    },

    emailVerificationOtpHash: {
      type: String,
    },

    emailVerificationExpires: {
      type: Date,
    },

    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },

    emailVerificationLastSentAt: {
      type: Date,
    },

    passwordResetOtpHash: {
      type: String,
    },

    passwordResetOtpExpires: {
      type: Date,
    },

    passwordResetAttempts: {
      type: Number,
      default: 0,
    },

    passwordResetLastSentAt: {
      type: Date,
    },

    passwordResetAuthorizationHash: {
      type: String,
    },

    passwordResetAuthorizationExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    'User',
    userSchema
  );