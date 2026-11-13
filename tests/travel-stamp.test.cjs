// Stamping a Getting there ticket: what is saved, what the phone keeps, and the dock's tick.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const card = require('../js/first/travel-card.js');
const home = require('../js/first/home.js');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const TOKEN = 'tok_STAMPabcdefgh001';
const yes = { reply: { answer: 'yes', coming: [true, true], at: 1 } };
const ticket = { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' };
const second = { from: 'ROAD', last: 'own', arrive: 'thu', leave: 'sun', who: [false, true] };
const draft = { froms: ['MAN'], from: null, to: null, toText: '', via: null, last: null, arrive: null, leave: null };

// A stand-in store: saves answer `ok`; the phone copy is one object in memory.
function fakeStore(ok, start) {
  const calls = [];
  let copy = start || { draft: null, tickets: [] };
  return {
    calls,
    saveTicket(token, n, t) { calls.push(['save', token, n, t]); return ok === 'throw' ? Promise.reject(new Error('offline')) : Promise.resolve(ok); },
    removeTicket(token, n) { calls.push(['remove', token, n]); return Promise.resolve(ok); },
    travelCopy: {
      read: token => (token === TOKEN ? JSON.parse(JSON.stringify(copy)) : { draft: null, tickets: [] }),
      write(token, next) { calls.push(['write']); copy = JSON.parse(JSON.stringify(next)); },
      clear() { copy = { draft: null, tickets: [] }; }
    },
    now: () => copy
  };
}
const ctx = household => ({ invite: { token: TOKEN, people: ['Robin Ash', 'Kit Moss'] }, household });

test('dockStates: travel is done only when this phone has a stamped ticket', () => {
  assert.equal(core.dockStates(yes, true).travel, 'done');
  assert.equal(core.dockStates(yes, false).travel, 'plain');
  assert.equal(core.dockStates(yes).travel, 'plain');
  assert.equal(core.dockStates(yes, 'yes').travel, 'plain');
  assert.deepEqual(Object.keys(core.dockStates(yes, true)), ['reply', 'stay', 'travel', 'wear', 'weekend']);
  assert.equal(core.dockStates(yes, true).stay, core.dockStates(yes).stay);
});
test('the home screen ticks Travel from the phone copy', () => {
  const items = home.dockItems(yes, words, true);
  assert.equal(items.find(i => i.key === 'travel').state, 'done');
  assert.equal(home.dockItems(yes, words).find(i => i.key === 'travel').state, 'plain');
  assert.match(read('js/first/home.js'), /travelCopy\.read\(/);
});

test('stamp: a good save writes the ticket into the phone copy at position n and clears the draft', async () => {
  const store = fakeStore(true, { draft, tickets: [] });
  assert.equal(await card.stamp(ctx(yes), 0, ticket, { store }), true);
  assert.deepEqual(store.calls[0], ['save', TOKEN, 0, ticket]);
  assert.deepEqual(store.now(), { draft: null, tickets: [ticket] });
  assert.equal(await card.stamp(ctx(yes), 2, second, { store }), true);
  assert.deepEqual(store.now(), { draft: null, tickets: [ticket, null, second] });
});
test('stamp: stamping again replaces that ticket and leaves the others', async () => {
  const store = fakeStore(true, { draft: null, tickets: [ticket, second] });
  const changed = { ...ticket, last: 'taxi' };
  assert.equal(await card.stamp(ctx(yes), 0, changed, { store }), true);
  assert.deepEqual(store.now().tickets, [changed, second]);
});
test('stamp: a failed save resolves false and leaves the phone copy as it was', async () => {
  for (const ok of [false, 'throw']) {
    const store = fakeStore(ok, { draft, tickets: [] });
    assert.equal(await card.stamp(ctx(yes), 0, ticket, { store }), false, String(ok));
    assert.deepEqual(store.now(), { draft, tickets: [] });
    assert.ok(!store.calls.some(c => c[0] === 'write'));
  }
});
test('stamp: a household that has not said yes never reaches the store', async () => {
  for (const household of [null, {}, { reply: { answer: 'no', coming: [false], at: 1 } }]) {
    const store = fakeStore(true);
    assert.equal(await card.stamp(ctx(household), 0, ticket, { store }), false);
    assert.equal(store.calls.length, 0);
  }
});
test('stamp: nothing is sent without a ticket', async () => {
  const store = fakeStore(true);
  assert.equal(await card.stamp(ctx(yes), 0, null, { store }), false);
  assert.equal(store.calls.length, 0);
});
test('unstamp: removing a later ticket clears it on the phone only when the database agreed', async () => {
  const good = fakeStore(true, { draft: null, tickets: [ticket, second] });
  assert.equal(await card.unstamp(ctx(yes), 1, { store: good }), true);
  assert.deepEqual(good.calls[0], ['remove', TOKEN, 1]);
  assert.deepEqual(good.now().tickets, [ticket, null]);
  const bad = fakeStore(false, { draft: null, tickets: [ticket, second] });
  assert.equal(await card.unstamp(ctx(yes), 1, { store: bad }), false);
  assert.deepEqual(bad.now().tickets, [ticket, second]);
});
test('unstamp never removes the household ticket', async () => {
  const store = fakeStore(true, { draft: null, tickets: [ticket] });
  assert.equal(await card.unstamp(ctx(yes), 0, { store }), false);
  assert.equal(store.calls.length, 0);
});
test('the live-prices link opens in a new tab without handing the page over', () => {
  const js = read('js/first/travel-card.js');
  assert.match(js, /rel = 'noopener noreferrer'/);
  assert.match(js, /target = '_blank'/);
  assert.match(js, /flightsLink\(/);
});
