const mongoose = require('mongoose');

const isValidObjectId = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }

  if (typeof value !== 'string' && typeof value !== 'object') {
    return false;
  }

  return mongoose.Types.ObjectId.isValid(value);
};

const containsMongoOperatorPayload = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsMongoOperatorPayload(entry, seen));
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(value, '__proto__')
    || Object.prototype.hasOwnProperty.call(value, 'constructor')
    || Object.prototype.hasOwnProperty.call(value, 'prototype')) {
    return true;
  }

  const keys = Object.keys(value);

  for (const key of keys) {
    if (key.startsWith('$')) {
      return true;
    }
  }

  return Object.values(value).some((entry) => containsMongoOperatorPayload(entry, seen));
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const pickAllowedFields = (input, allowedFields) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  if (containsMongoOperatorPayload(input)) {
    return null;
  }

  const unknownFields = Object.keys(input).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    return null;
  }

  const pick = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      pick[field] = input[field];
    }
  }

  return pick;
};

const validateSchedulePayload = (payload) => {
  if (containsMongoOperatorPayload(payload)) {
    return null;
  }

  const allowedFields = [
    'medicationId',
    'time',
    'dose',
    'days',
    'startDate',
    'endDate',
    'enabled',
  ];

  const filtered = pickAllowedFields(payload, allowedFields);

  if (!filtered) {
    return null;
  }

  return filtered;
};

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const normalizeDecimalString = (value) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return '';
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  const normalized = numeric.toString();
  return normalized.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

const normalizeMedicationName = (value) => normalizeWhitespace(value).toLowerCase();

const normalizeMedicationDosage = (value) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return '';
  }

  const dosageMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i);
  if (!dosageMatch) {
    return trimmed.toLowerCase();
  }

  return `${normalizeDecimalString(dosageMatch[1])}${dosageMatch[2].toLowerCase()}`;
};

const buildNormalizedMedicationKey = (name, dosage) => {
  const normalizedName = normalizeMedicationName(name);
  const normalizedDosage = normalizeMedicationDosage(dosage);

  if (!normalizedName || !normalizedDosage) {
    return null;
  }

  return `${normalizedName}|${normalizedDosage}`;
};

const validateMedicationExpirationDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return 'Expiration date must be a valid YYYY-MM-DD date.';
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'Expiration date must be a valid YYYY-MM-DD date.';
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return 'Expiration date must be a valid YYYY-MM-DD date.';
  }

  return null;
};

const requireMedicationExpirationDate = (value) => {
  if (value === undefined || value === null || typeof value !== 'string' || value.trim() === '') {
    return 'Expiration date is required.';
  }

  return validateMedicationExpirationDate(value);
};

const validateMedicationFields = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Invalid medication payload';
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const dosage = typeof payload.dosage === 'string' ? payload.dosage.trim() : '';
  const frequency = typeof payload.frequency === 'string' ? payload.frequency.trim() : '';
  const expirationDateError = requireMedicationExpirationDate(payload.expirationDate);

  if (expirationDateError) {
    return expirationDateError;
  }

  if (name.length < 2) {
    return 'Medication name must contain at least 2 characters.';
  }

  const dosageMatch = dosage.match(/^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i);
  if (!dosageMatch || Number(dosageMatch[1]) <= 0) {
    return 'Dosage must be a number greater than 0.';
  }

  const frequencyMatch = frequency.match(/^Every\s+([0-9]+(?:\.[0-9]+)?)\s+(hours|days)$/i);
  if (!frequencyMatch || Number(frequencyMatch[1]) < 1) {
    return 'Frequency must be at least 1 hour or day.';
  }

  return null;
};

const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTodayDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const validateScheduleFields = (payload, {
  allowPastStartDate = false,
  medicationExpirationDate,
  rejectExpiredMedication = false,
  validateStartDateExpiration = true,
  validateEndDateExpiration = true,
} = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Invalid schedule payload';
  }

  const validDays = new Set([
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]);
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!isValidObjectId(payload.medicationId)) {
    return 'A valid medication is required.';
  }

  if (typeof payload.time !== 'string' || !timePattern.test(payload.time.trim())) {
    return 'Time must use HH:mm format.';
  }

  if (payload.dose !== undefined && (typeof payload.dose !== 'string' || !payload.dose.trim())) {
    return 'Dose is required.';
  }

  if (!Array.isArray(payload.days) || payload.days.length === 0) {
    return 'At least one day must be selected.';
  }

  if (new Set(payload.days).size !== payload.days.length
    || payload.days.some((day) => typeof day !== 'string' || !validDays.has(day))) {
    return 'Schedule contains an invalid day.';
  }

  if (typeof payload.startDate !== 'string' || !datePattern.test(payload.startDate)
    || Number.isNaN(parseLocalDate(payload.startDate).getTime())) {
    return 'Start date must be a valid YYYY-MM-DD date.';
  }

  const startDate = parseLocalDate(payload.startDate);
  if (!allowPastStartDate && startDate < getTodayDate()) {
    return 'Start date cannot be earlier than today.';
  }

  const hasMedicationExpiration = validateMedicationExpirationDate(medicationExpirationDate) === null
    && typeof medicationExpirationDate === 'string'
    && medicationExpirationDate.trim() !== '';

  if (hasMedicationExpiration && rejectExpiredMedication
    && medicationExpirationDate < getTodayDateString()) {
    return `Cannot create a schedule for an expired medication. This medication expired on ${medicationExpirationDate}.`;
  }

  if (hasMedicationExpiration && validateStartDateExpiration
    && payload.startDate > medicationExpirationDate) {
    return 'Schedule start date cannot be after the medication expiration date.';
  }

  if (hasMedicationExpiration && (payload.endDate === null
    || payload.endDate === undefined
    || (typeof payload.endDate === 'string' && payload.endDate.trim() === ''))) {
    return 'End date is required because this medication has an expiration date.';
  }

  if (payload.endDate !== null && payload.endDate !== undefined
    && (typeof payload.endDate !== 'string' || !datePattern.test(payload.endDate)
      || Number.isNaN(parseLocalDate(payload.endDate).getTime()))) {
    return 'End date must be a valid YYYY-MM-DD date.';
  }

  if (payload.endDate && parseLocalDate(payload.endDate) < getTodayDate()) {
    return 'End date cannot be earlier than today.';
  }

  if (payload.endDate && parseLocalDate(payload.endDate) < startDate) {
    return 'Schedule end date cannot be before the schedule start date.';
  }

  if (hasMedicationExpiration) {
    if (validateEndDateExpiration && payload.endDate && payload.endDate > medicationExpirationDate) {
      return 'Schedule end date cannot be after the medication expiration date.';
    }
  }

  if (payload.enabled !== undefined && typeof payload.enabled !== 'boolean') {
    return 'Enabled must be a boolean.';
  }

  return null;
};

const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day) {
    return new Date(NaN);
  }

  return date;
};

module.exports = {
  isValidObjectId,
  containsMongoOperatorPayload,
  parsePositiveInteger,
  pickAllowedFields,
  validateSchedulePayload,
  validateMedicationFields,
  validateMedicationExpirationDate,
  requireMedicationExpirationDate,
  buildNormalizedMedicationKey,
  validateScheduleFields,
};
