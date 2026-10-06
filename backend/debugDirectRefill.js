const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Medication = require('./models/Medication');
const medicationRoutes = require('./routes/medicationRoutes');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ts = Date.now();
  const email = 'temp.refilldebug.' + ts + '@example.com';
  const username = 'tempdebug' + ts;
  const password = 'Password123';

  const user = await User.create({
    username,
    email,
    password: bcrypt.hashSync(password, 10),
    role: 'patient',
  });

  user.patientId = 'MSK-' + String(ts).slice(-6).toUpperCase();
  await user.save();

  const med = await Medication.create({
    userId: user._id,
    name: 'Metformin',
    dosage: '500 mg',
    frequency: 'Every 12 hours',
    expirationDate: '2027-03-02',
    quantityOnHand: 9,
    refillThreshold: 2,
    lowRefillNotified: false,
  });

  const layer = medicationRoutes.stack.find((item) => item.route && item.route.path === '/:id/refill' && item.route.methods.post);
  const authorize = layer.route.stack.at(-2).handle;
  const handler = layer.route.stack.at(-1).handle;

  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };

  const req = {
    user: { userId: user._id.toString(), role: 'patient' },
    params: { id: med._id.toString() },
    body: { refillAmount: 10 },
    query: {},
  };

  try {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
        Promise.resolve(handler(req, res)).then(resolve, reject);
      };
      Promise.resolve(authorize(req, res, next)).then(() => {
        if (!nextCalled) resolve();
      }, reject);
    });
    console.log('FINAL_STATUS', res.statusCode);
    console.log('FINAL_BODY', res.body);
  } catch (error) {
    console.error('OUTER_ERROR', error);
  }

  await Medication.findByIdAndDelete(med._id);
  await User.findByIdAndDelete(user._id);
  await mongoose.disconnect();
})();
