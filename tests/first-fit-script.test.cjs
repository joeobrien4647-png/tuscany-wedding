const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'scripts', 'check-first-fit.py');
const exists = () => fs.existsSync(file);
const source = () => fs.readFileSync(file, 'utf8');

test('the phone-fit script exists', () => {
  assert.ok(exists(), 'scripts/check-first-fit.py is missing');
});

test('the phone-fit script names the three phones and the three invitations', () => {
  const py = source();
  for (const phone of ['iPhone 13', 'Pixel 7', '375x600']) assert.ok(py.includes(phone), phone);
  assert.match(py, /'engine': 'webkit'/);
  assert.match(py, /'engine': 'chromium'/);
  assert.ok(py.includes("'display': 'Alex'"), 'Alex');
  assert.ok(py.includes("'display': 'Alex & Sam'"), 'Alex & Sam');
  assert.ok(py.includes("'display': 'Alexandra-Marie & Christopher O\\'Néill'"), 'the long pair');
});

test('the phone-fit script refuses the real database and stays in local-test mode', () => {
  const py = source();
  assert.match(py, /REAL_DATABASE\s*=\s*re\.compile\(r'firebasedatabase\\\.app'/);
  assert.match(py, /context\.route\(REAL_DATABASE/);
  assert.match(py, /wtest=1/);
  assert.ok(!/https?:\/\/[^'"\s]*firebasedatabase/.test(py), 'a database address is written out');
});

test('the phone-fit script cleans up and only uses invented tokens', () => {
  const py = source();
  assert.match(py, /fixtures\.remove\(\)/);
  const quoted = py.match(/'[A-Za-z0-9_-]{16,64}'/g) || [];
  const tokens = quoted.map(q => q.slice(1, -1)).filter(s => /\d/.test(s));
  assert.ok(tokens.length >= 4, 'the invented tokens are there');
  for (const t of tokens) assert.match(t, /^fitcheck-/, t + ' does not look invented');
  assert.ok(!/guest-list|tasks\//.test(py), 'a private file is named');
});
