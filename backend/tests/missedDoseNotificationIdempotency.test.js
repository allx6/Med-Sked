const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'M').toString('base64');

const Notification = require('../models/Notification');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');
const { createMedicationNotifications } = require('../services/notificationService');

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CAREGIVER_IDS = [
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013',
];
const DOSE_IDS = [
  '507f1f77bcf86cd799439014',
  '507f1f77bcf86cd799439015',
];

test('missed-dose notifications are idempotent per source dose and recipient', async () => {
  const originals = {
    create: Notification.create,
    findOne: Notification.findOne,
    findRelationships: CaregiverRelationship.find,
    findUser: User.findById,
  };
  const notificationsByDedupeKey = new Map();
  const notificationQuery = (query) => ({
    select() {
      return this;
    },
    lean: async () => [...notificationsByDedupeKey.values()].find((notification) => (
      String(notification.recipient) === String(query.recipient)
      && notification.type === query.type
      && notification.relatedEntityType === query.relatedEntityType
      && String(notification.relatedEntityId) === String(query.relatedEntityId)
    )) || null,
  });

  Notification.findOne = notificationQuery;
  Notification.create = async (payload) => {
    if (notificationsByDedupeKey.has(payload.dedupeKey)) {
      const duplicateKeyError = new Error('Duplicate notification dedupe key');
      duplicateKeyError.code = 11000;
      throw duplicateKeyError;
    }

    const notification = new Notification(payload);
    notificationsByDedupeKey.set(payload.dedupeKey, notification);
    return notification;
  };
  CaregiverRelationship.find = () => ({
    select() {
      return this;
    },
    lean: async () => CAREGIVER_IDS.map((caregiver) => ({ caregiver })),
  });
  User.findById = () => ({
    select() {
      return this;
    },
    lean: async () => ({ username: 'patient' }),
  });

  const notifyMissedDose = (doseId) => createMedicationNotifications({
    patientId: PATIENT_ID,
    type: 'missed_dose',
    patientMessage: 'You missed Cetirizine at 7:00 PM.',
    caregiverMessage: (patientName) => `${patientName} missed a Cetirizine dose at 7:00 PM.`,
    relatedEntityType: 'DoseRecord',
    relatedEntityId: doseId,
    dedupeKey: `missed_dose:${doseId}`,
  });

  try {
    await Promise.all(
      Array.from({ length: 10 }, () => notifyMissedDose(DOSE_IDS[0]))
    );
    await Promise.all(
      Array.from({ length: 10 }, () => notifyMissedDose(DOSE_IDS[0]))
    );

    assert.equal(notificationsByDedupeKey.size, 3);
    assert.deepEqual(
      [...notificationsByDedupeKey.values()]
        .map((notification) => String(notification.recipient))
        .sort(),
      [PATIENT_ID, ...CAREGIVER_IDS].sort()
    );
    assert.ok(
      [...notificationsByDedupeKey.values()].every((notification) => (
        notification._doc.message.startsWith('enc:')
      ))
    );
    assert.ok(
      [...notificationsByDedupeKey.values()].every((notification) => (
        decrypt(notification._doc.message).includes('Cetirizine')
      ))
    );

    await Promise.all(
      Array.from({ length: 10 }, () => notifyMissedDose(DOSE_IDS[1]))
    );

    assert.equal(notificationsByDedupeKey.size, 6);
    for (const doseId of DOSE_IDS) {
      const doseNotifications = [...notificationsByDedupeKey.values()].filter(
        (notification) => String(notification.relatedEntityId) === doseId
      );
      assert.equal(doseNotifications.length, 3);
      assert.deepEqual(
        doseNotifications.map((notification) => String(notification.recipient)).sort(),
        [PATIENT_ID, ...CAREGIVER_IDS].sort()
      );
    }
  } finally {
    Notification.create = originals.create;
    Notification.findOne = originals.findOne;
    CaregiverRelationship.find = originals.findRelationships;
    User.findById = originals.findUser;
  }
});
