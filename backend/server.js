const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
const { detectMissedDoses } = require('./services/missedDoseService');

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

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


// =====================================================
// DATABASE
// =====================================================

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

        runMissedDoseDetection();
        setInterval(runMissedDoseDetection, 60 * 1000);

      }
    );

  })
  .catch((error) => {

    console.error(
      'MongoDB connection error:',
      error
    );

  });