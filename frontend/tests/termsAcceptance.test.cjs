const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readFrontendFile = (relativePath) => fs.readFileSync(
  path.join(__dirname, '..', relativePath),
  'utf8'
);

test('registration requires explicit terms acceptance and displays a validation message', () => {
  const source = readFrontendFile('screens/RegisterScreen.js');

  assert.match(source, /const \[termsAccepted, setTermsAccepted\] = useState\(false\)/);
  assert.match(source, /if \(!termsAccepted\)/);
  assert.match(source, /You must agree to the MedSked Terms & Conditions to create an account\./);
  assert.match(source, /accessibilityRole="checkbox"/);
});

test('registration exposes the complete terms in a scrollable modal', () => {
  const source = readFrontendFile('screens/RegisterScreen.js');

  assert.match(source, /visible=\{termsVisible\}/);
  assert.match(source, /<ScrollView[\s\S]*?styles\.termsScroll/);
  for (const section of [
    '1. Purpose of MedSked',
    '2. Not a Medical Service',
    '6. Privacy and Personal Information',
    '12. Acceptance',
    'Last Updated: October 14, 2026',
  ]) {
    assert.ok(source.includes(section), `Missing Terms & Conditions content: ${section}`);
  }
});

test('checking terms opens the document and closing is gated on reaching its bottom', () => {
  const source = readFrontendFile('screens/RegisterScreen.js');

  assert.match(source, /if \(nextAccepted\)\s*\{\s*openTerms\(\)/);
  assert.match(source, /contentOffset\.y \+ layoutMeasurement\.height >= contentSize\.height - 24/);
  assert.match(source, /onScroll=\{handleTermsScroll\}/);
  assert.match(source, /disabled=\{!termsReadToBottom\}/);
});

test('registration API sends terms acceptance to the backend', () => {
  const source = readFrontendFile('services/api.js');

  assert.match(source, /role,\s*termsAccepted\s*\)/);
  assert.match(source, /body: JSON\.stringify\(\{[\s\S]*?name,[\s\S]*?email,[\s\S]*?password,[\s\S]*?role,[\s\S]*?termsAccepted,[\s\S]*?\}\)/);
});
