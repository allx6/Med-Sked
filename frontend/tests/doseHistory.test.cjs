const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../utils/doseHistory.js'),
  'utf8'
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let filterDoseHistory;
let getAvailableDoseDates;
let normalizeDoseDate;

test('load dose history date and filter helpers', async () => {
  const helpers = await import(moduleUrl);
  filterDoseHistory = helpers.filterDoseHistory;
  getAvailableDoseDates = helpers.getAvailableDoseDates;
  normalizeDoseDate = helpers.normalizeDoseDate;
});

const records = [
  {
    scheduledDate: '2026-10-10',
    medicationId: { _id: 'med-a' },
    status: 'missed',
  },
  {
    scheduledDate: '2026-10-11T00:00:00.000Z',
    medicationId: { _id: 'med-a' },
    status: 'taken',
  },
  {
    scheduledDate: '2026-10-11',
    medicationId: { _id: 'med-b' },
    status: 'pending',
  },
  {
    scheduledDate: '2026-10-12',
    medicationId: { _id: 'med-a' },
    status: 'skipped',
  },
];

test('available dates are normalized, unique, and chronological', () => {
  assert.deepEqual(getAvailableDoseDates(records), [
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
  ]);
  assert.equal(normalizeDoseDate('2026-10-10T23:30:00-10:00'), '2026-10-10');
  assert.equal(normalizeDoseDate('2026-02-30'), '');
});

test('selected date returns only records for that calendar date', () => {
  assert.deepEqual(
    filterDoseHistory(records, {
      selectedDate: '2026-10-11',
      selectedMedication: 'all',
      selectedStatus: 'all',
    }),
    [records[1], records[2]]
  );
});

test('medication and status filters continue to compose with the date filter', () => {
  assert.deepEqual(
    filterDoseHistory(records, {
      selectedDate: '2026-10-11',
      selectedMedication: 'med-a',
      selectedStatus: 'taken',
    }),
    [records[1]]
  );
  assert.deepEqual(
    filterDoseHistory(records, {
      selectedDate: 'all',
      selectedMedication: 'med-a',
      selectedStatus: 'missed',
    }),
    [records[0]]
  );
});
