const MEDICATION_TIME_ZONE = 'Asia/Manila';

const localDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MEDICATION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getMedicationLocalParts = (date) => {
  const parts = Object.fromEntries(
    localDateTimeFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: date.getUTCMilliseconds(),
  };
};

const formatMedicationLocalDate = (date) => {
  const { year, month, day } = getMedicationLocalParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const formatMedicationLocalTime = (date) => {
  const { hour, minute } = getMedicationLocalParts(date);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

const toWallClockTimestamp = ({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
}) => {
  const timestamp = new Date(0);
  timestamp.setUTCFullYear(year, month - 1, day);
  timestamp.setUTCHours(hour, minute, second, millisecond);
  return timestamp;
};

const parseScheduledDateTime = (scheduledDate, scheduledTime) => {
  const dateMatch = String(scheduledDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const normalizedTime = String(scheduledTime || '').trim();
  const twelveHourMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHourMatch = normalizedTime.match(/^(\d{2}):(\d{2})$/);

  if (!dateMatch || (!twelveHourMatch && !twentyFourHourMatch)) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  let hour = Number((twelveHourMatch || twentyFourHourMatch)[1]);
  const minute = Number((twelveHourMatch || twentyFourHourMatch)[2]);

  if (
    minute > 59
    || (twelveHourMatch && (hour < 1 || hour > 12))
    || (twentyFourHourMatch && hour > 23)
  ) {
    return null;
  }

  if (twelveHourMatch) {
    const period = twelveHourMatch[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
  }

  const scheduledAt = toWallClockTimestamp({ year, month, day, hour, minute });
  if (
    scheduledAt.getUTCFullYear() !== year
    || scheduledAt.getUTCMonth() !== month - 1
    || scheduledAt.getUTCDate() !== day
  ) {
    return null;
  }
  return scheduledAt;
};

module.exports = {
  MEDICATION_TIME_ZONE,
  formatMedicationLocalDate,
  formatMedicationLocalTime,
  getMedicationLocalParts,
  parseScheduledDateTime,
  toWallClockTimestamp,
};
