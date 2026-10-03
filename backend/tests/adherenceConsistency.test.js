const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateCanonicalAdherence } = require('../utils/adherence');

const buildDose = ({ status, scheduledDate, expirationDate = null }) => ({
  status,
  scheduledDate,
  medicationId: { expirationDate },
});

test('pending doses are excluded from the adherence denominator', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('pending doses do not dilute a completed adherence summary', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('taken over missed plus skipped uses the canonical denominator', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'skipped', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 50);
});

test('future and post-expiration doses are excluded from adherence', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-04' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-02', expirationDate: '2026-10-02' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-02', expirationDate: '2026-10-02' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('1 taken + 1 pending = 100', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('2 taken + 2 pending = 100', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('2 taken + 1 missed = approximately 67', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 67);
});

test('8 taken + 1 missed + 1 skipped + 4 pending = 80', () => {
  const doses = [
    ...Array.from({ length: 8 }, () => buildDose({ status: 'taken', scheduledDate: '2026-10-03' })),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'skipped', scheduledDate: '2026-10-03' }),
    ...Array.from({ length: 4 }, () => buildDose({ status: 'pending', scheduledDate: '2026-10-03' })),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 80);
});

test('only pending = 0', () => {
  const doses = [
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 0);
});

test('no records = 0', () => {
  assert.equal(calculateCanonicalAdherence([], { now: '2026-10-03' }), 0);
});

test('future pending doses are excluded from current adherence', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-04' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('post-expiration doses are excluded from current adherence', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-02', expirationDate: '2026-10-02' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03', expirationDate: '2026-10-02' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03', expirationDate: '2026-10-04' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 100);
});

test('expiration-day doses remain eligible', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03', expirationDate: '2026-10-03' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03', expirationDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 50);
});

test('multiple medications are included in the canonical count', () => {
  const doses = [
    buildDose({ status: 'taken', scheduledDate: '2026-10-03', expirationDate: '2026-10-04' }),
    buildDose({ status: 'taken', scheduledDate: '2026-10-03', expirationDate: '2026-10-04' }),
    buildDose({ status: 'missed', scheduledDate: '2026-10-03', expirationDate: '2026-10-04' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03', expirationDate: '2026-10-04' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 67);
});

test('zero eligible outcomes returns zero instead of NaN', () => {
  const doses = [
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
    buildDose({ status: 'pending', scheduledDate: '2026-10-03' }),
  ];

  assert.equal(calculateCanonicalAdherence(doses, { now: '2026-10-03' }), 0);
});
