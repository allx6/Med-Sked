const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const doseRoutes = require('./routes/doseRoutes');
const caregiverRoutes = require('./routes/caregiverRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const patientRoutes = require('./routes/patientRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminPrivilegedActionRoutes = require('./routes/adminPrivilegedActionRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { validateEncryptionKey } = require('./services/encryptionService');

const app = express();
app.set('trust proxy', 1);


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(helmet());

app.use(cors());

app.use(
  express.json()
);


// =====================================================
// ROUTES
// =====================================================

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/medications',
  medicationRoutes
);

app.use(
  '/api/schedules',
  scheduleRoutes
);

app.use(
  '/api/doses',
  doseRoutes
);

app.use(
  '/api/caregiver',
  caregiverRoutes
);

app.use(
  '/api/relationships',
  relationshipRoutes
);

app.use(
  '/api/patient',
  patientRoutes
);

app.use(
  '/api/notifications',
  notificationRoutes
);

app.use(
  '/api/analytics',
  analyticsRoutes
);

app.use(
  '/api/admin',
  adminRoutes
);

app.use(
  '/api/admin/privileged-action-requests',
  adminPrivilegedActionRoutes
);

app.use(
  '/api/ai',
  aiRoutes
);

// =====================================================
// TEST ROUTE
// =====================================================

app.get(
  '/',
  (req, res) => {
    res.json({
      message:
        'MedSked API is running',
    });
  }
);

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error.message);

  res.status(500).json({
    message: 'Internal server error',
  });
});


// =====================================================
// DATABASE
// =====================================================

try {
  const keyFingerprint = validateEncryptionKey();
  console.info('Notification encryption configuration:', {
    process: 'server',
    environment: process.env.NODE_ENV || 'development',
    keyFingerprint,
  });
} catch (error) {
  console.error(`Encryption configuration error: ${error.message}`);
  process.exit(1);
}

mongoose
  .connect(
    process.env.MONGODB_URI
  )
  .then(() => {

    console.log(
      'MongoDB connected'
    );

    const PORT =
      process.env.PORT || 5000;

    app.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          `Server running at http://localhost:${PORT}`
        );

      }
    );

  })
  .catch((error) => {

    console.error(
      'MongoDB connection error:',
      error
    );

  });