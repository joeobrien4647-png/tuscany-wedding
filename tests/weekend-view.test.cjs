const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { words } = require('../js/first/words.js');
const wk = require('../js/first/weekend-card.js');

const withDay = (w, i, patch) => ({
  ...w, weekend: { ...w.weekend, days: w.weekend.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }
});

// Invented words made here, so the rules below never depend on which lines the shipped placeholder days happen to have.
const FIXTURE = {
  weekend: {
    title: 'Test weekend', vibe: 'A test line', hint: 'Tap one', swipe: 'Swipe on', back: 'Back to the days', open: 'Open it',
    labels: { wear: 'Wear', food: 'Food and drink', where: 'Where' },
    days: [
      { date: 'Day one', name: 'First', intro: 'One', parts: [{ when: 'Evening', what: 'Supper' }], wear: 'Anything', food: 'Soup' },
      { date: 'Day two', name: 'Second', intro: 'Two', parts: [{ when: 'Afternoon', what: 'Walk' }], wear: 'Boots', bring: ['A hat', 'A coat'] },
      { date: 'Day three', name: 'Third', intro: 'Three', parts: [{ when: 'All day', what: 'Swim' }], where: 'By the pool' },
      { date: 'Day four', name: 'Fourth', intro: 'Four', parts: [{ when: 'Morning', what: 'Coffee' }], food: 'Toast' }
    ]
  }
};

test('weekendView: four days in order, each with its picture key, intro and parts', () => {
  const v = wk.weekendView(words);
  assert.deepEqual(v.days.map(d => d.key), ['fri', 'sat', 'sun', 'mon']);
  assert.deepEqual(v.days.map(d => d.img), ['fri', 'sat', 'sun', 'mon']);
  for (const d of v.days) {
    assert.ok(d.intro && d.parts.length >= 1 && d.parts.length <= 3);
    for (const p of d.parts) assert.ok(p.what);
  }
  assert.equal(v.title, words.weekend.title);
  for (const k of ['vibe', 'hint', 'swipe', 'back', 'open']) assert.equal(v[k], words.weekend[k], k);
});

test('weekendView: a row appears only when the day has that line', () => {
  const v = wk.weekendView(FIXTURE);
  assert.deepEqual(v.days.map(d => d.rows.map(r => r.kind)), [['wear', 'food'], ['wear'], ['where'], ['food']]);
  assert.deepEqual(v.days[1].rows[0].tags, ['A hat', 'A coat']);
  assert.deepEqual(v.days[0].rows.find(r => r.kind === 'food').tags, []);
  const full = wk.weekendView(withDay(FIXTURE, 0, { where: 'On the terrace' }));
  assert.deepEqual(full.days[0].rows.map(r => r.kind), ['wear', 'food', 'where']);
  assert.deepEqual(full.days[0].rows.map(r => r.label), ['Wear', 'Food and drink', 'Where']);
});

test('weekendView: a line with no part-of-day tag is kept; a line with no words is not', () => {
  const v = wk.weekendView(withDay(FIXTURE, 0, { parts: [{ what: 'Arrive' }, { when: '  ', what: 'Settle in' }, { when: 'Evening' }, { when: 'Late', what: 'Dance' }] }));
  assert.deepEqual(v.days[0].parts, [{ when: '', what: 'Arrive' }, { when: '', what: 'Settle in' }, { when: 'Late', what: 'Dance' }]);
});

test('the day page draws a part-of-day tag only when the line has one', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'first', 'weekend-card.js'), 'utf8');
  assert.match(js, /if \(p\.when\) li\.appendChild\(el\('span', 'wk-when', p\.when\)\);/);
});

test('weekendView: at most three parts a day, a fourth is not shown', () => {
  const four = [1, 2, 3, 4].map(n => ({ when: 'Part ' + n, what: 'Line ' + n }));
  assert.deepEqual(wk.weekendView(withDay(FIXTURE, 2, { parts: four })).days[2].parts.map(p => p.what), ['Line 1', 'Line 2', 'Line 3']);
});

test('weekendView: missing, empty or wrong-shaped pieces never throw and never leave an empty row', () => {
  const odd = withDay(FIXTURE, 0, { wear: '', bring: 'x', parts: null, food: 7, where: '   ' });
  const v = wk.weekendView(withDay(odd, 1, { parts: [{ when: 'Evening' }], bring: [3, '', ' Hat '], wear: 'Dress' }));
  assert.deepEqual(v.days[0].rows, []);
  assert.deepEqual(v.days[0].parts, []);
  assert.deepEqual(v.days[1].parts, []);
  assert.deepEqual(v.days[1].rows[0].tags, ['Hat']);
  for (const bad of [null, undefined, {}, { weekend: null }, { weekend: { days: 'x' } }, { weekend: { days: [null, 4, {}] } }]) {
    const out = wk.weekendView(bad);
    assert.ok(Array.isArray(out.days));
    for (const d of out.days) for (const r of d.rows) assert.ok(r.text);
  }
});

test('the shipped weekend words keep to the rules: no clock times, food lines do not say who pays, no dashes', () => {
  const all = JSON.stringify(wk.weekendView(words));
  assert.doesNotMatch(all, /\b\d{1,2}[:.]\d\d\b|\b\d{1,2} ?(am|pm)\b/i);
  assert.doesNotMatch(all, new RegExp('[\\u2014\\u00b7]'));
  for (const d of wk.weekendView(words).days) for (const r of d.rows.filter(x => x.kind === 'food')) assert.doesNotMatch(r.text, /on us|covered|included|free/i);
});

test('the shipped weekend words have every part kept: none is dropped by the view', () => {
  const v = wk.weekendView(words);
  words.weekend.days.forEach((d, i) => assert.equal(v.days[i].parts.length, Math.min(3, d.parts.length), d.name));
});

// Pins placeholder phrases on purpose (listed in docs/first-minute-go-live.md): update it when the real Wear lines go in.
test('nothing from the old Wear card is lost', () => {
  const text = JSON.stringify(wk.weekendView(words));
  for (const s of ['Come as you are', 'ties optional', 'Swimwear', 'gravel and grass', 'after dark']) assert.ok(text.includes(s), s);
});

test('weekendView: a day with no name is left out, the others keep their own picture key', () => {
  const v = wk.weekendView(withDay(FIXTURE, 1, { name: '   ' }));
  assert.deepEqual(v.days.map(d => d.key), ['fri', 'sun', 'mon']);
  assert.deepEqual(v.days.map(d => d.img), ['fri', 'sun', 'mon']);
  assert.deepEqual(wk.weekendView(withDay(FIXTURE, 0, { name: undefined })).days.map(d => d.key), ['sat', 'sun', 'mon']);
});

test('dayLabel: built from the parts that exist, never a stray comma', () => {
  assert.equal(wk.dayLabel({ date: 'Friday 28 May', name: 'Arrivals' }), 'Friday 28 May, Arrivals');
  assert.equal(wk.dayLabel({ date: '', name: 'Arrivals' }), 'Arrivals');
  assert.equal(wk.dayLabel({ date: 'Friday 28 May', name: '' }), 'Friday 28 May');
  assert.equal(wk.dayLabel({ date: 'Friday 28 May', name: 'Arrivals' }, 'Open it'), 'Friday 28 May, Arrivals, Open it');
  assert.equal(wk.dayLabel({ date: '', name: 'Arrivals' }, 'Open it'), 'Arrivals, Open it');
  assert.equal(wk.dayLabel({ date: '', name: 'Arrivals' }, ''), 'Arrivals');
});

test('pictureFallback: a day picture that used srcset retries the small file once, nothing else retries', () => {
  assert.equal(wk.pictureFallback('sat', true), 'images/first/sat.webp');
  assert.equal(wk.pictureFallback('sat', false), null);
});
