const test = require('node:test');
const assert = require('node:assert/strict');
const { nextIndex, copyProblems, WORDS, tiltFrom, motionAllowed } = require('../js/storybook.js');
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

test('tilt is flat without sensor data and clamped with it', () => {
  assert.deepEqual(tiltFrom(null), { x: 0, y: 0 });
  assert.deepEqual(tiltFrom({ gamma: null, beta: null }), { x: 0, y: 0 });
  assert.deepEqual(tiltFrom({ gamma: 90, beta: 200 }), { x: 1, y: 1 });
  assert.deepEqual(tiltFrom({ gamma: 0, beta: 45 }), { x: 0, y: 0 });
});

test('tilt follows the mouse as a position from -1 to 1', () => {
  assert.deepEqual(tiltFrom({ x: -3, y: .5 }), { x: -1, y: .5 });
});

test('reduced motion turns the animation off', () => {
  const win = { matchMedia: q => ({ matches: q.includes('reduce') }) };
  assert.equal(motionAllowed(win), false);
  assert.equal(motionAllowed({ matchMedia: () => ({ matches: false }) }), true);
  assert.equal(motionAllowed({}), true);
});
