const test = require('node:test');
const assert = require('node:assert/strict');
const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const analyticsRoutes = require('../routes/analyticsRoutes');

test('adherence analytics applies expiration filters to records and active complexity', async () => {
  const layer = analyticsRoutes.stack.find((item) => item.route?.path === '/adherence');
  const handler = layer.route.stack.at(-1).handle;
  const originals = {
    doseAggregate: DoseRecord.aggregate,
    scheduleAggregate: MedicationSchedule.aggregate,
  };
  let dosePipeline;
  let schedulePipeline;
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

  DoseRecord.aggregate = async (pipeline) => {
    dosePipeline = pipeline;
    return [{
      overall: [{ _id: 'taken', count: 1 }],
      pending: [{ count: 1 }],
      timeOfDay: [],
    }];
  };
  MedicationSchedule.aggregate = async (pipeline) => {
    schedulePipeline = pipeline;
    return [];
  };

  try {
    await handler({
      analyticsPatientId: '507f1f77bcf86cd799439011',
      query: { startDate: '2026-10-01', endDate: '2026-10-10' },
    }, response);
  } finally {
    DoseRecord.aggregate = originals.doseAggregate;
    MedicationSchedule.aggregate = originals.scheduleAggregate;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.overall.taken, 1);
  assert.equal(response.body.overall.pending, 1);

  assert.ok(dosePipeline.some((stage) => stage.$lookup?.from === 'medications'));
  assert.ok(dosePipeline.some((stage) => (
    stage.$match?.$or?.some((condition) => (
      condition.$expr?.$lte?.[0] === '$scheduledDate'
      && condition.$expr?.$lte?.[1] === '$medication.expirationDate'
    ))
  )));

  assert.ok(schedulePipeline.some((stage) => stage.$lookup?.from === 'medications'));
  assert.ok(schedulePipeline.some((stage) => (
    stage.$match?.$or?.some((condition) => (
      condition.$expr?.$gte?.[0] === '$medication.expirationDate'
    ))
  )));
});