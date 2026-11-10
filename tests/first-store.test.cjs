const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../js/first/store.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const TOKEN = 'tok_ABCDEFGHIJKLMNOP';
const good = { reply: { answer: 'yes', coming: [true, false], at: 1700000000000 }, stay: { choice: 'villa', at: 1700000001000 } };

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
const reply = (body, ok = true) => () => Promise.resolve({ ok, json: () => Promise.resolve(body) });

test('clean keeps a valid record', () => {
  assert.deepEqual(store.clean(good), good);
  assert.deepEqual(store.clean({ stay: good.stay }), { stay: good.stay });
  assert.deepEqual(store.clean({ reply: { answer: 'no', coming: [], at: 5 } }), { reply: { answer: 'no', coming: [], at: 5 } });
});
test('clean returns null for nothing useful', () => {
  assert.equal(store.clean(null), null); assert.equal(store.clean(undefined), null);
  assert.equal(store.clean('x'), null); assert.equal(store.clean({}), null);
  assert.equal(store.clean({ reply: { answer: 'maybe', coming: [true], at: 1 } }), null);
});
test('clean drops unknown keys and bad parts', () => {
  const c = store.clean({ junk: 1, reply: { answer: 'yes', coming: [true], at: 1, extra: 'x' }, stay: { choice: 'castle', at: 2 } });
  assert.deepEqual(c, { reply: { answer: 'yes', coming: [true], at: 1 } });
  assert.equal(store.clean({ reply: { answer: 'yes', coming: 'nope', at: 1 } }), null);
  assert.deepEqual(store.clean({ reply: { answer: 'yes', coming: ['a'], at: 1 }, stay: good.stay }), { stay: good.stay });
});
test('clean turns a gappy coming object into an array and caps it at 8', () => {
  assert.deepEqual(store.clean({ reply: { answer: 'yes', coming: { 0: true, 2: false }, at: 1 } }).reply.coming, [true, false]);
  assert.equal(store.clean({ reply: { answer: 'yes', coming: new Array(9).fill(true), at: 1 } }), null);
});

test('load resolves the cleaned object, null for no record, undefined for no clear answer', async () => {
  assert.deepEqual(await withGlobals({ fetch: reply({ ...good, junk: 1 }) }, () => store.load(TOKEN)), good);
  assert.equal(await withGlobals({ fetch: reply(null) }, () => store.load(TOKEN)), null);
  assert.equal(await withGlobals({ fetch: () => Promise.reject(new Error('x')) }, () => store.load(TOKEN)), undefined);
  assert.equal(await withGlobals({ fetch: reply(null, false) }, () => store.load(TOKEN)), undefined);
  assert.equal(await withGlobals({ fetch: () => { throw new Error('x'); } }, () => store.load(TOKEN)), undefined);
  assert.equal(await store.load('bad'), undefined);
});
test('load reads household/<token>.json without credentials', async () => {
  let url, opts;
  await withGlobals({ fetch: (u, o) => { url = u; opts = o; return reply(null)(); } }, () => store.load(TOKEN));
  assert.match(url, /\/household\/tok_ABCDEFGHIJKLMNOP\.json$/);
  assert.equal(opts.credentials, 'omit');
});

test('saveReply puts the reply with a server timestamp', async () => {
  let url, opts;
  const ok = await withGlobals({ fetch: (u, o) => { url = u; opts = o; return reply({})(); } },
    () => store.saveReply(TOKEN, { answer: 'yes', coming: [true] }));
  assert.equal(ok, true);
  assert.match(url, /\/household\/tok_ABCDEFGHIJKLMNOP\/reply\.json$/);
  assert.equal(opts.method, 'PUT');
  assert.deepEqual(JSON.parse(opts.body), { answer: 'yes', coming: [true], at: { '.sv': 'timestamp' } });
});
test('saveReply and saveStay resolve false on failure', async () => {
  assert.equal(await withGlobals({ fetch: () => Promise.reject(new Error('x')) }, () => store.saveReply(TOKEN, { answer: 'no', coming: [false] })), false);
  assert.equal(await withGlobals({ fetch: reply(null, false) }, () => store.saveReply(TOKEN, { answer: 'no', coming: [false] })), false);
  let sent = 0;
  assert.equal(await withGlobals({ fetch: () => { sent++; return reply({})(); } }, () => store.saveReply(TOKEN, { answer: 'maybe', coming: [true] })), false);
  assert.equal(sent, 0);
  assert.equal(await withGlobals({ fetch: reply(null, false) }, () => store.saveStay(TOKEN, 'villa')), false);
  assert.equal(await store.saveStay(TOKEN, 'castle'), false);
});
test('saveReply never sends an empty coming: a no becomes [false], a yes [true]', async () => {
  for (const [answer, coming, want] of [['no', [], [false]], ['yes', [], [true]], ['no', undefined, [false]], ['yes', undefined, [true]]]) {
    let opts;
    const ok = await withGlobals({ fetch: (u, o) => { opts = o; return reply({})(); } }, () => store.saveReply(TOKEN, { answer, coming }));
    assert.equal(ok, true);
    assert.deepEqual(JSON.parse(opts.body).coming, want);
  }
});
test('saveStay puts the choice with a server timestamp', async () => {
  let url, opts;
  const ok = await withGlobals({ fetch: (u, o) => { url = u; opts = o; return reply({})(); } }, () => store.saveStay(TOKEN, 'later'));
  assert.equal(ok, true);
  assert.match(url, /\/household\/tok_ABCDEFGHIJKLMNOP\/stay\.json$/);
  assert.deepEqual(JSON.parse(opts.body), { choice: 'later', at: { '.sv': 'timestamp' } });
});

test('local-test mode keeps saves in memory for the page', async () => {
  const loc = { hostname: 'localhost', search: '?wtest=1' };
  const urls = [];
  await withGlobals({ location: loc, fetch: u => { urls.push(u); return reply(null)(); } }, async () => {
    assert.equal(await store.load(TOKEN), null);
    assert.match(urls[0], /^\.local-test\/household\/tok_ABCDEFGHIJKLMNOP\.json$/);
    assert.equal(await store.saveReply(TOKEN, { answer: 'yes', coming: [true, true] }), true);
    assert.equal(await store.saveStay(TOKEN, 'own'), true);
    assert.equal(urls.length, 1, 'no network writes in local-test mode');
    const h = await store.load(TOKEN);
    assert.equal(h.reply.answer, 'yes'); assert.deepEqual(h.reply.coming, [true, true]); assert.equal(h.stay.choice, 'own');
  });
  await withGlobals({ location: loc, fetch: reply(null, false) }, async () => {
    const h = await store.load(TOKEN);
    assert.equal(h.reply.answer, 'yes'); assert.equal(h.stay.choice, 'own');
  });
  await withGlobals({ location: loc, fetch: () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }) }, async () => {
    assert.equal((await store.load(TOKEN)).stay.choice, 'own');
  });
});

test('a blocked localStorage never throws', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  return withGlobals({ localStorage: boom }, () => {
    assert.equal(store.seenMinute(), false);
    assert.doesNotThrow(() => store.markSeen());
  });
});
test('seenMinute remembers after markSeen', () => {
  const m = {};
  const ls = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  return withGlobals({ localStorage: ls }, () => {
    assert.equal(store.seenMinute(), false); store.markSeen(); assert.equal(store.seenMinute(), true);
    assert.deepEqual(Object.keys(m), ['sj-first-seen']);
  });
});

test('rules: a link reads only its own household and writes are bounded', () => {
  const rules = JSON.parse(read('firebase.rules.json')).rules;
  assert.equal(rules.household['.read'], undefined);
  assert.equal(rules.household.$token['.read'], true);
  assert.match(rules.household.$token.reply['.write'], /1803859200000/);
  assert.match(rules.household.$token.stay['.write'], /=== 'later'/);
  assert.match(rules.household.$token['.validate'], /welcome/);
  assert.equal(rules.household.$token.reply.coming['.validate'], 'newData.hasChildren()');
  assert.equal(rules.household.$token.$other['.validate'], false);
});
test('invite.js remembers only when asked, and store.js and invite.js never log', () => {
  const inv = read('js/invite.js');
  assert.match(inv, /sj-invite-kept/);
  assert.equal((inv.match(/localStorage\.setItem/g) || []).length, 1);
  const rem = inv.slice(inv.indexOf('found.remember'), inv.indexOf('found.forget'));
  assert.match(rem, /localStorage\.setItem/);
  assert.doesNotMatch(inv, /console\./);
  assert.doesNotMatch(read('js/first/store.js'), /console\./);
});
