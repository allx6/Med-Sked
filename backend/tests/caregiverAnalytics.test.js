const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const analyticsRoutes = require('../routes/analyticsRoutes');

const handler = analyticsRoutes.stack.find(
  (item) => item.route?.path === '/adherence/caregiver-overview'
).route.stack.at(-1).handle;
const patientHandler = analyticsRoutes.stack.find(
  (item) => item.route?.path === '/adherence'
).route.stack.at(-1).handle;

const formatLocalDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const invokeAnalytics = async ({
  role = 'caregiver',
  relationships = [],
  stats = {},
  patientId = null,
} = {}) => {
  const originals = {
    relationshipFind: CaregiverRelationship.find,
    doseAggregate: DoseRecord.aggregate,
    scheduleAggregate: MedicationSchedule.aggregate,
  };
  let relationshipQuery;
  let dosePipeline;
  let schedulePipeline;
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 16);
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

  CaregiverRelationship.find = (query) => {
    relationshipQuery = query;
    return {
      select() {
        return {
          lean: async () => relationships.filter((relationship) => (
            String(relationship.caregiver) === String(query.caregiver)
            && relationship.status === query.status
          )),
        };
      },
    };
  };
  DoseRecord.aggregate = async (pipeline) => {
    dosePipeline = pipeline;
    return [stats];
  };
  MedicationSchedule.aggregate = async (pipeline) => {
    schedulePipeline = pipeline;
    return [];
  };

  try {
    const request = {
      user: { role, userId: '507f1f77bcf86cd799439010' },
      query: { startDate: formatLocalDate(startDate), endDate: formatLocalDate(today) },
      analyticsPatientId: patientId,
    };
    await (patientId ? patientHandler : handler)(request, response);
  } finally {
    CaregiverRelationship.find = originals.relationshipFind;
    DoseRecord.aggregate = originals.doseAggregate;
    MedicationSchedule.aggregate = originals.scheduleAggregate;
  }

  return { response, relationshipQuery, dosePipeline, schedulePipeline };
};

test('caregiver analytics aggregates outcomes for active authorized patients using the canonical calculation', async () => {
  const patientOne = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const patientTwo = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const inactivePatient = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');
  const otherCaregiverPatient = new mongoose.Types.ObjectId('507f1f77bcf86cd799439014');
  const caregiverId = '507f1f77bcf86cd799439010';
  const today = formatLocalDate(new Date());
  const eveningRecords = [
    { status: 'taken', scheduledDate: today, scheduledTime: '6:00 PM' },
    { status: 'taken', scheduledDate: today, scheduledTime: '18:00' },
    { status: 'skipped', scheduledDate: today, scheduledTime: '8:30 PM' },
    { status: 'pending', scheduledDate: today, scheduledTime: '6:00 PM' },
  ];
  const { response, relationshipQuery, dosePipeline } = await invokeAnalytics({
    relationships: [
      { caregiver: caregiverId, patient: patientOne, status: 'active' },
      { caregiver: caregiverId, patient: patientTwo, status: 'active' },
      { caregiver: caregiverId, patient: inactivePatient, status: 'revoked' },
      { caregiver: '507f1f77bcf86cd799439099', patient: otherCaregiverPatient, status: 'active' },
    ],
    stats: {
      records: [
        ...eveningRecords.map((record) => ({
          ...record,
          medicationId: { expirationDate: null },
        })),
      ],
      overall: [{ _id: 'taken', count: 2 }, { _id: 'skipped', count: 1 }],
      pending: [{ count: 1 }],
      timeOfDay: [
        { _id: { status: 'taken', scheduledTime: '6:00 PM' }, count: 1 },
        { _id: { status: 'taken', scheduledTime: '18:00' }, count: 1 },
        { _id: { status: 'skipped', scheduledTime: '8:30 PM' }, count: 1 },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(relationshipQuery, {
    caregiver: '507f1f77bcf86cd799439010',
    status: 'active',
  });
  assert.deepEqual(
    dosePipeline[0].$match.userId.$in.map(String),
    [String(patientOne), String(patientTwo)]
  );
  assert.ok(!dosePipeline[0].$match.userId.$in.map(String).includes(String(inactivePatient)));
  assert.ok(!dosePipeline[0].$match.userId.$in.map(String).includes(String(otherCaregiverPatient)));
  assert.equal(response.body.authorizedPatientCount, 2);
  assert.deepEqual(response.body.overall, {
    adherencePercentage: 67,
    totalEligible: 3,
    taken: 2,
    skipped: 1,
    missed: 0,
    pending: 1,
  });
  assert.equal(response.body.timeOfDay.evening.total, 3);
  assert.equal(response.body.timeOfDay.evening.taken, 2);
  assert.equal(response.body.timeOfDay.evening.skipped, 1);
  assert.equal(response.body.timeOfDay.evening.adherencePercentage, 67);
  assert.ok(dosePipeline[0].$match.scheduledDate.$gte < today);
});

test('caregiver analytics returns empty analytics when there are no active authorized patients', async () => {
  const { response, dosePipeline, schedulePipeline } = await invokeAnalytics();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.authorizedPatientCount, 0);
  assert.equal(response.body.overall.adherencePercentage, 0);
  assert.deepEqual(dosePipeline[0].$match.userId.$in, []);
  assert.deepEqual(schedulePipeline[0].$match.userId.$in, []);
  assert.equal(response.body.timeOfDay.evening.total, 0);
});

test('single-patient analytics uses the same canonical response calculation', async () => {
  const patientId = '507f1f77bcf86cd799439011';
  const today = formatLocalDate(new Date());
  const { response, dosePipeline } = await invokeAnalytics({
    patientId,
    role: 'caregiver',
    stats: {
      records: [
        { status: 'taken', scheduledDate: today, scheduledTime: '6:00 PM', medicationId: { expirationDate: null } },
        { status: 'missed', scheduledDate: today, scheduledTime: '18:00', medicationId: { expirationDate: null } },
      ],
      overall: [{ _id: 'taken', count: 1 }, { _id: 'missed', count: 1 }],
      pending: [],
      timeOfDay: [
        { _id: { status: 'taken', scheduledTime: '6:00 PM' }, count: 1 },
        { _id: { status: 'missed', scheduledTime: '18:00' }, count: 1 },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(dosePipeline[0].$match.userId.$in.map(String), [String(new mongoose.Types.ObjectId(patientId))]);
  assert.equal(response.body.overall.adherencePercentage, 50);
  assert.equal(response.body.timeOfDay.evening.total, 2);
  assert.equal(response.body.timeOfDay.evening.adherencePercentage, 50);
});

test('caregiver analytics rejects non-caregiver accounts', async () => {
  const { response } = await invokeAnalytics({ role: 'patient' });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'Caregiver access required');
});
