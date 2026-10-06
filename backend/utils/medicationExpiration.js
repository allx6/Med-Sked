const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isMedicationExpired = (expirationDate, now = new Date()) => {
  if (typeof expirationDate !== 'string' || !datePattern.test(expirationDate.trim())) {
    return false;
  }

  return expirationDate.trim() < formatLocalDate(now);
};

const isDoseDateAfterExpiration = (scheduledDate, expirationDate) => (
  typeof scheduledDate === 'string'
  && datePattern.test(scheduledDate)
  && typeof expirationDate === 'string'
  && datePattern.test(expirationDate.trim())
  && scheduledDate > expirationDate.trim()
);

module.exports = {
  isMedicationExpired,
  isDoseDateAfterExpiration,
};