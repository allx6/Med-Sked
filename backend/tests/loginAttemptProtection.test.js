const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createLoginAttemptProtection,
  FAILURE_THRESHOLD,
  IP_FAILURE_THRESHOLD,
  COOLDOWN_MS,
} = require('../services/loginAttemptProtection');

const createFixture = () => {
  const states = new Map();
  let now = Date.parse('2026-10-14T10:00:00.000Z');
  const store = {
    get: async (key) => states.get(key) || null,
    recordFailure: async (key, threshold) => {
      const state = states.get(key) || {
        failedAttempts: 0,
        cooldownStartedAt: null,
      };
      if (
        state.cooldownStartedAt
        && state.cooldownStartedAt.getTime() + COOLDOWN_MS <= now
      ) {
        state.failedAttempts = 0;
        state.cooldownStartedAt = null;
      }
      state.failedAttempts += 1;
      if (state.failedAttempts === threshold) {
        state.cooldownStartedAt = new Date(now);
      }
      states.set(key, state);
      return state;
    },
    resetExpired: async (key, cooldownStartedAt) => {
      const state = states.get(key);
      if (state?.cooldownStartedAt?.getTime() === cooldownStartedAt.getTime()) {
        state.failedAttempts = 0;
        state.cooldownStartedAt = null;
      }
    },
    clear: async (key) => states.delete(key),
  };
  const protection = createLoginAttemptProtection({
    store,
    secret: 'test-secret',
    now: () => now,
  });
  return {
    protection,
    states,
    advance: (milliseconds) => { now += milliseconds; },
    currentTime: () => now,
  };
};

test('account failures start a five-minute cooldown on the fifth failure', async () => {
  const fixture = createFixture();
  assert.equal(FAILURE_THRESHOLD, 5);

  for (let failure = 1; failure < FAILURE_THRESHOLD; failure += 1) {
    await fixture.protection.recordFailedLogin('person@example.com', '192.0.2.1');
    assert.equal(
      await fixture.protection.getRetryAfter('person@example.com', '192.0.2.1'),
      0
    );
    fixture.advance(30_000);
  }

  fixture.advance(45_000);
  await fixture.protection.recordFailedLogin('person@example.com', '192.0.2.1');
  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '198.51.100.2'),
    300
  );
});

test('account cooldown follows the identifier across networks and expires at five minutes', async () => {
  const fixture = createFixture();
  for (let failure = 0; failure < FAILURE_THRESHOLD; failure += 1) {
    await fixture.protection.recordFailedLogin('person@example.com', '192.0.2.1');
  }

  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '198.51.100.2'),
    300
  );
  assert.equal(
    await fixture.protection.getRetryAfter('another@example.com', '198.51.100.2'),
    0
  );

  fixture.advance(COOLDOWN_MS - 1);
  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '198.51.100.2'),
    1
  );
  fixture.advance(1);
  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '198.51.100.2'),
    0
  );
  assert.ok(
    [...fixture.states.values()].some(
      (state) => state.failedAttempts === 0 && state.cooldownStartedAt === null
    )
  );
});

test('successful authentication can clear account failures without clearing IP failures', async () => {
  const fixture = createFixture();
  await fixture.protection.recordFailedLogin('person@example.com', '192.0.2.1');
  await fixture.protection.clearAccountFailures('person@example.com');

  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '192.0.2.1'),
    0
  );
  assert.equal(fixture.states.size, 1);
});

test('the shared IP cooldown starts on failed attempt twenty', async () => {
  const fixture = createFixture();
  assert.equal(IP_FAILURE_THRESHOLD, 20);

  for (let failure = 1; failure <= IP_FAILURE_THRESHOLD; failure += 1) {
    await fixture.protection.recordFailedLogin(`user${failure}@example.com`, '192.0.2.1');
    if (failure < IP_FAILURE_THRESHOLD) {
      assert.equal(
        await fixture.protection.getRetryAfter('unrelated@example.com', '192.0.2.1'),
        0
      );
    }
  }

  assert.equal(
    await fixture.protection.getRetryAfter('unrelated@example.com', '192.0.2.1'),
    300
  );
});

test('IP cooldown expires exactly five minutes after its threshold failure', async () => {
  const fixture = createFixture();
  for (let failure = 1; failure <= IP_FAILURE_THRESHOLD; failure += 1) {
    await fixture.protection.recordFailedLogin(`user${failure}@example.com`, '192.0.2.1');
    fixture.advance(1_000);
  }

  const thresholdTime = fixture.currentTime() - 1_000;
  assert.equal(
    await fixture.protection.getRetryAfter('another@example.com', '192.0.2.1'),
    299
  );
  fixture.advance(COOLDOWN_MS - 1_000 - 1);
  assert.equal(
    await fixture.protection.getRetryAfter('another@example.com', '192.0.2.1'),
    1
  );
  fixture.advance(1);
  assert.equal(
    await fixture.protection.getRetryAfter('another@example.com', '192.0.2.1'),
    0
  );
  assert.equal(
    thresholdTime,
    Date.parse('2026-10-14T10:00:00.000Z') + (IP_FAILURE_THRESHOLD - 1) * 1_000
  );
});

test('account and IP state use independent counters', async () => {
  const fixture = createFixture();
  for (let failure = 1; failure <= FAILURE_THRESHOLD; failure += 1) {
    await fixture.protection.recordFailedLogin('person@example.com', '192.0.2.1');
  }

  assert.equal(
    await fixture.protection.getRetryAfter('person@example.com', '198.51.100.2'),
    300
  );
  assert.equal(
    await fixture.protection.getRetryAfter('another@example.com', '192.0.2.1'),
    0
  );
});
