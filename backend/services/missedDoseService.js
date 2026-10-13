const DoseRecord = require('../models/DoseRecord');
const MedicationSchedule = require('../models/MedicationSchedule');
const { createMedicationNotifications } = require('./notificationService');
const doseGenerator = require('./doseGenerator');
const { isDoseDateAfterExpiration } = require('../utils/medicationExpiration');

// A pending dose becomes missed as soon as it is past its scheduled local time.
// This keeps historical doses from staying stuck as pending on the next day.
const MISSED_DOSE_GRACE_MINUTES = 0;

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const backfillPastDoses = async (now = new Date(), userId) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const maxPastDate = new Date(today);
  maxPastDate.setDate(maxPastDate.getDate() - 1);

  const scheduleQuery = {
    enabled: true,
    startDate: { $lte: formatLocalDate(today) },
    $or: [
      { endDate: null },
      { endDate: { $gte: formatLocalDate(maxPastDate) } },
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
      cursor.setDate(cursor.getDate() + 1);
    }
  }
};

const parseScheduledDateTime = (scheduledDate, scheduledTime) => {
  const dateParts = String(scheduledDate || '').split('-').map(Number);
  const normalizedTime = String(scheduledTime || '').trim();
  const twelveHourMatch = normalizedTime.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFourHourMatch = normalizedTime.match(
    /^(\d{2}):(\d{2})$/
  );

  if (
    dateParts.length !== 3 ||
    dateParts.some(Number.isNaN) ||
    (!twelveHourMatch && !twentyFourHourMatch)
  ) {
    return null;
  }

  let hours = Number((twelveHourMatch || twentyFourHourMatch)[1]);
  const minutes = Number((twelveHourMatch || twentyFourHourMatch)[2]);

  if (
    minutes > 59 ||
    (twelveHourMatch && (hours < 1 || hours > 12)) ||
    (twentyFourHourMatch && hours > 23)
  ) {
    return null;
  }

  if (twelveHourMatch) {
    const period = twelveHourMatch[3].toUpperCase();
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;
  }

  const scheduledAt = new Date(
    dateParts[0],
    dateParts[1] - 1,
    dateParts[2],
    hours,
    minutes,
    0,
    0
  );

  if (
    scheduledAt.getFullYear() !== dateParts[0] ||
    scheduledAt.getMonth() !== dateParts[1] - 1 ||
    scheduledAt.getDate() !== dateParts[2]
  ) {
    return null;
  }

  return scheduledAt;
};

const detectMissedDoses = async (now = new Date(), userId) => {
  await backfillPastDoses(now, userId);

  const doseQuery = { status: 'pending' };
  if (userId) {
    doseQuery.userId = userId;
  }

  const pendingDoses = await DoseRecord.find(doseQuery)
    .populate('medicationId', 'name expirationDate')
    .lean();

  let markedMissed = 0;
  let notificationsCreated = 0;

  for (const dose of pendingDoses) {
    if (isDoseDateAfterExpiration(dose.scheduledDate, dose.medicationId?.expirationDate)) {
      continue;
    }

    const scheduledAt = parseScheduledDateTime(
      dose.scheduledDate,
      dose.scheduledTime
    );

    if (!scheduledAt) {
      continue;
    }

    const localNow = new Date(now);
    const deadline = new Date(
      scheduledAt.getTime() + MISSED_DOSE_GRACE_MINUTES * 60 * 1000
    );
    const isPastScheduledTime = localNow.getTime() > deadline.getTime();
    const isNewDayAfterSchedule = formatLocalDate(localNow) > dose.scheduledDate;

    if (!isPastScheduledTime && !isNewDayAfterSchedule) {
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
