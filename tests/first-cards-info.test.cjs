const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// Task 9: the four information cards (Travel, Weekend, Questions).
const cards = () => require('../js/first/cards.js');
const ONE = { token: 'tCardsOne000001aa', display: 'Robin Ash', people: ['Robin Ash'] };
const TWO = { token: 'tCardsTwo000002bb', display: 'Kit and Sam', people: ['Kit Moss', 'Sam Lee'] };
const allText = o => JSON.stringify(o);
const YES_ONE = { reply: { answer: 'yes', coming: [true] } };
const YES_TWO = { reply: { answer: 'yes', coming: [true, true] } };
const DASHES = new RegExp('[\\u2014\\u00b7]');

test('travel: no staying-longer list (the published site has none) and no times or amounts in its words', () => {
  assert.equal(words.travel.longer, undefined);
  assert.equal(words.travel.longerTitle, undefined);
  assert.doesNotMatch(allText(words.travel), /flight time|\b\d{1,2}:\d\d\b|£/i);
});

test('questions: six in order for one person, five for a couple, and bringing someone is always last', () => {
  const c = cards();
  assert.deepEqual(c.questionsView(ONE, YES_ONE, words).map(e => e.key), ['gifts', 'reach', 'food', 'cost', 'weather', 'bring']);
  assert.deepEqual(c.questionsView(TWO, YES_TWO, words).map(e => e.key), ['gifts', 'reach', 'food', 'cost', 'weather']);
  for (const bad of [null, undefined, {}, { people: [] }, { people: 'Robin' }])
    assert.deepEqual(c.questionsView(bad, null, words).map(e => e.key), ['gifts', 'reach', 'food', 'cost', 'weather'], JSON.stringify(bad));
  const e = c.questionsView(ONE, YES_ONE, words);
  assert.equal(e[5].q, words.questions.bring.q);
  assert.deepEqual(e[5].lines, [].concat(words.questions.bring.a));
  assert.match(e[5].lines.join(' '), /ask Joe or Sophie directly/);
});

test('questions: the cost answer shows the share through shareLine and never a bank detail or a date', () => {
  const c = cards();
  const cost = c.questionsView(TWO, YES_TWO, words).find(e => e.key === 'cost');
  assert.ok(cost.lines.some(l => l.includes('\u00a3150 each')));
  assert.ok(!cost.lines.join(' ').includes('{share}'));
  assert.doesNotMatch(cost.lines.join(' '), /sort code|account|iban|transfer|\b\d{1,2} (jan|feb|mar|apr|may)/i);
  assert.ok(!JSON.stringify(words.questions).includes('\u00a3'));
  const one = c.questionsView(ONE, YES_ONE, words).find(e => e.key === 'cost');
  assert.ok(one.lines.some(l => l.includes('\u00a3150') && !l.includes('each')));
});

test('questions: every answer keeps to three lines of 44 characters', () => {
  for (const e of cards().questionsView(ONE, YES_ONE, words)) {
    assert.ok(e.lines.length >= 1 && e.lines.length <= 3, e.key);
    for (const l of e.lines) assert.ok(l.length <= 44, e.key + ': ' + l);
  }
});

test('questions: nothing invents a gift policy, a channel or a time', () => {
  const q = JSON.stringify(words.questions);
  assert.doesNotMatch(q, /whatsapp|email|phone|registry|cash|money|voucher|nothing needed/i);
  assert.match([].concat(words.questions.reach.a).join(' '), /Message Joe or Sophie/);
  assert.match(words.questions.gifts.a, /follow/);
  assert.match([].concat(words.questions.food.a).join(' '), /Message Joe or Sophie/);
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

test('the four cards have no form field; text goes through textContent', () => {
  const js = read('js/first/cards.js');
  const part = js.slice(js.indexOf('// ---------- the Travel card'), js.lastIndexOf('const api = {'));
  assert.ok(part.length > 500, 'the four cards are in cards.js');
  assert.doesNotMatch(part, /el\('(input|textarea|select|form)'|createElement\('(input|textarea|select|form)'|<input|<textarea|<select|<form/);
  assert.doesNotMatch(part, /innerHTML/);
});

test('the four cards are styled under their own keys; no dvh or svh; no dashes, amounts or console', () => {
  const css = read('css/first.css');
  for (const k of ['travel', 'weekend', 'questions']) assert.match(css, new RegExp('#first \\.fc-' + k + ' '), k);
  assert.doesNotMatch(css, /dvh|svh/);
  assert.doesNotMatch(read('js/first/cards.js') + read('js/first/words.js'), DASHES);
  assert.doesNotMatch(read('js/first/cards.js'), /\b150\b|console\./);
  assert.match(read('css/first.css').slice(read('css/first.css').lastIndexOf('prefers-reduced-motion')), /fc-q|fc-day/);
});
