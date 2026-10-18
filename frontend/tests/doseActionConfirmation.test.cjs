const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screensPath = path.resolve(__dirname, '..', 'screens');
const readScreen = (name) => fs.readFileSync(path.join(screensPath, name), 'utf8');

test('patient dashboard confirms both take and skip before using existing dose APIs', () => {
  const dashboard = readScreen('DashboardScreen.js');

  assert.match(dashboard, /requestDoseAction\(dose\._id, 'take'\)/);
  assert.match(dashboard, /requestDoseAction\(dose\._id, 'skip'\)/);
  assert.match(dashboard, /visible=\{Boolean\(pendingDoseAction\)\}/);
  assert.match(dashboard, /current\.action === 'take' \? takeDose : skipDose/);
  assert.match(dashboard, /actionRequest\(token, current\.doseId\)/);
  assert.match(dashboard, /setPendingDoseAction\(null\)/);
  assert.doesNotMatch(dashboard, /getDoseActionErrorMessage/);
});

test('caregiver today-dose actions stay permission-gated and require confirmation', () => {
  const monitoring = readScreen('PatientMonitoringScreen.js');

  assert.match(monitoring, /canSupportAdherence && dose\.status === 'pending'/);
  assert.match(monitoring, /action: 'take',\s+type: 'dose'/);
  assert.match(monitoring, /action: 'skip',\s+type: 'dose'/);
  assert.match(monitoring, /visible=\{Boolean\(confirmation\)\}/);
  assert.match(monitoring, /await takePatientDose\(token, doseId, patient\?\._id\)/);
  assert.match(monitoring, /await skipPatientDose\(token, doseId, patient\?\._id\)/);
  assert.doesNotMatch(monitoring, /getDoseActionErrorMessage/);
});
