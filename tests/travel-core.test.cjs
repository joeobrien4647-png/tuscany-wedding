const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const t = require('../js/first/travel-core.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'getting-there.json'), 'utf8'));
const DAY = 24 * 3600 * 1000, NOW = Date.UTC(2027, 0, 20);
const LONDON = ['LHR', 'LGW', 'LCY', 'LTN', 'STN', 'SEN'];
const walk = changes => changes.reduce((p, c) => t.choose(p, c), t.newPlan());
const DAYS = [{ arrive: 'fri' }, { leave: 'mon' }];

test('the lists are the ones the database rules allow', () => {
  assert.deepEqual(t.LAST, ['hire', 'lift', 'taxi', 'public', 'own']);
  assert.deepEqual(t.ARRIVE, ['early', 'thu', 'fri', 'sat']);
  assert.deepEqual(t.LEAVE, ['sun', 'mon', 'later']);
  assert.deepEqual(t.KINDS, ['ABROAD', 'ITALY', 'ROAD', 'TRAIN']);
  assert.equal(t.PRICE_MAX_AGE_MS, 14 * DAY);
});
test('the area shortcuts cover every UK airport exactly once', () => {
  const all = t.GROUPS.reduce((a, g) => a.concat(g.codes), []);
  assert.deepEqual(all.slice().sort(), Object.keys(data.ukAirports).sort());
  assert.equal(new Set(all).size, all.length);
});
test('newPlan is empty', () => {
  assert.deepEqual(t.newPlan(), { froms: [], from: null, to: null, toText: '', via: null, last: null, arrive: null, leave: null });
});

test('routes: London plus Manchester gives 22 direct routes, nearest airport first', () => {
  const r = t.routes(data, LONDON.concat('MAN'), 'drive');
  assert.equal(r.length, 22);
  assert.equal(r[0].to, 'PEG');
  assert.deepEqual(r.find(x => x.from === 'MAN' && x.to === 'PSA').airlines, ['easyJet', 'Ryanair', 'Jet2']);
  assert.ok(r.every((x, i) => !i || r[i - 1].driveRank <= x.driveRank));
  assert.ok(r.every(x => x.price === null));
});
test('routes: sorted by airport keeps the order the airports were picked in', () => {
  const r = t.routes(data, ['MAN', 'LHR'], 'airport');
  const firstLhr = r.findIndex(x => x.from === 'LHR');
  assert.ok(firstLhr > 0 && r.slice(0, firstLhr).every(x => x.from === 'MAN') && r.slice(firstLhr).every(x => x.from === 'LHR'));
});
test('routes: sorted by price puts routes without a price last, in drive order', () => {
  const prices = { routes: { 'MAN-FCO': { gbp: 60, at: NOW }, 'MAN-PSA': { gbp: 84, at: NOW } } };
  const r = t.routes(data, ['MAN'], 'price', prices, NOW);
  assert.deepEqual(r.slice(0, 2).map(x => x.to), ['FCO', 'PSA']);
  assert.deepEqual(r[0].price, { gbp: 60, at: NOW });
  const rest = r.slice(2);
  assert.ok(rest.length && rest.every(x => x.price === null));
  assert.ok(rest.every((x, i) => !i || rest[i - 1].driveRank <= x.driveRank));
});
test('routes: a destination code that is not in the airport list is skipped', () => {
  const odd = { airports: data.airports, ukAirports: { MAN: { name: 'Manchester', flies: [{ to: 'XXX', airline: 'Nobody' }, { to: 'PSA', airline: 'easyJet' }] } } };
  assert.deepEqual(t.routes(odd, ['MAN'], 'drive').map(x => x.to), ['PSA']);
});
test('routes: unknown airports, repeats and broken data give no rows and never throw', () => {
  assert.deepEqual(t.routes(data, ['ZZZ'], 'drive'), []);
  assert.equal(t.routes(data, ['MAN', 'MAN'], 'drive').length, t.routes(data, ['MAN'], 'drive').length);
  assert.deepEqual(t.routes(null, ['MAN'], 'drive'), []);
  assert.deepEqual(t.routes({ airports: [], ukAirports: { MAN: {} } }, ['MAN'], 'drive'), []);
  assert.deepEqual(t.routes(data, null, 'drive'), []);
});

test('nextStep walks from, route, last, days, done', () => {
  let p = t.newPlan();
  assert.equal(t.nextStep(p), 'from');
  p = t.choose(p, { froms: ['MAN', 'LHR'] });
  assert.equal(t.nextStep(p), 'route');
  p = t.choose(p, { route: { from: 'MAN', to: 'PSA', via: 'direct' } });
  assert.equal(t.nextStep(p), 'last');
  p = t.choose(p, { last: 'hire' });
  assert.equal(t.nextStep(p), 'days');
  p = t.choose(p, { arrive: 'fri' });
  assert.equal(t.nextStep(p), 'days');
  p = t.choose(p, { leave: 'mon' });
  assert.equal(t.nextStep(p), 'done');
});
test('nextStep: driving all the way skips the route and the last stretch; the train skips only the route', () => {
  const road = t.choose(t.newPlan(), { kind: 'ROAD' });
  assert.equal(road.last, 'own');
  assert.equal(t.nextStep(road), 'days');
  const train = t.choose(t.newPlan(), { kind: 'TRAIN' });
  assert.equal(t.nextStep(train), 'last');
});
test('choose: changing the airports being compared clears the chosen route', () => {
  let p = walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }, { last: 'hire' }]);
  p = t.choose(p, { froms: ['MAN', 'LPL'] });
  assert.deepEqual([p.from, p.to, p.via, p.toText], [null, null, null, '']);
  assert.deepEqual(p.froms, ['MAN', 'LPL']);
  assert.equal(p.last, 'hire');
});
test('choose: a new kind clears the route and the airports', () => {
  let p = walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'OTHER' } }, { toText: 'Ancona' }]);
  p = t.choose(p, { kind: 'ABROAD' });
  assert.deepEqual([p.froms, p.from, p.to, p.via, p.toText], [[], 'ABROAD', null, null, '']);
});
test('choose: leaving ROAD clears the own car it set', () => {
  const road = t.choose(t.newPlan(), { kind: 'ROAD' });
  assert.equal(t.choose(road, { kind: 'ABROAD' }).last, null);
  assert.equal(t.choose(road, { froms: ['MAN'] }).last, null);
});
test('choose: own car is offered only where it makes sense', () => {
  assert.deepEqual(t.lastOptions(t.choose(t.newPlan(), { kind: 'ROAD' })), ['own']);
  assert.ok(t.lastOptions(t.choose(t.newPlan(), { kind: 'ITALY' })).includes('own'));
  assert.ok(!t.lastOptions(t.choose(t.newPlan(), { froms: ['MAN'] })).includes('own'));
  assert.equal(t.choose(t.choose(t.newPlan(), { froms: ['MAN'] }), { last: 'own' }).last, null);
});
test('choose: a route must leave from one of the airports being compared', () => {
  const p = t.choose(t.newPlan(), { froms: ['MAN'] });
  assert.equal(t.choose(p, { route: { from: 'LHR', to: 'PSA', via: 'direct' } }).to, null);
  assert.equal(t.choose(p, { route: { from: 'MAN', to: 'psa' } }).to, null);
  assert.equal(t.choose(p, { route: { from: 'MAN', to: 'NONE' } }).to, null);
});
test('choose: anything it does not understand leaves the plan as it was', () => {
  const p = walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }]);
  for (const bad of [null, {}, { last: 'bike' }, { arrive: 'mon' }, { leave: 'fri' }, { kind: 'BOAT' }, { froms: 'MAN' }, { route: null }, { toText: 5 }])
    assert.deepEqual(t.choose(p, bad), p, JSON.stringify(bad));
});
test('choose never changes the plan it was given', () => {
  const p = walk([{ froms: ['MAN'] }]);
  const frozen = JSON.stringify(p);
  Object.freeze(p); Object.freeze(p.froms);
  const next = t.choose(p, { froms: ['LHR'] });
  t.choose(p, { route: { from: 'MAN', to: 'PSA', via: 'direct' } });
  t.choose(p, { kind: 'ROAD' });
  assert.equal(JSON.stringify(p), frozen);
  assert.notEqual(next, p);
  assert.notEqual(t.choose(p, { last: 'bike' }), p);
});
test('choose: the airports being compared are cleaned, capped and kept in order', () => {
  const p = t.choose(t.newPlan(), { froms: ['MAN', 'MAN', 'lhr', 5, 'LHR'] });
  assert.deepEqual(p.froms, ['MAN', 'LHR']);
  assert.equal(t.choose(t.newPlan(), { froms: [] }).froms.length, 0);
  assert.equal(t.nextStep(t.choose(p, { froms: [] })), 'from');
});
test('choose: somewhere-else text is cut at 60 characters and needs OTHER', () => {
  let p = walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'OTHER' } }]);
  assert.equal(t.nextStep(p), 'route');
  p = t.choose(p, { toText: 'x'.repeat(80) });
  assert.equal(p.toText.length, 60);
  assert.equal(t.nextStep(p), 'last');
  assert.equal(t.nextStep(t.choose(p, { toText: '   ' })), 'route');
  const direct = walk([{ froms: ['MAN'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }]);
  assert.equal(t.choose(direct, { toText: 'Ancona' }).toText, '');
});

test('ticketOf is null until every box is filled, then matches cleanTicket', () => {
  const steps = [{ froms: ['MAN', 'LHR'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }, { last: 'hire' }, { arrive: 'thu' }, { leave: 'sun' }];
  let p = t.newPlan();
  for (const s of steps) { assert.equal(t.ticketOf(p), null); p = t.choose(p, s); }
  const ticket = t.ticketOf(p);
  assert.deepEqual(ticket, { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'thu', leave: 'sun' });
  assert.deepEqual(t.cleanTicket(ticket), ticket);
});
test('ticketOf: who is kept only when somebody is named', () => {
  const p = walk([{ kind: 'ROAD' }].concat(DAYS));
  assert.deepEqual(t.ticketOf(p, [false, true]), { from: 'ROAD', last: 'own', arrive: 'fri', leave: 'mon', who: [false, true] });
  assert.equal(t.ticketOf(p, [false, false]), null);
  assert.equal(t.ticketOf(p, ['yes']), null);
  assert.equal('who' in t.ticketOf(p), false);
});
test('ticketOf: already in Italy and not flying leaves the airport out', () => {
  const p = walk([{ kind: 'ITALY' }, { route: { to: 'NONE' } }, { last: 'own' }].concat(DAYS));
  assert.deepEqual(t.ticketOf(p), { from: 'ITALY', last: 'own', arrive: 'fri', leave: 'mon' });
});
test('cleanTicket rejects: unknown last, toText over 60, OTHER without toText, who with nobody, extra keys', () => {
  const ok = { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' };
  assert.deepEqual(t.cleanTicket(ok), ok);
  const bad = [
    { ...ok, last: 'bike' }, { ...ok, arrive: 'mon' }, { ...ok, leave: 'fri' },
    { ...ok, to: 'OTHER', toText: 'x'.repeat(61) }, { ...ok, to: 'OTHER' }, { ...ok, to: 'OTHER', toText: '  ' },
    { ...ok, toText: 'Ancona' }, { ...ok, who: [false, false] }, { ...ok, who: [] }, { ...ok, who: [true, 'x'] },
    { ...ok, who: new Array(9).fill(true) }, { ...ok, extra: 1 }, { ...ok, from: 'man' }, { ...ok, from: 'BOAT' },
    { ...ok, to: 'NONE' }, { ...ok, via: 'boat' }, { from: 'ABROAD', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' },
    { from: 'ROAD', to: 'PSA', last: 'own', arrive: 'fri', leave: 'mon' }, { from: 'MAN', last: 'hire', arrive: 'fri', leave: 'mon' },
    { from: 'ABROAD', last: 'hire', arrive: 'fri', leave: 'mon' }, { ...ok, at: 'now' }, null, 'x', [], 5
  ];
  for (const b of bad) assert.equal(t.cleanTicket(b), null, JSON.stringify(b));
});
test('cleanTicket keeps when it was stamped, and reads who as the database returns it', () => {
  const ok = { from: 'TRAIN', last: 'taxi', arrive: 'sat', leave: 'later', at: 1800000000000 };
  assert.deepEqual(t.cleanTicket(ok), ok);
  const sparse = t.cleanTicket({ from: 'ROAD', last: 'own', arrive: 'fri', leave: 'mon', who: { 1: true } });
  assert.deepEqual(sparse.who, [false, true]);
});

test('cleanPlan keeps a plan choose could have made and refuses anything else', () => {
  const p = walk([{ froms: ['MAN', 'LHR'] }, { route: { from: 'MAN', to: 'PSA', via: 'direct' } }, { last: 'hire' }]);
  assert.deepEqual(t.cleanPlan(JSON.parse(JSON.stringify(p))), p);
  assert.deepEqual(t.cleanPlan(t.newPlan()), t.newPlan());
  for (const bad of [null, 'x', [], {}, { ...p, froms: 'MAN' }, { ...p, last: 'bike' }, { ...p, from: 'LGW' }, { ...p, extra: 1 }, { ...p, toText: 5 }, { ...p, to: 'psa' }])
    assert.equal(t.cleanPlan(bad), null, JSON.stringify(bad));
});

test('priceFor hides a price older than 14 days, a non-number, and an unknown route', () => {
  const prices = { routes: { 'MAN-PSA': { gbp: 84, at: NOW - 2 * DAY }, 'MAN-BLQ': { gbp: 'x', at: NOW }, 'LHR-FCO': { gbp: 90, at: NOW - 15 * DAY } } };
  assert.deepEqual(t.priceFor(prices, 'MAN', 'PSA', NOW), { gbp: 84, at: NOW - 2 * DAY });
  assert.equal(t.priceFor(prices, 'MAN', 'BLQ', NOW), null);
  assert.equal(t.priceFor(prices, 'LHR', 'FCO', NOW), null);
  assert.equal(t.priceFor(prices, 'MAN', 'FCO', NOW), null);
  assert.equal(t.priceFor(null, 'MAN', 'PSA', NOW), null);
  assert.equal(t.priceFor({ routes: { 'MAN-PSA': { gbp: -3, at: NOW } } }, 'MAN', 'PSA', NOW), null);
  assert.equal(t.priceFor({ routes: { 'MAN-PSA': { gbp: 84 } } }, 'MAN', 'PSA', NOW), null);
});
test('flightsLink uses the guest days, or Fri 28 to Mon 31 May 2027 when early, later or not chosen', () => {
  assert.match(t.flightsLink('MAN', 'PSA', 'thu', 'sun'), /2027-05-27.*2027-05-30/);
  assert.match(t.flightsLink('MAN', 'PSA', null, 'later'), /2027-05-28.*2027-05-31/);
  assert.match(t.flightsLink('MAN', 'PSA', 'early', null), /2027-05-28.*2027-05-31/);
  assert.equal(t.flightsLink('ABROAD', 'PSA', 'fri', 'mon'), null);
  assert.equal(t.flightsLink('MAN', 'OTHER', 'fri', 'mon'), null);
  assert.equal(t.flightsLink('MAN', 'PSA', 'fri', 'mon'),
    'https://www.google.com/travel/flights?q=' + encodeURIComponent('Flights from MAN to PSA on 2027-05-28 through 2027-05-31'));
});
test('canStamp: yes reply is yes, no reply is reply, a no is no', () => {
  assert.equal(t.canStamp({ reply: { answer: 'yes' } }), 'yes');
  assert.equal(t.canStamp({ reply: { answer: 'no' } }), 'no');
  for (const h of [null, undefined, {}, { stay: { choice: 'villa' } }]) assert.equal(t.canStamp(h), 'reply');
});

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
test('every way of setting off can reach done', () => {
  for (const steps of PATHS) {
    const p = walk(steps);
    assert.equal(t.nextStep(p), 'done', JSON.stringify(steps));
    assert.ok(t.cleanTicket(t.ticketOf(p)), JSON.stringify(steps));
    assert.deepEqual(t.cleanPlan(p), p, JSON.stringify(steps));
  }
});
test('a change route keeps the UK airport and marks via change; OTHER needs its text', () => {
  assert.deepEqual(t.ticketOf(walk(PATHS[1])), { from: 'EDI', to: 'PEG', via: 'change', last: 'taxi', arrive: 'fri', leave: 'mon' });
  assert.deepEqual(t.ticketOf(walk(PATHS[2])), { from: 'LPL', to: 'OTHER', toText: 'Ancona', last: 'lift', arrive: 'fri', leave: 'mon' });
  const noText = walk([{ froms: ['LPL'] }, { route: { from: 'LPL', to: 'OTHER' } }, { last: 'lift' }].concat(DAYS));
  assert.equal(t.ticketOf(noText), null);
  assert.equal(t.nextStep(noText), 'route');
  assert.equal(walk([{ kind: 'ABROAD' }, { route: { to: 'FCO', via: 'change' } }]).via, null);
});
