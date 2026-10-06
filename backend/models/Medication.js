const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    dosage: {
      type: String,
      required: true,
      trim: true,
    },

    frequency: {
      type: String,
      required: true,
      trim: true,
    },

    expirationDate: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          if (typeof value !== 'string') {
            return false;
          }

          const trimmed = value.trim();
          const pattern = /^\d{4}-\d{2}-\d{2}$/;
          if (!pattern.test(trimmed)) {
            return false;
          }

          const [year, month, day] = trimmed.split('-').map(Number);
          const parsedDate = new Date(year, month - 1, day);

          return parsedDate.getFullYear() === year
            && parsedDate.getMonth() === month - 1
            && parsedDate.getDate() === day;
        },
        message: 'Expiration date must be a valid YYYY-MM-DD date.',
      },
    },

    quantityOnHand: {
      type: Number,
      min: 0,
      default: 0,
    },

    refillThreshold: {
      type: Number,
      min: 0,
      default: 0,
    },

    lowRefillNotified: {
      type: Boolean,
      default: false,
    },

    normalizedMedicationKey: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

medicationSchema.index(
  { userId: 1, normalizedMedicationKey: 1 },
  { unique: true, sparse: true, name: 'medication_user_normalized_unique' }
);

module.exports = mongoose.model(
  'Medication',
  medicationSchema
);