const parseIntervalFrequencyMinutes = (frequency) => {
  if (typeof frequency !== 'string') return null;
  const match = frequency.trim().match(/(\d+(?:\.\d+)?)\s*(minutes?|hours?|days?)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!(amount > 0)) return null;

  const unit = match[2].toLowerCase();
  if (unit.startsWith('minute')) return amount;
  if (unit.startsWith('hour')) return amount * 60;
  if (unit.startsWith('day')) return amount * 24 * 60;
  return null;
};

const getMedicationFrequencyConfig = (medication = {}) => {
  medication = medication || {};
  if (medication.frequencyType === 'fixed_time') {
    return { type: 'fixed_time', intervalMinutes: null };
  }

  if (medication.frequencyType === 'interval') {
    const intervalMinutes = Number(medication.frequencyIntervalMinutes);
    if (Number.isFinite(intervalMinutes) && intervalMinutes > 0) {
      return { type: 'interval', intervalMinutes };
    }
    throw new Error('Medication interval configuration is invalid.');
  }

  const intervalMinutes = parseIntervalFrequencyMinutes(medication.frequency);
  return intervalMinutes
    ? { type: 'interval', intervalMinutes }
    : { type: 'fixed_time', intervalMinutes: null };
};

const getFrequencyConfigFromText = (frequency) => {
  const intervalMinutes = parseIntervalFrequencyMinutes(frequency);
  return intervalMinutes
    ? { frequencyType: 'interval', frequencyIntervalMinutes: intervalMinutes }
    : { frequencyType: 'fixed_time', frequencyIntervalMinutes: null };
};

module.exports = {
  getFrequencyConfigFromText,
  getMedicationFrequencyConfig,
  parseIntervalFrequencyMinutes,
};
