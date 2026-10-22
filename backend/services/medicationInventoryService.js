const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const {
  formatLocalDate,
  getUsableMedicationQuantity,
} = require('../utils/medicationInventory');

const makeStockBatch = ({
  quantity,
  expirationDate,
  receivedBy,
  source,
}) => ({
  _id: new mongoose.Types.ObjectId(),
  quantityAdded: quantity,
  remainingQuantity: quantity,
  expirationDate: expirationDate || null,
  receivedAt: new Date(),
  receivedBy: receivedBy || null,
  source,
});

const reconcileMedicationStockBatches = ({
  batches,
  targetQuantity,
  expirationDate,
  receivedBy,
}) => {
  const result = (batches || []).map((batch) => (
    typeof batch.toObject === 'function' ? batch.toObject() : { ...batch }
  ));
  const currentQuantity = result.reduce(
    (total, batch) => total + Number(batch.remainingQuantity || 0),
    0
  );

  if (targetQuantity > currentQuantity) {
    result.push(makeStockBatch({
      quantity: targetQuantity - currentQuantity,
      expirationDate,
      receivedBy,
      source: 'manual-adjustment',
    }));
  } else if (targetQuantity < currentQuantity) {
    const earliestFirst = [...result].sort((left, right) => {
      if (!left.expirationDate) return right.expirationDate ? 1 : 0;
      if (!right.expirationDate) return -1;
      return left.expirationDate.localeCompare(right.expirationDate);
    });
    let quantityToRemove = currentQuantity - targetQuantity;

    for (const batch of earliestFirst) {
      if (quantityToRemove <= 0) break;
      const reduction = Math.min(
        Number(batch.remainingQuantity || 0),
        quantityToRemove
      );
      batch.remainingQuantity -= reduction;
      quantityToRemove -= reduction;
    }
  }

  return result;
};

const ensureLegacyStockBatch = async (medicationId, userId) => {
  let medication = await Medication.findOne({
    _id: medicationId,
    userId,
  });

  if (!medication || medication.stockBatches?.length > 0 || medication.quantityOnHand <= 0) {
    return medication;
  }

  const legacyBatch = makeStockBatch({
    quantity: Number(medication.quantityOnHand),
    expirationDate: medication.expirationDate,
    source: 'legacy',
  });

  const migrated = await Medication.findOneAndUpdate(
    {
      _id: medicationId,
      userId,
      'stockBatches.0': { $exists: false },
      quantityOnHand: medication.quantityOnHand,
    },
    { $set: { stockBatches: [legacyBatch] } },
    { returnDocument: 'after', runValidators: true }
  );

  if (migrated) {
    return migrated;
  }

  medication = await Medication.findOne({ _id: medicationId, userId });
  return medication;
};

const addMedicationStockBatch = async ({
  medicationId,
  userId,
  quantity,
  expirationDate,
  receivedBy,
}) => {
  let medication = await ensureLegacyStockBatch(medicationId, userId);
  if (!medication) {
    return null;
  }

  const batch = makeStockBatch({
    quantity,
    expirationDate,
    receivedBy,
    source: 'refill',
  });
  const nextQuantity = Number(medication.quantityOnHand || 0) + quantity;
  const batchesAfterRefill = [...(medication.stockBatches || []), batch];
  const hasUnknownExpiration = batchesAfterRefill.some(
    (stockBatch) => stockBatch.remainingQuantity > 0 && !stockBatch.expirationDate
  );
  const latestBatchExpiration = batchesAfterRefill
    .filter((stockBatch) => stockBatch.remainingQuantity > 0 && stockBatch.expirationDate)
    .map((stockBatch) => stockBatch.expirationDate)
    .sort()
    .at(-1) || null;
  const medicationAfterRefill = {
    quantityOnHand: nextQuantity,
    refillThreshold: medication.refillThreshold,
    stockBatches: batchesAfterRefill,
  };

  medication = await Medication.findOneAndUpdate(
    {
      _id: medicationId,
      userId,
    },
    {
      $inc: { quantityOnHand: quantity },
      $push: { stockBatches: batch },
      $set: {
        lowRefillNotified: getUsableMedicationQuantity(medicationAfterRefill)
          > Number(medication.refillThreshold || 0)
          ? false
          : Boolean(medication.lowRefillNotified),
        expirationDate: hasUnknownExpiration
          ? null
          : latestBatchExpiration,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after', runValidators: true, timestamps: false }
  );

  return medication;
};

const consumeMedicationStockBatch = async (medicationId, userId) => {
  let medication = await ensureLegacyStockBatch(medicationId, userId);
  if (!medication || Number(medication.quantityOnHand) <= 0) {
    return null;
  }

  const today = formatLocalDate();
  const eligibleBatches = (medication.stockBatches || [])
    .filter((batch) => (
      Number(batch.remainingQuantity) > 0
      && (!batch.expirationDate || batch.expirationDate >= today)
    ))
    .sort((left, right) => {
      if (!left.expirationDate) return right.expirationDate ? 1 : 0;
      if (!right.expirationDate) return -1;
      return left.expirationDate.localeCompare(right.expirationDate)
        || new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime();
    });

  for (const batch of eligibleBatches) {
    const expirationCondition = batch.expirationDate
      ? { expirationDate: { $gte: today } }
      : { expirationDate: null };
    medication = await Medication.findOneAndUpdate(
      {
        _id: medicationId,
        userId,
        quantityOnHand: { $gt: 0 },
        stockBatches: {
          $elemMatch: {
            _id: batch._id,
            remainingQuantity: { $gt: 0 },
            ...expirationCondition,
          },
        },
      },
      {
        $inc: {
          quantityOnHand: -1,
          'stockBatches.$.remainingQuantity': -1,
        },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (medication) {
      return { medication, batchId: batch._id };
    }

    medication = await ensureLegacyStockBatch(medicationId, userId);
    if (!medication || Number(medication.quantityOnHand) <= 0) {
      return null;
    }
  }

  return null;
};

const restoreMedicationStockBatch = async (medicationId, userId, batchId) => {
  const restoredMedication = await Medication.findOneAndUpdate(
    {
      _id: medicationId,
      userId,
      'stockBatches._id': batchId,
    },
    {
      $inc: {
        quantityOnHand: 1,
        'stockBatches.$.remainingQuantity': 1,
      },
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!restoredMedication) {
    throw new Error('Unable to restore reserved medication batch stock.');
  }

  return restoredMedication;
};

module.exports = {
  addMedicationStockBatch,
  consumeMedicationStockBatch,
  ensureLegacyStockBatch,
  reconcileMedicationStockBatches,
  restoreMedicationStockBatch,
};
