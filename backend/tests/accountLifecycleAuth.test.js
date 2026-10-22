const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const LoginAttemptState = require('../models/LoginAttemptState');
const emailService = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const authRoutes = require('../routes/authRoutes');

const invokeRoute = async (path, body) => {
  const layer = authRoutes.stack.find((item) => (
    item.route?.path === path && item.route.methods.post
  ));
  assert.ok(layer, `Expected POST ${path} route`);
  const handler = layer.route.stack.find((item) => item.method === 'post').handle;
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
  await handler({ body, ip: '203.0.113.20' }, res);
  return res;
};

test('deactivated administrators cannot log in or complete MFA', async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'deactivated-admin-route-test-secret';
  const user = {
    _id: '507f1f77bcf86cd799439013',
    username: 'inactive-admin',
    email: 'inactive-admin@example.test',
    password: await bcrypt.hash('secure-pass', 4),
    role: 'admin',
    emailVerified: true,
    accountStatus: 'deactivated',
    adminMfaOtpHash: await bcrypt.hash('123456', 4),
    adminMfaOtpExpiresAt: new Date(Date.now() + 60_000),
    adminMfaOtpAttempts: 0,
  };
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    loginStateFindById: LoginAttemptState.findById,
    loginStateFindOneAndUpdate: LoginAttemptState.findOneAndUpdate,
    loginStateDeleteOne: LoginAttemptState.deleteOne,
    sendAdminLoginCode: emailService.sendAdminLoginCode,
  };
  let emailsSent = 0;
  User.findOne = (filter) => ({
    select() { return this; },
    then(resolve, reject) {
      const activeAccountQuery = filter.accountStatus?.$ne === 'deactivated';
      return Promise.resolve(activeAccountQuery ? null : user).then(resolve, reject);
    },
  });
  User.findOneAndUpdate = async () => {
    assert.fail('A deactivated account must not complete MFA.');
  };
  LoginAttemptState.findById = () => ({ lean: async () => null });
  LoginAttemptState.findOneAndUpdate = () => ({ lean: async () => null });
  LoginAttemptState.deleteOne = async () => ({ deletedCount: 0 });
  emailService.sendAdminLoginCode = async () => { emailsSent += 1; };

  try {
    const login = await invokeRoute('/login', {
      email: user.email,
      password: 'secure-pass',
    });
    assert.equal(login.statusCode, 401);
    assert.equal(login.body.token, undefined);
    assert.equal(login.body.challengeToken, undefined);
    assert.equal(emailsSent, 0);

    const challengeToken = jwt.sign({
      userId: user._id,
      role: 'admin',
      purpose: 'mfa_challenge',
    }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const verification = await invokeRoute('/mfa/verify', {
      challengeToken,
      code: '123456',
    });
    assert.equal(verification.statusCode, 401);
    assert.equal(verification.body.token, undefined);
  } finally {
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.findOneAndUpdate;
    LoginAttemptState.findById = originals.loginStateFindById;
    LoginAttemptState.findOneAndUpdate = originals.loginStateFindOneAndUpdate;
    LoginAttemptState.deleteOne = originals.loginStateDeleteOne;
    emailService.sendAdminLoginCode = originals.sendAdminLoginCode;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});

test('deactivated accounts and stale token versions cannot use existing access tokens', async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  process.env.JWT_SECRET = 'deactivated-access-token-test-secret';

  try {
    for (const account of [
      { accountStatus: 'deactivated', authTokenVersion: 2, sessionVersion: 2 },
      { accountStatus: 'active', authTokenVersion: 3, sessionVersion: 2 },
    ]) {
      User.findById = () => ({
        select() { return this; },
        lean: async () => ({
          _id: '507f1f77bcf86cd799439014',
          accountStatus: account.accountStatus,
          authTokenVersion: account.authTokenVersion,
        }),
      });
      const token = jwt.sign({
        userId: '507f1f77bcf86cd799439014',
        role: 'caregiver',
        sessionVersion: account.sessionVersion,
      }, process.env.JWT_SECRET);
      const res = {
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
      let nextCalled = false;
      await authMiddleware({
        headers: { authorization: `Bearer ${token}` },
      }, res, () => { nextCalled = true; });
      assert.equal(res.statusCode, 401);
      assert.equal(nextCalled, false);
    }
  } finally {
    User.findById = originalFindById;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
