const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenSource = fs.readFileSync(
  path.join(__dirname, '../screens/ForgotPasswordScreen.js'),
  'utf8'
);

test('forgot password screen validates email and reset code without a provider restriction', () => {
  assert.match(screenSource, /isValidEmail\(normalizedEmail\)/);
  assert.match(screenSource, /Please enter a valid email address\./);
  assert.match(screenSource, /\/\^\\d\{6\}\$\/\.test\(otp\)/);
  assert.doesNotMatch(screenSource, /@gmail\.com|Gmail-only/i);
});

test('forgot password screen uses the generic enumeration-safe confirmation', () => {
  assert.match(
    screenSource,
    /If an account exists for this email, a password reset code has been sent\./
  );
  assert.match(screenSource, /await requestPasswordReset\(normalizedEmail\)/);
});

test('password reset requires matching passwords and keeps reset authorization in component state', () => {
  assert.match(screenSource, /newPassword !== confirmPassword/);
  assert.match(screenSource, /Passwords do not match\./);
  assert.match(screenSource, /useState\(''\);[\s\S]*?const \[newPassword/);
  assert.match(screenSource, /resetPassword\(resetAuthorization, newPassword\)/);
  assert.match(screenSource, /Password must be at least 6 characters and cannot contain spaces\./);
});

test('login exposes the forgot-password action through its existing navigation callback', () => {
  const loginSource = fs.readFileSync(
    path.join(__dirname, '../screens/LoginScreen.js'),
    'utf8'
  );
  assert.match(loginSource, /onPress=\{onNavigateForgotPassword\}/);
  assert.match(loginSource, /Forgot Password\?/);
});
