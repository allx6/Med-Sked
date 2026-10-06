const normalizeStatus = (status) => String(status || '').toLowerCase();

const isFutureDose = (scheduledDate, nowDate) => {
  if (!scheduledDate) return false;
  const scheduled = new Date(`${scheduledDate}T00:00:00`);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled > nowDate;
};

const isAfterExpiration = (scheduledDate, expirationDate) => {
  if (!scheduledDate || !expirationDate) return false;
  if (expirationDate === '0000-00-00') return false;
  return scheduledDate > expirationDate;
};

const calculateCanonicalAdherence = (doses = [], options = {}) => {
  const nowDate = options.now instanceof Date
    ? new Date(options.now.getTime())
    : new Date();

  if (typeof options.now === 'string') {
    const parsed = new Date(`${options.now}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      nowDate.setTime(parsed.getTime());
    }
  }

  const counts = {
    taken: 0,
    skipped: 0,
    missed: 0,
    pending: 0,
  };

  for (const dose of doses) {
    const status = normalizeStatus(dose?.status);
    if (!['taken', 'skipped', 'missed', 'pending'].includes(status)) {
      continue;
    }

    const scheduledDate = dose?.scheduledDate;
    if (isFutureDose(scheduledDate, nowDate)) {
      continue;
    }

    const medicationExpiration = dose?.medicationId?.expirationDate || dose?.medication?.expirationDate;
    if (isAfterExpiration(scheduledDate, medicationExpiration)) {
      continue;
    }

    if (status === 'pending') {
      counts.pending += 1;
      continue;
    }

    counts[status] += 1;
  }

  const eligible = counts.taken + counts.skipped + counts.missed;
  return eligible > 0 ? Math.round((counts.taken / eligible) * 100) : 0;
};

module.exports = {
  calculateCanonicalAdherence,
};
