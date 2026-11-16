const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wk = require('../js/first/weekend-card.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const cardsJs = read('js/first/cards.js');
const js = read('js/first/weekend-card.js');

test('settle: a long or fast swipe moves one day, a short slow one stays, and the ends hold', () => {
  assert.equal(wk.settle(1, -120, 375, 300, 4), 2);
  assert.equal(wk.settle(1, 120, 375, 300, 4), 0);
  assert.equal(wk.settle(1, -40, 375, 400, 4), 1);
  assert.equal(wk.settle(1, -40, 375, 60, 4), 2);     // a flick
  assert.equal(wk.settle(0, 200, 375, 300, 4), 0);
  assert.equal(wk.settle(3, -200, 375, 300, 4), 3);
});

test('settle: no movement, no width or no time never moves or throws', () => {
  assert.equal(wk.settle(2, 0, 375, 0, 4), 2);
  assert.equal(wk.settle(2, -5, 0, 0, 4), 2);
  assert.equal(wk.settle(9, 0, 375, 100, 4), 3);
});

test('along: follows the finger, and pulls a third as far past either end', () => {
  assert.equal(wk.along(1, -187.5, 375, 4), 1.5);
  assert.ok(Math.abs(wk.along(0, 150, 375, 4) - (-0.4 / 3)) < 1e-9);
  assert.ok(Math.abs(wk.along(3, -150, 375, 4) - (3 + 0.4 / 3)) < 1e-9);
  assert.equal(wk.along(2, 0, 375, 4), 2);
});

test('cards.js hands the weekend card to weekend-card.js', () => {
  assert.match(cardsJs, /CARDS\.weekend = \{ build: card => root\.sjFirst\.weekendCard\.build\(card\) \}/);
  assert.equal(typeof wk.build, 'function');
});

test('the weekend card sets words with textContent, has lazy decorative pictures and stops when closed', () => {
  assert.doesNotMatch(js, /insertAdjacentHTML|outerHTML|document\.write|console\./);
  const html = [...js.matchAll(/innerHTML\s*=\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(html.length > 0, 'icons go in through the one helper');
  for (const rhs of html) assert.match(rhs, /^ICON\[/, 'innerHTML only takes a fixed icon: ' + rhs);
  assert.match(js, /\.loading = 'lazy'/);
  assert.match(js, /\.alt = ''/);
  assert.match(js, /card\.onClose\(/);
  assert.match(js, /card\.beforeClose\(/);
  assert.ok(!js.includes(String.fromCharCode(0x2014)) && !js.includes(String.fromCharCode(0xb7)));
});

test('the lights: one canvas, at most 34 points, pixel ratio at most 2, off when hidden and with reduced motion', () => {
  assert.equal((js.match(/createElement\('canvas'\)|el\('canvas'/g) || []).length, 1);
  assert.match(js, /MAX_LIGHTS = 34\b/);
  assert.match(js, /Math\.min\(2, root\.devicePixelRatio \|\| 1\)/);
  assert.match(js, /addEventListener\('visibilitychange'/);
  assert.match(js, /removeEventListener\('visibilitychange'/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test('a day is a real button with its date and name, and the tiles behind go quiet while a day is open', () => {
  assert.match(js, /aria-label/);
  assert.match(js, /\.inert = /);
  assert.match(js, /aria-hidden/);
  assert.match(js, /tabIndex = -1/);
});

test('each tile is labelled with its date, its name and the word for opening the day', () => {
  assert.match(js, /setAttribute\('aria-label', dayLabel\(d, v\.open\)\)/);
  assert.match(js, /aria-haspopup', 'dialog'/);
});

test('the band of light has its own trigger class, never the tile arrow class', () => {
  const css = read('css/first.css');
  assert.doesNotMatch(js, /band\.classList\.(add|remove)\('wk-go'\)/);
  assert.match(js, /band\.classList\.add\('wk-band-on'\)/);
  assert.match(css, /#first \.fc-weekend \.wk-band\.wk-band-on \{[^}]*animation: wk-band/);
  assert.doesNotMatch(css, /\.wk-band\.wk-go/);
});

test('mid-swipe the words of the days follow the finger: visible, with no staggered rise', () => {
  const css = read('css/first.css');
  assert.match(js, /classList\.add\('wk-follow'\)/);
  assert.match(css, /#first \.fc-weekend \.wk-follow \.wk-rise \{[^}]*opacity: 1;[^}]*transform: none;[^}]*transition: none/);
});

test('index.html loads weekend-card before cards', () => {
  const html = read('index.html');
  assert.match(html, /\["core", "food-core", "words", "store", "sound", "fx", "minute", "reply", "home", "travel-core", "travel-map", "travel-card", "weekend-card", "food-card", "cards", "app"\]/);
  assert.match(html, /data-first-enabled="false"/);
});

test('the weekend styles sit before the last reduced-motion block, which switches the movement off', () => {
  const css = read('css/first.css');
  const last = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  const section = css.indexOf('/* ==== The Weekend');
  assert.ok(section > 0 && section < last, 'the weekend section is before the last reduced-motion block');
  const tail = css.slice(last);
  assert.match(tail, /#first \.fc-weekend \.wk-air \{[^}]*display: none/);
  assert.match(tail, /#first \.fc-weekend \.wk-pic[^{]*\{[^}]*animation: none/);
  assert.match(tail, /#first \.fc-weekend \.wk-band[^{]*\{[^}]*animation: none/);
  assert.match(tail, /#first \.fc-weekend \.wk-day[^{]*\{[^}]*transition: none/);
  assert.doesNotMatch(css, /\.fc-wear/);
});

test('while a day is open the close control says it steps back to the four days; at the tiles it is the frame\'s again', () => {
  const openDay = js.slice(js.indexOf('function openDay('), js.indexOf('function closeDay('));
  const closeDay = js.slice(js.indexOf('function closeDay('), js.indexOf('card.beforeClose('));
  assert.match(openDay, /card\.closeLabel\(v\.back\)/);
  assert.match(closeDay, /card\.closeLabel\(\)/);
  assert.doesNotMatch(js, /fc-close/, 'the Weekend card never reaches into the frame for its close control');
});

test('a day change moves focus to the new day\'s heading when focus was on the old page or nowhere', () => {
  const go = js.slice(js.indexOf('function go('), js.indexOf('function clipTo('));
  assert.match(go, /document\.activeElement/);
  assert.match(go, /focus\(pages\[idx\]\.head\)/);
});

test('a finger swipe reaches the code: the day page lets sideways pans through, and only one pointer drives a drag', () => {
  const css = read('css/first.css');
  assert.match(css, /#first \.fc-weekend \.wk-page \{[^}]*touch-action: pan-y/);
  assert.match(js, /e\.isPrimary/);
  assert.match(js, /e\.pointerId !== drag\.id/);
});

test('the swipe hint never shows on the last day, and stops short of the close control', () => {
  const css = read('css/first.css');
  assert.match(js, /swipe\.classList\.toggle\('wk-gone', moved \|\| idx === count - 1\)/);
  assert.match(css, /#first \.fc-weekend \.wk-swipe \{[^}]*right: /);
});

test('a second day change inside the band\'s time clears the first band timer', () => {
  const go = js.slice(js.indexOf('function go('), js.indexOf('function clipTo('));
  assert.match(go, /clearTimeout\(bandT\)/);
});

test('wanted: the open day first, then the days either side, never past the ends', () => {
  assert.deepEqual(wk.wanted(0, 4), [0, 1]);
  assert.deepEqual(wk.wanted(1, 4), [1, 0, 2]);
  assert.deepEqual(wk.wanted(2, 4), [2, 1, 3]);
  assert.deepEqual(wk.wanted(3, 4), [3, 2]);
  assert.deepEqual(wk.wanted(0, 1), [0]);
  assert.deepEqual(wk.wanted(9, 4), [3, 2]);
});

test('the day picture offers both files by width and says how wide its layer is; the tile picture offers one', () => {
  const set = wk.pictureFiles('sat');
  assert.equal(set.src, 'images/first/sat.webp');
  assert.equal(set.srcset, 'images/first/sat.webp 720w, images/first/sat-lg.webp 1024w');
  assert.equal(set.sizes, '116vw');   // .wk-pic is the day's width plus 8% off each side
  assert.match(js, /fc-day-img', d\.img\)/, 'tiles ask for the one small picture');
  assert.equal((js.match(/\.srcset = /g) || []).length, 1, 'only the day picture sets a srcset');
  assert.match(js, /wk-pic-img', d\.img, true\)/);
});

test('day pictures are fetched only when wanted: on opening a day or moving to one, and its neighbours', () => {
  const body = name => js.slice(js.indexOf('function ' + name + '('));
  assert.match(body('openDay').split('function closeDay(')[0], /want\(idx\)/);
  assert.match(body('go').split('function clipTo(')[0], /want\(idx\)/);
  assert.match(js, /\.decoding = 'async'/);
});

test('the lights canvas is sized again on resize and rotate, and the listeners go when the card closes', () => {
  assert.match(js, /root\.addEventListener\('resize', onResize\)/);
  assert.match(js, /root\.addEventListener\('orientationchange', onResize\)/);
  assert.match(js, /root\.removeEventListener\('resize', onResize\)/);
  assert.match(js, /root\.removeEventListener\('orientationchange', onResize\)/);
  assert.match(js, /lights\.refit\(\)/);
});

test('a new primary pointerdown replaces a drag whose pointer is gone', () => {
  assert.match(js, /function endLostDrag\(\)/);
  assert.ok(!/\(drag && drag\.on\)/.test(js), 'a live drag no longer blocks a new primary pointerdown');
  assert.match(js, /!e\.isPrimary/);
});
