const mongoose = require('mongoose');

const caregiverRelationshipSchema = new mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'active', 'revoked'],
      default: 'pending',
    },

    permission: {
      type: String,
      enum: ['VIEW_ONLY', 'ADHERENCE_SUPPORT'],
      default: 'VIEW_ONLY',
    },
  },
  {
    timestamps: true,
  }
);


// =====================================================
// PREVENT DUPLICATE RELATIONSHIPS
// =====================================================

caregiverRelationshipSchema.index(
  {
    caregiver: 1,
    patient: 1,
  },
  {
    unique: true,
  }
);

caregiverRelationshipSchema.index({
  status: 1,
  createdAt: -1,
});


module.exports = mongoose.model(
  'CaregiverRelationship',
  caregiverRelationshipSchema
);