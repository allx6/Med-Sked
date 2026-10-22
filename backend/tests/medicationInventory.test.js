const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatLocalDate,
  getMedicationExpirationDate,
  getUsableMedicationQuantity,
  validateBatchExpirationDate,
} = require('../utils/medicationInventory');
const {
  reconcileMedicationStockBatches,
} = require('../services/medicationInventoryService');

test('effective medication expiration follows the latest remaining known batch', () => {
  assert.equal(getMedicationExpirationDate({
    expirationDate: '2026-01-01',
    stockBatches: [
      { expirationDate: '2026-12-31', remainingQuantity: 3 },
      { expirationDate: '2027-01-01', remainingQuantity: 0 },
      { expirationDate: '2026-06-30', remainingQuantity: 2 },
    ],
  }), '2026-12-31');
});

test('unknown-expiration legacy stock keeps legacy-compatible non-expiring behavior', () => {
  assert.equal(getMedicationExpirationDate({
    expirationDate: '2026-01-01',
    stockBatches: [{ expirationDate: null, remainingQuantity: 1 }],
  }), null);
});

test('usable stock excludes expired batches and falls back for unbatched legacy records', () => {
  assert.equal(getUsableMedicationQuantity({
    quantityOnHand: 10,
    stockBatches: [
      { remainingQuantity: 8, expirationDate: '2020-01-01' },
      { remainingQuantity: 2, expirationDate: '2099-12-31' },
    ],
  }), 2);
  assert.equal(getUsableMedicationQuantity({ quantityOnHand: 4, stockBatches: [] }), 4);
});

test('batch expiration rejects malformed and past dates but accepts today', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  assert.throws(
    () => validateBatchExpirationDate('2026-02-30'),
    { statusCode: 400, message: 'Batch expiration date must be a valid YYYY-MM-DD date.' }
  );
  assert.throws(
    () => validateBatchExpirationDate(formatLocalDate(yesterday)),
    { statusCode: 400, message: 'Batch expiration date cannot be earlier than today.' }
  );
  assert.equal(validateBatchExpirationDate(formatLocalDate()), formatLocalDate());
});

test('manual stock reconciliation preserves batch history while matching the requested total', () => {
  const batches = [
    { _id: 'near', quantityAdded: 5, remainingQuantity: 3, expirationDate: '2027-01-01' },
    { _id: 'later', quantityAdded: 8, remainingQuantity: 4, expirationDate: '2028-01-01' },
  ];

  const reduced = reconcileMedicationStockBatches({
    batches,
    targetQuantity: 5,
    expirationDate: '2028-01-01',
  });
  assert.deepEqual(reduced.map((batch) => batch.remainingQuantity), [1, 4]);
  assert.equal(reduced[0].quantityAdded, 5);

  const increased = reconcileMedicationStockBatches({
    batches,
    targetQuantity: 10,
    expirationDate: '2029-01-01',
    receivedBy: 'user-id',
  });
  assert.equal(increased.reduce((total, batch) => total + batch.remainingQuantity, 0), 10);
  assert.equal(increased[2].source, 'manual-adjustment');
  assert.equal(increased[2].expirationDate, '2029-01-01');
});
