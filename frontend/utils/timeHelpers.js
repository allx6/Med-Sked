export const parse24HourTime = (value, fallback = {}) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  const fallbackHour = fallback.hour || 8;
  const fallbackMinute = fallback.minute || 0;
  const fallbackPeriod = fallback.period || 'AM';

  if (!match) {
    return {
      hour: fallbackHour,
      minute: fallbackMinute,
      period: fallbackPeriod,
    };
  }

  const hours24 = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours24 < 0 || hours24 > 23 || minutes < 0 || minutes > 59) {
    return {
      hour: fallbackHour,
      minute: fallbackMinute,
      period: fallbackPeriod,
    };
  }

  return {
    hour: hours24 % 12 || 12,
    minute: minutes,
    period: hours24 >= 12 ? 'PM' : 'AM',
  };
};

export const to24HourTime = (hour, minute, period) => {
  let hours24 = Number(hour) % 12;

  if (period === 'PM') {
    hours24 += 12;
  }

  return `${String(hours24).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
};

export const format12HourTime = (hour, minute, period) => (
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`
);
