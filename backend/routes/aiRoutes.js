const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const caregiverMiddleware = require('../middleware/caregiverMiddleware');
const {
  containsMongoOperatorPayload,
  isValidObjectId,
  pickAllowedFields,
} = require('../utils/validation');
const { askAi } = require('../services/aiService');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4000;

const validateRequest = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  if (containsMongoOperatorPayload(body)) {
    return null;
  }

  const payload = pickAllowedFields(body, ['message']);

  if (!payload || typeof payload.message !== 'string') {
    return null;
  }

  const message = payload.message.trim();

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  return { message };
};

const handleAsk = async (req, res, ask = askAi, authorizeCaregiver = caregiverMiddleware) => {
  try {
    const payload = validateRequest(req.body);

    if (!payload) {
      return res.status(400).json({
        message: `A message is required and must not exceed ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admin AI access is not available.' });
    }

    let patientId;

    if (req.user.role === 'patient') {
      if (req.query.patientId !== undefined) {
        return res.status(400).json({ message: 'Patient scope is determined by authentication.' });
      }

      patientId = req.user.userId;
    } else if (req.user.role === 'caregiver') {
      patientId = req.query.patientId;

      if (!isValidObjectId(patientId)) {
        return res.status(400).json({ message: 'Invalid patient ID' });
      }

      return authorizeCaregiver(req, res, async () => {
        try {
          const answer = await ask(patientId, payload.message);
          return res.json({ answer });
        } catch (error) {
          return handleServiceError(res, error);
        }
      });
    } else {
      return res.status(403).json({ message: 'AI access denied.' });
    }

    const answer = await ask(patientId, payload.message);
    return res.json({ answer });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

const handleServiceError = (res, error) => {
  if (error?.statusCode === 502 || error?.statusCode === 503) {
    console.error('AI provider error:', {
      statusCode: error.statusCode,
      name: error.name || 'Error',
    });
    return res.status(error.statusCode).json({
      message: 'The AI assistant is temporarily unavailable.',
    });
  }

  console.error('AI request error:', error?.message || 'Unknown error');
  return res.status(500).json({ message: 'Failed to process AI request.' });
};

const createAskHandler = (ask = askAi, authorizeCaregiver = caregiverMiddleware) => (
  (req, res) => handleAsk(req, res, ask, authorizeCaregiver)
);

router.post('/ask', authMiddleware, createAskHandler());

module.exports = router;
module.exports.MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH;
module.exports.createAskHandler = createAskHandler;
module.exports.handleAsk = handleAsk;
module.exports.validateRequest = validateRequest;
