const mongoose = require('mongoose');

const { encrypt, decrypt } = require('../services/encryptionService');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        'missed_dose',
        'low_refill',
        'caregiver_request',
        'caregiver_request_accepted',
        'schedule_changed',
      ],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      set: function encryptNotificationMessage(value) {
        if (value === null || value === undefined) {
          return value;
        }

        return encrypt(value);
      },
      get: function decryptNotificationMessage(value) {
        if (value === null || value === undefined) {
          return value;
        }

        return decrypt(value);
      },
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    relatedEntityType: {
      type: String,
      trim: true,
    },

    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    dedupeKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.set('toJSON', { getters: true, virtuals: true });
notificationSchema.set('toObject', { getters: true, virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);