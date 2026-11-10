const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('replyFor: the whole household, one person, or nobody', () => {
  const { replyFor } = require('../js/first/reply.js');
  assert.deepEqual(replyFor(['A', 'B'], 'all'), { answer: 'yes', coming: [true, true] });
  assert.deepEqual(replyFor(['A', 'B'], 1), { answer: 'yes', coming: [false, true] });
  assert.deepEqual(replyFor(['A', 'B'], 0), { answer: 'yes', coming: [true, false] });
  assert.deepEqual(replyFor(['A', 'B'], 'none'), { answer: 'no', coming: [false, false] });
  assert.deepEqual(replyFor([], 'all'), { answer: 'yes', coming: [true] });
  assert.deepEqual(replyFor(['A'], 'all'), { answer: 'yes', coming: [true] });
});

test('replyFor never returns an empty coming and never a yes with nobody coming', () => {
  const { replyFor } = require('../js/first/reply.js');
  assert.deepEqual(replyFor([], 'none'), { answer: 'no', coming: [false] });
  assert.deepEqual(replyFor(null, 'all'), { answer: 'yes', coming: [true] });
  for (const bad of [2, -1, 1.5, '1', 'some', undefined, null, NaN])
    assert.equal(replyFor(['A', 'B'], bad), null, String(bad));
  assert.equal(replyFor([], 0), null);
  for (const people of [[], ['A'], ['A', 'B'], ['A', 'B', 'C']])
    for (const who of ['all', 'none', 0, 1, 2]) {
      const r = replyFor(people, who);
      if (!r) continue;
      assert.ok(r.coming.length >= 1);
      if (r.answer === 'yes') assert.ok(r.coming.includes(true));
    }
});

test('reply and app load in Node without touching the page or throwing', () => {
  assert.doesNotThrow(() => require('../js/first/reply.js'));
  assert.doesNotThrow(() => require('../js/first/app.js'));
  const app = require('../js/first/app.js');
  assert.equal(typeof app.app.start, 'function');
  assert.equal(typeof require('../js/first/reply.js').reply.show, 'function');
});

test('the "only one of us" route shows only when the household has more than one person', () => {
  const js = read('js/first/reply.js');
  assert.match(js, /people\.length > 1/);
  const at = js.indexOf('w.ask.onlyOne');
  assert.ok(at > 0, 'uses words.ask.onlyOne');
  const before = js.slice(Math.max(0, at - 300), at);
  assert.match(before, /people\.length > 1/, 'onlyOne is guarded by people.length > 1');
});

test('fireworks run only after saveReply resolves true; on false the error and a retry show and the choice is kept', () => {
  const js = read('js/first/reply.js');
  // Each block is cut at the closing brace on its own indentation, so nested blocks cannot end it early.
  const block = name => js.match(new RegExp('\\n( *)' + name + '\\{([\\s\\S]*?)\\n\\1\\}'));
  const then = js.match(/\n( *)first\.store\.saveReply\([^)]*\)\.then\(function \(ok\) \{([\s\S]*?)\n\1\}\);/);
  assert.ok(then, 'saveReply(...).then(function (ok) { ... })');
  const body = then[2];
  const fail = body.indexOf('if (!ok)');
  assert.ok(fail >= 0, 'checks ok');
  assert.ok(body.indexOf('saved(') > fail, 'saved() only after the ok check');
  const failBranch = body.slice(fail, body.indexOf('saved('));
  assert.match(failBranch, /w\.errors\.save/);
  assert.match(failBranch, /retry/i);
  assert.match(failBranch, /return;/);
  assert.doesNotMatch(failBranch, /fx\.show|fr-on'\)\.forEach|clearChosen/);
  // fx.show appears once, inside celebrate, and celebrate is called only from saved.
  assert.equal((js.match(/fx\.show\(/g) || []).length, 1);
  const celebrate = block('function celebrate\\([^)]*\\) ');
  assert.ok(celebrate && /fx\.show\(/.test(celebrate[2]), 'fx.show inside celebrate');
  assert.equal((js.match(/celebrate\(/g) || []).length, 2, 'celebrate defined once and called once');
  const saved = block('function saved\\([^)]*\\) ');
  assert.ok(saved && /celebrate\(/.test(saved[2]), 'celebrate is called from saved');
  assert.equal((js.match(/saved\(/g) || []).length, 2, 'saved defined once and called once, after the ok check');
  assert.match(js, /if \(busy\) return;/);
});

test('reply-by date is the last day replies are open, through fill', () => {
  const js = read('js/first/reply.js');
  assert.match(js, /ukDate\(first\.REPLIES_CLOSE_MS - 1\)/);
  assert.match(js, /fill\(w\.ask\.closesNote/);
  const { ukDate, REPLIES_CLOSE_MS } = require('../js/first/core.js');
  assert.equal(ukDate(REPLIES_CLOSE_MS - 1), 'Sun 28 Feb');
});

test('change control shows only while replies are open; home.show is guarded', () => {
  const js = read('js/first/reply.js');
  assert.match(js, /repliesOpen\(ctx\.now\(\)\)/);
  assert.match(js, /home && typeof home\.show === 'function'/);
});

test('names and fetched values reach the page through textContent only', () => {
  for (const f of ['js/first/reply.js', 'js/first/app.js']) {
    const js = read(f);
    for (const m of js.matchAll(/\.innerHTML\s*=\s*([^;]*)/g))
      assert.doesNotMatch(m[1], /name|people|display|invite|household|words|\bw\./, f + ' innerHTML is given ' + m[1]);
    assert.doesNotMatch(js, /insertAdjacentHTML|outerHTML|document\.write/, f);
    assert.doesNotMatch(js, /console\./, f);
  }
});

test('no amount anywhere in js/first, and no console', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'js', 'first'))) {
    const js = read('js/first/' + f);
    if (f !== 'core.js') assert.doesNotMatch(js, /\b150\b/, f);
    assert.doesNotMatch(js, /console\./, f);
  }
  assert.equal((read('js/first/core.js').match(/\b150\b/g) || []).length, 1);
});

test('app: landing decides, no clear answer means wait, fnow only in local test', () => {
  const js = read('js/first/app.js');
  assert.match(js, /landing\(/);
  assert.match(js, /markSeen\(\)/);
  assert.match(js, /remember\(\)/);
  assert.match(js, /\.token/);
  assert.match(js, /wtest/);
  assert.match(js, /fnow/);
  assert.match(js, /isLocalTest\(\) \?/);
  assert.match(js, /quick: true/);
});

test('fx has a stop that show and attach call, and clears its pending timeouts', () => {
  const js = read('js/first/fx.js');
  assert.match(js, /function stop\(\)/);
  assert.match(js, /clearTimeout/);
  const show = js.match(/function show\(\) \{([\s\S]*?)\n {2}\}/);
  assert.ok(show && /stop\(\)/.test(show[1]), 'show calls stop');
  const fx = require('../js/first/fx.js').fx;
  assert.equal(typeof fx.stop, 'function');
  assert.doesNotThrow(() => fx.stop());
});

test('reply screens are styled inside #first', () => {
  const css = read('css/first.css');
  for (const c of ['fr-panel', 'fr-gold', 'fr-ghost', 'fr-on', 'fr-err', 'fr-center'])
    assert.match(css, new RegExp('#first [^{]*\\.' + c), c);
});
