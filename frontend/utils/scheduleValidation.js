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

export const parseLocalDate = (value) => {
  if (!isValidLocalDate(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const validateScheduleFields = (schedule) => {
  if (!schedule?.medicationId) {
    return 'Please select a medication.';
  }

  if (typeof schedule.time !== 'string' || !timePattern.test(schedule.time.trim())) {
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

  if (!isValidLocalDate(schedule.startDate)) {
    return 'Please select a valid start date.';
  }

  if (parseLocalDate(schedule.startDate) < getTodayDate()) {
    return 'Start date cannot be earlier than today.';
  }

  if (schedule.endDate !== null && schedule.endDate !== undefined
    && !isValidLocalDate(schedule.endDate)) {
    return 'Please select a valid end date.';
  }

  if (schedule.endDate && parseLocalDate(schedule.endDate) < getTodayDate()) {
    return 'End date cannot be earlier than today.';
  }

  if (schedule.endDate && parseLocalDate(schedule.endDate) < parseLocalDate(schedule.startDate)) {
    return 'End date cannot be before the start date.';
  }

  if (typeof schedule.enabled !== 'boolean') {
    return 'Schedule enabled state is invalid.';
  }

  return '';
};
