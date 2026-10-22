const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const {
  getMedicationLocalParts,
  toWallClockTimestamp,
} = require('../utils/medicationTime');

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async () => true,
  },
};
delete require.cache[require.resolve('../routes/doseRoutes')];
const doseRoutes = require('../routes/doseRoutes');
if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

const USER_ID = '507f1f77bcf86cd799439012';
const MEDICATION_ID = '507f1f77bcf86cd799439011';
const SCHEDULE_ID = '507f1f77bcf86cd799439013';
const DOSE_ID = '507f1f77bcf86cd799439014';

const formatLocalDate = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const getYesterdayMedicationDate = () => {
  const today = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  today.setUTCDate(today.getUTCDate() - 1);
  return today;
};

const invokeRoute = async ({ method, path, user, body, models }) => {
  const layer = doseRoutes.stack.find((item) => (
    item.route?.path === path && item.route.methods[method]
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    medicationFindOne: Medication.findOne,
    scheduleFindOne: MedicationSchedule.findOne,
    scheduleFind: MedicationSchedule.find,
    doseFind: DoseRecord.find,
    doseFindOne: DoseRecord.findOne,
    doseFindById: DoseRecord.findById,
    doseCreate: DoseRecord.create,
    doseFindOneAndUpdate: DoseRecord.findOneAndUpdate,
    doseUpdateOne: DoseRecord.updateOne,
  };
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

  Medication.findOne = models.medicationFindOne || (async () => models.medication || null);
  MedicationSchedule.findOne = models.scheduleFindOne || (async () => models.schedule || null);
  MedicationSchedule.find = () => ({ lean: async () => [] });
  DoseRecord.find = () => ({
    populate() {
      return this;
    },
    lean: async () => [],
  });
  DoseRecord.findOne = models.doseFindOne || (async () => models.existingDose || null);
  DoseRecord.findById = models.doseFindById || (() => ({
    populate() {
      return this;
    },
    then(resolve) {
      resolve(models.populatedDose || models.existingDose || null);
    },
  }));
  DoseRecord.create = models.doseCreate || (async (dose) => ({ ...dose, _id: DOSE_ID }));
  DoseRecord.findOneAndUpdate = models.doseFindOneAndUpdate || (() => ({
    populate() {
      return this;
    },
    then(resolve) {
      resolve(models.updatedDose || null);
    },
  }));
  DoseRecord.updateOne = models.doseUpdateOne || (async () => ({}));

  try {
    await handler({
      user: user || { role: 'patient', userId: USER_ID },
      params: { id: DOSE_ID },
      body: body || {},
    }, response);
  } finally {
    Medication.findOne = originals.medicationFindOne;
    MedicationSchedule.findOne = originals.scheduleFindOne;
    MedicationSchedule.find = originals.scheduleFind;
    DoseRecord.find = originals.doseFind;
    DoseRecord.findOne = originals.doseFindOne;
    DoseRecord.findById = originals.doseFindById;
    DoseRecord.create = originals.doseCreate;
    DoseRecord.findOneAndUpdate = originals.doseFindOneAndUpdate;
    DoseRecord.updateOne = originals.doseUpdateOne;
  }

  return response;
};

const dosePayload = (scheduledDate) => ({
  medicationId: MEDICATION_ID,
  scheduleId: SCHEDULE_ID,
  scheduledDate,
  scheduledTime: '8:00 AM',
});

const pendingDose = (scheduledDate, overrides = {}) => ({
  _id: DOSE_ID,
  userId: USER_ID,
  medicationId: MEDICATION_ID,
  scheduledDate,
  scheduledTime: '8:00 AM',
  status: 'pending',
  refillDeducted: true,
  ...overrides,
});

test('POST /api/doses accepts a dose scheduled on expiration day', async () => {
  let createdDose;
  const response = await invokeRoute({
    method: 'post',
    path: '/',
    body: dosePayload('2026-10-10'),
    models: {
      medication: { expirationDate: '2026-10-10' },
      schedule: { _id: SCHEDULE_ID },
      doseCreate: async (dose) => {
        createdDose = dose;
        return { ...dose, _id: DOSE_ID };
      },
      doseFindById: () => ({
        populate() {
          return this;
        },
        then(resolve) {
          resolve({ scheduledDate: createdDose.scheduledDate });
        },
      }),
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(createdDose.scheduledDate, '2026-10-10');
});

test('POST /api/doses preserves legacy behavior without medication expiration', async () => {
  let createdDose;
  const response = await invokeRoute({
    method: 'post',
    path: '/',
    body: dosePayload('2026-10-11'),
    models: {
      medication: { expirationDate: null },
      schedule: { _id: SCHEDULE_ID },
      doseCreate: async (dose) => {
        createdDose = dose;
        return { ...dose, _id: DOSE_ID };
      },
      doseFindById: () => ({
        populate() {
          return this;
        },
        then(resolve) {
          resolve({ scheduledDate: createdDose.scheduledDate });
        },
      }),
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(createdDose.scheduledDate, '2026-10-11');
});

test('POST /api/doses rejects a date after expiration with the specific date message', async () => {
  const response = await invokeRoute({
    method: 'post',
    path: '/',
    body: dosePayload('2026-10-11'),
    models: {
      medication: { expirationDate: '2026-10-10' },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Cannot create a dose scheduled for 2026-10-11 because the medication expired on 2026-10-10.');
});

test('take route allows a pending dose scheduled on expiration day after expiration', async () => {
  const expirationDate = getYesterdayMedicationDate();
  const expirationDateString = formatLocalDate(expirationDate);

  const response = await invokeRoute({
    method: 'put',
    path: '/:id/take',
    models: {
      medication: { expirationDate: expirationDateString },
      existingDose: pendingDose(expirationDateString),
      doseFindOneAndUpdate: async (_filter, update) => ({
        ...pendingDose(expirationDateString),
        ...update.$set,
      }),
      doseFindById: () => ({
        populate() {
          return this;
        },
        then(resolve) {
          resolve(pendingDose(expirationDateString, { status: 'taken' }));
        },
      }),
    },
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, 'taken');
});

test('a missed dose can be corrected with an actual past time and a required reason', async () => {
  const expirationDate = getYesterdayMedicationDate();
  const scheduledDate = formatLocalDate(expirationDate);
  const actualTakenAt = new Date(Date.now() - 30 * 60 * 1000);
  let update;
  const response = await invokeRoute({
    method: 'put',
    path: '/:id/correct-taken',
    user: { role: 'caregiver', userId: '507f1f77bcf86cd799439019' },
    body: {
      patientId: USER_ID,
      takenAt: actualTakenAt.toISOString(),
      correctionReason: 'Dose was taken before the missed status was noticed.',
    },
    models: {
      medication: { expirationDate: null, frequency: 'Daily' },
      existingDose: pendingDose(scheduledDate, {
        status: 'missed',
        refillDeducted: true,
      }),
      doseFindOneAndUpdate: async (_filter, doseUpdate) => {
        update = doseUpdate;
        return { ...pendingDose(scheduledDate), ...doseUpdate.$set };
      },
      doseFindById: () => ({
        populate() {
          return this;
        },
        then(resolve) {
          resolve({ ...pendingDose(scheduledDate), ...update.$set });
        },
      }),
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(response.body.takenTiming, 'late');
  assert.equal(response.body.takenAt.toISOString(), actualTakenAt.toISOString());
  assert.equal(response.body.correctionFromStatus, 'missed');
  assert.ok(response.body.correctedAt instanceof Date);
  assert.equal(response.body.correctionReason, 'Dose was taken before the missed status was noticed.');
  assert.equal(response.body.takenByRole, 'caregiver');
  assert.equal(response.body.takenBy, '507f1f77bcf86cd799439019');
});

test('missed-dose correction rejects a missing reason and future administration time', async () => {
  const pastDose = pendingDose(formatLocalDate(getYesterdayMedicationDate()), {
    status: 'missed',
    refillDeducted: true,
  });
  const missingReason = await invokeRoute({
    method: 'put',
    path: '/:id/correct-taken',
    body: { takenAt: new Date().toISOString() },
    models: { medication: { expirationDate: null }, existingDose: pastDose },
  });
  const futureTime = await invokeRoute({
    method: 'put',
    path: '/:id/correct-taken',
    body: {
      takenAt: new Date(Date.now() + 60 * 1000).toISOString(),
      correctionReason: 'Entered in error.',
    },
    models: { medication: { expirationDate: null }, existingDose: pastDose },
  });

  assert.equal(missingReason.statusCode, 400);
  assert.match(missingReason.body.message, /reason/i);
  assert.equal(futureTime.statusCode, 400);
  assert.match(futureTime.body.message, /future/i);
});

test('skip route allows a pending dose scheduled on expiration day after expiration', async () => {
  const expirationDate = getYesterdayMedicationDate();
  const expirationDateString = formatLocalDate(expirationDate);

  const response = await invokeRoute({
    method: 'put',
    path: '/:id/skip',
    models: {
      medication: { expirationDate: expirationDateString },
      existingDose: pendingDose(expirationDateString),
      doseFindOneAndUpdate: () => ({
        populate() {
          return this;
        },
        then(resolve) {
          resolve(pendingDose(expirationDateString, { status: 'skipped' }));
        },
      }),
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'skipped');
});

for (const path of ['/:id/take', '/:id/skip']) {
  test(`${path} rejects a dose scheduled after medication expiration`, async () => {
    const response = await invokeRoute({
      method: 'put',
      path,
      models: {
        medication: { expirationDate: '2026-10-10' },
        existingDose: pendingDose('2026-10-11'),
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, 'Cannot update a dose scheduled after the medication expiration date.');
  });
}