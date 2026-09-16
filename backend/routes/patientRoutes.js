const express = require('express');

const User = require('../models/User');
const CaregiverRelationship = require('../models/CaregiverRelationship');

const authMiddleware = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');

const router = express.Router();

const caregiverPermissions = [
  'VIEW_ONLY',
  'ADHERENCE_SUPPORT',
];


// =====================================================
// GET CAREGIVER REQUESTS
// GET /api/patient/caregiver-requests
// =====================================================

router.get(
  '/caregiver-requests',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const requests =
        await CaregiverRelationship.find({
          patient:
            req.user.userId,

          status:
            'pending',
        })
          .populate(
            'caregiver',
            'username email role'
          )
          .sort({
            createdAt: -1,
          });

      res.json(requests);

    } catch (error) {

      console.error(
        'Get caregiver requests error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve caregiver requests',
      });
    }
  }
);


// =====================================================
// ACCEPT CAREGIVER REQUEST
// PUT /api/patient/caregiver-requests/:relationshipId/accept
// =====================================================

router.put(
  '/caregiver-requests/:relationshipId/accept',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const relationship =
        await CaregiverRelationship.findOne({

          _id:
            req.params.relationshipId,

          patient:
            req.user.userId,

          status:
            'pending',

        }).populate(
          'caregiver',
          'username email role'
        );

      if (!relationship) {

        return res.status(404).json({
          message:
            'Caregiver request not found',
        });

      }

      relationship.status =
        'active';

      await relationship.save();

      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CAREGIVER_REQUEST_ACCEPTED',
        targetType: 'CAREGIVER_RELATIONSHIP',
        targetId: relationship._id,
        details: {
          caregiverId: relationship.caregiver._id || relationship.caregiver,
          patientId: relationship.patient,
          previousStatus: 'pending',
          newStatus: relationship.status,
        },
      });

      await createNotification({
        recipient: relationship.caregiver._id || relationship.caregiver,
        type: 'caregiver_request_accepted',
        message: 'Your caregiver request was accepted.',
        relatedEntityType: 'CaregiverRelationship',
        relatedEntityId: relationship._id,
        dedupeKey: `caregiver_request_accepted:${relationship._id}`,
      });

      res.json({

        message:
          'Caregiver request accepted.',

        relationship,

      });

    } catch (error) {

      console.error(
        'Accept caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to accept caregiver request',
      });
    }
  }
);


// =====================================================
// REJECT CAREGIVER REQUEST
// DELETE /api/patient/caregiver-requests/:relationshipId
// =====================================================

router.delete(
  '/caregiver-requests/:relationshipId',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const relationship =
        await CaregiverRelationship.findOne({

          _id:
            req.params.relationshipId,

          patient:
            req.user.userId,

          status:
            'pending',

        });

      if (!relationship) {

        return res.status(404).json({
          message:
            'Caregiver request not found',
        });

      }

      await CaregiverRelationship.deleteOne({
        _id:
          relationship._id,
      });

      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CAREGIVER_REQUEST_DECLINED',
        targetType: 'CAREGIVER_RELATIONSHIP',
        targetId: relationship._id,
        details: {
          caregiverId: relationship.caregiver,
          patientId: relationship.patient,
          previousStatus: 'pending',
          newStatus: 'deleted',
        },
      });

      res.json({
        message:
          'Caregiver request rejected.',
      });

    } catch (error) {

      console.error(
        'Reject caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to reject caregiver request',
      });
    }
  }
);


// =====================================================
// GET MY CAREGIVERS
// GET /api/patient/caregivers
// =====================================================

router.get(
  '/caregivers',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const relationships =
        await CaregiverRelationship.find({

          patient:
            req.user.userId,

          status:
            'active',

        })
          .populate(
            'caregiver',
            'username email role'
          )
          .sort({
            createdAt: -1,
          });

      res.json(relationships);

    } catch (error) {

      console.error(
        'Get caregivers error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve caregivers',
      });
    }
  }
);


// =====================================================
// UPDATE CAREGIVER PERMISSION
// PUT /api/patient/caregivers/:relationshipId/permission
// =====================================================

router.put(
  '/caregivers/:relationshipId/permission',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const { permission } = req.body;

      if (!caregiverPermissions.includes(permission)) {
        return res.status(400).json({
          message: 'Invalid caregiver permission',
        });
      }

      const relationship = await CaregiverRelationship.findOne({
        _id: req.params.relationshipId,
        patient: req.user.userId,
        status: 'active',
      }).populate('caregiver', 'username email role');

      if (!relationship) {
        return res.status(404).json({
          message: 'Caregiver relationship not found',
        });
      }

      relationship.permission = permission;
      await relationship.save();

      res.json({
        message: 'Caregiver permission updated.',
        relationship,
      });
    } catch (error) {
      console.error('Update caregiver permission error:', error);
      res.status(500).json({
        message: 'Failed to update caregiver permission',
      });
    }
  }
);


// =====================================================
// REMOVE CAREGIVER
// PUT /api/patient/caregivers/:relationshipId/revoke
// =====================================================

router.put(
  '/caregivers/:relationshipId/revoke',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'patient') {
        return res.status(403).json({
          message: 'Patient access required',
        });
      }

      const relationship =
        await CaregiverRelationship.findOne({

          _id:
            req.params.relationshipId,

          patient:
            req.user.userId,

          status:
            'active',

        });

      if (!relationship) {

        return res.status(404).json({
          message:
            'Caregiver relationship not found',
        });

      }

      relationship.status =
        'revoked';

      await relationship.save();

      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CAREGIVER_RELATIONSHIP_REVOKED',
        targetType: 'CAREGIVER_RELATIONSHIP',
        targetId: relationship._id,
        details: {
          caregiverId: relationship.caregiver,
          patientId: relationship.patient,
          previousStatus: 'active',
          newStatus: relationship.status,
        },
      });

      res.json({

        message:
          'Caregiver access removed.',

        relationship,

      });

    } catch (error) {

      console.error(
        'Remove caregiver error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to remove caregiver',
      });
    }
  }
);


module.exports = router;