const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
  assert.match(py, /REAL_DATABASE\s*=\s*re\.compile\(r'firebasedatabase\\\.app\|firebaseio\\\.com'/);
  assert.match(py, /route_web_socket\(REAL_DATABASE/);
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

// The tests below run the script's own judging code in Python. They need no browser and no Playwright.
const python = ['python', 'python3'].find(name => {
  const found = spawnSync(name, ['--version'], { encoding: 'utf8' });
  return !found.error && found.status === 0;
});
const skipReason = python ? false : 'python is not on PATH, so the exit-code tests cannot run here';

const judge = (results, failures = [], extra = '') => spawnSync(python, ['-B', '-I', '-c', [
  'import importlib.util, json, sys',
  'spec = importlib.util.spec_from_file_location("fit", sys.argv[1])',
  'fit = importlib.util.module_from_spec(spec); spec.loader.exec_module(fit)',
  'data = json.loads(sys.argv[2])',
  'sys.exit(fit.report(data["results"], data["failures"], ' + (extra || 'False') + '))'
].join('\n'), file, JSON.stringify({ results, failures })], { encoding: 'utf8', timeout: 30000 });

const clean = (patch = {}) => Object.assign({ device: 'iPhone 13', flow: 'Alex / cards', stop: 'home', doc: 0, card: 0, cut: [], missing: [], errors: [] }, patch);

test('a clean result exits 0 and says PASS', { skip: skipReason }, () => {
  const run = judge([clean(), clean({ stop: 'cover' })]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^PASS: 2 stops/m);
});

test('every kind of fault exits 1 and says FAIL', { skip: skipReason }, () => {
  const faults = {
    'document overflow': [clean({ doc: 12 })],
    'card overflow': [clean({ card: 4 })],
    'a cut-off text': [clean({ cut: ['cut by its box button.fh-env "The estate"'] })],
    'a console error': [clean({ errors: ['console: boom'] })],
    'a missing required element': [clean({ missing: ['.fm-hint still hidden'] })],
    'fonts not loaded': [clean({ missing: ['fonts not loaded: run with a network connection (Jost)'] })],
    'no results at all': []
  };
  for (const [name, results] of Object.entries(faults)) {
    const run = judge(results);
    assert.equal(run.status, 1, name + ': ' + run.stdout);
    assert.match(run.stdout, /^FAIL: /m, name);
  }
  const run = judge([clean()], ['iPhone 13 | Alex / cards | asked the real database: x']);
  assert.equal(run.status, 1, 'a failed check');
  assert.match(run.stdout, /CHECK FAILED/);
});

test('a restricted run says PARTIAL, never PASS', { skip: skipReason }, () => {
  const run = judge([clean()], [], 'True');
  assert.equal(run.status, 0);
  assert.match(run.stdout, /^PARTIAL: /m);
  assert.ok(!/^PASS:/m.test(run.stdout));
});

const listFixtures = () => {
  const dir = path.join(__dirname, '..', '.local-test', 'welcome');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.startsWith('fitcheck-')).sort() : [];
};

test('--device with no match exits 1 at once, without a browser or fixtures', { skip: skipReason }, () => {
  const before = listFixtures(), started = Date.now();
  const run = spawnSync(python, ['-B', '-I', file, '--device', 'nomatch'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /^FAIL: no device matches/m);
  assert.ok(Date.now() - started < 10000, 'it should not launch anything');
  assert.deepEqual(listFixtures(), before, 'fixtures were written or removed');
});

test('the phone-fit script walks the Getting there card: every stop the plan names', () => {
  const py = source();
  for (const stop of ['travel-empty', 'travel-comparing', 'travel-routes', 'travel-last-stretch', 'travel-whole-trip', 'travel-days', 'travel-ready',
    'travel-stamped', 'travel-who', 'travel-two-tickets', 'travel-reopened', 'travel-abroad', 'travel-italy-not-flying', 'travel-road', 'travel-train',
    'travel-change', 'travel-somewhere-else', 'travel-longest-names', 'travel-data-refused', 'travel-stamp-refused', 'travel-stamp-retried'])
    assert.ok(py.includes("'" + stop + "'"), stop);
  assert.match(py, /\('travel', flow_travel\)/);
  assert.match(py, /flow_travel_ways/);
  assert.match(py, /flow_travel_failures/);
});
test('the phone-fit script walks the Songs card, with Apple answered from fixtures and never contacted', () => {
  const py = source();
  const registered = py.slice(py.indexOf('PER_INVITE = ['), py.indexOf('def plan('));
  for (const [name, fn] of [['songs-board', 'flow_songs_board'], ['songs-save', 'flow_songs_save'], ['songs-metoo', 'flow_songs_metoo'],
    ['songs-closed', 'flow_songs_closed'], ['songs-apple-down', 'flow_songs_apple_down']])
    assert.ok(registered.includes("('" + name + "', " + fn + ', '), name + ' is not registered');
  assert.ok(py.includes("APPLE = re.compile(r'itunes" + String.fromCharCode(92) + ".apple" + String.fromCharCode(92) + ".com')"), 'APPLE');
  assert.ok(py.includes("ART = re.compile(r'mzstatic" + String.fromCharCode(92) + ".com')"), 'ART');
  assert.ok(py.includes('await self.context.route(APPLE, self.answer_apple)'), 'Apple is answered for every page');
  assert.ok(py.includes('await self.context.route(ART, self.answer_art)'), 'covers are answered for every page');
  for (const stop of ['songs-busy', 'songs-busy-end', 'songs-search', 'songs-search-none', 'songs-empty', 'songs-added', 'songs-full',
    'songs-metoo', 'songs-closed', 'songs-apple-down', 'songs-search-down', 'songs-dock-done'])
    assert.ok(py.includes("'" + stop + "'"), stop);
  assert.ok(py.includes("(4, 'songs', CARD_SONGS"), 'the cards walk opens the fifth dock item, card-songs');
  assert.match(py, /SCROLL_OK = \[[^\]]*'\.sg-scroll',\s+#\s*\S/s, 'the Songs card scroller is named with its reason');
  assert.ok(py.includes("CARD_SONGS = CARD + ['.sg-promise', '.sg-board']"), 'CARD_SONGS');
});
test('the phone-fit script names its three new exceptions and why', () => {
  const py = source();
  assert.match(py, /SCROLL_OK = \[\s*'\.tc-opts',\s+#/);
  assert.match(py, /SR_ONLY_OK = \[\s*'\.tc-sr',\s+#/);
  assert.match(py, /MAP_OK = \[\s*'\.tm-svg',\s+#/);
  assert.match(py, /a\.scrollWidth > a\.clientWidth \+ 1/, 'a scrolling list is still checked sideways');
});

test('the phone-fit script covers a missing map script and going back from a change', () => {
  const py = source();
  for (const stop of ['travel-map-missing', 'travel-changing']) assert.ok(py.includes("'" + stop + "'"), stop);
  assert.match(py, /flow_travel_no_map/);
});

test('the phone-fit script walks the Weekend screen and the five-button home, and no longer the Wear card', () => {
  const py = source();
  for (const stop of ['weekend-tiles', 'weekend-fri', 'weekend-sat', 'weekend-sun', 'weekend-mon', 'weekend-after-swipe', 'weekend-back-to-tiles',
    'weekend-fullest-day', 'weekend-no-pictures', 'home-five-buttons'])
    assert.ok(py.includes("'" + stop + "'"), stop);
  assert.match(py, /\('weekend', flow_weekend\)/);
  assert.ok(!py.includes('card-wear'), 'the Wear card stop is still there');
  assert.ok(!py.includes('CARD_WEAR'), 'CARD_WEAR is still there');
  assert.match(py, /DRIFT_OK = \[[^\]]*'\.wk-pic',\s+#/s, 'the drifting picture layer is named with its reason');
});
test('the phone-fit script registers every Weekend flow it defines, and gives its two Weekend exceptions a reason', () => {
  const py = source();
  const defined = [...py.matchAll(/^async def (flow_weekend\w*)\(/gm)].map(m => m[1]).sort();
  assert.deepEqual(defined, ['flow_weekend', 'flow_weekend_fullest', 'flow_weekend_no_pictures', 'flow_weekend_overfull', 'flow_weekend_still']);
  const registered = py.slice(py.indexOf('PER_INVITE = ['), py.indexOf('def plan('));
  assert.ok(registered.includes('PER_DEVICE = ['), 'the two tables were not found');
  for (const name of defined) assert.match(registered, new RegExp(', ' + name + '[,)]'), name + ' is defined but not registered in PER_INVITE or PER_DEVICE');
  assert.match(py, /DAY_CLIPS_OK = \[\s*'\.wk-day',\s+#\s*\S/, '.wk-day is named without a reason');
  assert.match(py, /BLEED_OK = \[[^\]]*'\.wk-pic',\s+#\s*\S/s, '.wk-pic is named without a reason in BLEED_OK');
});

test('the phone-fit server keeps connections open, so four browsers reloading every file do not exhaust it', () => {
  const py = source();
  assert.match(py, /class Quiet\(http\.server\.SimpleHTTPRequestHandler\):\s+protocol_version = 'HTTP\/1\.1'\s+#\s*\S/, 'the handler does not ask for keep-alive, or gives no reason');
});

test('the phone-fit script checks the food step on every setup', () => {
  const py = source();
  for (const name of ['food-one', 'food-couple', 'food-fullest', 'food-eight', 'food-closed', 'food-save']) assert.ok(py.includes("'" + name + "'"), name);
  assert.ok(py.includes("'fitcheck-eight-house-0005'"));
  assert.equal((py.match(/'people': \[([^\]]*)\]/g) || []).some(p => p.split(',').length === 8), true, 'an eight-person household');
});

test('the phone-fit script checks a three-person household, both phones at once, leaving mid-step and the cut-off passing', () => {
  const py = source();
  for (const name of ['food-three', 'food-both-phones', 'food-leave', 'food-cutoff-open']) assert.ok(py.includes("'" + name + "'"), name);
  for (const stop of ['card-reply-three', 'card-reply-three-given', 'card-reply-three-closed', 'card-reply-three-closed-given', 'food-both-phones-saved', 'food-left', 'food-cutoff-passed'])
    assert.ok(py.includes("'" + stop + "'"), stop);
  assert.ok(py.includes("'fitcheck-three-house-0006'"));
  assert.equal((py.match(/'people': \[([^\]]*)\]/g) || []).some(p => p.split(',').length === 3), true, 'a three-person household');
  const registered = py.slice(py.indexOf('PER_INVITE = ['), py.indexOf('def plan('));
  for (const fn of ['flow_food_three', 'flow_food_both_phones', 'flow_food_leave', 'flow_food_cutoff_open']) assert.match(registered, new RegExp(', ' + fn + ', '), fn);
  assert.doesNotMatch(py, /PICK_AT = \{/, 'the picks are hard-coded instead of read from sjFirst.food.PICKS');
  assert.match(py, /sjFirst\.food\.PICKS/);
});
