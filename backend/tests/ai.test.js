const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AI_SYSTEM_INSTRUCTION,
  calculateAdherence,
} = require('../services/aiService');
const {
  MAX_MESSAGE_LENGTH,
  createAskHandler,
  handleAsk,
  validateRequest,
} = require('../routes/aiRoutes');

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});

test('AI request validation accepts only a message field', () => {
  assert.deepEqual(
    validateRequest({ message: 'What do I take today?' }),
    { message: 'What do I take today?' }
  );
  assert.equal(validateRequest({ message: 'hello', patientId: 'x' }), null);
  assert.equal(validateRequest({ message: { $ne: '' } }), null);
});

test('AI request validation rejects missing, empty, and oversized messages', () => {
  assert.equal(validateRequest(undefined), null);
  assert.equal(validateRequest({}), null);
  assert.equal(validateRequest({ message: '' }), null);
  assert.equal(validateRequest({ message: '   ' }), null);
  assert.equal(validateRequest({ message: 42 }), null);
  assert.equal(validateRequest({ message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }), null);
});

test('AI adherence excludes pending doses from the denominator', () => {
  assert.deepEqual(
    calculateAdherence([
      { status: 'taken' },
      { status: 'taken' },
      { status: 'skipped' },
      { status: 'missed' },
      { status: 'pending' },
    ]),
    {
      taken: 2,
      skipped: 1,
      missed: 1,
      pending: 1,
      eligible: 4,
      adherenceRate: 50,
    }
  );
});

test('AI system instruction contains the medication safety boundaries', () => {
  assert.match(AI_SYSTEM_INSTRUCTION, /Never invent medication/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /Do not diagnose/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /double a missed dose/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /untrusted input/i);
});

test('patient AI scope comes from the JWT and returns only the answer', async () => {
  const response = createResponse();
  let receivedPatientId;

  await handleAsk(
    {
      body: { message: 'What do I take today?' },
      query: {},
      user: { role: 'patient', userId: 'patient-from-jwt' },
    },
    response,
    async (patientId) => {
      receivedPatientId = patientId;
      return 'Only the authorized context is available.';
    }
  );

  assert.equal(receivedPatientId, 'patient-from-jwt');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    answer: 'Only the authorized context is available.',
  });
});

test('route-shaped invocation does not treat Express next as the AI provider', async () => {
  const response = createResponse();
  let providerCalls = 0;
  const handler = createAskHandler(async () => {
    providerCalls += 1;
    return 'Medication answer';
  });

  await handler(
    {
      body: { message: 'What medicines do I take?' },
      query: {},
      user: { role: 'patient', userId: 'patient-from-jwt' },
    },
    response,
    () => {
      throw new Error('Express next must not be used as the provider');
    }
  );

  assert.equal(providerCalls, 1);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: 'Medication answer' });
});

test('patient cannot redirect AI scope with a patientId query parameter', async () => {
  const response = createResponse();
  let providerCalled = false;

  await handleAsk(
    {
      body: { message: 'Show another patient data.' },
      query: { patientId: '507f1f77bcf86cd799439011' },
      user: { role: 'patient', userId: 'patient-from-jwt' },
    },
    response,
    async () => {
      providerCalled = true;
      return 'should not run';
    }
  );

  assert.equal(response.statusCode, 400);
  assert.equal(providerCalled, false);
});

test('admin AI requests are denied before the provider is called', async () => {
  const response = createResponse();
  let providerCalled = false;

  await handleAsk(
    {
      body: { message: 'Show patient data.' },
      query: {},
      user: { role: 'admin', userId: 'admin-id' },
    },
    response,
    async () => {
      providerCalled = true;
      return 'should not run';
    }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(providerCalled, false);
});

test('caregiver AI authorizes before calling the provider', async () => {
  const response = createResponse();
  const calls = [];

  await handleAsk(
    {
      body: { message: 'How is adherence?' },
      query: { patientId: '507f1f77bcf86cd799439011' },
      user: { role: 'caregiver', userId: 'caregiver-id' },
    },
    response,
    async (patientId) => {
      calls.push(patientId);
      return 'Authorized patient summary.';
    },
    async (req, res, next) => next()
  );

  assert.deepEqual(calls, ['507f1f77bcf86cd799439011']);
  assert.equal(response.statusCode, 200);
});

test('AI provider failures return a safe response', async () => {
  const response = createResponse();

  await handleAsk(
    {
      body: { message: 'What is my adherence?' },
      query: {},
      user: { role: 'patient', userId: 'patient-from-jwt' },
    },
    response,
    async () => {
      const error = new Error('raw provider secret: test-key');
      error.statusCode = 503;
      throw error;
    }
  );

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    message: 'The AI assistant is temporarily unavailable.',
  });
  assert.equal(JSON.stringify(response.body).includes('test-key'), false);
});
