const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../utils/medicationValidation.js'),
  'utf8'
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let isValidMedicationFrequencyInput;
let validateMedicationFields;

test('load medication frequency validation helpers', async () => {
  const helpers = await import(moduleUrl);
  isValidMedicationFrequencyInput = helpers.isValidMedicationFrequencyInput;
  validateMedicationFields = helpers.validateMedicationFields;
});

const baseMedication = (frequency) => ({
  name: 'Acetaminophen',
  dosage: '500 mg',
  frequency,
  expirationDate: '2099-12-31',
});

test('frequency input accepts one- and two-digit positive whole numbers', () => {
  for (const value of ['1', '2', '9', '10', '12', '24', '48', '72', '99']) {
    assert.equal(isValidMedicationFrequencyInput(value), true, value);
  }
  assert.equal(isValidMedicationFrequencyInput(''), true);
});

test('frequency input rejects invalid, pasted, and overlength values', () => {
  for (const value of [
    '0',
    '00',
    '-1',
    '100',
    '101',
    '999',
    '1.5',
    '0.5',
    'abc',
    '4abc',
    '1e2',
    '@#$',
    ' ',
  ]) {
    assert.equal(isValidMedicationFrequencyInput(value), false, value);
  }
});

test('frontend submission validation accepts valid frequency intervals', () => {
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
    assert.equal(validateMedicationFields(baseMedication(frequency)), '', frequency);
  }
});

test('frontend submission validation rejects malformed or pasted frequency intervals', () => {
  for (const frequency of [
    '',
    'Every 0 hours',
    'Every 00 hours',
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
    'Every 01 hours',
  ]) {
    assert.equal(
      validateMedicationFields(baseMedication(frequency)),
      'Frequency must be a whole number from 1 to 99 hours or days.',
      frequency
    );
  }
});
