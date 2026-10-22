const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');
const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
const lowRefillNotificationCalls = [];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async () => null,
    notifyLowRefill: async (payload) => {
      lowRefillNotificationCalls.push(payload);
      return null;
    },
  },
};
delete require.cache[require.resolve('../routes/medicationRoutes')];
const medicationRoutes = require('../routes/medicationRoutes');
if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

const MEDICATION_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439012';
const OTHER_PATIENT_ID = '507f1f77bcf86cd799439013';
const CAREGIVER_ID = '507f1f77bcf86cd799439014';

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const invokeRefillRoute = async ({
  role = 'patient',
  userId = PATIENT_ID,
  patientId,
  permission = 'ADHERENCE_SUPPORT',
  relationshipExists = true,
  patientActive = true,
  medication = { _id: MEDICATION_ID, userId: PATIENT_ID, quantityOnHand: 2, refillThreshold: 5, expirationDate: null },
  refillAmount,
  expirationDate,
}) => {
  const layer = medicationRoutes.stack.find((item) => (
    item.route?.path === '/:id/refill' && item.route.methods.post
  ));
  const authorize = layer.route.stack.at(-2).handle;
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    medicationFindOne: Medication.findOne,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
    relationshipFindOne: CaregiverRelationship.findOne,
    patientFindOne: User.findOne,
  };
  let currentMedication = medication;
  const captured = { medicationQuery: null, updateFilter: null, updateData: null };
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  Medication.findOne = async (query) => {
    captured.medicationQuery = query;
    return currentMedication;
  };
  lowRefillNotificationCalls.length = 0;
  Medication.findOneAndUpdate = async (filter, update) => {
    captured.updateFilter = filter;
    captured.updateData = update;
    if (update.$set?.stockBatches) {
      currentMedication = {
        ...currentMedication,
        stockBatches: update.$set.stockBatches,
      };
      return currentMedication;
    }
    const newQuantity = currentMedication.quantityOnHand + Number(refillAmount);
    const newBatches = [
      ...(currentMedication.stockBatches || []),
      ...(update.$push?.stockBatches ? [update.$push.stockBatches] : []),
    ];
    currentMedication = {
      ...currentMedication,
      quantityOnHand: newQuantity,
      stockBatches: newBatches,
      expirationDate: update.$set?.expirationDate ?? currentMedication.expirationDate,
      lowRefillNotified: newQuantity > currentMedication.refillThreshold
        ? false
        : currentMedication.lowRefillNotified,
    };
    return currentMedication;
  };
  CaregiverRelationship.findOne = async () => (
    relationshipExists ? { permission } : null
  );
  User.findOne = (filter) => ({
    select: async () => (patientActive ? { _id: filter._id } : null),
  });

  const req = {
    user: { role, userId },
    params: { id: MEDICATION_ID },
    query: patientId ? { patientId } : {},
    body: {
      refillAmount,
      ...(expirationDate !== undefined
        ? { expirationDate }
        : {}),
    },
  };

  try {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
        Promise.resolve(handler(req, response)).then(resolve, reject);
      };

      Promise.resolve(authorize(req, response, next)).then(() => {
        if (!nextCalled) resolve();
      }, reject);
    });
  } finally {
    Medication.findOne = originals.medicationFindOne;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
    CaregiverRelationship.findOne = originals.relationshipFindOne;
    User.findOne = originals.patientFindOne;
  }

  return { response, captured, lowRefillNotificationCalls: [...lowRefillNotificationCalls] };
};

test('patient refill increments stock by a positive amount and preserves other fields', async () => {
  const { response, captured } = await invokeRefillRoute({
    refillAmount: 10,
    medication: {
      _id: MEDICATION_ID,
      userId: PATIENT_ID,
      name: 'Medicine',
      dosage: '10 mg',
      frequency: 'Daily',
      quantityOnHand: 9,
      refillThreshold: 5,
      expirationDate: null,
      lowRefillNotified: true,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.quantityOnHand, 19);
  assert.equal(response.body.refillThreshold, 5);
  assert.equal(response.body.expirationDate, null);
  assert.equal(response.body.name, 'Medicine');
  assert.equal(response.body.lowRefillNotified, false);
  assert.deepEqual(
    response.body.stockBatches.map((batch) => batch.remainingQuantity),
    [9, 10]
  );
  assert.equal(response.body.stockBatches[0].source, 'legacy');
  assert.equal(response.body.stockBatches[1].source, 'refill');
  assert.equal(String(captured.medicationQuery.userId), PATIENT_ID);
  assert.equal(captured.updateData.$inc.quantityOnHand, 10);
  assert.equal(captured.updateData.$set.lowRefillNotified, false);
});

test('refill in a still-low stock state invokes the low-refill notification flow', async () => {
  const { response, lowRefillNotificationCalls: calls } = await invokeRefillRoute({
    refillAmount: 1,
    medication: {
      _id: MEDICATION_ID,
      userId: PATIENT_ID,
      name: 'Medicine',
      quantityOnHand: 2,
      refillThreshold: 5,
      expirationDate: null,
      lowRefillNotified: false,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.quantityOnHand, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].medication.quantityOnHand, 3);
});

for (const [amount, expectedMessage] of [
  ['', 'Refill amount is required.'],
  ['abc', 'Refill amount must be a valid number greater than 0.'],
  ['0x10', 'Refill amount must be a valid number greater than 0.'],
  [0, 'Refill amount must be greater than 0.'],
  [-2, 'Refill amount must be greater than 0.'],
]) {
  test(`refill rejects invalid amount ${JSON.stringify(amount)}`, async () => {
    const { response } = await invokeRefillRoute({ refillAmount: amount });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, expectedMessage);
  });
}

test('refill amount accepts six digits and existing decimal quantities', async () => {
  const maximum = await invokeRefillRoute({ refillAmount: '999999' });
  assert.equal(maximum.response.statusCode, 200);
  assert.equal(maximum.response.body.quantityOnHand, 1000001);

  const decimal = await invokeRefillRoute({ refillAmount: '1.5' });
  assert.equal(decimal.response.statusCode, 200);
  assert.equal(decimal.response.body.quantityOnHand, 3.5);
});

for (const amount of [
  '9999999',
  '2.13132132132134e+35',
  '213213213213213213213213',
  '1e10',
  2.13132132132134e+35,
]) {
  test(`refill rejects oversized or scientific notation amount ${JSON.stringify(amount)}`, async () => {
    const { response } = await invokeRefillRoute({ refillAmount: amount });
    assert.equal(response.statusCode, 400);
  });
}

test('refill is allowed on expiration day and rejected after expiration', async () => {
  const today = formatLocalDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const onExpiration = await invokeRefillRoute({
    refillAmount: 1,
    medication: { _id: MEDICATION_ID, userId: PATIENT_ID, quantityOnHand: 2, refillThreshold: 5, expirationDate: today },
  });
  assert.equal(onExpiration.response.statusCode, 200);

  const expired = await invokeRefillRoute({
    refillAmount: 1,
    medication: { _id: MEDICATION_ID, userId: PATIENT_ID, quantityOnHand: 2, refillThreshold: 5, expirationDate: formatLocalDate(yesterdayDate) },
  });
  assert.equal(expired.response.statusCode, 400);
  assert.equal(expired.response.body.message, 'Cannot refill an expired medication.');
});

test('new refill batch requires a valid non-past expiration date', async () => {
  const today = formatLocalDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const todayBatch = await invokeRefillRoute({
    refillAmount: 1,
    expirationDate: today,
    medication: {
      _id: MEDICATION_ID,
      userId: PATIENT_ID,
      quantityOnHand: 2,
      refillThreshold: 5,
      expirationDate: formatLocalDate(yesterday),
    },
  });
  assert.equal(todayBatch.response.statusCode, 200);
  assert.equal(todayBatch.response.body.stockBatches.at(-1).expirationDate, today);

  const pastBatch = await invokeRefillRoute({
    refillAmount: 1,
    expirationDate: formatLocalDate(yesterday),
  });
  assert.equal(pastBatch.response.statusCode, 400);
  assert.equal(pastBatch.response.body.message, 'Batch expiration date cannot be earlier than today.');

  const invalidBatch = await invokeRefillRoute({
    refillAmount: 1,
    expirationDate: '2026-02-30',
  });
  assert.equal(invalidBatch.response.statusCode, 400);
  assert.equal(invalidBatch.response.body.message, 'Batch expiration date must be a valid YYYY-MM-DD date.');
});

test('ADHERENCE_SUPPORT caregiver can refill the selected patient medication', async () => {
  const { response, captured } = await invokeRefillRoute({
    role: 'caregiver',
    userId: CAREGIVER_ID,
    patientId: PATIENT_ID,
    permission: 'ADHERENCE_SUPPORT',
    refillAmount: 3,
    expirationDate: '2099-12-31',
    medication: { _id: MEDICATION_ID, userId: PATIENT_ID, quantityOnHand: 2, refillThreshold: 5, expirationDate: null },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(String(captured.medicationQuery.userId), PATIENT_ID);
  const refillBatch = response.body.stockBatches.find((batch) => batch.source === 'refill');
  assert.equal(refillBatch.expirationDate, '2099-12-31');
  assert.equal(String(refillBatch.receivedBy), CAREGIVER_ID);
});

test('VIEW_ONLY caregiver cannot refill', async () => {
  const { response, captured } = await invokeRefillRoute({
    role: 'caregiver',
    userId: CAREGIVER_ID,
    patientId: PATIENT_ID,
    permission: 'VIEW_ONLY',
    refillAmount: 3,
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'ADHERENCE_SUPPORT permission required');
  assert.equal(captured.medicationQuery, null);
});

test('caregiver cannot refill an unrelated patient medication', async () => {
  const { response, captured } = await invokeRefillRoute({
    role: 'caregiver',
    userId: CAREGIVER_ID,
    patientId: OTHER_PATIENT_ID,
    relationshipExists: false,
    refillAmount: 3,
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'You are not authorized to access this patient.');
  assert.equal(captured.medicationQuery, null);
});

test('manual quantity update above threshold re-arms existing low-refill notification state', async () => {
  const layer = medicationRoutes.stack.find((item) => (
    item.route?.path === '/:id' && item.route.methods.put
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    startSession: mongoose.startSession,
    medicationFindOne: Medication.findOne,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
    scheduleFindOne: MedicationSchedule.findOne,
  };
  let update;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  let medicationLookupCount = 0;
  Medication.findOne = async () => {
    medicationLookupCount += 1;
    return medicationLookupCount === 1
      ? {
        _id: MEDICATION_ID,
        userId: PATIENT_ID,
        name: 'Medicine',
        dosage: '10 mg',
        frequency: 'Every 8 hours',
        expirationDate: '2099-01-01',
      }
      : null;
  };
  Medication.findOneAndUpdate = async (_filter, fields) => {
    update = fields;
    return { _id: MEDICATION_ID, quantityOnHand: fields.quantityOnHand, refillThreshold: fields.refillThreshold };
  };
  MedicationSchedule.findOne = () => ({
    session: async () => null,
  });
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });

  try {
    await handler({
      user: { role: 'patient', userId: PATIENT_ID },
      params: { id: MEDICATION_ID },
      body: {
        name: 'Medicine',
        dosage: '10 mg',
        frequency: 'Every 8 hours',
        quantityOnHand: 10,
        refillThreshold: 5,
        expirationDate: '2099-01-01',
      },
    }, response);
  } finally {
    mongoose.startSession = originals.startSession;
    Medication.findOne = originals.medicationFindOne;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
    MedicationSchedule.findOne = originals.scheduleFindOne;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(update.quantityOnHand, 10);
  assert.equal(update.lowRefillNotified, false);
});