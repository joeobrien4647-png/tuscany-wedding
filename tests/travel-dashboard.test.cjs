// What Joe and Sophie see: stamped Getting there tickets per household, and one arrivals list. Invented names and tokens.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { travelRows, arrivals, ticketLine } = require('../js/first/core.js');
const dashboard = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

const welcome = {
  tokA: { display: 'the Aldens', lines: ['x'], people: ['Ana Alden', 'Ben Alden'] },
  tokB: { display: 'Zed Ward', lines: ['x'], people: ['Zed Ward'] },
  tokC: { display: 'Bea Hollis', lines: ['x'] },
  tokD: { display: 'Kit and Sam', lines: ['x'], people: ['Kit Moss', 'Sam Lee'] }
};
const fly = { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon', at: 1800000000000 };
const travel = {
  tokA: { 0: fly, 1: { from: 'ROAD', last: 'own', arrive: 'thu', leave: 'sun', who: [false, true], at: 1800000005000 } },
  tokB: [{ from: 'LHR', to: 'PSA', via: 'change', last: 'taxi', arrive: 'fri', leave: 'later', at: 1800000001000 }],
  tokC: { 0: { from: 'MAN', to: 'PSA', last: 'bike', arrive: 'fri', leave: 'mon', at: 1 }, 3: { from: 'ABROAD', to: 'OTHER', toText: 'Ancona', last: 'lift', arrive: 'sat', leave: 'sun', at: 2 } },
  tokOrphan: { 0: fly }
};

test('travelRows: one row per invited household with a ticket, tickets in order', () => {
  const rows = travelRows(welcome, travel);
  assert.deepEqual(rows.map(r => r.token), ['tokC', 'tokA', 'tokB']);
  const a = rows.find(r => r.token === 'tokA');
  assert.equal(a.display, 'the Aldens');
  assert.deepEqual(a.tickets[0], { n: 0, who: null, from: 'MAN', to: 'PSA', toText: null, via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon', at: 1800000000000 });
  assert.deepEqual(a.tickets[1], { n: 1, who: ['Ben Alden'], from: 'ROAD', to: null, toText: null, via: null, last: 'own', arrive: 'thu', leave: 'sun', at: 1800000005000 });
});
test('travelRows: households not in welcome and tickets that are not tickets are dropped', () => {
  const rows = travelRows(welcome, travel);
  assert.ok(!rows.some(r => r.token === 'tokOrphan'));
  assert.ok(!rows.some(r => r.token === 'tokD'), 'no ticket, no row');
  const c = rows.find(r => r.token === 'tokC');
  assert.deepEqual(c.tickets.map(t => t.n), [3]);
  assert.equal(c.tickets[0].toText, 'Ancona');
});
test('travelRows: missing or malformed inputs give []', () => {
  assert.deepEqual(travelRows(null, travel), []);
  assert.deepEqual(travelRows(welcome, null), []);
  assert.deepEqual(travelRows('x', 7), []);
  assert.deepEqual(travelRows(welcome, { tokA: 'junk', tokB: { 9: fly, x: fly } }), []);
});
test('travelRows: who names come from the invitation by position, and a position with no name is skipped', () => {
  const rows = travelRows({ t1: { display: 'One', lines: [], people: ['Ana'] } },
    { t1: { 0: fly, 1: { from: 'TRAIN', last: 'taxi', arrive: 'fri', leave: 'mon', who: [false, true], at: 3 } } });
  assert.deepEqual(rows[0].tickets[1].who, []);
});
test('ticketLine says a ticket in one plain line', () => {
  const rows = travelRows(welcome, travel);
  const line = (token, i) => ticketLine(rows.find(r => r.token === token).tickets[i]);
  assert.equal(line('tokA', 0), 'MAN to PSA, hire car, Fri 28 to Mon 31');
  assert.equal(line('tokA', 1), 'Ben Alden: driving all the way, own car, Thu 27 to Sun 30');
  assert.equal(line('tokB', 0), 'LHR to PSA with a change, taxi, Fri 28 then staying on');
  assert.equal(line('tokC', 0), 'Outside the UK to Ancona, getting a lift, Sat 29 to Sun 30');
  assert.equal(ticketLine({ from: 'ITALY', to: null, last: 'own', arrive: 'early', leave: 'mon' }), 'Already in Italy, not flying, own car, earlier in the week to Mon 31');
  assert.equal(ticketLine({ from: 'TRAIN', to: null, last: 'public', arrive: 'fri', leave: 'sun' }), 'Train all the way, public transport, Fri 28 to Sun 30');
  assert.equal(ticketLine(null), '');
});
test('arrivals groups households landing at the same place on the same day, by day then place', () => {
  const both = { ...travel, tokD: { 0: { from: 'LGW', to: 'PSA', via: 'direct', last: 'lift', arrive: 'fri', leave: 'mon', at: 9 } } };
  const list = arrivals(travelRows(welcome, both));
  assert.deepEqual(list, [
    { to: 'By road', arrive: 'thu', households: ['the Aldens (Ben Alden)'] },
    { to: 'PSA', arrive: 'fri', households: ['Kit and Sam', 'the Aldens', 'Zed Ward'] },
    { to: 'Ancona', arrive: 'sat', households: ['Bea Hollis'] }
  ]);
  assert.deepEqual(arrivals([]), []);
  assert.deepEqual(arrivals(null), []);
});
test('dashboard.html reads travel without caching it and loads the travel rules beside the core', () => {
  assert.match(dashboard, /<script src="js\/first\/core\.js"><\/script>\s*<script src="js\/first\/travel-core\.js"><\/script>/);
  const keys = dashboard.match(/const NO_CACHE_KEYS = \[([^\]]*)\]/)[1];
  assert.match(keys, /"travel"/);
  assert.match(dashboard, /useStorage\("travel"[^\n]*noCache: true/);
  assert.match(dashboard, /sjFirst\.travelRows\(/);
  assert.match(dashboard, /sjFirst\.arrivals\(/);
  assert.match(dashboard, /data-arrivals/);
});
test('the dashboard only reads tickets: nothing writes to travel', () => {
  assert.doesNotMatch(dashboard, /db\.ref\("travel/);
  assert.doesNotMatch(dashboard, /saveTravel|setTravel/);
});
