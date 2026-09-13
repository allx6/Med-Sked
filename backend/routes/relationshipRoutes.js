const express = require('express');
const mongoose = require('mongoose');

const CaregiverRelationship = require('../models/CaregiverRelationship');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

const router = express.Router();


// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      message: 'Invalid or expired token.',
    });

  }
};


// =====================================================
// SEND CAREGIVER REQUEST
// POST /api/relationships/request
// =====================================================
//
// Caregiver searches for a patient by email or username
// and sends a connection request.
//
// Body:
// {
//   "patientIdentifier": "allen"
// }
//
// OR
//
// {
//   "patientIdentifier": "allen@gmail.com"
// }
//
// =====================================================

router.post(
  '/request',
  authenticateToken,
  async (req, res) => {

    try {

      // ---------------------------------------------
      // ONLY CAREGIVERS CAN SEND REQUESTS
      // ---------------------------------------------

      if (req.user.role !== 'caregiver') {

        return res.status(403).json({
          message:
            'Only caregivers can send caregiver requests.',
        });

      }


      const {
        patientIdentifier,
      } = req.body;


      if (!patientIdentifier) {

        return res.status(400).json({
          message:
            'Patient username or email is required.',
        });

      }


      const identifier =
        patientIdentifier
          .trim()
          .toLowerCase();


      // ---------------------------------------------
      // FIND PATIENT
      // ---------------------------------------------

      const patient =
        await User.findOne({
          $or: [
            {
              username: identifier,
            },
            {
              email: identifier,
            },
          ],
          role: 'patient',
        });


      if (!patient) {

        return res.status(404).json({
          message:
            'Patient account not found.',
        });

      }


      // ---------------------------------------------
      // PREVENT CAREGIVER FROM REQUESTING SELF
      // ---------------------------------------------

      if (
        patient._id.toString() ===
        req.user.userId
      ) {

        return res.status(400).json({
          message:
            'You cannot add yourself as a patient.',
        });

      }


      // ---------------------------------------------
      // CHECK EXISTING RELATIONSHIP
      // ---------------------------------------------

      const existingRelationship =
        await CaregiverRelationship.findOne({
          caregiver:
            req.user.userId,

          patient:
            patient._id,
        });


      if (existingRelationship) {

        if (
          existingRelationship.status ===
          'pending'
        ) {

          return res.status(409).json({
            message:
              'A caregiver request is already pending.',
          });

        }

        if (
          existingRelationship.status ===
          'active'
        ) {

          return res.status(409).json({
            message:
              'You are already connected to this patient.',
          });

        }

        if (
          existingRelationship.status ===
          'revoked'
        ) {

          existingRelationship.status =
            'pending';

          await existingRelationship.save();

          await createNotification({
            recipient: patient._id,
            type: 'caregiver_request',
            message: 'A caregiver has requested access to your medication information.',
            relatedEntityType: 'CaregiverRelationship',
            relatedEntityId: existingRelationship._id,
            dedupeKey: `caregiver_request:${existingRelationship._id}:${existingRelationship.updatedAt?.getTime() || Date.now()}`,
          });

          return res.status(201).json({

            message:
              'Caregiver request sent again.',

            relationship:
              existingRelationship,

          });

        }

      }


      // ---------------------------------------------
      // CREATE REQUEST
      // ---------------------------------------------

      const relationship =
        await CaregiverRelationship.create({

          caregiver:
            req.user.userId,

          patient:
            patient._id,

          status:
            'pending',

        });

      await createNotification({
        recipient: patient._id,
        type: 'caregiver_request',
        message: 'A caregiver has requested access to your medication information.',
        relatedEntityType: 'CaregiverRelationship',
        relatedEntityId: relationship._id,
        dedupeKey: `caregiver_request:${relationship._id}`,
      });


      res.status(201).json({

        message:
          'Caregiver request sent successfully.',

        relationship: {

          id:
            relationship._id,

          caregiver:
            relationship.caregiver,

          patient: {

            id:
              patient._id,

            username:
              patient.username,

            email:
              patient.email,

          },

          status:
            relationship.status,

        },

      });

    } catch (error) {

      console.error(
        'Send caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to send caregiver request.',
      });

    }

  }
);


// =====================================================
// GET MY INCOMING REQUESTS
// GET /api/relationships/requests
// =====================================================
//
// Patient:
//     Gets caregiver requests sent to them.
//
// Caregiver:
//     Gets requests they have sent.
//
// =====================================================

router.get(
  '/requests',
  authenticateToken,
  async (req, res) => {

    try {

      let relationships;


      // ---------------------------------------------
      // PATIENT REQUESTS
      // ---------------------------------------------

      if (
        req.user.role === 'patient'
      ) {

        relationships =
          await CaregiverRelationship
            .find({
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

      }


      // ---------------------------------------------
      // CAREGIVER REQUESTS
      // ---------------------------------------------

      else if (
        req.user.role === 'caregiver'
      ) {

        relationships =
          await CaregiverRelationship
            .find({
              caregiver:
                req.user.userId,
            })
            .populate(
              'patient',
              'username email role'
            )
            .sort({
              createdAt: -1,
            });

      }


      else {

        return res.status(403).json({
          message:
            'This account cannot access caregiver requests.',
        });

      }


      res.json({
        requests:
          relationships,
      });

    } catch (error) {

      console.error(
        'Get relationship requests error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve relationship requests.',
      });

    }

  }
);


// =====================================================
// ACCEPT CAREGIVER REQUEST
// PUT /api/relationships/:id/accept
// =====================================================
//
// ONLY THE PATIENT CAN ACCEPT.
//
// pending → active
//
// =====================================================

router.put(
  '/:id/accept',
  authenticateToken,
  async (req, res) => {

    try {

      if (
        req.user.role !== 'patient'
      ) {

        return res.status(403).json({
          message:
            'Only patients can accept caregiver requests.',
        });

      }


      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            'Invalid relationship ID.',
        });

      }


      const relationship =
        await CaregiverRelationship.findOne({
          _id:
            req.params.id,

          patient:
            req.user.userId,

          status:
            'pending',
        });


      if (!relationship) {

        return res.status(404).json({
          message:
            'Pending caregiver request not found.',
        });

      }


      relationship.status =
        'active';

      await relationship.save();

      await createNotification({
        recipient: relationship.caregiver,
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
          'Failed to accept caregiver request.',
      });

    }

  }
);


// =====================================================
// REJECT CAREGIVER REQUEST
// PUT /api/relationships/:id/reject
// =====================================================
//
// We use "revoked" instead of creating a "rejected"
// status because your schema currently supports:
//
// pending
// active
// revoked
//
// =====================================================

router.put(
  '/:id/reject',
  authenticateToken,
  async (req, res) => {

    try {

      if (
        req.user.role !== 'patient'
      ) {

        return res.status(403).json({
          message:
            'Only patients can reject caregiver requests.',
        });

      }


      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            'Invalid relationship ID.',
        });

      }


      const relationship =
        await CaregiverRelationship.findOne({
          _id:
            req.params.id,

          patient:
            req.user.userId,

          status:
            'pending',
        });


      if (!relationship) {

        return res.status(404).json({
          message:
            'Pending caregiver request not found.',
        });

      }


      relationship.status =
        'revoked';

      await relationship.save();


      res.json({

        message:
          'Caregiver request rejected.',

        relationship,

      });

    } catch (error) {

      console.error(
        'Reject caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to reject caregiver request.',
      });

    }

  }
);


// =====================================================
// GET MY PATIENTS
// GET /api/relationships/my-patients
// =====================================================
//
// Caregiver only.
//
// Returns all patients with an ACTIVE relationship.
//
// =====================================================

router.get(
  '/my-patients',
  authenticateToken,
  async (req, res) => {

    try {

      if (
        req.user.role !== 'caregiver'
      ) {

        return res.status(403).json({
          message:
            'Only caregivers can access their patients.',
        });

      }


      const relationships =
        await CaregiverRelationship
          .find({
            caregiver:
              req.user.userId,

            status:
              'active',
          })
          .populate(
            'patient',
            'username email role'
          )
          .sort({
            createdAt: -1,
          });


      const patients =
        relationships.map(
          (relationship) => ({

            relationshipId:
              relationship._id,

            patient:
              relationship.patient,

            status:
              relationship.status,

          })
        );


      res.json({
        patients,
      });

    } catch (error) {

      console.error(
        'Get my patients error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patients.',
      });

    }

  }
);


// =====================================================
// GET MY CAREGIVERS
// GET /api/relationships/my-caregivers
// =====================================================
//
// Patient only.
//
// Returns active caregivers.
//
// =====================================================

router.get(
  '/my-caregivers',
  authenticateToken,
  async (req, res) => {

    try {

      if (
        req.user.role !== 'patient'
      ) {

        return res.status(403).json({
          message:
            'Only patients can access their caregivers.',
        });

      }


      const relationships =
        await CaregiverRelationship
          .find({
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


      const caregivers =
        relationships.map(
          (relationship) => ({

            relationshipId:
              relationship._id,

            caregiver:
              relationship.caregiver,

            status:
              relationship.status,

          })
        );


      res.json({
        caregivers,
      });

    } catch (error) {

      console.error(
        'Get my caregivers error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve caregivers.',
      });

    }

  }
);


// =====================================================
// REMOVE CAREGIVER / PATIENT RELATIONSHIP
// DELETE /api/relationships/:id
// =====================================================
//
// Either the caregiver or patient can remove an
// ACTIVE relationship.
//
// We change it to "revoked" instead of deleting it.
// This preserves the history/audit trail.
//
// =====================================================

router.delete(
  '/:id',
  authenticateToken,
  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            'Invalid relationship ID.',
        });

      }


      const relationship =
        await CaregiverRelationship.findOne({
          _id:
            req.params.id,

          $or: [
            {
              caregiver:
                req.user.userId,
            },
            {
              patient:
                req.user.userId,
            },
          ],

          status:
            'active',
        });


      if (!relationship) {

        return res.status(404).json({
          message:
            'Active caregiver relationship not found.',
        });

      }


      relationship.status =
        'revoked';

      await relationship.save();


      res.json({

        message:
          'Caregiver relationship removed.',

        relationship,

      });

    } catch (error) {

      console.error(
        'Remove relationship error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to remove caregiver relationship.',
      });

    }

  }
);


module.exports = router;