const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTime,
  scheduleAppliesToDate,
} = require('../services/doseGenerator');

test('dose generation accepts the 24-hour schedule time format', () => {
  assert.deepEqual(parseTime('07:00'), {
    hours: 7,
    minutes: 0,
  });
});

test('dose generation retains support for 12-hour schedule times', () => {
  assert.deepEqual(parseTime('7:00 AM'), {
    hours: 7,
    minutes: 0,
  });

  assert.deepEqual(parseTime('7:00 PM'), {
    hours: 19,
    minutes: 0,
  });
});

test('invalid schedule times are rejected', () => {
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7:60 AM'), null);
  assert.equal(parseTime('07:00:00'), null);
});

test('edited schedule rules control eligibility while preserving an open end date', () => {
  const sunday = new Date(2026, 8, 20);
  const schedule = {
    startDate: '2026-09-20',
    endDate: null,
    days: ['Sunday', 'Monday'],
    enabled: true,
  };

  assert.equal(scheduleAppliesToDate(schedule, sunday), true);
  assert.equal(
    scheduleAppliesToDate(schedule, new Date(2026, 8, 23)),
    false
  );
  assert.equal(
    scheduleAppliesToDate(
      { ...schedule, days: ['Monday'] },
      sunday
    ),
    false
  );
  assert.equal(
    scheduleAppliesToDate(
      { ...schedule, enabled: false },
      sunday
    ),
    false
  );
});