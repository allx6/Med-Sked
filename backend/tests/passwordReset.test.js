const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const emailService = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const authRoutes = require('../routes/authRoutes');
const {
  createPasswordResetService,
  PasswordResetError,
  GENERIC_REQUEST_MESSAGE,
  OTP_LIFETIME_MS,
  RESET_AUTHORIZATION_LIFETIME_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
} = require('../services/passwordResetService');

const createMemoryStore = (initialUser) => {
  let user = initialUser ? { ...initialUser } : null;
  const matches = (filter) => {
    if (!user) return false;
    return Object.entries(filter).every(([key, expected]) => {
      const actual = user[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('$ne' in expected && actual === expected.$ne) return false;
        if ('$lt' in expected && !(actual < expected.$lt)) return false;
        if ('$gte' in expected && !(actual >= expected.$gte)) return false;
        if ('$gt' in expected && !(new Date(actual) > expected.$gt)) return false;
        return true;
      }
      if (expected === null) return actual == null;
      if (expected instanceof Date) {
        return new Date(actual).getTime() === expected.getTime();
      }
      return actual === expected;
    });

    test('unverified account cannot verify a password reset code', async () => {
      const fixture = createFixture({ user: verifiedUser({ emailVerified: false }) });
      await expectResetError(
        fixture.resetService.verifyPasswordResetCode('person@example.com', '123456'),
        'PASSWORD_RESET_CODE_INVALID'
      );
      assert.equal(fixture.emails.length, 0);
    });
  };

  const apply = (update) => {
    Object.assign(user, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
    Object.entries(update.$inc || {}).forEach(([key, value]) => {
      user[key] = (user[key] || 0) + value;
    });
  };

  return {
    get: () => (user ? { ...user } : null),
    findOne: async (filter) => (matches(filter) ? { ...user } : null),
    findOneAndUpdate: async (filter, update) => {
      if (!matches(filter)) return null;
      apply(update);
      return { ...user };
    },
    updateOne: async (filter, update) => {
      if (!matches(filter)) return { matchedCount: 0 };
      apply(update);
      return { matchedCount: 1 };
    },
  };
};

const createFixture = ({
  user = {
    _id: 'reset-user-1',
    email: 'person@example.com',
    emailVerified: true,
    password: '$2b$10$oldpasswordhash',
    role: 'caregiver',
    username: 'person',
    medications: ['medication-1'],
    caregiverRelationships: ['relationship-1'],
  },
  initialTime = Date.parse('2026-10-06T00:00:00.000Z'),
  randomValues = [123456, 654321, 111111],
  sendEmail = async () => {},
} = {}) => {
  const store = createMemoryStore(user);
  const emails = [];
  const safeLogs = [];
  let currentTime = initialTime;
  let randomIndex = 0;
  let bytesIndex = 0;
  const resetService = createPasswordResetService({
    User: {
      findOne: store.findOne,
      findOneAndUpdate: store.findOneAndUpdate,
      updateOne: store.updateOne,
    },
    emailService: {
      sendPasswordResetEmail: async (email, otp) => {
        emails.push({ email, otp });
        await sendEmail(email, otp);
      },
    },
    randomInt: () => randomValues[randomIndex++] ?? 999999,
    randomBytes: () => Buffer.alloc(32, ++bytesIndex),
    now: () => currentTime,
    logEmailFailure: () => safeLogs.push('Password reset email delivery failed.'),
  });

  return {
    resetService,
    store,
    emails,
    safeLogs,
    advance: (milliseconds) => {
      currentTime += milliseconds;
    },
  };
};

const expectResetError = (promise, code) => assert.rejects(
  promise,
  (error) => error instanceof PasswordResetError && error.code === code
);

const installRouteMocks = (initialUser, sendEmail = async () => {}) => {
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    sendPasswordResetEmail: emailService.sendPasswordResetEmail,
  };
  const store = createMemoryStore(initialUser);
  const emails = [];
  User.findOne = store.findOne;
  User.findOneAndUpdate = store.findOneAndUpdate;
  User.updateOne = store.updateOne;
  emailService.sendPasswordResetEmail = async (email, otp) => {
    emails.push({ email, otp });
    await sendEmail(email, otp);
  };

  return {
    store,
    emails,
    restore: () => {
      User.findOne = originals.findOne;
      User.findOneAndUpdate = originals.findOneAndUpdate;
      User.updateOne = originals.updateOne;
      emailService.sendPasswordResetEmail = originals.sendPasswordResetEmail;
    },
  };
};

const invokeRoute = async (path, body) => {
  const layer = authRoutes.stack.find((item) => item.route?.path === path);
  assert.ok(layer, `Expected auth route ${path}`);
  const handler = layer.route.stack.at(-1).handle;
  const response = {
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
  await handler({ body }, response);
  return response;
};

const verifiedUser = (overrides = {}) => ({
  _id: 'reset-user-1',
  email: 'person@example.com',
  emailVerified: true,
  password: '$2b$10$oldpasswordhash',
  role: 'caregiver',
  username: 'person',
  medications: ['medication-1'],
  caregiverRelationships: ['relationship-1'],
  ...overrides,
});

test('reset OTP generation always produces six digits', () => {
  const fixture = createFixture({ randomValues: [0, 7, 999999] });
  assert.equal(fixture.resetService.generateOtp(), '000000');
  assert.equal(fixture.resetService.generateOtp(), '000007');
  assert.equal(fixture.resetService.generateOtp(), '999999');
});

test('valid forgot-password request uses generic response and sends mocked email', async () => {
  const mocks = installRouteMocks(verifiedUser());
  try {
    const response = await invokeRoute('/forgot-password', {
      email: ' PERSON@example.com ',
    });
    assert.equal(response.statusCode, 202);
    assert.equal(response.body.message, GENERIC_REQUEST_MESSAGE);
    assert.equal(mocks.emails.length, 1);
    assert.equal(mocks.emails[0].email, 'person@example.com');
  } finally {
    mocks.restore();
  }
});

test('unknown email and unverified account receive the same generic response without email', async () => {
  const responses = [];
  for (const user of [
    null,
    verifiedUser({ emailVerified: false }),
  ]) {
    const mocks = installRouteMocks(user);
    try {
      responses.push(await invokeRoute('/forgot-password', {
        email: 'person@example.com',
      }));
      assert.equal(mocks.emails.length, 0);
    } finally {
      mocks.restore();
    }
  }
  assert.deepEqual(responses.map(({ statusCode, body }) => ({ statusCode, body })), [
    { statusCode: 202, body: { message: GENERIC_REQUEST_MESSAGE } },
    { statusCode: 202, body: { message: GENERIC_REQUEST_MESSAGE } },
  ]);
});

test('malformed forgot-password email is rejected', async () => {
  const response = await invokeRoute('/forgot-password', { email: 'not-an-email' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Please enter a valid email address.');
});

test('reset OTP is hashed and expires after ten minutes', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const saved = fixture.store.get();
  assert.match(saved.passwordResetOtpHash, /^\$2[aby]\$/);
  assert.notEqual(saved.passwordResetOtpHash, fixture.emails[0].otp);
  assert.equal(
    await bcrypt.compare(fixture.emails[0].otp, saved.passwordResetOtpHash),
    true
  );
  assert.equal(
    saved.passwordResetOtpExpires.getTime() - saved.passwordResetLastSentAt.getTime(),
    OTP_LIFETIME_MS
  );
});

test('requesting a replacement code invalidates an outstanding reset authorization', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  fixture.advance(RESEND_COOLDOWN_MS);
  await fixture.resetService.requestPasswordReset('person@example.com');
  await expectResetError(
    fixture.resetService.resetPassword(authorization, 'newpass123'),
    'PASSWORD_RESET_AUTHORIZATION_INVALID'
  );
});

test('expired reset OTP is rejected', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  fixture.advance(OTP_LIFETIME_MS);
  await expectResetError(
    fixture.resetService.verifyPasswordResetCode('person@example.com', fixture.emails[0].otp),
    'PASSWORD_RESET_CODE_EXPIRED'
  );
});

test('wrong reset OTP is rejected and increments the attempt counter', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  await expectResetError(
    fixture.resetService.verifyPasswordResetCode('person@example.com', '000000'),
    'PASSWORD_RESET_CODE_INVALID'
  );
  assert.equal(fixture.store.get().passwordResetAttempts, 1);
});

test('fifth wrong reset OTP invalidates the code and prevents further attempts', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await expectResetError(
      fixture.resetService.verifyPasswordResetCode('person@example.com', '000000'),
      attempt === MAX_ATTEMPTS - 1
        ? 'PASSWORD_RESET_ATTEMPTS_EXCEEDED'
        : 'PASSWORD_RESET_CODE_INVALID'
    );
  }
  const saved = fixture.store.get();
  assert.equal(saved.passwordResetAttempts, MAX_ATTEMPTS);
  assert.equal('passwordResetOtpHash' in saved, false);
  await expectResetError(
    fixture.resetService.verifyPasswordResetCode('person@example.com', fixture.emails[0].otp),
    'PASSWORD_RESET_ATTEMPTS_EXCEEDED'
  );
});

test('resend cooldown suppresses a second email before sixty seconds', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  fixture.advance(RESEND_COOLDOWN_MS - 1);
  await fixture.resetService.requestPasswordReset('person@example.com');
  assert.equal(fixture.emails.length, 1);
});

test('a new reset OTP invalidates the previous code after cooldown', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const previousOtp = fixture.emails[0].otp;
  fixture.advance(RESEND_COOLDOWN_MS);
  await fixture.resetService.requestPasswordReset('person@example.com');
  assert.equal(fixture.emails.length, 2);
  await expectResetError(
    fixture.resetService.verifyPasswordResetCode('person@example.com', previousOtp),
    'PASSWORD_RESET_CODE_INVALID'
  );
});

test('successful code verification returns an opaque authorization and consumes OTP', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  const saved = fixture.store.get();
  assert.match(authorization, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(saved.passwordResetAuthorizationHash, authorization);
  assert.equal('passwordResetOtpHash' in saved, false);
  assert.equal('passwordResetOtpExpires' in saved, false);
  assert.equal(saved.passwordResetAttempts, 0);
  assert.equal(saved.passwordResetLastSentAt instanceof Date, true);
  assert.equal(
    saved.passwordResetAuthorizationExpires.getTime()
      - fixture.store.get().passwordResetLastSentAt.getTime(),
    RESET_AUTHORIZATION_LIFETIME_MS
  );
  await expectResetError(
    fixture.resetService.verifyPasswordResetCode('person@example.com', fixture.emails[0].otp),
    'PASSWORD_RESET_CODE_MISSING'
  );
});

test('expired reset authorization is rejected', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  fixture.advance(RESET_AUTHORIZATION_LIFETIME_MS);
  await expectResetError(
    fixture.resetService.resetPassword(authorization, 'newpass123'),
    'PASSWORD_RESET_AUTHORIZATION_INVALID'
  );
});

test('reset authorization is single-use', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  await fixture.resetService.resetPassword(authorization, 'newpass123');
  await expectResetError(
    fixture.resetService.resetPassword(authorization, 'anotherpass123'),
    'PASSWORD_RESET_AUTHORIZATION_INVALID'
  );
});

test('opaque reset authorization is rejected by normal JWT auth middleware', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'password-reset-test-secret';
  const response = {
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
  let nextCalled = false;
  try {
    authMiddleware({
      headers: { authorization: `Bearer ${authorization}` },
    }, response, () => {
      nextCalled = true;
    });
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('reset rejects weak and whitespace-containing passwords', async () => {
  const fixture = createFixture();
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  for (const password of ['short', 'with space']) {
    await expectResetError(
      fixture.resetService.resetPassword(authorization, password),
      'PASSWORD_REQUIREMENTS_NOT_MET'
    );
  }
});

test('successful reset changes only the password and clears reset state', async () => {
  const original = verifiedUser({
    password: await bcrypt.hash('old-password', 10),
    passwordResetOtpHash: 'old-otp-hash',
    passwordResetOtpExpires: new Date('2026-10-07T00:00:00Z'),
    passwordResetAttempts: 2,
    passwordResetLastSentAt: new Date('2026-10-06T00:00:00Z'),
  });
  const fixture = createFixture({
    user: original,
    initialTime: Date.parse('2026-10-06T00:02:00.000Z'),
  });
  await fixture.resetService.requestPasswordReset('person@example.com');
  const authorization = await fixture.resetService.verifyPasswordResetCode(
    'person@example.com',
    fixture.emails[0].otp
  );
  await fixture.resetService.resetPassword(authorization, 'newpass123');
  const saved = fixture.store.get();
  assert.equal(await bcrypt.compare('old-password', saved.password), false);
  assert.equal(await bcrypt.compare('newpass123', saved.password), true);
  assert.equal(saved.role, original.role);
  assert.equal(saved.email, original.email);
  assert.equal(saved.emailVerified, original.emailVerified);
  assert.deepEqual(saved.medications, original.medications);
  assert.deepEqual(saved.caregiverRelationships, original.caregiverRelationships);
  for (const field of [
    'passwordResetOtpHash',
    'passwordResetOtpExpires',
    'passwordResetAttempts',
    'passwordResetLastSentAt',
    'passwordResetAuthorizationHash',
    'passwordResetAuthorizationExpires',
  ]) {
    assert.equal(field in saved, false, field);
  }
});

test('reset authorization cannot be used for an unverified account', async () => {
  const fixture = createFixture({ user: verifiedUser({ emailVerified: false }) });
  await expectResetError(
    fixture.resetService.resetPassword('A'.repeat(43), 'newpass123'),
    'PASSWORD_RESET_AUTHORIZATION_INVALID'
  );
});

test('password reset uses only the injected email service and sanitizes delivery failures', async () => {
  const fixture = createFixture({
    sendEmail: async () => {
      throw new Error('Sensitive SMTP details');
    },
  });
  await fixture.resetService.requestPasswordReset('person@example.com');
  assert.deepEqual(fixture.safeLogs, ['Password reset email delivery failed.']);
  assert.equal(fixture.store.get().passwordResetOtpHash, undefined);
  assert.equal(fixture.emails.length, 1);
});

test('forgot-password delivery failure returns the same generic response', async () => {
  const mocks = installRouteMocks(verifiedUser(), async () => {
    throw new Error('SMTP provider detail must not escape');
  });
  try {
    const response = await invokeRoute('/forgot-password', {
      email: 'person@example.com',
    });
    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.body, { message: GENERIC_REQUEST_MESSAGE });
    assert.equal(JSON.stringify(response.body).includes('SMTP provider detail'), false);
  } finally {
    mocks.restore();
  }
});

test('reset authorization is not returned before a correct OTP', async () => {
  const mocks = installRouteMocks(verifiedUser());
  try {
    await invokeRoute('/forgot-password', { email: 'person@example.com' });
    const response = await invokeRoute('/verify-password-reset', {
      email: 'person@example.com',
      otp: '000000',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.resetAuthorization, undefined);
  } finally {
    mocks.restore();
  }
});

test('password reset route does not return account credentials', async () => {
  const mocks = installRouteMocks(verifiedUser({
    password: await bcrypt.hash('old-password', 4),
  }));
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'password-reset-route-test-secret';
  try {
    await invokeRoute('/forgot-password', { email: 'person@example.com' });
    const verified = await invokeRoute('/verify-password-reset', {
      email: 'person@example.com',
      otp: mocks.emails[0].otp,
    });
    assert.equal(JSON.stringify(verified.body).includes(mocks.emails[0].otp), false);
    const response = await invokeRoute('/reset-password', {
      resetAuthorization: verified.body.resetAuthorization,
      newPassword: 'newpass123',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.password, undefined);
    assert.equal(response.body.resetAuthorization, undefined);
    assert.equal(mocks.store.get().role, 'caregiver');
    assert.equal(mocks.store.get().emailVerified, true);

    const oldPasswordLogin = await invokeRoute('/login', {
      email: 'person@example.com',
      password: 'old-password',
    });
    const newPasswordLogin = await invokeRoute('/login', {
      email: 'person@example.com',
      password: 'newpass123',
    });
    assert.equal(oldPasswordLogin.statusCode, 401);
    assert.equal(newPasswordLogin.statusCode, 200);
    assert.equal(newPasswordLogin.body.user.role, 'caregiver');
  } finally {
    mocks.restore();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
