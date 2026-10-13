export const normalizeDoseDate = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value.trim());
  if (!match) {
    return '';
  }

  const datePart = match[1];
  const [year, month, day] = datePart.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return '';
  }

  return datePart;
};

export const getAvailableDoseDates = (doses) => Array.from(
  new Set(
    doses
      .map((dose) => normalizeDoseDate(dose.scheduledDate))
      .filter(Boolean)
  )
).sort();

export const filterDoseHistory = (
  doses,
  { selectedDate, selectedMedication, selectedStatus }
) => doses.filter((dose) => (
  (selectedDate === 'all' || normalizeDoseDate(dose.scheduledDate) === selectedDate)
  && (selectedMedication === 'all' || dose.medicationId?._id === selectedMedication)
  && (selectedStatus === 'all' || dose.status === selectedStatus)
));
