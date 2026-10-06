const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidObjectId,
  pickAllowedFields,
  containsMongoOperatorPayload,
  parsePositiveInteger,
  validateSchedulePayload,
  validateMedicationFields,
  validateMedicationExpirationDate,
  buildNormalizedMedicationKey,
  validateScheduleFields,
} = require('../utils/validation');

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('valid ObjectIds are accepted', () => {
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectId('507f1f77bcf86cd79943901z'), false);
});

test('unexpected payload keys are rejected before update', () => {
  const body = {
    name: 'Amoxicillin',
    dosage: '500mg',
    quantityOnHand: 12,
    role: 'admin',
  };

  assert.equal(
    pickAllowedFields(body, ['name', 'dosage', 'quantityOnHand']),
    null
  );

  const allowed = pickAllowedFields(
    { name: 'Amoxicillin', dosage: '500mg', quantityOnHand: 12 },
    ['name', 'dosage', 'quantityOnHand']
  );

  assert.deepEqual(allowed, {
    name: 'Amoxicillin',
    dosage: '500mg',
    quantityOnHand: 12,
  });
});

test('mongo operator payloads are rejected', () => {
  assert.equal(containsMongoOperatorPayload({ $ne: 'x' }), true);
  assert.equal(containsMongoOperatorPayload({ __proto__: { injected: true } }), true);
  assert.equal(containsMongoOperatorPayload({ name: 'test' }), false);
});

test('pagination values are enforced to positive integers', () => {
  assert.equal(parsePositiveInteger('10', 5), 10);
  assert.equal(parsePositiveInteger('0', 5), 5);
  assert.equal(parsePositiveInteger('-1', 5), 5);
  assert.equal(parsePositiveInteger('abc', 5), 5);
});

test('schedule payloads accept optional endDate null while rejecting unexpected keys', () => {
  const payload = {
    medicationId: '507f1f77bcf86cd799439011',
    time: '08:00',
    dose: '1 tablet',
    days: ['Monday', 'Wednesday'],
    startDate: '2025-01-10',
    endDate: null,
    enabled: true,
  };

  assert.deepEqual(validateSchedulePayload(payload), payload);

  const rejected = validateSchedulePayload({
    ...payload,
    adminOnlyFlag: true,
  });

  assert.equal(rejected, null);
});

test('medication fields accept valid values', () => {
  assert.equal(validateMedicationFields({
    name: '  Paracetamol  ',
    dosage: '500 mg',
    frequency: 'Every 8 hours',
    expirationDate: '2099-12-31',
  }), null);

  assert.equal(validateMedicationExpirationDate('2026-12-31'), null);
  assert.equal(buildNormalizedMedicationKey('  Metformin   ', '500MG'), 'metformin|500mg');
  assert.equal(buildNormalizedMedicationKey('Metformin', '500 mg'), 'metformin|500mg');
});

test('medication fields reject invalid values and minutes', () => {
  const invalidPayloads = [
    { name: '', dosage: '500 mg', frequency: 'Every 8 hours' },
    { name: 'A', dosage: '500 mg', frequency: 'Every 8 hours' },
    { name: 'Medicine', dosage: '0 mg', frequency: 'Every 8 hours' },
    { name: 'Medicine', dosage: '-5 mg', frequency: 'Every 8 hours' },
    { name: 'Medicine', dosage: 'abc mg', frequency: 'Every 8 hours' },
    { name: 'Medicine', dosage: '500 mg', frequency: 'Every 0 hours' },
    { name: 'Medicine', dosage: '500 mg', frequency: 'Every 8 minutes' },
    { name: 'Medicine', dosage: '500 mg', frequency: 'Every 8 weeks' },
  ];

  invalidPayloads.forEach((payload) => {
    assert.equal(typeof validateMedicationFields(payload), 'string');
  });

  assert.equal(typeof validateMedicationExpirationDate('2026-02-30'), 'string');
  assert.equal(typeof validateMedicationExpirationDate('2026/12/31'), 'string');
  assert.equal(typeof validateMedicationExpirationDate('2026-12-31T00:00:00Z'), 'string');
});

test('schedule fields accept valid values', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  assert.equal(validateScheduleFields({
    medicationId: '507f1f77bcf86cd799439011',
    time: '08:00',
    dose: '500 mg',
    days: ['Monday', 'Friday'],
    startDate: formatLocalDate(today),
    endDate: formatLocalDate(tomorrow),
    enabled: true,
  }), null);
});

test('schedule fields reject invalid time, days, dates, and enabled state', () => {
  const base = {
    medicationId: '507f1f77bcf86cd799439011',
    time: '08:00',
    dose: '500 mg',
    days: ['Monday'],
    startDate: '2026-09-24',
    endDate: null,
    enabled: true,
  };

  [
    { time: '25:00' },
    { days: [] },
    { days: ['Funday'] },
    { startDate: '2026-02-30' },
    { endDate: '2026-09-23' },
    { enabled: 'true' },
  ].forEach((change) => {
    assert.equal(typeof validateScheduleFields({ ...base, ...change }), 'string');
  });
});
