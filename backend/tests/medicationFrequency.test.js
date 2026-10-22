const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFrequencyConfigFromText,
  getMedicationFrequencyConfig,
} = require('../utils/medicationFrequency');

test('explicit Every N unit instructions are stored as interval configuration', () => {
  assert.deepEqual(getFrequencyConfigFromText('Every 8 hours'), {
    frequencyType: 'interval',
    frequencyIntervalMinutes: 480,
  });
  assert.deepEqual(getFrequencyConfigFromText('Every 30 minutes'), {
    frequencyType: 'interval',
    frequencyIntervalMinutes: 30,
  });
});

test('non-interval legacy instructions remain one fixed-time schedule', () => {
  assert.deepEqual(getFrequencyConfigFromText('Twice daily'), {
    frequencyType: 'fixed_time',
    frequencyIntervalMinutes: null,
  });
  assert.deepEqual(
    getMedicationFrequencyConfig({ frequency: 'Twice daily' }),
    { type: 'fixed_time', intervalMinutes: null }
  );
});

test('legacy explicit interval text remains compatible and structured values take priority', () => {
  assert.deepEqual(
    getMedicationFrequencyConfig({ frequency: 'Every 8 hours' }),
    { type: 'interval', intervalMinutes: 480 }
  );
  assert.deepEqual(
    getMedicationFrequencyConfig({
      frequency: 'Every 8 hours',
      frequencyType: 'fixed_time',
      frequencyIntervalMinutes: null,
    }),
    { type: 'fixed_time', intervalMinutes: null }
  );
  assert.throws(
    () => getMedicationFrequencyConfig({
      frequency: 'Daily',
      frequencyType: 'interval',
      frequencyIntervalMinutes: null,
    }),
    /configuration is invalid/
  );
});
