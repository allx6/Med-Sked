const dosagePattern = /^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i;
const frequencyPattern = /^Every\s+([0-9]+(?:\.[0-9]+)?)\s+(hours|days)$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const parseLocalDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (![year, month, day].every((part) => Number.isFinite(part))) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const validateMedicationExpirationDate = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'Expiration date is required.';
  }

  const trimmed = String(value).trim();
  if (!datePattern.test(trimmed) || !parseLocalDate(trimmed)) {
    return 'Expiration date must be a valid YYYY-MM-DD date.';
  }

  return '';
};

export const validateMedicationFields = ({ name, dosage, frequency, expirationDate }) => {
  const expirationError = validateMedicationExpirationDate(expirationDate);
  if (expirationError) {
    return expirationError;
  }

  if (String(name || '').trim().length < 2) {
    return 'Medication name must contain at least 2 characters.';
  }

  const dosageValue = String(dosage || '').trim();
  const dosageMatch = dosageValue.match(dosagePattern);
  if (!dosageValue || /^(mg|mcg|g|mL|tablet)$/i.test(dosageValue)) {
    return 'Dosage amount is required.';
  }

  if (!dosageMatch) {
    const numericAmountMatch = dosageValue.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(?:mg|mcg|g|mL|tablet))?$/i);
    if (numericAmountMatch && Number(numericAmountMatch[1]) <= 0) {
      return 'Dosage amount must be greater than 0.';
    }

    return 'Dosage amount must be a number greater than 0.';
  }

  if (Number(dosageMatch[1]) <= 0) {
    return 'Dosage amount must be greater than 0.';
  }

  const frequencyMatch = String(frequency || '').trim().match(frequencyPattern);
  if (!frequencyMatch || Number(frequencyMatch[1]) < 1) {
    return 'Frequency must be at least 1 hour or day.';
  }

  return '';
};

export const getMedicationExpirationState = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return {
      expirationDate: null,
      expired: false,
    };
  }

  const normalizedDate = String(value).trim().split('T')[0];
  const parsedDate = parseLocalDate(normalizedDate);

  if (!parsedDate) {
    return {
      expirationDate: normalizedDate || null,
      expired: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expirationDate = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );

  return {
    expirationDate: normalizedDate,
    expired: expirationDate < today,
  };
};

export const isMedicationExpired = (value) => getMedicationExpirationState(value).expired;

export const isDoseDateAfterExpiration = (scheduledDate, expirationDate) => (
  typeof scheduledDate === 'string'
  && datePattern.test(scheduledDate)
  && typeof expirationDate === 'string'
  && datePattern.test(expirationDate.trim())
  && scheduledDate > expirationDate.trim()
);

export const validateRefillAmount = (value) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return 'Refill amount is required.';
  }

  const isNumericString = typeof value === 'string'
    && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim());

  if ((typeof value !== 'number' && !isNumericString) || !Number.isFinite(Number(value))) {
    return 'Refill amount must be a number greater than 0.';
  }

  if (Number(value) <= 0) {
    return 'Refill amount must be greater than 0.';
  }

  return '';
};

export const getSafeUserErrorMessage = (error, fallback) => {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const genericError = /^(?:TypeError(?::|$)|Network request failed$|Failed to fetch$|fetch failed$|Unable to connect to the Med-Sked server\b)/i;
  const technicalError = /MongoServerError|MongooseError|stack trace|\bECONN[A-Z]+\b/i;

  if (!message || genericError.test(message) || technicalError.test(message)) {
    return fallback;
  }

  return message;
};

export const filterDoseRecordsByMedicationExpiration = (doses, medications) => {
  const medicationsById = new Map(
    (Array.isArray(medications) ? medications : []).map((medication) => [
      String(medication._id || medication.id),
      medication,
    ])
  );

  return (Array.isArray(doses) ? doses : []).filter((dose) => {
    const doseMedication = dose.medicationId;
    const medication = medicationsById.get(String(doseMedication?._id || doseMedication))
      || (typeof doseMedication === 'object' ? doseMedication : null);

    return !isDoseDateAfterExpiration(dose.scheduledDate, medication?.expirationDate);
  });
};
