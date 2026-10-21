const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('registration username input keeps existing whitespace removal and caps entry at 10', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'screens', 'RegisterScreen.js'), 'utf8');
  assert.match(source, /label="Username"[\s\S]*?setName\(value\.replace\(\/\\s\/g, ''\)\)/);
  assert.match(source, /label="Username"[\s\S]*?maxLength=\{10\}/);
  assert.match(source, /if \(!isValidUsername\(name\)\)/);
  const sanitizeUsername = (value) => value.replace(/\s/g, '');
  assert.equal(sanitizeUsername('pogi ako'), 'pogiako');
  assert.equal(sanitizeUsername('pogi.                si ako'), 'pogi.siako');
  assert.equal(sanitizeUsername('  pogi    ako  '), 'pogiako');
  assert.equal(sanitizeUsername('pogi.siako'), 'pogi.siako');
});

test('registration validates username input as 1 to 10 ASCII letters', async () => {
  const helperSource = fs.readFileSync(
    path.join(__dirname, '..', 'utils', 'helpers.js'),
    'utf8'
  );
  const helperUrl = `data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`;
  const { isValidUsername } = await import(helperUrl);

  for (const username of ['giovanni', 'allen', 'mhel', 'MedSked', 'abcdefghij']) {
    assert.equal(isValidUsername(username), true, username);
  }
  for (const username of [
    'abcdefghijk',
    'giovanni1',
    'john123',
    'john_doe',
    'john doe',
    'john-doe',
    'john@doe',
    '',
  ]) {
    assert.equal(isValidUsername(username), false, username);
  }
});
