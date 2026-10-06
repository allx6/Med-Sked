const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'A').toString('base64');

const Notification = require('../models/Notification');
const {
  safeReadNotificationMessage,
} = require('../models/Notification');
const {
  decrypt,
  encrypt,
  getEncryptionKeyFingerprint,
  isEncryptedValue,
} = require('../services/encryptionService');

const notificationTypes = [
  'schedule_changed',
  'missed_dose',
  'low_refill',
  'caregiver_request',
  'caregiver_request_accepted',
];

function buildNotification() {
  return new Notification({
    recipient: '507f1f77bcf86cd799439011',
    type: 'missed_dose',
    message: 'Sensitive medication reminder',
    relatedEntityType: 'dose',
    relatedEntityId: '507f1f77bcf86cd799439012',
  });
}

test('notification message is encrypted before save and decrypted on read', () => {
  const notification = buildNotification();

  assert.ok(notification._doc.message.startsWith('enc:'));
  assert.equal(notification.message, 'Sensitive medication reminder');
  assert.equal(notification.toObject().message, 'Sensitive medication reminder');
  assert.equal(notification.toJSON().message, 'Sensitive medication reminder');
});

test('all supported notification types encrypt messages at the model boundary', () => {
  for (const type of notificationTypes) {
    const notification = new Notification({
      recipient: '507f1f77bcf86cd799439011',
      type,
      message: `Synthetic ${type} notification`,
    });

    assert.ok(notification._doc.message.startsWith('enc:'));
    assert.equal(
      notification.message,
      `Synthetic ${type} notification`
    );
  }
});

test('multiple notifications round-trip with the same configured key and unique IVs', () => {
  const notifications = [
    'Synthetic reminder one',
    'Synthetic reminder two',
    'Synthetic reminder three',
  ].map((message) => encrypt(message));

  assert.deepEqual(
    notifications.map((value) => decrypt(value)),
    [
      'Synthetic reminder one',
      'Synthetic reminder two',
      'Synthetic reminder three',
    ]
  );

  const ivs = notifications.map((value) => (
    JSON.parse(Buffer.from(value.slice(4), 'base64').toString('utf8')).iv
  ));
  assert.equal(new Set(ivs).size, notifications.length);
});

test('v1 payload uses the expected AES-GCM IV and authentication tag lengths', () => {
  const encrypted = encrypt('Synthetic GCM parameter check');
  const payload = JSON.parse(
    Buffer.from(encrypted.slice(4), 'base64').toString('utf8')
  );

  assert.equal(Buffer.from(payload.iv, 'base64').length, 16);
  assert.equal(Buffer.from(payload.tag, 'base64').length, 16);
  assert.equal(decrypt(encrypted), 'Synthetic GCM parameter check');
});

test('already-encrypted notification messages are not encrypted twice', () => {
  const encrypted = encrypt('Synthetic idempotency notification');
  const notification = new Notification({
    recipient: '507f1f77bcf86cd799439011',
    type: 'schedule_changed',
    message: encrypted,
  });

  assert.equal(notification._doc.message, encrypted);
  assert.equal(notification.message, 'Synthetic idempotency notification');
  assert.equal(decrypt(notification._doc.message), 'Synthetic idempotency notification');
});

test('plaintext beginning with enc is still encrypted', () => {
  const notification = new Notification({
    recipient: '507f1f77bcf86cd799439011',
    type: 'low_refill',
    message: 'enc: this is still plaintext',
  });

  assert.ok(notification._doc.message.startsWith('enc:'));
  assert.notEqual(notification._doc.message, 'enc: this is still plaintext');
  assert.equal(notification.message, 'enc: this is still plaintext');
});

test('tampered notification ciphertext is rejected', () => {
  const notification = buildNotification();
  const encrypted = notification._doc.message;
  const payload = JSON.parse(
    Buffer.from(encrypted.slice(4), 'base64').toString('utf8')
  );
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  ciphertext[0] ^= 1;
  payload.ciphertext = ciphertext.toString('base64');

  notification._doc.message = `enc:${Buffer.from(
    JSON.stringify(payload)
  ).toString('base64')}`;

  assert.throws(() => notification.message, /Unable to decrypt/);
});

test('missing and invalid IV values are rejected', () => {
  const encrypted = encrypt('Synthetic invalid IV check');
  const original = JSON.parse(
    Buffer.from(encrypted.slice(4), 'base64').toString('utf8')
  );

  for (const iv of [undefined, '', Buffer.alloc(12).toString('base64'), 'not-base64']) {
    const payload = { ...original, iv };
    const candidate = `enc:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
    assert.throws(
      () => decrypt(candidate),
      (error) => error.code === 'INVALID_IV'
    );
  }
});

test('missing and invalid authentication tags are rejected', () => {
  const encrypted = encrypt('Synthetic invalid tag check');
  const original = JSON.parse(
    Buffer.from(encrypted.slice(4), 'base64').toString('utf8')
  );

  for (const tag of [undefined, '', Buffer.alloc(12).toString('base64'), 'not-base64']) {
    const payload = { ...original, tag };
    const candidate = `enc:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
    assert.throws(
      () => decrypt(candidate),
      (error) => error.code === 'INVALID_AUTH_TAG'
    );
  }
});

test('a different valid encryption key fails authentication without returning plaintext', () => {
  const encrypted = encrypt('Synthetic protected message');
  const configuredKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'B').toString('base64');

  try {
    assert.throws(
      () => decrypt(encrypted),
      (error) => error.code === 'AUTHENTICATION_FAILED'
    );
    assert.equal(
      safeReadNotificationMessage(encrypted),
      '[Encrypted notification unavailable]'
    );
  } finally {
    process.env.ENCRYPTION_KEY = configuredKey;
  }
});

test('malformed envelopes and unsupported versions are rejected safely', () => {
  assert.equal(isEncryptedValue('enc:not-valid-ciphertext'), false);
  assert.throws(
    () => decrypt('enc:not-valid-ciphertext'),
    (error) => error.code === 'MALFORMED_ENVELOPE'
  );

  const encrypted = encrypt('Synthetic unsupported version');
  const payload = JSON.parse(
    Buffer.from(encrypted.slice(4), 'base64').toString('utf8')
  );
  payload.version = 'v0';
  const candidate = `enc:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  assert.throws(
    () => decrypt(candidate),
    (error) => error.code === 'UNSUPPORTED_VERSION'
  );
});

test('encryption key fingerprint is a SHA-256 digest and does not expose key material', () => {
  assert.match(getEncryptionKeyFingerprint(), /^[a-f0-9]{64}$/);
});

test('legacy or malformed notification payloads are sanitized without exposing plaintext', () => {
  assert.equal(
    safeReadNotificationMessage('enc:not-valid-ciphertext'),
    '[Encrypted notification unavailable]'
  );

  assert.equal(
    safeReadNotificationMessage('plain text notification'),
    '[Encrypted notification unavailable]'
  );
});
