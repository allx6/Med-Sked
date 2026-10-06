const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

class ProvisioningError extends Error {}

const getEmailArgument = (args) => {
  let email;
  if (args.length === 1 && args[0].startsWith('--email=')) {
    email = args[0].slice('--email='.length);
  } else if (args.length === 2 && args[0] === '--email') {
    email = args[1];
  } else {
    throw new ProvisioningError('Provide one valid email using --email <address> or --email=<address>.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new ProvisioningError('Provide one valid email using --email <address> or --email=<address>.');
  }

  return email.trim().toLowerCase();
};

const promoteVerifiedUser = async (email) => {
  if (!process.env.MONGODB_URI) {
    throw new ProvisioningError('Database configuration is unavailable.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email });
  if (!user) {
    throw new ProvisioningError('No existing user was found for that email.');
  }
  if (user.emailVerified !== true) {
    throw new ProvisioningError('This user must verify their email before promotion.');
  }
  if (user.role === 'admin') {
    console.log('The verified user is already an Admin.');
    return;
  }

  const result = await User.updateOne(
    {
      _id: user._id,
      email,
      emailVerified: true,
    },
    {
      $set: {
        role: 'admin',
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new ProvisioningError('The user changed during promotion. No account was modified.');
  }

  console.log('Verified user promoted to Admin.');
};

const run = async () => {
  try {
    const email = getEmailArgument(process.argv.slice(2));
    await promoteVerifiedUser(email);
  } catch (error) {
    if (error instanceof ProvisioningError) {
      console.error(`Admin provisioning failed: ${error.message}`);
    } else {
      console.error('Admin provisioning failed due to a database or configuration error.');
    }
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {
        console.error('Database connection cleanup failed.');
        process.exitCode = 1;
      });
    }
  }
};

run();
