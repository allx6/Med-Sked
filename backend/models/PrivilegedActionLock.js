const mongoose = require('mongoose');

const privilegedActionLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: 'admin-membership',
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('PrivilegedActionLock', privilegedActionLockSchema);
