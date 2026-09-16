const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'password123';

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const existingAdmin = await User.findOne({
    email: ADMIN_EMAIL,
  });

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      throw new Error('admin@gmail.com already belongs to a non-admin account.');
    }

    console.log('Development Admin account already exists.');
    return;
  }

  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await User.create({
    username: 'admin',
    email: ADMIN_EMAIL,
    password,
    role: 'admin',
  });

  console.log('Development Admin account created.');
};

seedAdmin()
  .catch((error) => {
    console.error('Development Admin seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
