const test = require('node:test');
const assert = require('node:assert/strict');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const scheduleRoutes = require('../routes/scheduleRoutes');

const USER_ID = '507f1f77bcf86cd799439012';
const MEDICATION_ID = '507f1f77bcf86cd799439011';
const SCHEDULE_ID = '507f1f77bcf86cd799439013';

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = formatLocalDate(new Date());

const invokeScheduleHandler = async ({ method, body, medication, schedule }) => {
  const layer = scheduleRoutes.stack.find((item) => (
    item.route?.path === (method === 'post' ? '/' : '/:id')
      && item.route.methods[method]
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originalMedicationFindOne = Medication.findOne;
  const originalScheduleFindOne = MedicationSchedule.findOne;
  const originalScheduleCreate = MedicationSchedule.create;
  const originalConsoleLog = console.log;
  let createCalled = false;
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

  Medication.findOne = async () => medication;
  MedicationSchedule.findOne = async () => schedule || null;
  MedicationSchedule.create = async () => {
    createCalled = true;
    throw new Error('Schedule creation should not be reached in this test.');
  };
  console.log = () => {};

  try {
    await handler({
      user: { role: 'patient', userId: USER_ID },
      params: { id: SCHEDULE_ID },
      query: {},
      body,
    }, response);
  } finally {
    Medication.findOne = originalMedicationFindOne;
    MedicationSchedule.findOne = originalScheduleFindOne;
    MedicationSchedule.create = originalScheduleCreate;
    console.log = originalConsoleLog;
  }

  return { response, createCalled };
};

const newSchedulePayload = (overrides = {}) => ({
  medicationId: MEDICATION_ID,
  time: '08:30',
  dose: '10 mg',
  days: ['Monday'],
  startDate: today,
  endDate: today,
  enabled: true,
  ...overrides,
});

test('POST /api/schedules rejects null endDate for medication with expiration', async () => {
  const { response, createCalled } = await invokeScheduleHandler({
    method: 'post',
    body: newSchedulePayload({ endDate: null }),
    medication: { expirationDate: today, dosage: '10 mg' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'End date is required because this medication has an expiration date.');
  assert.equal(createCalled, false);
});

test('POST /api/schedules accepts expiration-day start and end before duplicate protection', async () => {
  const { response, createCalled } = await invokeScheduleHandler({
    method: 'post',
    body: newSchedulePayload(),
    medication: { expirationDate: today, dosage: '10 mg' },
    schedule: { _id: SCHEDULE_ID },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.message, 'This medication already has a schedule.');
  assert.equal(createCalled, false);
});

test('POST /api/schedules gives expiration-specific error for empty endDate', async () => {
  const { response, createCalled } = await invokeScheduleHandler({
    method: 'post',
    body: newSchedulePayload({ endDate: '' }),
    medication: { expirationDate: today, dosage: '10 mg' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'End date is required because this medication has an expiration date.');
  assert.equal(createCalled, false);
});

test('POST /api/schedules rejects start after expiration at the route', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const expirationDate = formatLocalDate(tomorrow);

  const { response, createCalled } = await invokeScheduleHandler({
    method: 'post',
    body: newSchedulePayload({
      startDate: formatLocalDate(dayAfterTomorrow),
      endDate: formatLocalDate(dayAfterTomorrow),
    }),
    medication: { expirationDate, dosage: '10 mg' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Schedule start date cannot be after the medication expiration date.');
  assert.equal(createCalled, false);
});

test('POST /api/schedules rejects an already expired medication at the route', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expirationDate = formatLocalDate(yesterday);

  const { response, createCalled } = await invokeScheduleHandler({
    method: 'post',
    body: newSchedulePayload(),
    medication: { expirationDate, dosage: '10 mg' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, `Cannot create a schedule for an expired medication. This medication expired on ${expirationDate}.`);
  assert.equal(createCalled, false);
});

test('PUT /api/schedules/:id rejects an edited endDate after medication expiration', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const existingSchedule = {
    _id: SCHEDULE_ID,
    medicationId: MEDICATION_ID,
    startDate: today,
    endDate: null,
    time: '08:30',
    dose: '10 mg',
    days: ['Monday'],
    enabled: true,
  };

  const { response } = await invokeScheduleHandler({
    method: 'put',
    body: { endDate: formatLocalDate(tomorrow) },
    medication: { expirationDate: today, dosage: '10 mg' },
    schedule: existingSchedule,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Schedule end date cannot be after the medication expiration date.');
});

test('PUT /api/schedules/:id rejects a missing endDate for an expiring legacy schedule', async () => {
  const existingSchedule = {
    _id: SCHEDULE_ID,
    medicationId: MEDICATION_ID,
    startDate: today,
    endDate: null,
    time: '08:30',
    dose: '10 mg',
    days: ['Monday'],
    enabled: true,
  };

  const { response } = await invokeScheduleHandler({
    method: 'put',
    body: { endDate: null },
    medication: { expirationDate: '2099-01-01', dosage: '10 mg' },
    schedule: existingSchedule,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'End date is required because this medication has an expiration date.');
});