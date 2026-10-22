const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');

const doseGeneratorPath = require.resolve('../services/doseGenerator');
const notificationServicePath = require.resolve('../services/notificationService');
const originalDoseGenerator = require.cache[doseGeneratorPath];
const originalNotificationService = require.cache[notificationServicePath];
const reconciledSchedules = [];
const generatedForUsers = [];

require.cache[doseGeneratorPath] = {
  id: doseGeneratorPath,
  filename: doseGeneratorPath,
  loaded: true,
  exports: {
    generateTodayDoses: async (userId) => generatedForUsers.push(String(userId)),
    reconcilePendingDosesForSchedule: async (options) => reconciledSchedules.push(options),
  },
};
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async () => null,
    notifyLowRefill: async () => null,
  },
};
delete require.cache[require.resolve('../routes/medicationRoutes')];
const medicationRoutes = require('../routes/medicationRoutes');
if (originalDoseGenerator) require.cache[doseGeneratorPath] = originalDoseGenerator;
else delete require.cache[doseGeneratorPath];
if (originalNotificationService) require.cache[notificationServicePath] = originalNotificationService;
else delete require.cache[notificationServicePath];

const MEDICATION_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439012';
const CAREGIVER_ID = '507f1f77bcf86cd799439013';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invokeUpdate = async ({
  role = 'patient',
  userId = PATIENT_ID,
  patientId,
  permission = 'ADHERENCE_SUPPORT',
  medication,
  payload,
  schedule,
}) => {
  const route = medicationRoutes.stack.find((layer) => (
    layer.route?.path === '/:id' && layer.route.methods.put
  ));
  const authorize = route.route.stack.at(-2).handle;
  const handler = route.route.stack.at(-1).handle;
  const originals = {
    startSession: mongoose.startSession,
    medicationFindOne: Medication.findOne,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
    scheduleFindOne: MedicationSchedule.findOne,
    scheduleUpdate: MedicationSchedule.updateOne,
    relationshipFindOne: CaregiverRelationship.findOne,
    patientFindOne: User.findOne,
  };
  let medicationFindCount = 0;
  const updatedMedication = {
    ...medication,
    ...payload,
    updatedAt: new Date(),
  };
  const scheduleDocument = schedule ? {
    ...schedule,
    save: async () => {},
  } : null;
  const transactionSession = {
    withTransaction: async (operation) => operation(),
    endSession: async () => {},
  };
  let medicationUpdate;

  Medication.findOne = async (filter) => {
    medicationFindCount += 1;
    if (medicationFindCount === 1) {
      assert.equal(String(filter.userId), PATIENT_ID);
      return medication;
    }
    return null;
  };
  Medication.findOneAndUpdate = async (_filter, update, options) => {
    assert.equal(options.session, transactionSession);
    medicationUpdate = update;
    return updatedMedication;
  };
  MedicationSchedule.findOne = () => ({
    session: async () => scheduleDocument,
  });
  MedicationSchedule.updateOne = async () => ({ matchedCount: 1 });
  CaregiverRelationship.findOne = async () => ({ permission });
  User.findOne = (filter) => ({
    select: async () => ({ _id: filter._id }),
  });
  mongoose.startSession = async () => transactionSession;
  reconciledSchedules.length = 0;
  generatedForUsers.length = 0;

  const res = response();
  const req = {
    user: { role, userId },
    params: { id: MEDICATION_ID },
    query: patientId ? { patientId } : {},
    body: payload,
  };

  try {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
        Promise.resolve(handler(req, res)).then(resolve, reject);
      };

      Promise.resolve(authorize(req, res, next)).then(() => {
        if (!nextCalled) resolve();
      }, reject);
    });
  } finally {
    mongoose.startSession = originals.startSession;
    Medication.findOne = originals.medicationFindOne;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
    MedicationSchedule.findOne = originals.scheduleFindOne;
    MedicationSchedule.updateOne = originals.scheduleUpdate;
    CaregiverRelationship.findOne = originals.relationshipFindOne;
    User.findOne = originals.patientFindOne;
  }

  return { response: res, scheduleDocument, medicationUpdate };
};

const medication = {
  _id: MEDICATION_ID,
  userId: PATIENT_ID,
  name: 'Medicine',
  dosage: '10 mg',
  frequency: 'Every 8 hours',
  expirationDate: '2099-12-31',
  quantityOnHand: 12,
  refillThreshold: 2,
};

const payload = {
  name: 'Medicine',
  dosage: '20 mg',
  frequency: 'Every 12 hours',
  expirationDate: '2099-12-31',
  quantityOnHand: 12,
  refillThreshold: 2,
};

test('ADHERENCE_SUPPORT caregiver updates medication, linked schedule dose, and pending generated doses for patient', async () => {
  const { response: res, scheduleDocument } = await invokeUpdate({
    role: 'caregiver',
    userId: CAREGIVER_ID,
    patientId: PATIENT_ID,
    medication,
    payload,
    schedule: { _id: 'schedule-id', dose: '10 mg' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(scheduleDocument.dose, '20 mg');
  assert.equal(reconciledSchedules.length, 1);
  assert.equal(String(reconciledSchedules[0].userId), PATIENT_ID);
  assert.equal(reconciledSchedules[0].scheduleId, 'schedule-id');
  assert.ok(reconciledSchedules[0].session);
  assert.deepEqual(generatedForUsers, [PATIENT_ID]);
});

test('unchanged legacy frequency can be preserved while editing other medication fields', async () => {
  const legacyMedication = { ...medication, frequency: 'Twice daily' };
  const legacyPayload = { ...payload, frequency: 'Twice daily' };

  const { response: res } = await invokeUpdate({
    medication: legacyMedication,
    payload: legacyPayload,
    schedule: null,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.frequency, 'Twice daily');
  assert.equal(reconciledSchedules.length, 0);
  assert.deepEqual(generatedForUsers, []);
});

test('legacy frequency cannot be changed without using a supported interval', async () => {
  const legacyMedication = { ...medication, frequency: 'Twice daily' };
  const changedPayload = { ...payload, frequency: 'Every day' };

  const { response: res } = await invokeUpdate({
    medication: legacyMedication,
    payload: changedPayload,
    schedule: null,
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /whole number from 1 to 99/i);
  assert.deepEqual(generatedForUsers, []);
});

test('medication expiration stays synchronized with the latest remaining stock batch', async () => {
  const medicationWithBatches = {
    ...medication,
    expirationDate: '2035-01-01',
    stockBatches: [
      { remainingQuantity: 5, expirationDate: '2030-05-01' },
      { remainingQuantity: 7, expirationDate: '2035-01-01' },
    ],
  };
  const payloadWithLaterExpiration = {
    ...payload,
    expirationDate: '2040-01-01',
  };
  const { response: res, medicationUpdate } = await invokeUpdate({
    medication: medicationWithBatches,
    payload: payloadWithLaterExpiration,
    schedule: null,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(medicationUpdate.expirationDate, '2035-01-01');
});
