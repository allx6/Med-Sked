const test = require('node:test');
const assert = require('node:assert/strict');
const { isMedicineInDataset } = require('../utils/medicineDataset');
const medicationRoutes = require('../routes/medicationRoutes');

const invokeCreateMedication = async (payload) => {
  const route = medicationRoutes.stack.find((layer) => (
    layer.route?.path === '/' && layer.route.methods.post
  ));
  const handler = route.route.stack.at(-1).handle;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await handler({
    user: { role: 'patient', userId: '507f1f77bcf86cd799439012' },
    body: payload,
  }, response);
  return response;
};

test('medicine dataset validation accepts listed names without case sensitivity', () => {
  assert.equal(isMedicineInDataset('Amlodipine'), true);
  assert.equal(isMedicineInDataset('  AMLODIPINE  '), true);
});

test('medicine dataset validation rejects partial, empty, and unlisted names', () => {
  assert.equal(isMedicineInDataset('Amlodip'), false);
  assert.equal(isMedicineInDataset('Wellness mix'), false);
  assert.equal(isMedicineInDataset(''), false);
  assert.equal(isMedicineInDataset(null), false);
});

test('medication creation API rejects names outside the medicine dataset', async () => {
  const response = await invokeCreateMedication({
    name: 'Unlisted wellness powder',
    dosage: '500 mg',
    frequency: 'Every 8 hours',
    expirationDate: '2027-01-01',
    quantityOnHand: 0,
    refillThreshold: 0,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.body.message,
    'Medicine not in the current dataset. Select a medicine from the dropdown.'
  );
});
