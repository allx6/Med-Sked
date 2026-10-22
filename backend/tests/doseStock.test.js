const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const Notification = require('../models/Notification');
const doseRoutes = require('../routes/doseRoutes');
const {
  getMedicationLocalParts,
  toWallClockTimestamp,
} = require('../utils/medicationTime');

const USER_ID = '507f1f77bcf86cd799439012';
const MEDICATION_ID = '507f1f77bcf86cd799439011';
const DOSE_ID = '507f1f77bcf86cd799439014';
const STOCK_BATCH_ID = '507f1f77bcf86cd799439015';
const CAREGIVER_ID = '507f1f77bcf86cd799439019';

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
const sentNotifications = [];
let notificationResult = true;
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async (notification) => {
      sentNotifications.push(notification);
      return notificationResult;
    },
    notifyLowRefill: async ({ medication, triggerId }) => {
      if (
        !medication
        || medication.quantityOnHand > medication.refillThreshold
        || medication.lowRefillNotified
      ) {
        return null;
      }

      const claim = await Medication.updateOne(
        {
          _id: medication._id,
          userId: medication.userId,
          lowRefillNotified: { $ne: true },
        },
        { $set: { lowRefillNotified: true } }
      );

      if (claim.modifiedCount !== 1) return null;

      const notification = {
        patientId: medication.userId,
        type: 'low_refill',
        patientMessage: `${medication.name} is low on refill stock.`,
        caregiverMessage: (patientName) => `${patientName}'s ${medication.name} is low on refill stock.`,
        relatedEntityType: 'Medication',
        relatedEntityId: medication._id,
        dedupeKey: `low_refill:${medication._id}:${triggerId}`,
      };
      sentNotifications.push(notification);

      if (!notificationResult) {
        await Medication.updateOne(
          {
            _id: medication._id,
            userId: medication.userId,
            lowRefillNotified: true,
          },
          { $set: { lowRefillNotified: false } }
        );
      }

      return notificationResult ? notification : null;
    },
  },
};
const missedDoseServicePath = require.resolve('../services/missedDoseService');
const originalMissedDoseService = require.cache[missedDoseServicePath];
require.cache[missedDoseServicePath] = {
  id: missedDoseServicePath,
  filename: missedDoseServicePath,
  loaded: true,
  exports: {
    detectMissedDoses: async () => ({ markedMissed: 0 }),
  },
};
delete require.cache[require.resolve('../routes/doseRoutes')];
const isolatedDoseRoutes = require('../routes/doseRoutes');
if (originalMissedDoseService) {
  require.cache[missedDoseServicePath] = originalMissedDoseService;
} else {
  delete require.cache[missedDoseServicePath];
}
if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

const invokeTakeOrSkip = async ({
  action,
  stock,
  dose,
  frequency,
  requestBody = {},
  requestUser = { role: 'patient', userId: USER_ID },
  previousTakenDose = null,
  pendingRebaseDoses = [],
  medicationUpdate,
  stockBatches,
  refillThreshold = 1,
  lowRefillNotified = true,
}) => {
  const layer = isolatedDoseRoutes.stack.find((item) => (
    item.route?.path === `/:id/${action}` && item.route.methods.put
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    scheduleFind: MedicationSchedule.find,
    medicationFindOne: Medication.findOne,
    medicationFindOneAndUpdate: Medication.findOneAndUpdate,
    medicationUpdateOne: Medication.updateOne,
    doseFind: DoseRecord.find,
    doseFindOne: DoseRecord.findOne,
    doseFindOneAndUpdate: DoseRecord.findOneAndUpdate,
    doseFindById: DoseRecord.findById,
    doseUpdateOne: DoseRecord.updateOne,
  };
  const updates = [];
  const flagUpdates = [];
  const rebaseUpdates = [];
  let doseTransitionAttempts = 0;
  let doseAfterTransition = dose;
  let currentStock = stock;
  let batches = stockBatches || (currentStock > 0
    ? [{
      _id: STOCK_BATCH_ID,
      quantityAdded: stock,
      remainingQuantity: currentStock,
      expirationDate: null,
      receivedAt: new Date(),
    }]
    : []);
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

  MedicationSchedule.find = () => ({
    lean: async () => [],
  });
  Medication.findOne = async () => ({
    _id: MEDICATION_ID,
    userId: USER_ID,
    name: 'Medication',
    frequency,
    expirationDate: null,
    refillThreshold,
    lowRefillNotified,
    quantityOnHand: currentStock,
    stockBatches: batches,
  });
  Medication.findOneAndUpdate = (filter, update) => {
    updates.push({ filter, update });
    if (medicationUpdate) return medicationUpdate(filter, update);
    if (update.$inc?.['stockBatches.$.remainingQuantity'] === -1) {
      const batchId = filter.stockBatches?.$elemMatch?._id;
      const batch = batches.find((item) => String(item._id) === String(batchId));
      if (currentStock <= 0 || !batch || batch.remainingQuantity <= 0) return null;
      currentStock -= 1;
      batch.remainingQuantity -= 1;
      return {
        _id: MEDICATION_ID,
        userId: USER_ID,
        name: 'Medication',
        quantityOnHand: currentStock,
        stockBatches: batches,
        refillThreshold,
        lowRefillNotified,
      };
    }
    if (update.$inc?.['stockBatches.$.remainingQuantity'] === 1) {
      const batchId = filter['stockBatches._id'];
      const batch = batches.find((item) => String(item._id) === String(batchId));
      if (!batch) return null;
      currentStock += 1;
      batch.remainingQuantity += 1;
      return { _id: MEDICATION_ID, quantityOnHand: currentStock, stockBatches: batches };
    }
    return null;
  };
  Medication.updateOne = async (filter, update) => {
    flagUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  };
  DoseRecord.findOne = (filter) => {
    if (filter.status === 'taken') {
      return {
        sort() {
          return this;
        },
        lean: async () => previousTakenDose,
      };
    }
    return Promise.resolve(dose);
  };
  DoseRecord.find = (filter = {}) => (
    filter.status === 'pending'
      ? Promise.resolve(pendingRebaseDoses)
      : {
        populate() {
          return this;
        },
        lean: async () => [],
      }
  );
  DoseRecord.updateOne = async (filter, update) => {
    rebaseUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  };
  DoseRecord.findOneAndUpdate = (filter, update) => {
    doseTransitionAttempts += 1;
    const transition = () => {
      if (dose.updateError) throw dose.updateError;
      if (dose.updateReturnsNull) return null;
      doseAfterTransition = {
        ...dose,
        ...update.$set,
        status: update.$set?.status || (action === 'take' ? 'taken' : 'skipped'),
        refillDeducted: update.$set?.refillDeducted ?? action === 'take',
      };
      return doseAfterTransition;
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
      resolve(doseAfterTransition);
    },
  });

  try {
    await handler({
      user: requestUser,
      params: { id: DOSE_ID },
      body: requestBody,
    }, response);
  } finally {
    MedicationSchedule.find = originals.scheduleFind;
    Medication.findOne = originals.medicationFindOne;
    Medication.findOneAndUpdate = originals.medicationFindOneAndUpdate;
    Medication.updateOne = originals.medicationUpdateOne;
    DoseRecord.find = originals.doseFind;
    DoseRecord.findOne = originals.doseFindOne;
    DoseRecord.findOneAndUpdate = originals.doseFindOneAndUpdate;
    DoseRecord.findById = originals.doseFindById;
    DoseRecord.updateOne = originals.doseUpdateOne;
  }

  return { response, updates, doseTransitionAttempts, flagUpdates, rebaseUpdates };
};

const pendingDose = (overrides = {}) => {
  const nowParts = getMedicationLocalParts(new Date());
  const scheduled = toWallClockTimestamp(nowParts);
  scheduled.setUTCMinutes(scheduled.getUTCMinutes() - 5);
  const hours = scheduled.getUTCHours();
  return {
    _id: DOSE_ID,
    userId: USER_ID,
    medicationId: MEDICATION_ID,
    scheduleId: '507f1f77bcf86cd799439013',
    scheduledDate: `${scheduled.getUTCFullYear()}-${String(scheduled.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduled.getUTCDate()).padStart(2, '0')}`,
    scheduledTime: `${hours % 12 || 12}:${String(scheduled.getUTCMinutes()).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`,
    status: 'pending',
    refillDeducted: false,
    ...overrides,
  };
};

const scheduledDoseAfterMinutes = (minutes, overrides = {}) => {
  const scheduled = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  scheduled.setUTCMinutes(scheduled.getUTCMinutes() + minutes);
  const hours = scheduled.getUTCHours();
  return pendingDose({
    scheduledDate: `${scheduled.getUTCFullYear()}-${String(scheduled.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduled.getUTCDate()).padStart(2, '0')}`,
    scheduledTime: `${hours % 12 || 12}:${String(scheduled.getUTCMinutes()).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`,
    effectiveDueAt: scheduled,
    ...overrides,
  });
};

test('zero-stock TAKE is rejected and leaves the dose pending', async () => {
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 0,
    dose: pendingDose(),
  });

  test('TAKE consumes the earliest-expiring unexpired batch first', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();
    const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const expiredBatchId = '507f1f77bcf86cd799439016';
    const todayBatchId = '507f1f77bcf86cd799439017';

    const { response, updates } = await invokeTakeOrSkip({
      action: 'take',
      stock: 2,
      dose: pendingDose(),
      stockBatches: [
        { _id: expiredBatchId, remainingQuantity: 1, expirationDate: dateString(yesterday), receivedAt: yesterday },
        { _id: todayBatchId, remainingQuantity: 1, expirationDate: dateString(today), receivedAt: today },
      ],
    });

    assert.equal(response.statusCode, 200);
    assert.equal(String(updates[0].filter.stockBatches.$elemMatch._id), todayBatchId);
  });

  test('TAKE rejects stock when every batch is expired', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expirationDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const dose = pendingDose({ scheduledDate: expirationDate });
    const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
      action: 'take',
      stock: 1,
      dose,
      stockBatches: [
        { _id: STOCK_BATCH_ID, remainingQuantity: 1, expirationDate, receivedAt: yesterday },
      ],
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.message, 'Cannot take this dose because there is no unexpired medication stock remaining.');
    assert.equal(updates.length, 0);
    assert.equal(doseTransitionAttempts, 0);
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.message, 'Cannot take this dose because there is no unexpired medication stock remaining.');
  assert.equal(updates.length, 0);
  assert.equal(doseTransitionAttempts, 0);
});

test('normal TAKE reserves exactly one unit before marking the dose taken', async () => {
  sentNotifications.length = 0;
  const dose = pendingDose();
  const { response, updates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 3,
    dose,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(response.body.takenTiming, 'late');
  assert.equal(updates[0].update.$inc.quantityOnHand, -1);
  assert.equal(updates.length, 1);
  assert.deepEqual(
    sentNotifications.map(({ type }) => type),
    ['dose_taken']
  );
  assert.ok(sentNotifications[0].patientMessage.includes(
    `dose scheduled at ${dose.scheduledTime} was recorded as taken`
  ));
  assert.equal(sentNotifications[0].dedupeKey, `dose_taken:${DOSE_ID}`);
});

test('TAKE rejects a future fixed-time dose without changing stock or dose state', async () => {
  const dose = pendingDose();
  const futureDue = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  futureDue.setUTCMinutes(futureDue.getUTCMinutes() + 30);
  dose.effectiveDueAt = futureDue;
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'DOSE_NOT_DUE');
  assert.equal(updates.length, 0);
  assert.equal(doseTransitionAttempts, 0);
});

test('explicit early TAKE is rejected for fixed-time medication schedules', async () => {
  const dose = pendingDose();
  const futureDue = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  futureDue.setUTCMinutes(futureDue.getUTCMinutes() + 30);
  dose.effectiveDueAt = futureDue;
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose,
    requestBody: { earlyDoseConfirmed: true },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'EARLY_DOSE_NOT_ALLOWED');
  assert.equal(updates.length, 0);
  assert.equal(doseTransitionAttempts, 0);
});

test('explicit early interval TAKE requires a verifiable previous administration', async () => {
  const dose = pendingDose();
  const futureDue = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  futureDue.setUTCMinutes(futureDue.getUTCMinutes() + 30);
  dose.effectiveDueAt = futureDue;
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose,
    frequency: 'Every 8 hours',
    requestBody: { earlyDoseConfirmed: true },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'EARLY_DOSE_INTERVAL_UNVERIFIED');
  assert.equal(updates.length, 0);
  assert.equal(doseTransitionAttempts, 0);
});

test('explicit early interval TAKE is rejected before the prescribed interval elapses', async () => {
  const dose = pendingDose();
  const futureDue = toWallClockTimestamp(getMedicationLocalParts(new Date()));
  futureDue.setUTCMinutes(futureDue.getUTCMinutes() + 30);
  dose.effectiveDueAt = futureDue;
  const previousTakenAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const { response, updates, doseTransitionAttempts } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose,
    frequency: 'Every 8 hours',
    requestBody: { earlyDoseConfirmed: true },
    previousTakenDose: { takenAt: previousTakenAt },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'EARLY_DOSE_INTERVAL_NOT_MET');
  assert.equal(updates.length, 0);
  assert.equal(doseTransitionAttempts, 0);
});

test('explicit early interval TAKE is recorded after the verified interval elapses', async () => {
  const dose = scheduledDoseAfterMinutes(30);
  const previousTakenAt = new Date(Date.now() - 9 * 60 * 60 * 1000);
  const { response } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: { ...dose, refillDeducted: true },
    frequency: 'Every 8 hours',
    requestBody: { earlyDoseConfirmed: true },
    previousTakenDose: { takenAt: previousTakenAt },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(response.body.takenTiming, 'early');
});

test('taking an interval dose later shifts the next pending dose by the same delay', async () => {
  const originalNextDose = scheduledDoseAfterMinutes(8 * 60, {
    _id: '507f1f77bcf86cd799439018',
  });
  const { response, rebaseUpdates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: pendingDose({ refillDeducted: true }),
    frequency: 'Every 8 hours',
    pendingRebaseDoses: [originalNextDose],
  });

  assert.equal(response.statusCode, 200);
  assert.equal(rebaseUpdates.length, 1);
  const rebasedDue = rebaseUpdates[0].update.$set.effectiveDueAt;
  assert.ok(rebasedDue > originalNextDose.effectiveDueAt);
  assert.ok(rebasedDue < new Date(originalNextDose.effectiveDueAt.getTime() + 15 * 60 * 1000));
});

test('caregiver adherence support records the caregiver as dose actor', async () => {
  const { response } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: pendingDose({ refillDeducted: true }),
    requestUser: { role: 'caregiver', userId: CAREGIVER_ID },
    requestBody: { patientId: USER_ID },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.takenBy, CAREGIVER_ID);
  assert.equal(response.body.takenByRole, 'caregiver');
});

test('correcting a missed dose deducts stock once while recording the past administration', async () => {
  const actualTakenAt = new Date(Date.now() - 1000);
  const { response, updates } = await invokeTakeOrSkip({
    action: 'correct-taken',
    stock: 3,
    dose: pendingDose({ status: 'missed' }),
    frequency: 'Daily',
    requestBody: {
      takenAt: actualTakenAt.toISOString(),
      correctionReason: 'Patient confirmed the dose was taken.',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'taken');
  assert.equal(response.body.takenTiming, 'late');
  assert.equal(response.body.takenAt.toISOString(), actualTakenAt.toISOString());
  assert.equal(response.body.correctionReason, 'Patient confirmed the dose was taken.');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].update.$inc.quantityOnHand, -1);
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
  let batchQuantity = 2;
  const { response, updates } = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    dose: pendingDose({ updateError: new Error('test database failure') }),
    medicationUpdate: async (filter, update) => {
      quantity += update.$inc.quantityOnHand;
      batchQuantity += update.$inc['stockBatches.$.remainingQuantity'];
      return { _id: MEDICATION_ID, quantityOnHand: quantity };
    },
  });

  assert.equal(response.statusCode, 500);
  assert.equal(quantity, 2);
  assert.equal(batchQuantity, 2);
  assert.deepEqual(updates.map((entry) => entry.update.$inc.quantityOnHand), [-1, 1]);
});

test('SKIP changes no medication quantity', async () => {
  sentNotifications.length = 0;
  const dose = pendingDose();
  const { response, updates } = await invokeTakeOrSkip({
    action: 'skip',
    stock: 3,
    dose,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'skipped');
  assert.equal(updates.length, 0);
  assert.deepEqual(
    sentNotifications.map(({ type }) => type),
    ['dose_skipped']
  );
  assert.equal(
    sentNotifications[0].patientMessage,
    `Your Medication dose scheduled at ${dose.scheduledTime} was marked as skipped.`
  );
  assert.equal(sentNotifications[0].dedupeKey, `dose_skipped:${DOSE_ID}`);
});

test('TAKE triggers one low-stock notice when crossing threshold and honors the notification flag', async () => {
  sentNotifications.length = 0;
  notificationResult = true;
  const first = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: false,
    dose: pendingDose(),
  });

  assert.equal(first.response.statusCode, 200);
  assert.equal(sentNotifications.filter(({ type }) => type === 'low_refill').length, 1);
  assert.equal(sentNotifications.filter(({ type }) => type === 'dose_taken').length, 1);
  assert.equal(first.flagUpdates[0].update.$set.lowRefillNotified, true);
  assert.equal(sentNotifications.find(({ type }) => type === 'low_refill').dedupeKey, `low_refill:${MEDICATION_ID}:${DOSE_ID}`);

  const second = await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: true,
    dose: pendingDose(),
  });

  assert.equal(second.response.statusCode, 200);
  assert.equal(sentNotifications.filter(({ type }) => type === 'low_refill').length, 1);
});

test('a later low-stock cycle can notify again after stock is re-armed', async () => {
  sentNotifications.length = 0;
  notificationResult = true;

  await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: false,
    dose: pendingDose(),
  });
  await invokeTakeOrSkip({
    action: 'take',
    stock: 2,
    refillThreshold: 1,
    lowRefillNotified: false,
    dose: pendingDose({ _id: '507f1f77bcf86cd799439015' }),
  });

  const lowRefillNotifications = sentNotifications.filter(({ type }) => type === 'low_refill');
  assert.equal(lowRefillNotifications.length, 2);
  assert.notEqual(lowRefillNotifications[0].dedupeKey, lowRefillNotifications[1].dedupeKey);
});

test('failed patient notification creation re-arms the low-stock notification flag', async () => {
  sentNotifications.length = 0;
  notificationResult = null;

  try {
    const { response, flagUpdates } = await invokeTakeOrSkip({
      action: 'take',
      stock: 2,
      refillThreshold: 1,
      lowRefillNotified: false,
      dose: pendingDose(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(flagUpdates[0].update.$set.lowRefillNotified, true);
    assert.equal(flagUpdates[1].update.$set.lowRefillNotified, false);
  } finally {
    notificationResult = true;
  }
});