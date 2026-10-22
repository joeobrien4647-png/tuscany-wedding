const test = require('node:test');
const assert = require('node:assert/strict');
const { nextIndex, copyProblems, WORDS } = require('../js/storybook.js');
const { SCENES } = require('../js/storybook-scenes.js');
const { ART, WALLS, GROUNDS } = require('../js/storybook-art.js');

test('nextIndex refuses to move while turning or past either end', () => {
  assert.equal(nextIndex(0, -1, 7, false), null);
  assert.equal(nextIndex(6, 1, 7, false), null);
  assert.equal(nextIndex(2, 1, 7, true), null);
  assert.equal(nextIndex(2, 1, 7, false), 3);
});

test('every piece and page has art, and the art is self-contained SVG', () => {
  for (const s of SCENES) {
    assert.equal(typeof WALLS[s.id], 'function'); assert.equal(typeof GROUNDS[s.id], 'function');
    let size = 0;
    for (const p of s.pieces) {
      const svg = ART[p.art](p.opts || {});
      assert.match(svg, /^<svg[^>]*viewBox="[\d. -]+"/); assert.doesNotMatch(svg, /href=|url\(http/);
      size += svg.length;
    }
    assert.ok(size < 60000, s.id + ' art is ' + size + ' bytes');
  }
});

test('every line the book itself shows passes the copy rules', () => {
  const lines = [];
  (function collect(value) {
    if (typeof value === 'string') lines.push(value);
    else for (const v of Object.values(value)) collect(v);
  })(WORDS);
  assert.ok(lines.length >= 10);
  for (const line of lines) assert.deepEqual(copyProblems(line), [], line);
  for (const act of ['drive', 'fire', 'lights', 'petals', 'splash']) assert.ok(WORDS.acts[act], act);
});
