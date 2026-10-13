const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');

const notificationServicePath = require.resolve('../services/notificationService');
const originalNotificationService = require.cache[notificationServicePath];
require.cache[notificationServicePath] = {
  id: notificationServicePath,
  filename: notificationServicePath,
  loaded: true,
  exports: {
    createMedicationNotifications: async () => true,
  },
};

const { detectMissedDoses } = require('../services/missedDoseService');
const doseRoutesPath = require.resolve('../routes/doseRoutes');
delete require.cache[doseRoutesPath];
const doseRoutes = require('../routes/doseRoutes');

if (originalNotificationService) {
  require.cache[notificationServicePath] = originalNotificationService;
} else {
  delete require.cache[notificationServicePath];
}

const USER_ID = '507f1f77bcf86cd799439012';

const createDose = (scheduledDate, scheduledTime, status = 'pending') => ({
  _id: `${scheduledDate}-${scheduledTime}-${status}`,
  userId: USER_ID,
  scheduledDate,
  scheduledTime,
  status,
  medicationId: { name: 'Cetirizine', expirationDate: null },
});

const withDoseModelStubs = async (doses, callback) => {
  const originals = {
    doseFind: DoseRecord.find,
    doseFindOneAndUpdate: DoseRecord.findOneAndUpdate,
    scheduleFind: MedicationSchedule.find,
  };
  const queries = [];

  MedicationSchedule.find = () => ({
    lean: async () => [],
  });
  DoseRecord.find = (query) => {
    queries.push(query);
    const results = doses.filter((dose) => (
      (!query.status || dose.status === query.status)
      && (!query.userId || dose.userId === query.userId)
    ));
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      lean: async () => results,
      then(resolve, reject) {
        return Promise.resolve(results).then(resolve, reject);
      },
    };
  };
  DoseRecord.findOneAndUpdate = (filter, update) => ({
    lean: async () => {
      const dose = doses.find((item) => (
        item._id === filter._id && item.status === filter.status
      ));
      if (!dose) {
        return null;
      }

      Object.assign(dose, update.$set);
      return { ...dose };
    },
  });

  try {
    return await callback(queries);
  } finally {
    DoseRecord.find = originals.doseFind;
    DoseRecord.findOneAndUpdate = originals.doseFindOneAndUpdate;
    MedicationSchedule.find = originals.scheduleFind;
  }
};

const detectAt = async (dose, now) => withDoseModelStubs([dose], (queries) => (
  detectMissedDoses(now, USER_ID).then((result) => ({ dose, queries, result }))
));

test('past-date pending doses are marked missed', async () => {
  const dose = createDose('2026-10-10', '7:00 PM');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 15, 0));

  assert.equal(result.markedMissed, 1);
  assert.equal(dose.status, 'missed');
});

test('past-date taken doses remain taken', async () => {
  const dose = createDose('2026-10-10', '7:00 PM', 'taken');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 15, 0));

  assert.equal(result.markedMissed, 0);
  assert.equal(dose.status, 'taken');
});

test('past-date skipped doses remain skipped', async () => {
  const dose = createDose('2026-10-10', '7:00 PM', 'skipped');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 15, 0));

  assert.equal(result.markedMissed, 0);
  assert.equal(dose.status, 'skipped');
});

test('today pending doses scheduled later remain pending', async () => {
  const dose = createDose('2026-10-13', '7:00 PM');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 18, 59));

  assert.equal(result.markedMissed, 0);
  assert.equal(dose.status, 'pending');
});

test('today pending doses become missed after the scheduled time', async () => {
  const dose = createDose('2026-10-13', '7:00 PM');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 19, 1));

  assert.equal(result.markedMissed, 1);
  assert.equal(dose.status, 'missed');
});

test('future pending doses remain pending', async () => {
  const dose = createDose('2026-10-14', '7:00 PM');
  const { result } = await detectAt(dose, new Date(2026, 9, 13, 20, 0));

  assert.equal(result.markedMissed, 0);
  assert.equal(dose.status, 'pending');
});

test('GET /api/doses marks past pending records missed before returning history', async () => {
  const dose = createDose('2026-10-10', '7:00 PM');
  await withDoseModelStubs([dose], async (queries) => {
    const layer = doseRoutes.stack.find((item) => (
      item.route?.path === '/' && item.route.methods.get
    ));
    const handler = layer.route.stack.at(-1).handle;
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

    await handler({ user: { userId: USER_ID } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body[0].status, 'missed');
    assert.deepEqual(queries[0], { status: 'pending', userId: USER_ID });
    assert.deepEqual(queries[1], { userId: USER_ID });
  });
});
