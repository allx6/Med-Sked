const mongoose = require('mongoose');

const loginAttemptStateSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    cooldownStartedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('LoginAttemptState', loginAttemptStateSchema);
