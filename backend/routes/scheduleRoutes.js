const express = require('express');

const MedicationSchedule =
  require('../models/MedicationSchedule');

const Medication =
  require('../models/Medication');
const DoseRecord =
  require('../models/DoseRecord');
const {
  isValidObjectId,
  validateSchedulePayload,
  validateScheduleFields,
} = require('../utils/validation');

const authMiddleware =
  require('../middleware/authMiddleware');
const caregiverMiddleware =
  require('../middleware/caregiverMiddleware');
const { createNotification } = require('../services/notificationService');
const {
  generateTodayDoses,
  reconcilePendingDosesForSchedule,
} = require('../services/doseGenerator');

const router = express.Router();

const respondWithError = (res, error) => {
  if (error && error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Failed to process schedule request' });
};

const authorizeScheduleMutation = (req, res, next) => {
  if (req.user.role === 'caregiver') {
    return caregiverMiddleware.requirePermission('ADHERENCE_SUPPORT')(req, res, next);
  }

  return next();
};

const getOwnerId = (req) => (
  req.user.role === 'caregiver'
    ? req.body?.patientId || req.query?.patientId
    : req.user.userId
);

const validateScheduleIdParam = (value) => {
  if (!isValidObjectId(value)) {
    const error = new Error('Invalid schedule ID');
    error.statusCode = 400;
    throw error;
  }

  return value;
};

// =====================================================
// GET ALL MEDICATION SCHEDULES
// GET /api/schedules
// =====================================================

router.get(
  '/',
  authMiddleware,
  async (req, res) => {

    try {

      const schedules =
        await MedicationSchedule.find({
          userId:
            req.user.userId,
        })
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .sort({
            time: 1,
          });

      res.json(
        schedules
      );

    } catch (error) {

      console.error(
        'Get schedules error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve schedules',
      });
    }
  }
);


// =====================================================
// GET ONE MEDICATION SCHEDULE
// GET /api/schedules/:id
// =====================================================

router.get(
  '/:id',
  authMiddleware,
  async (req, res) => {

    try {
      validateScheduleIdParam(req.params.id);
      const schedule =
        await MedicationSchedule.findOne({

          _id:
            req.params.id,

          userId: req.user.userId,

        }).populate(
          'medicationId',
          'name dosage frequency'
        );

      if (!schedule) {

        return res.status(404).json({
          message:
            'Schedule not found',
        });

      }

      res.json(
        schedule
      );

    } catch (error) {

      console.error(
        'Get schedule error:',
        error
      );

      return respondWithError(res, error);
    }
  }
);


// =====================================================
// CREATE MEDICATION SCHEDULE
// POST /api/schedules
// =====================================================

router.post(
  '/',
  authMiddleware,
  authorizeScheduleMutation,
  async (req, res) => {

    try {
      const ownerId = getOwnerId(req);

      console.log('[Schedule][Backend] POST request received');
      console.log('[Schedule][Backend] Schedule ID: new schedule');
      console.log('[Schedule][Backend] User ID:', req.user?.userId);
      console.log('[Schedule][Backend] patientId:', ownerId);
      console.log('[Schedule][Backend] Request body:', {
        medicationId: req.body?.medicationId,
        time: req.body?.time,
        dose: req.body?.dose,
        days: req.body?.days,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
        enabled: req.body?.enabled,
      });

      const payload = validateSchedulePayload(req.body);

      if (!payload) {
        const error = new Error('Unexpected schedule fields');
        error.statusCode = 400;
        return respondWithError(res, error);
      }

      const validationError = validateScheduleFields(payload);
      if (validationError) {
        const error = new Error(validationError);
        error.statusCode = 400;
        return respondWithError(res, error);
      }

      const {
        medicationId,
        time,
        dose,
        days,
        startDate,
        endDate,
        enabled,
      } = payload;


      // =================================================
      // VALIDATION
      // =================================================

      if (
        !medicationId ||
        !time ||
        !days ||
        !startDate
      ) {

        return res.status(400).json({
          message:
            'Medication, time, days, and start date are required',
        });

      }


      if (
        !Array.isArray(days) ||
        days.length === 0
      ) {

        return res.status(400).json({
          message:
            'At least one day must be selected',
        });

      }


      // =================================================
      // VERIFY MEDICATION
      // =================================================

      if (!ownerId) {
        return res.status(400).json({ message: 'Patient ID is required' });
      }

      if (!isValidObjectId(ownerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      if (!isValidObjectId(medicationId)) {
        return res.status(400).json({ message: 'Invalid medication ID' });
      }

      const medication =
        await Medication.findOne({

          _id:
            medicationId,

          userId: ownerId,

        });


      if (!medication) {

        return res.status(404).json({
          message:
            'Medication not found',
        });

      }

      const medicationDose =
        typeof medication.dosage === 'string' && medication.dosage.trim()
          ? medication.dosage.trim()
          : (typeof dose === 'string' && dose.trim() ? dose.trim() : '');

      if (!medicationDose) {
        return res.status(400).json({
          message: 'Selected medication must include a dosage.',
        });
      }


      // =================================================
      // CREATE SCHEDULE
      // =================================================

      const schedule =
        await MedicationSchedule.create({

          userId: ownerId,

          medicationId,

          time:
            time.trim(),

          dose:
            medicationDose,

          days,

          startDate,

          endDate:
            endDate
              ? endDate.trim()
              : null,

          enabled:
            enabled !== undefined
              ? enabled
              : true,

        });


      // =================================================
      // POPULATE
      // =================================================

      const populatedSchedule =
        await MedicationSchedule.findById(
          schedule._id
        ).populate(
          'medicationId',
          'name dosage frequency'
        );

      await createNotification({
        recipient: req.user.userId,
        type: 'schedule_changed',
        message: `Medication schedule created for ${populatedSchedule.medicationId?.name || 'your medication'}.`,
        relatedEntityType: 'MedicationSchedule',
        relatedEntityId: populatedSchedule._id,
      });


      console.log('[Schedule][Backend] Create successful', {
        scheduleId: populatedSchedule?._id,
        userId: req.user?.userId,
        patientId: ownerId,
        time: populatedSchedule?.time,
      });

      res.status(201).json(
        populatedSchedule
      );

    } catch (error) {

      console.error(
        '[Schedule][Backend] Create failed',
        {
          scheduleId: req.params?.id,
          userId: req.user?.userId,
          patientId: getOwnerId(req),
          message: error.message,
        }
      );

      return respondWithError(res, error);
    }
  }
);


// =====================================================
// UPDATE MEDICATION SCHEDULE
// PUT /api/schedules/:id
// =====================================================

router.put(
  '/:id',
  authMiddleware,
  authorizeScheduleMutation,
  async (req, res) => {

    try {
      const ownerId = getOwnerId(req);

      console.log('[Schedule][Backend] PUT request received');
      console.log('[Schedule][Backend] Schedule ID:', req.params.id);
      console.log('[Schedule][Backend] User ID:', req.user?.userId);
      console.log('[Schedule][Backend] patientId:', ownerId);
      console.log('[Schedule][Backend] Request body:', {
        medicationId: req.body?.medicationId,
        time: req.body?.time,
        dose: req.body?.dose,
        days: req.body?.days,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
        enabled: req.body?.enabled,
      });

      validateScheduleIdParam(req.params.id);
      const payload = validateSchedulePayload(req.body);

      if (!payload) {
        const error = new Error('Unexpected schedule fields');
        error.statusCode = 400;
        return respondWithError(res, error);
      }

      const validationError = validateScheduleFields(payload);
      if (validationError) {
        const error = new Error(validationError);
        error.statusCode = 400;
        return respondWithError(res, error);
      }

      const {
        medicationId,
        time,
        dose,
        days,
        startDate,
        endDate,
        enabled,
      } = payload;


      // =================================================
      // VALIDATION
      // =================================================

      if (
        !medicationId ||
        !time ||
        !days ||
        !startDate
      ) {

        return res.status(400).json({
          message:
            'Medication, time, days, and start date are required',
        });

      }


      if (
        !Array.isArray(days) ||
        days.length === 0
      ) {

        return res.status(400).json({
          message:
            'At least one day must be selected',
        });

      }


      // =================================================
      // VERIFY MEDICATION
      // =================================================

      if (!ownerId) {
        return res.status(400).json({ message: 'Patient ID is required' });
      }

      if (!isValidObjectId(ownerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      if (!isValidObjectId(medicationId)) {
        return res.status(400).json({ message: 'Invalid medication ID' });
      }

      const medication =
        await Medication.findOne({

          _id:
            medicationId,

          userId: ownerId,

        });


      if (!medication) {

        return res.status(404).json({
          message:
            'Medication not found',
        });

      }

      const medicationDose =
        typeof medication.dosage === 'string' && medication.dosage.trim()
          ? medication.dosage.trim()
          : (typeof dose === 'string' && dose.trim() ? dose.trim() : '');

      if (!medicationDose) {
        return res.status(400).json({
          message: 'Selected medication must include a dosage.',
        });
      }


      // =================================================
      // VERIFY SCHEDULE
      // =================================================

      const existingSchedule =
        await MedicationSchedule.findOne({

          _id:
            req.params.id,

          userId: ownerId,

        });


      if (!existingSchedule) {

        return res.status(404).json({
          message:
            'Schedule not found',
        });

      }


      // =================================================
      // UPDATE
      // =================================================

      existingSchedule.medicationId =
        medicationId;

      existingSchedule.time =
        time.trim();

      existingSchedule.dose =
        medicationDose;

      existingSchedule.days =
        days;

      existingSchedule.startDate =
        startDate;

      existingSchedule.endDate =
        endDate
          ? endDate.trim()
          : null;

      existingSchedule.enabled =
        enabled !== undefined
          ? enabled
          : true;

          const scheduleChanged = existingSchedule.isModified();


      await existingSchedule.save();

      if (scheduleChanged) {
        await reconcilePendingDosesForSchedule({
          userId: ownerId,
          scheduleId: existingSchedule._id,
        });

        await generateTodayDoses(ownerId);
      }


      // =================================================
      // POPULATE UPDATED SCHEDULE
      // =================================================

      const populatedSchedule =
        await MedicationSchedule.findById(
          existingSchedule._id
        ).populate(
          'medicationId',
          'name dosage frequency'
        );

      if (scheduleChanged) {
        await createNotification({
          recipient: req.user.userId,
          type: 'schedule_changed',
          message: `Medication schedule updated for ${populatedSchedule.medicationId?.name || 'your medication'}.`,
          relatedEntityType: 'MedicationSchedule',
          relatedEntityId: populatedSchedule._id,
        });
      }

      console.log('[Schedule][Backend] Update successful', {
        scheduleId: existingSchedule?._id,
        userId: req.user?.userId,
        patientId: ownerId,
        time: existingSchedule?.time,
      });

      res.json(
        populatedSchedule
      );

    } catch (error) {

      console.error(
        '[Schedule][Backend] Update failed',
        {
          scheduleId: req.params?.id,
          userId: req.user?.userId,
          patientId: getOwnerId(req),
          message: error.message,
        }
      );

      return respondWithError(res, error);
    }
  }
);


// =====================================================
// DELETE MEDICATION SCHEDULE
// DELETE /api/schedules/:id
// =====================================================

router.delete(
  '/:id',
  authMiddleware,
  authorizeScheduleMutation,
  async (req, res) => {

    try {
      validateScheduleIdParam(req.params.id);
      const ownerId = getOwnerId(req);

      if (!ownerId) {
        return res.status(400).json({ message: 'Patient ID is required' });
      }

      if (!isValidObjectId(ownerId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      const schedule =
        await MedicationSchedule.findOneAndDelete({

          _id:
            req.params.id,

          userId: ownerId,

        });


      if (!schedule) {

        return res.status(404).json({
          message:
            'Schedule not found',
        });

      }

      await DoseRecord.deleteMany({
        userId: ownerId,
        scheduleId: schedule._id,
        status: 'pending',
      });


      res.json({
        message:
          'Schedule deleted successfully',
      });

    } catch (error) {

      console.error(
        'Delete schedule error:',
        error
      );

      return respondWithError(res, error);
    }
  }
);


module.exports = router;