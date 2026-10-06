const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Medication = require('./models/Medication');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ts = Date.now();
  const email = 'temp.refill.' + ts + '@example.com';
  const username = 'temprefill' + ts;
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

  console.log('CREATED_USER', user._id.toString());
  console.log('CREATED_MED', med._id.toString());
  console.log('BEFORE', med.quantityOnHand);

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json();
  console.log('LOGIN_STATUS', loginRes.status);
  const token = loginData.token;

  const refillUrl = 'http://localhost:5000/api/medications/' + med._id + '/refill';
  const refillRes = await fetch(refillUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ refillAmount: 10 }),
  });

  const refillText = await refillRes.text();
  console.log('REFILL_STATUS', refillRes.status);
  console.log('REFILL_BODY', refillText);

  const after = await Medication.findById(med._id);
  console.log('AFTER_QOH', after ? after.quantityOnHand : 'missing');

  await Medication.findByIdAndDelete(med._id);
  await User.findByIdAndDelete(user._id);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
