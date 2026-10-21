const Notification = require('../models/Notification');
const CaregiverRelationship = require('../models/CaregiverRelationship');
const Medication = require('../models/Medication');
const { getUsableMedicationQuantity } = require('../utils/medicationInventory');
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

  const sourceDoseNotification = type === 'missed_dose'
    && relatedEntityType === 'DoseRecord'
    && relatedEntityId;
  const notificationDedupeKey = sourceDoseNotification
    ? `missed_dose:${relatedEntityId}:recipient:${recipient}`
    : dedupeKey;

  try {
    if (sourceDoseNotification) {
      const existingNotification = await Notification.findOne({
        recipient,
        type,
        relatedEntityType,
        relatedEntityId,
      })
        .select('_id')
        .lean();

      if (existingNotification) {
        return existingNotification;
      }
    }

    return await Notification.create({
      recipient,
      type,
      message,
      relatedEntityType,
      relatedEntityId,
      dedupeKey: notificationDedupeKey,
    });
  } catch (error) {
    if (error.code === 11000 && notificationDedupeKey) {
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
  notifyPatient = true,
}) => {
  const patientNotification = notifyPatient
    ? await createNotification({
      recipient: patientId,
      type,
      message: patientMessage,
      relatedEntityType,
      relatedEntityId,
      dedupeKey,
    })
    : null;

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

const notifyLowRefill = async ({ medication, triggerId }) => {
  const quantityOnHand = Number(getUsableMedicationQuantity(medication));
  const refillThreshold = Number(medication?.refillThreshold ?? 0);

  if (
    !medication?._id
    || !medication.userId
    || !triggerId
    || !Number.isFinite(quantityOnHand)
    || !Number.isFinite(refillThreshold)
    || quantityOnHand > refillThreshold
    || medication.lowRefillNotified
  ) {
    return null;
  }

  const notificationClaim = await Medication.updateOne(
    {
      _id: medication._id,
      userId: medication.userId,
      lowRefillNotified: { $ne: true },
    },
    { $set: { lowRefillNotified: true } }
  );

  if (notificationClaim.modifiedCount !== 1) {
    return null;
  }

  const patientNotification = await createMedicationNotifications({
    patientId: medication.userId,
    type: 'low_refill',
    patientMessage: `${medication.name} is low on refill stock.`,
    caregiverMessage: (patientName) => `${patientName}'s ${medication.name} is low on refill stock.`,
    relatedEntityType: 'Medication',
    relatedEntityId: medication._id,
    dedupeKey: `low_refill:${medication._id}:${triggerId}`,
  });

  if (!patientNotification) {
    await Medication.updateOne(
      {
        _id: medication._id,
        userId: medication.userId,
        lowRefillNotified: true,
      },
      { $set: { lowRefillNotified: false } }
    );
  }

  return patientNotification;
};

module.exports = {
  createNotification,
  createMedicationNotifications,
  notifyLowRefill,
};