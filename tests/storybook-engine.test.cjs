const test = require('node:test');
const assert = require('node:assert/strict');
const { nextIndex, copyProblems, WORDS, tiltFrom, motionAllowed } = require('../js/storybook.js');
const { SCENES } = require('../js/storybook-scenes.js');
const { ART, WALLS, GROUNDS } = require('../js/storybook-art.js');
const { createSound } = require('../js/storybook-sound.js');

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

test('sound remembers the choice and never throws without audio support', () => {
  const store = {}, win = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  const s = createSound(win);
  assert.equal(s.isOn(), true);
  assert.doesNotThrow(() => { s.start(); s.pop(1); s.whoosh(); s.chime(); s.boom(); });
  assert.equal(s.toggle(), false); assert.equal(store['sj-book-sound'], 'off');
  assert.equal(createSound(win).isOn(), false);
});

test('sound survives storage that throws', () => {
  const win = { get localStorage() { throw new Error('blocked'); } };
  const s = createSound(win);
  assert.equal(s.isOn(), true);
  assert.doesNotThrow(() => { s.start(); s.toggle(); s.stop(); });
});

test('the music streams only once the book is opened, and not at all with sound off', () => {
  const made = [], store = {};
  class FakeAudio { constructor() { made.push(this); } play() { this.playing = true; return Promise.resolve(); } pause() { this.playing = false; } }
  const win = { Audio: FakeAudio, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  const s = createSound(win);
  assert.equal(made.length, 0);
  s.start();
  assert.equal(made.length, 1);
  assert.equal(made[0].src, 'audio/storybook-music.mp3');
  assert.equal(made[0].preload, 'none'); assert.equal(made[0].loop, true); assert.equal(made[0].playing, true);
  s.toggle(); assert.equal(made[0].playing, false);
  s.toggle(); assert.equal(made[0].playing, true);
  s.stop(); assert.equal(made[0].playing, false);
  s.toggle();
  const quiet = createSound(win); quiet.start();
  assert.equal(made.length, 1);
});

test('the book stays inside its weight budget and the music is never preloaded', () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.join(__dirname, '..');
  const files = fs.readdirSync(path.join(root, 'js')).filter(f => /^storybook.*\.js$/.test(f)).map(f => 'js/' + f).concat('css/storybook.css');
  const total = files.reduce((sum, f) => sum + fs.statSync(path.join(root, f)).size, 0);
  assert.ok(total <= 200 * 1024, 'storybook code is ' + total + ' bytes');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /storybook-music/);
  assert.ok(fs.statSync(path.join(root, 'audio/storybook-music.mp3')).size < 2 * 1024 * 1024);
});

test('coming back from another app wakes the audio that the phone suspended', () => {
  const contexts = [], handlers = {}, node = () => ({ connect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} } });
  class FakeContext {
    constructor() { this.state = 'running'; this.resumed = 0; this.currentTime = 0; this.destination = {}; contexts.push(this); }
    createGain() { return node(); } createMediaElementSource() { return node(); }
    resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  }
  class FakeAudio { play() { return Promise.resolve(); } pause() {} }
  const doc = { hidden: false, addEventListener: (type, fn) => { handlers[type] = fn; } };
  const s = createSound({ AudioContext: FakeContext, Audio: FakeAudio, document: doc, localStorage: { getItem: () => null, setItem() {} } });
  s.start();
  const ac = contexts[0];
  doc.hidden = true; ac.state = 'interrupted'; handlers.visibilitychange();
  doc.hidden = false; handlers.visibilitychange();
  assert.equal(ac.state, 'running');
  ac.state = 'suspended'; s.toggle(); s.toggle();
  assert.equal(ac.state, 'running');
});
