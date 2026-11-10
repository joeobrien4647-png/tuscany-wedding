const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// Session C fix wave (H1 to H16).
const YES = { reply: { answer: 'yes', coming: [true], at: 1 } };
const NOV = Date.UTC(2026, 10, 10, 12);
const LATE = core.REPLIES_CLOSE_MS + 86400000;
const fnBody = (js, head) => {
  const m = js.match(new RegExp('\\n( *)' + head + '\\{([\\s\\S]*?)\\n\\1\\}'));
  return m ? m[2] : null;
};

test('H1: the question reached from a change control knows where to go back to', () => {
  const { changeOrigin } = require('../js/first/reply.js');
  assert.equal(changeOrigin('change', undefined), 'home');
  assert.equal(changeOrigin('cantcome', undefined), 'cantcome');
  assert.equal(changeOrigin('already', undefined), 'already');
  assert.equal(changeOrigin('wait', 'cantcome'), 'cantcome');
  assert.equal(changeOrigin('wait', 'home'), 'home');
});

test('H1: the asked-again question carries a quiet Back that saves nothing', () => {
  const js = read('js/first/reply.js');
  assert.match(js, /backTo: changeOrigin\(o\.mode, o\.backTo\)/);
  const goBack = fnBody(js, 'function goBack\\(\\) ');
  assert.ok(goBack, 'function goBack');
  assert.doesNotMatch(goBack, /saveReply|send\(/);
  assert.match(goBack, /if \(busy\) return;/);
  assert.match(goBack, /goHome\(\)/);
  assert.match(js, /button\('fr-link fr-back', w\.ask\.back, goBack\)/);
  assert.match(js, /if \(o\.backTo\)/);
});

test('H3: a failed stay save reads the household again (a partner\'s no leaves for can\'t come)', () => {
  const js = read('js/first/cards.js');
  const then = js.match(/\n( *)(?:stayInFlight = )?saveStayChoice\([^)]*\)\.then\(function \(ok\) \{([\s\S]*?)\n\1\}\);/);
  assert.ok(then);
  const fail = then[2].slice(then[2].indexOf('if (!ok)'));
  assert.match(fail.slice(0, fail.indexOf('return;')), /home\.refresh\(\)/);
});

test('H4: a refresh that changes the stay choice closes an open Stay card', () => {
  const h = require('../js/first/home.js');
  const st = c => ({ reply: YES.reply, stay: { choice: c, at: 2 } });
  assert.equal(h.stayChanged(YES, st('own')), true);
  assert.equal(h.stayChanged(st('villa'), st('own')), true);
  assert.equal(h.stayChanged(st('villa'), st('villa')), false);
  assert.equal(h.stayChanged(YES, YES), false);
  const refresh = read('js/first/home.js').match(/function refresh\(\) \{([\s\S]*?)\n {2}\}/)[1];
  assert.match(refresh, /stayChanged\(/);
  assert.match(refresh, /openKey\(\) === 'stay'/);
  assert.equal(typeof require('../js/first/cards.js').cards.openKey, 'function');
  assert.equal(require('../js/first/cards.js').cards.openKey(), null);
});

test('H5: a fresh read with no reply goes to the question while open, the closed screen after', () => {
  const h = require('../js/first/home.js');
  const stayOnly = { stay: { choice: 'villa', at: 2 } };
  assert.equal(h.afterRefresh(null, NOV), 'ask');
  assert.equal(h.afterRefresh(stayOnly, NOV), 'ask');
  assert.equal(h.afterRefresh(null, LATE), 'closed');
  assert.equal(h.afterRefresh(stayOnly, LATE), 'closed');
  assert.equal(h.afterRefresh(undefined, NOV), 'keep');
  assert.equal(h.afterRefresh(YES, NOV), 'render');
  const js = read('js/first/home.js');
  assert.match(js, /afterRefresh\(household, r\.ctx\.now\(\)\)/);
  assert.match(js, /afterRefresh\(household, ctx\.now\(\)\)/);
});

test('H8: focus on the heading (not in the list) counts as outside, so Shift+Tab stays in the card', () => {
  const js = read('js/first/cards.js');
  const onKey = js.match(/function onKey\(e\) \{([\s\S]*?)\n {2}\}/)[1];
  assert.match(onKey, /inside = list\.indexOf\(a\) >= 0/);
});

test('H9: one stay save in flight at a time, and a failure after the card is gone shows a toast', () => {
  const js = read('js/first/cards.js');
  assert.match(js, /let stayInFlight = null/);
  const confirm = fnBody(js, 'function confirm\\(\\) ');
  assert.match(confirm, /if \(busy \|\| stayInFlight\) return;/);
  assert.match(js, /home\.toast\(w\.errors\.save\)/);
  assert.equal(typeof require('../js/first/home.js').home.toast, 'function');
});

test('H10 and H11: an old toast fade never hides a newer toast; finished animations are dropped', () => {
  const js = read('js/first/home.js');
  assert.match(js, /const gen = \+\+r\.toastGen/);
  assert.match(js, /gen === r\.toastGen/);
  assert.match(js, /addEventListener\('finish'/);
});

test('H12: each question button controls its answer panel', () => {
  const js = read('js/first/cards.js');
  assert.match(js, /'aria-controls'/);
  assert.match(js, /moreIn\.id = /);
});

test('H13: no unused swipe line', () => {
  assert.equal(words.weekend.swipe, undefined);
});

test('H14: a sealed envelope past its date says it is nearly ready, not the old date', () => {
  const h = require('../js/first/home.js');
  const after = Date.UTC(2027, 1, 2, 9);
  const list = h.envelopes(after, words);
  assert.equal(list[0].toast, words.home.soon);
  assert.ok(list[0].label.includes(words.home.soon), list[0].label);
  assert.equal(list[1].toast, core.fill(words.home.opens, { date: 'Thu 1 Apr' }));
  assert.equal(list[5].toast, core.fill(words.home.opens, { date: 'June' }));
  assert.ok(typeof words.home.soon === 'string' && words.home.soon.length < 24);
});

test('H15: the wedding day by UK calendar: before, today, after', () => {
  assert.equal(core.weddingDay(core.WEDDING_MS - 1), 'before');
  assert.equal(core.weddingDay(core.WEDDING_MS), 'today');
  assert.equal(core.weddingDay(core.WEDDING_MS + 86400000 - 1), 'today');
  assert.equal(core.weddingDay(core.WEDDING_MS + 86400000), 'after');
  assert.equal(core.ukDate(core.WEDDING_MS), 'Sat 29 May');
  assert.equal(core.ukDate(core.WEDDING_MS + 86400000 - 1), 'Sat 29 May');
  const js = read('js/first/home.js');
  assert.match(js, /weddingDay\(/);
  assert.match(js, /w\.home\.today/);
  assert.ok(typeof words.home.today === 'string');
});

test('H16: the own-place sub-line no longer says they join every day', () => {
  assert.doesNotMatch(words.stay.own.sub, /each day|every day/i);
  assert.ok(words.stay.own.sub.length <= 40, words.stay.own.sub);
});

test('H2: weekend tiles have a strong scrim, 11px bright-gold dates and a stronger shadow', () => {
  const css = read('css/first.css');
  const scrim = css.match(/#first \.fc-day::after \{[^}]*\}/)[0];
  assert.match(scrim, /rgba\(5, 6, 12, \.9[5-9]\) 100%/);
  assert.match(css, /#first \.fc-day-cap \.fc-grp-k \{[^}]*font-size: 11px;[^}]*color: var\(--gold-hi\)/);
});

test('H6: foot links at least 44px tall and envelope stamps at 11px', () => {
  const css = read('css/first.css');
  assert.match(css, /#first \.fh-link \{[^}]*min-height: 44px/);
  assert.match(css, /#first \.fh-env-d \{[^}]*font: 500 11px/);
});
