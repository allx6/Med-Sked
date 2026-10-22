const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const AuditLog = require('../models/AuditLog');
const PrivilegedActionRequest = require('../models/PrivilegedActionRequest');
const PrivilegedActionLock = require('../models/PrivilegedActionLock');
const adminRoutes = require('../routes/adminRoutes');
const privilegedRoutes = require('../routes/adminPrivilegedActionRoutes');
const adminMiddleware = require('../middleware/adminMiddleware');

const requesterId = '507f1f77bcf86cd799439011';
const approverId = '507f1f77bcf86cd799439012';
const targetId = '507f1f77bcf86cd799439013';
const requestId = '507f1f77bcf86cd799439014';

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const routeHandler = (router, path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path && item.route.methods[method]
  ));
  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route`);
  return layer.route.stack.find((item) => item.method === method).handle;
};

const queryResult = (value) => ({
  session() { return this; },
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return this; },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

test('pending requests have a unique target index', () => {
  const pendingTargetIndex = PrivilegedActionRequest.schema.indexes().find(([, options]) => (
    options.unique && options.partialFilterExpression?.status === 'PENDING'
  ));

  assert.ok(pendingTargetIndex);
  assert.deepEqual(pendingTargetIndex[0], { targetType: 1, targetId: 1 });
});

test('admin authorization rejects non-admin roles', () => {
  const res = response();
  let nextCalled = false;

  adminMiddleware({ user: { role: 'caregiver' } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('legacy immediate delete, revoke, and role-change routes are blocked', async () => {
  const cases = [
    [adminRoutes, '/users/:userId', 'delete'],
    [adminRoutes, '/users/:userId/role', 'put'],
    [adminRoutes, '/relationships/:relationshipId', 'delete'],
  ];

  for (const [router, path, method] of cases) {
    const res = response();
    await routeHandler(router, path, method)(
      { params: {}, body: {}, user: { userId: requesterId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /approved privileged-action request/);
  }
});

test('general user update cannot bypass approval for role changes', async () => {
  const res = response();
  await routeHandler(adminRoutes, '/users/:userId', 'put')(
    {
      params: { userId: targetId },
      body: { role: 'admin' },
      user: { userId: requesterId, role: 'admin' },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /approved privileged-action request/);
});

test('admin account creation cannot bypass role-change approval', async () => {
  const res = response();
  await routeHandler(adminRoutes, '/users', 'post')(
    {
      body: {
        name: 'New Admin',
        email: 'new-admin@example.test',
        password: 'password123',
        role: 'admin',
      },
      user: { userId: requesterId, role: 'admin' },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /approved role-change request/);
});

test('request creation rejects spoofed identity fields and missing reasons', async () => {
  const handler = routeHandler(privilegedRoutes, '/', 'post');
  const spoofedResponse = response();
  await handler({
    body: {
      actionType: 'USER_DEACTIVATE',
      targetId,
      reason: 'Required cleanup',
      requesterId: approverId,
    },
    user: { userId: requesterId, role: 'admin' },
  }, spoofedResponse);
  assert.equal(spoofedResponse.statusCode, 400);

  const missingReasonResponse = response();
  await handler({
    body: { actionType: 'USER_DEACTIVATE', targetId, reason: '  ' },
    user: { userId: requesterId, role: 'admin' },
  }, missingReasonResponse);
  assert.equal(missingReasonResponse.statusCode, 400);

  const legacyDeleteResponse = response();
  await handler({
    body: { actionType: 'USER_DELETE', targetId, reason: 'No longer supported' },
    user: { userId: requesterId, role: 'admin' },
  }, legacyDeleteResponse);
  assert.equal(legacyDeleteResponse.statusCode, 409);
  assert.match(legacyDeleteResponse.body.message, /deactivation request/);
});

test('request creation records a reason and audits the authenticated requester', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findUser: User.findById,
    findPending: PrivilegedActionRequest.findOne,
    createRequest: PrivilegedActionRequest.create,
    auditSave: AuditLog.prototype.save,
  };
  const auditEvents = [];
  const createdRequest = {
    _id: requestId,
    requesterId,
    actionType: 'USER_ROLE_CHANGE',
    targetType: 'USER',
    targetId,
    requestData: { targetLabel: 'patient', previousRole: 'patient', requestedRole: 'admin' },
    reason: 'Approved staffing change',
    status: 'PENDING',
    toObject() { return { ...this }; },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  User.findById = () => queryResult({ _id: targetId, username: 'patient', role: 'patient' });
  PrivilegedActionRequest.findOne = () => queryResult(null);
  PrivilegedActionRequest.create = async ([payload]) => {
    assert.equal(payload.requesterId, requesterId);
    assert.equal(payload.requestData.requestedRole, 'admin');
    return [createdRequest];
  };
  AuditLog.prototype.save = async function save() {
    auditEvents.push({ action: this.action, actorId: String(this.actorId) });
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/', 'post')(
      {
        body: {
          actionType: 'USER_ROLE_CHANGE',
          targetId,
          requestedRole: 'admin',
          reason: 'Approved staffing change',
        },
        user: { userId: requesterId, role: 'admin' },
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.status, 'PENDING');
    assert.deepEqual(auditEvents, [{
      action: 'PRIVILEGED_ACTION_REQUESTED',
      actorId: requesterId,
    }]);
  } finally {
    mongoose.startSession = originals.startSession;
    User.findById = originals.findUser;
    PrivilegedActionRequest.findOne = originals.findPending;
    PrivilegedActionRequest.create = originals.createRequest;
    AuditLog.prototype.save = originals.auditSave;
  }
});

test('request cannot be approved by its requester', async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = PrivilegedActionRequest.findById;
  const originalLockUpdate = PrivilegedActionLock.updateOne;
  const transactionSession = {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  };
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_ROLE_CHANGE',
    targetType: 'USER',
    targetId,
    requestData: { previousRole: 'patient', requestedRole: 'admin' },
    save: async () => {},
  };
  mongoose.startSession = async () => transactionSession;
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: requesterId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /cannot approve your own request/);
    assert.equal(request.status, 'PENDING');
  } finally {
    mongoose.startSession = originalStartSession;
    PrivilegedActionLock.updateOne = originalLockUpdate;
    PrivilegedActionRequest.findById = originalFindById;
  }
});

test('an administrator cannot approve an action targeting their own account', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DEACTIVATE',
    targetType: 'USER',
    targetId: approverId,
    requestData: { targetLabel: 'reviewer' },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(request.status, 'PENDING');
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('a different admin approval executes the requested change and audits each stage', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    updateUser: User.updateOne,
    updateRelationships: CaregiverRelationship.updateMany,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_ROLE_CHANGE',
    targetType: 'USER',
    targetId,
    requestData: { previousRole: 'patient', requestedRole: 'admin' },
    reason: 'Required for administrator coverage',
    save: async () => {},
    toObject() { return { ...this }; },
  };
  const target = { _id: targetId, role: 'patient' };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult(target);
  User.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: targetId, role: 'patient' });
    target.role = update.$set.role;
    return { modifiedCount: 1 };
  };
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(target.role, 'admin');
    assert.equal(request.status, 'EXECUTED');
    assert.deepEqual(actions, [
      'PRIVILEGED_ACTION_APPROVED',
      'PRIVILEGED_ACTION_EXECUTED',
    ]);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.updateOne = originals.updateUser;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('deactivation retains the account and revokes active caregiver relationships', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    updateUser: User.updateOne,
    updateRelationships: CaregiverRelationship.updateMany,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const target = { _id: targetId, role: 'patient', accountStatus: 'active', authTokenVersion: 0 };
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DEACTIVATE',
    targetType: 'USER',
    targetId,
    requestData: { previousAccountStatus: 'active' },
    reason: 'Account owner requested closure',
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult(target);
  User.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: targetId, accountStatus: { $ne: 'deactivated' } });
    target.accountStatus = update.$set.accountStatus;
    target.authTokenVersion += update.$inc.authTokenVersion;
    return { modifiedCount: 1 };
  };
  CaregiverRelationship.updateMany = async (filter, update) => {
    assert.deepEqual(filter, {
      status: 'active',
      $or: [{ caregiver: targetId }, { patient: targetId }],
    });
    assert.deepEqual(update, { $set: { status: 'revoked' } });
    return { modifiedCount: 2 };
  };
  AuditLog.prototype.save = async function save() {
    actions.push({ action: this.action, details: this.details });
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(target.accountStatus, 'deactivated');
    assert.equal(target.authTokenVersion, 1);
    assert.equal(request.status, 'EXECUTED');
    assert.deepEqual(actions.map(({ action }) => action), [
      'PRIVILEGED_ACTION_APPROVED',
      'PRIVILEGED_ACTION_EXECUTED',
    ]);
    assert.equal(actions[1].details.revokedActiveRelationships, 2);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.updateOne = originals.updateUser;
    CaregiverRelationship.updateMany = originals.updateRelationships;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('reactivation requires an independent approval and invalidates old access tokens', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    updateUser: User.updateOne,
    updateRelationships: CaregiverRelationship.updateMany,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const target = { _id: targetId, role: 'patient', accountStatus: 'deactivated', authTokenVersion: 4 };
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_REACTIVATE',
    targetType: 'USER',
    targetId,
    requestData: { previousAccountStatus: 'deactivated' },
    reason: 'Identity verified; access may resume',
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult(target);
  User.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: targetId, accountStatus: 'deactivated' });
    assert.deepEqual(update.$inc, { authTokenVersion: 1 });
    assert.deepEqual(update.$unset, {
      deactivatedAt: 1,
      deactivatedBy: 1,
      deactivationReason: 1,
      deactivationRequestId: 1,
    });
    target.accountStatus = update.$set.accountStatus;
    target.authTokenVersion += update.$inc.authTokenVersion;
    return { modifiedCount: 1 };
  };
  CaregiverRelationship.updateMany = async (filter, update) => {
    assert.deepEqual(filter, {
      status: 'active',
      $or: [{ caregiver: targetId }, { patient: targetId }],
    });
    assert.deepEqual(update, { $set: { status: 'revoked' } });
    return { modifiedCount: 1 };
  };
  AuditLog.prototype.save = async function save() { return this; };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(target.accountStatus, 'active');
    assert.equal(target.authTokenVersion, 5);
    assert.equal(request.status, 'EXECUTED');
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.updateOne = originals.updateUser;
    CaregiverRelationship.updateMany = originals.updateRelationships;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('last active administrator cannot be deactivated', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    countAdmins: User.countDocuments,
    updateUser: User.updateOne,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DEACTIVATE',
    targetType: 'USER',
    targetId,
    requestData: { previousAccountStatus: 'active' },
    reason: 'No longer required',
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult({ _id: targetId, role: 'admin', accountStatus: 'active' });
  User.countDocuments = () => queryResult(1);
  User.updateOne = async () => {
    assert.fail('The final active administrator must not be deactivated.');
  };
  AuditLog.prototype.save = async function save() { return this; };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(request.status, 'FAILED');
    assert.match(request.executionResult, /last active administrator/i);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.countDocuments = originals.countAdmins;
    User.updateOne = originals.updateUser;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('legacy pending deletion requests are canceled without deleting data', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
    deleteOne: User.deleteOne,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DELETE',
    targetType: 'USER',
    targetId,
    requestData: { targetLabel: 'patient' },
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.deleteOne = async () => {
    assert.fail('Legacy deletion approval must never delete an account.');
  };
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(request.status, 'CANCELED');
    assert.match(request.executionResult, /without deleting/);
    assert.deepEqual(actions, ['LEGACY_USER_DELETE_REQUEST_CANCELED']);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
    User.deleteOne = originals.deleteOne;
  }
});

test('listing requests transitions existing pending deletions to canceled with an audit event', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequests: PrivilegedActionRequest.find,
    countRequests: PrivilegedActionRequest.countDocuments,
    auditSave: AuditLog.prototype.save,
  };
  const actions = [];
  const legacyRequest = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DELETE',
    targetType: 'USER',
    targetId,
    requestData: { targetLabel: 'patient' },
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionRequest.find = (filter) => queryResult(
    filter.actionType === 'USER_DELETE' ? [legacyRequest] : []
  );
  PrivilegedActionRequest.countDocuments = () => queryResult(0);
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/', 'get')(
      { query: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(legacyRequest.status, 'CANCELED');
    assert.match(legacyRequest.executionResult, /without deleting data/);
    assert.deepEqual(actions, ['LEGACY_USER_DELETE_REQUEST_CANCELED']);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.find = originals.findRequests;
    PrivilegedActionRequest.countDocuments = originals.countRequests;
    AuditLog.prototype.save = originals.auditSave;
  }
});

test('pending requests can be edited by requesters and canceled by another admin', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    auditSave: AuditLog.prototype.save,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DEACTIVATE',
    targetType: 'USER',
    targetId,
    requestData: { previousAccountStatus: 'active' },
    reason: 'Initial reason',
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionRequest.findById = () => queryResult(request);
  AuditLog.prototype.save = async function save() {
    actions.push({ action: this.action, details: this.details });
    return this;
  };

  try {
    const editResponse = response();
    await routeHandler(privilegedRoutes, '/:requestId', 'patch')(
      {
        params: { requestId },
        body: { reason: 'Updated justification' },
        user: { userId: requesterId, role: 'admin' },
      },
      editResponse
    );
    assert.equal(editResponse.statusCode, 200);
    assert.equal(request.reason, 'Updated justification');

    const cancelResponse = response();
    await routeHandler(privilegedRoutes, '/:requestId/cancel', 'post')(
      {
        params: { requestId },
        body: { reason: 'Request is no longer needed.' },
        user: { userId: approverId, role: 'admin' },
      },
      cancelResponse
    );
    assert.equal(cancelResponse.statusCode, 200);
    assert.equal(request.status, 'CANCELED');
    assert.equal(request.canceledBy, approverId);
    assert.equal(request.cancellationReason, 'Request is no longer needed.');
    assert.deepEqual(actions.map(({ action }) => action), [
      'PRIVILEGED_ACTION_UPDATED',
      'PRIVILEGED_ACTION_CANCELED',
    ]);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    AuditLog.prototype.save = originals.auditSave;
  }
});

test('rejection records the reason without executing the requested action', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_DEACTIVATE',
    targetType: 'USER',
    targetId,
    requestData: { targetLabel: 'patient' },
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/reject', 'post')(
      {
        params: { requestId },
        body: { reason: 'Request lacks supporting documentation.' },
        user: { userId: approverId, role: 'admin' },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(request.status, 'REJECTED');
    assert.equal(request.rejectionReason, 'Request lacks supporting documentation.');
    assert.deepEqual(actions, ['PRIVILEGED_ACTION_REJECTED']);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('approval revokes a relationship only after reviewer approval', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findRelationship: CaregiverRelationship.findById,
    updateRelationship: CaregiverRelationship.updateOne,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const relationshipId = '507f1f77bcf86cd799439015';
  const caregiverId = '507f1f77bcf86cd799439016';
  const patientId = '507f1f77bcf86cd799439017';
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'CAREGIVER_RELATIONSHIP_REVOKE',
    targetType: 'CAREGIVER_RELATIONSHIP',
    targetId: relationshipId,
    requestData: { previousStatus: 'active' },
    reason: 'Relationship no longer needed',
    save: async () => {},
  };
  const relationship = { _id: relationshipId, caregiver: caregiverId, patient: patientId, status: 'active' };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  CaregiverRelationship.findById = () => queryResult(relationship);
  CaregiverRelationship.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: relationshipId, status: 'active' });
    relationship.status = update.$set.status;
    return { modifiedCount: 1 };
  };
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(relationship.status, 'revoked');
    assert.equal(request.status, 'EXECUTED');
    assert.deepEqual(actions, [
      'PRIVILEGED_ACTION_APPROVED',
      'PRIVILEGED_ACTION_EXECUTED',
    ]);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    CaregiverRelationship.findById = originals.findRelationship;
    CaregiverRelationship.updateOne = originals.updateRelationship;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('last administrator cannot be demoted through an approved request', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    countAdmins: User.countDocuments,
    updateUser: User.updateOne,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_ROLE_CHANGE',
    targetType: 'USER',
    targetId,
    requestData: { previousRole: 'admin', requestedRole: 'patient' },
    reason: 'No longer needs administrator access',
    save: async () => {},
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult({ _id: targetId, role: 'admin' });
  User.countDocuments = () => queryResult(1);
  User.updateOne = async () => {
    assert.fail('A last-admin role change must not be executed.');
  };
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(request.status, 'FAILED');
    assert.match(request.executionResult, /last active administrator/i);
    assert.deepEqual(actions, [
      'PRIVILEGED_ACTION_APPROVED',
      'PRIVILEGED_ACTION_EXECUTION_FAILED',
    ]);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.countDocuments = originals.countAdmins;
    User.updateOne = originals.updateUser;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});

test('stale role-change requests fail without changing the current role', async () => {
  const originals = {
    startSession: mongoose.startSession,
    findRequest: PrivilegedActionRequest.findById,
    findUser: User.findById,
    updateUser: User.updateOne,
    auditSave: AuditLog.prototype.save,
    lockUpdate: PrivilegedActionLock.updateOne,
  };
  const actions = [];
  const request = {
    _id: requestId,
    requesterId,
    status: 'PENDING',
    actionType: 'USER_ROLE_CHANGE',
    targetType: 'USER',
    targetId,
    requestData: { previousRole: 'patient', requestedRole: 'admin' },
    reason: 'Promote to administrator',
    save: async () => {},
  };
  const target = { _id: targetId, role: 'caregiver' };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  PrivilegedActionLock.updateOne = async () => ({ matchedCount: 1 });
  PrivilegedActionRequest.findById = () => queryResult(request);
  User.findById = () => queryResult(target);
  User.updateOne = async () => {
    assert.fail('A stale role request must not update the user.');
  };
  AuditLog.prototype.save = async function save() {
    actions.push(this.action);
    return this;
  };

  try {
    const res = response();
    await routeHandler(privilegedRoutes, '/:requestId/approve', 'post')(
      { params: { requestId }, body: {}, user: { userId: approverId, role: 'admin' } },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(target.role, 'caregiver');
    assert.equal(request.status, 'FAILED');
    assert.deepEqual(actions, [
      'PRIVILEGED_ACTION_APPROVED',
      'PRIVILEGED_ACTION_EXECUTION_FAILED',
    ]);
  } finally {
    mongoose.startSession = originals.startSession;
    PrivilegedActionRequest.findById = originals.findRequest;
    User.findById = originals.findUser;
    User.updateOne = originals.updateUser;
    AuditLog.prototype.save = originals.auditSave;
    PrivilegedActionLock.updateOne = originals.lockUpdate;
  }
});
