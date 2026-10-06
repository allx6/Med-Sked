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

const isValidLocalDate = (value) => {
  if (!datePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
};

const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTodayDateString = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

export const parseLocalDate = (value) => {
  if (!isValidLocalDate(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const validateScheduleFields = (schedule, {
  allowPastStartDate = false,
  medicationExpirationDate,
  rejectExpiredMedication = false,
  validateStartDateExpiration = true,
  validateEndDateExpiration = true,
} = {}) => {
  if (!schedule?.medicationId) {
    return 'Medication is required.';
  }

  if (typeof schedule.time !== 'string' || !schedule.time.trim()) {
    return 'Scheduled time is required.';
  }

  if (!timePattern.test(schedule.time.trim())) {
    return 'Please select a valid medication time.';
  }

  if (typeof schedule.dose !== 'string' || !schedule.dose.trim()) {
    return 'Please enter the medication dose.';
  }

  if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
    return 'Please select at least one day.';
  }

  if (new Set(schedule.days).size !== schedule.days.length
    || schedule.days.some((day) => !validDays.has(day))) {
    return 'Please select valid schedule days.';
  }

  if (schedule.startDate === undefined || schedule.startDate === null || schedule.startDate === '') {
    return 'Start date is required.';
  }

  if (!isValidLocalDate(schedule.startDate)) {
    return 'Start date must be a valid date.';
  }

  if (!allowPastStartDate && parseLocalDate(schedule.startDate) < getTodayDate()) {
    return 'Start date cannot be earlier than today.';
  }

  if (isValidLocalDate(medicationExpirationDate)) {
    if (rejectExpiredMedication && medicationExpirationDate < getTodayDateString()) {
      return `Cannot create a schedule for an expired medication. This medication expired on ${medicationExpirationDate}.`;
    }

    if (validateStartDateExpiration && schedule.startDate > medicationExpirationDate) {
      return 'Schedule start date cannot be after the medication expiration date.';
    }

    if (schedule.endDate === null || schedule.endDate === undefined
      || (typeof schedule.endDate === 'string' && schedule.endDate.trim() === '')) {
      return 'End date is required because this medication has an expiration date.';
    }
  }

  if (schedule.endDate !== null && schedule.endDate !== undefined
    && !isValidLocalDate(schedule.endDate)) {
    return 'End date must be a valid date.';
  }

  if (schedule.endDate && parseLocalDate(schedule.endDate) < getTodayDate()) {
    return 'End date cannot be earlier than today.';
  }

  if (schedule.endDate && parseLocalDate(schedule.endDate) < parseLocalDate(schedule.startDate)) {
    return 'Schedule end date cannot be before the schedule start date.';
  }

  if (isValidLocalDate(medicationExpirationDate)) {
    if (validateEndDateExpiration && schedule.endDate && schedule.endDate > medicationExpirationDate) {
      return 'Schedule end date cannot be after the medication expiration date.';
    }
  }

  if (typeof schedule.enabled !== 'boolean') {
    return 'Schedule enabled state is invalid.';
  }

  return '';
};

export const getScheduleSubmissionErrorMessage = (error) => {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const genericError = /^(?:TypeError:|Network request failed$|Failed to fetch$|fetch failed$|Unable to connect to the Med-Sked server\b|Failed to process schedule request\b|Request failed with status \d+)/i;
  const technicalError = /MongoServerError|MongooseError|stack trace|\bECONN[A-Z]+\b/i;

  if (!message || genericError.test(message) || technicalError.test(message)) {
    return 'Unable to save the schedule. Please check your connection and try again.';
  }

  return message;
};
