const crypto = require('crypto');

const KEY_BYTES = 32;

const isEncryptedValue = (value) => (
  (() => {
    if (typeof value !== 'string' || !value.startsWith('enc:')) {
      return false;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(value.slice(4), 'base64').toString('utf8')
      );

      return Boolean(
        payload &&
        payload.version === 'v1' &&
        payload.iv &&
        payload.tag &&
        payload.ciphertext
      );
    } catch (error) {
      return false;
    }
  })()
);

const getEncryptionKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY is not configured.');
  }

  const buffer = Buffer.from(rawKey, 'base64');

  if (buffer.length !== KEY_BYTES) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }

  return buffer;
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
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const payload = {
    version: 'v1',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return `enc:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
};

const decrypt = (value, options = {}) => {
  const { suppressErrorLog = false } = options;

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (!value.startsWith('enc:')) {
    throw new Error('Unable to decrypt the requested value.');
  }

  try {
    const key = getEncryptionKey();
    const decoded = JSON.parse(
      Buffer.from(value.replace(/^enc:/, ''), 'base64').toString('utf8')
    );

    if (!decoded || decoded.version !== 'v1') {
      throw new Error('Unsupported encrypted payload');
    }

    if (!decoded.iv || !decoded.tag || !decoded.ciphertext) {
      throw new Error('Invalid encrypted payload');
    }

    const iv = Buffer.from(decoded.iv, 'base64');
    const tag = Buffer.from(decoded.tag, 'base64');
    const ciphertext = Buffer.from(decoded.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (!suppressErrorLog) {
      console.error('Encryption service decryption failed.');
    }
    throw new Error('Unable to decrypt the requested value.');
  }
};

const validateEncryptionKey = () => {
  getEncryptionKey();
};

module.exports = {
  encrypt,
  decrypt,
  isEncryptedValue,
  validateEncryptionKey,
};
