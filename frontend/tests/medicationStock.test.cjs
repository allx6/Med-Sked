const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'utils', 'medicationStock.js'),
  'utf8'
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let isMedicationLowStock;
let getUsableMedicationQuantity;
let getNextBatchExpirationDate;

test('load medication stock helper', async () => {
  ({
    getNextBatchExpirationDate,
    getUsableMedicationQuantity,
    isMedicationLowStock,
  } = await import(moduleUrl));
});

test('stock status includes zero and quantities at the refill threshold', () => {
  assert.equal(isMedicationLowStock({ quantityOnHand: 0, refillThreshold: 0 }), true);
  assert.equal(isMedicationLowStock({ quantityOnHand: 2, refillThreshold: 2 }), true);
  assert.equal(isMedicationLowStock({ quantityOnHand: '2', refillThreshold: '3' }), true);
});

test('stock status is in-stock only above the refill threshold', () => {
  assert.equal(isMedicationLowStock({ quantityOnHand: 3, refillThreshold: 2 }), false);
});

test('expired batches do not count toward usable stock or low-stock status', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const medication = {
    quantityOnHand: 12,
    refillThreshold: 3,
    stockBatches: [
      { remainingQuantity: 10, expirationDate: `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}` },
      { remainingQuantity: 2, expirationDate: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}` },
    ],
  };

  assert.equal(getUsableMedicationQuantity(medication, today), 2);
  assert.equal(isMedicationLowStock(medication), true);
  assert.equal(getNextBatchExpirationDate(medication, today), medication.stockBatches[1].expirationDate);
});

test('patient monitoring presents the stock label and expiration date with semantic colors', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'PatientMonitoringScreen.js'),
    'utf8'
  );

  assert.match(source, /Refill: <Text style=\{isLowStock \? styles\.lowStockMeta : styles\.inStockMeta\}>\{isLowStock \? 'Low Stock' : 'In Stock'\}<\/Text>/);
  assert.match(source, /lowStockMeta: \{ color: colors\.dangerText/);
  assert.match(source, /inStockMeta: \{ color: colors\.success/);
  assert.match(source, /styles\.expirationMeta\]\}>Expires: \{expirationState\.expirationDate\}/);
  assert.match(source, /expirationMeta: \{ color: colors\.primary/);
});
