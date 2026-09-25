const express = require('express');

const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const DoseRecord = require('../models/DoseRecord');
const {
  isValidObjectId,
  pickAllowedFields,
  containsMongoOperatorPayload,
  validateMedicationFields,
} = require('../utils/validation');

const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');

const router = express.Router();

const parseNonNegativeNumber = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    value === '' ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0
  ) {
    const error = new Error(`${fieldName} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }

  return Number(value);
};

const authorizeMedicationMutation = async (req, res, next) => {
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

const validateMedicationIdParam = (value) => {
  if (!isValidObjectId(value)) {
    const error = new Error('Invalid medication ID');
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const validateMedicationPayload = (payload) => {
  if (containsMongoOperatorPayload(payload)) {
    const error = new Error('Invalid medication payload');
    error.statusCode = 400;
    throw error;
  }

  const allowedFields = ['name', 'dosage', 'frequency', 'quantityOnHand', 'refillThreshold'];
  const filtered = pickAllowedFields(payload, allowedFields);

  if (!filtered) {
    const error = new Error('Unexpected medication fields');
    error.statusCode = 400;
    throw error;
  }

  const validationError = validateMedicationFields(filtered);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  return filtered;
};


// ======================================================
// GET ALL MEDICATIONS
// GET /api/medications
// ======================================================

router.get('/', authMiddleware, async (req, res) => {

  try {

    const medications =
      await Medication.find({

        userId:
          req.user.userId,

      }).sort({

        createdAt: -1,

      });


    res.json(medications);

  } catch (error) {

    console.error(
      'Get medications error:',
      error
    );

    res.status(500).json({

      message:
        'Failed to retrieve medications',

    });

  }

});


// ======================================================
// GET ONE MEDICATION
// GET /api/medications/:id
// ======================================================

router.get('/:id', authMiddleware, async (req, res) => {

  try {
    validateMedicationIdParam(req.params.id);

    const medication =
      await Medication.findOne({

        _id:
          req.params.id,

        userId:
          req.user.userId,

      });


    if (!medication) {

      return res.status(404).json({

        message:
          'Medication not found',

      });

    }


    res.json(medication);

  } catch (error) {

    console.error(
      'Get medication error:',
      error
    );

    res.status(500).json({

      message:
        'Failed to retrieve medication',

    });

  }

});


// ======================================================
// CREATE MEDICATION
// POST /api/medications
// ======================================================

router.post('/', authMiddleware, async (req, res) => {

  try {
    const payload = validateMedicationPayload(req.body);
    const {
      name,
      dosage,
      frequency,
      quantityOnHand,
      refillThreshold,
    } = payload;


    if (
      !name ||
      !dosage ||
      !frequency
    ) {

      return res.status(400).json({

        message:
          'Name, dosage, and frequency are required',

      });

    }


    const normalizedQuantity = parseNonNegativeNumber(quantityOnHand, 'Quantity on hand');
    const normalizedThreshold = parseNonNegativeNumber(refillThreshold, 'Refill threshold');

    if (req.user.role === 'caregiver') {
      return authorizeMedicationMutation(req, res, async () => {
        return createMedicationForOwner(req, res);
      });
    }

    return createMedicationForOwner(req, res);
  } catch (error) {
    console.error(
      'Create medication error:',
      error
    );

    res.status(error.statusCode || 500).json({
      message:
        'Failed to create medication',
    });

  }
});

const createMedicationForOwner = async (req, res) => {
  try {
    const payload = validateMedicationPayload(req.body);
    const {
      name,
      dosage,
      frequency,
      quantityOnHand,
      refillThreshold,
    } = payload;
    const ownerId = getOwnerId(req);

    if (req.user.role === 'caregiver' && ownerId && !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }

    if (!ownerId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const normalizedQuantity = parseNonNegativeNumber(quantityOnHand, 'Quantity on hand');
    const normalizedThreshold = parseNonNegativeNumber(refillThreshold, 'Refill threshold');

    const medication =
      await Medication.create({

        userId:
          ownerId,

        name:
          name.trim(),

        dosage:
          dosage.trim(),

        frequency:
          frequency.trim(),

        quantityOnHand: normalizedQuantity ?? 0,

        refillThreshold: normalizedThreshold ?? 0,

      });


    return res.status(201).json(medication);
  } catch (error) {
    console.error('Create medication error:', error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Failed to create medication',
    });
  }
};


// ======================================================
// UPDATE MEDICATION
// PUT /api/medications/:id
// ======================================================

router.put('/:id', authMiddleware, authorizeMedicationMutation, async (req, res) => {

  try {
    validateMedicationIdParam(req.params.id);
    const payload = validateMedicationPayload(req.body);
    const {
      name,
      dosage,
      frequency,
      quantityOnHand,
      refillThreshold,
    } = payload;


    if (
      !name ||
      !dosage ||
      !frequency
    ) {

      return res.status(400).json({

        message:
          'Name, dosage, and frequency are required',

      });

    }


    const normalizedQuantity = parseNonNegativeNumber(quantityOnHand, 'Quantity on hand');
    const normalizedThreshold = parseNonNegativeNumber(refillThreshold, 'Refill threshold');

    const update = {
      name: name.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim(),
    };

    if (normalizedQuantity !== undefined) {
      update.quantityOnHand = normalizedQuantity;

      if (normalizedQuantity > (normalizedThreshold ?? 0)) {
        update.lowRefillNotified = false;
      }
    }

    if (normalizedThreshold !== undefined) {
      update.refillThreshold = normalizedThreshold;

      if ((normalizedQuantity ?? 0) > normalizedThreshold) {
        update.lowRefillNotified = false;
      }
    }

    const ownerId = getOwnerId(req);

    if (!ownerId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    if (!isValidObjectId(ownerId)) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }

    const medication =
      await Medication.findOneAndUpdate(

        {
          _id:
            req.params.id,

          userId: ownerId,
        },

        update,

        {
        returnDocument: 'after',
        runValidators: true,
        }

      );


    if (!medication) {

      return res.status(404).json({

        message:
          'Medication not found',

      });

    }


    res.json(
      medication
    );

  } catch (error) {

    console.error(
      'Update medication error:',
      error
    );

    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : 'Failed to update medication',
    });

  }

});


// ======================================================
// DELETE MEDICATION
// DELETE /api/medications/:id
// ======================================================

router.delete('/:id', authMiddleware, authorizeMedicationMutation, async (req, res) => {

  try {
    validateMedicationIdParam(req.params.id);

    const ownerId = getOwnerId(req);

    if (!ownerId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    if (!isValidObjectId(ownerId)) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }

    const medication =
      await Medication.findOneAndDelete({

        _id:
          req.params.id,

          userId: ownerId,

      });


    if (!medication) {

      return res.status(404).json({

        message:
          'Medication not found',

      });

    }

    await MedicationSchedule.deleteMany({
      medicationId: medication._id,
      userId: ownerId,
    });

    await DoseRecord.deleteMany({
      medicationId: medication._id,
      userId: ownerId,
    });


    res.json({

      message:
        'Medication deleted successfully',

    });

  } catch (error) {

    console.error(
      'Delete medication error:',
      error
    );

    res.status(500).json({

      message:
        'Failed to delete medication',

    });

  }

});


module.exports = router;