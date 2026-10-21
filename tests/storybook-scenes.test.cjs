const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { shouldShowBook, copyProblems } = require('../js/storybook.js');
const { SCENES } = require('../js/storybook-scenes.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('switch: off by default, ?book=1 forces on, ?book=0 forces off', () => {
  assert.equal(shouldShowBook({ search: '', enabled: false }), false);
  assert.equal(shouldShowBook({ search: '?book=1', enabled: false }), true);
  assert.equal(shouldShowBook({ search: '?x=2&book=0', enabled: true }), false);
  assert.equal(shouldShowBook({ search: '', enabled: true }), true);
});

test('index.html ships the book switched off and hidden', () => {
  assert.match(html, /<script src="js\/storybook\.js" data-enabled="false" defer><\/script>/);
  assert.match(html, /<div id="storybook" class="storybook" hidden/);
});

test('scenes are in order and every shown string passes the copy rules', () => {
  assert.deepEqual(SCENES.map(s => s.id), ['tuscany', 'friday', 'saturday', 'sunday', 'monday', 'reply', 'pocket']);
  for (const s of SCENES) for (const t of [s.label, s.kicker, s.title]) assert.deepEqual(copyProblems(t), [], t);
  assert.deepEqual(copyProblems('A · B'), ['middle dot']);
  assert.deepEqual(copyProblems('A — B'), ['em dash']);
  assert.deepEqual(copyProblems('Pool day.'), ['trailing full stop']);
});

test('the copy rules also catch the sentimental lines the design rules out', () => {
  assert.deepEqual(copyProblems('Our story'), ['sentimental']);
  assert.deepEqual(copyProblems('The day she said yes'), ['sentimental']);
  assert.deepEqual(copyProblems('See you in Tuscany'), []);
});

test('each day page has at least one thing to tap and pieces stay on the page', () => {
  for (const s of SCENES.slice(0, 5)) assert.ok(s.pieces.some(p => p.act), s.id);
  for (const s of SCENES) for (const p of s.pieces) { assert.ok(p.depth >= 0 && p.depth <= 60); assert.ok(p.w > 0 && p.x > -20 && p.x + p.w < 125); }
});
