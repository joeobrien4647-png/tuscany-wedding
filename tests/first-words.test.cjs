const test = require('node:test');
const assert = require('node:assert/strict');
const { copyProblems, LOCKS } = require('../js/first/core.js');
const { words } = require('../js/first/words.js');

function leaves(node, path = 'words') {
  if (typeof node === 'string') return [[path, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, path + '.' + k));
}

test('copyProblems flags the four rules', () => {
  assert.deepEqual(copyProblems('Fine line'), []);
  assert.deepEqual(copyProblems('a ' + String.fromCharCode(0x2014) + ' b'), ['em dash']);
  assert.deepEqual(copyProblems('a ' + String.fromCharCode(0xb7) + ' b'), ['middle dot']);
  assert.deepEqual(copyProblems('Ends here.'), ['trailing full stop']);
  assert.deepEqual(copyProblems('Our story'), ['sentimental']);
});

test('every word passes the copy rules, with no amount or stray placeholder', () => {
  const all = leaves(words);
  assert.ok(all.length > 50);
  for (const [path, s] of all) {
    assert.deepEqual(copyProblems(s), [], path);
    assert.ok(!s.includes('£') && !s.includes('150'), path + ' has an amount');
    assert.ok(s.trim() === s && s.length > 0, path + ' is empty or padded');
    for (const m of s.match(/\{[^}]*\}/g) || []) assert.ok(['{n}', '{names}', '{date}', '{share}', '{from}', '{to}', '{drive}', '{km}', '{price}'].includes(m), path + ' uses ' + m);
  }
});

test('required sections exist', () => {
  for (const k of ['cover', 'minute', 'ask', 'yes', 'no', 'closed', 'nolink', 'home', 'dock', 'stay', 'travel', 'wear', 'weekend', 'questions', 'errors'])
    assert.ok(words[k] && typeof words[k] === 'object', k);
});

test('weekend days, dock labels and stay dock states', () => {
  assert.deepEqual(words.weekend.days.map(d => d.name), ['Pizza night', 'The wedding', 'Pool day & BBQ', 'Breakfast and goodbyes']);
  assert.deepEqual(words.weekend.days.map(d => d.date), ['Fri 28 May', 'Sat 29 May', 'Sun 30 May', 'Mon 31 May']);
  for (const d of words.weekend.days) assert.ok(d.line);
  assert.deepEqual(words.dock.labels, ['Reply', 'Stay', 'Travel', 'Wear', 'Weekend']);
  assert.deepEqual(words.dock.stay, { plain: 'Stay', choose: 'Choose stay', villa: 'La Conca', own: 'Own place' });
});

test('keys later screens read', () => {
  assert.ok(words.stay.share.includes('{share}'));
  assert.ok(words.home.opens.includes('{date}'));
  for (const p of ['stay.spring', 'stay.word', 'stay.fixed', 'errors.save', 'questions.bring.a'])
    assert.ok(p.split('.').reduce((o, k) => o && o[k], words), p);
});

test('envelopes are keyed by lock key and hold only a name', () => {
  assert.deepEqual(Object.keys(words.home.envelopes), LOCKS.map(l => l.key));
  for (const e of Object.values(words.home.envelopes)) assert.deepEqual(Object.keys(e), ['name']);
  assert.equal(words.home.photosStamp, 'June');
});

test('the Getting there card has every line it reads, and the old three rows are gone', () => {
  const need = {
    fields: ['from', 'to', 'last', 'days', 'choose'],
    from: ['title', 'hint', 'airports', 'or', 'compare', 'compareOne'],
    'from.groups': ['london', 'northwest', 'yorkshire', 'midlands', 'scotland', 'southwest', 'ni'],
    'from.kinds': ['ABROAD', 'ITALY', 'ROAD', 'TRAIN'],
    route: ['title', 'landing', 'again', 'usually', 'drive', 'change', 'changeFrom', 'other', 'otherHint', 'otherDone', 'notFlying', 'noDirect', 'check'],
    'route.sorts': ['drive', 'airport', 'price'],
    last: ['title', 'fact', 'liftNote'],
    'last.options': ['hire', 'lift', 'taxi', 'public', 'own'],
    days: ['title', 'arriving', 'leaving'],
    'days.arrive': ['early', 'thu', 'fri', 'sat'],
    'days.leave': ['sun', 'mon', 'later'],
    done: ['title', 'hint', 'stamp', 'needReply', 'saving', 'failed', 'retry'],
    stamped: ['title', 'hint', 'change', 'another', 'who', 'next', 'remove', 'ticket'],
    price: ['from', 'checked', 'live'],
    load: ['wait', 'failed', 'retry'],
    summary: ['empty', 'comparing', 'comparingOne', 'trip', 'landing', 'road', 'train', 'italy']
  };
  const at = p => p.split('.').reduce((o, k) => o && o[k], words.travel);
  for (const [group, keys] of Object.entries(need)) for (const k of keys) assert.equal(typeof at(group)[k], 'string', group + '.' + k);
  for (const k of ['title', 'stampMark', 'mapLabel', 'back']) assert.equal(typeof words.travel[k], 'string', k);
  assert.equal(words.travel.rows, undefined);
  assert.equal(words.travel.longer, undefined);
  assert.ok(words.travel.from.compare.includes('{n}'));
  assert.ok(words.travel.price.from.includes('{price}') && words.travel.price.checked.includes('{date}'));
  assert.ok(words.travel.last.fact.includes('{drive}') && words.travel.last.fact.includes('{km}'));
  assert.ok(words.travel.summary.trip.includes('{from}') && words.travel.summary.trip.includes('{to}'));
});
test('the Getting there words never promise a transfer and say routes can change', () => {
  const all = leaves(words.travel).map(([, s]) => s).join(' | ');
  assert.doesNotMatch(all, /transfer|minibus|shuttle|we.ll (collect|pick)/i);
  assert.match(words.travel.route.usually, /usually/i);
  assert.match(words.travel.route.check, /check before you book/i);
});
