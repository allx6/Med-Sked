const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');

const {
  generateDosesForDate,
  parseTime,
  scheduleAppliesToDate,
} = require('../services/doseGenerator');

const formatTime = (hours, minutes) => {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

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

test('fixed schedule times remain explicit and do not use interval arithmetic', () => {
  const scheduleTime = parseTime('20:00');
  assert.equal(formatTime(scheduleTime.hours, scheduleTime.minutes), '8:00 PM');
  assert.notEqual(formatTime(scheduleTime.hours, scheduleTime.minutes), '12:00 AM');
});

test('eight-hour intervals remain distinct from fixed schedule times', () => {
  const start = parseTime('08:00');
  const intervalMinutes = 8 * 60;
  const generated = [0, 1, 2].map((index) => {
    const totalMinutes = start.hours * 60 + start.minutes + index * intervalMinutes;
    return formatTime(
      Math.floor((totalMinutes % (24 * 60)) / 60),
      totalMinutes % 60
    );
  });

  assert.deepEqual(generated, ['8:00 AM', '4:00 PM', '12:00 AM']);
});

const runGenerationWithModels = async ({ targetDate, medication, schedule }) => {
  const originals = {
    scheduleFind: MedicationSchedule.find,
    medicationFind: Medication.find,
    doseCreate: DoseRecord.create,
    consoleLog: console.log,
  };
  const created = [];

  MedicationSchedule.find = () => ({
    lean: async () => [schedule],
  });
  Medication.find = () => ({
    lean: async () => [medication],
  });
  DoseRecord.create = async (dose) => {
    created.push(dose);
    return dose;
  };
  console.log = () => {};

  try {
    await generateDosesForDate('user-id', targetDate);
  } finally {
    MedicationSchedule.find = originals.scheduleFind;
    Medication.find = originals.medicationFind;
    DoseRecord.create = originals.doseCreate;
    console.log = originals.consoleLog;
  }

  return created;
};

const makeDateSchedule = (date, overrides = {}) => ({
  _id: 'schedule-id',
  userId: 'user-id',
  medicationId: 'medication-id',
  time: '08:00',
  startDate: formatTestDate(date),
  endDate: null,
  days: [new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)],
  enabled: true,
  ...overrides,
});

const formatTestDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('generateDosesForDate creates the dose on expiration day', async () => {
  const targetDate = new Date(2026, 9, 10);
  const created = await runGenerationWithModels({
    targetDate,
    medication: { _id: 'medication-id', userId: 'user-id', frequency: 'Daily', expirationDate: '2026-10-10' },
    schedule: makeDateSchedule(targetDate),
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].scheduledDate, '2026-10-10');
});

test('generateDosesForDate skips a null-ended schedule after expiration', async () => {
  const targetDate = new Date(2026, 9, 11);
  const created = await runGenerationWithModels({
    targetDate,
    medication: { _id: 'medication-id', userId: 'user-id', frequency: 'Daily', expirationDate: '2026-10-10' },
    schedule: makeDateSchedule(targetDate),
  });

  assert.deepEqual(created, []);
});

test('generateDosesForDate checks the final interval candidate after midnight', async () => {
  const targetDate = new Date(2026, 9, 10);
  const created = await runGenerationWithModels({
    targetDate,
    medication: { _id: 'medication-id', userId: 'user-id', frequency: 'Every 8 hours', expirationDate: '2026-10-10' },
    schedule: makeDateSchedule(targetDate),
  });

  assert.deepEqual(created.map((dose) => dose.scheduledDate), ['2026-10-10', '2026-10-10']);
});

test('generateDosesForDate preserves legacy behavior without expiration', async () => {
  const targetDate = new Date(2026, 9, 11);
  const created = await runGenerationWithModels({
    targetDate,
    medication: { _id: 'medication-id', userId: 'user-id', frequency: 'Daily', expirationDate: null },
    schedule: makeDateSchedule(targetDate),
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].scheduledDate, '2026-10-11');
});