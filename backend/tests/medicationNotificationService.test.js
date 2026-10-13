const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'N').toString('base64');

const Notification = require('../models/Notification');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const Medication = require('../models/Medication');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');
const { createMedicationNotifications } = require('../services/notificationService');

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CAREGIVER_IDS = [
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013',
];

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationServiceModule = require.cache[notificationServicePath];
const medicationNotificationCalls = [];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async (payload) => {
      medicationNotificationCalls.push(payload);
      return null;
    },
  },
};
delete require.cache[require.resolve('../routes/medicationRoutes')];
const medicationRoutes = require('../routes/medicationRoutes');
if (originalNotificationServiceModule) {
  require.cache[notificationServicePath] = originalNotificationServiceModule;
} else {
  delete require.cache[notificationServicePath];
}

test('successfully created patient medication triggers caregiver notifications', async () => {
  const postRoute = medicationRoutes.stack.find((layer) => (
    layer.route?.path === '/' && layer.route.methods.post
  ));
  const handler = postRoute.route.stack.at(-1).handle;
  const originals = {
    findOne: Medication.findOne,
    create: Medication.create,
  };
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  medicationNotificationCalls.length = 0;
  Medication.findOne = async () => null;
  Medication.create = async (payload) => ({
    ...payload,
    _id: '507f1f77bcf86cd799439014',
  });

  try {
    await handler({
      user: { role: 'patient', userId: PATIENT_ID },
      body: {
        name: 'Medication',
        dosage: '100 mg',
        frequency: 'Every 8 hours',
        quantityOnHand: 30,
        refillThreshold: 0,
        expirationDate: '2026-12-31',
      },
    }, response);
  } finally {
    Medication.findOne = originals.findOne;
    Medication.create = originals.create;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(medicationNotificationCalls.length, 1);
  assert.equal(medicationNotificationCalls[0].type, 'medication_added');
  assert.equal(medicationNotificationCalls[0].notifyPatient, false);
  assert.equal(medicationNotificationCalls[0].relatedEntityType, 'Medication');
  assert.equal(medicationNotificationCalls[0].relatedEntityId, '507f1f77bcf86cd799439014');
});

const runWithNotificationModels = async (relationships, callback) => {
  const originals = {
    create: Notification.create,
    findRelationships: CaregiverRelationship.find,
    findUser: User.findById,
  };
  const createdNotifications = [];
  let relationshipQuery;

  Notification.create = async (payload) => {
    const notification = new Notification(payload);
    createdNotifications.push(notification);
    return notification;
  };
  CaregiverRelationship.find = (query) => {
    relationshipQuery = query;
    return {
      select() {
        return this;
      },
      lean: async () => relationships,
    };
  };
  User.findById = () => ({
    select() {
      return this;
    },
    lean: async () => ({ username: 'patient' }),
  });

  try {
    await callback(createdNotifications, () => relationshipQuery);
  } finally {
    Notification.create = originals.create;
    CaregiverRelationship.find = originals.findRelationships;
    User.findById = originals.findUser;
  }
};

test('medication events notify only active relationship recipients and encrypt messages', async () => {
  const activeRelationships = CAREGIVER_IDS.map((caregiver) => ({ caregiver }));

  await runWithNotificationModels(activeRelationships, async (created, getQuery) => {
    await createMedicationNotifications({
      patientId: PATIENT_ID,
      type: 'medication_added',
      patientMessage: 'unused patient message',
      caregiverMessage: (patientName) => `${patientName} added a new medication.`,
      relatedEntityType: 'Medication',
      relatedEntityId: '507f1f77bcf86cd799439014',
      dedupeKey: 'medication_added:507f1f77bcf86cd799439014',
      notifyPatient: false,
    });

    assert.deepEqual(getQuery(), {
      patient: PATIENT_ID,
      status: 'active',
    });
    assert.deepEqual(
      created.map(({ recipient }) => String(recipient)).sort(),
      CAREGIVER_IDS.slice().sort()
    );
    assert.ok(created.every(({ _doc }) => _doc.message.startsWith('enc:')));
    assert.deepEqual(
      created.map(({ _doc }) => decrypt(_doc.message)),
      ['Patient added a new medication.', 'Patient added a new medication.']
    );
  });
});

test('medication event with no active caregivers creates no caregiver notifications', async () => {
  await runWithNotificationModels([], async (created) => {
    await createMedicationNotifications({
      patientId: PATIENT_ID,
      type: 'medication_added',
      caregiverMessage: (patientName) => `${patientName} added a new medication.`,
      relatedEntityType: 'Medication',
      relatedEntityId: '507f1f77bcf86cd799439014',
      dedupeKey: 'medication_added:507f1f77bcf86cd799439014',
      notifyPatient: false,
    });

    assert.equal(created.length, 0);
  });
});

test('taken and skipped dose notifications include the patient and each active caregiver', async () => {
  const activeRelationships = CAREGIVER_IDS.map((caregiver) => ({ caregiver }));

  for (const [type, status] of [
    ['dose_taken', 'taken'],
    ['dose_skipped', 'skipped'],
  ]) {
    await runWithNotificationModels(activeRelationships, async (created) => {
      await createMedicationNotifications({
        patientId: PATIENT_ID,
        type,
        patientMessage: `Your dose was marked as ${status}.`,
        caregiverMessage: (patientName) => `${patientName}'s dose was marked as ${status}.`,
        relatedEntityType: 'DoseRecord',
        relatedEntityId: '507f1f77bcf86cd799439014',
        dedupeKey: `${type}:507f1f77bcf86cd799439014`,
      });

      assert.equal(created.length, 3);
      assert.deepEqual(
        created.map(({ recipient }) => String(recipient)).sort(),
        [PATIENT_ID, ...CAREGIVER_IDS].sort()
      );
      assert.ok(created.every(({ _doc }) => _doc.message.startsWith('enc:')));
      assert.deepEqual(
        created.map(({ _doc }) => decrypt(_doc.message)),
        [
          `Your dose was marked as ${status}.`,
          `Patient's dose was marked as ${status}.`,
          `Patient's dose was marked as ${status}.`,
        ]
      );
    });
  }
});
