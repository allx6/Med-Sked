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

const validateMedicationFields = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Invalid medication payload';
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const dosage = typeof payload.dosage === 'string' ? payload.dosage.trim() : '';
  const frequency = typeof payload.frequency === 'string' ? payload.frequency.trim() : '';

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

module.exports = {
  isValidObjectId,
  containsMongoOperatorPayload,
  parsePositiveInteger,
  pickAllowedFields,
  validateSchedulePayload,
  validateMedicationFields,
};
