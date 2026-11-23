const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const home = read('js/first/home.js');
const minute = read('js/first/minute.js');
const css = read('css/first.css');

test('the opening seal is unchanged: the wax and the S&J letters are still one art', () => {
  assert.match(minute, /<g id="fm-seal-art"><g id="fm-seal-wax"><path id="fm-seal-blob"/);
  const wax = minute.indexOf('id="fm-seal-wax"'), letters = minute.indexOf('S&amp;J');
  assert.ok(wax > 0 && letters > wax, 'the letters come after the wax');
  assert.match(minute.slice(wax, letters), /<\/g><g font-family=/, 'the letters sit outside the wax group, inside the art');
  assert.match(minute, /<linearGradient id="fm-gild"/, 'the gold for the emblems is defined once, with the wax');
});

test('an envelope with an emblem shows the wax without letters and the emblem in gold; the rest keep the S&J seal', () => {
  assert.match(home, /const EMBLEMS = \{/);
  assert.match(home, /if \(!e\) return WAX;/);
  assert.match(home, /<use href="#fm-seal-wax"\/>/);
  assert.match(home, /fill="url\(#fm-gild\)"/);
  assert.match(home, /fill-rule="evenodd"/, 'the holes in an emblem are real holes');
  assert.match(home, /b\.innerHTML = FLAP \+ sealFor\(env\.key\) \+ '<span class="fh-env-i"/);
  assert.match(home, /const WAX = '[^']*<use href="#fm-seal-art"\/>/);
});

test('every envelope has its emblem, each fitted to the seal', () => {
  const keys = core.LOCKS.map(l => l.key);
  const found = [...home.matchAll(/^ {4}(\w+): \{ at: 'translate\(100 100\) scale\((\.\d+)\) translate\(-\d+ -\d+\)', d: '([^']+)' \}/gm)];
  assert.deepEqual(found.map(f => f[1]), keys, 'one emblem per envelope, in the envelopes\' order');
  for (const [, key, scale, d] of found) {
    assert.ok(keys.includes(key), key + ' is an envelope');
    assert.ok(Number(scale) > 0.02 && Number(scale) < 0.3, key + ' is scaled from its 2048 box into the well');
    assert.match(d, /^M [\d. CLMz-]+$/, key + ' is plain path data');
  }
});

test('the seal is a little larger so an emblem reads', () => {
  assert.match(css, /#first \.fh-wax \{[^}]*width: clamp\(34px, 11\.5vw, 54px\); height: clamp\(34px, 11\.5vw, 54px\)/);
});
