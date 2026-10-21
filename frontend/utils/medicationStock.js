export const isMedicationLowStock = (medication) => (
  Number(medication?.quantityOnHand ?? 0)
  <= Number(medication?.refillThreshold ?? 0)
);
