const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/User');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { createAuditLog } = require('../services/auditLogService');
const {
  getAdherenceTrend,
  getDoseOutcomes,
  getNotificationActivity,
  getRefills,
  getRegimenComplexity,
  getStats,
  getTimeOfDay,
  getUserRoles,
  parseDays,
} = require('../services/adminAnalyticsService');

const router = express.Router();

const ALLOWED_ROLES = [
  'patient',
  'caregiver',
  'admin',
];

const MAX_LIMIT = 100;
const SAFE_USER_FIELDS = '_id username email role createdAt updatedAt';
const SAFE_RELATIONSHIP_FIELDS = '_id caregiver patient status permission createdAt updatedAt';
const RELATIONSHIP_STATUSES = ['pending', 'active', 'revoked'];
const AUDIT_ACTIONS = [
  'ADMIN_ROLE_CHANGED',
  'ADMIN_RELATIONSHIP_REVOKED',
  'CAREGIVER_REQUEST_CREATED',
  'CAREGIVER_REQUEST_ACCEPTED',
  'CAREGIVER_REQUEST_DECLINED',
  'CAREGIVER_RELATIONSHIP_REVOKED',
];

const escapeRegex = (value) => (
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const parseRequiredPositiveInteger = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

const safeRelationshipQuery = (query) => query
  .populate('caregiver', 'username email patientId role')
  .populate('patient', 'username email patientId role')
  .select(SAFE_RELATIONSHIP_FIELDS);

const parseDateFilter = (value, endOfDay = false) => {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
};

router.use(authMiddleware, adminMiddleware);

router.get('/relationships', async (req, res) => {
  try {
    const page = parseRequiredPositiveInteger(req.query.page, 1);
    const requestedLimit = parseRequiredPositiveInteger(req.query.limit, 20);
    const status = typeof req.query.status === 'string'
      ? req.query.status.trim().toLowerCase()
      : '';
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim()
      : '';

    if (page === null || requestedLimit === null) {
      return res.status(400).json({ message: 'Page and limit must be positive integers.' });
    }

    if (requestedLimit > MAX_LIMIT) {
      return res.status(400).json({ message: `Limit cannot exceed ${MAX_LIMIT}.` });
    }

    if (status && !RELATIONSHIP_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid relationship status.' });
    }

    const query = {};
    if (status) {
      query.status = status;
    }

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { username: new RegExp(escapeRegex(search), 'i') },
          { email: new RegExp(escapeRegex(search), 'i') },
          { patientId: new RegExp(escapeRegex(search), 'i') },
        ],
      }).select('_id').lean();
      const userIds = matchingUsers.map((user) => user._id);
      query.$or = [
        { caregiver: { $in: userIds } },
        { patient: { $in: userIds } },
      ];
    }

    const limit = requestedLimit;
    const skip = (page - 1) * limit;
    const [total, relationships] = await Promise.all([
      CaregiverRelationship.countDocuments(query),
      safeRelationshipQuery(
        CaregiverRelationship.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),
    ]);

    return res.json({
      data: relationships,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin relationship list error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve relationships.' });
  }
});

router.get('/relationships/:relationshipId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.relationshipId)) {
      return res.status(400).json({ message: 'Invalid relationship ID.' });
    }

    const relationship = await safeRelationshipQuery(
      CaregiverRelationship.findById(req.params.relationshipId)
    ).lean();

    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found.' });
    }

    return res.json({ relationship });
  } catch (error) {
    console.error('Admin relationship detail error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve relationship.' });
  }
});

router.delete('/relationships/:relationshipId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.relationshipId)) {
      return res.status(400).json({ message: 'Invalid relationship ID.' });
    }

    const relationship = await CaregiverRelationship.findById(
      req.params.relationshipId
    );

    if (!relationship) {
      return res.status(404).json({ message: 'Relationship not found.' });
    }

    if (relationship.status !== 'revoked') {
      const previousStatus = relationship.status;
      relationship.status = 'revoked';
      await relationship.save();

      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'ADMIN_RELATIONSHIP_REVOKED',
        targetType: 'CAREGIVER_RELATIONSHIP',
        targetId: relationship._id,
        details: {
          caregiverId: relationship.caregiver,
          patientId: relationship.patient,
          previousStatus,
          newStatus: relationship.status,
        },
      });
    }

    const safeRelationship = await safeRelationshipQuery(
      CaregiverRelationship.findById(relationship._id)
    ).lean();

    return res.json({
      message: relationship.status === 'revoked'
        ? 'Relationship revoked.'
        : 'Relationship updated.',
      relationship: safeRelationship,
    });
  } catch (error) {
    console.error('Admin relationship revoke error:', error.message);
    return res.status(500).json({ message: 'Failed to revoke relationship.' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseRequiredPositiveInteger(req.query.page, 1);
    const requestedLimit = parseRequiredPositiveInteger(req.query.limit, 20);
    if (page === null || requestedLimit === null || requestedLimit > MAX_LIMIT) {
      return res.status(400).json({ message: 'Page and limit are invalid.' });
    }

    const query = {};
    if (req.query.action !== undefined) {
      if (!AUDIT_ACTIONS.includes(req.query.action)) {
        return res.status(400).json({ message: 'Invalid audit action.' });
      }
      query.action = req.query.action;
    }

    if (req.query.targetType !== undefined) {
      if (typeof req.query.targetType !== 'string' || !/^[A-Z_]+$/.test(req.query.targetType)) {
        return res.status(400).json({ message: 'Invalid audit target type.' });
      }
      query.targetType = req.query.targetType;
    }

    if (req.query.actorId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.query.actorId)) {
        return res.status(400).json({ message: 'Invalid audit actor ID.' });
      }
      query.actorId = req.query.actorId;
    }

    const from = parseDateFilter(req.query.from);
    const to = parseDateFilter(req.query.to, true);
    if (from === null || to === null || (from && to && from > to)) {
      return res.status(400).json({ message: 'Invalid audit date range.' });
    }
    if (from || to) {
      query.timestamp = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }

    const limit = requestedLimit;
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .select('-__v')
        .populate('actorId', 'username email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

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
    console.error('Admin audit log list error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve audit logs.' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    return res.json(await getStats());
  } catch (error) {
    console.error('Admin stats error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve system statistics.',
    });
  }
});

router.get('/analytics/dose-outcomes', async (req, res) => {
  try {
    return res.json(await getDoseOutcomes());
  } catch (error) {
    console.error('Admin dose outcomes error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve dose outcome analytics.',
    });
  }
});

router.get('/analytics/adherence-trend', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    return res.json(await getAdherenceTrend(days));
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }

    console.error('Admin adherence trend error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve adherence trend analytics.',
    });
  }
});

router.get('/analytics/time-of-day', async (req, res) => {
  try {
    return res.json(await getTimeOfDay());
  } catch (error) {
    console.error('Admin time-of-day analytics error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve time-of-day analytics.',
    });
  }
});

router.get('/analytics/regimen-complexity', async (req, res) => {
  try {
    return res.json(await getRegimenComplexity());
  } catch (error) {
    console.error('Admin regimen complexity error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve regimen complexity analytics.',
    });
  }
});

router.get('/analytics/users', async (req, res) => {
  try {
    return res.json(await getUserRoles());
  } catch (error) {
    console.error('Admin user role analytics error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve user role analytics.',
    });
  }
});

router.get('/analytics/notifications', async (req, res) => {
  try {
    return res.json(await getNotificationActivity());
  } catch (error) {
    console.error('Admin notification analytics error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve notification analytics.',
    });
  }
});

router.get('/analytics/refills', async (req, res) => {
  try {
    return res.json(await getRefills());
  } catch (error) {
    console.error('Admin refill analytics error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve refill analytics.',
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = Math.min(
      parsePositiveInteger(req.query.limit, 20),
      MAX_LIMIT
    );
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim()
      : '';
    const role = typeof req.query.role === 'string'
      ? req.query.role.trim()
      : '';

    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role filter.',
      });
    }

    const query = {};

    if (search) {
      const searchExpression = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { username: searchExpression },
        { email: searchExpression },
      ];
    }

    if (role) {
      query.role = role;
    }

    const skip = (page - 1) * limit;
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select(SAFE_USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin user list error:', error.message);
    return res.status(500).json({
      message: 'Failed to retrieve users.',
    });
  }
});

router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
      });
    }

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(req.body, 'role')
    ) {
      return res.status(400).json({
        message: 'Only the role field may be modified.',
      });
    }

    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role.',
      });
    }

    if (
      userId === req.user.userId &&
      role !== 'admin'
    ) {
      const adminCount = await User.countDocuments({ role: 'admin' });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'You cannot remove the last Admin account.',
        });
      }
    }

    const existingUser = await User.findById(userId).select('role');

    if (!existingUser) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    const previousRole = existingUser.role;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      {
        new: true,
        runValidators: true,
      }
    )
      .select(SAFE_USER_FIELDS)
      .lean();

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    if (previousRole !== role) {
      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'ADMIN_ROLE_CHANGED',
        targetType: 'USER',
        targetId: user._id,
        details: {
          previousRole,
          newRole: role,
        },
      });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Admin role update error:', error.message);
    return res.status(500).json({
      message: 'Failed to update user role.',
    });
  }
});

module.exports = router;
