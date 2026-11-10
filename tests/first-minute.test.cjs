const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { copyProblems } = require('../js/first/core.js');
const { coverLine } = require('../js/first/minute.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const IMAGES = ['estate', 'fri', 'mon', 'night-blur', 'night', 'sat', 'sun', 'villa'];

test('cover line is the name as plain text, at most 60 characters', () => {
  assert.ok(coverLine({ display: 'Alex and Sam' }).includes('Alex and Sam'));
  assert.equal(coverLine(null), '');
  assert.equal(coverLine(undefined), '');
  assert.equal(coverLine({}), '');
  assert.equal(coverLine({ display: '   ' }), '');
  assert.equal(coverLine({ display: 42 }), '');
  assert.ok(coverLine({ display: 'A'.repeat(100) }).length <= 60);
  assert.equal(coverLine({ display: '  Alex \n  and   Sam ' }), 'Alex and Sam');
  assert.equal(coverLine({ display: '<b>x</b>' }), '<b>x</b>');
  assert.equal(coverLine({ display: "Alexandra-Marie & Christopher O'Néill" }), "Alexandra-Marie & Christopher O'Néill");
  assert.deepEqual(copyProblems(coverLine({ display: 'Alex and Sam' })), []);
});

test('names and words reach the page through textContent, never innerHTML', () => {
  const js = read('js/first/minute.js');
  assert.match(js, /\.textContent = name\b/);
  assert.match(js, /const name = coverLine\(/);
  for (const m of js.matchAll(/\.innerHTML\s*=\s*([^;]*)/g))
    assert.doesNotMatch(m[1], /name|display|invite|coverLine|words|\bw\./, 'innerHTML is given ' + m[1]);
  assert.doesNotMatch(js, /insertAdjacentHTML|outerHTML|document\.write/);
});

test('the eight images are in images/first and stay small', () => {
  let total = 0;
  for (const n of IMAGES) {
    const file = path.join(__dirname, '..', 'images', 'first', n + '.webp');
    assert.ok(fs.existsSync(file), n);
    total += fs.statSync(file).size;
  }
  assert.ok(total < 900 * 1024, 'images total ' + total);
});

test('the minute uses the drive video with its poster, and the sound uses the music', () => {
  const js = read('js/first/minute.js');
  assert.match(js, /video\/drive-hero-720\.mp4/);
  assert.match(js, /video\/drive-hero-poster\.jpg/);
  assert.match(js, /muted/); assert.match(js, /playsinline/);
  assert.match(read('js/first/sound.js'), /audio\/storybook-music\.mp3/);
  for (const f of ['video/drive-hero-720.mp4', 'video/drive-hero-poster.jpg', 'audio/storybook-music.mp3'])
    assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f);
});

test('the layer has a reduced-motion path, scoped to #first', () => {
  const css = read('css/first.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#first\s*\{[^}]*--night:/);
  assert.doesNotMatch(css, /:root/);
});

test('skip and sound controls carry aria-labels from words', () => {
  const js = read('js/first/minute.js');
  assert.match(js, /skip\.setAttribute\('aria-label', w\.minute\.skip\)/);
  assert.match(js, /setAttribute\('aria-label', on \? w\.minute\.soundOn : w\.minute\.soundOff\)/);
  assert.match(js, /setAttribute\('aria-label', w\.cover\.sealLabel\)/);
});

test('every on-screen word in the minute comes from words', () => {
  const js = read('js/first/minute.js');
  for (const m of js.matchAll(/\.textContent = ([^;]+);/g))
    assert.doesNotMatch(m[1], /['"`]\s*\w/, 'literal text: ' + m[1]);
});

test('sound and fx keep the prototype interface', () => {
  const sound = read('js/first/sound.js'), fx = read('js/first/fx.js');
  for (const k of ['unlock', 'music', 'quiet', 'crack', 'chime', 'pop', 'boom', 'toggle', 'on'])
    assert.match(sound, new RegExp('\\b' + k + '[,:\\s]'), 'sound.' + k);
  for (const k of ['dust', 'burst', 'show']) assert.match(fx, new RegExp('\\b' + k + '[,:\\s]'), 'fx.' + k);
});

test('G5: stop takes the src off the video and resets it', () => {
  const js = read('js/first/minute.js');
  const stop = js.match(/\n( *)function stop\(\) \{([\s\S]*?)\n\1\}/);
  assert.ok(stop);
  assert.match(stop[2], /removeAttribute\('src'\)/);
  assert.match(stop[2], /\.load\(\)/);
});

test('G7: the music is not made or fetched when the script loads, only when needed, and never ahead with Save-Data', () => {
  const vm = require('node:vm');
  const src = read('js/first/sound.js');
  function load(saveData) {
    const made = [];
    class Audio { constructor() { made.push(this); } }
    const sandbox = { document: { addEventListener() {}, hidden: false }, Audio, navigator: { connection: { saveData } },
      localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout };
    sandbox.window = sandbox;
    vm.runInNewContext(src, sandbox);
    return { made, sound: sandbox.sjFirst.sound };
  }
  const a = load(false);
  assert.equal(a.made.length, 0, 'made on load');
  a.sound.prepare();
  assert.equal(a.made.length, 1);
  assert.equal(a.made[0].preload, 'auto');
  assert.match(a.made[0].src, /storybook-music\.mp3/);
  a.sound.prepare();
  assert.equal(a.made.length, 1, 'made once');
  const b = load(true);
  b.sound.unlock();
  assert.equal(b.made.length, 1, 'unlock makes it');
  assert.equal(b.made[0].preload, 'none');
  assert.match(read('js/first/minute.js'), /if \(!o\.quick\) S\.prepare\(\);/);
});

test('G3: every inset has the four offsets before it, every aspect-ratio a height, and no flex gap', () => {
  const css = read('css/first.css');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  for (const { sel, body } of rules) {
    const decls = body.split(';').map(d => d.trim()).filter(Boolean);
    const prop = d => d.split(':')[0].trim();
    decls.forEach((d, i) => {
      if (prop(d) === 'inset') {
        const before = decls.slice(0, i).map(prop);
        for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(before.includes(side), sel + ' inset needs ' + side + ' first');
      }
      if (prop(d) === 'aspect-ratio') assert.ok(decls.map(prop).some(p => p === 'height' || p.startsWith('padding')), sel + ' aspect-ratio needs a height');
    });
    const display = decls.filter(d => prop(d) === 'display').map(d => d.split(':')[1].trim());
    if (display.some(v => /flex/.test(v))) assert.ok(!decls.some(d => prop(d) === 'gap'), sel + ' uses gap in flex');
    assert.doesNotMatch(body, /\d(dvh|svh|lvh)\b/, sel);
  }
});
