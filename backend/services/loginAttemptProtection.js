const crypto = require('crypto');

const FAILURE_THRESHOLD = 5;
const IP_FAILURE_THRESHOLD = 20;
const COOLDOWN_MS = 5 * 60 * 1000;

const createMongoLoginAttemptStore = (LoginAttemptState) => ({
  get: async (key) => LoginAttemptState.findById(key).lean(),

  async recordFailure(key, threshold) {
    const previousAttempts = { $ifNull: ['$failedAttempts', 0] };
    const cooldownExpired = {
      $and: [
        { $ne: [{ $ifNull: ['$cooldownStartedAt', null] }, null] },
        {
          $lte: [
            { $add: ['$cooldownStartedAt', COOLDOWN_MS] },
            '$$NOW',
          ],
        },
      ],
    };
    const nextAttempts = {
      $add: [
        { $cond: [cooldownExpired, 0, previousAttempts] },
        1,
      ],
    };

    const update = [
      {
        $set: {
          failedAttempts: nextAttempts,
          cooldownStartedAt: {
            $cond: [
              { $eq: [nextAttempts, threshold] },
              '$$NOW',
              {
                $cond: [
                  cooldownExpired,
                  null,
                  { $ifNull: ['$cooldownStartedAt', null] },
                ],
              },
            ],
          },
        },
      },
    ];

    try {
      return await LoginAttemptState.findOneAndUpdate(
        { _id: key },
        update,
        { upsert: true, returnDocument: 'after', updatePipeline: true }
      ).lean();
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      return LoginAttemptState.findOneAndUpdate(
        { _id: key },
        update,
        { returnDocument: 'after', updatePipeline: true }
      ).lean();
    }
  },

  async resetExpired(key, cooldownStartedAt) {
    await LoginAttemptState.updateOne(
      { _id: key, cooldownStartedAt },
      { $set: { failedAttempts: 0, cooldownStartedAt: null } }
    );
  },

  async clear(key) {
    await LoginAttemptState.deleteOne({ _id: key });
  },
});

const createLoginAttemptProtection = ({
  store,
  secret,
  now = () => Date.now(),
}) => {
  const makeKey = (scope, identifier) => crypto
    .createHmac('sha256', typeof secret === 'function' ? secret() : secret)
    .update(`medsked-login-rate-limit:v1:${scope}:${identifier}`)
    .digest('hex');

  const getKeyCooldown = async (key) => {
    const state = await store.get(key);
    if (!state?.cooldownStartedAt) {
      return 0;
    }

    const startedAt = new Date(state.cooldownStartedAt).getTime();
    const remainingMs = startedAt + COOLDOWN_MS - now();
    if (remainingMs <= 0) {
      await store.resetExpired(key, state.cooldownStartedAt);
      return 0;
    }

    return Math.ceil(remainingMs / 1000);
  };

  return {
    async getRetryAfter(identifier, ip) {
      const [accountSeconds, ipSeconds] = await Promise.all([
        getKeyCooldown(makeKey('account', identifier)),
        getKeyCooldown(makeKey('ip', ip)),
      ]);
      return Math.max(accountSeconds, ipSeconds);
    },

    async recordFailedLogin(identifier, ip) {
      await Promise.all([
        store.recordFailure(makeKey('account', identifier), FAILURE_THRESHOLD),
        store.recordFailure(makeKey('ip', ip), IP_FAILURE_THRESHOLD),
      ]);
    },

    async clearAccountFailures(identifier) {
      await store.clear(makeKey('account', identifier));
    },
  };
};

module.exports = {
  createLoginAttemptProtection,
  createMongoLoginAttemptStore,
  FAILURE_THRESHOLD,
  IP_FAILURE_THRESHOLD,
  COOLDOWN_MS,
};
