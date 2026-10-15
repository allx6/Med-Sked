const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('registration username input removes whitespace as the value changes', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'RegisterScreen.js'),
    'utf8'
  );

  assert.match(source, /label="Username"[\s\S]*?onChangeText=\{\(value\) => \{[\s\S]*?setName\(value\.replace\(\/\\s\/g, ''\)\)/);

  const sanitizeUsername = (value) => value.replace(/\s/g, '');
  assert.equal(sanitizeUsername('pogi ako'), 'pogiako');
  assert.equal(sanitizeUsername('pogi.                si ako'), 'pogi.siako');
  assert.equal(sanitizeUsername('  pogi    ako  '), 'pogiako');
  assert.equal(sanitizeUsername('pogi.siako'), 'pogi.siako');
});
