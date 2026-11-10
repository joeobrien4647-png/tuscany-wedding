const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const cards = () => require('../js/first/cards.js');
const NOV = Date.UTC(2026, 10, 10, 12);
const LATE = core.REPLIES_CLOSE_MS + 86400000;
const yes = coming => ({ reply: { answer: 'yes', coming, at: 1 } });
const withStay = (h, choice) => Object.assign({}, h, { stay: { choice, at: 2 } });
const ONE = { token: 'tCardsOne000001aa', display: 'Robin Ash', people: ['Robin Ash'] };
const TWO = { token: 'tCardsTwo000002bb', display: 'Kit and Sam', people: ['Kit Moss', 'Sam Lee'] };
const allText = o => JSON.stringify(o);

test('cards load in Node without touching the page; six keys, open and close', () => {
  const c = cards();
  assert.deepEqual(c.CARD_KEYS, ['reply', 'stay', 'travel', 'wear', 'weekend', 'questions']);
  assert.equal(typeof c.cards.open, 'function');
  assert.equal(typeof c.cards.close, 'function');
  assert.deepEqual(c.cards.built().sort(), ['questions', 'reply', 'stay', 'travel', 'wear', 'weekend']);
});

test('open with a key that is not a card at all does nothing', () => {
  const c = cards();
  for (const key of ['nope', 'built', undefined])
    assert.equal(c.cards.open(key, { invite: ONE, household: yes([true]), now: () => NOV }), false, String(key));
  assert.doesNotThrow(() => c.cards.close());
});

test('stay: three options in the order villa, own, later, villa preselected when nothing is chosen', () => {
  const v = cards().stayView(yes([true]), NOV, words);
  assert.deepEqual(v.options.map(o => o.key), ['villa', 'own', 'later']);
  assert.equal(v.picked, 'villa');
  assert.equal(v.options[0].tag, words.stay.recommended);
  assert.ok(v.options.slice(1).every(o => !o.tag));
  v.options.forEach(o => {
    assert.equal(o.title, words.stay[o.key].title);
    assert.equal(o.sub, words.stay[o.key].sub);
    assert.deepEqual(o.get, words.stay[o.key].get);
  });
});

test('stay: the saved choice is preselected, later included', () => {
  for (const choice of ['villa', 'own', 'later'])
    assert.equal(cards().stayView(withStay(yes([true]), choice), NOV, words).picked, choice);
});

test('stay: the share line, spring and the quiet word appear only inside the villa option, with no date', () => {
  const h = yes([true]);
  const v = cards().stayView(h, NOV, words);
  const [villa, own, later] = v.options;
  assert.equal(villa.share, core.shareLine(words.stay.share, core.comingCount(h)));
  assert.ok(villa.need.includes(words.stay.spring), 'spring in villa need');
  assert.equal(villa.word, words.stay.word);
  for (const o of [own, later]) {
    assert.ok(!o.share && !o.word, o.key + ' has share or word');
    assert.ok(!allText(o).includes('£'), o.key + ' shows an amount');
  }
  assert.equal((allText(v).match(/£/g) || []).length, 1, 'the amount shows once');
  const dates = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\b(Jan|Feb|Mar|Apr|May|Jun|March|April)\b|\b20\d\d\b/;
  assert.doesNotMatch(allText(villa), dates);
});

test('stay: the share says each for a couple who both come, and not when one comes', () => {
  const both = cards().stayView(yes([true, true]), NOV, words).options[0].share;
  const one = cards().stayView(yes([true, false]), NOV, words).options[0].share;
  assert.ok(/ each\b/.test(both), both);
  assert.ok(!/ each\b/.test(one), one);
  assert.equal(both, core.shareLine(words.stay.share, 2));
  assert.equal(one, core.shareLine(words.stay.share, 1));
});

test('stay: one confirm label that follows the pick', () => {
  const c = cards();
  for (const k of ['villa', 'own', 'later']) assert.equal(c.confirmLabel(k, words), words.stay.confirm[k]);
  assert.equal(c.stayView(withStay(yes([true]), 'own'), NOV, words).confirm, words.stay.confirm.own);
});

test('stay: after the close date a made choice is fixed; no choice (or later) can still choose', () => {
  const c = cards();
  for (const choice of ['villa', 'own']) {
    const h = withStay(yes([true]), choice);
    assert.equal(core.canChangeStay(h, LATE), false);
    const v = c.stayView(h, LATE, words);
    assert.equal(v.locked, true);
    assert.equal(v.note, words.stay.fixed);
    assert.equal(v.picked, choice);
  }
  for (const h of [yes([true]), withStay(yes([true]), 'later')]) {
    const v = c.stayView(h, LATE, words);
    assert.equal(v.locked, false);
    assert.equal(v.note, null);
  }
  assert.equal(c.stayView(withStay(yes([true]), 'villa'), NOV, words).locked, false);
});

test('stay save: ok replaces ctx.household with a new object; a failure keeps it as it was', async () => {
  const c = cards();
  const before = withStay(yes([true]), 'later');
  const ctx = { invite: ONE, household: before, now: () => 5 };
  const calls = [];
  const ok = await c.saveStayChoice({ saveStay: (t, k) => { calls.push([t, k]); return Promise.resolve(true); } }, ctx, 'villa');
  assert.equal(ok, true);
  assert.deepEqual(calls, [[ONE.token, 'villa']]);
  assert.notEqual(ctx.household, before);
  assert.deepEqual(ctx.household.stay, { choice: 'villa', at: 5 });
  assert.deepEqual(ctx.household.reply, before.reply);
  assert.equal(before.stay.choice, 'later', 'never changed in place');
  const kept = ctx.household;
  const failed = await c.saveStayChoice({ saveStay: () => Promise.resolve(false) }, ctx, 'own');
  assert.equal(failed, false);
  assert.equal(ctx.household, kept);
});

test('stay card: a failed save shows errors.save, keeps the pick and offers a retry; taps are ignored while saving', () => {
  const js = read('js/first/cards.js');
  const then = js.match(/\n( *)saveStayChoice\([^)]*\)\.then\(function \(ok\) \{([\s\S]*?)\n\1\}\);/);
  assert.ok(then, 'saveStayChoice(...).then(function (ok) { ... })');
  const fail = then[2].indexOf('if (!ok)');
  assert.ok(fail >= 0);
  const branch = then[2].slice(fail, then[2].indexOf('return;', fail));
  assert.match(branch, /w\.errors\.save/);
  assert.match(branch, /w\.errors\.retry/);
  assert.doesNotMatch(branch, /pick\(|picked =/);
  assert.match(js, /if \(busy\) return;/);
  assert.match(js, /w\.stay\.saving/);
  assert.match(js, /home\.repaint\(\)/);
});

test('reply card: who is coming by name; a single guest sees no list', () => {
  const c = cards();
  assert.deepEqual(c.replyView(ONE, yes([true]), NOV, words).coming, []);
  assert.deepEqual(c.replyView(TWO, yes([true, true]), NOV, words).coming, ['Kit Moss', 'Sam Lee']);
  assert.deepEqual(c.replyView(TWO, yes([false, true]), NOV, words).coming, ['Sam Lee']);
  const v = c.replyView(TWO, yes([true, true]), NOV, words);
  assert.equal(v.title, words.yes.title);
  assert.equal(v.kicker, words.ask.replied);
  assert.equal(v.comingLabel, words.replyCard.coming);
});

test('reply card: change only while replies are open, then a line to message Joe or Sophie', () => {
  const c = cards();
  const open = c.replyView(ONE, yes([true]), NOV, words);
  assert.equal(open.canChange, true);
  assert.equal(open.until, core.fill(words.no.until, { date: core.ukDate(core.REPLIES_CLOSE_MS - 1) }));
  assert.equal(open.closed, null);
  const shut = c.replyView(ONE, yes([true]), LATE, words);
  assert.equal(shut.canChange, false);
  assert.equal(shut.until, null);
  assert.equal(shut.closed, words.replyCard.closed);
  assert.match(words.replyCard.closed, /Joe or Sophie/);
});

test('Not you? forgets the invitation and reloads the page without the token', () => {
  const c = cards();
  const seen = [];
  const invite = { forget: () => seen.push('forget') };
  const loc = { pathname: '/', search: '?first=1&w=tCardsOne000001aa&wtest=1', replace: u => seen.push(u) };
  c.notYou(invite, loc);
  assert.deepEqual(seen, ['forget', '/?first=1&wtest=1']);
  seen.length = 0;
  c.notYou(invite, { pathname: '/index.html', search: '', replace: u => seen.push(u) });
  assert.deepEqual(seen, ['forget', '/index.html']);
  seen.length = 0;
  c.notYou(null, { pathname: '/', search: '?w=tCardsOne000001aa', replace: u => seen.push(u) });
  assert.deepEqual(seen, ['/']);
  const js = read('js/first/cards.js');
  assert.match(js, /sjInvite/);
  assert.match(js, /w\.home\.notYou/);
});

test('the change control goes through the reply flow that reads the household again', () => {
  const js = read('js/first/cards.js');
  assert.match(js, /mode: 'change'/);
  assert.match(js, /canChange/);
  const reply = read('js/first/reply.js');
  assert.match(reply, /mode === 'change'\) return changeAnswer\(\)/);
});

test('fireworks only when the saved answer is yes and the one before was not', () => {
  const { firstYes } = require('../js/first/reply.js');
  const choice = a => ({ answer: a, coming: [a === 'yes'] });
  assert.equal(firstYes(null, choice('yes')), true);
  assert.equal(firstYes({ answer: 'no' }, choice('yes')), true);
  assert.equal(firstYes({ answer: 'yes' }, choice('yes')), false);
  assert.equal(firstYes(null, choice('no')), false);
  assert.match(read('js/first/reply.js'), /if \(firstYes\(before, choice\)\) celebrate\(first\);/);
});

test('the card is a dialog: focus in, Escape and close, focus back, the screen behind inert', () => {
  const js = read('js/first/cards.js');
  assert.match(js, /'role', 'dialog'/);
  assert.match(js, /'aria-modal', 'true'/);
  assert.match(js, /'Escape'/);
  assert.match(js, /\.inert = true|setAttribute\('inert'/);
  assert.match(js, /w\.home\.close/);
  assert.match(js, /opener/);
});

test('home: a repaint without a read, cards closed when it clears, and the watch-again load guarded', () => {
  const js = read('js/first/home.js');
  assert.equal(typeof require('../js/first/home.js').home.repaint, 'function');
  const clear = js.match(/function clear\(\) \{([\s\S]*?)\n {2}\}/);
  assert.ok(clear && /cards\.close\(/.test(clear[1]), 'clear closes any card');
  const land = js.match(/function land\([^)]*\) \{([\s\S]*?)\n {2}\}/);
  assert.ok(land && /readFresh\(/.test(land[1]), 'land goes through readFresh');
  assert.doesNotMatch(land[1], /store\.load\(token\)\.then/);
});

test('cards: words through textContent only, no amount, no console', () => {
  const js = read('js/first/cards.js');
  for (const m of js.matchAll(/\.innerHTML\s*=\s*([^;]*)/g))
    assert.doesNotMatch(m[1], /name|people|display|invite|household|words|label|share|\bw\./, 'innerHTML is given ' + m[1]);
  assert.doesNotMatch(js, /insertAdjacentHTML|outerHTML|document\.write/);
  assert.doesNotMatch(js, /\b150\b/);
  assert.doesNotMatch(js, /console\./);
});

test('card styles live inside #first, with a no-scroll short-phone rule', () => {
  const css = read('css/first.css');
  assert.match(css, /#first \.fc-card \{/);
  assert.match(css, /#first \.fc-opt\.fc-on \{/);
  assert.match(css, /#first \.fc-close \{/);
  const reduced = css.slice(css.lastIndexOf('prefers-reduced-motion'));
  assert.match(reduced, /\.fc-/);
});
