const test = require('node:test');
const assert = require('node:assert/strict');

const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');
const DoseRecord = require('../models/DoseRecord');
const doseRoutes = require('../routes/doseRoutes');

const CAREGIVER_ID = '507f1f77bcf86cd799439010';
const PATIENT_ID = '507f1f77bcf86cd799439011';
const DOSE_ID = '507f1f77bcf86cd799439012';

const invokeDelete = async ({
  relationship,
  existingDose = null,
  deletedDose = null,
  patientActive = true,
  user = { role: 'caregiver', userId: CAREGIVER_ID },
  body = { patientId: PATIENT_ID },
}) => {
  const route = doseRoutes.stack.find((item) => (
    item.route?.path === '/:id' && item.route.methods.delete
  ));
  const middleware = route.route.stack[1].handle;
  const handler = route.route.stack.at(-1).handle;
  const originals = {
    relationshipFindOne: CaregiverRelationship.findOne,
    patientFindOne: User.findOne,
    doseFindOneAndDelete: DoseRecord.findOneAndDelete,
    doseFindOne: DoseRecord.findOne,
  };
  let deleteFilter;
  let findFilter;
  let relationshipFilter;
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

  CaregiverRelationship.findOne = async (filter) => {
    relationshipFilter = filter;
    return relationship;
  };
  User.findOne = (filter) => ({
    select: async () => (patientActive ? { _id: filter._id } : null),
  });
  DoseRecord.findOneAndDelete = async (filter) => {
    deleteFilter = filter;
    return deletedDose;
  };
  DoseRecord.findOne = async (filter) => {
    findFilter = filter;
    return existingDose;
  };

  try {
    const request = {
      user,
      params: { id: DOSE_ID },
      body,
    };

    await middleware(request, response, () => handler(request, response));
  } finally {
    CaregiverRelationship.findOne = originals.relationshipFindOne;
    User.findOne = originals.patientFindOne;
    DoseRecord.findOneAndDelete = originals.doseFindOneAndDelete;
    DoseRecord.findOne = originals.doseFindOne;
  }

  return { response, deleteFilter, findFilter, relationshipFilter };
};

test('ADHERENCE_SUPPORT caregiver deletes only a pending dose for the related patient', async () => {
  const { response, deleteFilter, relationshipFilter } = await invokeDelete({
    relationship: { permission: 'ADHERENCE_SUPPORT' },
    deletedDose: { _id: DOSE_ID, status: 'pending' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(deleteFilter._id, DOSE_ID);
  assert.equal(deleteFilter.userId, PATIENT_ID);
  assert.equal(deleteFilter.status, 'pending');
  assert.equal(relationshipFilter.caregiver, CAREGIVER_ID);
  assert.equal(relationshipFilter.patient, PATIENT_ID);
  assert.equal(relationshipFilter.status, 'active');
});

test('caregiver cannot delete a dose without an active patient relationship', async () => {
  let deleteCalled = false;
  const originals = DoseRecord.findOneAndDelete;
  DoseRecord.findOneAndDelete = async () => {
    deleteCalled = true;
    return null;
  };

  try {
    const { response } = await invokeDelete({ relationship: null });
    assert.equal(response.statusCode, 403);
    assert.equal(deleteCalled, false);
  } finally {
    DoseRecord.findOneAndDelete = originals;
  }
});

test('VIEW_ONLY caregiver cannot delete a patient dose', async () => {
  const { response, deleteFilter } = await invokeDelete({
    relationship: { permission: 'VIEW_ONLY' },
  });

  test('caregiver cannot access a deactivated patient', async () => {
    const { response, deleteFilter } = await invokeDelete({
      relationship: { permission: 'ADHERENCE_SUPPORT' },
      patientActive: false,
    });
    assert.equal(response.statusCode, 403);
    assert.equal(deleteFilter, undefined);
  });

  assert.equal(response.statusCode, 403);
  assert.equal(deleteFilter, undefined);
});

test('caregiver cannot delete a non-pending dose record', async () => {
  const { response, deleteFilter, findFilter } = await invokeDelete({
    relationship: { permission: 'ADHERENCE_SUPPORT' },
    existingDose: { _id: DOSE_ID, status: 'taken' },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(deleteFilter.status, 'pending');
  assert.equal(findFilter.userId, PATIENT_ID);
});

test('patient pending-dose deletion remains scoped to the authenticated patient', async () => {
  const route = doseRoutes.stack.find((item) => (
    item.route?.path === '/:id' && item.route.methods.delete
  ));
  const handler = route.route.stack.at(-1).handle;
  const originalFindOneAndDelete = DoseRecord.findOneAndDelete;
  let deleteFilter;
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  DoseRecord.findOneAndDelete = async (filter) => {
    deleteFilter = filter;
    return { _id: DOSE_ID, status: 'pending' };
  };

  try {
    await handler({
      user: { role: 'patient', userId: PATIENT_ID },
      params: { id: DOSE_ID },
      body: {},
    }, response);
  } finally {
    DoseRecord.findOneAndDelete = originalFindOneAndDelete;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(deleteFilter.userId, PATIENT_ID);
  assert.equal(deleteFilter.status, 'pending');
});
