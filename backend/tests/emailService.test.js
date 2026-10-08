const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const resendPath = require.resolve('resend');
const emailServicePath = require.resolve('../services/emailService');
const originalResendModule = require.cache[resendPath];
const originalEmailServiceModule = require.cache[emailServicePath];
const originalApiKey = process.env.RESEND_API_KEY;
const originalFromEmail = process.env.RESEND_FROM_EMAIL;
const testApiKey = 'resend-test-key-not-a-real-secret';
const testFromEmail = 'MedSked <test@example.invalid>';
const sentMessages = [];
let emailService;
let resendFailure = null;

class MockResend {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.emails = {
      send: async (message) => {
        sentMessages.push({ apiKey, message });
        if (resendFailure) {
          return { data: null, error: resendFailure };
        }
        return { data: { id: 'mock-email-id' }, error: null };
      },
    };
  }
}

test.before(() => {
  process.env.RESEND_API_KEY = testApiKey;
  process.env.RESEND_FROM_EMAIL = testFromEmail;

  const mockedResendModule = new Module(resendPath);
  mockedResendModule.filename = resendPath;
  mockedResendModule.loaded = true;
  mockedResendModule.exports = { Resend: MockResend };
  require.cache[resendPath] = mockedResendModule;
  delete require.cache[emailServicePath];
  emailService = require(emailServicePath);
});

test.after(() => {
  if (originalResendModule) {
    require.cache[resendPath] = originalResendModule;
  } else {
    delete require.cache[resendPath];
  }
  if (originalEmailServiceModule) {
    require.cache[emailServicePath] = originalEmailServiceModule;
  } else {
    delete require.cache[emailServicePath];
  }
  if (originalApiKey === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = originalApiKey;
  }
  if (originalFromEmail === undefined) {
    delete process.env.RESEND_FROM_EMAIL;
  } else {
    process.env.RESEND_FROM_EMAIL = originalFromEmail;
  }
});

test('verification email preserves its subject and plain-text content', async () => {
  sentMessages.length = 0;
  resendFailure = null;
  await emailService.sendVerificationEmail('user@example.com', '123456');

  assert.deepEqual(sentMessages[0], {
    apiKey: testApiKey,
    message: {
      from: testFromEmail,
      to: 'user@example.com',
      subject: 'Verify your MedSked email',
      text: 'Your MedSked verification code is 123456. It expires in 10 minutes.',
    },
  });
});

test('password reset email preserves its subject and plain-text content', async () => {
  sentMessages.length = 0;
  resendFailure = null;
  await emailService.sendPasswordResetEmail('user@example.com', '654321');

  assert.deepEqual(sentMessages[0], {
    apiKey: testApiKey,
    message: {
      from: testFromEmail,
      to: 'user@example.com',
      subject: 'MedSked Password Reset Code',
      text: 'A password reset was requested for your MedSked account.\n\n'
        + 'Your 6-digit password reset code is 654321. It expires in 10 minutes.\n\n'
        + 'Do not share this code with anyone. If you did not request a password reset, you can ignore this email.',
    },
  });
});

test('a Resend API error rejects without exposing provider details', async () => {
  resendFailure = { message: 'private provider response' };
  await assert.rejects(
    emailService.sendVerificationEmail('user@example.com', '111111'),
    (error) => {
      assert.equal(error.message, 'Email delivery failed.');
      assert.equal(error.message.includes('private provider response'), false);
      return true;
    }
  );
  resendFailure = null;
});

test('missing Resend configuration is rejected without sending', async () => {
  const configuredApiKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const sentCount = sentMessages.length;

  try {
    await assert.rejects(
      emailService.sendVerificationEmail('user@example.com', '111111'),
      { message: 'Email API is not configured.' }
    );
    assert.equal(sentMessages.length, sentCount);
  } finally {
    process.env.RESEND_API_KEY = configuredApiKey;
  }
});
