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

  assert.match(validateScheduleFields(payload), /End date cannot be earlier than the start date/i);
});
