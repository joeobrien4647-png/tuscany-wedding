const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function api(file) { return fs.existsSync(path.join(root, file)) ? require(path.join(root, file)) : {}; }
const participation = api('js/guest-participation.js');
const inbox = api('js/guest-inbox.js');
const registered = { name: 'Fictional Guest', email: 'fictional@example.invalid', intent: 'yes' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function snapshot(value) {
  return { val: () => value, exists: () => value !== null && value !== undefined,
    forEach(fn) { Object.keys(value || {}).sort().forEach(key => fn({ key, val: () => value[key] })); } };
}
function database(records = {}) {
  const calls = [], reads = [], writes = [];
  return { calls, reads, writes, ref(p) {
    const q = { path: p, first: null, start: null };
    return { orderByKey() { calls.push(['order', p]); return this; }, limitToFirst(n) { q.first = n; return this; }, startAt(k) { q.start = k; return this; },
      once() { calls.push(['read', p, q.first, q.start]); const pending = reads.shift(); if (pending) return pending.promise; let value = records[p] ?? null; if (q.first && value) value = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([key]) => !q.start || key >= q.start).slice(0, q.first)); return Promise.resolve(snapshot(value)); },
      update(value) { calls.push(['update', p, value]); const pending = writes.shift(); return pending ? pending.promise : Promise.resolve(); }
    };
  } };
}
test('participation loads only authenticated owner and requires a full registration', async () => {
  assert.equal(typeof participation.createController, 'function', 'participation controller must exist');
  const db = database({ 'registrations/guest': { name: 'unfinished' } });
  const c = participation.createController({ db });
  await c.setUser(null);
  assert.deepEqual(db.calls, []);
  await c.setUser({ uid: 'guest' });
  assert.equal(c.getState().status, 'registration-required');
  await assert.rejects(c.save('song', 'A song'), /registration/i);
  assert.deepEqual(db.calls.map(x => x[1]), ['registrations/guest']);
});
test('failed owner writes preserve draft, reuse fixed retry path, and never replace registration', async () => {
  const db = database({ 'registrations/guest': registered });
  const c = participation.createController({ db, timestamp: 123 });
  await c.setUser({ uid: 'guest' });
  const pending = deferred(); db.writes.push(pending);
  const save = c.save('song', 'Artist — Song');
  await assert.rejects(c.save('song', 'Second click'), /saving/i);
  pending.reject(new Error('network')); await assert.rejects(save, /network/);
  assert.equal(c.getState().drafts.song, 'Artist — Song');
  assert.equal(c.getState().feedback.song, 'error');
  await c.save('song', 'Artist — Song');
  const writes = db.calls.filter(x => x[0] === 'update');
  assert.deepEqual(writes.map(x => x[1]), ['registrations/guest/contributions/song', 'registrations/guest/contributions/song']);
  assert.deepEqual(writes[1][2], { text: 'Artist — Song', updatedAt: 123 });
  assert.equal(c.getState().feedback.song, 'saved');
});
test('read errors remain errors and retry can recover', async () => {
  const db = database({ 'registrations/guest': registered });
  const pending = deferred(); db.reads.push(pending);
  const c = participation.createController({ db }); const loading = c.setUser({ uid: 'guest' });
  pending.reject(new Error('denied')); await loading;
  assert.equal(c.getState().status, 'read-error');
  await c.reload(); assert.equal(c.getState().status, 'ready');
});
test('late reads and save acknowledgements cannot enter another session', async () => {
  const db = database({ 'registrations/other': registered });
  const pending = deferred(); db.reads.push(pending);
  const c = participation.createController({ db });
  const loading = c.setUser({ uid: 'guest' }); await c.setUser({ uid: 'other' });
  pending.resolve(snapshot({ ...registered, contributions: { song: { text: 'Old private draft' } } })); await loading;
  assert.equal(c.getState().drafts.song, '');
  const saving = deferred(); db.writes.push(saving);
  const save = c.save('memory', 'Private memory'); await c.setUser(null); saving.resolve(); await save;
  assert.equal(c.getState().status, 'signed-out');
  assert.equal(c.getState().drafts.memory, '');
  assert.equal(c.getState().feedback.memory, '');
});
test('inbox denies before private reads, even when admin lookup fails', async () => {
  assert.equal(typeof inbox.createController, 'function', 'inbox controller must exist');
  const db = database(); const c = inbox.createController({ db });
  await c.setUser({ uid: 'guest' });
  assert.equal(c.getState().status, 'denied');
  assert.deepEqual(db.calls.map(x => x[1]), ['admins/guest']);
  const denied = deferred(); db.reads.push(denied);
  const lookup = c.setUser({ uid: 'guest' }); denied.reject(new Error('denied')); await lookup;
  assert.equal(c.getState().status, 'auth-error');
  assert.equal(db.calls.some(x => x[1] === 'registrations'), false);
});
test('admin verification precedes bounded lazy inbox reads and strips personal fields', async () => {
  const records = {};
  for (let i = 0; i < 21; i++) records[String(i).padStart(2, '0')] = { ...registered, phone: 'PRIVATE', contributions: { song: { text: '<script>alert(1)</script>', updatedAt: 12 } } };
  const db = database({ 'admins/admin': true, registrations: records });
  const c = inbox.createController({ db }); await c.setUser({ uid: 'admin' });
  assert.deepEqual(db.calls.filter(x => x[0] === 'read').map(x => x[1]), ['admins/admin']);
  await c.loadNext();
  assert.equal(c.getState().rows.length, 20);
  assert.deepEqual(Object.keys(c.getState().rows[0]).sort(), ['kind', 'sender', 'text', 'updatedAt']);
  assert.equal(c.getState().rows[0].sender, registered.name);
  assert.deepEqual(db.calls.find(x => x[1] === 'registrations' && x[0] === 'read'), ['read', 'registrations', 21, null]);
  assert.equal(c.getState().hasMore, true);
  await c.loadNext();
  assert.deepEqual(db.calls.filter(x => x[0] === 'read').at(-1), ['read', 'registrations', 21, '19']);
  assert.equal(c.getState().rows.length, 21);
  assert.equal(c.getState().hasMore, false);
});
test('admin auth races never start or display another session private data', async () => {
  const db = database(); const pending = deferred(); db.reads.push(pending);
  const c = inbox.createController({ db }); const lookup = c.setUser({ uid: 'admin' });
  await c.setUser(null); pending.resolve(snapshot(true)); await lookup;
  assert.equal(c.getState().status, 'signed-out');
  assert.equal(db.calls.some(x => x[1] === 'registrations'), false);
});
test('inbox discards late private reads and locks duplicate page requests', async () => {
  const db = database({ 'admins/admin': true }); const c = inbox.createController({ db });
  await c.setUser({ uid: 'admin' });
  const pending = deferred(); db.reads.push(pending);
  const loading = c.loadNext(); await c.loadNext();
  assert.equal(db.calls.filter(x => x[0] === 'read' && x[1] === 'registrations').length, 1);
  await c.setUser(null);
  pending.resolve(snapshot({ guest: { contributions: { memory: { text: 'Private old session' } } } })); await loading;
  assert.deepEqual(c.getState().rows, []);
  assert.equal(c.getState().status, 'signed-out');
});
test('inbox read failures retain the page cursor for an explicit retry', async () => {
  const db = database({ 'admins/admin': true }); const c = inbox.createController({ db });
  await c.setUser({ uid: 'admin' });
  const pending = deferred(); db.reads.push(pending);
  const loading = c.loadNext(); pending.reject(new Error('offline')); await loading;
  assert.equal(c.getState().status, 'read-error');
  assert.equal(c.getState().loaded, false);
  await c.loadNext();
  assert.equal(c.getState().status, 'ready');
  assert.equal(c.getState().loaded, true);
  assert.deepEqual(db.calls.filter(x => x[0] === 'read' && x[1] === 'registrations').map(x => x[3]), [null, null]);
});
test('invalid blank contributions show visible feedback without a write', async () => {
  const db = database({ 'registrations/guest': registered }); const c = participation.createController({ db });
  await c.setUser({ uid: 'guest' });
  await assert.rejects(c.save('memory', '   '), /enter/i);
  assert.equal(c.getState().feedback.memory, 'invalid');
  assert.equal(db.calls.filter(x => x[0] === 'update').length, 0);
});
test('inbox renders hostile saved text literally using DOM text nodes', async () => {
  const hostileName = '<script>alert(2)</script>' + 'x'.repeat(200);
  const db = database({ 'admins/admin': true, registrations: { guest: { ...registered, name: hostileName, phone: 'PRIVATE_PHONE', address: 'PRIVATE_ADDRESS', contributions: { memory: { text: '<img src=x onerror=alert(1)>', updatedAt: 123 } } } } });
  const elements = {};
  function element() { return { textContent: '', hidden: false, style: {}, children: [], handlers: {}, append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; }, addEventListener(event, fn) { this.handlers[event] = fn; } }; }
  const doc = { getElementById(id) { return elements[id] ||= element(); }, createElement() { return element(); } };
  const firebase = { apps: [{}], database: () => db, auth: () => ({ onAuthStateChanged(fn) { fn({ uid: 'admin' }); } }) };
  inbox.mount({ document: doc, firebase });
  await new Promise(resolve => setImmediate(resolve));
  elements['inbox-load'].handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['inbox-items'].children[0].children[0].textContent, hostileName.slice(0, 120) + ': Memory');
  assert.equal(elements['inbox-items'].children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
  assert.doesNotMatch(JSON.stringify(elements['inbox-items']), /fictional@example|PRIVATE_PHONE|PRIVATE_ADDRESS/);
});
test('never-settling owner reads recover to an explicit retry state', async () => {
  const db = database({ 'registrations/guest': registered });
  const pending = deferred(); db.reads.push(pending);
  const c = participation.createController({ db, timeoutMs: 5 });
  await c.setUser({ uid: 'guest' });
  assert.equal(c.getState().status, 'read-error');
  await c.reload();
  assert.equal(c.getState().status, 'ready');
  pending.resolve(snapshot({ ...registered, contributions: { song: { text: 'Late stale value' } } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.getState().drafts.song, '');
});
test('unacknowledged saves unlock a safe fixed-key retry and ignore late success', async () => {
  const db = database({ 'registrations/guest': registered });
  const c = participation.createController({ db, timeoutMs: 5 });
  await c.setUser({ uid: 'guest' });
  const pending = deferred(); db.writes.push(pending);
  await assert.rejects(c.save('memory', 'Draft retained'), /confirm/i);
  assert.equal(c.getState().feedback.memory, 'uncertain');
  assert.equal(c.getState().drafts.memory, 'Draft retained');
  assert.equal(c.getState().saving.memory, false);
  pending.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.getState().feedback.memory, 'uncertain');
  await c.save('memory', 'Edited retry');
  assert.equal(c.getState().feedback.memory, 'saved');
  assert.deepEqual(db.calls.filter(x => x[0] === 'update').map(x => x[1]), ['registrations/guest/contributions/memory', 'registrations/guest/contributions/memory']);
});
test('late first save acknowledgement cannot override a newer failed retry', async () => {
  const db = database({ 'registrations/guest': registered });
  const c = participation.createController({ db, timeoutMs: 5 });
  await c.setUser({ uid: 'guest' });
  const first = deferred(); db.writes.push(first);
  await assert.rejects(c.save('song', 'First draft'));
  const second = deferred(); db.writes.push(second);
  const retry = c.save('song', 'Changed draft'); second.reject(new Error('offline')); await assert.rejects(retry);
  first.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.getState().feedback.song, 'error');
  assert.equal(c.getState().drafts.song, 'Changed draft');
});
test('inbox deadlines recover admin verification and private-page loading', async () => {
  const db = database({ 'admins/admin': true, registrations: {} });
  const adminRead = deferred(); db.reads.push(adminRead);
  const c = inbox.createController({ db, timeoutMs: 5 });
  await c.setUser({ uid: 'admin' });
  assert.equal(c.getState().status, 'auth-error');
  assert.equal(db.calls.some(x => x[1] === 'registrations'), false);
  await c.reload();
  const pageRead = deferred(); db.reads.push(pageRead);
  await c.loadNext();
  assert.equal(c.getState().status, 'read-error');
  assert.equal(c.getState().loading, false);
  await c.loadNext();
  assert.equal(c.getState().status, 'ready');
  adminRead.resolve(snapshot(true));
  pageRead.resolve(snapshot({ guest: { ...registered, contributions: { song: { text: 'Late private result' } } } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(c.getState().rows, []);
});
test('both page mounts initialise against the shared fictional Firebase fixture', async () => {
  const createFixture = require('./fixtures/firebase-stub.js');
  for (const [pageApi, statusId] of [[participation, 'participation-status'], [inbox, 'inbox-status']]) {
    const fixture = createFixture();
    fixture.seed({ registrations: { guest: registered }, admins: { guest: true } });
    fixture.signIn({ uid: 'guest' });
    const elements = {};
    const doc = { getElementById(id) { return elements[id] ||= { value: '', textContent: '', style: {}, hidden: false, replaceChildren() {}, addEventListener() {} }; } };
    pageApi.mount({ document: doc, firebase: fixture.firebase });
    await new Promise(resolve => setImmediate(resolve));
    assert.doesNotMatch(elements[statusId].textContent, /could not connect/);
    if (pageApi === participation) {
      assert.equal(elements[statusId].textContent, 'Your song request and memory are visible to you and the website administrators.');
    }
    assert.equal(fixture.history.some(entry => entry.method === 'once'), true);
  }
});
test('pages use safe text rendering, private messaging, shared navigation and no unavailable uploads', () => {
  for (const file of ['js/guest-participation.js', 'js/guest-inbox.js']) {
    const source = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
    assert.match(source, /textContent/);
    assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage|setInterval/);
  }
  for (const file of ['join-in.html', 'guest-inbox.html']) {
    const html = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
    assert.match(html, /css\/guest-journey.css/);
    assert.match(html, /href="index.html/);
  }
  const join = fs.readFileSync(path.join(root, 'join-in.html'), 'utf8');
  assert.match(join, /Your song request and memory are visible to you and the website administrators\./);
  assert.match(join, /will not be added to a public playlist/);
  assert.match(join, /ask you separately before sharing a memory/);
  assert.doesNotMatch(join, /visible only to Sophie and Joe/i);
  assert.doesNotMatch(join, /private song request or memory/i);
  assert.doesNotMatch(join, /photos.*later/i);
  assert.doesNotMatch(join, /type="file"/);
});
