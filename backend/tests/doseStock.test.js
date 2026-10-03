const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const Notification = require('../models/Notification');
const doseRoutes = require('../routes/doseRoutes');

const USER_ID = '507f1f77bcf86cd799439012';
const MEDICATION_ID = '507f1f77bcf86cd799439011';
const DOSE_ID = '507f1f77bcf86cd799439014';

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
const sentNotifications = [];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async (notification) => {
      sentNotifications.push(notification);
      return true;
    },
  },
};
delete require.cache[require.resolve('../routes/doseRoutes')];
const isolatedDoseRoutes = require('../routes/doseRoutes');
if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

const invokeTakeOrSkip = async ({
  action,
  stock,
  dose,
  medicationUpdate,
  refillThreshold = 1,
  lowRefillNotified = true,
}) => {
  const layer = isolatedDoseRoutes.stack.find((item) => (
    item.route?.path === `/:id/${action}` && item.route.methods.put
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    medicationFindOne: Medication.findOne,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
    medicationUpdateOne: Medication.updateOne,
    doseFindOne: DoseRecord.findOne,
    doseFindOneAndUpdate: DoseRecord.findOneAndUpdate,
    doseFindById: DoseRecord.findById,
  };
  const updates = [];
  const flagUpdates = [];
  let doseTransitionAttempts = 0;
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

  Medication.findOne = async () => ({
    _id: MEDICATION_ID,
    userId: USER_ID,
    name: 'Medication',
    expirationDate: null,
    refillThreshold,
    lowRefillNotified,
    quantityOnHand: stock,
  });
  Medication.findOneAndUpdate = (filter, update) => {
    updates.push({ filter, update });
    if (medicationUpdate) return medicationUpdate(filter, update);
    if (filter.quantityOnHand?.$gt === 0) {
      return stock > 0 ? {
        _id: MEDICATION_ID,
        userId: USER_ID,
        name: 'Medication',
        quantityOnHand: stock - 1,
        refillThreshold,
        lowRefillNotified,
      } : null;
    }
    return { _id: MEDICATION_ID, quantityOnHand: stock + 1 };
  };
  Medication.updateOne = async (filter, update) => {
    flagUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  };
  DoseRecord.findOne = async () => dose;
  DoseRecord.findOneAndUpdate = () => {
    doseTransitionAttempts += 1;
    const transition = () => {
      if (dose.updateError) throw dose.updateError;
      if (dose.updateReturnsNull) return null;
      return { ...dose, status: action === 'take' ? 'taken' : 'skipped', refillDeducted: action === 'take' };
    };

    if (action === 'take') return Promise.resolve().then(transition);

    return {
      populate() {
        return this;
      },
      then(resolve, reject) {
        try {
          resolve(transition());
        } catch (error) {
          reject(error);
        }
      },
    };
  };
  DoseRecord.findById = () => ({
    populate() {
      return this;
    },
    then(resolve) {
      resolve({ ...dose, status: 'taken' });
    },
  });

  try {
    await handler({
      user: { role: 'patient', userId: USER_ID },
      params: { id: DOSE_ID },
      body: {},
    }, response);
  } finally {
    Medication.findOne = originals.medicationFindOne;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
    Medication.updateOne = originals.medicationUpdateOne;
    DoseRecord.findOne = originals.doseFindOne;
    DoseRecord.findOneAndUpdate = originals.doseFindOneAndUpdate;
    DoseRecord.findById = originals.doseFindById;
  }

  return { response, updates, doseTransitionAttempts, flagUpdates };
};

const pendingDose = (overrides = {}) => ({
  _id: DOSE_ID,
  userId: USER_ID,
  medicationId: MEDICATION_ID,
  scheduledDate: '2026-10-02',
  scheduledTime: '8:00 AM',
  status: 'pending',
  refillDeducted: false,
  ...overrides,
});

test('zero-stock TAKE is rejected and leaves the dose pending', async () => {
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 0,
    dose: pendingDose(),
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.message, 'Cannot take this dose because there is no medication stock remaining.');
  assert.equal(updates.length, 1);
  assert.equal(doseTransitionAttempts, 0);
});

test('normal TAKE reserves exactly one unit before marking the dose taken', async () => {
  sentNotifications.length = 0;
  const { response, updates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 3,
    dose: pendingDose(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(updates[0].update.$inc.quantityOnHand, -1);
  assert.equal(updates.length, 1);
});

test('a repeated TAKE of an already-taken dose does not deduct again', async () => {
  const { response, updates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: pendingDose({ status: 'taken', refillDeducted: true }),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(updates.length, 0);
});

test('TAKE compensates a stock reservation if the dose transition fails', async () => {
  let quantity = 2;
  const { response, updates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: pendingDose({ updateError: new Error('test database failure') }),
    medicationUpdate: async (filter, update) => {
      quantity += update.$inc.quantityOnHand;
      return { _id: MEDICATION_ID, quantityOnHand: quantity };
    },
  });

  assert.equal(response.statusCode, 500);
  assert.equal(quantity, 2);
  assert.deepEqual(updates.map((entry) => entry.update.$inc.quantityOnHand), [-1, 1]);
});

test('SKIP changes no medication quantity', async () => {
  const { response, updates } = await invokeTakeOrSkip({
    action: 'skip',
    stock: 3,
    dose: pendingDose(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'skipped');
  assert.equal(updates.length, 0);
});

test('TAKE triggers one low-stock notice when crossing threshold and honors the notification flag', async () => {
  sentNotifications.length = 0;
  const first = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: false,
    dose: pendingDose(),
  });

  assert.equal(first.response.statusCode, 200);
  assert.equal(sentNotifications.length, 1);
  assert.equal(first.flagUpdates[0].update.$set.lowRefillNotified, true);

  const second = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: true,
    dose: pendingDose(),
  });

  assert.equal(second.response.statusCode, 200);
  assert.equal(sentNotifications.length, 1);
});