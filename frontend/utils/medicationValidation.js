const dosagePattern = /^([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|g|mL|tablet)$/i;
const frequencyPattern = /^Every\s+([0-9]+(?:\.[0-9]+)?)\s+(hours|days)$/i;

export const validateMedicationFields = ({ name, dosage, frequency }) => {
  if (String(name || '').trim().length < 2) {
    return 'Medication name must contain at least 2 characters.';
  }

  const dosageMatch = String(dosage || '').trim().match(dosagePattern);
  if (!dosageMatch || Number(dosageMatch[1]) <= 0) {
    return 'Dosage must be a number greater than 0.';
  }

  const frequencyMatch = String(frequency || '').trim().match(frequencyPattern);
  if (!frequencyMatch || Number(frequencyMatch[1]) < 1) {
    return 'Frequency must be at least 1 hour or day.';
  }

  return '';
};
