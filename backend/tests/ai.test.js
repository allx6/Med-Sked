const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AI_SYSTEM_INSTRUCTION,
  calculateAdherence,
  getMedicationDefinitionIntent,
  getPersonalizedRecordAnswer,
  toMedicationContext,
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

test('AI system instruction distinguishes general medication definitions from MedSked patient data', () => {
  assert.match(AI_SYSTEM_INSTRUCTION, /general medication information/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /MedSked patient (?:context|data)/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /What is metformin\?/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /What dosage of metformin do I have\?/i);
});

test('general medication-definition intent is detected without relying on MedSked data', () => {
  assert.equal(getMedicationDefinitionIntent('What is metformin?'), true);
  assert.equal(getMedicationDefinitionIntent('What is amoxicillin?'), true);
  assert.equal(getMedicationDefinitionIntent('What is metformin used for?'), true);
  assert.equal(getMedicationDefinitionIntent('What type of medicine is metformin?'), true);
  assert.equal(getMedicationDefinitionIntent('What dosage of metformin do I have?'), false);
  assert.equal(getMedicationDefinitionIntent('When do I take metformin?'), false);
  assert.equal(getMedicationDefinitionIntent('How is my medication adherence?'), false);
  assert.equal(getMedicationDefinitionIntent('What is my medication expiration date?'), false);
  assert.equal(getMedicationDefinitionIntent('What is a refill threshold?'), true);
  assert.equal(getMedicationDefinitionIntent('What is medication expiration?'), true);
});

test('AI medication context includes recorded expiration dates and refill thresholds', () => {
  assert.deepEqual(
    toMedicationContext({
      name: 'Metformin',
      dosage: '500 mg',
      frequency: 'Once daily',
      quantityOnHand: 8,
      refillThreshold: 2,
      expirationDate: '2026-10-20',
    }),
    {
      name: 'Metformin',
      dosage: '500 mg',
      frequency: 'Once daily',
      quantityOnHand: 8,
      refillThreshold: 2,
      expirationDate: '2026-10-20',
      lowRefill: false,
    }
  );
});

test('personalized expiration answers include recorded and missing dates and treat expiration day as active', () => {
  const context = {
    today: '2026-10-04',
    medications: [
      { name: 'Metformin', expirationDate: '2026-10-04' },
      { name: 'Cetirizine', expirationDate: '2026-10-20' },
      { name: 'Lisinopril', expirationDate: '2026-11-03' },
      { name: 'Amoxicillin', expirationDate: '2026-11-04' },
      { name: 'Insulin', expirationDate: '2026-09-30' },
      { name: 'Amlodipine', expirationDate: null },
    ],
  };
  const allDates = getPersonalizedRecordAnswer('What are my medication expiration dates?', context);
  assert.match(allDates, /Metformin — expires today \(October 4, 2026\)/);
  assert.match(allDates, /Cetirizine — October 20, 2026/);
  assert.match(allDates, /Insulin — expired September 30, 2026/);
  assert.match(allDates, /Amlodipine — expiration date not recorded/);

  const soon = getPersonalizedRecordAnswer('Which medicines expire soon?', context);
  assert.match(soon, /Cetirizine/);
  assert.match(soon, /Lisinopril/);
  assert.match(soon, /Metformin/);
  assert.doesNotMatch(soon, /Insulin|Amlodipine|Amoxicillin/);
});

test('personalized named expiration and expiry-period responses use only matching records', () => {
  const context = {
    today: '2026-10-04',
    medications: [
      { name: 'Metformin', expirationDate: '2026-10-04' },
      { name: 'Cetirizine', expirationDate: '2026-11-25' },
    ],
  };
  assert.equal(
    getPersonalizedRecordAnswer('Is my Metformin expired?', context),
    'Metformin expires today.'
  );
  assert.match(
    getPersonalizedRecordAnswer('Which medication expires first?', context),
    /Metformin expires first, on October 4, 2026/
  );
  assert.match(
    getPersonalizedRecordAnswer('Do I have medications expiring this month?', context),
    /Metformin/
  );
});

test('personalized refill thresholds, inventory, adherence, missed doses, and history use supplied context', () => {
  const context = {
    today: '2026-10-04',
    doseHistoryStartDate: '2026-09-05',
    medications: [
      { name: 'Metformin', dosage: '500 mg', frequency: 'Daily', refillThreshold: 2, quantityOnHand: 1 },
      { name: 'Insulin', refillThreshold: 0, quantityOnHand: 0 },
      { name: 'Cetirizine', refillThreshold: 1, quantityOnHand: 8 },
    ],
    adherence: { adherenceRate: 80, eligible: 5, missed: 1 },
    doses: [
      { medication: 'Metformin', scheduledDate: '2026-10-03', scheduledTime: '08:00', status: 'missed' },
      { medication: 'Cetirizine', scheduledDate: '2026-10-02', scheduledTime: '20:00', status: 'taken' },
      { medication: 'Insulin', scheduledDate: '2026-10-05', scheduledTime: '07:00', status: 'pending' },
    ],
    currentTime: '09:00',
    schedules: [
      { medication: 'Cetirizine', time: '20:00', dose: '10 mg', days: ['Sunday'], startDate: '2026-01-01', enabled: true },
      { medication: 'Insulin', time: '07:00', dose: '5 units', days: ['Monday'], startDate: '2026-01-01', enabled: true },
    ],
  };

  assert.match(
    getPersonalizedRecordAnswer('What are my refill thresholds?', context),
    /Metformin — 2[\s\S]*Insulin — 0[\s\S]*Cetirizine — 1/
  );
  assert.match(
    getPersonalizedRecordAnswer('Which medicines are low on supply?', context),
    /Insulin — out of stock[\s\S]*Metformin — low stock \(1 on hand; refill threshold 2\)/
  );
  assert.equal(
    getPersonalizedRecordAnswer('How is my adherence?', context),
    'Based on the MedSked records, adherence for the available period is 80%.'
  );
  assert.match(getPersonalizedRecordAnswer('Do I have any missed doses?', context), /1 missed dose/);
  const history = getPersonalizedRecordAnswer('What is my medication history?', context);
  assert.match(history, /Metformin — 500 mg \(Daily\)/);
  assert.match(history, /Recent dose history since 2026-09-05/);
  assert.match(history, /2026-10-03 08:00 — Metformin: missed/);
  assert.match(
    getPersonalizedRecordAnswer('What medicines do I take today?', context),
    /Today's scheduled medications[\s\S]*Cetirizine/
  );
  assert.match(
    getPersonalizedRecordAnswer('What is my next dose?', context),
    /Insulin on 2026-10-05 at 07:00/
  );
});

test('AI data-backed personalized responses do not call the generative provider', async () => {
  let providerCalls = 0;
  const answer = await require('../services/aiService').askAi(
    'authorized-patient',
    'What are my medication expiration dates?',
    async () => {
      providerCalls += 1;
      return 'This should not replace the patient data.';
    },
    async (patientId) => {
      assert.equal(patientId, 'authorized-patient');
      return {
        today: '2026-10-04',
        medications: [{ name: 'Metformin', expirationDate: '2026-10-20' }],
      };
    }
  );

  assert.equal(providerCalls, 0);
  assert.match(answer, /Metformin — October 20, 2026/);
});

test('general definitions avoid loading or passing personalized patient context', async () => {
  let contextCalls = 0;
  let receivedContext;
  const { askAi } = require('../services/aiService');
  const answer = await askAi(
    'authorized-patient',
    'What is a refill threshold?',
    async (message, context) => {
      receivedContext = context;
      return 'A refill threshold is a stock level used to flag a possible refill.';
    },
    async () => {
      contextCalls += 1;
      return { medications: [{ name: 'Private medication record' }] };
    }
  );

  assert.equal(answer, 'A refill threshold is a stock level used to flag a possible refill.');
  assert.equal(contextCalls, 0);
  assert.deepEqual(receivedContext, {});
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
