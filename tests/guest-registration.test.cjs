'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createFixture = require('./fixtures/firebase-stub.js');
const { createSession } = require('../js/guest-registration.js');
function setup() {
  const fixture = createFixture();
  const auth = fixture.firebase.auth();
  const session = createSession(auth, fixture.firebase.database());
  auth.onAuthStateChanged(user => session.setUser(user));
  return { fixture, auth, session };
}
test('account with no record stays missing until a registration is acknowledged', async () => {
  const { fixture, auth, session } = setup();
  const account = await auth.createUserWithEmailAndPassword('guest@example.test', 'fictional-password');
  const uid = account.user.uid;
  assert.equal((await session.load()).status, 'missing');
  fixture.failNext('update', 'registrations/' + uid);
  await assert.rejects(session.save({ name: 'Fictional Guest', intent: 'yes' }));
  assert.equal(session.state().status, 'missing');
  assert.equal(fixture.inspect().registrations, undefined);
  const result = await session.save({ name: 'Fictional Guest', intent: 'yes' });
  assert.equal(result.status, 'saved');
  assert.equal(result.record.uid, uid);
  assert.equal(fixture.history.filter(x => x.method === 'createUser').length, 1);
});
test('a failed read is distinct from a missing record and prevents a blind overwrite', async () => {
  const { fixture, session } = setup();
  fixture.seed({ registrations: { a: { name: 'Keep', paymentSent: 1, contributions: { memory: 'Keep too' } } } });
  fixture.signIn({ uid: 'a' });
  fixture.failNext('once', 'registrations/a');
  assert.equal((await session.load()).status, 'error');
  fixture.failNext('once', 'registrations/a');
  await assert.rejects(session.save({ name: 'Replacement' }));
  assert.equal(fixture.history.filter(x => x.method === 'update').length, 0);
  await session.save({ intent: 'yes' });
  assert.equal(fixture.inspect().registrations.a.name, 'Keep');
  assert.equal(fixture.inspect().registrations.a.paymentSent, 1);
  assert.equal(fixture.inspect().registrations.a.contributions.memory, 'Keep too');
});
test('duplicate submits share one pending write and wait for acknowledgement', async () => {
  const { fixture, session } = setup();
  fixture.signIn({ uid: 'a' }); await session.load();
  const release = fixture.delayNext('update', 'registrations/a');
  const first = session.save({ intent: 'yes' }); const second = session.save({ intent: 'no' });
  await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(session.state().status, 'saved');
  release(); await Promise.all([first, second]);
  assert.equal(fixture.history.filter(x => x.method === 'update').length, 1);
  assert.equal(fixture.inspect().registrations.a.intent, 'yes');
});
test('old account read cannot replace the current account state', async () => {
  const { fixture, session } = setup();
  fixture.seed({ registrations: { a: { name: 'A' }, b: { name: 'B' } } });
  fixture.signIn({ uid: 'a' });
  const release = fixture.delayNext('once', 'registrations/a'); const old = session.load();
  fixture.signIn({ uid: 'b' }); await session.load(); release();
  assert.equal((await old).status, 'stale'); assert.equal(session.state().record.name, 'B');
});
test('auth change before write prevents saving under the old or new account', async () => {
  const { fixture, session } = setup();
  fixture.signIn({ uid: 'a' }); await session.load();
  const release = fixture.delayNext('once', 'registrations/a'); const saving = session.save({ intent: 'yes' });
  fixture.signIn({ uid: 'b' }); release();
  assert.equal((await saving).status, 'stale');
  assert.equal(fixture.history.filter(x => x.method === 'update').length, 0);
});
test('late write acknowledgement cannot expose the previous account summary', async () => {
  const { fixture, session } = setup(); fixture.signIn({ uid: 'a' }); await session.load();
  const release = fixture.delayNext('update', 'registrations/a'); const saving = session.save({ intent: 'yes' });
  await new Promise(resolve => setImmediate(resolve)); fixture.signOut(); release();
  assert.equal((await saving).status, 'stale'); assert.equal(session.state().record, null);
});

test('save preserves the original creation time and unrelated account data', async () => {
  const { fixture, session } = setup();
  fixture.seed({ registrations: { a: { name: 'Original', createdAt: 1234, paymentSent: 5678, contributions: { song: 'Keep' } } } });
  fixture.signIn({ uid: 'a' }); await session.load();
  const result = await session.save({ intent: 'maybe', uid: 'wrong' });
  assert.equal(result.record.createdAt, 1234);
  assert.equal(result.record.uid, 'a');
  assert.equal(result.record.paymentSent, 5678);
  assert.equal(result.record.contributions.song, 'Keep');
});
test('an older missing-record read cannot erase a newly acknowledged save', async () => {
  const { fixture, session } = setup(); fixture.signIn({ uid: 'a' }); await session.load();
  const release = fixture.delayNext('once', 'registrations/a'); const oldLoad = session.load();
  await session.save({ name: 'Saved Guest', intent: 'yes' }); release();
  assert.equal((await oldLoad).status, 'stale');
  assert.equal(session.state().record.name, 'Saved Guest');
});

test('a stalled registration read offers recovery instead of loading forever', async () => {
  const fixture = createFixture(), auth = fixture.firebase.auth();
  const session = createSession(auth, fixture.firebase.database(), { timeoutMs: 10 });
  fixture.signIn({ uid: 'a' }); session.setUser(auth.currentUser);
  const release = fixture.delayNext('once', 'registrations/a');
  assert.equal((await session.load()).status, 'error'); release();
  assert.equal(session.state().status, 'error');
});
test('an unacknowledged write is labelled uncertain and can be reconciled at the same UID', async () => {
  const fixture = createFixture(), auth = fixture.firebase.auth();
  const session = createSession(auth, fixture.firebase.database(), { timeoutMs: 10 });
  fixture.signIn({ uid: 'a' }); session.setUser(auth.currentUser); await session.load();
  const release = fixture.delayNext('update', 'registrations/a');
  await assert.rejects(session.save({ name: 'Fictional Guest', intent: 'yes' }), error => error.code === 'registration/uncertain');
  assert.notEqual(session.state().status, 'saved');
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await session.load()).record.name, 'Fictional Guest');
});

function paymentPageHarness() {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').replace(/\r\n/g, '\n');
  const fixture = createFixture(), auth = fixture.firebase.auth(), elements = {};
  const element = id => elements[id] ||= { value: '', textContent: '', hidden: false, disabled: false, readOnly: false, reset() {}, setAttribute() {} };
  element('pay-sent-ok').hidden = true;
  const context = { auth, db: fixture.firebase.database(), firebase: fixture.firebase, PREVIEW: false,
    paymentOperation: 0, registrationBusy: false, authUid: null, screenVersion: 0, current: null, formOwner: null, INAPP: false,
    session: { setUser() {} }, $: element, document: { querySelectorAll: () => [] },
    sameUser: user => !!(auth.currentUser && auth.currentUser.uid === user.uid),
    hideErr: id => { element(id).hidden = true; }, showErr: id => { element(id).hidden = false; },
    render() {}, setPartner() {}, busyRegistration() {}, recalled: () => null, entryParams: new URLSearchParams(''),
    loadReply(user) { context.current = fixture.inspect().registrations[user.uid]; }, Date };
  vm.createContext(context);
  const paymentStart = html.indexOf('  $("pay-sent").onclick = function () {');
  const paymentEnd = html.indexOf('\n\n  var PREVIEW', paymentStart);
  const authStart = html.indexOf('  auth.onAuthStateChanged(function (u) {', paymentEnd);
  const authEnd = html.indexOf('\n\n  function registrationFields()', authStart);
  assert.ok(paymentStart > 0 && authStart > paymentStart, 'exercise actual index DOM handlers');
  vm.runInContext(html.slice(paymentStart, paymentEnd) + '\n' + html.slice(authStart, authEnd), context);
  fixture.seed({ registrations: { a: { name: 'A', intent: 'yes' }, b: { name: 'B', intent: 'yes' } } });
  return { fixture, element, context };
}
for (const outcome of ['acknowledged', 'failed']) {
  for (const nextUid of ['b', 'a']) {
  test('actual payment DOM handler isolates stale ' + outcome + ' report after signing in as ' + nextUid, async () => {
    const { fixture, element, context } = paymentPageHarness();
    fixture.signIn({ uid: 'a', email: 'a@example.test' });
    let settle;
    const pending = new Promise((resolve, reject) => { settle = outcome === 'acknowledged' ? resolve : () => reject(new Error('Fictional failure')); });
    const db = context.db;
    let interceptFirst = true;
    context.db = { ref(path) { if (path === 'registrations/a' && interceptFirst) { interceptFirst = false; return { update: () => pending }; } return db.ref(path); } };
    element('pay-sent').onclick();
    assert.equal(element('pay-sent').disabled, true);
    fixture.signOut(); fixture.signIn({ uid: nextUid, email: nextUid + '@example.test' });
    assert.equal(element('pay-sent').disabled, false, 'new account must be able to report its own transfer');
    const releaseB = fixture.delayNext('update', 'registrations/' + nextUid);
    element('pay-sent').onclick();
    assert.equal(element('pay-sent').disabled, true);
    settle(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(element('pay-sent').disabled, true, 'old completion must not unlock the new account pending write');
    assert.equal(element('pay-sent-ok').hidden, true);
    assert.equal(context.current.paymentSent, undefined);
    assert.equal(element('pay-err').hidden, true);
    releaseB(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(element('pay-sent').disabled, false);
    assert.equal(element('pay-sent-ok').hidden, false);
  });
}

}
