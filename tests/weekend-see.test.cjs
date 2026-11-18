const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { words } = require('../js/first/words.js');
const wk = require('../js/first/weekend-card.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const js = read('js/first/weekend-card.js');
const css = read('css/first.css');
const body = name => js.slice(js.indexOf('function ' + name + '(')).split('function ')[1];

test('the words name the control both ways, and weekendView hands them on', () => {
  for (const k of ['see', 'unsee']) {
    assert.equal(typeof words.weekend[k], 'string', k);
    assert.ok(words.weekend[k].length > 3 && words.weekend[k].length <= 28, k);
  }
  assert.notEqual(words.weekend.see, words.weekend.unsee);
  const v = wk.weekendView(words);
  assert.equal(v.see, words.weekend.see);
  assert.equal(v.unsee, words.weekend.unsee);
  assert.equal(wk.weekendView({}).see, '');
});

test('seeNext: the picture can be shown clear only while a day is open', () => {
  assert.equal(wk.seeNext(true, true), true);
  assert.equal(wk.seeNext(false, true), false);
  assert.equal(wk.seeNext(true, false), false);
  assert.equal(wk.seeNext(undefined, true), false);
});

test('the control is a real button that says which way it goes and whether it is on', () => {
  assert.match(js, /button\('wk-see', null, \(\) => setClear\(!clear\)\)/);
  const set = body('setClear');
  assert.match(set, /seeNext\(/);
  assert.match(set, /classList\.toggle\('wk-clear', clear\)/);
  assert.match(set, /setAttribute\('aria-pressed', clear \? 'true' : 'false'\)/);
  assert.match(set, /setAttribute\('aria-label', clear \? v\.unsee : v\.see\)/);
  assert.match(js, /if \(v\.see && v\.unsee\)/, 'no words, no control');
});

test('while the picture is clear the words are out of reach, and come back with it', () => {
  const set = body('setClear');
  assert.match(set, /track\.inert = clear/);
  assert.match(set, /aria-hidden/);
});

test('the close control and Escape step back to the words first, then to the four days', () => {
  const guard = js.slice(js.indexOf('card.beforeClose('), js.indexOf('function onKey('));
  assert.match(guard, /if \(clear\) \{ setClear\(false\); return true; \}/);
  assert.ok(guard.indexOf('if (clear)') < guard.indexOf('closeDay()'));
  assert.match(body('setClear'), /card\.closeLabel\(clear \? v\.unsee : v\.back\)/);
});

test('opening or closing a day always starts from the words', () => {
  assert.match(body('openDay'), /setClear\(false, true\)/);
  assert.match(body('closeDay'), /setClear\(false, true\)/);
  assert.match(body('setClear'), /if \(!quiet\)/, 'no sound or buzz when it is the code tidying up');
});

test('a tap on the control never starts a swipe', () => {
  assert.match(js, /e\.target\.closest\('button'\)/);
});

test('clear means the shade, the words and the swipe hint fade out; the marks and the control stay', () => {
  const off = css.match(/#first \.fc-weekend \.wk-day\.wk-clear \.wk-shade[^{]*\{[^}]*\}/);
  assert.ok(off, 'the clear rule is there');
  assert.match(off[0], /\.wk-track/);
  assert.match(off[0], /\.wk-swipe/);
  assert.match(off[0], /opacity: 0/);
  assert.match(off[0], /pointer-events: none/);
  assert.doesNotMatch(off[0], /\.wk-marks|\.wk-see/);
  assert.match(css, /#first \.fc-weekend \.wk-see \{[^}]*width: 44px[^}]*height: 44px/, 'a full-size touch target');
});

test('the control sits in the weekend section and nothing about it moves under reduced motion', () => {
  const last = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  const rule = css.indexOf('#first .fc-weekend .wk-see {');
  assert.ok(rule > css.indexOf('/* ==== The Weekend') && rule < last);
  assert.match(css.slice(last), /#first \.fc-weekend \.wk-shade, #first \.fc-weekend \.wk-track[^{]*\{[^}]*transition: none/);
});
