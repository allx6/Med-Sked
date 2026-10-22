const TIME_ZONE = 'Asia/Manila';

const getManilaWallTime = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

const getDoseDueWallTime = (dose) => {
  if (dose?.effectiveDueAt) {
    const effectiveDueAt = new Date(dose.effectiveDueAt);
    if (!Number.isNaN(effectiveDueAt.getTime())) {
      return effectiveDueAt.getTime();
    }
  }

  const match = String(dose?.scheduledDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(dose?.scheduledTime || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const militaryTimeMatch = String(dose?.scheduledTime || '')
    .trim()
    .match(/^(\d{2}):(\d{2})$/);
  if (!match || (!timeMatch && !militaryTimeMatch)) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let hour = Number((timeMatch || militaryTimeMatch)[1]);
  const minute = Number((timeMatch || militaryTimeMatch)[2]);
  if (minute > 59 || (militaryTimeMatch && hour > 23)) return null;
  if (timeMatch) {
    if (hour < 1 || hour > 12) return null;
    if (timeMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    if (timeMatch[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  }
  return Date.UTC(year, month - 1, day, hour, minute);
};

const formatWallTime = (timestamp) => {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  return `${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getDoseDueDisplay = (dose) => {
  const due = getDoseDueWallTime(dose);
  if (due === null) return {
    date: dose?.scheduledDate || '',
    time: dose?.scheduledTime || 'Time not specified',
  };
  const date = new Date(due);
  const dateText = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const original = getDoseDueWallTime({
    scheduledDate: dose?.scheduledDate,
    scheduledTime: dose?.scheduledTime,
  });
  return {
    date: dateText,
    time: formatWallTime(due),
    adjusted: original !== null && original !== due,
  };
};

const isDoseDue = (dose, now = new Date()) => {
  const due = getDoseDueWallTime(dose);
  return due === null || getManilaWallTime(now) >= due;
};

const isIntervalFrequency = (frequencyOrMedication) => {
  if (
    frequencyOrMedication
    && typeof frequencyOrMedication === 'object'
    && ['fixed_time', 'interval'].includes(frequencyOrMedication.frequencyType)
  ) {
    return frequencyOrMedication.frequencyType === 'interval';
  }
  const frequency = typeof frequencyOrMedication === 'string'
    ? frequencyOrMedication
    : frequencyOrMedication?.frequency;
  return typeof frequency === 'string'
    && /\d+(?:\.\d+)?\s*(?:minutes?|hours?|days?)/i.test(frequency);
};

const formatActualTakenAt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export {
  formatActualTakenAt,
  getDoseDueDisplay,
  isDoseDue,
  isIntervalFrequency,
};
