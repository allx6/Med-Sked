const express = require('express');
const mongoose = require('mongoose');

const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const Medication = require('../models/Medication');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');
const {
  buildEffectiveMedicationExpirationExpression,
  buildEligibleDosePipeline,
  calculateCanonicalAdherence,
} = require('../utils/adherence');
const { formatLocalDate } = require('../utils/medicationInventory');

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_BUCKETS = ['morning', 'afternoon', 'evening', 'night'];

const formatDate = formatLocalDate;

const getDateRange = (query) => {
  const endDate = query.endDate || formatDate();
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const startDate = query.startDate || formatDate(start);

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

const calculateAnalytics = async (patientIds, range) => {
  const today = formatDate(new Date());

  const doseStats = await DoseRecord.aggregate([
      ...buildEligibleDosePipeline({
        medicationCollection: Medication.collection.name,
        userIds: patientIds,
        startDate: range.startDate,
        endDate: range.endDate,
        today,
      }),
      {
        $facet: {
          records: [
            { $project: { status: 1, scheduledDate: 1, scheduledTime: 1, medicationId: 1, medication: 1 } },
          ],
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

  const canonicalRecords = stats.records || [];

  const totalEligible = counts.taken + counts.skipped + counts.missed;
  const adherencePercentage = calculateCanonicalAdherence(canonicalRecords, { now: today });
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
        userId: { $in: patientIds },
        enabled: true,
      },
    },
    {
      $lookup: {
        from: Medication.collection.name,
        localField: 'medicationId',
        foreignField: '_id',
        as: 'medication',
      },
    },
    {
      $unwind: {
        path: '$medication',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        effectiveMedicationExpiration: buildEffectiveMedicationExpirationExpression(),
      },
    },
    {
      $match: {
        $or: [
          { effectiveMedicationExpiration: null },
          { effectiveMedicationExpiration: '' },
          {
            $expr: {
              $gte: ['$effectiveMedicationExpiration', today],
            },
          },
        ],
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

  return {
    dateRange: range,
    overall: {
      adherencePercentage,
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
  };
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

    res.json(await calculateAnalytics([new mongoose.Types.ObjectId(patientId)], range));
  } catch (error) {
    console.error('Adherence analytics error:', error);
    res.status(500).json({ message: 'Failed to calculate adherence analytics' });
  }
});

router.get('/adherence/caregiver-overview', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ message: 'Caregiver access required' });
    }

    const range = getDateRange(req.query);
    if (!range) {
      return res.status(400).json({ message: 'Invalid analytics date range' });
    }

    const relationships = await CaregiverRelationship.find({
      caregiver: req.user.userId,
      status: 'active',
    }).select('patient').lean();
    const patientIds = relationships
      .map((relationship) => relationship.patient)
      .filter((patientId) => mongoose.Types.ObjectId.isValid(patientId))
      .map((patientId) => new mongoose.Types.ObjectId(patientId));
    const analytics = await calculateAnalytics(patientIds, range);

    res.json({
      ...analytics,
      authorizedPatientCount: patientIds.length,
    });
  } catch (error) {
    console.error('Caregiver overview analytics error:', error);
    res.status(500).json({ message: 'Failed to calculate caregiver analytics' });
  }
});

module.exports = router;