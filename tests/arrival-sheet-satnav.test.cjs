const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the arrival sheet provides the qualified La Conca coordinates', () => {
  const sheet = read('arrival-essentials.html');
  const { lat, lon } = JSON.parse(read('data/getting-there.json')).venue.satnav;
  assert.ok(sheet.includes(`${lat}, ${lon}`));
  assert.match(sheet, /planning reference.*2022.*confirm/i);
  assert.match(sheet, /La Conca building at the foot of the estate/);
  assert.match(sheet, /not (?:your|the) villa/i);
  assert.match(sheet, /final arrival instructions/i);
  assert.doesNotMatch(sheet.match(/<section[^>]*aria-labelledby="destination-title"[\s\S]*?<\/section>/)[0], /guest-no-print/);
});
