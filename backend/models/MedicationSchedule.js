const mongoose = require('mongoose');

const medicationScheduleSchema =
  new mongoose.Schema(
    {
      // =============================================
      // USER
      // =============================================

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },


      // =============================================
      // MEDICATION
      // =============================================

      medicationId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'Medication',
        required: true,
      },


      // =============================================
      // TIME
      // =============================================

      time: {
        type: String,
        required: true,
        trim: true,
      },


      // =============================================
      // DOSE
      // =============================================

      dose: {
        type: String,
        required: true,
        trim: true,
      },


      // =============================================
      // DAYS
      // =============================================

      days: {
        type: [String],
        required: true,
        validate: {
          validator: function (value) {
            return (
              Array.isArray(value) &&
              value.length > 0
            );
          },

          message:
            'At least one day must be selected',
        },
      },


      // =============================================
      // START DATE
      // =============================================

      startDate: {
        type: String,
        required: true,
        trim: true,
      },


      // =============================================
      // END DATE
      // =============================================

      endDate: {
        type: String,
        default: null,
        trim: true,
      },


      // =============================================
      // ENABLED
      // =============================================

      enabled: {
        type: Boolean,
        default: true,
      },
    },

    {
      timestamps: true,
    }
  );


module.exports =
  mongoose.model(
    'MedicationSchedule',
    medicationScheduleSchema
  );