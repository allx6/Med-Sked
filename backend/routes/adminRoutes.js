const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
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

router.use(authMiddleware, adminMiddleware);

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

    return res.json({ user });
  } catch (error) {
    console.error('Admin role update error:', error.message);
    return res.status(500).json({
      message: 'Failed to update user role.',
    });
  }
});

module.exports = router;
