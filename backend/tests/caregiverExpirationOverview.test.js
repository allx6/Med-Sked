const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const DoseRecord = require('../models/DoseRecord');

const doseGeneratorPath = require.resolve('../services/doseGenerator');
const originalDoseGenerator = require.cache[doseGeneratorPath];
require.cache[doseGeneratorPath] = {
  id: doseGeneratorPath,
  filename: doseGeneratorPath,
  loaded: true,
  exports: { generateTodayDoses: async () => ({ created: 0 }) },
};
const caregiverRoutes = require('../routes/caregiverRoutes');
if (originalDoseGenerator) {
  require.cache[doseGeneratorPath] = originalDoseGenerator;
} else {
  delete require.cache[doseGeneratorPath];
}

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const invokeOverview = async (medications, doses) => {
  const layer = caregiverRoutes.stack.find((item) => (
    item.route?.path === '/patients/:patientId/overview'
  ));
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    userFindOne: User.findOne,
    medicationFind: Medication.find,
    scheduleFind: MedicationSchedule.find,
    doseFind: DoseRecord.find,
  };
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  User.findOne = () => ({ select: async () => ({ _id: 'patient-id', username: 'Patient' }) });
  Medication.find = () => ({ sort: async () => medications });
  MedicationSchedule.find = () => ({
    populate() {
      return this;
    },
    sort: async () => [],
  });
  DoseRecord.find = () => ({
    populate() {
      return this;
    },
    sort: async () => doses,
  });

  try {
    await handler({
      params: { patientId: 'patient-id' },
      user: { role: 'caregiver', userId: 'caregiver-id' },
      caregiverRelationship: { permission: 'VIEW_ONLY' },
    }, response);
  } finally {
    User.findOne = originals.userFindOne;
    Medication.find = originals.medicationFind;
    MedicationSchedule.find = originals.scheduleFind;
    DoseRecord.find = originals.doseFind;
  }

  return response;
};

test('caregiver overview filters post-expiration current doses but preserves history', async () => {
  const today = formatLocalDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatLocalDate(yesterdayDate);
  const medications = [
    { _id: 'expired-medication', expirationDate: yesterday },
    { _id: 'valid-medication', expirationDate: today },
  ];
  const doses = [
    {
      _id: 'post-expiration-dose',
      scheduledDate: today,
      scheduledTime: '8:00 AM',
      status: 'missed',
      medicationId: { _id: 'expired-medication', name: 'Expired medication' },
    },
    {
      _id: 'expiration-day-dose',
      scheduledDate: today,
      scheduledTime: '9:00 AM',
      status: 'pending',
      medicationId: { _id: 'valid-medication', name: 'Valid today' },
    },
  ];

  const response = await invokeOverview(medications, doses);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.todayDoses.map((dose) => dose._id), ['expiration-day-dose']);
  assert.equal(response.body.adherence.total, 1);
  assert.equal(response.body.adherence.missed, 0);
  assert.equal(response.body.doses.length, 2);
});