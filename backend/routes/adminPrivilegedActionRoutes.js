const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/User');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const AuditLog = require('../models/AuditLog');
const PrivilegedActionRequest = require('../models/PrivilegedActionRequest');
const PrivilegedActionLock = require('../models/PrivilegedActionLock');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();
const ALLOWED_ROLES = ['patient', 'caregiver', 'admin'];
const MAX_REASON_LENGTH = 500;

router.use(authMiddleware, adminMiddleware);

const recordAuditEvent = async (session, request, actorId, action, details = {}) => {
  await new AuditLog({
    actorId,
    actorRole: 'admin',
    action,
    targetType: request.targetType,
    targetId: request.targetId,
    details: {
      requestId: request._id,
      actionType: request.actionType,
      requestData: request.requestData,
      requestReason: request.reason,
      ...details,
    },
  }).save({ session });
};

const startTransaction = async (callback) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const lockAdminMembership = async (session) => {
  const lock = await PrivilegedActionLock.updateOne(
    { _id: 'admin-membership' },
    { $inc: { version: 1 } },
    { session }
  );
  if (lock.matchedCount !== 1) {
    throw new Error('Admin membership lock is unavailable.');
  }
};

const createTargetSnapshot = async (actionType, targetId, session) => {
  if (actionType === 'USER_DELETE' || actionType === 'USER_ROLE_CHANGE') {
    const target = await User.findById(targetId)
      .select('_id username role')
      .session(session);
    return target
      ? {
        targetType: 'USER',
        target,
        requestData: {
          targetLabel: target.username,
          previousRole: target.role,
        },
      }
      : null;
  }

  const relationship = await CaregiverRelationship.findById(targetId)
    .select('_id caregiver patient status')
    .session(session);
  if (!relationship || relationship.status === 'revoked') {
    return null;
  }

  const [caregiver, patient] = await Promise.all([
    User.findById(relationship.caregiver).select('_id username').session(session),
    User.findById(relationship.patient).select('_id username').session(session),
  ]);

  return {
    targetType: 'CAREGIVER_RELATIONSHIP',
    target: relationship,
    requestData: {
      targetLabel: `${caregiver?.username || relationship.caregiver} -> ${patient?.username || relationship.patient}`,
      previousStatus: relationship.status,
    },
  };
};

router.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
    const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED'];
    if (!statuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid request status.' });
    }

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'Page and limit are invalid.' });
    }

    const query = { status };
    const [total, requests] = await Promise.all([
      PrivilegedActionRequest.countDocuments(query),
      PrivilegedActionRequest.find(query)
        .populate('requesterId', 'username email role')
        .populate('approverId', 'username email role')
        .sort({ requestedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const data = await Promise.all(requests.map(async (request) => ({
      ...request,
      target: request.targetType === 'USER'
        ? await User.findById(request.targetId).select('_id username role').lean()
          || { _id: request.targetId, label: request.requestData.targetLabel }
        : await CaregiverRelationship.findById(request.targetId)
          .populate('caregiver', 'username role')
          .populate('patient', 'username role')
          .lean()
          || { _id: request.targetId, label: request.requestData.targetLabel },
    })));

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin privileged-action request list error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve action requests.' });
  }
});

router.post('/', async (req, res) => {
  const allowedKeys = ['actionType', 'targetId', 'requestedRole', 'reason'];
  if (
    !req.body
    || typeof req.body !== 'object'
    || Array.isArray(req.body)
    || Object.keys(req.body).some((key) => !allowedKeys.includes(key))
  ) {
    return res.status(400).json({ message: 'Invalid privileged-action request payload.' });
  }

  const { actionType, targetId } = req.body;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!['USER_DELETE', 'USER_ROLE_CHANGE', 'CAREGIVER_RELATIONSHIP_REVOKE'].includes(actionType)) {
    return res.status(400).json({ message: 'Invalid privileged action.' });
  }
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return res.status(400).json({ message: 'Invalid target ID.' });
  }
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    return res.status(400).json({ message: 'A reason of 1 to 500 characters is required.' });
  }
  if (
    actionType === 'USER_ROLE_CHANGE'
    && (!ALLOWED_ROLES.includes(req.body.requestedRole) || typeof req.body.requestedRole !== 'string')
  ) {
    return res.status(400).json({ message: 'A valid requested role is required.' });
  }
  if (actionType !== 'USER_ROLE_CHANGE' && Object.hasOwn(req.body, 'requestedRole')) {
    return res.status(400).json({ message: 'Requested role is only valid for a role-change request.' });
  }

  const requesterId = req.user.userId;
  if (actionType === 'USER_DELETE' && String(targetId) === String(requesterId)) {
    return res.status(400).json({ message: 'You cannot request deletion of your own admin account.' });
  }

  try {
    const request = await startTransaction(async (session) => {
      const snapshot = await createTargetSnapshot(actionType, targetId, session);
      if (!snapshot) {
        return { error: 'The requested target does not exist or is no longer eligible.', status: 404 };
      }
      if (
        actionType === 'USER_ROLE_CHANGE'
        && snapshot.target.role === req.body.requestedRole
      ) {
        return { error: 'The user already has the requested role.', status: 400 };
      }

      const existing = await PrivilegedActionRequest.findOne({
        targetType: snapshot.targetType,
        targetId,
        status: 'PENDING',
      }).session(session);
      if (existing) {
        return { error: 'A pending request already exists for this target.', status: 409 };
      }

      const requestData = {
        ...snapshot.requestData,
        ...(actionType === 'USER_ROLE_CHANGE' ? { requestedRole: req.body.requestedRole } : {}),
      };
      const [created] = await PrivilegedActionRequest.create([{
        requesterId,
        actionType,
        targetType: snapshot.targetType,
        targetId,
        requestData,
        reason,
      }], { session });

      await recordAuditEvent(session, created, requesterId, 'PRIVILEGED_ACTION_REQUESTED', {
        reason,
      });

      return { request: created };
    });

    if (request.error) {
      return res.status(request.status).json({ message: request.error });
    }
    return res.status(201).json({
      message: 'Approval request submitted.',
      request: request.request.toObject(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A pending request already exists for this target.' });
    }
    console.error('Admin privileged-action request create error:', error.message);
    return res.status(500).json({ message: 'Failed to submit the approval request.' });
  }
});

router.get('/:requestId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }
    const request = await PrivilegedActionRequest.findById(req.params.requestId)
      .populate('requesterId', 'username email role')
      .populate('approverId', 'username email role')
      .lean();
    if (!request) {
      return res.status(404).json({ message: 'Approval request not found.' });
    }

    const target = request.targetType === 'USER'
      ? await User.findById(request.targetId).select('_id username role').lean()
        || { _id: request.targetId, label: request.requestData.targetLabel }
      : await CaregiverRelationship.findById(request.targetId)
        .populate('caregiver', 'username role')
        .populate('patient', 'username role')
        .lean()
        || { _id: request.targetId, label: request.requestData.targetLabel };

    return res.json({ request: { ...request, target } });
  } catch (error) {
    console.error('Admin privileged-action request detail error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve the approval request.' });
  }
});

router.post('/:requestId/reject', async (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason || reason.length > MAX_REASON_LENGTH) {
    return res.status(400).json({ message: 'A rejection reason of 1 to 500 characters is required.' });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request ID.' });
  }

  try {
    const result = await startTransaction(async (session) => {
      const request = await PrivilegedActionRequest.findById(req.params.requestId).session(session);
      if (!request) {
        return { error: 'Approval request not found.', status: 404 };
      }
      if (String(request.requesterId) === String(req.user.userId)) {
        return { error: 'You cannot review your own request.', status: 403 };
      }
      if (request.status !== 'PENDING') {
        return { error: 'This request is no longer pending.', status: 409 };
      }

      request.status = 'REJECTED';
      request.approverId = req.user.userId;
      request.reviewedAt = new Date();
      request.rejectionReason = reason;
      await request.save({ session });
      await recordAuditEvent(session, request, req.user.userId, 'PRIVILEGED_ACTION_REJECTED', {
        reason,
      });
      return { request };
    });

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }
    return res.json({ message: 'Approval request rejected.', request: result.request });
  } catch (error) {
    console.error('Admin privileged-action request rejection error:', error.message);
    return res.status(500).json({ message: 'Failed to reject the approval request.' });
  }
});

router.post('/:requestId/approve', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request ID.' });
  }

  try {
    try {
      await PrivilegedActionLock.updateOne(
        { _id: 'admin-membership' },
        { $setOnInsert: { version: 0 } },
        { upsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }

    const result = await startTransaction(async (session) => {
      const request = await PrivilegedActionRequest.findById(req.params.requestId).session(session);
      if (!request) {
        return { error: 'Approval request not found.', status: 404 };
      }
      if (String(request.requesterId) === String(req.user.userId)) {
        return { error: 'You cannot approve your own request.', status: 403 };
      }
      if (
        request.targetType === 'USER'
        && String(request.targetId) === String(req.user.userId)
      ) {
        return { error: 'You cannot approve an action targeting your own account.', status: 403 };
      }
      if (request.targetType === 'CAREGIVER_RELATIONSHIP') {
        const relationship = await CaregiverRelationship.findById(request.targetId).session(session);
        if (
          relationship
          && (
            String(relationship.caregiver) === String(req.user.userId)
            || String(relationship.patient) === String(req.user.userId)
          )
        ) {
          return { error: 'You cannot approve an action affecting your own relationship.', status: 403 };
        }
      }
      if (request.status !== 'PENDING') {
        return { error: 'This request is no longer pending.', status: 409 };
      }

      request.status = 'APPROVED';
      request.approverId = req.user.userId;
      request.reviewedAt = new Date();
      await recordAuditEvent(session, request, req.user.userId, 'PRIVILEGED_ACTION_APPROVED');

      let failure = null;
      if (request.actionType === 'USER_DELETE') {
        const target = await User.findById(request.targetId).session(session);
        if (!target || String(target._id) === String(request.requesterId)) {
          failure = 'The user no longer exists or cannot be deleted by this request.';
        } else {
          if (target.role === 'admin') {
            await lockAdminMembership(session);
            if (await User.countDocuments({ role: 'admin' }).session(session) <= 1) {
              failure = 'The last administrator account cannot be deleted.';
            }
          }
        }

        if (!failure && target) {
          await CaregiverRelationship.deleteMany({
            $or: [{ caregiver: request.targetId }, { patient: request.targetId }],
          }, { session });
          const deletion = await User.deleteOne({ _id: request.targetId }, { session });
          if (deletion.deletedCount !== 1) {
            failure = 'The target user could not be deleted.';
          }
        }
      } else if (request.actionType === 'USER_ROLE_CHANGE') {
        const { previousRole, requestedRole } = request.requestData;
        const target = await User.findById(request.targetId).session(session);
        if (!target || target.role !== previousRole) {
          failure = 'The user role has changed since this request was submitted.';
        } else if (!ALLOWED_ROLES.includes(requestedRole) || requestedRole === previousRole) {
          failure = 'The requested role change is no longer valid.';
        } else if (
          previousRole === 'admin'
          && requestedRole !== 'admin'
        ) {
          await lockAdminMembership(session);
          if (await User.countDocuments({ role: 'admin' }).session(session) <= 1) {
            failure = 'The last administrator account cannot be demoted.';
          }
        }

        if (!failure && target) {
          const update = await User.updateOne(
            { _id: request.targetId, role: previousRole },
            { $set: { role: requestedRole } },
            { session, runValidators: true }
          );
          if (update.modifiedCount !== 1) {
            failure = 'The user role changed before this request could be executed.';
          }
        }
      } else {
        const { previousStatus } = request.requestData;
        const target = await CaregiverRelationship.findById(request.targetId).session(session);
        if (!target || target.status !== previousStatus || target.status === 'revoked') {
          failure = 'The caregiver relationship changed since this request was submitted.';
        } else {
          const update = await CaregiverRelationship.updateOne(
            { _id: request.targetId, status: previousStatus },
            { $set: { status: 'revoked' } },
            { session, runValidators: true }
          );
          if (update.modifiedCount !== 1) {
            failure = 'The caregiver relationship changed before this request could be executed.';
          }
        }
      }

      if (failure) {
        request.status = 'FAILED';
        request.executionResult = failure;
        await request.save({ session });
        await recordAuditEvent(session, request, req.user.userId, 'PRIVILEGED_ACTION_EXECUTION_FAILED', {
          reason: failure,
        });
        return { request, error: failure, status: 409 };
      }

      request.status = 'EXECUTED';
      request.executedAt = new Date();
      request.executionResult = 'Action executed successfully.';
      await request.save({ session });
      await recordAuditEvent(session, request, req.user.userId, 'PRIVILEGED_ACTION_EXECUTED', {
        reason: request.reason,
      });
      return { request };
    });

    if (result.error) {
      return res.status(result.status).json({
        message: result.error,
        request: result.request,
      });
    }
    return res.json({ message: 'Request approved and action executed.', request: result.request });
  } catch (error) {
    console.error('Admin privileged-action approval/execution error:', error.message);
    return res.status(500).json({ message: 'Failed to approve and execute the action.' });
  }
});

module.exports = router;
