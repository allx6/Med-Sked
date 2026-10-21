const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'N').toString('base64');

const Notification = require('../models/Notification');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');
const {
  createMedicationNotifications,
  notifyLowRefill,
} = require('../services/notificationService');

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CAREGIVER_IDS = [
  '507f1f77bcf86cd799439012',
  '507f1f77bcf86cd799439013',
];

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationServiceModule = require.cache[notificationServicePath];
const medicationNotificationCalls = [];
const lowRefillNotificationCalls = [];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async (payload) => {
      medicationNotificationCalls.push(payload);
      return null;
    },
    notifyLowRefill: async (payload) => {
      lowRefillNotificationCalls.push(payload);
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

test('creating a medication in a low-stock state invokes the low-refill notification flow', async () => {
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
  lowRefillNotificationCalls.length = 0;
  Medication.findOne = async () => null;
  Medication.create = async (payload) => ({
    ...payload,
    _id: '507f1f77bcf86cd799439018',
  });

  try {
    await handler({
      user: { role: 'patient', userId: PATIENT_ID },
      body: {
        name: 'Medication',
        dosage: '100 mg',
        frequency: 'Every 8 hours',
        quantityOnHand: 2,
        refillThreshold: 3,
        expirationDate: '2026-12-31',
      },
    }, response);
  } finally {
    Medication.findOne = originals.findOne;
    Medication.create = originals.create;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(lowRefillNotificationCalls.length, 1);
  assert.equal(lowRefillNotificationCalls[0].medication.quantityOnHand, 2);
  assert.equal(lowRefillNotificationCalls[0].medication.refillThreshold, 3);
  assert.equal(lowRefillNotificationCalls[0].triggerId, 'created:507f1f77bcf86cd799439018');
});

test('updating a medication into a low-stock state invokes the low-refill notification flow', async () => {
  const putRoute = medicationRoutes.stack.find((layer) => (
    layer.route?.path === '/:id' && layer.route.methods.put
  ));
  const handler = putRoute.route.stack.at(-1).handle;
  const originals = {
    startSession: mongoose.startSession,
    findOne: Medication.findOne,
    findOneAndUpdate: Medication.findOneAndUpdate,
    scheduleFindOne: MedicationSchedule.findOne,
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
  lowRefillNotificationCalls.length = 0;
  let medicationLookupCount = 0;
  Medication.findOne = async () => {
    medicationLookupCount += 1;
    return medicationLookupCount === 1
      ? {
        _id: '507f1f77bcf86cd799439019',
        userId: PATIENT_ID,
        name: 'Medication',
        dosage: '100 mg',
        frequency: 'Every 8 hours',
        expirationDate: '2099-12-31',
      }
      : null;
  };
  Medication.findOneAndUpdate = async (_filter, update) => ({
    ...update,
    _id: '507f1f77bcf86cd799439019',
    userId: PATIENT_ID,
    name: update.name,
    updatedAt: new Date(),
  });
  MedicationSchedule.findOne = () => ({
    session: async () => null,
  });
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });

  try {
    await handler({
      user: { role: 'patient', userId: PATIENT_ID },
      params: { id: '507f1f77bcf86cd799439019' },
      body: {
        name: 'Medication',
        dosage: '100 mg',
        frequency: 'Every 8 hours',
        quantityOnHand: 2,
        refillThreshold: 3,
        expirationDate: '2099-12-31',
      },
    }, response);
  } finally {
    mongoose.startSession = originals.startSession;
    Medication.findOne = originals.findOne;
    Medication.findOneAndUpdate = originals.findOneAndUpdate;
    MedicationSchedule.findOne = originals.scheduleFindOne;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(lowRefillNotificationCalls.length, 1);
  assert.equal(lowRefillNotificationCalls[0].medication.quantityOnHand, 2);
  assert.equal(lowRefillNotificationCalls[0].medication.refillThreshold, 3);
});

const runWithNotificationModels = async (relationships, callback) => {
  const originals = {
    create: Notification.create,
    findRelationships: CaregiverRelationship.find,
    findUser: User.findById,
    updateMedication: Medication.updateOne,
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
      lean: async () => relationships.filter((relationship) => (
        !relationship.status || relationship.status === query.status
      )),
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
    Medication.updateOne = originals.updateMedication;
  }
};

test('medication events notify only active relationship recipients and encrypt messages', async () => {
  const activeRelationships = CAREGIVER_IDS.map((caregiver) => ({ caregiver, status: 'active' }));

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
  const activeRelationships = CAREGIVER_IDS.map((caregiver) => ({ caregiver, status: 'active' }));

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

test('low stock notifies the patient and active caregivers once and encrypts every message', async () => {
  let lowRefillNotified = false;
  const relationships = [
    ...CAREGIVER_IDS.map((caregiver) => ({ caregiver, status: 'active' })),
    { caregiver: '507f1f77bcf86cd799439015', status: 'pending' },
    { caregiver: '507f1f77bcf86cd799439016', status: 'revoked' },
  ];

  await runWithNotificationModels(relationships, async (created, getQuery) => {
    Medication.updateOne = async (filter, update) => {
      if (update.$set.lowRefillNotified) {
        if (lowRefillNotified || filter.lowRefillNotified.$ne !== true) {
          return { modifiedCount: 0 };
        }
        lowRefillNotified = true;
        return { modifiedCount: 1 };
      }

      lowRefillNotified = false;
      return { modifiedCount: 1 };
    };

    const medication = {
      _id: '507f1f77bcf86cd799439017',
      userId: PATIENT_ID,
      name: 'Medication',
      quantityOnHand: 10,
      refillThreshold: 2,
      lowRefillNotified: false,
      stockBatches: [
        { remainingQuantity: 8, expirationDate: '2020-01-01' },
        { remainingQuantity: 2, expirationDate: '2099-12-31' },
      ],
    };

    await notifyLowRefill({ medication, triggerId: 'low-stock-trigger' });
    await notifyLowRefill({ medication, triggerId: 'duplicate-trigger' });

    assert.deepEqual(getQuery(), { patient: PATIENT_ID, status: 'active' });
    assert.equal(lowRefillNotified, true);
    assert.equal(created.length, 3);
    assert.deepEqual(
      created.map(({ recipient }) => String(recipient)).sort(),
      [PATIENT_ID, ...CAREGIVER_IDS].sort()
    );
    assert.deepEqual(
      created.map(({ type }) => type),
      ['low_refill', 'low_refill', 'low_refill']
    );
    assert.ok(created.every(({ _doc }) => _doc.message.startsWith('enc:')));
    assert.deepEqual(
      created.map(({ _doc }) => decrypt(_doc.message)),
      [
        'Medication is low on refill stock.',
        "Patient's Medication is low on refill stock.",
        "Patient's Medication is low on refill stock.",
      ]
    );
  });
});
