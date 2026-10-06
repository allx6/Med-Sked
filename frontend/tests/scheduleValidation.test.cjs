const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../utils/scheduleValidation.js'),
  'utf8'
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let validateScheduleFields;
let getScheduleSubmissionErrorMessage;

test('load frontend schedule validation helpers', async () => {
  const helpers = await import(moduleUrl);
  validateScheduleFields = helpers.validateScheduleFields;
  getScheduleSubmissionErrorMessage = helpers.getScheduleSubmissionErrorMessage;
});

const baseSchedule = (overrides = {}) => ({
  medicationId: 'medication-id',
  time: '08:30',
  dose: '10 mg',
  days: ['Monday'],
  startDate: '2027-10-01',
  endDate: '2027-10-02',
  enabled: true,
  ...overrides,
});

test('frontend accepts schedule ending exactly on medication expiration', () => {
  assert.equal(validateScheduleFields(baseSchedule(), {
    medicationExpirationDate: '2027-10-02',
  }), '');
});

test('frontend accepts start on medication expiration when end is the same date', () => {
  assert.equal(validateScheduleFields(baseSchedule({
    startDate: '2027-10-02',
    endDate: '2027-10-02',
  }), {
    medicationExpirationDate: '2027-10-02',
  }), '');
});

test('frontend rejects start after medication expiration', () => {
  assert.equal(validateScheduleFields(baseSchedule({
    startDate: '2027-10-03',
    endDate: '2027-10-03',
  }), {
    medicationExpirationDate: '2027-10-02',
  }), 'Schedule start date cannot be after the medication expiration date.');
});

test('frontend rejects end after medication expiration', () => {
  assert.equal(validateScheduleFields(baseSchedule({
    endDate: '2027-10-03',
  }), {
    medicationExpirationDate: '2027-10-02',
  }), 'Schedule end date cannot be after the medication expiration date.');
});

test('frontend requires end date for expiring medication', () => {
  for (const endDate of [null, '']) {
    assert.equal(validateScheduleFields(baseSchedule({ endDate }), {
      medicationExpirationDate: '2027-10-02',
    }), 'End date is required because this medication has an expiration date.');
  }
});

test('frontend rejects creation for already expired medication with date', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expirationDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  assert.equal(validateScheduleFields(baseSchedule({
    startDate: todayDate,
    endDate: todayDate,
  }), {
    medicationExpirationDate: expirationDate,
    rejectExpiredMedication: true,
  }), `Cannot create a schedule for an expired medication. This medication expired on ${expirationDate}.`);
});

test('frontend keeps legacy no-expiration schedules compatible', () => {
  assert.equal(validateScheduleFields(baseSchedule({ endDate: null })), '');
});

test('frontend preserves historical start date during edit validation', () => {
  assert.equal(validateScheduleFields(baseSchedule({
    startDate: '2020-01-01',
    endDate: '2099-01-01',
  }), {
    allowPastStartDate: true,
    medicationExpirationDate: '2099-01-02',
    validateStartDateExpiration: false,
  }), '');
});

test('frontend retains end-before-start validation with a specific message', () => {
  assert.equal(validateScheduleFields(baseSchedule({
    startDate: '2027-10-02',
    endDate: '2027-10-01',
  })), 'Schedule end date cannot be before the schedule start date.');
});

test('frontend provides the required field validation messages', () => {
  assert.equal(validateScheduleFields(baseSchedule({ medicationId: '' })), 'Medication is required.');
  assert.equal(validateScheduleFields(baseSchedule({ time: '' })), 'Scheduled time is required.');
  assert.equal(validateScheduleFields(baseSchedule({ days: [] })), 'Please select at least one day.');
  assert.equal(validateScheduleFields(baseSchedule({ startDate: '' })), 'Start date is required.');
  assert.equal(validateScheduleFields(baseSchedule({ startDate: '2027-02-30' })), 'Start date must be a valid date.');
  assert.equal(validateScheduleFields(baseSchedule({ endDate: '2027-02-30' })), 'End date must be a valid date.');
});

test('frontend displays specific backend messages and sanitizes generic failures', () => {
  assert.equal(getScheduleSubmissionErrorMessage({
    message: 'Schedule end date cannot be after the medication expiration date.',
  }), 'Schedule end date cannot be after the medication expiration date.');
  assert.equal(getScheduleSubmissionErrorMessage(new TypeError('Failed to fetch')),
    'Unable to save the schedule. Please check your connection and try again.');
});