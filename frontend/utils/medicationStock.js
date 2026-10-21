const formatLocalDate = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
};

export const getUsableMedicationQuantity = (medication, now = new Date()) => {
  const batches = Array.isArray(medication?.stockBatches)
    ? medication.stockBatches
    : [];

  if (batches.length === 0) {
    const quantity = Number(medication?.quantityOnHand ?? 0);
    return Number.isFinite(quantity) ? quantity : 0;
  }

  const today = formatLocalDate(now);
  return batches.reduce((total, batch) => {
    const expirationDate = batch?.expirationDate;
    if (expirationDate && !isValidDate(expirationDate)) {
      return total;
    }
    if (expirationDate && expirationDate < today) {
      return total;
    }

    const quantity = Number(batch?.remainingQuantity ?? 0);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
};

export const getNextBatchExpirationDate = (medication, now = new Date()) => {
  const today = formatLocalDate(now);
  const batches = Array.isArray(medication?.stockBatches)
    ? medication.stockBatches
    : [];
  const nextBatch = batches
    .filter((batch) => (
      Number(batch?.remainingQuantity) > 0
      && batch?.expirationDate
      && isValidDate(batch.expirationDate)
      && batch.expirationDate >= today
    ))
    .sort((left, right) => left.expirationDate.localeCompare(right.expirationDate))[0];

  return nextBatch?.expirationDate || null;
};

export const isMedicationLowStock = (medication) => (
  getUsableMedicationQuantity(medication)
  <= Number(medication?.refillThreshold ?? 0)
);
