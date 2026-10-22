const medicines = require('../../frontend/data/medicines.json');

const normalizeMedicineName = (name) => (
  typeof name === 'string'
    ? name.trim().toLocaleLowerCase()
    : ''
);

const isMedicineInDataset = (name) => {
  const normalizedName = normalizeMedicineName(name);
  return Boolean(normalizedName) && medicines.some(
    (medicine) => normalizeMedicineName(medicine) === normalizedName
  );
};

module.exports = { isMedicineInDataset };
