const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScheduleFields } = require('../utils/validation');

const today = new Date();
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const validPayload = {
  medicationId: '507f1f77bcf86cd799439011',
  time: '08:30',
  dose: '500 mg',
  days: ['Monday', 'Wednesday'],
  startDate: formatLocalDate(today),
  endDate: formatLocalDate(tomorrow),
  enabled: true,
};

test('validateScheduleFields accepts today and future dates', () => {
  assert.equal(validateScheduleFields(validPayload), null);
});

test('validateScheduleFields rejects past start dates', () => {
  const payload = {
    ...validPayload,
    startDate: formatLocalDate(yesterday),
    endDate: formatLocalDate(tomorrow),
  };

  assert.match(validateScheduleFields(payload), /Start date cannot be earlier than today/i);
});

test('validateScheduleFields rejects past end dates', () => {
  const payload = {
    ...validPayload,
    startDate: formatLocalDate(today),
    endDate: formatLocalDate(yesterday),
  };

  assert.match(validateScheduleFields(payload), /End date cannot be earlier than today/i);
});

test('validateScheduleFields rejects end dates before start date', () => {
  const payload = {
    ...validPayload,
    startDate: formatLocalDate(tomorrow),
    endDate: formatLocalDate(today),
  };

  assert.equal(
    validateScheduleFields(payload),
    'Schedule end date cannot be before the schedule start date.'
  );
});

test('validateScheduleFields accepts schedule dates on the medication expiration date', () => {
  const payload = {
    ...validPayload,
    startDate: '2027-10-02',
    endDate: '2027-10-02',
  };

  assert.equal(validateScheduleFields(payload, {
    medicationExpirationDate: '2027-10-02',
  }), null);
});

test('validateScheduleFields rejects a start date after medication expiration', () => {
  const payload = {
    ...validPayload,
    startDate: '2027-10-03',
    endDate: '2027-10-03',
  };

  assert.equal(validateScheduleFields(payload, {
    medicationExpirationDate: '2027-10-02',
  }), 'Schedule start date cannot be after the medication expiration date.');
});

test('validateScheduleFields rejects an end date after medication expiration', () => {
  const payload = {
    ...validPayload,
    startDate: '2027-10-01',
    endDate: '2027-10-03',
  };

  assert.equal(validateScheduleFields(payload, {
    medicationExpirationDate: '2027-10-02',
  }), 'Schedule end date cannot be after the medication expiration date.');
});

test('validateScheduleFields requires an end date when medication expires', () => {
  const payload = {
    ...validPayload,
    startDate: '2027-10-02',
    endDate: null,
  };

  assert.equal(validateScheduleFields(payload, {
    medicationExpirationDate: '2027-10-02',
  }), 'End date is required because this medication has an expiration date.');
});

test('validateScheduleFields rejects creating a schedule for an expired medication', () => {
  const payload = {
    ...validPayload,
    startDate: formatLocalDate(today),
    endDate: null,
  };

  assert.equal(validateScheduleFields(payload, {
    medicationExpirationDate: formatLocalDate(yesterday),
    rejectExpiredMedication: true,
  }), `Cannot create a schedule for an expired medication. This medication expired on ${formatLocalDate(yesterday)}.`);
});

test('validateScheduleFields leaves legacy medications without expiration unchanged', () => {
  assert.equal(validateScheduleFields(validPayload), null);
});

test('validateScheduleFields preserves a historical start date when editing', () => {
  const payload = {
    ...validPayload,
    startDate: '2020-01-01',
    endDate: formatLocalDate(tomorrow),
  };

  assert.equal(validateScheduleFields(payload, {
    allowPastStartDate: true,
    medicationExpirationDate: '2099-01-01',
    validateStartDateExpiration: false,
  }), null);
});
