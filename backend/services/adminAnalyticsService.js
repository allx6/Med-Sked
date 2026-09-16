const mongoose = require('mongoose');

const User = require('../models/User');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const DoseRecord = require('../models/DoseRecord');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const Notification = require('../models/Notification');

const TIME_BUCKETS = ['morning', 'afternoon', 'evening', 'night'];
const OUTCOME_STATUSES = ['taken', 'skipped', 'missed'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const parseDays = (value, fallback = 30) => {
  if (value === undefined) {
    return fallback;
  }

  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    const error = new Error('days must be an integer from 1 to 90');
    error.statusCode = 400;
    throw error;
  }

  return days;
};

const getDateRange = (days) => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
};

const percentage = (taken, total) => (
  total > 0 ? Math.round((taken / total) * 10000) / 100 : 0
);

const emptyOutcomeCounts = () => ({
  taken: 0,
  skipped: 0,
  missed: 0,
  pending: 0,
});

const addOutcome = (target, status, count) => {
  if (Object.prototype.hasOwnProperty.call(target, status)) {
    target[status] += count;
  }
};

const timeOfDay = (value) => {
  const twelveHourMatch = String(value || '').trim().match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFourHourMatch = String(value || '').trim().match(
    /^(\d{2}):(\d{2})$/
  );

  if (!twelveHourMatch && !twentyFourHourMatch) {
    return null;
  }

  let hour = Number((twelveHourMatch || twentyFourHourMatch)[1]);
  const minute = Number((twelveHourMatch || twentyFourHourMatch)[2]);

  if (twelveHourMatch) {
    const period = twelveHourMatch[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const getOutcomeAggregation = ({ startDate, endDate } = {}) => {
  const match = {
    ...(startDate || endDate
      ? { scheduledDate: { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) } }
      : {}),
  };

  return [
    { $match: match },
    {
      $group: {
        _id: { status: '$status', scheduledDate: '$scheduledDate' },
        count: { $sum: 1 },
      },
    },
  ];
};

const getStats = async () => {
  const [
    users,
    medications,
    schedules,
    doses,
    relationships,
    notifications,
  ] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          patients: { $sum: { $cond: [{ $eq: ['$role', 'patient'] }, 1, 0] } },
          caregivers: { $sum: { $cond: [{ $eq: ['$role', 'caregiver'] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        },
      },
    ]),
    Medication.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          lowRefill: {
            $sum: {
              $cond: [{ $lte: ['$quantityOnHand', '$refillThreshold'] }, 1, 0],
            },
          },
          zeroStock: {
            $sum: {
              $cond: [{ $eq: ['$quantityOnHand', 0] }, 1, 0],
            },
          },
        },
      },
    ]),
    MedicationSchedule.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          enabled: { $sum: { $cond: ['$enabled', 1, 0] } },
        },
      },
    ]),
    DoseRecord.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    CaregiverRelationship.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const userStats = users[0] || {
    total: 0,
    patients: 0,
    caregivers: 0,
    admins: 0,
  };
  const medicationStats = medications[0] || { total: 0, lowRefill: 0, zeroStock: 0 };
  const scheduleStats = schedules[0] || { total: 0, enabled: 0 };
  const doseStats = emptyOutcomeCounts();
  const relationshipStats = { total: 0, active: 0, pending: 0, revoked: 0 };
  const notificationByType = {};

  for (const item of doses) {
    if (Object.prototype.hasOwnProperty.call(doseStats, item._id)) {
      doseStats[item._id] = item.count;
    }
  }

  for (const item of relationships) {
    if (Object.prototype.hasOwnProperty.call(relationshipStats, item._id)) {
      relationshipStats[item._id] = item.count;
      relationshipStats.total += item.count;
    }
  }

  for (const item of notifications) {
    notificationByType[item._id] = item.count;
  }

  const eligible = doseStats.taken + doseStats.skipped + doseStats.missed;

  return {
    users: {
      total: userStats.total,
      patients: userStats.patients,
      caregivers: userStats.caregivers,
      admins: userStats.admins,
    },
    medications: {
      total: medicationStats.total,
      lowRefill: medicationStats.lowRefill,
      zeroStock: medicationStats.zeroStock,
    },
    schedules: {
      total: scheduleStats.total,
      enabled: scheduleStats.enabled,
    },
    doses: doseStats,
    adherence: {
      taken: doseStats.taken,
      skipped: doseStats.skipped,
      missed: doseStats.missed,
      eligible: eligible,
      rate: percentage(doseStats.taken, eligible),
    },
    relationships: relationshipStats,
    notifications: {
      total: Object.values(notificationByType).reduce((sum, count) => sum + count, 0),
      byType: notificationByType,
    },
    refills: {
      tracked: medicationStats.total,
      atOrBelowThreshold: medicationStats.lowRefill,
      zeroStock: medicationStats.zeroStock,
    },
  };
};

const getDoseOutcomes = async () => {
  const grouped = await DoseRecord.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = emptyOutcomeCounts();

  for (const item of grouped) {
    addOutcome(counts, item._id, item.count);
  }

  return {
    data: OUTCOME_STATUSES.map((status) => ({
      status,
      count: counts[status],
    })),
    pending: counts.pending,
  };
};

const getAdherenceTrend = async (days) => {
  const range = getDateRange(days);
  const grouped = await DoseRecord.aggregate(getOutcomeAggregation(range));
  const daily = new Map();

  for (const item of grouped) {
    if (!daily.has(item._id.scheduledDate)) {
      daily.set(item._id.scheduledDate, emptyOutcomeCounts());
    }
    addOutcome(daily.get(item._id.scheduledDate), item._id.status, item.count);
  }

  const data = [];
  const current = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);

  while (current <= end) {
    const date = formatDate(current);
    const counts = daily.get(date) || emptyOutcomeCounts();
    const eligible = counts.taken + counts.skipped + counts.missed;
    data.push({
      date,
      taken: counts.taken,
      skipped: counts.skipped,
      missed: counts.missed,
      adherenceRate: percentage(counts.taken, eligible),
    });
    current.setDate(current.getDate() + 1);
  }

  return { days, data };
};

const getTimeOfDay = async () => {
  const grouped = await DoseRecord.aggregate([
    {
      $match: {
        status: { $in: OUTCOME_STATUSES },
      },
    },
    {
      $group: {
        _id: { status: '$status', scheduledTime: '$scheduledTime' },
        count: { $sum: 1 },
      },
    },
  ]);
  const buckets = Object.fromEntries(
    TIME_BUCKETS.map((bucket) => [bucket, { taken: 0, skipped: 0, missed: 0 }])
  );

  for (const item of grouped) {
    const bucket = timeOfDay(item._id.scheduledTime);
    if (bucket) {
      addOutcome(buckets[bucket], item._id.status, item.count);
    }
  }

  return {
    data: TIME_BUCKETS.map((timeBucket) => {
      const counts = buckets[timeBucket];
      const eligible = counts.taken + counts.skipped + counts.missed;
      return {
        timeOfDay: timeBucket,
        ...counts,
        adherenceRate: percentage(counts.taken, eligible),
      };
    }),
  };
};

const getRegimenComplexity = async () => {
  const scheduleGroups = await MedicationSchedule.aggregate([
    { $match: { enabled: true } },
    {
      $group: {
        _id: '$userId',
        activeMedicationCount: { $addToSet: '$medicationId' },
        weeklyScheduledDoses: { $sum: { $size: '$days' } },
      },
    },
    {
      $project: {
        activeMedicationCount: { $size: '$activeMedicationCount' },
        scheduledDosesPerDay: { $divide: ['$weeklyScheduledDoses', 7] },
      },
    },
  ]);
  const doseGroups = await DoseRecord.aggregate([
    {
      $match: {
        status: { $in: OUTCOME_STATUSES },
      },
    },
    {
      $group: {
        _id: { userId: '$userId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);
  const complexities = new Map();

  for (const group of scheduleGroups) {
    const score = group.activeMedicationCount + group.scheduledDosesPerDay;
    const bucket = score <= 2 ? 'low' : score <= 4 ? 'moderate' : 'high';
    complexities.set(String(group._id), {
      group: bucket,
      scheduledDosesPerDay: Math.round(group.scheduledDosesPerDay * 100) / 100,
      taken: 0,
      skipped: 0,
      missed: 0,
    });
  }

  for (const item of doseGroups) {
    const complexity = complexities.get(String(item._id.userId));
    if (complexity) {
      addOutcome(complexity, item._id.status, item.count);
    }
  }

  const grouped = new Map();
  for (const complexity of complexities.values()) {
    if (!grouped.has(complexity.group)) {
      grouped.set(complexity.group, {
        group: complexity.group,
        regimens: 0,
        scheduledDosesPerDay: 0,
        taken: 0,
        skipped: 0,
        missed: 0,
      });
    }
    const result = grouped.get(complexity.group);
    result.regimens += 1;
    result.scheduledDosesPerDay += complexity.scheduledDosesPerDay;
    result.taken += complexity.taken;
    result.skipped += complexity.skipped;
    result.missed += complexity.missed;
  }

  return {
    data: ['low', 'moderate', 'high']
      .filter((group) => grouped.has(group))
      .map((group) => {
        const result = grouped.get(group);
        const eligible = result.taken + result.skipped + result.missed;
        return {
          ...result,
          scheduledDosesPerDay: Math.round((result.scheduledDosesPerDay / result.regimens) * 100) / 100,
          adherenceRate: percentage(result.taken, eligible),
        };
      }),
  };
};

const getUserRoles = async () => {
  const grouped = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    data: grouped.map((item) => ({ role: item._id, count: item.count })),
  };
};

const getNotificationActivity = async () => {
  const grouped = await Notification.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    data: grouped.map((item) => ({ type: item._id, count: item.count })),
  };
};

const getRefills = async () => {
  const result = await Medication.aggregate([
    {
      $group: {
        _id: null,
        tracked: { $sum: 1 },
        atOrBelowThreshold: {
          $sum: {
            $cond: [{ $lte: ['$quantityOnHand', '$refillThreshold'] }, 1, 0],
          },
        },
        zeroStock: {
          $sum: {
            $cond: [{ $eq: ['$quantityOnHand', 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  return {
    ...(result[0] || {
      tracked: 0,
      atOrBelowThreshold: 0,
      zeroStock: 0,
    }),
  };
};

module.exports = {
  DATE_PATTERN,
  getAdherenceTrend,
  getDoseOutcomes,
  getNotificationActivity,
  getRefills,
  getRegimenComplexity,
  getStats,
  getTimeOfDay,
  getUserRoles,
  parseDays,
};
