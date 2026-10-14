const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/User');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const caregiverRoutes = require('../routes/caregiverRoutes');

const CAREGIVER_ID = '507f1f77bcf86cd799439010';

const invokeSearch = async ({ identifier, users, relationships = [], user = { role: 'caregiver', userId: CAREGIVER_ID } }) => {
  const route = caregiverRoutes.stack.find((item) => (
    item.route?.path === '/search-patient' && item.route.methods.get
  ));
  const handler = route.route.stack.at(-1).handle;
  const originals = {
    userFind: User.find,
    relationshipFindOne: CaregiverRelationship.findOne,
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
  let queryFilter;
  let resultLimit;

  User.find = (filter) => {
    queryFilter = filter;
    return {
      select() {
        return {
          async limit(limit) {
            resultLimit = limit;
            const matchesSearch = users.filter((candidate) => (
              candidate.role === filter.role &&
              filter.$or.some((condition) => {
                const [field, pattern] = Object.entries(condition)[0];
                return pattern.test(candidate[field] || '');
              })
            ));
            return matchesSearch.slice(0, limit);
          },
        };
      },
    };
  };
  CaregiverRelationship.findOne = async (filter) => relationships.find((relationship) => (
    relationship.caregiver === filter.caregiver &&
    relationship.patient === filter.patient
  )) || null;

  try {
    await handler(
      { user, query: { identifier } },
      response
    );
  } finally {
    User.find = originals.userFind;
    CaregiverRelationship.findOne = originals.relationshipFindOne;
  }

  return { response, queryFilter, resultLimit };
};

test('patient search finds case-insensitive partial ID, username, and email matches', async () => {
  const users = [
    { _id: 'patient-id', role: 'patient', patientId: 'ABC123', username: 'alpha', email: 'alpha@example.com' },
    { _id: 'patient-name', role: 'patient', patientId: 'XYZ987', username: 'Care Recipient', email: 'recipient@example.com' },
    { _id: 'patient-email', role: 'patient', patientId: 'QWE456', username: 'beta', email: 'Person@Example.com' },
    { _id: 'caregiver', role: 'caregiver', patientId: 'ABC999', username: 'Care Recipient', email: 'care@example.com' },
  ];

  for (const identifier of ['bc1', 'RECIP', 'PERSON@EXAMPLE']) {
    const { response, queryFilter } = await invokeSearch({ identifier, users });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.patients.length, 1);
    assert.equal(queryFilter.role, 'patient');
    assert.deepEqual(
      response.body.patients.map((match) => match.patient._id),
      [identifier.toLowerCase() === 'bc1' ? 'patient-id' : identifier.toLowerCase() === 'recip' ? 'patient-name' : 'patient-email']
    );
  }
});

test('patient search treats regex metacharacters as literal text', async () => {
  const users = [
    { _id: 'literal', role: 'patient', username: 'user+a', patientId: 'P1', email: 'literal@example.com' },
    { _id: 'regex', role: 'patient', username: 'useraa', patientId: 'P2', email: 'regex@example.com' },
  ];
  const { response } = await invokeSearch({ identifier: '+', users });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.patients.map((match) => match.patient._id), ['literal']);
});

test('patient search limits results and includes each existing relationship state', async () => {
  const users = Array.from({ length: 12 }, (_, index) => ({
    _id: `patient-${index}`,
    role: 'patient',
    username: `matching-${index}`,
    patientId: `ID-${index}`,
    email: `patient${index}@example.com`,
  }));
  const relationships = [
    { caregiver: CAREGIVER_ID, patient: 'patient-0', _id: 'relationship-active', status: 'active' },
    { caregiver: CAREGIVER_ID, patient: 'patient-1', _id: 'relationship-pending', status: 'pending' },
  ];
  const { response, resultLimit } = await invokeSearch({ identifier: 'matching', users, relationships });

  assert.equal(resultLimit, 10);
  assert.equal(response.body.patients.length, 10);
  assert.deepEqual(response.body.patients[0].relationship, { id: 'relationship-active', status: 'active' });
  assert.deepEqual(response.body.patients[1].relationship, { id: 'relationship-pending', status: 'pending' });
  assert.equal(response.body.patients[2].relationship, null);
});

test('single patient search preserves the existing patient and relationship response fields', async () => {
  const users = [
    { _id: 'patient-1', role: 'patient', username: 'someone', patientId: 'ID-1', email: 'person@example.com' },
  ];
  const { response } = await invokeSearch({ identifier: 'person@example.com', users });

  assert.equal(response.body.patient._id, 'patient-1');
  assert.equal(response.body.relationship, null);
});

test('patient search returns an empty result when there are no patient matches', async () => {
  const { response } = await invokeSearch({ identifier: 'unknown', users: [] });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.patients, []);
});

test('patient search rejects an empty search term', async () => {
  const { response, queryFilter } = await invokeSearch({ identifier: '  ', users: [] });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Patient ID, username, or email is required');
  assert.equal(queryFilter, undefined);
});

test('non-caregivers cannot search for patients', async () => {
  const { response } = await invokeSearch({
    identifier: 'patient',
    users: [],
    user: { role: 'patient', userId: 'patient-id' },
  });

  assert.equal(response.statusCode, 403);
});
