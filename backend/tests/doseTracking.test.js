const test = require('node:test');
const assert = require('node:assert/strict');

const DoseRecord = require('../models/DoseRecord');
const {
  MISSED_DOSE_GRACE_MINUTES,
  parseScheduledDateTime,
} = require('../services/missedDoseService');

test('dose records use the protected status values and unique identity index', () => {
  assert.deepEqual(
    DoseRecord.schema.path('status').enumValues,
    ['pending', 'taken', 'missed', 'skipped']
  );

  const uniqueIndexes = DoseRecord.schema.indexes()
    .filter(([, options]) => options?.unique)
    .map(([fields]) => Object.keys(fields));

  assert.ok(uniqueIndexes.some((fields) => fields.includes('scheduleId')
    && fields.includes('scheduledDate')
    && fields.includes('scheduledTime')));
});

test('dose scheduled date and time stay in the local calendar', () => {
  const scheduled = parseScheduledDateTime('2026-09-24', '08:00');

  assert.equal(scheduled.getFullYear(), 2026);
  assert.equal(scheduled.getMonth(), 8);
  assert.equal(scheduled.getDate(), 24);
  assert.equal(scheduled.getHours(), 8);
  assert.equal(scheduled.getMinutes(), 0);
});

test('invalid dose date/time values are ignored by missed-dose detection', () => {
  assert.equal(parseScheduledDateTime('2026-02-30', '08:00'), null);
  assert.equal(parseScheduledDateTime('2026-09-24', '25:00'), null);
  assert.equal(MISSED_DOSE_GRACE_MINUTES, 15);
});
