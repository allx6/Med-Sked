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
    findOneAndUpdate: DoseRecord.findOneAndUpdate,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
  };
  const transitionedIds = [];
  let stockDeductionCalled = false;

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
    DoseRecord.find = originals.find;
    DoseRecord.findOneAndUpdate = originals.findOneAndUpdate;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
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
    find: DoseRecord.find,
    findOneAndUpdate: DoseRecord.findOneAndUpdate,
  };
  let transitioned = false;

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
    DoseRecord.find = originals.find;
    DoseRecord.findOneAndUpdate = originals.findOneAndUpdate;
  }
});