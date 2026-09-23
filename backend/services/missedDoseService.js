const DoseRecord = require('../models/DoseRecord');
const { createNotification } = require('./notificationService');

// A pending dose becomes missed 15 minutes after its scheduled local time.
const MISSED_DOSE_GRACE_MINUTES = 15;

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

const detectMissedDoses = async (now = new Date()) => {
  const pendingDoses = await DoseRecord.find({ status: 'pending' })
    .populate('medicationId', 'name')
    .lean();

  let markedMissed = 0;
  let notificationsCreated = 0;

  for (const dose of pendingDoses) {
    const scheduledAt = parseScheduledDateTime(
      dose.scheduledDate,
      dose.scheduledTime
    );

    if (!scheduledAt) {
      continue;
    }

    const deadline = new Date(
      scheduledAt.getTime() + MISSED_DOSE_GRACE_MINUTES * 60 * 1000
    );

    if (now < deadline) {
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

    const notification = await createNotification({
      recipient: transitioned.userId,
      type: 'missed_dose',
      message: `You missed ${dose.medicationId?.name || 'a scheduled medication dose'} at ${transitioned.scheduledTime}.`,
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
  detectMissedDoses,
};