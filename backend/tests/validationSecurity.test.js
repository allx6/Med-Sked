const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidObjectId,
  pickAllowedFields,
  containsMongoOperatorPayload,
  parsePositiveInteger,
  validateSchedulePayload,
  validateMedicationFields,
} = require('../utils/validation');

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
  }), null);
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
});
