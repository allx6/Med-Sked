const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/User');
const LoginAttemptState = require('../models/LoginAttemptState');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');
const adminRoutes = require('../routes/adminRoutes');
const authRoutes = require('../routes/authRoutes');

const cloneUser = (user) => (user ? { ...user } : null);

const createFixture = () => {
  let user = null;
  const sentCodes = [];
  const originals = {
    findOne: User.findOne,
    findById: User.findById,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    exists: User.exists,
    create: User.create,
    loginStateFindById: LoginAttemptState.findById,
    loginStateDeleteOne: LoginAttemptState.deleteOne,
    sendVerificationEmail: emailService.sendVerificationEmail,
    auditCreate: AuditLog.create,
  };

  const matches = (filter) => Object.entries(filter).every(([key, expected]) => {
    const actual = user?.[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$ne' in expected && actual === expected.$ne) return false;
      if ('$gt' in expected && !(new Date(actual) > expected.$gt)) return false;
      if ('$lt' in expected && !(actual < expected.$lt)) return false;
      return true;
    }
    if (expected === null) return actual == null;
    return actual === expected;
  });

  User.findOne = (filter) => ({
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(matches(filter) ? cloneUser(user) : null)
        .then(resolve, reject);
    },
  });
  User.findById = (id) => ({
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(user?._id === id ? cloneUser(user) : null)
        .then(resolve, reject);
    },
  });
  User.findOneAndUpdate = async (filter, update) => {
    if (!matches(filter)) return null;
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    return cloneUser(user);
  };
  User.updateOne = async (filter, update) => {
    if (!matches(filter)) return { matchedCount: 0 };
    Object.assign(user, update.$set || {});
    Object.entries(update.$inc || {}).forEach(([key, value]) => {
      user[key] = (user[key] || 0) + value;
    });
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    return { matchedCount: 1 };
  };
  User.exists = async () => false;
  User.create = async (data) => {
    user = {
      ...data,
      _id: '507f1f77bcf86cd799439011',
      emailVerificationAttempts: 0,
      toObject() {
        const { toObject, ...plainUser } = this;
        return plainUser;
      },
    };
    return user;
  };
  LoginAttemptState.findById = () => ({ lean: async () => null });
  LoginAttemptState.deleteOne = async () => ({ deletedCount: 0 });
  emailService.sendVerificationEmail = async (email, otp) => {
    sentCodes.push({ email, otp });
  };
  AuditLog.create = async () => ({});

  return {
    getUser: () => cloneUser(user),
    sentCodes,
    makeResendAvailable() {
      user.emailVerificationLastSentAt = new Date(Date.now() - 61_000);
    },
    restore() {
      User.findOne = originals.findOne;
      User.findById = originals.findById;
      User.findOneAndUpdate = originals.findOneAndUpdate;
      User.updateOne = originals.updateOne;
      User.exists = originals.exists;
      User.create = originals.create;
      LoginAttemptState.findById = originals.loginStateFindById;
      LoginAttemptState.deleteOne = originals.loginStateDeleteOne;
      emailService.sendVerificationEmail = originals.sendVerificationEmail;
      AuditLog.create = originals.auditCreate;
    },
  };
};

const getRouteHandler = (router, path, method) => {
  const layer = router.stack.find((item) => (
    item.route?.path === path && item.route.methods[method]
  ));
  assert.ok(layer, `Expected ${method.toUpperCase()} ${path} route`);
  return layer.route.stack.find((item) => item.method === method).handle;
};

const invokeRoute = async (router, path, method, body, user = null) => {
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
  await getRouteHandler(router, path, method)(
    { body, user, ip: '203.0.113.12' },
    res
  );
  return res;
};

test('email verification is false by default on new User documents', () => {
  assert.equal(User.schema.path('emailVerified').defaultValue, false);
});

test('Admin-created Patient and Caregiver accounts use shared email verification before login', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-account-verification-test-secret';

  try {
    for (const role of ['patient', 'caregiver']) {
      const fixture = createFixture();
      const email = `${role}@example.test`;
      const adminIdentity = { userId: '507f1f77bcf86cd799439099', role: 'admin' };

      try {
        const created = await invokeRoute(
          adminRoutes,
          '/users',
          'post',
          {
            name: role,
            email,
            password: 'secure-pass',
            role,
            emailVerified: true,
          },
          adminIdentity
        );

        assert.equal(created.statusCode, 201);
        assert.equal(fixture.getUser().emailVerified, false);
        assert.equal(fixture.sentCodes.length, 1);
        assert.equal(fixture.sentCodes[0].email, email);
        assert.equal(created.body.verificationRequired, true);
        assert.equal(created.body.token, undefined);
        assert.equal(created.body.emailVerificationOtpHash, undefined);
        assert.equal(JSON.stringify(created.body).includes(fixture.sentCodes[0].otp), false);
        assert.equal(adminIdentity.role, 'admin');

        const loginBeforeVerification = await invokeRoute(
          authRoutes,
          '/login',
          'post',
          { email, password: 'secure-pass' }
        );
        assert.equal(loginBeforeVerification.statusCode, 403);
        assert.equal(loginBeforeVerification.body.code, 'EMAIL_VERIFICATION_REQUIRED');
        assert.equal(loginBeforeVerification.body.token, undefined);

        fixture.makeResendAvailable();
        const resent = await invokeRoute(
          authRoutes,
          '/resend-verification',
          'post',
          { email }
        );
        assert.equal(resent.statusCode, 200);
        assert.equal(fixture.sentCodes.length, 2);
        assert.equal(JSON.stringify(resent.body).includes(fixture.sentCodes[1].otp), false);

        const verified = await invokeRoute(
          authRoutes,
          '/verify-email',
          'post',
          { email, otp: fixture.sentCodes[1].otp }
        );
        assert.equal(verified.statusCode, 200);
        assert.equal(fixture.getUser().emailVerified, true);
        assert.equal(verified.body.user.role, role);
        assert.equal(typeof verified.body.token, 'string');

        const loginAfterVerification = await invokeRoute(
          authRoutes,
          '/login',
          'post',
          { email, password: 'secure-pass' }
        );
        assert.equal(loginAfterVerification.statusCode, 200);
        assert.equal(loginAfterVerification.body.user.role, role);
        assert.equal(typeof loginAfterVerification.body.token, 'string');
      } finally {
        fixture.restore();
      }
    }
  } finally {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('verification email delivery failure leaves the new account unverified with no session', async () => {
  const fixture = createFixture();
  emailService.sendVerificationEmail = async () => {
    throw new Error('SMTP provider details must stay private');
  };

  try {
    const response = await invokeRoute(
      adminRoutes,
      '/users',
      'post',
      {
        name: 'MailFailure',
        email: 'mailfailure@example.test',
        password: 'secure-pass',
        role: 'caregiver',
      },
      { userId: '507f1f77bcf86cd799439099', role: 'admin' }
    );

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'VERIFICATION_EMAIL_SEND_FAILED');
    assert.equal(response.body.verificationRequired, true);
    assert.equal(response.body.token, undefined);
    assert.equal(fixture.getUser().emailVerified, false);
    assert.equal(fixture.getUser().emailVerificationOtpHash, undefined);
    assert.equal(JSON.stringify(response.body).includes('SMTP provider details'), false);
  } finally {
    fixture.restore();
  }
});
