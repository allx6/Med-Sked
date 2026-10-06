const Notification = require('../models/Notification');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');

const logMedicationNotificationFailure = ({
  type,
  patientId,
  caregiverId,
  operation,
  error,
}) => {
  const metadata = {
    notificationType: type,
    patientId: String(patientId),
    operation,
    errorName: error?.name || 'UnknownError',
  };

  if (caregiverId) {
    metadata.caregiverId = String(caregiverId);
  }

  if (Number.isInteger(error?.code)) {
    metadata.errorCode = error.code;
  }

  console.error('Medication notification operation failed:', metadata);
};

const createNotification = async ({
  recipient,
  type,
  message,
  relatedEntityType,
  relatedEntityId,
  dedupeKey,
  failureContext,
}) => {
  if (!recipient || !type || !message) {
    return null;
  }

  try {
    return await Notification.create({
      recipient,
      type,
      message,
      relatedEntityType,
      relatedEntityId,
      dedupeKey,
    });
  } catch (error) {
    if (error.code === 11000 && dedupeKey) {
      return null;
    }
    if (failureContext) {
      logMedicationNotificationFailure({
        type,
        patientId: failureContext.patientId,
        caregiverId: failureContext.caregiverId,
        operation: 'create-caregiver-notification',
        error,
      });
    } else {
      console.error('Create notification failed:', {
        notificationType: type,
        operation: 'create-notification',
        errorName: error?.name || 'UnknownError',
        ...(Number.isInteger(error?.code) ? { errorCode: error.code } : {}),
      });
    }
    return null;
  }
};

const createMedicationNotifications = async ({
  patientId,
  type,
  patientMessage,
  caregiverMessage,
  relatedEntityType,
  relatedEntityId,
  dedupeKey,
}) => {
  const patientNotification = await createNotification({
    recipient: patientId,
    type,
    message: patientMessage,
    relatedEntityType,
    relatedEntityId,
    dedupeKey,
  });

  let patient;
  let relationships;

  try {
    [patient, relationships] = await Promise.all([
      User.findById(patientId).select('username').lean(),
      CaregiverRelationship.find({
        patient: patientId,
        status: 'active',
      }).select('caregiver').lean(),
    ]);
  } catch (error) {
    logMedicationNotificationFailure({
      type,
      patientId,
      operation: 'find-active-caregiver-recipients',
      error,
    });
    return patientNotification;
  }

  if (!patient?.username) {
    logMedicationNotificationFailure({
      type,
      patientId,
      operation: 'find-patient-identity',
      error: { name: 'PatientUsernameUnavailable' },
    });
    return patientNotification;
  }

  const patientName = patient.username.charAt(0).toUpperCase()
    + patient.username.slice(1);
  const caregiverIds = [...new Set(
    relationships
      .map((relationship) => relationship.caregiver?._id || relationship.caregiver)
      .filter(Boolean)
      .map((caregiverId) => String(caregiverId))
  )];

  await Promise.all(caregiverIds.map(async (caregiverId) => {
    try {
      await createNotification({
        recipient: caregiverId,
        type,
        message: caregiverMessage(patientName),
        relatedEntityType,
        relatedEntityId,
        dedupeKey: dedupeKey
          ? `${dedupeKey}:caregiver:${caregiverId}`
          : undefined,
        failureContext: {
          patientId,
          caregiverId,
        },
      });
    } catch (error) {
      logMedicationNotificationFailure({
        type,
        patientId,
        caregiverId,
        operation: 'build-caregiver-notification',
        error,
      });
    }
  }));

  return patientNotification;
};

module.exports = {
  createNotification,
  createMedicationNotifications,
};