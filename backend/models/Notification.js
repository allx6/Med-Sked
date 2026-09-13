const mongoose = require('mongoose');

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

module.exports = mongoose.model('Notification', notificationSchema);