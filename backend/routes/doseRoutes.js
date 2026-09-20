const express = require('express');

const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');

const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');
const { createNotification } = require('../services/notificationService');

const {
  generateTodayDoses,
} = require('../services/doseGenerator');

const router = express.Router();

const populateDose = (doseId) => DoseRecord.findById(doseId)
  .populate(
    'medicationId',
    'name dosage frequency quantityOnHand refillThreshold'
  )
  .populate(
    'scheduleId',
    'time dose days startDate endDate enabled'
  );


// =====================================================
// GENERATE TODAY'S DOSES
// POST /api/doses/generate-today
// =====================================================

router.post(
  '/generate-today',
  authMiddleware,
  async (req, res) => {
    try {
      const result = await generateTodayDoses(
        req.user.userId
      );

      res.json({
        message: "Today's doses generated successfully",
        created: result.created,
      });

    } catch (error) {
      console.error(
        'Generate today doses error:',
        error
      );

      res.status(500).json({
        message: "Failed to generate today's doses",
      });
    }
  }
);


// =====================================================
// GET ALL DOSE RECORDS
// GET /api/doses
// =====================================================

router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const doses = await DoseRecord.find({
        userId: req.user.userId,
      })
        .populate(
          'medicationId',
          'name dosage frequency'
        )
        .populate(
          'scheduleId',
          'time dose days startDate endDate enabled'
        )
        .sort({
          scheduledDate: -1,
          scheduledTime: 1,
        });

      res.json(doses);

    } catch (error) {
      console.error(
        'Get doses error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve dose records',
      });
    }
  }
);


// =====================================================
// GET ONE DOSE RECORD
// GET /api/doses/:id
// =====================================================

router.get(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid dose ID' });
      }

      const dose = await DoseRecord.findOne({
        _id: req.params.id,
        userId: req.user.userId,
      })
        .populate(
          'medicationId',
          'name dosage frequency'
        )
        .populate(
          'scheduleId',
          'time dose days startDate endDate enabled'
        );

      if (!dose) {
        return res.status(404).json({
          message:
            'Dose record not found',
        });
      }

      res.json(dose);

    } catch (error) {
      console.error(
        'Get dose error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve dose record',
      });
    }
  }
);


// =====================================================
// CREATE DOSE RECORD
// POST /api/doses
// =====================================================

router.post(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        medicationId,
        scheduleId,
        scheduledDate,
        scheduledTime,
      } = req.body;


      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (
        !medicationId ||
        !scheduleId ||
        !scheduledDate ||
        !scheduledTime
      ) {
        return res.status(400).json({
          message:
            'Medication, schedule, date, and time are required',
        });
      }


      // -------------------------------------------------
      // VERIFY MEDICATION
      // -------------------------------------------------

      const medication =
        await Medication.findOne({
          _id: medicationId,
          userId: req.user.userId,
        });

      if (!medication) {
        return res.status(404).json({
          message:
            'Medication not found',
        });
      }


      // -------------------------------------------------
      // VERIFY SCHEDULE
      // -------------------------------------------------

      const schedule =
        await MedicationSchedule.findOne({
          _id: scheduleId,
          userId: req.user.userId,
          medicationId,
        });

      if (!schedule) {
        return res.status(404).json({
          message:
            'Medication schedule not found',
        });
      }


      // -------------------------------------------------
      // PREVENT DUPLICATE DOSE
      // -------------------------------------------------

      const existingDose =
        await DoseRecord.findOne({
          userId: req.user.userId,
          medicationId,
          scheduleId,
          scheduledDate,
          scheduledTime,
        });

      if (existingDose) {
        return res.status(409).json({
          message:
            'Dose record already exists',
          dose: existingDose,
        });
      }


      // -------------------------------------------------
      // CREATE DOSE
      // -------------------------------------------------

      const dose =
        await DoseRecord.create({
          userId: req.user.userId,
          medicationId,
          scheduleId,
          scheduledDate,
          scheduledTime,
          status: 'pending',
          takenAt: null,
        });


      // -------------------------------------------------
      // RETURN POPULATED DOSE
      // -------------------------------------------------

      const populatedDose =
        await DoseRecord.findById(
          dose._id
        )
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .populate(
            'scheduleId',
            'time dose days startDate endDate enabled'
          );

      res.status(201).json(
        populatedDose
      );

    } catch (error) {
      console.error(
        'Create dose error:',
        error
      );

      // Handle MongoDB duplicate key
      if (error.code === 11000) {
        return res.status(409).json({
          message:
            'Dose record already exists',
        });
      }

      res.status(500).json({
        message:
          'Failed to create dose record',
      });
    }
  }
);


// =====================================================
// MARK DOSE AS TAKEN
// PUT /api/doses/:id/take
// =====================================================

router.put(
  '/:id/take',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'caregiver') {
      return caregiverMiddleware.requirePermission('ADHERENCE_SUPPORT')(req, res, next);
    }
    return next();
  },
  async (req, res) => {
    try {
      if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid dose ID' });
      }

      const doseOwnerId = req.user.role === 'caregiver'
        ? req.body.patientId
        : req.user.userId;

      if (req.user.role === 'caregiver' && !require('mongoose').Types.ObjectId.isValid(doseOwnerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      const existingDose = await DoseRecord.findOne({
        _id: req.params.id,
        userId: doseOwnerId,
      });

      if (!existingDose) {
        return res.status(404).json({
          message: 'Dose record not found',
        });
      }

      if (existingDose.status === 'taken') {
        return res.json(await populateDose(existingDose._id));
      }

      if (existingDose.refillDeducted) {
        await DoseRecord.updateOne(
          { _id: existingDose._id },
          {
            $set: {
              status: 'taken',
              takenAt: new Date(),
            },
          }
        );

        return res.json(await populateDose(existingDose._id));
      }

      const dose = await DoseRecord.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: doseOwnerId,
          status: { $ne: 'taken' },
          refillDeducted: { $ne: true },
        },
        {
          $set: {
            status: 'taken',
            takenAt: new Date(),
            refillDeducted: true,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        }
      );

      if (!dose) {
        return res.json(await populateDose(existingDose._id));
      }

      const updatedMedication = await Medication.findOneAndUpdate(
        {
          _id: dose.medicationId,
          userId: doseOwnerId,
          quantityOnHand: { $gt: 0 },
        },
        {
          $inc: { quantityOnHand: -1 },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        }
      );

      if (
        updatedMedication &&
        updatedMedication.quantityOnHand <= updatedMedication.refillThreshold &&
        !updatedMedication.lowRefillNotified
      ) {
        await createNotification({
          recipient: updatedMedication.userId,
          type: 'low_refill',
          message: `${updatedMedication.name} is low on refill stock.`,
          relatedEntityType: 'Medication',
          relatedEntityId: updatedMedication._id,
          dedupeKey: `low_refill:${updatedMedication._id}`,
        });

        await Medication.updateOne(
          { _id: updatedMedication._id },
          { $set: { lowRefillNotified: true } }
        );
      }

      const populatedDose = await populateDose(dose._id);

      res.json(populatedDose);

    } catch (error) {
      console.error(
        'Take dose error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to mark dose as taken',
      });
    }
  }
);


// =====================================================
// MARK DOSE AS SKIPPED
// PUT /api/doses/:id/skip
// =====================================================

router.put(
  '/:id/skip',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'caregiver') {
      return caregiverMiddleware.requirePermission('ADHERENCE_SUPPORT')(req, res, next);
    }
    return next();
  },
  async (req, res) => {
    try {
      if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid dose ID' });
      }

      const doseOwnerId = req.user.role === 'caregiver'
        ? req.body.patientId
        : req.user.userId;

      if (req.user.role === 'caregiver' && !require('mongoose').Types.ObjectId.isValid(doseOwnerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      const dose =
        await DoseRecord.findOneAndUpdate(
          {
            _id: req.params.id,
            userId: doseOwnerId,
          },
          {
            $set: {
              status: 'skipped',
              takenAt: null,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          }
        )
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .populate(
            'scheduleId',
            'time dose days startDate endDate enabled'
          );

      if (!dose) {
        return res.status(404).json({
          message:
            'Dose record not found',
        });
      }

      res.json(dose);

    } catch (error) {
      console.error(
        'Skip dose error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to skip dose',
      });
    }
  }
);


// =====================================================
// DELETE DOSE RECORD
// DELETE /api/doses/:id
// =====================================================

router.delete(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid dose ID' });
      }

      const dose =
        await DoseRecord.findOneAndDelete({
          _id: req.params.id,
          userId: req.user.userId,
        });

      if (!dose) {
        return res.status(404).json({
          message:
            'Dose record not found',
        });
      }

      res.json({
        message:
          'Dose record deleted successfully',
      });

    } catch (error) {
      console.error(
        'Delete dose error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to delete dose record',
      });
    }
  }
);


module.exports = router;