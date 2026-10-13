const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const nodemailerPath = require.resolve('nodemailer');
const emailServicePath = require.resolve('../services/emailService');
const originalNodemailerModule = require.cache[nodemailerPath];
const originalEmailServiceModule = require.cache[emailServicePath];
const originalEmailUser = process.env.EMAIL_USER;
const originalEmailAppPassword = process.env.EMAIL_APP_PASSWORD;
const originalEmailFrom = process.env.EMAIL_FROM;
const testEmailUser = 'sender@example.invalid';
const testEmailAppPassword = 'test-app-password-not-a-real-secret';
const testEmailFrom = 'MedSked <sender@example.invalid>';
const transportConfigs = [];
const sentMessages = [];
let closeCount = 0;
let sendMailFailure = null;
let emailService;

const mockedNodemailerModule = new Module(nodemailerPath);
mockedNodemailerModule.filename = nodemailerPath;
mockedNodemailerModule.loaded = true;
mockedNodemailerModule.exports = {
  createTransport: (config) => {
    transportConfigs.push(config);

    return {
      sendMail: async (message) => {
        sentMessages.push(message);
        if (sendMailFailure) {
          throw sendMailFailure;
        }
        return { messageId: 'mock-email-id' };
      },
      close: () => {
        closeCount += 1;
      },
    };
  },
};

test.before(() => {
  process.env.EMAIL_USER = testEmailUser;
  process.env.EMAIL_APP_PASSWORD = testEmailAppPassword;
  process.env.EMAIL_FROM = testEmailFrom;

  require.cache[nodemailerPath] = mockedNodemailerModule;
  delete require.cache[emailServicePath];
  emailService = require(emailServicePath);
});

test.after(() => {
  if (originalNodemailerModule) {
    require.cache[nodemailerPath] = originalNodemailerModule;
  } else {
    delete require.cache[nodemailerPath];
  }
  if (originalEmailServiceModule) {
    require.cache[emailServicePath] = originalEmailServiceModule;
  } else {
    delete require.cache[emailServicePath];
  }

  if (originalEmailUser === undefined) {
    delete process.env.EMAIL_USER;
  } else {
    process.env.EMAIL_USER = originalEmailUser;
  }
  if (originalEmailAppPassword === undefined) {
    delete process.env.EMAIL_APP_PASSWORD;
  } else {
    process.env.EMAIL_APP_PASSWORD = originalEmailAppPassword;
  }
  if (originalEmailFrom === undefined) {
    delete process.env.EMAIL_FROM;
  } else {
    process.env.EMAIL_FROM = originalEmailFrom;
  }
});

test('verification email uses Gmail SMTP config and preserves its message', async () => {
  sentMessages.length = 0;
  transportConfigs.length = 0;
  closeCount = 0;
  sendMailFailure = null;

  await emailService.sendVerificationEmail('user@example.com', '123456');

  assert.deepEqual(transportConfigs[0], {
    service: 'gmail',
    auth: {
      user: testEmailUser,
      pass: testEmailAppPassword,
    },
  });
  assert.deepEqual(sentMessages[0], {
    from: testEmailFrom,
    to: 'user@example.com',
    subject: 'Verify your MedSked email',
    text: 'Your MedSked verification code is 123456. It expires in 10 minutes.',
  });
  assert.equal(closeCount, 1);
});

test('password reset email preserves its message and closes the transporter', async () => {
  sentMessages.length = 0;
  transportConfigs.length = 0;
  closeCount = 0;
  sendMailFailure = null;

  await emailService.sendPasswordResetEmail('user@example.com', '654321');

  assert.deepEqual(transportConfigs[0], {
    service: 'gmail',
    auth: {
      user: testEmailUser,
      pass: testEmailAppPassword,
    },
  });
  assert.deepEqual(sentMessages[0], {
    from: testEmailFrom,
    to: 'user@example.com',
    subject: 'MedSked Password Reset Code',
    text: 'A password reset was requested for your MedSked account.\n\n'
      + 'Your 6-digit password reset code is 654321. It expires in 10 minutes.\n\n'
      + 'Do not share this code with anyone. If you did not request a password reset, you can ignore this email.',
  });
  assert.equal(closeCount, 1);
});

test('sendMail errors reject unchanged and still close the transporter', async () => {
  const providerError = new Error('mail provider failure');
  sendMailFailure = providerError;
  closeCount = 0;

  try {
    await assert.rejects(
      emailService.sendVerificationEmail('user@example.com', '111111'),
      (error) => error === providerError
    );
    assert.equal(closeCount, 1);
  } finally {
    sendMailFailure = null;
  }
});

test('missing EMAIL_FROM rejects before creating a transporter', async () => {
  const previousEmailFrom = process.env.EMAIL_FROM;
  const transportCount = transportConfigs.length;

  delete process.env.EMAIL_FROM;
  try {
    await assert.rejects(
      emailService.sendVerificationEmail('user@example.com', '111111'),
      { message: 'Email sender is not configured.' }
    );
    assert.equal(transportConfigs.length, transportCount);
  } finally {
    process.env.EMAIL_FROM = previousEmailFrom;
  }
});

for (const missingCredential of ['EMAIL_USER', 'EMAIL_APP_PASSWORD']) {
  test(`missing ${missingCredential} rejects before sending`, async () => {
    const previousValue = process.env[missingCredential];
    const transportCount = transportConfigs.length;
    const messageCount = sentMessages.length;

    delete process.env[missingCredential];
    try {
      await assert.rejects(
        emailService.sendVerificationEmail('user@example.com', '111111'),
        { message: 'Email configuration is incomplete.' }
      );
      assert.equal(transportConfigs.length, transportCount);
      assert.equal(sentMessages.length, messageCount);
    } finally {
      process.env[missingCredential] = previousValue;
    }
  });
}
