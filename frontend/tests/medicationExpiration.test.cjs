const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../utils/medicationValidation.js'),
  'utf8'
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const doseErrorsSource = fs.readFileSync(
  path.join(__dirname, '../utils/doseErrors.js'),
  'utf8'
);
const doseErrorsModuleUrl = `data:text/javascript;base64,${Buffer.from(doseErrorsSource).toString('base64')}`;
const refillErrorsSource = fs.readFileSync(
  path.join(__dirname, '../utils/refillErrors.js'),
  'utf8'
);
const refillErrorsModuleUrl = `data:text/javascript;base64,${Buffer.from(refillErrorsSource).toString('base64')}`;
let getMedicationExpirationState;
let filterDoseRecordsByMedicationExpiration;
let getDoseActionErrorMessage;
let validateRefillAmount;
let getRefillErrorMessage;

test('load medication expiration helpers', async () => {
  const helpers = await import(moduleUrl);
  getMedicationExpirationState = helpers.getMedicationExpirationState;
  filterDoseRecordsByMedicationExpiration = helpers.filterDoseRecordsByMedicationExpiration;
  validateRefillAmount = helpers.validateRefillAmount;
  ({ getDoseActionErrorMessage } = await import(doseErrorsModuleUrl));
  ({ getRefillErrorMessage } = await import(refillErrorsModuleUrl));
});

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('expiration today is valid; yesterday is expired; tomorrow is not expired', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  assert.equal(getMedicationExpirationState(formatLocalDate(today)).expired, false);
  assert.equal(getMedicationExpirationState(formatLocalDate(yesterday)).expired, true);
  assert.equal(getMedicationExpirationState(formatLocalDate(tomorrow)).expired, false);
});

test('current dose filtering excludes post-expiration records but retains expiration-day, historical, and legacy records', () => {
  const doses = [
    { _id: 'after', scheduledDate: '2026-10-11', medicationId: 'expired-medication' },
    { _id: 'on-expiration', scheduledDate: '2026-10-10', medicationId: 'expiring-today' },
    { _id: 'historical', scheduledDate: '2026-10-09', medicationId: 'expired-medication' },
    { _id: 'legacy', scheduledDate: '2026-10-11', medicationId: 'legacy-medication' },
  ];
  const medications = [
    { _id: 'expired-medication', expirationDate: '2026-10-10' },
    { _id: 'expiring-today', expirationDate: '2026-10-10' },
    { _id: 'legacy-medication', expirationDate: null },
  ];

  assert.deepEqual(
    filterDoseRecordsByMedicationExpiration(doses, medications).map((dose) => dose._id),
    ['on-expiration', 'historical', 'legacy']
  );
  assert.equal(doses.length, 4);
});

test('dose action errors preserve specific backend messages and sanitize network errors', () => {
  assert.equal(getDoseActionErrorMessage({
    message: 'Cannot update a dose scheduled after the medication expiration date.',
  }), 'Cannot update a dose scheduled after the medication expiration date.');
  assert.equal(getDoseActionErrorMessage(new TypeError('Failed to fetch')),
    'Unable to update the dose. Please try again.');
});

test('safe user errors preserve specific backend messages and sanitize technical failures', () => {
  assert.equal(getSafeUserErrorMessage({ message: 'A medication with this name and dosage already exists for this patient.' }, 'Fallback'), 'A medication with this name and dosage already exists for this patient.');
  assert.equal(getSafeUserErrorMessage(new TypeError('Failed to fetch'), 'Fallback'), 'Fallback');
  assert.equal(getSafeUserErrorMessage({ message: 'Unable to connect to the Med-Sked server. Check that the backend is running.' }, 'Fallback'), 'Fallback');
});

test('refill amount validation rejects empty, malformed, zero, and negative values', () => {
  assert.equal(validateRefillAmount(''), 'Refill amount is required.');
  assert.equal(validateRefillAmount('abc'), 'Refill amount must be a number greater than 0.');
  assert.equal(validateRefillAmount('0x10'), 'Refill amount must be a number greater than 0.');
  assert.equal(validateRefillAmount('0'), 'Refill amount must be greater than 0.');
  assert.equal(validateRefillAmount('-2'), 'Refill amount must be greater than 0.');
  assert.equal(validateRefillAmount('2.5'), '');
});

test('refill errors preserve backend permission/expiration messages and sanitize technical failures', () => {
  assert.equal(getRefillErrorMessage({ message: 'Cannot refill an expired medication.' }), 'Cannot refill an expired medication.');
  assert.equal(getRefillErrorMessage({ message: 'ADHERENCE_SUPPORT permission required' }), 'ADHERENCE_SUPPORT permission required');
  assert.equal(getRefillErrorMessage({ message: 'Refill amount must be greater than 0.' }), 'Refill amount must be greater than 0.');
  assert.equal(getRefillErrorMessage({ message: 'Unable to refill the medication. Please try again.' }), 'Unable to complete the refill. Please try again.');
  assert.equal(getRefillErrorMessage({ message: 'MongoServerError: failed at C:\\app\\backend\\routes' }), 'Unable to complete the refill. Please try again.');
  assert.equal(getRefillErrorMessage({ message: 'Request failed with status 503' }), 'Unable to refill the medication. Please check your connection and try again.');
  assert.equal(getRefillErrorMessage(new TypeError('Failed to fetch')), 'Unable to refill the medication. Please check your connection and try again.');
});