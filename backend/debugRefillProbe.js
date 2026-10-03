const mongoose = require('mongoose');
const Medication = require('./models/Medication');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const med = await Medication.create({
    userId: '507f1f77bcf86cd799439012',
    name: 'probe',
    dosage: '500 mg',
    frequency: 'Every 12 hours',
    expirationDate: '2027-03-02',
    quantityOnHand: 9,
    refillThreshold: 2,
    lowRefillNotified: false,
  });

  const refillAmount = 10;
  const nextQuantityExpression = { $add: [{ $ifNull: ['$quantityOnHand', 0] }, refillAmount] };

  const updatePipeline = [{
    $set: {
      quantityOnHand: nextQuantityExpression,
      lowRefillNotified: {
        $cond: [
          {
            $gt: [
              nextQuantityExpression,
              { $ifNull: ['$refillThreshold', 0] },
            ],
          },
          false,
          { $ifNull: ['$lowRefillNotified', false] },
        ],
      },
      updatedAt: new Date(),
    },
  }];

  try {
    const updated = await Medication.findOneAndUpdate(
      { _id: med._id, userId: '507f1f77bcf86cd799439012' },
      updatePipeline,
      { returnDocument: 'after', timestamps: false }
    );
    console.log('UPDATED', updated);
  } catch (error) {
    console.error('ERROR', error.name, error.message);
    console.error(error.stack);
  }

  await Medication.findByIdAndDelete(med._id);
  await mongoose.disconnect();
})();
