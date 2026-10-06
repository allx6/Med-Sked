const mongoose = require('mongoose');
require('dotenv').config();

require('./models/Medication');
const { detectMissedDoses } = require('./services/missedDoseService');
const { validateEncryptionKey } = require('./services/encryptionService');

try {
  const keyFingerprint = validateEncryptionKey();
  console.info('Notification encryption configuration:', {
    process: 'worker',
    environment: process.env.NODE_ENV || 'development',
    keyFingerprint,
  });
} catch (error) {
  console.error(`Encryption configuration error: ${error.message}`);
  process.exit(1);
}

const runMissedDoseDetection = async () => {
  try {
    const result = await detectMissedDoses();
    if (result.markedMissed > 0) {
      console.log('Missed-dose detection:', result);
    }
  } catch (error) {
    console.error('Missed-dose detection error:', error);
  }
};

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    runMissedDoseDetection();
    setInterval(runMissedDoseDetection, 60 * 1000);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });