const test = require('node:test');
const assert = require('node:assert/strict');
const { words } = require('../js/first/words.js');
const wk = require('../js/first/weekend-card.js');

const withDay = (w, i, patch) => ({
  ...w, weekend: { ...w.weekend, days: w.weekend.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }
});

test('weekendView: four days in order, each with its picture key, intro and parts', () => {
  const v = wk.weekendView(words);
  assert.deepEqual(v.days.map(d => d.key), ['fri', 'sat', 'sun', 'mon']);
  assert.deepEqual(v.days.map(d => d.img), ['fri', 'sat', 'sun', 'mon']);
  for (const d of v.days) {
    assert.ok(d.intro && d.parts.length >= 1 && d.parts.length <= 3);
    for (const p of d.parts) assert.ok(p.when && p.what);
  }
  assert.equal(v.title, words.weekend.title);
  for (const k of ['vibe', 'hint', 'swipe', 'back', 'open']) assert.equal(v[k], words.weekend[k], k);
});

test('weekendView: a row appears only when the day has that line', () => {
  const v = wk.weekendView(words);
  assert.deepEqual(v.days[1].rows.map(r => r.kind), ['wear']);
  assert.deepEqual(v.days[1].rows[0].tags, ['Shoes for gravel and grass', 'A layer for after dark']);
  assert.deepEqual(v.days[3].rows.map(r => r.kind), ['food']);
  assert.deepEqual(v.days[0].rows.find(r => r.kind === 'food').tags, []);
  const full = wk.weekendView(withDay(words, 0, { where: 'On the terrace' }));
  assert.deepEqual(full.days[0].rows.map(r => r.kind), ['wear', 'food', 'where']);
  assert.deepEqual(full.days[0].rows.map(r => r.label), ['Wear', 'Food and drink', 'Where']);
});

test('weekendView: missing, empty or wrong-shaped pieces never throw and never leave an empty row', () => {
  const odd = withDay(words, 0, { wear: '', bring: 'x', parts: null, food: 7, where: '   ' });
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

test('weekendView: no clock times, and food lines do not say who pays', () => {
  const all = JSON.stringify(wk.weekendView(words));
  assert.doesNotMatch(all, /\b\d{1,2}[:.]\d\d\b|\b\d{1,2} ?(am|pm)\b/i);
  for (const d of wk.weekendView(words).days) for (const r of d.rows.filter(x => x.kind === 'food')) assert.doesNotMatch(r.text, /on us|covered|included|free/i);
});

test('nothing from the old Wear card is lost', () => {
  const text = JSON.stringify(wk.weekendView(words));
  for (const s of ['Come as you are', 'ties optional', 'Swimwear', 'gravel and grass', 'after dark']) assert.ok(text.includes(s), s);
});
