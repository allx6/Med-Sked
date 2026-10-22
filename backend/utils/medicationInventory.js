const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const medicationDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatLocalDate = (date = new Date()) => {
  const parts = Object.fromEntries(
    medicationDateFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const isValidDateString = (value) => {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month - 1
    && parsedDate.getDate() === day;
};

const validateBatchExpirationDate = (value) => {
  if (!isValidDateString(value)) {
    const error = new Error('Batch expiration date must be a valid YYYY-MM-DD date.');
    error.statusCode = 400;
    throw error;
  }

  if (value < formatLocalDate()) {
    const error = new Error('Batch expiration date cannot be earlier than today.');
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const getMedicationExpirationDate = (medication) => {
  const batches = Array.isArray(medication?.stockBatches)
    ? medication.stockBatches
    : [];

  if (batches.length === 0) {
    return medication?.expirationDate || null;
  }

  if (batches.some((batch) => !batch.expirationDate && batch.remainingQuantity > 0)) {
    return null;
  }

  const expirations = batches
    .filter((batch) => Number(batch.remainingQuantity) > 0 && isValidDateString(batch.expirationDate))
    .map((batch) => batch.expirationDate)
    .sort();

  return expirations.at(-1) || medication?.expirationDate || null;
};

const getUsableMedicationQuantity = (medication, now = new Date()) => {
  const batches = Array.isArray(medication?.stockBatches)
    ? medication.stockBatches
    : [];

  if (batches.length === 0) {
    return Number(medication?.quantityOnHand ?? 0);
  }

  const today = formatLocalDate(now);
  return batches.reduce((total, batch) => {
    const expirationDate = batch?.expirationDate;
    if (expirationDate && (
      !isValidDateString(expirationDate)
      || expirationDate < today
    )) {
      return total;
    }

    const quantity = Number(batch?.remainingQuantity ?? 0);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
};

module.exports = {
  formatLocalDate,
  getMedicationExpirationDate,
  getUsableMedicationQuantity,
  isValidDateString,
  validateBatchExpirationDate,
};
