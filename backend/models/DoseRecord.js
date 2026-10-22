const mongoose = require('mongoose');


const doseRecordSchema =
  new mongoose.Schema(
    {

      // =====================================================
      // USER
      // =====================================================

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'User',

        required: true,
      },


      // =====================================================
      // MEDICATION
      // =====================================================

      medicationId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'Medication',

        required: true,
      },


      // =====================================================
      // MEDICATION SCHEDULE
      // =====================================================

      scheduleId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'MedicationSchedule',

        required: true,
      },


      // =====================================================
      // SCHEDULED DATE
      //
      // Example:
      // 2026-09-08
      // =====================================================

      scheduledDate: {
        type: String,

        required: true,

        trim: true,
      },


      // =====================================================
      // SCHEDULED TIME
      //
      // Example:
      // 8:00 AM
      // =====================================================

      scheduledTime: {
        type: String,

        required: true,

        trim: true,
      },


      // =====================================================
      // ACTUAL TIME DOSE WAS TAKEN
      // =====================================================

      takenAt: {
        type: Date,
        default: null,
      },
      effectiveDueAt: {
        type: Date,
        default: null,
      },
      takenTiming: {
        type: String,
        enum: ['on_time', 'late', 'early'],
        default: null,
      },
      takenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      takenByRole: {
        type: String,
        enum: ['patient', 'caregiver'],
        default: null,
      },
      correctionFromStatus: {
        type: String,
        enum: ['missed'],
        default: null,
      },
      correctedAt: {
        type: Date,
        default: null,
      },
      correctionReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },


      // =====================================================
      // DOSE STATUS
      // =====================================================

      status: {
        type: String,

        enum: [
          'pending',
          'taken',
          'missed',
          'skipped',
        ],

        default: 'pending',

        required: true,
      },

      // One confirmed taken transition consumes one scheduled unit.
      refillDeducted: {
        type: Boolean,
        default: false,
      },
      stockBatchId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


// =====================================================
// PREVENT DUPLICATE DOSES
// =====================================================

doseRecordSchema.index(
  {
    userId: 1,

    medicationId: 1,

    scheduleId: 1,

    scheduledDate: 1,

    scheduledTime: 1,
  },

  {
    unique: true,
  }
);

doseRecordSchema.index({
  scheduledDate: 1,
  status: 1,
});


module.exports =
  mongoose.model(
    'DoseRecord',
    doseRecordSchema
  );