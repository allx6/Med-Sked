const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'A').toString('base64');

const Notification = require('../models/Notification');
const {
  decrypt,
  encrypt,
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
