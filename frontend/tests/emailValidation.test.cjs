const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helperSource = fs.readFileSync(
  path.join(__dirname, '../utils/helpers.js'),
  'utf8'
);
const helperUrl = `data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`;
let isValidEmail;

test('load frontend email validation helper', async () => {
  ({ isValidEmail } = await import(helperUrl));
});

test('frontend accepts valid addresses from different email providers', () => {
  for (const email of [
    'test@gmail.com',
    'test@outlook.com',
    'test@phinmaed.com',
  ]) {
    assert.equal(isValidEmail(email), true, email);
  }
});

test('frontend rejects malformed and empty email addresses', () => {
  for (const email of ['test', '@gmail.com', 'test@', 'test@.', '']) {
    assert.equal(isValidEmail(email), false, email);
  }
});

test('registration screen uses general email validation and messaging', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../screens/RegisterScreen.js'),
    'utf8'
  );
  assert.match(source, /isValidEmail\(email\.trim\(\)\)/);
  assert.match(source, /Please enter a valid email address\./);
  assert.doesNotMatch(source, /Gmail|@gmail\\\.com/i);
});
