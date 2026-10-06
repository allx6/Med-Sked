const mongoose = require('mongoose');

const {
  encrypt,
  decrypt,
  getEncryptionFormatVersion,
} = require('../services/encryptionService');

const logNotificationDecryptionFailure = (value, error, notificationId) => {
  console.error('Notification decryption failed:', {
    notificationId: notificationId ? String(notificationId) : 'unavailable',
    formatVersion: getEncryptionFormatVersion(value),
    failureCategory: error?.code || 'DECRYPTION_FAILED',
    operation: 'decrypt',
    environment: process.env.NODE_ENV || 'development',
  });
};

const safeReadNotificationMessage = (value, { notificationId } = {}) => {
  if (typeof value !== 'string' || !value.startsWith('enc:')) {
    logNotificationDecryptionFailure(
      value,
      { code: 'MALFORMED_ENVELOPE' },
      notificationId
    );
    return '[Encrypted notification unavailable]';
  }

  try {
    return decrypt(value, { suppressErrorLog: true });
  } catch (error) {
    logNotificationDecryptionFailure(value, error, notificationId);
    return '[Encrypted notification unavailable]';
  }
};

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

        try {
          return decrypt(value, { suppressErrorLog: true });
        } catch (error) {
          logNotificationDecryptionFailure(value, error, this?._id);
          throw error;
        }
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
module.exports.safeReadNotificationMessage = safeReadNotificationMessage;