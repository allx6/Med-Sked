const mongoose = require('mongoose');

const ACTION_TYPES = [
  'USER_DELETE',
  'USER_DEACTIVATE',
  'USER_REACTIVATE',
  'USER_ROLE_CHANGE',
  'CAREGIVER_RELATIONSHIP_REVOKE',
];

const TARGET_TYPES = ['USER', 'CAREGIVER_RELATIONSHIP'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'CANCELED'];

const privilegedActionRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actionType: {
      type: String,
      enum: ACTION_TYPES,
      required: true,
    },
    targetType: {
      type: String,
      enum: TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    requestData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      required: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    executedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    executionResult: {
      type: String,
      maxlength: 500,
      default: null,
    },
    canceledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true }
);

privilegedActionRequestSchema.index(
  { targetType: 1, targetId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
  }
);

privilegedActionRequestSchema.index({ status: 1, requestedAt: -1 });
privilegedActionRequestSchema.index({ actionType: 1, status: 1 });
privilegedActionRequestSchema.index({ requesterId: 1, requestedAt: -1 });

module.exports = mongoose.model('PrivilegedActionRequest', privilegedActionRequestSchema);
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.TARGET_TYPES = TARGET_TYPES;
module.exports.STATUSES = STATUSES;
