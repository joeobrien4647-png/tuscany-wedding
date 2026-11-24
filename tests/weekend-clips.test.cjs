const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wk = require('../js/first/weekend-card.js');
const file = name => path.join(__dirname, '..', name);
const read = name => fs.readFileSync(file(name), 'utf8');

const js = read('js/first/weekend-card.js');
const css = read('css/first.css');
const body = name => js.slice(js.indexOf('function ' + name + '('));
const KEYS = ['fri', 'sat', 'sun', 'mon'];

test('clipFile: each day has one clip, named like its picture, and the file is there and under 1 MB', () => {
  for (const key of KEYS) {
    assert.equal(wk.clipFile(key), 'images/first/' + key + '.mp4');
    const size = fs.statSync(file(wk.clipFile(key))).size;
    assert.ok(size > 50000 && size < 1000000, key + ' clip is ' + size + ' bytes');
  }
});

test('mayMove: no clips with reduced motion, data saving or a 2g connection; clips otherwise', () => {
  assert.equal(wk.mayMove({}), true);
  assert.equal(wk.mayMove({ still: false, saveData: false, effectiveType: '4g' }), true);
  assert.equal(wk.mayMove({ effectiveType: '3g' }), true);
  assert.equal(wk.mayMove({ still: true }), false);
  assert.equal(wk.mayMove({ saveData: true }), false);
  assert.equal(wk.mayMove({ effectiveType: '2g' }), false);
  assert.equal(wk.mayMove({ effectiveType: 'slow-2g' }), false);
});

test('mayMove: a phone that says nothing about itself still gets clips, and nothing throws', () => {
  for (const env of [undefined, null, 'x', 7, []]) assert.equal(wk.mayMove(env), true);
});

test('clipPlays: only the day in view, only while the day is open, the card is live and the page is showing', () => {
  const on = { moves: true, open: true, live: true, hidden: false, idx: 1, day: 1 };
  assert.equal(wk.clipPlays(on), true);
  assert.equal(wk.clipPlays({ ...on, day: 2 }), false, 'a neighbour never plays');
  assert.equal(wk.clipPlays({ ...on, open: false }), false);
  assert.equal(wk.clipPlays({ ...on, live: false }), false);
  assert.equal(wk.clipPlays({ ...on, hidden: true }), false);
  assert.equal(wk.clipPlays({ ...on, moves: false }), false);
  assert.equal(wk.clipPlays(null), false);
});

test('clipDrops: a refused or unsupported play gives the clip up; an interrupted one does not', () => {
  assert.equal(wk.clipDrops({ name: 'NotAllowedError' }), true);
  assert.equal(wk.clipDrops({ name: 'NotSupportedError' }), true);
  assert.equal(wk.clipDrops({ name: 'AbortError' }), false);
  assert.equal(wk.clipDrops(null), false);
});

test('petalCount: only Saturday has petals drawn over its clip', () => {
  assert.deepEqual(KEYS.map(wk.petalCount), [0, 16, 0, 0]);
  assert.equal(wk.petalCount('nope'), 0);
});

test('the clip is a silent, looping, inline video with no controls, hidden from screen readers', () => {
  const make = body('makeClip').split('function ')[1];
  assert.match(make, /el\('video', 'wk-clip'\)/);
  for (const p of ['muted = true', 'loop = true', 'playsInline = true']) assert.match(make, new RegExp('\\.' + p.replace(/ /g, ' ')));
  assert.match(make, /'muted', 'playsinline'/, 'the attributes iPhones look for are set too');
  assert.match(make, /aria-hidden', 'true'/);
  assert.match(make, /tabIndex = -1/);
  assert.doesNotMatch(js, /\.controls = true|setAttribute\('controls'/);
  assert.doesNotMatch(js, /\.autoplay = true|setAttribute\('autoplay'/, 'play is asked for in code, so a closed day never plays');
});

test('a clip is asked for only when its day is in view, never with the neighbouring pictures', () => {
  assert.equal((js.match(/clipFile\(/g) || []).length, 2, 'one definition, one use');
  assert.match(body('makeClip').split('function ')[1], /\.src = clipFile\(/);
  assert.doesNotMatch(body('fetchDay').split('function ')[1], /clip/i);
  assert.doesNotMatch(body('want').split('\n')[0], /clip/i);
  assert.match(body('clipsOn').split('function ')[1], /later\(\(\) => playClip\(idx\), CLIP_WAIT_MS\)/, 'a short wait, so a quick swipe past a day fetches nothing');
});

test('no clip is made at all when the phone should not have moving pictures', () => {
  assert.match(js, /mayMove\(\{ still, saveData: [^}]*effectiveType: [^}]*\}\)/);
  assert.match(js, /navigator\.connection/);
  assert.match(body('clipsOn').split('function ')[1], /clipPlays\(/);
});

test('the still stays underneath: the clip shows only once it is playing, and a failure removes it', () => {
  const make = body('makeClip').split('function ')[1];
  assert.match(make, /addEventListener\('playing', \(\) => pics\[i\]\.classList\.add\('wk-clip-on'\)\)/);
  assert.match(make, /addEventListener\('error', \(\) => dropClip\(i\)\)/);
  assert.match(body('playClip').split('function ')[1], /clipDrops\(/);
  const drop = body('dropClip').split('function ')[1];
  assert.match(drop, /clips\.set\(i, null\)/, 'a dropped clip is not tried again');
  assert.match(drop, /\.remove\(\)/);
  assert.match(js, /wk-pic-img', d\.img, true\)/, 'the day picture is still made first');
});

test('clips stop when the day changes, the day closes, the page hides or the card closes', () => {
  assert.match(body('mark').split('function ')[1], /clipsOn\(\)/);
  assert.match(js, /const onVisible = \(\) => \{ lightsOn\(\); clipsOn\(\); \}/);
  assert.match(body('restClip').split('function ')[1], /\.pause\(\)/);
  const close = js.slice(js.indexOf('card.onClose('));
  assert.match(close.slice(0, close.indexOf('// Swipe between days')), /clips\.forEach\(\(c, i\) => dropClip\(i\)\)/);
});

test('the clip styles sit in the weekend section, fade in over the still and go under reduced motion', () => {
  const last = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  const rule = css.indexOf('#first .fc-weekend .wk-clip {');
  assert.ok(rule > css.indexOf('/* ==== The Weekend') && rule < last);
  assert.match(css, /#first \.fc-weekend \.wk-clip \{[^}]*opacity: 0[^}]*object-fit: cover|#first \.fc-weekend \.wk-clip \{[^}]*object-fit: cover[^}]*opacity: 0/);
  assert.match(css, /#first \.fc-weekend \.wk-pic\.wk-clip-on \.wk-clip[^{]*\{[^}]*opacity: 1/);
  assert.match(css, /#first \.fc-weekend \.wk-clip \{[^}]*pointer-events: none/, 'a swipe on the picture still reaches the day');
  assert.match(css.slice(last), /#first \.fc-weekend \.wk-clip, #first \.fc-weekend \.wk-petals \{[^}]*display: none/);
});

test('the petals are drawn by the page, are decoration only, and move only while their clip plays', () => {
  const petals = body('petals').split('function ')[1];
  assert.match(petals, /el\('div', 'wk-petals'\)/);
  assert.match(petals, /aria-hidden', 'true'/);
  assert.doesNotMatch(petals, /innerHTML/);
  assert.match(css, /#first \.fc-weekend \.wk-petal \{[^}]*animation-play-state: paused/);
  assert.match(css, /#first \.fc-weekend \.wk-pic\.wk-clip-on\.wk-on \.wk-petal[^{]*\{[^}]*animation-play-state: running/);
  assert.match(css, /@keyframes wk-petal-fall/);
});

test('index.html does not preload any clip, with the switch on', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /\.mp4/);
  assert.match(html, /data-first-enabled="true"/);
});
