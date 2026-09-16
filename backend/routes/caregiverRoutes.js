const express = require('express');

const User = require('../models/User');
const Medication = require('../models/Medication');
const MedicationSchedule = require('../models/MedicationSchedule');
const DoseRecord = require('../models/DoseRecord');
const CaregiverRelationship = require('../models/CaregiverRelationship');

const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');
const { createNotification } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');

const router = express.Router();


// =====================================================
// GET CAREGIVER'S PATIENTS
// GET /api/caregiver/patients
// =====================================================

router.get(
  '/patients',
  authMiddleware,
  async (req, res) => {

    try {

      // -------------------------------------------------
      // CHECK CAREGIVER ROLE
      // -------------------------------------------------

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }


      // -------------------------------------------------
      // FIND ACTIVE PATIENT RELATIONSHIPS
      // -------------------------------------------------

      const relationships =
        await CaregiverRelationship.find({
          caregiver: req.user.userId,
          status: 'active',
        })
          .populate(
            'patient',
            'username email patientId role'
          )
          .sort({
            createdAt: -1,
          });


      // -------------------------------------------------
      // FORMAT PATIENT LIST
      // -------------------------------------------------

      const patients =
        relationships.map(
          relationship => ({

            relationshipId:
              relationship._id,

            patient:
              relationship.patient,

            status:
              relationship.status,

            permission:
              relationship.permission || 'VIEW_ONLY',

            createdAt:
              relationship.createdAt,

          })
        );


      res.json(patients);

    } catch (error) {

      console.error(
        'Get caregiver patients error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patients',
      });
    }
  }
);


// =====================================================
// GET ONE PATIENT
// GET /api/caregiver/patients/:patientId
// =====================================================

router.get(
  '/patients/:patientId',
  authMiddleware,
  caregiverMiddleware,
  async (req, res) => {

    try {

      const patient =
        await User.findOne({
          _id:
            req.params.patientId,

          role:
            'patient',
        })
          .select(
            '_id username email role createdAt'
          );


      if (!patient) {

        return res.status(404).json({
          message:
            'Patient not found',
        });

      }


      res.json({
        patient,

        relationship:
          req.caregiverRelationship,

      });

    } catch (error) {

      console.error(
        'Get patient error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patient',
      });
    }
  }
);


// =====================================================
// GET PATIENT MEDICATIONS
// GET /api/caregiver/patients/:patientId/medications
// =====================================================

router.get(
  '/patients/:patientId/medications',
  authMiddleware,
  caregiverMiddleware,
  async (req, res) => {

    try {

      const medications =
        await Medication.find({
          userId:
            req.params.patientId,
        })
          .sort({
            createdAt: -1,
          });


      res.json(medications);

    } catch (error) {

      console.error(
        'Get patient medications error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patient medications',
      });
    }
  }
);


// =====================================================
// GET PATIENT SCHEDULES
// GET /api/caregiver/patients/:patientId/schedules
// =====================================================

router.get(
  '/patients/:patientId/schedules',
  authMiddleware,
  caregiverMiddleware,
  async (req, res) => {

    try {

      const schedules =
        await MedicationSchedule.find({
          userId:
            req.params.patientId,
        })
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .sort({
            time: 1,
          });


      res.json(schedules);

    } catch (error) {

      console.error(
        'Get patient schedules error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patient schedules',
      });
    }
  }
);


// =====================================================
// GET PATIENT DOSE HISTORY
// GET /api/caregiver/patients/:patientId/doses
// =====================================================

router.get(
  '/patients/:patientId/doses',
  authMiddleware,
  caregiverMiddleware,
  async (req, res) => {

    try {

      const doses =
        await DoseRecord.find({
          userId:
            req.params.patientId,
        })
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .populate(
            'scheduleId',
            'time dose days startDate endDate enabled'
          )
          .sort({
            scheduledDate: -1,
            scheduledTime: 1,
          });


      res.json(doses);

    } catch (error) {

      console.error(
        'Get patient doses error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patient dose history',
      });
    }
  }
);


// =====================================================
// GET PATIENT OVERVIEW
// GET /api/caregiver/patients/:patientId/overview
// =====================================================

router.get(
  '/patients/:patientId/overview',
  authMiddleware,
  caregiverMiddleware,
  async (req, res) => {

    try {

      const patientId =
        req.params.patientId;


      // -------------------------------------------------
      // GET PATIENT
      // -------------------------------------------------

      const patient =
        await User.findOne({
          _id:
            patientId,

          role:
            'patient',
        })
          .select(
            '_id username email role createdAt'
          );


      if (!patient) {

        return res.status(404).json({
          message:
            'Patient not found',
        });

      }


      // -------------------------------------------------
      // GET MEDICATIONS
      // -------------------------------------------------

      const medications =
        await Medication.find({
          userId:
            patientId,
        })
          .sort({
            createdAt: -1,
          });


      // -------------------------------------------------
      // GET SCHEDULES
      // -------------------------------------------------

      const schedules =
        await MedicationSchedule.find({
          userId:
            patientId,
        })
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .sort({
            time: 1,
          });


      // -------------------------------------------------
      // GET DOSE RECORDS
      // -------------------------------------------------

      const doses =
        await DoseRecord.find({
          userId:
            patientId,
        })
          .populate(
            'medicationId',
            'name dosage frequency'
          )
          .populate(
            'scheduleId',
            'time dose days startDate endDate enabled'
          )
          .sort({
            scheduledDate: -1,
            scheduledTime: 1,
          });


      // -------------------------------------------------
      // TODAY
      // -------------------------------------------------

      const now =
        new Date();

      const year =
        now.getFullYear();

      const month =
        String(
          now.getMonth() + 1
        ).padStart(2, '0');

      const day =
        String(
          now.getDate()
        ).padStart(2, '0');

      const today =
        `${year}-${month}-${day}`;


      // -------------------------------------------------
      // TODAY'S DOSES
      // -------------------------------------------------

      const todayDoses =
        doses.filter(
          dose =>
            dose.scheduledDate === today
        );


      // -------------------------------------------------
      // ADHERENCE COUNTS
      // -------------------------------------------------

      const total =
        todayDoses.length;

      const taken =
        todayDoses.filter(
          dose =>
            dose.status === 'taken'
        ).length;

      const pending =
        todayDoses.filter(
          dose =>
            dose.status === 'pending'
        ).length;

      const missed =
        todayDoses.filter(
          dose =>
            dose.status === 'missed'
        ).length;

      const skipped =
        todayDoses.filter(
          dose =>
            dose.status === 'skipped'
        ).length;


      // -------------------------------------------------
      // ADHERENCE PERCENTAGE
      // -------------------------------------------------

      const adherence =
        total > 0
          ? Math.round(
              (taken / total) * 100
            )
          : 0;


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      res.json({

        patient,

        relationship:
          req.caregiverRelationship,

        medications,

        schedules,

        todayDoses,

        doses,

        adherence: {

          total,

          taken,

          pending,

          missed,

          skipped,

          percentage:
            adherence,

        },

      });

    } catch (error) {

      console.error(
        'Get patient overview error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to retrieve patient overview',
      });
    }
  }
);

// =====================================================
// SEARCH PATIENT
// GET /api/caregiver/search-patient?email=example@email.com
// =====================================================

router.get(
  '/search-patient',
  authMiddleware,
  async (req, res) => {
    try {

      // -------------------------------------------------
      // CHECK CAREGIVER ROLE
      // -------------------------------------------------

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }

      // -------------------------------------------------
      // GET EMAIL
      // -------------------------------------------------

      const rawIdentifier =
        req.query.email ??
        req.query.patientId ??
        req.query.identifier ??
        '';

      const identifier =
        String(rawIdentifier).trim();

      if (!identifier) {
        return res.status(400).json({
          message: 'Patient ID or email is required',
        });
      }

      const normalizedIdentifier =
        identifier.toLowerCase();

      const normalizedPatientId =
        identifier.toUpperCase();

      // -------------------------------------------------
      // FIND PATIENT
      // -------------------------------------------------

      const patient =
        await User.findOne({
          role: 'patient',
          $or: [
            { email: normalizedIdentifier },
            { patientId: normalizedPatientId },
          ],
        }).select(
          '_id username email patientId role createdAt'
        );

      if (!patient) {
        return res.status(404).json({
          message: 'Patient not found',
        });
      }

      // -------------------------------------------------
      // CHECK EXISTING RELATIONSHIP
      // -------------------------------------------------

      const relationship =
        await CaregiverRelationship.findOne({
          caregiver: req.user.userId,
          patient: patient._id,
        });

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      res.json({
        patient: patient
          ? {
              _id: patient._id,
              username: patient.username,
              email: patient.email,
              patientId: patient.patientId,
              role: patient.role,
              createdAt: patient.createdAt,
            }
          : null,
        relationship: relationship
          ? {
              id: relationship._id,
              status: relationship.status,
            }
          : null,
      });

    } catch (error) {

      console.error(
        'Search patient error:',
        error
      );

      res.status(500).json({
        message: 'Failed to search for patient',
      });
    }
  }
);


// =====================================================
// SEND CAREGIVER REQUEST
// POST /api/caregiver/requests
// =====================================================

router.post(
  '/requests',
  authMiddleware,
  async (req, res) => {

    try {

      // -------------------------------------------------
      // CHECK CAREGIVER ROLE
      // -------------------------------------------------

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }

      const {
        patientId,
      } = req.body;

      if (!patientId) {
        return res.status(400).json({
          message: 'Patient ID is required',
        });
      }

      // -------------------------------------------------
      // MAKE SURE PATIENT EXISTS
      // -------------------------------------------------

      const patient =
        await User.findOne({
          _id: patientId,
          role: 'patient',
        });

      if (!patient) {
        return res.status(404).json({
          message: 'Patient not found',
        });
      }

      // -------------------------------------------------
      // PREVENT SELF RELATIONSHIP
      // -------------------------------------------------

      if (
        patient._id.toString() ===
        req.user.userId
      ) {
        return res.status(400).json({
          message:
            'You cannot send a caregiver request to yourself.',
        });
      }

      // -------------------------------------------------
      // CHECK EXISTING RELATIONSHIP
      // -------------------------------------------------

      const existing =
        await CaregiverRelationship.findOne({
          caregiver: req.user.userId,
          patient: patientId,
        });

      if (existing) {

        if (existing.status === 'active') {
          return res.status(409).json({
            message:
              'You are already connected to this patient.',
          });
        }

        if (existing.status === 'pending') {
          return res.status(409).json({
            message:
              'A caregiver request is already pending.',
          });
        }

        // If revoked, allow another request
        existing.status = 'pending';

        await existing.save();

        await createNotification({
          recipient: patient._id,
          type: 'caregiver_request',
          message: 'A caregiver has requested access to your medication information.',
          relatedEntityType: 'CaregiverRelationship',
          relatedEntityId: existing._id,
          dedupeKey: `caregiver_request:${existing._id}:${existing.updatedAt?.getTime() || Date.now()}`,
        });

        await createAuditLog({
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: 'CAREGIVER_REQUEST_CREATED',
          targetType: 'CAREGIVER_RELATIONSHIP',
          targetId: existing._id,
          details: {
            caregiverId: existing.caregiver,
            patientId: existing.patient,
            previousStatus: 'revoked',
            newStatus: existing.status,
          },
        });

        return res.status(201).json({
          message:
            'Caregiver request sent successfully.',
          relationship: existing,
        });
      }

      // -------------------------------------------------
      // CREATE REQUEST
      // -------------------------------------------------

      const relationship =
        await CaregiverRelationship.create({

          caregiver:
            req.user.userId,

          patient:
            patientId,

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

      await createAuditLog({
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: 'CAREGIVER_REQUEST_CREATED',
        targetType: 'CAREGIVER_RELATIONSHIP',
        targetId: relationship._id,
        details: {
          caregiverId: relationship.caregiver,
          patientId: relationship.patient,
          previousStatus: null,
          newStatus: relationship.status,
        },
      });

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      res.status(201).json({

        message:
          'Caregiver request sent successfully.',

        relationship,

      });

    } catch (error) {

      console.error(
        'Send caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to send caregiver request',
      });
    }
  }
);


// =====================================================
// GET SENT REQUESTS
// GET /api/caregiver/requests
// =====================================================

router.get(
  '/requests',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }

      const requests =
        await CaregiverRelationship.find({
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
// REMOVE / CANCEL CAREGIVER REQUEST
// DELETE /api/caregiver/requests/:relationshipId
// =====================================================

router.delete(
  '/requests/:relationshipId',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }

      const relationship =
        await CaregiverRelationship.findOne({
          _id:
            req.params.relationshipId,

          caregiver:
            req.user.userId,
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

      res.json({
        message:
          'Caregiver request removed successfully',
      });

    } catch (error) {

      console.error(
        'Delete caregiver request error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to remove caregiver request',
      });
    }
  }
);


// =====================================================
// REVOKE ACTIVE RELATIONSHIP
// PUT /api/caregiver/relationships/:relationshipId/revoke
// =====================================================

router.put(
  '/relationships/:relationshipId/revoke',
  authMiddleware,
  async (req, res) => {

    try {

      if (req.user.role !== 'caregiver') {
        return res.status(403).json({
          message: 'Caregiver access required',
        });
      }

      const relationship =
        await CaregiverRelationship.findOne({
          _id:
            req.params.relationshipId,

          caregiver:
            req.user.userId,
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

      res.json({
        message:
          'Caregiver access revoked successfully',

        relationship,
      });

    } catch (error) {

      console.error(
        'Revoke caregiver relationship error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to revoke caregiver relationship',
      });
    }
  }
);
module.exports = router;