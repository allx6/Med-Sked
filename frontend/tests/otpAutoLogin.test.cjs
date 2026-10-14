const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readFrontendFile = (relativePath) => fs.readFileSync(
  path.join(__dirname, '..', relativePath),
  'utf8'
);

test('OTP verification passes the returned authentication response to the app', () => {
  const source = readFrontendFile('screens/EmailVerificationScreen.js');

  assert.match(source, /const authentication = await verifyEmail\(email, otp\)/);
  assert.match(source, /if \(!authentication\?\.token \|\| !authentication\?\.user\)/);
  assert.match(source, /onVerified\(authentication\)/);
});

test('OTP login uses the same in-memory session and role routing as manual login', () => {
  const source = readFrontendFile('App.js');

  assert.match(
    source,
    /function handleEmailVerified\(authentication\) \{[\s\S]*?handleLogin\(authentication\.user, authentication\.token\)/
  );
  assert.match(source, /setUser\(loggedInUser\)/);
  assert.match(source, /setToken\(loggedInToken\)/);
  assert.match(source, /loggedInUser\?\.role === 'admin'/);
  assert.match(source, /loggedInUser\?\.role === 'caregiver'/);
  assert.match(source, /setScreen\('dashboard'\)/);
});
