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

    emailVerified: {
      type: Boolean,
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