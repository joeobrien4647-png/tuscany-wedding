const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// Task 9: the four information cards (Travel, Wear, Weekend, Questions).
const cards = () => require('../js/first/cards.js');
const ONE = { token: 'tCardsOne000001aa', display: 'Robin Ash', people: ['Robin Ash'] };
const TWO = { token: 'tCardsTwo000002bb', display: 'Kit and Sam', people: ['Kit Moss', 'Sam Lee'] };
const allText = o => JSON.stringify(o);
const DASHES = new RegExp('[\\u2014\\u00b7]');

test('travel: exactly the three rows from the design, and no staying-longer list (the published site has none)', () => {
  const v = cards().travelView(words);
  assert.deepEqual(v.rows, [
    { k: 'Fly to', v: 'Pisa' },
    { k: 'Then', v: 'Hire a car, about 2h15' },
    { k: 'Stuck for a lift', v: 'Message Joe or Sophie' }
  ]);
  assert.equal(v.longer, undefined);
  assert.equal(words.travel.longer, undefined);
  assert.equal(words.travel.longerTitle, undefined);
  assert.doesNotMatch(allText(v), /airline|flight time|\b\d{1,2}:\d\d\b|£/i);
});

test('wear: the five lines in order, Saturday, shoes, layer, Friday, Sunday, and nothing else', () => {
  const v = cards().wearView(words);
  assert.deepEqual(v.lines, [
    { k: 'Saturday', v: 'Dressed up for a warm evening outdoors, ties optional, colour encouraged' },
    { k: null, v: 'Shoes that cope with gravel and grass' },
    { k: null, v: 'A layer for after dark' },
    { k: 'Friday', v: 'Come as you are' },
    { k: 'Sunday', v: 'Swimwear and BBQ clothes' }
  ]);
});

test('weekend: four day cards in order with date, name, line and image, and no times', () => {
  const v = cards().weekendView(words);
  assert.deepEqual(v.days.map(d => d.date), ['Fri 28 May', 'Sat 29 May', 'Sun 30 May', 'Mon 31 May']);
  assert.deepEqual(v.days.map(d => d.img), ['fri', 'sat', 'sun', 'mon']);
  v.days.forEach((d, i) => {
    assert.equal(d.name, words.weekend.days[i].name);
    assert.equal(d.line, words.weekend.days[i].line);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'images', 'first', d.img + '.webp')), d.img);
  });
  assert.doesNotMatch(allText(v.days.map(d => [d.name, d.line])), /\b\d{1,2}[:.]\d\d\b|\b\d{1,2} ?(am|pm)\b/i);
});

test('questions: gifts, reaching Joe and Sophie, and bringing someone only for a single-name invitation', () => {
  const c = cards();
  assert.deepEqual(c.questionsView(ONE, words).map(e => e.key), ['gifts', 'reach', 'bring']);
  assert.deepEqual(c.questionsView(TWO, words).map(e => e.key), ['gifts', 'reach']);
  for (const bad of [null, undefined, {}, { people: [] }, { people: 'Robin' }])
    assert.deepEqual(c.questionsView(bad, words).map(e => e.key), ['gifts', 'reach'], JSON.stringify(bad));
  const e = c.questionsView(ONE, words);
  assert.equal(e[2].q, words.questions.bring.q);
  assert.equal(e[2].a, words.questions.bring.a);
  assert.match(e[2].a, /ask Joe or Sophie directly/);
});

test('questions: nothing invents a gift policy, a channel or a time', () => {
  const q = JSON.stringify(words.questions);
  assert.doesNotMatch(q, /whatsapp|email|phone|registry|cash|money|voucher|nothing needed/i);
  assert.match(words.questions.reach.a, /Message Joe or Sophie/);
  assert.match(words.questions.gifts.a, /follow/);
});

test('questions: one entry open at a time, and opening one closes the others', () => {
  const js = read('js/first/cards.js');
  const q = js.slice(js.indexOf('CARDS.questions'));
  assert.match(q, /aria-expanded/);
  const toggle = q.match(/function toggle\(([^)]*)\) \{([\s\S]*?)\n {6}\}/);
  assert.ok(toggle, 'a toggle function');
  assert.match(toggle[2], /openKey = /);
  assert.match(toggle[2], /=== openKey/);
});

test('the four cards have no form field; Weekend images are lazy and decorative; text goes through textContent', () => {
  const js = read('js/first/cards.js');
  const part = js.slice(js.indexOf('// ---------- the Travel card'), js.lastIndexOf('const api = {'));
  assert.ok(part.length > 500, 'the four cards are in cards.js');
  assert.doesNotMatch(part, /el\('(input|textarea|select|form)'|createElement\('(input|textarea|select|form)'|<input|<textarea|<select|<form/);
  assert.match(part, /loading = 'lazy'/);
  assert.match(part, /alt = ''/);
  assert.doesNotMatch(part, /innerHTML/);
});

test('the four cards are styled under their own keys; no dvh or svh; no dashes, amounts or console', () => {
  const css = read('css/first.css');
  for (const k of ['travel', 'wear', 'weekend', 'questions']) assert.match(css, new RegExp('#first \\.fc-' + k + ' '), k);
  assert.doesNotMatch(css, /dvh|svh/);
  assert.doesNotMatch(read('js/first/cards.js') + read('js/first/words.js'), DASHES);
  assert.doesNotMatch(read('js/first/cards.js'), /\b150\b|console\./);
  assert.match(read('css/first.css').slice(read('css/first.css').lastIndexOf('prefers-reduced-motion')), /fc-q|fc-day/);
});
