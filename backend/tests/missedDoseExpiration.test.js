const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async () => true,
  },
};

const doseGenerator = require('../services/doseGenerator');
const { detectMissedDoses } = require('../services/missedDoseService');

if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

test('missed-dose detection processes expiration-day doses and leaves later records untouched', async () => {
  const expirationDayDose = {
    _id: 'dose-expiration-day',
    userId: 'patient-id',
    scheduledDate: '2026-10-10',
    scheduledTime: '8:00 AM',
    status: 'pending',
    medicationId: { name: 'Medication', expirationDate: '2026-10-10' },
  };
  const postExpirationDose = {
    _id: 'dose-after-expiration',
    userId: 'patient-id',
    scheduledDate: '2026-10-11',
    scheduledTime: '8:00 AM',
    status: 'pending',
    medicationId: { name: 'Medication', expirationDate: '2026-10-10' },
  };
  const originals = {
    find: DoseRecord.find,
    scheduleFind: require('../models/MedicationSchedule').find,
    findOneAndUpdate: DoseRecord.findOneAndUpdate,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
  };
  const transitionedIds = [];
  let stockDeductionCalled = false;

  require('../models/MedicationSchedule').find = () => ({
    lean: async () => [],
  });
  DoseRecord.find = () => ({
    populate() {
      return this;
    },
    lean: async () => [expirationDayDose, postExpirationDose],
  });
  DoseRecord.findOneAndUpdate = (filter) => {
    transitionedIds.push(filter._id);
    return {
      lean: async () => ({
        ...expirationDayDose,
        status: 'missed',
      }),
    };
  };
  Medication.findOneAndUpdate = () => {
    stockDeductionCalled = true;
  };

  try {
    const result = await detectMissedDoses(new Date(2026, 9, 11, 9, 0));

    assert.equal(result.markedMissed, 1);
    assert.deepEqual(transitionedIds, ['dose-expiration-day']);
    assert.equal(postExpirationDose.status, 'pending');
    assert.equal(expirationDayDose.status, 'pending');
    assert.equal(stockDeductionCalled, false);
  } finally {
    require('../models/MedicationSchedule').find = originals.scheduleFind;
    DoseRecord.find = originals.find;
    DoseRecord.findOneAndUpdate = originals.findOneAndUpdate;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
  }
});

test('missed-dose detection backfills past dates before checking pending doses', async () => {
  const targetDate = new Date(2026, 9, 11, 9, 0);
  const dose = {
    _id: 'backfilled-dose',
    userId: 'patient-id',
    scheduledDate: '2026-10-09',
    scheduledTime: '8:00 AM',
    status: 'pending',
    medicationId: { name: 'History medication' },
  };
  const originals = {
    scheduleFind: require('../models/MedicationSchedule').find,
    doseFind: DoseRecord.find,
    findOneAndUpdate: DoseRecord.findOneAndUpdate,
    generateDosesForDate: doseGenerator.generateDosesForDate,
    scheduleAppliesToDate: doseGenerator.scheduleAppliesToDate,
  };
  const backfilledDates = [];
  let transitioned = false;

  require('../models/MedicationSchedule').find = () => ({
    lean: async () => [{
      _id: 'schedule-id',
      userId: 'patient-id',
      startDate: '2026-10-01',
      endDate: null,
      enabled: true,
      days: ['Friday'],
    }],
  });
  doseGenerator.generateDosesForDate = async (userId, date) => {
    backfilledDates.push(new Date(date));
  };
  doseGenerator.scheduleAppliesToDate = (schedule, date) => {
    const value = date.getFullYear() === 2026 && date.getMonth() === 9 && date.getDate() === 9;
    return value;
  };
  DoseRecord.find = () => ({
    populate() {
      return this;
    },
    lean: async () => [dose],
  });
  DoseRecord.findOneAndUpdate = () => {
    transitioned = true;
    return {
      lean: async () => ({ ...dose, status: 'missed' }),
    };
  };

  try {
    const result = await detectMissedDoses(targetDate);
    assert.equal(result.markedMissed, 1);
    assert.equal(transitioned, true);
    assert.ok(backfilledDates.some((date) => date.getFullYear() === 2026 && date.getMonth() === 9 && date.getDate() === 9));
  } finally {
    require('../models/MedicationSchedule').find = originals.scheduleFind;
    DoseRecord.find = originals.doseFind;
    DoseRecord.findOneAndUpdate = originals.findOneAndUpdate;
    doseGenerator.generateDosesForDate = originals.generateDosesForDate;
    doseGenerator.scheduleAppliesToDate = originals.scheduleAppliesToDate;
  }
});

test('missed-dose detection preserves legacy behavior when medication has no expiration', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const scheduledDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const dose = {
    _id: 'legacy-dose',
    userId: 'patient-id',
    scheduledDate,
    scheduledTime: '8:00 AM',
    status: 'pending',
    medicationId: { name: 'Legacy medication' },
  };
  const originals = {
    scheduleFind: require('../models/MedicationSchedule').find,
    find: DoseRecord.find,
    findOneAndUpdate: DoseRecord.findOneAndUpdate,
  };
  let transitioned = false;

  require('../models/MedicationSchedule').find = () => ({
    lean: async () => [],
  });
  DoseRecord.find = () => ({
    populate() {
      return this;
    },
    lean: async () => [dose],
  });
  DoseRecord.findOneAndUpdate = () => {
    transitioned = true;
    return {
      lean: async () => ({ ...dose, status: 'missed' }),
    };
  };

  try {
    await detectMissedDoses(new Date());
    assert.equal(transitioned, true);
  } finally {
    require('../models/MedicationSchedule').find = originals.scheduleFind;
    DoseRecord.find = originals.find;
    DoseRecord.findOneAndUpdate = originals.findOneAndUpdate;
  }
});