const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginAttemptState = require('../models/LoginAttemptState');
const emailService = require('../services/emailService');
const authRoutes = require('../routes/authRoutes');
const {
  createEmailVerificationService,
  EmailVerificationError,
  MAX_ATTEMPTS,
  OTP_LIFETIME_MS,
  RESEND_COOLDOWN_MS,
} = require('../services/emailVerificationService');

const createMemoryUserStore = (initialUser) => {
  let user = initialUser ? { ...initialUser } : null;

  const matches = (filter) => {
    if (!user) {
      return false;
    }
    return Object.entries(filter).every(([key, expected]) => {
      const actual = user[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('$ne' in expected && actual === expected.$ne) return false;
        if ('$lt' in expected && !(actual < expected.$lt)) return false;
        if ('$gt' in expected && !(new Date(actual) > expected.$gt)) return false;
        return true;
      }
      if (expected === null) return actual == null;
      if (expected instanceof Date) {
        return new Date(actual).getTime() === expected.getTime();
      }
      return actual === expected;
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
    set: (nextUser) => {
      user = { ...nextUser };
      return { ...user };
    },
    findOne: async (filter) => {
      if (!user) return null;
      return Object.entries(filter).every(([key, value]) => user[key] === value)
        ? { ...user }
        : null;
    },
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

const createServiceFixture = ({
  user = {
    _id: 'user-1',
    email: 'person@example.com',
    emailVerified: false,
    emailVerificationAttempts: 0,
  },
  initialTime = Date.parse('2026-10-06T00:00:00.000Z'),
  randomValues = [123456, 654321, 111111],
  sendEmail = async () => {},
} = {}) => {
  const store = createMemoryUserStore(user);
  const sentCodes = [];
  let currentTime = initialTime;
  let randomIndex = 0;
  const service = createEmailVerificationService({
    User: {
      findOne: store.findOne,
      findOneAndUpdate: store.findOneAndUpdate,
      updateOne: store.updateOne,
    },
    emailService: {
      sendVerificationEmail: async (email, otp) => {
        sentCodes.push({ email, otp });
        await sendEmail(email, otp);
      },
    },
    randomInt: () => randomValues[randomIndex++] ?? 999999,
    now: () => currentTime,
  });

  return {
    service,
    store,
    sentCodes,
    advance: (milliseconds) => {
      currentTime += milliseconds;
    },
  };
};

const expectVerificationError = async (promise, code) => {
  await assert.rejects(promise, (error) => (
    error instanceof EmailVerificationError && error.code === code
  ));
};

const installRouteStore = (initialUser, sendEmail = async () => {}) => {
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    exists: User.exists,
    create: User.create,
    loginStateFindById: LoginAttemptState.findById,
    loginStateFindOneAndUpdate: LoginAttemptState.findOneAndUpdate,
    loginStateUpdateOne: LoginAttemptState.updateOne,
    loginStateDeleteOne: LoginAttemptState.deleteOne,
    sendVerificationEmail: emailService.sendVerificationEmail,
  };
  const store = createMemoryUserStore(initialUser);
  const sentCodes = [];
  const loginStates = new Map();

  User.findOne = async (filter) => {
    const current = store.get();
    if (!current) return null;
    return Object.entries(filter).every(([key, value]) => current[key] === value)
      ? current
      : null;
  };
  User.findOneAndUpdate = store.findOneAndUpdate;
  User.updateOne = store.updateOne;
  User.exists = async () => false;
  User.create = async (data) => store.set({
    ...data,
    _id: 'user-1',
    emailVerificationAttempts: 0,
  });
  LoginAttemptState.findById = (key) => ({
    lean: async () => loginStates.get(key) || null,
  });
  LoginAttemptState.findOneAndUpdate = (filter, update) => {
    const key = filter._id;
    const threshold = update[0].$set.cooldownStartedAt.$cond[0].$eq[1];
    const now = Date.now();
    const current = loginStates.get(key) || {
      failedAttempts: 0,
      cooldownStartedAt: null,
    };
    if (
      current.cooldownStartedAt
      && current.cooldownStartedAt.getTime() + (5 * 60 * 1000) <= now
    ) {
      current.failedAttempts = 0;
      current.cooldownStartedAt = null;
    }
    current.failedAttempts += 1;
    if (current.failedAttempts === threshold) {
      current.cooldownStartedAt = new Date(now);
    }
    loginStates.set(key, current);
    return {
      lean: async () => ({ ...current }),
    };
  };
  LoginAttemptState.updateOne = async (filter, update) => {
    const current = loginStates.get(filter._id);
    if (
      current
      && current.cooldownStartedAt?.getTime() === filter.cooldownStartedAt.getTime()
    ) {
      Object.assign(current, update.$set);
    }
    return { matchedCount: current ? 1 : 0 };
  };
  LoginAttemptState.deleteOne = async (filter) => ({
    deletedCount: loginStates.delete(filter._id) ? 1 : 0,
  });
  emailService.sendVerificationEmail = async (email, otp) => {
    sentCodes.push({ email, otp });
    await sendEmail(email, otp);
  };

  return {
    store,
    sentCodes,
    restore: () => {
      Object.assign(User, {
        findOne: originals.findOne,
        findOneAndUpdate: originals.findOneAndUpdate,
        updateOne: originals.updateOne,
        exists: originals.exists,
        create: originals.create,
      });
      Object.assign(LoginAttemptState, {
        findById: originals.loginStateFindById,
        findOneAndUpdate: originals.loginStateFindOneAndUpdate,
        updateOne: originals.loginStateUpdateOne,
        deleteOne: originals.loginStateDeleteOne,
      });
      emailService.sendVerificationEmail = originals.sendVerificationEmail;
    },
    loginStates,
  };
};

const invokeAuthRoute = async (path, body) => {
  const layer = authRoutes.stack.find((item) => item.route?.path === path);
  assert.ok(layer, `Expected auth route ${path} to exist`);
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
  const originalSecret = process.env.JWT_SECRET;
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'auth-route-test-secret';
  }
  try {
    await handler({ body, ip: '203.0.113.10' }, response);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    }
  }
  return response;
};

test('OTP generation always produces six decimal digits', () => {
  const fixture = createServiceFixture({
    randomValues: [0, 7, 999999],
  });
  assert.equal(fixture.service.generateOtp(), '000000');
  assert.equal(fixture.service.generateOtp(), '000007');
  assert.equal(fixture.service.generateOtp(), '999999');
});

test('OTP is stored as a password hash rather than plaintext', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  const { otp } = fixture.sentCodes[0];
  const saved = fixture.store.get();
  assert.notEqual(saved.emailVerificationOtpHash, otp);
  assert.match(saved.emailVerificationOtpHash, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(otp, saved.emailVerificationOtpHash), true);
  assert.equal(
    saved.emailVerificationExpires.getTime()
      - saved.emailVerificationLastSentAt.getTime(),
    OTP_LIFETIME_MS
  );
});

test('a valid OTP verifies the account and clears OTP data', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  await fixture.service.verifyEmail(' PERSON@example.com ', fixture.sentCodes[0].otp);
  const saved = fixture.store.get();
  assert.equal(saved.emailVerified, true);
  assert.equal(saved.emailVerificationAttempts, 0);
  assert.equal('emailVerificationOtpHash' in saved, false);
  assert.equal('emailVerificationExpires' in saved, false);
  assert.equal('emailVerificationLastSentAt' in saved, false);
});

test('an incorrect OTP is rejected and increments attempts', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', '000000'),
    'VERIFICATION_CODE_INVALID'
  );
  assert.equal(fixture.store.get().emailVerificationAttempts, 1);
});

test('malformed OTP input is rejected without counting a guess', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', '12345'),
    'VERIFICATION_CODE_FORMAT_INVALID'
  );
  assert.equal(fixture.store.get().emailVerificationAttempts, 0);
});

test('attempts are capped at five and further guessing is blocked', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await expectVerificationError(
      fixture.service.verifyEmail('person@example.com', '000000'),
      'VERIFICATION_CODE_INVALID'
    );
  }
  assert.equal(fixture.store.get().emailVerificationAttempts, MAX_ATTEMPTS);
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', fixture.sentCodes[0].otp),
    'VERIFICATION_ATTEMPTS_EXCEEDED'
  );
});

test('already verified accounts cannot request a resend', async () => {
  const fixture = createServiceFixture({
    user: { _id: 'user-1', email: 'person@example.com', emailVerified: true },
  });
  await expectVerificationError(
    fixture.service.requestVerificationCode('person@example.com'),
    'EMAIL_ALREADY_VERIFIED'
  );
  assert.equal(fixture.sentCodes.length, 0);
});

test('expired OTP is rejected', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  fixture.advance(OTP_LIFETIME_MS);
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', fixture.sentCodes[0].otp),
    'VERIFICATION_CODE_EXPIRED'
  );
});

test('already verified accounts cannot verify again', async () => {
  const fixture = createServiceFixture({
    user: { _id: 'user-1', email: 'person@example.com', emailVerified: true },
  });
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', '123456'),
    'EMAIL_ALREADY_VERIFIED'
  );
});

test('resending sends a new OTP and resets failed attempts', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', '000000'),
    'VERIFICATION_CODE_INVALID'
  );
  fixture.advance(RESEND_COOLDOWN_MS);
  await fixture.service.requestVerificationCode('person@example.com');
  assert.equal(fixture.sentCodes.length, 2);
  assert.notEqual(fixture.sentCodes[0].otp, fixture.sentCodes[1].otp);
  assert.equal(fixture.store.get().emailVerificationAttempts, 0);
  assert.equal(
    await bcrypt.compare(
      fixture.sentCodes[1].otp,
      fixture.store.get().emailVerificationOtpHash
    ),
    true
  );
});

test('resending invalidates the previous OTP', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  const oldOtp = fixture.sentCodes[0].otp;
  fixture.advance(RESEND_COOLDOWN_MS);
  await fixture.service.requestVerificationCode('person@example.com');
  await expectVerificationError(
    fixture.service.verifyEmail('person@example.com', oldOtp),
    'VERIFICATION_CODE_INVALID'
  );
  await fixture.service.verifyEmail('person@example.com', fixture.sentCodes[1].otp);
  assert.equal(fixture.store.get().emailVerified, true);
});

test('resend cooldown rejects an early request and reports its remaining time', async () => {
  const fixture = createServiceFixture();
  await fixture.service.sendInitialVerificationCode('person@example.com');
  fixture.advance(RESEND_COOLDOWN_MS - 1);
  await assert.rejects(
    fixture.service.requestVerificationCode('person@example.com'),
    (error) => error.code === 'VERIFICATION_RESEND_COOLDOWN'
      && error.retryAfterSeconds === 1
  );
  assert.equal(fixture.sentCodes.length, 1);
});

test('expired OTP data is cleared when sending the verification email fails', async () => {
  const fixture = createServiceFixture({
    sendEmail: async () => {
      throw new Error('Provider response must not escape');
    },
  });
  await expectVerificationError(
    fixture.service.sendInitialVerificationCode('person@example.com'),
    'VERIFICATION_EMAIL_SEND_FAILED'
  );
  const saved = fixture.store.get();
  assert.equal('emailVerificationOtpHash' in saved, false);
  assert.equal('emailVerificationExpires' in saved, false);
  assert.equal('emailVerificationLastSentAt' in saved, false);
});

test('registration sends an OTP but does not create an authenticated session', async () => {
  const mocks = installRouteStore(null);
  try {
    const response = await invokeAuthRoute('/register', {
      name: 'TestPerson',
      email: ' Person@example.com ',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.verificationRequired, true);
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.email, 'person@example.com');
    assert.equal(mocks.store.get().emailVerified, false);
    assert.equal(mocks.store.get().termsAccepted, true);
    assert.ok(mocks.store.get().termsAcceptedAt instanceof Date);
    assert.equal(mocks.sentCodes.length, 1);
    assert.equal(JSON.stringify(response.body).includes(mocks.sentCodes[0].otp), false);
  } finally {
    mocks.restore();
  }
});

test('registration accepts valid usernames and keeps duplicate suffix generation unchanged', async () => {
  const availableMocks = installRouteStore(null);
  try {
    const availableResponse = await invokeAuthRoute('/register', {
      name: 'giovanni',
      email: 'available@example.com',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(availableResponse.statusCode, 201);
    assert.equal(availableMocks.store.get().username, 'giovanni');
  } finally {
    availableMocks.restore();
  }

  const duplicateMocks = installRouteStore({
    _id: 'existing-user',
    username: 'giovanni',
    email: 'existing@example.com',
  });
  try {
    const duplicateResponse = await invokeAuthRoute('/register', {
      name: 'giovanni',
      email: 'duplicate@example.com',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(duplicateResponse.statusCode, 201);
    assert.equal(duplicateMocks.store.get().username, 'giovanni1');
  } finally {
    duplicateMocks.restore();
  }

  const longDuplicateMocks = installRouteStore({
    _id: 'existing-user',
    username: 'abcdefghij',
    email: 'existing@example.com',
  });
  try {
    const longDuplicateResponse = await invokeAuthRoute('/register', {
      name: 'abcdefghij',
      email: 'long-duplicate@example.com',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(longDuplicateResponse.statusCode, 201);
    assert.equal(longDuplicateMocks.store.get().username, 'abcdefghij1');
  } finally {
    longDuplicateMocks.restore();
  }
});

test('registration accepts 10-letter usernames and rejects invalid user input', async () => {
  const validMocks = installRouteStore(null);
  try {
    const response = await invokeAuthRoute('/register', {
      name: 'abcdefghij',
      email: 'tenletters@example.com',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(response.statusCode, 201);
    assert.equal(validMocks.store.get().username, 'abcdefghij');
  } finally {
    validMocks.restore();
  }

  for (const name of [
    'abcdefghijk',
    'giovanni1',
    'john123',
    'john doe',
    'john_doe',
    'john-doe',
    'john@doe',
  ]) {
    const mocks = installRouteStore(null);
    try {
      const response = await invokeAuthRoute('/register', {
        name,
        email: 'person@example.com',
        password: 'secure-pass',
        role: 'caregiver',
        termsAccepted: true,
      });
      assert.equal(response.statusCode, 400, name);
      assert.match(response.body.message, /Username must contain only letters/);
      assert.equal(mocks.store.get(), null);
      assert.equal(mocks.sentCodes.length, 0);
    } finally {
      mocks.restore();
    }
  }
});

test('registration rejects missing or false terms acceptance without creating an account', async () => {
  for (const termsAccepted of [undefined, false]) {
    const mocks = installRouteStore(null);
    try {
      const response = await invokeAuthRoute('/register', {
        name: 'TestPerson',
        email: 'person@example.com',
        password: 'secure-pass',
        role: 'caregiver',
        ...(termsAccepted === undefined ? {} : { termsAccepted }),
      });

      assert.equal(response.statusCode, 400);
      assert.equal(
        response.body.message,
        'You must accept the MedSked Terms & Conditions.'
      );
      assert.equal(mocks.store.get(), null);
      assert.equal(mocks.sentCodes.length, 0);
    } finally {
      mocks.restore();
    }
  }
});

test('terms acceptance fields are defined with a false model default', () => {
  assert.equal(User.schema.path('termsAccepted').instance, 'Boolean');
  assert.equal(User.schema.path('termsAccepted').defaultValue, false);
  assert.equal(User.schema.path('termsAcceptedAt').instance, 'Date');
});

test('registration accepts valid email addresses from different providers', async () => {
  for (const email of [
    'test@gmail.com',
    'test@outlook.com',
    'test@phinmaed.com',
  ]) {
    const mocks = installRouteStore(null);
    try {
      const response = await invokeAuthRoute('/register', {
        name: 'TestPerson',
        email,
        password: 'secure-pass',
        role: 'caregiver',
        termsAccepted: true,
      });
      assert.equal(response.statusCode, 201, email);
      assert.equal(mocks.store.get().email, email);
      assert.equal(mocks.store.get().termsAccepted, true);
      assert.ok(mocks.store.get().termsAcceptedAt instanceof Date);
      assert.equal(mocks.sentCodes.length, 1);
    } finally {
      mocks.restore();
    }
  }
});

test('registration rejects malformed and empty email addresses', async () => {
  for (const email of ['test', '@gmail.com', 'test@', 'test@.', '']) {
    const mocks = installRouteStore(null);
    try {
      const response = await invokeAuthRoute('/register', {
        name: 'TestPerson',
        email,
        password: 'secure-pass',
        role: 'caregiver',
        termsAccepted: true,
      });
      assert.equal(response.statusCode, 400, JSON.stringify(email));
      assert.equal(mocks.store.get(), null);
      assert.equal(mocks.sentCodes.length, 0);
    } finally {
      mocks.restore();
    }
  }
});

test('registration handles email delivery failure without exposing provider details', async () => {
  const mocks = installRouteStore(null, async () => {
    throw new Error('SMTP provider detail must not escape');
  });
  try {
    const response = await invokeAuthRoute('/register', {
      name: 'TestPerson',
      email: 'person@example.com',
      password: 'secure-pass',
      role: 'caregiver',
      termsAccepted: true,
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.verificationRequired, true);
    assert.equal(
      response.body.message,
      'Unable to send the verification email. Please try again.'
    );
    assert.equal(JSON.stringify(response.body).includes('SMTP provider detail'), false);
    assert.equal(response.body.token, undefined);
    assert.equal('emailVerificationOtpHash' in mocks.store.get(), false);
  } finally {
    mocks.restore();
  }
});

test('unverified login is blocked after password validation and returns no token', async () => {
  const password = await bcrypt.hash('secure-pass', 4);
  const mocks = installRouteStore({
    _id: 'user-1',
    username: 'testperson',
    email: 'person@example.com',
    password,
    role: 'patient',
    patientId: 'MSK-123456',
    emailVerified: false,
  });
  try {
    const response = await invokeAuthRoute('/login', {
      email: ' PERSON@example.com ',
      password: 'secure-pass',
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, 'EMAIL_VERIFICATION_REQUIRED');
    assert.equal(response.body.email, 'person@example.com');
    assert.equal(response.body.token, undefined);
  } finally {
    mocks.restore();
  }
});

test('verified login preserves the existing token response and claims', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'email-verification-test-secret';
  const password = await bcrypt.hash('secure-pass', 4);
  const mocks = installRouteStore({
    _id: 'user-1',
    username: 'testperson',
    email: 'person@example.com',
    password,
    role: 'patient',
    patientId: 'MSK-123456',
    emailVerified: true,
  });
  try {
    const response = await invokeAuthRoute('/login', {
      email: 'person@example.com',
      password: 'secure-pass',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(typeof response.body.token, 'string');
    assert.equal(response.body.user.role, 'patient');
    const claims = jwt.verify(response.body.token, process.env.JWT_SECRET);
    assert.deepEqual(
      { userId: claims.userId, username: claims.username, role: claims.role },
      { userId: 'user-1', username: 'testperson', role: 'patient' }
    );
    assert.ok(claims.exp - claims.iat <= 7 * 24 * 60 * 60);
    assert.equal(mocks.loginStates.size, 0);
  } finally {
    mocks.restore();
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('failed login attempts are generic and enter account cooldown at threshold', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'email-verification-test-secret';
  const password = await bcrypt.hash('secure-pass', 4);
  const mocks = installRouteStore({
    _id: 'user-1',
    username: 'testperson',
    email: 'person@example.com',
    password,
    role: 'patient',
    emailVerified: true,
  });
  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await invokeAuthRoute('/login', {
        email: 'person@example.com',
        password: 'incorrect',
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.message, 'Invalid email or password.');
      assert.equal(response.body.token, undefined);
    }

    const sixthAttempt = await invokeAuthRoute('/login', {
      email: 'person@example.com',
      password: 'secure-pass',
    });
    assert.equal(sixthAttempt.statusCode, 429);
    assert.equal(
      sixthAttempt.body.message,
      'Too many failed authentication attempts. Please try again later.'
    );
    assert.equal(sixthAttempt.body.email, undefined);
    assert.equal(typeof sixthAttempt.body.retryAfterSeconds, 'number');
  } finally {
    mocks.restore();
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('unknown login identifiers receive the same generic cooldown behavior', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'email-verification-test-secret';
  const mocks = installRouteStore(null);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await invokeAuthRoute('/login', {
        email: 'unknown@example.com',
        password: 'incorrect',
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.message, 'Invalid email or password.');
    }

    const locked = await invokeAuthRoute('/login', {
      email: 'unknown@example.com',
      password: 'anything',
    });
    assert.equal(locked.statusCode, 429);
    assert.equal(
      locked.body.message,
      'Too many failed authentication attempts. Please try again later.'
    );
    assert.equal(locked.body.email, undefined);
  } finally {
    mocks.restore();
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('malformed login requests do not increment failed-login state', async () => {
  const mocks = installRouteStore(null);
  try {
    const response = await invokeAuthRoute('/login', {
      email: 'not-an-email',
      password: 'incorrect',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(mocks.loginStates.size, 0);
  } finally {
    mocks.restore();
  }
});

test('resend route sends a code without returning it', async () => {
  const mocks = installRouteStore({
    _id: 'user-1',
    email: 'person@example.com',
    emailVerified: false,
    emailVerificationAttempts: 0,
  });
  try {
    const response = await invokeAuthRoute('/resend-verification', {
      email: 'person@example.com',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(mocks.sentCodes.length, 1);
    assert.equal(JSON.stringify(response.body).includes(mocks.sentCodes[0].otp), false);
  } finally {
    mocks.restore();
  }
});

test('verification route confirms email and returns the normal authenticated session', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'email-verification-test-secret';
  const mocks = installRouteStore({
    _id: 'user-1',
    username: 'testperson',
    email: 'person@example.com',
    role: 'caregiver',
    emailVerified: false,
    emailVerificationAttempts: 0,
  });
  try {
    const issued = await invokeAuthRoute('/resend-verification', {
      email: 'person@example.com',
    });
    assert.equal(issued.statusCode, 200);
    const otp = mocks.sentCodes[0].otp;
    const response = await invokeAuthRoute('/verify-email', {
      email: ' PERSON@example.com ',
      otp,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message, 'Email verified successfully.');
    assert.equal(typeof response.body.token, 'string');
    assert.deepEqual(response.body.user, {
      id: 'user-1',
      username: 'testperson',
      email: 'person@example.com',
      patientId: undefined,
      role: 'caregiver',
    });
    const claims = jwt.verify(response.body.token, process.env.JWT_SECRET);
    assert.deepEqual(
      { userId: claims.userId, username: claims.username, role: claims.role },
      { userId: 'user-1', username: 'testperson', role: 'caregiver' }
    );
    assert.ok(claims.exp - claims.iat <= 7 * 24 * 60 * 60);
    assert.equal(JSON.stringify(response.body).includes(otp), false);
    assert.equal(mocks.store.get().emailVerified, true);
  } finally {
    mocks.restore();
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('incorrect OTP does not verify the account or return a token', async () => {
  const mocks = installRouteStore({
    _id: 'user-1',
    email: 'person@example.com',
    emailVerified: false,
    emailVerificationAttempts: 0,
  });
  try {
    const issued = await invokeAuthRoute('/resend-verification', {
      email: 'person@example.com',
    });
    assert.equal(issued.statusCode, 200);
    const submittedOtp = mocks.sentCodes[0].otp === '000000' ? '000001' : '000000';
    const response = await invokeAuthRoute('/verify-email', {
      email: 'person@example.com',
      otp: submittedOtp,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.user, undefined);
    assert.equal(mocks.store.get().emailVerified, false);
  } finally {
    mocks.restore();
  }
});

test('expired OTP does not verify the account or return a token', async () => {
  const otpHash = await bcrypt.hash('123456', 4);
  const mocks = installRouteStore({
    _id: 'user-1',
    email: 'person@example.com',
    emailVerified: false,
    emailVerificationOtpHash: otpHash,
    emailVerificationExpires: new Date(Date.now() - 1000),
    emailVerificationAttempts: 0,
  });
  try {
    const response = await invokeAuthRoute('/verify-email', {
      email: 'person@example.com',
      otp: '123456',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.user, undefined);
    assert.equal(mocks.store.get().emailVerified, false);
  } finally {
    mocks.restore();
  }
});

test('missing OTP does not verify the account or return a token', async () => {
  const mocks = installRouteStore({
    _id: 'user-1',
    email: 'person@example.com',
    emailVerified: false,
    emailVerificationAttempts: 0,
  });
  try {
    const response = await invokeAuthRoute('/verify-email', {
      email: 'person@example.com',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.user, undefined);
    assert.equal(mocks.store.get().emailVerified, false);
  } finally {
    mocks.restore();
  }
});
