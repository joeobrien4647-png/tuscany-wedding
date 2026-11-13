const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../js/first/store.js');
const travel = require('../js/first/travel-core.js');
const cards = require('../js/first/cards.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const TOKEN = 'tok_TRAVELabcdefgh01', OTHER_TOKEN = 'tok_TRAVELabcdefgh02';
const KEY = 'sj-first-travel';
const ticket = { from: 'MAN', to: 'PSA', via: 'direct', last: 'hire', arrive: 'fri', leave: 'mon' };
const second = { from: 'ROAD', last: 'own', arrive: 'thu', leave: 'sun', who: [false, true] };
const draft = travel.choose(travel.newPlan(), { froms: ['MAN', 'LHR'] });
const EMPTY = { draft: null, tickets: [] };

function fakeStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: k => { map.delete(k); } };
}
function withGlobals(over, fn) {
  const saved = {};
  for (const k of Object.keys(over)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: over[k], configurable: true, writable: true });
  }
  const restore = () => {
    for (const k of Object.keys(over)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; }
  };
  return Promise.resolve().then(fn).then(r => { restore(); return r; }, e => { restore(); throw e; });
}
function recorder(ok = true) {
  const calls = [];
  const fetch = (url, init) => { calls.push({ url, init }); return Promise.resolve({ ok, json: () => Promise.resolve(null) }); };
  return { calls, fetch };
}

test('saveTicket PUTs to travel/<token>/<n> with a server timestamp and never to household/', () => {
  const r = recorder();
  return withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveTicket(TOKEN, 0, ticket), true);
    assert.equal(r.calls.length, 1);
    const { url, init } = r.calls[0];
    assert.ok(url.endsWith('/travel/' + TOKEN + '/0.json'), url);
    assert.ok(!url.includes('household/'));
    assert.equal(init.method, 'PUT');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.at, { '.sv': 'timestamp' });
    assert.deepEqual(body, { ...ticket, at: { '.sv': 'timestamp' } });
    assert.equal(init.credentials, 'omit');
  });
});
test('saveTicket sends who with a later ticket, and a stamp time from the phone is never sent', () => {
  const r = recorder();
  return withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveTicket(TOKEN, 1, { ...second, at: 5 }), true);
    assert.ok(r.calls[0].url.endsWith('/travel/' + TOKEN + '/1.json'));
    assert.deepEqual(JSON.parse(r.calls[0].init.body), { ...second, at: { '.sv': 'timestamp' } });
  });
});
test('saveTicket refuses a bad token, n outside 0..7 and a ticket cleanTicket rejects, without a request', () => {
  const r = recorder();
  return withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveTicket('short', 0, ticket), false);
    for (const n of [-1, 8, 1.5, '0', null, undefined]) assert.equal(await store.saveTicket(TOKEN, n, ticket), false, String(n));
    assert.equal(await store.saveTicket(TOKEN, 0, { ...ticket, last: 'bike' }), false);
    assert.equal(await store.saveTicket(TOKEN, 0, null), false);
    assert.equal(await store.saveTicket(TOKEN, 0, second), false, 'the first ticket covers everyone, so it names nobody');
    assert.equal(await store.saveTicket(TOKEN, 1, ticket), false, 'a later ticket says who it is for');
    assert.equal(r.calls.length, 0);
  });
});
test('saveTicket resolves false when the database refuses or does not answer', () => {
  return withGlobals({ fetch: recorder(false).fetch }, async () => {
    assert.equal(await store.saveTicket(TOKEN, 0, ticket), false);
  }).then(() => withGlobals({ fetch: () => Promise.reject(new Error('offline')) }, async () => {
    assert.equal(await store.saveTicket(TOKEN, 0, ticket), false);
  }));
});
test('removeTicket DELETEs one ticket and refuses a bad token or n', () => {
  const r = recorder();
  return withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.removeTicket(TOKEN, 1), true);
    assert.equal(r.calls[0].init.method, 'DELETE');
    assert.ok(r.calls[0].url.endsWith('/travel/' + TOKEN + '/1.json'));
    assert.equal(await store.removeTicket(TOKEN, 9), false);
    assert.equal(await store.removeTicket('nope', 1), false);
    assert.equal(r.calls.length, 1);
  });
});
test('in local-test mode a ticket save makes no request and succeeds', () => {
  const r = recorder();
  const location = { hostname: 'localhost', search: '?first=1&wtest=1' };
  return withGlobals({ fetch: r.fetch, location }, async () => {
    assert.equal(await store.saveTicket(TOKEN, 0, ticket), true);
    assert.equal(await store.removeTicket(TOKEN, 0), true);
    assert.equal(await store.saveTicket(TOKEN, 0, { ...ticket, last: 'bike' }), false);
    assert.equal(r.calls.length, 0);
  });
});

test('travelCopy: what was written is read back for the same invitation', () => {
  return withGlobals({ localStorage: fakeStorage() }, () => {
    assert.deepEqual(store.travelCopy.read(TOKEN), EMPTY);
    store.travelCopy.write(TOKEN, { draft, tickets: [ticket, null, second] });
    assert.deepEqual(store.travelCopy.read(TOKEN), { draft, tickets: [ticket, null, second] });
  });
});
test('travelCopy: what one invitation wrote is not read back for another', () => {
  return withGlobals({ localStorage: fakeStorage() }, () => {
    store.travelCopy.write(TOKEN, { draft: null, tickets: [ticket] });
    assert.deepEqual(store.travelCopy.read(OTHER_TOKEN), { draft: null, tickets: [] });
    assert.deepEqual(store.travelCopy.read(''), EMPTY);
    assert.deepEqual(store.travelCopy.read(undefined), EMPTY);
  });
});
test('travelCopy: damaged JSON, an old shape and a thrown localStorage all read as empty', () => {
  const ls = fakeStorage();
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  return withGlobals({ localStorage: ls }, () => {
    store.travelCopy.write(TOKEN, { draft: null, tickets: [ticket] });
    const good = JSON.parse(ls.getItem(KEY));
    for (const bad of ['{not json', '[]', 'null', '"x"', JSON.stringify({ ...good, v: 0 }), JSON.stringify({ ...good, tickets: 'x' }), JSON.stringify({ tickets: [ticket] })]) {
      ls.setItem(KEY, bad);
      assert.deepEqual(store.travelCopy.read(TOKEN), EMPTY, bad);
    }
    ls.setItem(KEY, JSON.stringify({ ...good, draft: { froms: 'MAN' }, tickets: [{ ...ticket, last: 'bike' }, ticket, 7] }));
    assert.deepEqual(store.travelCopy.read(TOKEN), { draft: null, tickets: [null, ticket, null] }, 'bad parts are dropped one by one');
    ls.setItem(KEY, JSON.stringify({ ...good, tickets: new Array(9).fill(ticket) }));
    assert.equal(store.travelCopy.read(TOKEN).tickets.length, 8);
  }).then(() => withGlobals({ localStorage: boom }, () => {
    assert.deepEqual(store.travelCopy.read(TOKEN), EMPTY);
    assert.doesNotThrow(() => store.travelCopy.write(TOKEN, { draft, tickets: [] }));
    assert.doesNotThrow(() => store.travelCopy.clear());
  }));
});
test('travelCopy never stores the token', () => {
  const ls = fakeStorage();
  return withGlobals({ localStorage: ls }, () => {
    store.travelCopy.write(TOKEN, { draft, tickets: [ticket] });
    const kept = ls.getItem(KEY);
    assert.ok(kept && !kept.includes(TOKEN));
    assert.ok(!kept.includes(TOKEN.slice(4)));
    store.travelCopy.write('short', { draft, tickets: [ticket] });
    assert.equal(ls.getItem(KEY), kept, 'a bad token writes nothing');
  });
});
test('travelCopy.clear forgets everything', () => {
  return withGlobals({ localStorage: fakeStorage() }, () => {
    store.travelCopy.write(TOKEN, { draft, tickets: [ticket] });
    store.travelCopy.clear();
    assert.deepEqual(store.travelCopy.read(TOKEN), EMPTY);
  });
});
test('notYou clears the travel copy', () => {
  return withGlobals({ localStorage: fakeStorage() }, () => {
    store.travelCopy.write(TOKEN, { draft, tickets: [ticket] });
    const seen = [];
    cards.notYou({ forget() { seen.push('forgot'); } }, { pathname: '/', search: '?w=' + TOKEN, replace: u => seen.push(u) });
    assert.deepEqual(store.travelCopy.read(TOKEN), EMPTY);
    assert.deepEqual(seen, ['forgot', '/']);
  });
});

test('rules: travel is write-only for a link, tied to a real invitation and a yes reply', () => {
  const rules = JSON.parse(read('firebase.rules.json'));
  const t = rules.rules.travel.$token;
  assert.equal(rules.rules.travel['.read'], undefined);
  assert.equal(t['.read'], undefined);
  assert.equal(t.$n['.read'], undefined);
  assert.match(t['.validate'], /welcome/);
  assert.match(t.$n['.write'], /reply.*answer.*yes/);
  assert.match(t.$n['.write'], /\$n\.matches\(\/\^\[0-7\]\$\/\)/);
  assert.equal(t.$n.$other['.validate'], false);
  assert.match(t.$n.at['.validate'], /== now/);
  assert.match(t.$n.toText['.validate'], /<= 60/);
});
test('rules: every list in the travel rules matches the lists the card uses', () => {
  const n = JSON.parse(read('firebase.rules.json')).rules.travel.$token.$n;
  const allowed = rule => (rule.match(/'([a-z]+)'/g) || []).map(s => s.slice(1, -1));
  assert.deepEqual(allowed(n.last['.validate']), travel.LAST);
  assert.deepEqual(allowed(n.arrive['.validate']), travel.ARRIVE);
  assert.deepEqual(allowed(n.leave['.validate']), travel.LEAVE);
  assert.deepEqual(allowed(n.via['.validate']), ['direct', 'change']);
  const from = new RegExp(n.from['.validate'].match(/matches\(\/(.+)\/\)/)[1]);
  for (const f of travel.KINDS.concat('MAN')) assert.ok(from.test(f), f);
  const to = new RegExp(n.to['.validate'].match(/matches\(\/(.+)\/\)/)[1]);
  for (const c of ['PSA', 'OTHER']) assert.ok(to.test(c), c);
  assert.deepEqual(n['.validate'].match(/'([a-z]+)'/g).map(s => s.slice(1, -1)), ['from', 'last', 'arrive', 'leave', 'at']);
});
