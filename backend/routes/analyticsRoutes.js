const express = require('express');
const mongoose = require('mongoose');

const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_BUCKETS = ['morning', 'afternoon', 'evening', 'night'];

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getDateRange = (query) => {
  const today = new Date();
  const endDate = query.endDate || formatDate(today);
  const startDate = query.startDate || formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));

  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate) || startDate > endDate) {
    return null;
  }

  return { startDate, endDate };
};

const parseTimeOfDay = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const twentyFourHourMatch = String(value || '').trim().match(/^(\d{2}):(\d{2})$/);

  if (!match && !twentyFourHourMatch) return null;

  let hour = Number((match || twentyFourHourMatch)[1]);
  if (match) {
    const period = match[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
  }

  if (hour < 0 || hour > 23) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const percentage = (taken, total) => total > 0 ? Math.round((taken / total) * 100) : 0;

const emptyBucket = () => ({ total: 0, taken: 0, skipped: 0, missed: 0, adherencePercentage: 0 });

const authorizeAnalytics = (req, res, next) => {
  if (req.user.role === 'patient') {
    req.analyticsPatientId = req.user.userId;
    return next();
  }

  if (req.user.role === 'caregiver') {
    return caregiverMiddleware(req, res, () => {
      req.analyticsPatientId = req.query.patientId;
      next();
    });
  }

  return res.status(403).json({ message: 'Analytics access required' });
};

router.get('/adherence', authMiddleware, authorizeAnalytics, async (req, res) => {
  try {
    const patientId = req.analyticsPatientId;
    const range = getDateRange(req.query);

    if (!range) {
      return res.status(400).json({ message: 'Invalid analytics date range' });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID' });
    }

    const doseStats = await DoseRecord.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(patientId),
          scheduledDate: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      {
        $facet: {
          overall: [
            { $match: { status: { $in: ['taken', 'skipped', 'missed'] } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' },
          ],
          timeOfDay: [
            { $match: { status: { $in: ['taken', 'skipped', 'missed'] } } },
            { $group: { _id: { status: '$status', scheduledTime: '$scheduledTime' }, count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const stats = doseStats[0] || {};
    const counts = { taken: 0, skipped: 0, missed: 0 };
    for (const item of stats.overall || []) counts[item._id] = item.count;

    const totalEligible = counts.taken + counts.skipped + counts.missed;
    const timeOfDay = Object.fromEntries(TIME_BUCKETS.map((bucket) => [bucket, emptyBucket()]));

    for (const item of stats.timeOfDay || []) {
      const bucket = parseTimeOfDay(item._id.scheduledTime);
      if (!bucket) continue;
      timeOfDay[bucket].total += item.count;
      timeOfDay[bucket][item._id.status] += item.count;
    }

    for (const bucket of TIME_BUCKETS) {
      timeOfDay[bucket].adherencePercentage = percentage(timeOfDay[bucket].taken, timeOfDay[bucket].total);
    }

    const scheduleStats = await MedicationSchedule.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(patientId),
            enabled: true,
          },
        },
        {
          $group: {
            _id: null,
            activeScheduleCount: { $sum: 1 },
            weeklyScheduledDoses: { $sum: { $size: '$days' } },
            medicationIds: { $addToSet: '$medicationId' },
          },
        },
      ]);

    const scheduleSummary = scheduleStats[0] || {
      activeScheduleCount: 0,
      weeklyScheduledDoses: 0,
      medicationIds: [],
    };
    const scheduledDosesPerDay = Math.round((scheduleSummary.weeklyScheduledDoses / 7) * 100) / 100;
    const activeMedicationCount = scheduleSummary.medicationIds?.length || 0;
    const complexityScore = activeMedicationCount + scheduledDosesPerDay;
    const complexityBucket = complexityScore <= 2 ? 'low' : complexityScore <= 4 ? 'moderate' : 'high';

    res.json({
      dateRange: range,
      overall: {
        adherencePercentage: percentage(counts.taken, totalEligible),
        totalEligible,
        taken: counts.taken,
        skipped: counts.skipped,
        missed: counts.missed,
        pending: stats.pending?.[0]?.count || 0,
      },
      timeOfDay,
      complexity: {
        activeMedicationCount,
        activeScheduleCount: scheduleSummary.activeScheduleCount,
        scheduledDosesPerDay,
        complexityScore,
        complexityBucket,
        note: 'Complexity is a transparent system measure, not a medically validated scale.',
      },
      dayNames: DAY_NAMES,
    });
  } catch (error) {
    console.error('Adherence analytics error:', error);
    res.status(500).json({ message: 'Failed to calculate adherence analytics' });
  }
});

module.exports = router;