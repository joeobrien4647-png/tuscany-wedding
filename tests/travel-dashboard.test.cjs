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
const yes = coming => ({ reply: { answer: 'yes', coming, at: 1 } });
const household = { tokA: yes([true, true]), tokB: yes([true]), tokC: yes([true]), tokD: yes([true, true]), tokOrphan: yes([true]) };
const fly = { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon', at: 1800000000000 };
const travel = {
  tokA: { 0: fly, 1: { from: 'ROAD', last: 'own', arrive: 'thu', leave: 'sun', who: [false, true], at: 1800000005000 } },
  tokB: [{ from: 'LHR', to: 'PSA', via: 'change', last: 'taxi', arrive: 'fri', leave: 'later', at: 1800000001000 }],
  tokC: { 0: { from: 'MAN', to: 'PSA', last: 'bike', arrive: 'fri', leave: 'mon', at: 1 }, 3: { from: 'ABROAD', to: 'OTHER', toText: 'Ancona', last: 'lift', arrive: 'sat', leave: 'sun', at: 2 } },
  tokOrphan: { 0: fly }
};

test('travelRows: one row per invited household with a ticket, tickets in order', () => {
  const rows = travelRows(welcome, travel, household);
  assert.deepEqual(rows.map(r => r.token), ['tokC', 'tokA', 'tokB']);
  const a = rows.find(r => r.token === 'tokA');
  assert.equal(a.display, 'the Aldens');
  assert.deepEqual(a.tickets[0], { n: 0, who: null, from: 'MAN', to: 'PSA', toText: null, via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon', at: 1800000000000 });
  assert.deepEqual(a.tickets[1], { n: 1, who: ['Ben Alden'], from: 'ROAD', to: null, toText: null, via: null, last: 'own', arrive: 'thu', leave: 'sun', at: 1800000005000 });
});
test('travelRows: households not in welcome and tickets that are not tickets are dropped', () => {
  const rows = travelRows(welcome, travel, household);
  assert.ok(!rows.some(r => r.token === 'tokOrphan'));
  assert.ok(!rows.some(r => r.token === 'tokD'), 'no ticket, no row');
  const c = rows.find(r => r.token === 'tokC');
  assert.deepEqual(c.tickets.map(t => t.n), [3]);
  assert.equal(c.tickets[0].toText, 'Ancona');
});
test('travelRows: missing or malformed inputs give []', () => {
  assert.deepEqual(travelRows(null, travel, household), []);
  assert.deepEqual(travelRows(welcome, null, household), []);
  assert.deepEqual(travelRows('x', 7, household), []);
  assert.deepEqual(travelRows(welcome, { tokA: 'junk', tokB: { 9: fly, x: fly } }, household), []);
  assert.deepEqual(travelRows(welcome, travel), [], 'no replies known, so nobody is known to be coming');
  assert.deepEqual(travelRows(welcome, travel, 'junk'), []);
});
test('travelRows: who names come from the invitation by position, and a position with no name is skipped', () => {
  const rows = travelRows({ t1: { display: 'One', lines: [], people: ['Ana'] } },
    { t1: { 0: fly, 1: { from: 'TRAIN', last: 'taxi', arrive: 'fri', leave: 'mon', who: [false, true], at: 3 } } }, { t1: yes([true, true]) });
  assert.deepEqual(rows[0].tickets[1].who, []);
});
test('ticketLine says a ticket in one plain line', () => {
  const rows = travelRows(welcome, travel, household);
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
  const list = arrivals(travelRows(welcome, both, household));
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

test('travelRows: a household that is no longer coming has no tickets or arrivals', () => {
  const changed = { ...household, tokA: { reply: { answer: 'no', coming: [false, false], at: 9 } }, tokB: {} };
  const rows = travelRows(welcome, travel, changed);
  assert.deepEqual(rows.map(r => r.token), ['tokC']);
  assert.ok(!JSON.stringify(arrivals(rows)).includes('Aldens'));
});
test('travelRows: a separate ticket for someone who is no longer coming is dropped, and names keep to who is coming', () => {
  const benOut = { ...household, tokA: yes([true, false]) };
  assert.deepEqual(travelRows(welcome, travel, benOut).find(r => r.token === 'tokA').tickets.map(t => t.n), [0]);
  const three = { t1: { display: 'Three', lines: [], people: ['Ana', 'Ben', 'Cy'] } };
  const tickets = { t1: { 0: fly, 1: { from: 'TRAIN', last: 'taxi', arrive: 'fri', leave: 'mon', who: [false, true, true], at: 3 } } };
  assert.deepEqual(travelRows(three, tickets, { t1: yes([true, true, false]) })[0].tickets[1].who, ['Ben']);
});
test('ticketLine keeps an airport code in capitals after the names on a separate ticket', () => {
  assert.equal(ticketLine({ who: ['Sam Lee'], from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' }), 'Sam Lee: MAN to PSA, hire car, Fri 28 to Mon 31');
  assert.equal(ticketLine({ who: ['Sam Lee'], from: 'ABROAD', to: 'FCO', last: 'taxi', arrive: 'fri', leave: 'mon' }), 'Sam Lee: outside the UK to FCO, taxi, Fri 28 to Mon 31');
  assert.equal(ticketLine({ who: ['Sam Lee'], from: 'ITALY', to: null, last: 'own', arrive: 'fri', leave: 'mon' }), 'Sam Lee: already in Italy, not flying, own car, Fri 28 to Mon 31');
});
test('the dashboard gives travelRows the replies', () => {
  assert.match(dashboard, /sjFirst\.travelRows\(welcome, travel, household\)/);
});
