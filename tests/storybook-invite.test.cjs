const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { coverLine, copyProblems } = require('../js/storybook.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('cover line', () => {
  assert.equal(coverLine({ display: 'Alex and Sam' }), 'For Alex and Sam');
  assert.equal(coverLine(null), ''); assert.equal(coverLine({ display: '  ' }), '');
  assert.equal(coverLine({}), '');
  assert.ok(coverLine({ display: 'A'.repeat(100) }).length <= 60);
  assert.deepEqual(copyProblems(coverLine({ display: 'Alex and Sam' })), []);
});

test('rules let a link read only its own invitation', () => {
  const rules = JSON.parse(read('firebase.rules.json')).rules;
  assert.equal(rules.welcome.$token['.read'], true);
  assert.equal(rules.welcome['.read'], undefined);
  assert.ok(rules.welcomeSeen.$token.last['.write']);
});

test('invite.js takes the token out of the address bar and never uses localStorage for it', () => {
  const js = read('js/invite.js');
  assert.match(js, /history\.replaceState/); assert.doesNotMatch(js, /localStorage\.setItem\([^)]*KEY/);
});

test('a bad or unknown personal link logs nothing', () => {
  assert.doesNotMatch(read('js/invite.js'), /console\./);
});

test('the invitation is read before the film and the book start', () => {
  const html = read('index.html');
  const at = src => html.indexOf('<script src="' + src + '"');
  assert.ok(at('js/invite.js') > 0);
  assert.ok(at('js/invite.js') < at('js/intro.js'));
  assert.ok(at('js/invite.js') < at('js/storybook.js'));
  assert.doesNotMatch(html.match(/<script src="js\/invite\.js"[^>]*>/)[0], /defer|async/);
});
