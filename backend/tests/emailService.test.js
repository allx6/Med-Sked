const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const nodemailerPath = require.resolve('nodemailer');
const emailServicePath = require.resolve('../services/emailService');
const originalNodemailerModule = require.cache[nodemailerPath];
const originalEmailServiceModule = require.cache[emailServicePath];
const smtpEnvKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
const originalSmtpEnv = Object.fromEntries(
  smtpEnvKeys.map((key) => [key, process.env[key]])
);
const originalEmailFrom = process.env.EMAIL_FROM;
const testSmtp = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'test-smtp-login',
  password: 'test-smtp-password-not-a-real-secret',
};
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
  process.env.SMTP_HOST = testSmtp.host;
  process.env.SMTP_PORT = String(testSmtp.port);
  process.env.SMTP_USER = testSmtp.user;
  process.env.SMTP_PASSWORD = testSmtp.password;
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

  smtpEnvKeys.forEach((key) => {
    if (originalSmtpEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalSmtpEnv[key];
  });
  if (originalEmailFrom === undefined) {
    delete process.env.EMAIL_FROM;
  } else {
    process.env.EMAIL_FROM = originalEmailFrom;
  }
});

test('verification email uses configured Brevo SMTP and preserves its message', async () => {
  sentMessages.length = 0;
  transportConfigs.length = 0;
  closeCount = 0;
  sendMailFailure = null;

  await emailService.sendVerificationEmail('user@example.com', '123456');

  assert.deepEqual(transportConfigs[0], {
    host: testSmtp.host,
    port: testSmtp.port,
    secure: false,
    auth: {
      user: testSmtp.user,
      pass: testSmtp.password,
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
    host: testSmtp.host,
    port: testSmtp.port,
    secure: false,
    auth: {
      user: testSmtp.user,
      pass: testSmtp.password,
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

test('administrator sign-in email sends the one-time code with expiry instructions', async () => {
  sentMessages.length = 0;
  transportConfigs.length = 0;
  closeCount = 0;
  sendMailFailure = null;

  await emailService.sendAdminLoginCode('admin@example.com', '123456');

  assert.deepEqual(sentMessages[0], {
    from: testEmailFrom,
    to: 'admin@example.com',
    subject: 'Your MedSked administrator sign-in code',
    text: 'Your MedSked administrator sign-in code is 123456. It expires in 10 minutes. '
      + 'If you did not try to sign in, change your password and contact your administrator.',
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

test('port 465 enables implicit TLS for SMTP', async () => {
  process.env.SMTP_PORT = '465';
  transportConfigs.length = 0;

  try {
    await emailService.sendAdminLoginCode('admin@example.com', '123456');
    assert.deepEqual(transportConfigs[0], {
      host: testSmtp.host,
      port: 465,
      secure: true,
      auth: {
        user: testSmtp.user,
        pass: testSmtp.password,
      },
    });
  } finally {
    process.env.SMTP_PORT = String(testSmtp.port);
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

test('invalid email addresses are rejected before creating a transporter', async () => {
  const transportCount = transportConfigs.length;
  const originalEmailFrom = process.env.EMAIL_FROM;

  await assert.rejects(
    emailService.sendAdminLoginCode('not-an-email', '123456'),
    { code: 'EMAIL_ADDRESS_INVALID', emailField: 'recipient' }
  );
  process.env.EMAIL_FROM = 'MedSked <invalid-sender>';
  try {
    await assert.rejects(
      emailService.sendAdminLoginCode('admin@example.com', '123456'),
      { code: 'EMAIL_ADDRESS_INVALID', emailField: 'sender' }
    );
  } finally {
    process.env.EMAIL_FROM = originalEmailFrom;
  }
  assert.equal(transportConfigs.length, transportCount);
});

for (const missingSetting of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']) {
  test(`missing ${missingSetting} rejects before sending`, async () => {
    const originalValue = process.env[missingSetting];
    const transportCount = transportConfigs.length;
    const messageCount = sentMessages.length;

    delete process.env[missingSetting];
    try {
      await assert.rejects(
        emailService.sendVerificationEmail('user@example.com', '111111'),
        { message: 'Email configuration is incomplete.' }
      );
      assert.equal(transportConfigs.length, transportCount);
      assert.equal(sentMessages.length, messageCount);
    } finally {
      process.env[missingSetting] = originalValue;
    }
  });
}
