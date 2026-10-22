const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const { createMedicationNotifications } = require('./notificationService');
const doseGenerator = require('./doseGenerator');
const { isDoseDateAfterExpiration } = require('../utils/medicationExpiration');
const { getMedicationExpirationDate } = require('../utils/medicationInventory');
const {
  formatMedicationLocalDate,
  getMedicationLocalParts,
  parseScheduledDateTime,
  toWallClockTimestamp,
} = require('../utils/medicationTime');

// Keep a dose actionable for a short grace period after its due time.
const MISSED_DOSE_GRACE_MINUTES = 15;

const formatCalendarDate = (date) => (
  formatMedicationLocalDate(date)
);

const parseLocalDateString = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (
    !Number.isFinite(year)
    || !Number.isFinite(month)
    || !Number.isFinite(day)
  ) {
    return null;
  }

  const parsed = toWallClockTimestamp({ year, month, day });

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const backfillPastDoses = async (now = new Date(), userId) => {
  const today = parseLocalDateString(formatMedicationLocalDate(now));

  const maxPastDate = new Date(today);
  maxPastDate.setUTCDate(maxPastDate.getUTCDate() - 1);

  const scheduleQuery = {
    enabled: true,
    startDate: { $lte: formatCalendarDate(today) },
    $or: [
      { endDate: null },
      { endDate: { $gte: formatCalendarDate(maxPastDate) } },
    ],
  };
  if (userId) {
    scheduleQuery.userId = userId;
  }

  const schedules = await MedicationSchedule.find(scheduleQuery).lean();

  for (const schedule of schedules) {
    const startDate = parseLocalDateString(schedule.startDate) || today;
    const cursor = new Date(startDate);

    while (cursor <= today) {
      if (doseGenerator.scheduleAppliesToDate(schedule, cursor)) {
        await doseGenerator.generateDosesForDate(schedule.userId, cursor);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
};

const detectMissedDoses = async (now = new Date(), userId) => {
  await backfillPastDoses(now, userId);

  const doseQuery = { status: 'pending' };
  if (userId) {
    doseQuery.userId = userId;
  }

  const pendingDoses = await DoseRecord.find(doseQuery)
    .populate('medicationId', 'name expirationDate stockBatches')
    .lean();

  let markedMissed = 0;
  let notificationsCreated = 0;

  for (const dose of pendingDoses) {
    if (isDoseDateAfterExpiration(
      dose.scheduledDate,
      getMedicationExpirationDate(dose.medicationId)
    )) {
      continue;
    }

    const scheduledAt = dose.effectiveDueAt
      ? new Date(dose.effectiveDueAt)
      : parseScheduledDateTime(dose.scheduledDate, dose.scheduledTime);

    if (!scheduledAt) {
      continue;
    }

    const localNow = toWallClockTimestamp(getMedicationLocalParts(now));
    const deadline = new Date(
      scheduledAt.getTime() + MISSED_DOSE_GRACE_MINUTES * 60 * 1000
    );
    if (localNow.getTime() <= deadline.getTime()) {
      continue;
    }

    // The status predicate makes repeated/concurrent runs idempotent.
    const transitioned = await DoseRecord.findOneAndUpdate(
      {
        _id: dose._id,
        status: 'pending',
      },
      {
        $set: { status: 'missed' },
      },
      { returnDocument: 'after' }
    ).lean();

    if (!transitioned) {
      continue;
    }

    markedMissed += 1;

    const medicationName = dose.medicationId?.name;
    const notification = await createMedicationNotifications({
      patientId: transitioned.userId,
      type: 'missed_dose',
      patientMessage: `You missed ${medicationName || 'a scheduled medication dose'} at ${transitioned.scheduledTime}.`,
      caregiverMessage: (patientName) => medicationName
        ? `${patientName} missed their ${medicationName} dose at ${transitioned.scheduledTime}.`
        : `${patientName} missed a scheduled medication dose at ${transitioned.scheduledTime}.`,
      relatedEntityType: 'DoseRecord',
      relatedEntityId: transitioned._id,
      dedupeKey: `missed_dose:${transitioned._id}`,
    });

    if (notification) {
      notificationsCreated += 1;
    }
  }

  return {
    markedMissed,
    notificationsCreated,
  };
};

module.exports = {
  MISSED_DOSE_GRACE_MINUTES,
  parseScheduledDateTime,
  backfillPastDoses,
  detectMissedDoses,
};
