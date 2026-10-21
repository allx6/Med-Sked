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

test('legacy frequencies can only be preserved by an explicitly authorized update path', () => {
  const legacyMedication = {
    name: 'Medicine',
    dosage: '10 mg',
    frequency: 'Twice daily',
    expirationDate: '2099-12-31',
  };

  assert.equal(
    validateMedicationFields(legacyMedication),
    'Frequency must be a whole number from 1 to 99 hours or days.'
  );
  assert.equal(validateMedicationFields(legacyMedication, {
    allowLegacyFrequency: true,
  }), null);
});

test('medication validation rejects an expiration date before today', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  assert.equal(validateMedicationFields({
    name: 'Paracetamol',
    dosage: '500 mg',
    frequency: 'Every 8 hours',
    expirationDate: formatLocalDate(yesterday),
  }), 'Expiration date cannot be earlier than today.');
});

test('medication numeric fields accept up to six digits and reject longer values', () => {
  const base = {
    name: 'Acetaminophen',
    dosage: '999999 mg',
    frequency: 'Every 99 hours',
    expirationDate: '2026-12-31',
    quantityOnHand: 999999,
    refillThreshold: 0,
  };

  assert.equal(validateMedicationFields(base), null);
  assert.equal(validateMedicationFields({
    ...base,
    dosage: '100 mg',
    frequency: 'Every 8 hours',
    quantityOnHand: 30,
  }), null);
  assert.equal(validateMedicationFields({
    ...base,
    dosage: '100.5 mg',
    frequency: 'Every 8 hours',
  }), null);
  assert.equal(validateMedicationFields({ ...base, dosage: '1000000 mg' }), 'Dosage amount cannot exceed 6 digits.');
  assert.equal(validateMedicationFields({ ...base, dosage: '1e10 mg' }), 'Dosage amount must be greater than 0.');
  assert.equal(validateMedicationFields({ ...base, dosage: '2.13132132132134e+35 mg' }), 'Dosage amount must be greater than 0.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: 1000000 }), 'Quantity on hand cannot exceed 6 digits.');
  assert.equal(validateMedicationFields({ ...base, refillThreshold: 1000000 }), 'Refill threshold cannot exceed 6 digits.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: '1e6' }), 'Quantity on hand must be a whole number.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: '2.13132132132134e+35' }), 'Quantity on hand must be a whole number.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: 2.13132132132134e+35 }), 'Quantity on hand must be a whole number.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: '213213213213213213213213' }), 'Quantity on hand cannot exceed 6 digits.');
  assert.equal(validateMedicationFields({ ...base, quantityOnHand: 30.5 }), 'Quantity on hand must be a whole number.');
  assert.equal(validateMedicationFields({ ...base, refillThreshold: '1E10' }), 'Refill threshold must be a whole number.');
  assert.equal(validateMedicationFields({ ...base, refillThreshold: '9999999' }), 'Refill threshold cannot exceed 6 digits.');
  for (const frequency of [
    'Every 0 hours',
    'Every -1 hours',
    'Every 100 hours',
    'Every 101 hours',
    'Every 999 hours',
    'Every 1.5 hours',
    'Every 0.5 hours',
    'Every abc hours',
    'Every 4abc hours',
    'Every 1e2 hours',
    'Every @ hours',
    'Every  hours',
    'Every 00 hours',
    'Every 01 hours',
  ]) {
    assert.equal(
      validateMedicationFields({ ...base, frequency }),
      'Frequency must be a whole number from 1 to 99 hours or days.',
      frequency
    );
  }
  for (const frequency of [
    'Every 1 hours',
    'Every 2 hours',
    'Every 9 hours',
    'Every 10 hours',
    'Every 12 hours',
    'Every 24 hours',
    'Every 48 hours',
    'Every 72 hours',
    'Every 99 days',
  ]) {
    assert.equal(validateMedicationFields({ ...base, frequency }), null, frequency);
  }
});

test('medication names and units are bounded without restricting valid names', () => {
  const base = {
    dosage: '2.5 mg',
    frequency: 'Every 8 hours',
    expirationDate: '2026-12-31',
    quantityOnHand: 30,
    refillThreshold: 0,
  };

  for (const name of [
    'Acetaminophen',
    'Vitamin B12',
    'Amoxicillin-Clavulanate',
    'B-Complex',
    'Ferrous Sulfate 325',
  ]) {
    assert.equal(validateMedicationFields({ ...base, name }), null);
  }

  assert.equal(validateMedicationFields({ ...base, name: 'M'.repeat(100) }), null);
  assert.equal(validateMedicationFields({ ...base, name: 'A'.repeat(101) }), 'Medication name cannot exceed 100 characters.');
  assert.equal(validateMedicationFields({ ...base, name: 'Medicine\u0000Name' }), 'Medication name cannot contain control characters.');
  assert.equal(validateMedicationFields({ ...base, name: 'Medicine', dosage: '10 mg123456' }), 'Dosage amount must be greater than 0.');
  assert.equal(validateMedicationFields({ ...base, name: 'Medicine', dosage: '10 aaaaaaaaaaaaaaaa' }), 'Dosage amount must be greater than 0.');
  assert.equal(validateMedicationFields({ ...base, name: 'Medicine', frequency: 'Every 8 hours123' }), 'Frequency must be a whole number from 1 to 99 hours or days.');
  assert.equal(validateMedicationFields({ ...base, name: 'Medicine', frequency: 'Every 8 days999999' }), 'Frequency must be a whole number from 1 to 99 hours or days.');
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

test('schedule validation requires an end date even for medications without expiration', () => {
  const today = new Date();

  assert.equal(validateScheduleFields({
    medicationId: '507f1f77bcf86cd799439011',
    time: '08:00',
    dose: '500 mg',
    days: ['Monday'],
    startDate: formatLocalDate(today),
    endDate: null,
    enabled: true,
  }), 'End date is required.');
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
