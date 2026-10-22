const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const LoginAttemptState = require('../models/LoginAttemptState');
const emailService = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const authRoutes = require('../routes/authRoutes');

const getRouteHandler = (path) => {
  const layer = authRoutes.stack.find((item) => (
    item.route?.path === path && item.route.methods.post
  ));
  assert.ok(layer, `Expected POST ${path} route`);
  return layer.route.stack.find((item) => item.method === 'post').handle;
};

const invokeRoute = async (path, body, ip = '203.0.113.18') => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await getRouteHandler(path)({ body, ip }, res);
  return res;
};

test('admin login emails a code, verifies it once, and clears legacy authenticator data', async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-mfa-route-test-secret';

  const user = {
    _id: '507f1f77bcf86cd799439011',
    username: 'admin',
    email: 'admin@example.test',
    password: await bcrypt.hash('secure-pass', 4),
    role: 'admin',
    emailVerified: true,
    mfaEnabled: true,
    mfaSecretEncrypted: 'legacy-encrypted-authenticator-secret',
    mfaRecoveryCodeHashes: ['legacy-recovery-hash'],
    adminMfaOtpAttempts: 0,
  };
  const sentCodes = [];
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    loginStateFindById: LoginAttemptState.findById,
    loginStateFindOneAndUpdate: LoginAttemptState.findOneAndUpdate,
    loginStateDeleteOne: LoginAttemptState.deleteOne,
    sendAdminLoginCode: emailService.sendAdminLoginCode,
  };
  const matches = (filter) => Object.entries(filter).every(([key, expected]) => {
    const actual = user[key];
    if (expected === null) return actual == null;
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$ne' in expected && actual === expected.$ne) return false;
      if ('$gt' in expected && !(new Date(actual) > expected.$gt)) return false;
      if ('$lt' in expected && !((actual || 0) < expected.$lt)) return false;
      return true;
    }
    return actual === expected;
  });

  User.findOne = (filter) => {
    const query = {
      select() {
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve(matches(filter) ? user : null).then(resolve, reject);
      },
    };
    return query;
  };
  User.findOneAndUpdate = async (filter, update) => {
    if (!matches(filter)) return null;
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    Object.entries(update.$inc || {}).forEach(([key, value]) => {
      user[key] = (user[key] || 0) + value;
    });
    return user;
  };
  User.updateOne = async (filter, update) => {
    if (!matches(filter)) return { matchedCount: 0 };
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    return { matchedCount: 1 };
  };
  LoginAttemptState.findById = () => ({ lean: async () => null });
  LoginAttemptState.findOneAndUpdate = () => ({ lean: async () => null });
  LoginAttemptState.deleteOne = async () => ({ deletedCount: 0 });
  emailService.sendAdminLoginCode = async (email, code) => {
    sentCodes.push({ email, code });
  };

  try {
    const login = await invokeRoute('/login', {
      email: user.email,
      password: 'secure-pass',
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.body.mfaRequired, true);
    assert.equal(login.body.mfaSetupRequired, undefined);
    assert.equal(login.body.token, undefined);
    assert.equal(sentCodes.length, 1);
    assert.equal(sentCodes[0].email, user.email);
    assert.match(sentCodes[0].code, /^\d{6}$/);
    assert.equal(user.mfaEnabled, false);
    assert.equal(user.mfaSecretEncrypted, undefined);
    assert.equal(user.mfaRecoveryCodeHashes, undefined);

    const resend = await invokeRoute('/mfa/resend', {
      challengeToken: login.body.challengeToken,
    });
    assert.equal(resend.statusCode, 200);
    assert.equal(sentCodes.length, 1);
    assert.ok(resend.body.retryAfterSeconds > 0);

    const invalid = await invokeRoute('/mfa/verify', {
      challengeToken: login.body.challengeToken,
      code: 'bad-code',
    });
    assert.equal(invalid.statusCode, 401);
    assert.equal(user.adminMfaOtpAttempts, 1);

    const verified = await invokeRoute('/mfa/verify', {
      challengeToken: login.body.challengeToken,
      code: sentCodes[0].code,
    });
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.body.user.role, 'admin');
    assert.equal(typeof verified.body.token, 'string');
    assert.equal(user.adminMfaOtpHash, undefined);

    const reused = await invokeRoute('/mfa/verify', {
      challengeToken: login.body.challengeToken,
      code: sentCodes[0].code,
    });
    assert.equal(reused.statusCode, 400);

    let nextCalled = false;
    const middlewareResponse = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    authMiddleware(
      {
        headers: {
          authorization: `Bearer ${jwt.sign(
            { userId: user._id, role: 'admin', purpose: 'mfa_challenge' },
            process.env.JWT_SECRET
          )}`,
        },
      },
      middlewareResponse,
      () => { nextCalled = true; }
    );
    assert.equal(nextCalled, false);
    assert.equal(middlewareResponse.statusCode, 401);
  } finally {
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.findOneAndUpdate;
    User.updateOne = originals.updateOne;
    LoginAttemptState.findById = originals.loginStateFindById;
    LoginAttemptState.findOneAndUpdate = originals.loginStateFindOneAndUpdate;
    LoginAttemptState.deleteOne = originals.loginStateDeleteOne;
    emailService.sendAdminLoginCode = originals.sendAdminLoginCode;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});

test('admin sign-in code email failures issue no challenge or access token', async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-mfa-email-failure-test-secret';
  const user = {
    _id: '507f1f77bcf86cd799439012',
    username: 'admin',
    email: 'admin@example.test',
    password: await bcrypt.hash('secure-pass', 4),
    role: 'admin',
    emailVerified: true,
    adminMfaOtpAttempts: 0,
  };
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    loginStateFindById: LoginAttemptState.findById,
    loginStateDeleteOne: LoginAttemptState.deleteOne,
    sendAdminLoginCode: emailService.sendAdminLoginCode,
  };
  const originalConsoleError = console.error;
  const errorLogs = [];

  User.findOne = () => ({
    select() { return this; },
    then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); },
  });
  User.findOneAndUpdate = async (filter, update) => {
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    return user;
  };
  User.updateOne = async (filter, update) => {
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    return { matchedCount: 1 };
  };
  LoginAttemptState.findById = () => ({ lean: async () => null });
  LoginAttemptState.deleteOne = async () => ({ deletedCount: 0 });
  emailService.sendAdminLoginCode = async () => {
    throw new Error('Email configuration is incomplete.');
  };
  console.error = (...args) => errorLogs.push(args);

  try {
    const login = await invokeRoute('/login', {
      email: user.email,
      password: 'secure-pass',
    });
    assert.equal(login.statusCode, 503);
    assert.equal(login.body.code, 'ADMIN_MFA_EMAIL_FAILED');
    assert.equal(login.body.challengeToken, undefined);
    assert.equal(login.body.token, undefined);
    assert.equal(user.adminMfaOtpHash, undefined);
    const logText = JSON.stringify(errorLogs);
    assert.match(logText, /SMTP_CONFIGURATION_INCOMPLETE/);
    assert.doesNotMatch(logText, /secure-pass|123456/);
  } finally {
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.findOneAndUpdate;
    User.updateOne = originals.updateOne;
    LoginAttemptState.findById = originals.loginStateFindById;
    LoginAttemptState.deleteOne = originals.loginStateDeleteOne;
    emailService.sendAdminLoginCode = originals.sendAdminLoginCode;
    console.error = originalConsoleError;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
