const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'invite.js'), 'utf8');
const A = 'tok_AAAAAAAAAAAAAAAA', B = 'tok_BBBBBBBBBBBBBBBB', C = 'tok_CCCCCCCCCCCCCCCC';
const tick = () => new Promise(r => setImmediate(r));

function storage(initial, throws) {
  const m = new Map(Object.entries(initial || {}));
  const boom = () => { throw new Error('blocked'); };
  return {
    map: m,
    getItem: throws ? boom : k => (m.has(k) ? m.get(k) : null),
    setItem: throws ? boom : (k, v) => { m.set(k, String(v)); },
    removeItem: throws ? boom : k => { m.delete(k); }
  };
}

// db: token -> { display, lines, people } (a missing token answers JSON null). mode 'fail' rejects, 'hang' never answers.
function load({ search = '', session, local, db = {}, mode = 'ok', throws = false }) {
  const sessionStorage = storage(session, throws), localStorage = storage(local, throws);
  const fetches = [], timers = [];
  const sandbox = {
    URLSearchParams, Promise, Uint8Array, Date, Math, Object, Array, JSON, String, Error,
    location: { search, pathname: '/', hash: '', hostname: 'example.test' },
    history: { state: null, replaceState() {} },
    sessionStorage, localStorage,
    navigator: { webdriver: false },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    fetch: (url, opts) => {
      fetches.push({ url, opts });
      if (mode === 'hang') return new Promise(() => {});
      if (mode === 'fail') return Promise.reject(new Error('offline'));
      const m = /welcome\/([^/]+)\/(\w+)\.json$/.exec(url);
      const rec = m && db[m[1]];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(rec ? (rec[m[2]] === undefined ? null : rec[m[2]]) : null) });
    }
  };
  sandbox.window = sandbox; sandbox.dispatchEvent = () => true;
  vm.runInNewContext(SRC, sandbox);
  const seenWrites = () => fetches.filter(f => /welcomeSeen/.test(f.url));
  return { w: sandbox, sessionStorage, localStorage, fetches, timers, seenWrites };
}
const invitation = { display: 'Alex and Sam', lines: ['a'], people: ['Alex', 'Sam'] };

test('no storage and no ?w=: the token is empty and nothing is asked', async () => {
  const r = load({});
  assert.equal(r.w.sjInvite.token, '');
  assert.equal(await r.w.sjInvite, null);
  assert.equal(r.fetches.length, 0);
});

test('a tab token wins over the kept key', async () => {
  const r = load({ session: { 'sj-invite': A }, local: { 'sj-invite-kept': B }, db: { [A]: invitation, [B]: invitation } });
  assert.equal(r.w.sjInvite.token, A);
  assert.equal((await r.w.sjInvite).token, A);
});

test('the kept key is used with no ?w= and no tab token, and records no visit', async () => {
  const r = load({ local: { 'sj-invite-kept': B }, db: { [B]: invitation } });
  assert.equal(r.w.sjInvite.token, B);
  assert.equal((await r.w.sjInvite).display, 'Alex and Sam');
  await tick();
  assert.equal(r.seenWrites().length, 0);
});

test('a fresh ?w= opening does record a visit (control for the test above)', async () => {
  const r = load({ search: '?w=' + A, db: { [A]: invitation } });
  await r.w.sjInvite; await tick();
  assert.equal(r.seenWrites().length, 1);
});

test('a database null for display clears the tab key and the kept key', async () => {
  const r = load({ session: { 'sj-invite': A }, local: { 'sj-invite-kept': A }, db: {} });
  assert.equal(await r.w.sjInvite, null);
  assert.equal(r.sessionStorage.map.has('sj-invite'), false);
  assert.equal(r.localStorage.map.has('sj-invite-kept'), false);
});

test('a timeout or a failed fetch clears nothing', async () => {
  const failed = load({ session: { 'sj-invite': A }, local: { 'sj-invite-kept': A }, mode: 'fail' });
  assert.equal(await failed.w.sjInvite, null);
  assert.equal(failed.sessionStorage.map.get('sj-invite'), A);
  assert.equal(failed.localStorage.map.get('sj-invite-kept'), A);
  assert.equal(failed.w.sjInvite.token, A);

  const hung = load({ session: { 'sj-invite': A }, local: { 'sj-invite-kept': A }, mode: 'hang' });
  hung.timers.forEach(fn => fn());
  assert.equal(await hung.w.sjInvite, null);
  assert.equal(hung.sessionStorage.map.get('sj-invite'), A);
  assert.equal(hung.localStorage.map.get('sj-invite-kept'), A);
  assert.equal(hung.w.sjInvite.token, A);
});

test('remember() and forget() never throw when storage throws', async () => {
  const r = load({ throws: true, search: '?w=' + A, db: { [A]: invitation } });
  assert.doesNotThrow(() => r.w.sjInvite.remember());
  await r.w.sjInvite;
  assert.doesNotThrow(() => r.w.sjInvite.remember());
  assert.doesNotThrow(() => r.w.sjInvite.forget());
});

test('remember() keeps the token once found, and forget() clears both keys', async () => {
  const r = load({ search: '?w=' + A, db: { [A]: invitation } });
  await r.w.sjInvite;
  r.w.sjInvite.remember();
  assert.equal(r.localStorage.map.get('sj-invite-kept'), A);
  r.w.sjInvite.forget();
  assert.equal(r.localStorage.map.has('sj-invite-kept'), false);
  assert.equal(r.sessionStorage.map.has('sj-invite'), false);
});

test('remember() never stores a token the database rejected, and waits for the lookup', async () => {
  const bad = load({ search: '?w=' + A, db: {} });
  bad.w.sjInvite.remember();
  await bad.w.sjInvite;
  bad.w.sjInvite.remember();
  assert.equal(bad.localStorage.map.has('sj-invite-kept'), false);

  const early = load({ search: '?w=' + A, db: { [A]: invitation } });
  early.w.sjInvite.remember();
  assert.equal(early.localStorage.map.has('sj-invite-kept'), false, 'not before the lookup answers');
  await early.w.sjInvite;
  assert.equal(early.localStorage.map.get('sj-invite-kept'), A);
});

test('a bad ?w= does not wipe a different, valid kept token', async () => {
  const r = load({ search: '?w=' + C, local: { 'sj-invite-kept': B }, db: { [B]: invitation } });
  assert.equal(await r.w.sjInvite, null);
  assert.equal(r.localStorage.map.get('sj-invite-kept'), B);
});

test('a database null sets token to empty; a timeout leaves it', async () => {
  const none = load({ search: '?w=' + C, db: {} });
  assert.equal(none.w.sjInvite.token, C, 'still set before the lookup answers');
  await none.w.sjInvite;
  assert.equal(none.w.sjInvite.token, '');
  const hung = load({ search: '?w=' + C, mode: 'hang' });
  hung.timers.forEach(fn => fn());
  await hung.w.sjInvite;
  assert.equal(hung.w.sjInvite.token, C);
});
