const crypto = require('crypto');
const { TextDecoder } = require('util');

const KEY_BYTES = 32;
const IV_BYTES = 16;
const AUTH_TAG_BYTES = 16;
const ENCRYPTED_PREFIX = 'enc:';

const createEncryptionError = (category) => {
  const error = new Error('Unable to decrypt the requested value.');
  error.code = category;
  return error;
};

const decodeBase64 = (value, category, { allowEmpty = false } = {}) => {
  if (
    typeof value !== 'string'
    || (!allowEmpty && value.length === 0)
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw createEncryptionError(category);
  }

  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) {
    throw createEncryptionError(category);
  }

  return decoded;
};

const getEncryptionKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    const error = new Error('ENCRYPTION_KEY is not configured.');
    error.code = 'KEY_CONFIGURATION';
    throw error;
  }

  let key;
  try {
    key = decodeBase64(rawKey, 'KEY_CONFIGURATION');
  } catch (error) {
    const configurationError = new Error('ENCRYPTION_KEY must be valid base64.');
    configurationError.code = 'KEY_CONFIGURATION';
    throw configurationError;
  }

  if (key.length !== KEY_BYTES) {
    const error = new Error('ENCRYPTION_KEY must decode to exactly 32 bytes.');
    error.code = 'KEY_CONFIGURATION';
    throw error;
  }

  return key;
};

const parseEncryptedValue = (value) => {
  if (typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) {
    throw createEncryptionError('MALFORMED_ENVELOPE');
  }

  const encodedPayload = value.slice(ENCRYPTED_PREFIX.length);
  let payload;
  try {
    payload = JSON.parse(
      decodeBase64(encodedPayload, 'MALFORMED_ENVELOPE').toString('utf8')
    );
  } catch (error) {
    if (error.code === 'MALFORMED_ENVELOPE') {
      throw error;
    }
    throw createEncryptionError('MALFORMED_ENVELOPE');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createEncryptionError('MALFORMED_ENVELOPE');
  }

  if (payload.version !== 'v1') {
    throw createEncryptionError('UNSUPPORTED_VERSION');
  }

  const iv = decodeBase64(payload.iv, 'INVALID_IV');
  const tag = decodeBase64(payload.tag, 'INVALID_AUTH_TAG');
  const ciphertext = decodeBase64(payload.ciphertext, 'INVALID_CIPHERTEXT', {
    allowEmpty: true,
  });

  if (iv.length !== IV_BYTES) {
    throw createEncryptionError('INVALID_IV');
  }

  if (tag.length !== AUTH_TAG_BYTES) {
    throw createEncryptionError('INVALID_AUTH_TAG');
  }

  return {
    version: payload.version,
    iv,
    tag,
    ciphertext,
  };
};

const getEncryptionFormatVersion = (value) => {
  if (typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) {
    return 'unversioned';
  }

  try {
    const payload = JSON.parse(
      decodeBase64(value.slice(ENCRYPTED_PREFIX.length), 'MALFORMED_ENVELOPE').toString('utf8')
    );
    return typeof payload?.version === 'string'
      ? payload.version
      : 'missing-version';
  } catch (error) {
    return 'malformed';
  }
};

const isEncryptedValue = (value) => {
  try {
    parseEncryptedValue(value);
    return true;
  } catch (error) {
    return false;
  }
};

const encrypt = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (isEncryptedValue(value)) {
    return value;
  }

  const plainText = String(value);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const payload = {
    version: 'v1',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return `${ENCRYPTED_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
};

const decrypt = (value, options = {}) => {
  const { suppressErrorLog = false } = options;

  if (value === null || value === undefined) {
    return value;
  }

  let formatVersion = getEncryptionFormatVersion(value);

  try {
    const key = getEncryptionKey();
    const payload = parseEncryptedValue(value);
    formatVersion = payload.version;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      payload.iv
    );
    decipher.setAuthTag(payload.tag);

    let decrypted;
    try {
      decrypted = Buffer.concat([
        decipher.update(payload.ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      throw createEncryptionError('AUTHENTICATION_FAILED');
    }

    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
    } catch (error) {
      throw createEncryptionError('INVALID_PLAINTEXT_ENCODING');
    }
  } catch (error) {
    const category = error.code || 'DECRYPTION_FAILED';
    if (!suppressErrorLog) {
      console.error('Notification decryption failed:', {
        operation: 'decrypt',
        formatVersion,
        failureCategory: category,
        environment: process.env.NODE_ENV || 'development',
      });
    }
    throw createEncryptionError(category);
  }
};

const getEncryptionKeyFingerprint = () => (
  crypto.createHash('sha256').update(getEncryptionKey()).digest('hex')
);

const validateEncryptionKey = () => {
  getEncryptionKey();
  return getEncryptionKeyFingerprint();
};

module.exports = {
  encrypt,
  decrypt,
  isEncryptedValue,
  getEncryptionFormatVersion,
  getEncryptionKeyFingerprint,
  validateEncryptionKey,
};
