// What the Getting there ticket shows: the four boxes, the one-line summary, the sourced facts, and who a ticket is for.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const t = require('../js/first/travel-core.js');
const { words: W } = require('../js/first/words.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'getting-there.json'), 'utf8'));
const walk = changes => changes.reduce((p, c) => t.choose(p, c), t.newPlan());
const DAYS = [{ arrive: 'fri' }, { leave: 'mon' }];
const PATHS = [
  [{ froms: ['MAN', 'LHR'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }, { last: 'hire' }],
  [{ froms: ['EDI'] }, { route: { from: 'EDI', to: 'PEG', via: 'change' } }, { last: 'taxi' }],
  [{ froms: ['MAN', 'LPL'] }, { route: { from: 'LPL', to: 'OTHER' } }, { toText: 'Ancona' }, { last: 'lift' }],
  [{ kind: 'ABROAD' }, { route: { to: 'FCO' } }, { last: 'public' }],
  [{ kind: 'ABROAD' }, { route: { to: 'OTHER' } }, { toText: 'Rimini' }, { last: 'hire' }],
  [{ kind: 'ITALY' }, { route: { to: 'FLR' } }, { last: 'hire' }],
  [{ kind: 'ITALY' }, { route: { to: 'NONE' } }, { last: 'own' }],
  [{ kind: 'ROAD' }],
  [{ kind: 'TRAIN' }, { last: 'lift' }]
].map(p => p.concat(DAYS));

test('fields: an empty plan has four empty boxes', () => {
  assert.deepEqual(t.fields(t.newPlan(), data, W), { from: null, to: null, last: null, days: null });
});
test('fields: comparing shows the first airport and how many more', () => {
  assert.deepEqual(t.fields(walk([{ froms: ['MAN'] }]), data, W).from, { v: 'MAN', s: 'Manchester' });
  assert.deepEqual(t.fields(walk([{ froms: ['MAN', 'LHR', 'LGW'] }]), data, W).from, { v: 'MAN +2', s: '' });
});
test('fields: a chosen route fills From and To with the code and the name from the data', () => {
  const f = t.fields(walk(PATHS[0]), data, W);
  assert.deepEqual(f.from, { v: 'MAN', s: 'Manchester' });
  assert.deepEqual(f.to, { v: 'PSA', s: 'Pisa' });
  assert.deepEqual(f.last, { v: W.travel.last.options.hire, s: '' });
  assert.deepEqual(f.days, { v: 'Fri 28 to Mon 31', s: '' });
});
test('fields: every other way of setting off reads sensibly', () => {
  assert.deepEqual(t.fields(walk(PATHS[2]), data, W).to, { v: 'Ancona', s: '' });
  assert.equal(t.fields(walk(PATHS[3]), data, W).from.v, W.travel.from.kinds.ABROAD);
  assert.equal(t.fields(walk(PATHS[6]), data, W).to.v, W.travel.route.notFlying);
  const road = t.fields(walk(PATHS[7]), data, W);
  assert.equal(road.from.v, W.travel.from.kinds.ROAD);
  assert.equal(road.to.v, W.minute.estate);
  assert.equal(road.last.v, W.travel.last.options.own);
  assert.equal(t.fields(walk([{ kind: 'TRAIN' }]), data, W).to.v, W.minute.estate);
  assert.equal(t.fields(walk([{ kind: 'ROAD' }, { arrive: 'thu' }]), data, W).days.v, 'Thu 27');
  assert.equal(t.fields(walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'OTHER' } }]), data, W).to, null);
});
test('fields: an airport the data does not know still shows its code and never throws', () => {
  const p = walk([{ froms: ['ZZZ'] }, { route: { from: 'ZZZ', to: 'QQQ', via: 'change' } }]);
  assert.deepEqual(t.fields(p, data, W).from, { v: 'ZZZ', s: '' });
  assert.deepEqual(t.fields(p, data, W).to, { v: 'QQQ', s: '' });
  assert.doesNotThrow(() => t.fields(p, null, W));
  assert.doesNotThrow(() => t.summary(p, null, W));
});
test('summary: one line for where the plan has got to', () => {
  const s = steps => t.summary(walk(steps), data, W);
  assert.equal(s([]), W.travel.summary.empty);
  assert.equal(s([{ froms: ['MAN'] }]), 'Flying from Manchester');
  assert.equal(s([{ froms: ['MAN', 'LHR'] }]), 'Comparing 2 airports');
  assert.equal(s(PATHS[0]), 'Manchester to Pisa, about 2 hr 30 min drive');
  assert.equal(s(PATHS[2]), 'Liverpool to Ancona');
  assert.equal(s(PATHS[3]), 'Landing at Rome Fiumicino, about 3 hr 15 min drive');
  assert.equal(s(PATHS[4]), 'Landing at Rimini');
  assert.equal(s([{ kind: 'ABROAD' }]), W.travel.from.kinds.ABROAD);
  assert.equal(s(PATHS[6]), W.travel.summary.italy);
  assert.equal(s(PATHS[7]), W.travel.summary.road);
  assert.equal(s(PATHS[8]), W.travel.summary.train);
});
test('lastFacts: the drive, distance and tolls for the landing airport, and its public transport line', () => {
  assert.deepEqual(t.lastFacts(walk(PATHS[0]), data, W), [
    'By road: about 2 hr 30 min, 197 km',
    'Tolls on the A1 from Florence to Arezzo (about 72 km); the FI-PI-LI is free',
    W.travel.last.options.public + ': Pisa Mover to Pisa Centrale, trains via Florence to Arezzo, then a bus or taxi'
  ]);
  for (const i of [2, 6, 7, 8]) assert.deepEqual(t.lastFacts(walk(PATHS[i]), data, W), [], 'nothing sourced for path ' + i);
  assert.deepEqual(t.lastFacts(walk(PATHS[0]), null, W), []);
});
test('planOf turns a stamped ticket back into the plan that made it', () => {
  for (const steps of PATHS) {
    const ticket = t.ticketOf(walk(steps));
    const back = t.planOf(ticket);
    assert.deepEqual(t.ticketOf(back), ticket, JSON.stringify(steps));
    assert.deepEqual(t.cleanPlan(back), back);
  }
  assert.deepEqual(t.planOf({ from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' }).froms, ['MAN']);
  assert.equal(t.planOf(null), null);
  assert.equal(t.planOf({ from: 'MAN', last: 'bike' }), null);
});
test('comingPeople: the people coming, by position on the invitation', () => {
  const invite = { people: ['Robin Ash', 'Kit Moss', 'Sam Lee'] };
  assert.deepEqual(t.comingPeople(invite, { reply: { answer: 'yes', coming: [true, false, true] } }), [{ i: 0, name: 'Robin Ash' }, { i: 2, name: 'Sam Lee' }]);
  assert.deepEqual(t.comingPeople(invite, { reply: { answer: 'no', coming: [false, false, false] } }), []);
  assert.deepEqual(t.comingPeople(invite, null), []);
  assert.deepEqual(t.comingPeople(null, { reply: { answer: 'yes', coming: [true] } }), []);
});
test('whoList: a list as long as the invitation, true for the people picked', () => {
  assert.deepEqual(t.whoList(3, [2]), [false, false, true]);
  assert.deepEqual(t.whoList(2, [0, 1, 5]), [true, true]);
  assert.deepEqual(t.whoList(0, [0]), []);
});

// The ticket's boxes and its two-line summary have fixed room on a 375 px phone.
test('summary leaves the drive off when the line would not fit in two lines', () => {
  const s = steps => t.summary(walk(steps), data, W);
  assert.equal(s([{ froms: ['BFS'] }, { route: { from: 'BFS', to: 'FCO', via: 'direct' } }]), 'Belfast International to Rome Fiumicino');
  assert.equal(s([{ froms: ['LHR'] }, { route: { from: 'LHR', to: 'PSA', via: 'direct' } }]), 'London Heathrow to Pisa, about 2 hr 30 min drive');
  for (const from of Object.keys(data.ukAirports)) for (const a of data.airports) {
    const line = s([{ froms: [from] }, { route: { from, to: a.code, via: 'change' } }]);
    assert.ok(line.length <= t.SUMMARY_MAX, line);
  }
});
test('fields: the small name beside a code is left off when the two would not fit the box', () => {
  assert.deepEqual(t.fields(walk([{ froms: ['PIK'] }]), data, W).from, { v: 'PIK', s: '' });
  assert.deepEqual(t.fields(walk([{ froms: ['BFS'] }]), data, W).from, { v: 'BFS', s: '' });
  assert.deepEqual(t.fields(walk([{ froms: ['STN'] }]), data, W).from, { v: 'STN', s: 'London Stansted' });
  assert.deepEqual(t.fields(walk([{ kind: 'ABROAD' }, { route: { to: 'FCO' } }]), data, W).to, { v: 'FCO', s: 'Rome Fiumicino' });
});

test('a long somewhere-else airport is shortened on the ticket, never in what is saved', () => {
  const long = 'Aeroporto Internazionale di Ancona Falconara Raffaello Sanzio';
  const p = walk([{ froms: ['PIK'] }, { route: { from: 'PIK', to: 'OTHER' } }, { toText: long }, { last: 'lift' }, { arrive: 'fri' }, { leave: 'mon' }]);
  const shown = t.fields(p, data, W).to.v;
  assert.ok(shown.length <= 30 && shown.endsWith('\u2026') && long.startsWith(shown.slice(0, -1).trim()), shown);
  assert.ok(t.summary(p, data, W).length <= t.SUMMARY_MAX, t.summary(p, data, W));
  assert.ok(t.summary(walk([{ kind: 'ABROAD' }, { route: { to: 'OTHER' } }, { toText: long }]), data, W).length <= t.SUMMARY_MAX);
  assert.equal(t.ticketOf(p).toText, long.slice(0, 60));
  assert.equal(t.fields(walk([{ kind: 'ABROAD' }, { route: { to: 'OTHER' } }, { toText: 'Ancona' }]), data, W).to.v, 'Ancona');
});
