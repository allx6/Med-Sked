const CaregiverRelationship = require('../models/CaregiverRelationship');
const mongoose = require('mongoose');

const caregiverPermissions = [
  'VIEW_ONLY',
  'ADHERENCE_SUPPORT',
];

const getTargetPatientId = (req) => (
  req.params?.patientId ||
  req.query?.patientId ||
  req.body?.patientId
);

const findActiveRelationship = async (req, res) => {
  const patientId = getTargetPatientId(req);

  if (!patientId) {
    res.status(400).json({
      message: 'Patient ID is required',
    });
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    res.status(400).json({
      message: 'Invalid patient ID',
    });
    return null;
  }

  const relationship = await CaregiverRelationship.findOne({
    caregiver: req.user.userId,
    patient: patientId,
    status: 'active',
  });

  if (!relationship) {
    res.status(403).json({
      message: 'You are not authorized to access this patient.',
    });
    return null;
  }

  return relationship;
};

const caregiverMiddleware = async (req, res, next) => {
  try {
    // =====================================================
    // CHECK AUTHENTICATION
    // =====================================================

    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }


    // =====================================================
    // CHECK CAREGIVER ROLE
    // =====================================================

    if (req.user.role !== 'caregiver') {
      return res.status(403).json({
        message: 'Caregiver access required',
      });
    }


    // =====================================================
    // GET PATIENT ID
    // =====================================================

    const relationship = await findActiveRelationship(req, res);

    if (!relationship) {
      return;
    }


    // =====================================================
    // STORE RELATIONSHIP
    // =====================================================

    req.caregiverRelationship =
      relationship;


    next();

  } catch (error) {

    console.error(
      'Caregiver middleware error:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to verify caregiver access',
    });
  }
};


module.exports =
  caregiverMiddleware;

module.exports.requirePermission = (permission) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    if (req.user.role !== 'caregiver') {
      return res.status(403).json({
        message: 'Caregiver access required',
      });
    }

    if (!caregiverPermissions.includes(permission)) {
      return res.status(500).json({
        message: 'Invalid caregiver permission configuration',
      });
    }

    const relationship = await findActiveRelationship(req, res);

    if (!relationship) {
      return;
    }

    const effectivePermission = relationship.permission || 'VIEW_ONLY';

    if (effectivePermission !== permission) {
      return res.status(403).json({
        message: `${permission} permission required`,
      });
    }

    req.caregiverRelationship = relationship;
    next();
  } catch (error) {
    console.error('Caregiver permission error:', error);
    return res.status(500).json({
      message: 'Failed to verify caregiver permission',
    });
  }
};