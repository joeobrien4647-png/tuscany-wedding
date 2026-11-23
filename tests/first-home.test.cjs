const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const home = () => require('../js/first/home.js');
const YES = { reply: { answer: 'yes', coming: [true], at: 1 } };
const NO = { reply: { answer: 'no', coming: [false], at: 1 } };
const stay = choice => ({ reply: YES.reply, stay: { choice, at: 2 } });
const NOV = Date.UTC(2026, 10, 10, 12);

test('home loads in Node without touching the page', () => {
  const h = home();
  assert.equal(typeof h.home.show, 'function');
  assert.equal(typeof h.home.refresh, 'function');
  assert.equal(typeof h.home.clear, 'function');
});

test('six envelopes from LOCKS, each sealed, named and stamped; the spoken name says what is inside can be seen', () => {
  const list = home().envelopes(NOV, words);
  assert.equal(list.length, 6);
  assert.deepEqual(list.map(e => e.key), core.LOCKS.map(l => l.key));
  list.forEach((e, i) => {
    const lock = core.LOCKS[i];
    assert.equal(e.state, 'sealed');
    assert.equal(e.name, words.home.envelopes[lock.key].name);
    const date = lock.opensMs === null ? words.home.photosStamp : core.ukDate(lock.opensMs);
    assert.equal(e.stamp, date);
    assert.ok(e.label.includes(e.name) && e.label.includes(date) && e.label.endsWith(', ' + words.home.seeInside), e.label);
    assert.equal(e.toast, undefined, 'no tap note: the panel says what is inside');
  });
  const due = home().envelopes(Date.UTC(2027, 1, 2, 12), words)[0];
  assert.ok(!due.label.includes(words.home.envelopes.estate.what), 'the spoken name stays short: the panel holds the words');
});

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 7)';
test('envelopeInfo: what each envelope holds, when it opens, and Remind me for its own day', () => {
  const info = (key, now, ua) => home().envelopeInfo(key, now, ua, words);
  assert.deepEqual(info('estate', NOV, IPHONE_UA), { key: 'estate', name: 'The estate', what: words.home.envelopes.estate.what, when: 'Opens Mon 1 Feb', remind: 'tuscany-2027-dates.ics' });
  const room = info('room', NOV, ANDROID_UA);
  assert.equal(room.when, 'Opens Thu 1 Apr');
  assert.ok(room.remind.startsWith('https://calendar.google.com/') && room.remind.includes('dates=20270401/20270402'), room.remind);
  assert.ok(room.remind.includes(encodeURIComponent(core.fill(words.home.remindEvent, { name: 'Your room' }))), room.remind);
  const photos = info('photos', NOV, IPHONE_UA);
  assert.deepEqual([photos.when, photos.remind], [words.home.photosOpens, null], 'no date: no reminder');
  const due = info('estate', Date.UTC(2027, 1, 2, 9), IPHONE_UA);
  assert.deepEqual([due.when, due.remind], [words.home.soon, null], 'past its date: nearly ready, no reminder');
  assert.equal(info('castle', NOV, IPHONE_UA), null);
});

test('every envelope has words for what it holds, and the panel words are in place', () => {
  core.LOCKS.forEach(l => assert.ok(typeof words.home.envelopes[l.key].what === 'string' && words.home.envelopes[l.key].what.length > 0, l.key));
  assert.equal(words.home.seeInside, "see what's inside");
  assert.equal(words.home.photosOpens, 'Opens in June');
  assert.equal(words.home.inside, undefined, 'the tap note words are gone');
});

test('every envelope stays sealed in phase 1, even after its date', () => {
  const late = Date.UTC(2027, 5, 30);
  assert.ok(home().envelopes(late, words).every(e => e.state === 'sealed'));
});

test('a sealed envelope tap shows the toast and never opens a card', () => {
  const js = read('js/first/home.js');
  const tap = js.match(/function tapEnvelope\([^)]*\) \{([\s\S]*?)\n {4}\}/);
  assert.ok(tap, 'function tapEnvelope');
  assert.match(tap[1], /toast\(/);
  assert.match(tap[1], /\.toast\b/);
  assert.doesNotMatch(tap[1], /cards|openCard/);
});

test('four dock buttons from words.dock.labels, with states from dockStates and the stay label', () => {
  const h = home();
  const plain = h.dockItems(YES, words);
  assert.deepEqual(plain.map(d => d.key), ['reply', 'stay', 'travel', 'weekend']);
  assert.deepEqual(plain.map(d => d.state), ['done', 'glow', 'plain', 'plain']);
  assert.deepEqual(plain.map(d => d.label), ['Reply', 'Choose stay', 'Travel', 'Weekend']);
  const later = h.dockItems(stay('later'), words);
  assert.equal(later[1].state, 'glow');
  assert.equal(later[1].label, 'Choose stay');
  const villa = h.dockItems(stay('villa'), words);
  assert.equal(villa[1].state, 'done');
  assert.equal(villa[1].label, 'La Conca');
  const own = h.dockItems(stay('own'), words);
  assert.equal(own[1].state, 'done');
  assert.equal(own[1].label, 'Own place');
});

test('every dock aria-label says its state in words', () => {
  for (const household of [YES, stay('later'), stay('villa'), stay('own')])
    for (const d of home().dockItems(household, words)) {
      assert.ok(d.aria.includes(d.label), d.aria);
      assert.ok(d.aria.includes(words.dock.states[d.state]), d.aria);
    }
  assert.equal(new Set(Object.values(words.dock.states)).size, 3);
});

test('big countdown to the wedding: days, singular day and the clock', () => {
  const h = home();
  const c = h.bigCount(core.WEDDING_MS - (3 * 86400 + 4 * 3600 + 5 * 60 + 6) * 1000, words);
  assert.equal(c.days, 3);
  assert.equal(c.label, words.home.countdown);
  assert.equal(c.clock, '4 h 05 m 06 s');
  assert.equal(h.bigCount(core.WEDDING_MS - 86400000, words).label, words.home.countdownOne);
  assert.equal(h.bigCount(core.WEDDING_MS + 1, words).days, 0);
});

test('small countdown names the next envelope, moves on after its time and hides after the last date', () => {
  const h = home();
  const estate = words.home.envelopes.estate.name, room = words.home.envelopes.room.name;
  assert.equal(h.nextLine(Date.UTC(2027, 0, 20, 8), words), estate + ' ' + core.fill(words.home.nextIn, { n: 12 }));
  assert.equal(h.nextLine(Date.UTC(2027, 0, 31, 7), words), estate + ' ' + words.home.nextDay);
  assert.equal(h.nextLine(Date.UTC(2027, 1, 1, 5, 58, 50), words), estate + ' ' + core.fill(words.home.nextSoon, { n: '2 h 01 m 10 s' }));
  const after = h.nextLine(Date.UTC(2027, 1, 1, 8, 0, 1), words);
  assert.ok(after.startsWith(room + ' '), after);
  assert.equal(h.nextLine(Date.UTC(2027, 4, 1, 7, 0, 1), words), null);
  assert.equal(h.nextLine(Date.UTC(2027, 4, 27, 7, 0, 1), words), null);
});

test('refresh: an object re-renders, a no leaves for can\'t come, no clear answer keeps the screen', () => {
  const h = home();
  assert.equal(h.afterRefresh(YES, NOV), 'render');
  assert.equal(h.afterRefresh(stay('villa'), NOV), 'render');
  assert.equal(h.afterRefresh(NO, NOV), 'cantcome');
  assert.equal(h.afterRefresh(undefined, NOV), 'keep');
});

function deferredLoads() {
  const pending = [];
  const load = () => new Promise(resolve => pending.push(resolve));
  return { load, pending };
}

test('refresh read: two loads resolved in reverse order, only the newest applies', async () => {
  const { readFresh } = home();
  const { load, pending } = deferredLoads();
  const r = { seq: 0, ctx: { invite: { token: 'tok_FAKEHOUSEHOLD01' }, household: YES } };
  const applied = [];
  const older = readFresh(r, load, h => applied.push(h));
  const newer = readFresh(r, load, h => applied.push(h));
  const fresh = stay('own'), stale = stay('villa');
  pending[1](fresh);
  await newer;
  pending[0](stale);
  await older;
  assert.deepEqual(applied, [fresh]);
});

test('refresh read: a household replaced while the read is in flight is never overwritten', async () => {
  const { readFresh } = home();
  const { load, pending } = deferredLoads();
  const r = { seq: 0, ctx: { invite: { token: 'tok_FAKEHOUSEHOLD01' }, household: YES } };
  const applied = [];
  const reading = readFresh(r, load, h => applied.push(h));
  const savedByCard = stay('villa');
  r.ctx.household = savedByCard;
  pending[0](stay('later'));
  await reading;
  assert.deepEqual(applied, []);
  assert.equal(r.ctx.household, savedByCard);
});

test('refresh goes through the guarded read', () => {
  const js = read('js/first/home.js');
  const refresh = js.match(/function refresh\(\) \{([\s\S]*?)\n {2}\}/);
  assert.ok(refresh && /readFresh\(/.test(refresh[1]), 'refresh uses readFresh');
  assert.doesNotMatch(refresh[1], /store\.load\(token\)\.then/);
});

test('refresh runs when the page is visible again, listening once', () => {
  const js = read('js/first/home.js');
  assert.equal((js.match(/addEventListener\('visibilitychange'/g) || []).length, 1);
  assert.match(js, /visibilityState === 'visible'[^;\n]*refresh\(\)/);
  assert.match(js, /if \(listening\) return;/);
  assert.match(js, /store\.load\b/);
  assert.match(js, /reply\.show\(\{ root: r\.host, ctx: r\.ctx, mode: next \}\)/);
});

test('the clock stops when the home screen is left and never doubles', () => {
  const js = read('js/first/home.js');
  assert.match(js, /setInterval\(/);
  assert.match(js, /clearInterval\(/);
  const show = js.match(/function show\([^)]*\) \{([\s\S]*?)\n {2}\}/);
  assert.ok(show && /clear\(\);/.test(show[1]), 'show clears what was there first');
});

test('there is a Questions control, a sound toggle and a watch-again control; cards are guarded', () => {
  const js = read('js/first/home.js');
  assert.match(js, /w\.home\.questions/);
  assert.match(js, /'questions'/);
  assert.match(js, /sound\.toggle\(\)|S\.toggle\(\)/);
  assert.match(js, /w\.minute\.soundOn/);
  assert.match(js, /w\.home\.watch/);
  assert.match(js, /minute\.play\(/);
  assert.match(js, /cards && typeof cards\.open === 'function'/);
});

test('words reach the page through textContent; no amount, no console', () => {
  const js = read('js/first/home.js');
  for (const m of js.matchAll(/\.innerHTML\s*=\s*([^;]*)/g))
    assert.doesNotMatch(m[1], /name|people|display|invite|household|words|label|stamp|\bw\./, 'innerHTML is given ' + m[1]);
  assert.doesNotMatch(js, /insertAdjacentHTML|outerHTML|document\.write/);
  assert.doesNotMatch(js, /\b150\b/);
  assert.doesNotMatch(js, /console\./);
});

test('the envelopes, dock and foot keep their rows when the small countdown is hidden', () => {
  const css = read('css/first.css');
  assert.match(css, /\.fh-envs \{ grid-row: 4;/);
  assert.match(css, /\.fh-dock \{ grid-row: 5;/);
  assert.match(css, /\.fh-foot \{ grid-row: 6;/);
});

test('the glow is gold, and a still ring under reduced motion', () => {
  const css = read('css/first.css');
  assert.match(css, /\.fh-dk\.fh-glow \.fh-ico \{[^}]*animation: fh-glow/);
  const reduced = css.slice(css.lastIndexOf('prefers-reduced-motion'));
  assert.match(reduced, /\.fh-dk\.fh-glow \.fh-ico \{ animation: none; \}/);
});

test('the dock has one column for each of its buttons, so they sit evenly', () => {
  const keys = read('js/first/home.js').match(/const DOCK_KEYS = \[([^\]]*)\]/);
  assert.ok(keys, 'DOCK_KEYS is in home.js');
  const count = keys[1].split(',').filter(s => s.trim()).length;
  const cols = read('css/first.css').match(/#first \.fh-dock \{[^}]*grid-template-columns: repeat\((\d+),/);
  assert.ok(cols, 'the dock sets its columns with repeat()');
  assert.equal(Number(cols[1]), count);
});
