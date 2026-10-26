const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../getting-there.html'), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('gt-hero-video'));
assert.ok(source, 'drive hero script exists');

function fixture({ width = 390, reduced = false, saveData = false, canPlay = true, observer = true, ready = 'complete', coarse = false } = {}) {
  let intersection, onLoad, removed = false, src = '', plays = 0;
  const events = {};
  const parent = { removeChild() { removed = true; video.parentNode = null; } };
  const video = {
    parentNode: parent,
    paused: true,
    canPlayType: () => canPlay ? 'probably' : '',
    getAttribute(name) { return name === 'src' ? src : name === 'data-src' ? 'video/drive-hero-720.mp4' : null; },
    set src(value) { src = value; },
    play() { plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    addEventListener(name, callback) { events[name] = callback; }
  };
  class Observer { constructor(callback) { intersection = callback; } observe() {} }
  const window = { innerWidth: width, isCoarse: coarse, matchMedia: query => ({ matches: query.includes('pointer: coarse') ? window.isCoarse : reduced }), addEventListener: (_, callback) => { onLoad = callback; } };
  if (observer) window.IntersectionObserver = Observer;
  vm.runInNewContext(source, { window, document: { getElementById: () => video, readyState: ready }, navigator: { connection: { saveData } }, IntersectionObserver: Observer });
  return { video, browser: window, get removed() { return removed; }, get src() { return src; }, get plays() { return plays; }, get intersection() { return intersection; }, get onLoad() { return onLoad; }, events };
}

test('phone widths retain the poster and never request the decorative video', () => {
  for (const width of [320, 390, 640]) {
    const run = fixture({ width });
    assert.equal(run.removed, true, `video element removed at ${width}px`);
    assert.equal(run.src, '', `no video source requested at ${width}px`);
    assert.equal(run.intersection, undefined, `no video observer at ${width}px`);
  }
});

test('landscape phones and compact tablets retain the poster without downloading video', () => {
  for (const width of [844, 1024]) {
    const run = fixture({ width, coarse: true });
    assert.equal(run.removed, true, `video element removed at ${width}px`);
    assert.equal(run.src, '', `no video source requested at ${width}px`);
  }
});

test('non-touch desktops and wider touch screens can still play the desktop video', () => {
  for (const options of [{ width: 1024, coarse: false }, { width: 1025, coarse: true }]) {
    const run = fixture(options);
    assert.equal(run.removed, false);
    run.intersection([{ isIntersecting: true }]);
    assert.equal(run.src, 'video/drive-hero-720.mp4');
  }
});

test('desktop video waits for load and visibility, then pauses and resumes', () => {
  const run = fixture({ width: 1000, ready: 'loading' });
  assert.equal(run.src, '');
  assert.equal(run.intersection, undefined);
  run.onLoad();
  assert.ok(run.intersection);
  run.intersection([{ isIntersecting: true }]);
  assert.equal(run.src, 'video/drive-hero-720.mp4');
  assert.ok(run.plays >= 1);
  run.intersection([{ isIntersecting: false }]);
  assert.equal(run.video.paused, true);
  run.intersection([{ isIntersecting: true }]);
  assert.equal(run.video.paused, false);
  run.events.error();
  assert.equal(run.removed, true);
});

test('a phone-sized window does not start the video after the page loads', () => {
  const run = fixture({ width: 1000, ready: 'loading' });
  run.browser.innerWidth = 844;
  run.browser.isCoarse = true;
  run.onLoad();
  run.intersection([{ isIntersecting: true }]);
  assert.equal(run.removed, true);
  assert.equal(run.src, '');
  assert.equal(run.plays, 0);
});

test('desktop preserves reduced motion, save-data and unsupported video fallbacks', () => {
  for (const options of [{ reduced: true }, { saveData: true }, { canPlay: false }]) {
    const run = fixture({ width: 1000, ...options });
    assert.equal(run.removed, true);
    assert.equal(run.src, '');
  }
  const noObserver = fixture({ width: 1000, observer: false });
  assert.equal(noObserver.src, 'video/drive-hero-720.mp4');
});
