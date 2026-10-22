const express = require('express');
const mongoose = require('mongoose');

const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');

const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');
const {
  createMedicationNotifications,
  notifyLowRefill,
} = require('../services/notificationService');
const { isDoseDateAfterExpiration } = require('../utils/medicationExpiration');
const { detectMissedDoses } = require('../services/missedDoseService');

const {
  generateTodayDoses,
  getMedicationFrequencyInterval,
  parseTime,
} = require('../services/doseGenerator');
const {
  getMedicationLocalParts,
  parseScheduledDateTime,
  toWallClockTimestamp,
} = require('../utils/medicationTime');
const {
  consumeMedicationStockBatch,
  restoreMedicationStockBatch,
} = require('../services/medicationInventoryService');
const { getMedicationExpirationDate } = require('../utils/medicationInventory');

const router = express.Router();

const isValidDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
};

const validateDoseId = (value, label = 'dose ID') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

const populateDose = (doseId) => DoseRecord.findById(doseId)
  .populate(
    'medicationId',
    'name dosage frequency frequencyType frequencyIntervalMinutes quantityOnHand refillThreshold'
  )
  .populate(
    'scheduleId',
    'time timeZone dose days startDate endDate enabled'
  );

const rebasePendingIntervalDoses = async ({
  userId,
  scheduleId,
  takenDose,
  takenAt,
}) => {
  const originalTakenAt = parseScheduledDateTime(
    takenDose.scheduledDate,
    takenDose.scheduledTime
  );
  if (!originalTakenAt) return;

  const takenParts = getMedicationLocalParts(takenAt);
  const actualTakenAt = toWallClockTimestamp(takenParts);
  const pendingDoses = await DoseRecord.find({
    userId,
    scheduleId,
    status: 'pending',
    scheduledDate: { $gte: takenDose.scheduledDate },
  });

  for (const pendingDose of pendingDoses) {
    const originalDueAt = parseScheduledDateTime(
      pendingDose.scheduledDate,
      pendingDose.scheduledTime
    );
    if (!originalDueAt || originalDueAt <= originalTakenAt) continue;

    const effectiveDueAt = new Date(
      originalDueAt.getTime() + actualTakenAt.getTime() - originalTakenAt.getTime()
    );
    await DoseRecord.updateOne(
      { _id: pendingDose._id, userId, status: 'pending' },
      { $set: { effectiveDueAt } }
    );
  }
};

const notifyDoseTaken = async ({
  dose,
  medication,
  doseOwnerId,
  takenTiming,
}) => {
  try {
    const medicationName = medication?.name || 'medication';
    const timing = takenTiming === 'late'
      ? ' late'
      : takenTiming === 'early' ? ' early' : '';
    await createMedicationNotifications({
      patientId: doseOwnerId,
      type: 'dose_taken',
      patientMessage: `Your ${medicationName} dose scheduled at ${dose.scheduledTime} was recorded as taken${timing}.`,
      caregiverMessage: (patientName) => `${patientName}'s ${medicationName} dose scheduled at ${dose.scheduledTime} was recorded as taken${timing}.`,
      relatedEntityType: 'DoseRecord',
      relatedEntityId: dose._id,
      dedupeKey: `dose_taken:${dose._id}`,
    });
  } catch (error) {
    console.error('Dose status notification failed:', {
      operation: 'notify-dose-taken',
      patientId: String(doseOwnerId),
      errorName: error?.name || 'UnknownError',
    });
  }
};

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
      await detectMissedDoses(new Date(), req.user.userId);

      const doses = await DoseRecord.find({
        userId: req.user.userId,
      })
        .populate(
          'medicationId',
          'name dosage frequency frequencyType frequencyIntervalMinutes'
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
      validateDoseId(req.params.id);

      const dose = await DoseRecord.findOne({
        _id: req.params.id,
        userId: req.user.userId,
      })
        .populate(
          'medicationId',
          'name dosage frequency frequencyType frequencyIntervalMinutes'
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

      res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Failed to retrieve dose record',
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

      if (!mongoose.Types.ObjectId.isValid(medicationId)
        || !mongoose.Types.ObjectId.isValid(scheduleId)) {
        return res.status(400).json({ message: 'Invalid medication or schedule ID' });
      }

      if (!isValidDateString(scheduledDate) || !parseTime(String(scheduledTime))) {
        return res.status(400).json({ message: 'Invalid scheduled date or time' });
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

      if (isDoseDateAfterExpiration(
        scheduledDate,
        getMedicationExpirationDate(medication)
      )) {
        return res.status(400).json({
          message: `Cannot create a dose scheduled for ${scheduledDate} because the medication expired on ${medication.expirationDate}.`,
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
          effectiveDueAt: parseScheduledDateTime(scheduledDate, scheduledTime),
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
            'name dosage frequency frequencyType frequencyIntervalMinutes'
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
      validateDoseId(req.params.id);

      const doseOwnerId = req.user.role === 'caregiver'
        ? req.body.patientId
        : req.user.userId;

      if (req.user.role === 'caregiver' && !require('mongoose').Types.ObjectId.isValid(doseOwnerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      await detectMissedDoses(new Date(), doseOwnerId);

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
        const medication = await Medication.findOne({
          _id: existingDose.medicationId,
          userId: doseOwnerId,
        });
        if (getMedicationFrequencyInterval(medication) && existingDose.takenAt) {
          await rebasePendingIntervalDoses({
            userId: doseOwnerId,
            scheduleId: existingDose.scheduleId,
            takenDose: existingDose,
            takenAt: existingDose.takenAt,
          });
        }
        if (existingDose.takenTiming) {
          await notifyDoseTaken({
            dose: existingDose,
            medication,
            doseOwnerId,
            takenTiming: existingDose.takenTiming,
          });
        }
        return res.json(await populateDose(existingDose._id));
      }

      if (existingDose.status !== 'pending') {
        return res.status(409).json({
          message: 'Only pending doses can be marked as taken',
        });
      }

      const medication = await Medication.findOne({
        _id: existingDose.medicationId,
        userId: doseOwnerId,
      });

      if (isDoseDateAfterExpiration(
        existingDose.scheduledDate,
        getMedicationExpirationDate(medication)
      )) {
        return res.status(400).json({
          message: 'Cannot update a dose scheduled after the medication expiration date.',
        });
      }

      const takenAt = new Date();
      const nowWallClock = toWallClockTimestamp(getMedicationLocalParts(takenAt));
      const scheduledAt = existingDose.effectiveDueAt
        ? new Date(existingDose.effectiveDueAt)
        : parseScheduledDateTime(existingDose.scheduledDate, existingDose.scheduledTime);
      if (!scheduledAt) {
        return res.status(400).json({ message: 'Dose has an invalid scheduled date or time.' });
      }
      const isEarly = nowWallClock < scheduledAt;
      const intervalMinutes = getMedicationFrequencyInterval(medication);
      if (isEarly) {
        if (req.body?.earlyDoseConfirmed !== true) {
          return res.status(409).json({
            code: 'DOSE_NOT_DUE',
            message: 'This dose is not due yet. Do not take it early unless your prescription or care team specifically instructs you to.',
          });
        }
        if (!intervalMinutes) {
          return res.status(409).json({
            code: 'EARLY_DOSE_NOT_ALLOWED',
            message: 'Early recording is only available for an explicit interval-based medication schedule.',
          });
        }
        const previousDose = await DoseRecord.findOne({
          userId: doseOwnerId,
          scheduleId: existingDose.scheduleId,
          status: 'taken',
          takenAt: { $ne: null },
        }).sort({ takenAt: -1 }).lean();
        if (!previousDose?.takenAt) {
          return res.status(409).json({
            code: 'EARLY_DOSE_INTERVAL_UNVERIFIED',
            message: 'The minimum interval cannot be verified for this dose. Follow the prescription or contact your care team.',
          });
        }
        const previousTakenAt = toWallClockTimestamp(
          getMedicationLocalParts(new Date(previousDose.takenAt))
        );
        if (
          nowWallClock.getTime() - previousTakenAt.getTime()
          < intervalMinutes * 60 * 1000
        ) {
          return res.status(409).json({
            code: 'EARLY_DOSE_INTERVAL_NOT_MET',
            message: 'The prescribed interval since the last recorded dose has not elapsed.',
          });
        }
      }
      const takenTiming = isEarly
        ? 'early'
        : nowWallClock > scheduledAt ? 'late' : 'on_time';

      if (existingDose.refillDeducted) {
        const updated = await DoseRecord.findOneAndUpdate(
          {
            _id: existingDose._id,
            userId: doseOwnerId,
            status: 'pending',
          },
          {
            $set: {
              status: 'taken',
              takenAt,
              takenTiming,
              takenBy: req.user.userId,
              takenByRole: req.user.role,
            },
          },
          { returnDocument: 'after', runValidators: true }
        );
        if (!updated) {
          return res.status(409).json({ message: 'This dose was updated by another request.' });
        }
        if (intervalMinutes) {
          await rebasePendingIntervalDoses({
            userId: doseOwnerId,
            scheduleId: existingDose.scheduleId,
            takenDose: existingDose,
            takenAt,
          });
        }
        await notifyDoseTaken({
          dose: updated,
          medication,
          doseOwnerId,
          takenTiming,
        });
        return res.json(await populateDose(existingDose._id));
      }

      const stockReservation = await consumeMedicationStockBatch(
        existingDose.medicationId,
        doseOwnerId
      );

      if (!stockReservation) {
        return res.status(409).json({
          message: 'Cannot take this dose because there is no unexpired medication stock remaining.',
        });
      }
      const { medication: updatedMedication, batchId: stockBatchId } = stockReservation;

      let dose;
      try {
        dose = await DoseRecord.findOneAndUpdate(
          {
            _id: req.params.id,
            userId: doseOwnerId,
            status: 'pending',
            refillDeducted: { $ne: true },
          },
          {
            $set: {
              status: 'taken',
              takenAt,
              takenTiming,
              takenBy: req.user.userId,
              takenByRole: req.user.role,
              refillDeducted: true,
              stockBatchId,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          }
        );
      } catch (error) {
        let currentDose;
        try {
          currentDose = await DoseRecord.findOne({
            _id: req.params.id,
            userId: doseOwnerId,
          });
        } catch (readError) {
          throw error;
        }

        if (currentDose?.status === 'taken') {
          if (String(currentDose.stockBatchId || '') !== String(stockBatchId)) {
            await restoreMedicationStockBatch(
              existingDose.medicationId,
              doseOwnerId,
              stockBatchId
            );
          }
          return res.json(await populateDose(existingDose._id));
        }

        await restoreMedicationStockBatch(
          existingDose.medicationId,
          doseOwnerId,
          stockBatchId
        );
        throw error;
      }

      if (!dose) {
        await restoreMedicationStockBatch(
          existingDose.medicationId,
          doseOwnerId,
          stockBatchId
        );

        const latestDose = await DoseRecord.findOne({
          _id: req.params.id,
          userId: doseOwnerId,
        });

        if (latestDose?.status === 'taken') {
          return res.json(await populateDose(existingDose._id));
        }

        if (!latestDose) {
          return res.status(404).json({ message: 'Dose record not found' });
        }

        return res.status(409).json({
          message: 'Only pending doses can be marked as taken',
        });
      }

      if (intervalMinutes) {
        await rebasePendingIntervalDoses({
          userId: doseOwnerId,
          scheduleId: existingDose.scheduleId,
          takenDose: existingDose,
          takenAt,
        });
      }
      await notifyDoseTaken({ dose, medication, doseOwnerId, takenTiming });

      if (updatedMedication) {
        try {
          await notifyLowRefill({
            medication: updatedMedication,
            triggerId: dose._id,
          });
        } catch (error) {
          console.error('Low-refill notification failed:', {
            patientId: String(updatedMedication.userId),
            medicationId: String(updatedMedication._id),
            operation: 'notify-after-dose-taken',
            errorName: error?.name || 'UnknownError',
          });
        }
      }

      const populatedDose = await populateDose(dose._id);

      res.json(populatedDose);

    } catch (error) {
      console.error(
        'Take dose error:',
        error
      );

      res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Failed to mark dose as taken',
      });
    }
  }
);

// =====================================================
// CORRECT AN AUTOMATICALLY MISSED DOSE
// PUT /api/doses/:id/correct-taken
// =====================================================

router.put(
  '/:id/correct-taken',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'caregiver') {
      return caregiverMiddleware.requirePermission('ADHERENCE_SUPPORT')(req, res, next);
    }
    return next();
  },
  async (req, res) => {
    try {
      validateDoseId(req.params.id);
      const doseOwnerId = req.user.role === 'caregiver'
        ? req.body.patientId
        : req.user.userId;
      if (req.user.role === 'caregiver' && !mongoose.Types.ObjectId.isValid(doseOwnerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      const correctionReason = typeof req.body?.correctionReason === 'string'
        ? req.body.correctionReason.trim()
        : '';
      if (!correctionReason || correctionReason.length > 500) {
        return res.status(400).json({
          message: 'A correction reason of 1 to 500 characters is required.',
        });
      }

      const takenAt = new Date(req.body?.takenAt);
      if (!req.body?.takenAt || Number.isNaN(takenAt.getTime()) || takenAt > new Date()) {
        return res.status(400).json({
          message: 'Enter a valid actual date and time that is not in the future.',
        });
      }

      const existingDose = await DoseRecord.findOne({
        _id: req.params.id,
        userId: doseOwnerId,
      });
      if (!existingDose) {
        return res.status(404).json({ message: 'Dose record not found' });
      }

      const medication = await Medication.findOne({
        _id: existingDose.medicationId,
        userId: doseOwnerId,
      });
      const intervalMinutes = getMedicationFrequencyInterval(medication);

      if (
        existingDose.status === 'taken'
        && existingDose.correctionFromStatus === 'missed'
      ) {
        if (intervalMinutes && existingDose.takenAt) {
          await rebasePendingIntervalDoses({
            userId: doseOwnerId,
            scheduleId: existingDose.scheduleId,
            takenDose: existingDose,
            takenAt: existingDose.takenAt,
          });
        }
        if (existingDose.takenTiming) {
          await notifyDoseTaken({
            dose: existingDose,
            medication,
            doseOwnerId,
            takenTiming: existingDose.takenTiming,
          });
        }
        return res.json(await populateDose(existingDose._id));
      }

      if (existingDose.status !== 'missed') {
        return res.status(409).json({
          message: 'Only automatically missed doses can be corrected.',
        });
      }

      if (isDoseDateAfterExpiration(
        existingDose.scheduledDate,
        getMedicationExpirationDate(medication)
      )) {
        return res.status(400).json({
          message: 'Cannot correct a dose scheduled after the medication expiration date.',
        });
      }

      const scheduledAt = existingDose.effectiveDueAt
        ? new Date(existingDose.effectiveDueAt)
        : parseScheduledDateTime(existingDose.scheduledDate, existingDose.scheduledTime);
      if (!scheduledAt) {
        return res.status(400).json({ message: 'Dose has an invalid scheduled date or time.' });
      }

      const actualWallClock = toWallClockTimestamp(getMedicationLocalParts(takenAt));
      const isEarly = actualWallClock < scheduledAt;
      if (isEarly) {
        if (!intervalMinutes) {
          return res.status(409).json({
            code: 'EARLY_DOSE_NOT_ALLOWED',
            message: 'An early dose correction is only available for an explicit interval-based medication schedule.',
          });
        }
        const previousDose = await DoseRecord.findOne({
          userId: doseOwnerId,
          scheduleId: existingDose.scheduleId,
          status: 'taken',
          takenAt: { $ne: null },
        }).sort({ takenAt: -1 }).lean();
        if (!previousDose?.takenAt) {
          return res.status(409).json({
            code: 'EARLY_DOSE_INTERVAL_UNVERIFIED',
            message: 'The minimum interval cannot be verified for this correction.',
          });
        }
        const previousWallClock = toWallClockTimestamp(
          getMedicationLocalParts(new Date(previousDose.takenAt))
        );
        if (actualWallClock.getTime() - previousWallClock.getTime() < intervalMinutes * 60 * 1000) {
          return res.status(409).json({
            code: 'EARLY_DOSE_INTERVAL_NOT_MET',
            message: 'The prescribed interval since the last recorded dose had not elapsed.',
          });
        }
      }

      const takenTiming = isEarly
        ? 'early'
        : actualWallClock > scheduledAt ? 'late' : 'on_time';
      let stockBatchId = existingDose.stockBatchId || null;
      let updatedMedication = null;
      if (!existingDose.refillDeducted) {
        const stockReservation = await consumeMedicationStockBatch(
          existingDose.medicationId,
          doseOwnerId
        );
        if (!stockReservation) {
          return res.status(409).json({
            message: 'Cannot correct this dose because there is no unexpired medication stock available to reconcile.',
          });
        }
        updatedMedication = stockReservation.medication;
        stockBatchId = stockReservation.batchId;
      }

      let correctedDose;
      try {
        correctedDose = await DoseRecord.findOneAndUpdate(
          {
            _id: existingDose._id,
            userId: doseOwnerId,
            status: 'missed',
          },
          {
            $set: {
              status: 'taken',
              takenAt,
              takenTiming,
              takenBy: req.user.userId,
              takenByRole: req.user.role,
              correctionFromStatus: 'missed',
              correctedAt: new Date(),
              correctionReason,
              refillDeducted: true,
              stockBatchId,
            },
          },
          { returnDocument: 'after', runValidators: true }
        );
      } catch (error) {
        if (stockBatchId && !existingDose.refillDeducted) {
          await restoreMedicationStockBatch(
            existingDose.medicationId,
            doseOwnerId,
            stockBatchId
          );
        }
        throw error;
      }

      if (!correctedDose) {
        if (stockBatchId && !existingDose.refillDeducted) {
          await restoreMedicationStockBatch(
            existingDose.medicationId,
            doseOwnerId,
            stockBatchId
          );
        }
        return res.status(409).json({
          message: 'This dose was updated by another request.',
        });
      }

      if (intervalMinutes) {
        await rebasePendingIntervalDoses({
          userId: doseOwnerId,
          scheduleId: existingDose.scheduleId,
          takenDose: existingDose,
          takenAt,
        });
      }
      await notifyDoseTaken({
        dose: correctedDose,
        medication,
        doseOwnerId,
        takenTiming,
      });

      if (updatedMedication) {
        try {
          await notifyLowRefill({
            medication: updatedMedication,
            triggerId: correctedDose._id,
          });
        } catch (error) {
          console.error('Low-refill notification failed:', {
            patientId: String(updatedMedication.userId),
            medicationId: String(updatedMedication._id),
            operation: 'notify-after-dose-correction',
            errorName: error?.name || 'UnknownError',
          });
        }
      }

      return res.json(await populateDose(correctedDose._id));
    } catch (error) {
      console.error('Correct missed dose error:', error);
      return res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Failed to correct missed dose',
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
      validateDoseId(req.params.id);

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
        return res.status(404).json({ message: 'Dose record not found' });
      }

      if (existingDose.status !== 'pending') {
        return res.status(409).json({ message: 'Only pending doses can be skipped' });
      }

      const medication = await Medication.findOne({
        _id: existingDose.medicationId,
        userId: doseOwnerId,
      });

      if (isDoseDateAfterExpiration(
        existingDose.scheduledDate,
        getMedicationExpirationDate(medication)
      )) {
        return res.status(400).json({
          message: 'Cannot update a dose scheduled after the medication expiration date.',
        });
      }

      const dose =
        await DoseRecord.findOneAndUpdate(
          {
            _id: req.params.id,
            userId: doseOwnerId,
            status: 'pending',
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
            'name dosage frequency frequencyType frequencyIntervalMinutes'
          )
          .populate(
            'scheduleId',
            'time dose days startDate endDate enabled'
          );

      if (!dose) {
        const existingDose = await DoseRecord.findOne({
          _id: req.params.id,
          userId: doseOwnerId,
        });

        if (existingDose && existingDose.status !== 'pending') {
          return res.status(409).json({
            message: 'Only pending doses can be skipped',
          });
        }

        return res.status(404).json({
          message:
            'Dose record not found',
        });
      }

      if (req.user.role === 'patient') {
        try {
          const medicationName = dose.medicationId?.name || medication?.name || 'medication';
          await createMedicationNotifications({
            patientId: doseOwnerId,
            type: 'dose_skipped',
            patientMessage: `Your ${medicationName} dose scheduled at ${dose.scheduledTime} was marked as skipped.`,
            caregiverMessage: (patientName) => `${patientName}'s ${medicationName} dose scheduled at ${dose.scheduledTime} was skipped.`,
            relatedEntityType: 'DoseRecord',
            relatedEntityId: dose._id,
            dedupeKey: `dose_skipped:${dose._id}`,
          });
        } catch (error) {
          console.error('Dose status notification failed:', {
            operation: 'notify-dose-skipped',
            patientId: String(doseOwnerId),
            errorName: error?.name || 'UnknownError',
          });
        }
      }

      res.json(dose);

    } catch (error) {
      console.error(
        'Skip dose error:',
        error
      );

      res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Failed to skip dose',
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
  (req, res, next) => {
    if (req.user.role === 'caregiver') {
      return caregiverMiddleware.requirePermission('ADHERENCE_SUPPORT')(req, res, next);
    }
    return next();
  },
  async (req, res) => {
    try {
      validateDoseId(req.params.id);

      const doseOwnerId = req.user.role === 'caregiver'
        ? req.body?.patientId
        : req.user.userId;

      if (
        req.user.role === 'caregiver'
        && !mongoose.Types.ObjectId.isValid(doseOwnerId)
      ) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      const dose =
        await DoseRecord.findOneAndDelete({
          _id: req.params.id,
          userId: doseOwnerId,
          status: 'pending',
        });

      if (!dose) {
        const existingDose = await DoseRecord.findOne({
          _id: req.params.id,
          userId: doseOwnerId,
        });

        if (existingDose) {
          return res.status(409).json({
            message: 'Historical dose records cannot be deleted',
          });
        }

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

      res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Failed to delete dose record',
      });
    }
  }
);


module.exports = router;