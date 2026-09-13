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


module.exports =
  mongoose.model(
    'DoseRecord',
    doseRecordSchema
  );