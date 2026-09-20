// =====================================================
// API CONFIGURATION
// =====================================================

import { API_URL } from './config';


// =====================================================
// HELPER
// =====================================================

const handleResponse = async (response, options = {}) => {
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      `Request failed with status ${response.status}`;

    if (response.status === 401 && !options.isLogin) {
      throw new Error('Your session has expired. Please log in again.');
    }

    if (response.status === 403) {
      throw new Error(message || 'You are not authorized to access this patient.');
    }

    if (response.status >= 500) {
      throw new Error('Unable to connect to the Med-Sked server. Check that the backend is running and that your device is on the same network.');
    }

    throw new Error(message);
  }

  return data;
};


// =====================================================
// AUTHORIZATION HEADER
// =====================================================

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});


// =====================================================
// AUTH
// =====================================================

// -----------------------------------------------------
// LOGIN
// POST /api/auth/login
// -----------------------------------------------------

export const loginUser = async (email, password) => {
  const response = await fetch(
    `${API_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  return handleResponse(response, { isLogin: true });
};


// -----------------------------------------------------
// REGISTER
// POST /api/auth/register
// -----------------------------------------------------

export const registerUser = async (
  name,
  email,
  password,
  role
) => {
  const response = await fetch(
    `${API_URL}/api/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
      }),
    }
  );

  return handleResponse(response);
};


// =====================================================
// MEDICATIONS
// =====================================================

// -----------------------------------------------------
// GET MEDICATIONS
// GET /api/medications
// -----------------------------------------------------

export const getMedications = async (token) => {
  const response = await fetch(
    `${API_URL}/api/medications`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET ONE MEDICATION
// GET /api/medications/:medicationId
// -----------------------------------------------------

export const getMedication = async (
  token,
  medicationId
) => {
  const response = await fetch(
    `${API_URL}/api/medications/${medicationId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// CREATE MEDICATION
// POST /api/medications
// -----------------------------------------------------

export const createMedication = async (
  token,
  medication,
  patientId
) => {
  const patientQuery = patientId
    ? `?patientId=${encodeURIComponent(patientId)}`
    : '';

  const response = await fetch(
    `${API_URL}/api/medications${patientQuery}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(medication),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// UPDATE MEDICATION
// PUT /api/medications/:medicationId
// -----------------------------------------------------

export const updateMedication = async (
  token,
  medicationId,
  medication,
  patientId
) => {
  const patientQuery = patientId
    ? `?patientId=${encodeURIComponent(patientId)}`
    : '';

  const response = await fetch(
    `${API_URL}/api/medications/${medicationId}${patientQuery}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(medication),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// DELETE MEDICATION
// DELETE /api/medications/:medicationId
// -----------------------------------------------------

export const deleteMedication = async (
  token,
  medicationId,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/medications/${medicationId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: patientId ? JSON.stringify({ patientId }) : undefined,
    }
  );

  return handleResponse(response);
};


// =====================================================
// SCHEDULES
// =====================================================

// -----------------------------------------------------
// CREATE MEDICATION SCHEDULE
// POST /api/schedules
// -----------------------------------------------------

export const createSchedule = async (
  token,
  schedule,
  patientId
) => {
  const patientQuery = patientId
    ? `?patientId=${encodeURIComponent(patientId)}`
    : '';

  const response = await fetch(
    `${API_URL}/api/schedules${patientQuery}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(schedule),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET MEDICATION SCHEDULES
// GET /api/schedules
// -----------------------------------------------------

export const getSchedules = async (token) => {
  const response = await fetch(
    `${API_URL}/api/schedules`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET ONE SCHEDULE
// GET /api/schedules/:scheduleId
// -----------------------------------------------------

export const getSchedule = async (
  token,
  scheduleId
) => {
  const response = await fetch(
    `${API_URL}/api/schedules/${scheduleId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// UPDATE MEDICATION SCHEDULE
// PUT /api/schedules/:scheduleId
// -----------------------------------------------------

export const updateSchedule = async (
  token,
  scheduleId,
  schedule,
  patientId
) => {
  const patientQuery = patientId
    ? `?patientId=${encodeURIComponent(patientId)}`
    : '';

  const response = await fetch(
    `${API_URL}/api/schedules/${scheduleId}${patientQuery}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(schedule),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// DELETE MEDICATION SCHEDULE
// DELETE /api/schedules/:scheduleId
// -----------------------------------------------------

export const deleteSchedule = async (
  token,
  scheduleId,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/schedules/${scheduleId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: patientId ? JSON.stringify({ patientId }) : undefined,
    }
  );

  return handleResponse(response);
};


// =====================================================
// DOSE RECORDS
// =====================================================

// -----------------------------------------------------
// GET ALL DOSE RECORDS
// GET /api/doses
// -----------------------------------------------------

export const getDoseRecords = async (token) => {
  const response = await fetch(
    `${API_URL}/api/doses`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET ONE DOSE RECORD
// GET /api/doses/:doseId
// -----------------------------------------------------

export const getDoseRecord = async (
  token,
  doseId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// CREATE DOSE RECORD
// POST /api/doses
// -----------------------------------------------------

export const createDoseRecord = async (
  token,
  dose
) => {
  const response = await fetch(
    `${API_URL}/api/doses`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(dose),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GENERATE TODAY'S DOSES
// POST /api/doses/generate-today
// -----------------------------------------------------

export const generateTodayDoses = async (token) => {
  const response = await fetch(
    `${API_URL}/api/doses/generate-today`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GENERATE DOSES
// Compatibility alias
// -----------------------------------------------------

export const generateDoses = async (token) => {
  return generateTodayDoses(token);
};


// -----------------------------------------------------
// MARK DOSE AS TAKEN
// PUT /api/doses/:doseId/take
// -----------------------------------------------------

export const takeDose = async (
  token,
  doseId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}/take`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// MARK DOSE AS SKIPPED
// PUT /api/doses/:doseId/skip
// -----------------------------------------------------

export const skipDose = async (
  token,
  doseId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}/skip`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// CAREGIVER MARK DOSE AS TAKEN
// PUT /api/doses/:doseId/take
// -----------------------------------------------------

export const takePatientDose = async (
  token,
  doseId,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}/take`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ patientId }),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// CAREGIVER MARK DOSE AS SKIPPED
// PUT /api/doses/:doseId/skip
// -----------------------------------------------------

export const skipPatientDose = async (
  token,
  doseId,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}/skip`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ patientId }),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// DELETE DOSE RECORD
// DELETE /api/doses/:doseId
// -----------------------------------------------------

export const deleteDoseRecord = async (
  token,
  doseId
) => {
  const response = await fetch(
    `${API_URL}/api/doses/${doseId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// CAREGIVER — PATIENTS
// =====================================================

// -----------------------------------------------------
// GET MY PATIENTS
// GET /api/caregiver/patients
// -----------------------------------------------------

export const getMyPatients = async (token) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET ONE PATIENT
// GET /api/caregiver/patients/:patientId
// -----------------------------------------------------

export const getPatient = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET PATIENT MEDICATIONS
// GET /api/caregiver/patients/:patientId/medications
// -----------------------------------------------------

export const getPatientMedications = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}/medications`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET PATIENT SCHEDULES
// GET /api/caregiver/patients/:patientId/schedules
// -----------------------------------------------------

export const getPatientSchedules = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}/schedules`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET PATIENT DOSES
// GET /api/caregiver/patients/:patientId/doses
// -----------------------------------------------------

export const getPatientDoses = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}/doses`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET PATIENT OVERVIEW
// GET /api/caregiver/patients/:patientId/overview
// -----------------------------------------------------

export const getPatientOverview = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}/overview`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET PATIENT ADHERENCE
// GET /api/caregiver/patients/:patientId/adherence
// -----------------------------------------------------

export const getPatientAdherence = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/patients/${patientId}/adherence`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// CAREGIVER — SEARCH
// =====================================================

// -----------------------------------------------------
// GET /api/caregiver/search-patient?email=...
// -----------------------------------------------------

export const searchPatient = async (
  token,
  identifier
) => {
  const query = encodeURIComponent(
    String(identifier || '').trim()
  );

  const response = await fetch(
    `${API_URL}/api/caregiver/search-patient?identifier=${query}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// CAREGIVER — REQUESTS
// =====================================================

// -----------------------------------------------------
// SEND REQUEST
// POST /api/caregiver/requests
// -----------------------------------------------------

export const sendCaregiverRequest = async (
  token,
  patientId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({
        patientId,
      }),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET MY REQUESTS
// GET /api/caregiver/requests
// -----------------------------------------------------

export const getCaregiverRequests = async (token) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/requests`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// CANCEL REQUEST
// DELETE /api/caregiver/requests/:relationshipId
// -----------------------------------------------------

export const cancelCaregiverRequest = async (
  token,
  relationshipId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/requests/${relationshipId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// REVOKE RELATIONSHIP
// PUT /api/caregiver/relationships/:relationshipId/revoke
// -----------------------------------------------------

export const revokeCaregiverRelationship = async (
  token,
  relationshipId
) => {
  const response = await fetch(
    `${API_URL}/api/caregiver/relationships/${relationshipId}/revoke`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// PATIENT — CAREGIVER RELATIONSHIPS
// =====================================================

// -----------------------------------------------------
// GET CAREGIVER REQUESTS FOR PATIENT
// GET /api/patient/caregiver-requests
// -----------------------------------------------------

export const getCaregiverRequestsForPatient = async (
  token
) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregiver-requests`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// ACCEPT CAREGIVER
// PUT /api/patient/caregiver-requests/:relationshipId/accept
// -----------------------------------------------------

export const acceptCaregiverRequest = async (
  token,
  relationshipId
) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregiver-requests/${relationshipId}/accept`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// REJECT CAREGIVER
// DELETE /api/patient/caregiver-requests/:relationshipId
// -----------------------------------------------------

export const rejectCaregiverRequest = async (
  token,
  relationshipId
) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregiver-requests/${relationshipId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// GET MY CAREGIVERS
// GET /api/patient/caregivers
// -----------------------------------------------------

export const getMyCaregivers = async (token) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregivers`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// UPDATE CAREGIVER PERMISSION
// PUT /api/patient/caregivers/:relationshipId/permission
// -----------------------------------------------------

export const updateCaregiverPermission = async (
  token,
  relationshipId,
  permission
) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregivers/${relationshipId}/permission`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ permission }),
    }
  );

  return handleResponse(response);
};


// -----------------------------------------------------
// REMOVE CAREGIVER
// PUT /api/patient/caregivers/:relationshipId/revoke
// -----------------------------------------------------

export const removeCaregiver = async (
  token,
  relationshipId
) => {
  const response = await fetch(
    `${API_URL}/api/patient/caregivers/${relationshipId}/revoke`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// NOTIFICATIONS
// =====================================================

export const getNotifications = async (token) => {
  const response = await fetch(
    `${API_URL}/api/notifications`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};

export const getUnreadNotificationCount = async (token) => {
  const response = await fetch(
    `${API_URL}/api/notifications/unread-count`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};

export const markNotificationRead = async (token, notificationId) => {
  const response = await fetch(
    `${API_URL}/api/notifications/${notificationId}/read`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};

export const markAllNotificationsRead = async (token) => {
  const response = await fetch(
    `${API_URL}/api/notifications/read-all`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// ADHERENCE ANALYTICS
// GET /api/analytics/adherence
// =====================================================

export const getAdherenceAnalytics = async (
  token,
  options = {}
) => {
  const params = new URLSearchParams();

  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  if (options.patientId) params.set('patientId', options.patientId);

  const query = params.toString();
  const response = await fetch(
    `${API_URL}/api/analytics/adherence${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return handleResponse(response);
};


// =====================================================
// EXPORT API URL
// =====================================================

export { API_URL };