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

async function signupPageHarness() {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fixture = createFixture(), auth = fixture.firebase.auth(), elements = {}, writes = [];
  const radios = {}, store = {};
  const document = { activeElement: null, documentElement: { classList: { add() {} } } };
  function element(id) {
    return elements[id] ||= { id, value: '', hidden: false, disabled: false, readOnly: false, textContent: '', attributes: {}, listeners: {},
      classList: { add() {}, contains() { return false; } },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      removeAttribute(name) { delete this.attributes[name]; },
      getAttribute(name) { return this.attributes[name] ?? null; },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      focus() { document.activeElement = this; },
      checkValidity() { this.validityChecked = true; return !!this.value.trim() && /^[^\s@]+@[^\s@]+$/.test(this.value.trim()); },
      insertAdjacentHTML() {},
      reset() {
        const prefix = id === 'form-up' ? 'up-' : 'ed-';
        Object.values(elements).filter(el => el.id.startsWith(prefix) && !el.name).forEach(el => { el.value = ''; });
        Object.entries(radios).filter(([name]) => id === 'form-up' ? name === 'intent' || name.startsWith('up-') : name.startsWith('ed-')).forEach(([, group]) => group.forEach(radio => { radio.checked = false; }));
      }
    };
  }
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) element(match[1]).hidden = /\bhidden\b/.test(match[0]);
  for (const name of ['intent', 'ed-intent', 'up-pintent', 'ed-pintent']) {
    radios[name] = ['yes', 'maybe', 'no'].map(value => Object.assign(element(name + '-' + value), { name, value, checked: false }));
  }
  const google = [element('google-up'), element('google-in')], dividers = [element('or-up'), element('or-in')];
  document.getElementById = element;
  document.querySelectorAll = selector => selector.split(',').flatMap(part => {
    const query = part.trim(), radio = /^input\[name="([^"]+)"\](?:\[value="([^"]*)"\])?(:checked)?$/.exec(query);
    if (radio) return (radios[radio[1]] || []).filter(el => (!radio[2] || el.value === radio[2]) && (!radio[3] || el.checked));
    if (query === '[data-google]') return google;
    if (query === '.p-or') return dividers;
    return [];
  });
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  const db = fixture.firebase.database(), factory = fixture.firebase.database;
  fixture.firebase.database = () => ({ ref(name) {
    const ref = db.ref(name), update = ref.update;
    ref.update = patch => { writes.push({ path: name, patch }); return update(patch); };
    return ref;
  } });
  fixture.firebase.database.ServerValue = factory.ServerValue;
  const context = { document, window: {}, firebase: fixture.firebase, GuestRegistration: { createSession },
    location: { search: '', protocol: 'http:', origin: 'http://fictional.test', assign() {} },
    navigator: { userAgent: 'Fictional test browser' }, URLSearchParams, Date,
    localStorage: { setItem(key, value) { store[key] = value; }, getItem(key) { return store[key]; } },
    setTimeout() {}, setInterval() {}, clearTimeout() {} };
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInNewContext(script, context, { filename: 'index.html inline script' });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return { fixture, auth, element, document, writes, google, settle,
    choose(name, value) { radios[name].forEach(radio => { radio.checked = radio.value === value; }); const selected = radios[name].find(radio => radio.checked); if (selected?.listeners.change) selected.listeners.change(); },
    submit(id = 'form-up') { element(id).onsubmit({ preventDefault() {} }); },
    details() { element('up-name').value = 'Fictional Guest'; element('up-email').value = 'fictional@example.test'; element('up-pw').value = 'fictional-password'; }
  };
}

test('signup first step validates and Enter advances without creating an account', async () => {
  const h = await signupPageHarness();
  h.details(); h.submit(); await h.settle();
  assert.equal(h.fixture.history.filter(x => x.method === 'createUser').length, 0);
  assert.equal(h.element('up-reply').hidden, false);
  assert.equal(h.document.activeElement?.name, 'intent');
  h.choose('intent', 'yes'); h.submit(); await h.settle();
  assert.equal(h.fixture.history.filter(x => x.method === 'createUser').length, 0, 'Enter on reply must only advance');
  assert.equal(h.element('up-reply').hidden, true);
  assert.equal(h.element('up-details').hidden, false);
  assert.equal(h.document.activeElement?.id, 'up-details-heading');
  assert.equal(h.element('up-progress-details').getAttribute('aria-current'), 'step');
});

test('signup Back preserves draft and current choices without automatic advance', async () => {
  const h = await signupPageHarness();
  h.choose('intent', 'maybe');
  assert.equal(h.element('up-reply').hidden, false);
  assert.match(h.element('up-choice-hint').textContent, /February/);
  h.submit(); h.details(); h.element('up-phone').value = '07700 900000';
  h.element('up-back').onclick();
  assert.equal(h.document.activeElement?.id, 'up-reply-heading');
  assert.equal(h.element('up-email').value, 'fictional@example.test');
  h.submit();
  assert.equal(h.element('up-phone').value, '07700 900000');
  assert.equal(h.element('up-details').hidden, false);
});

test('final signup validates name, native email validity and password with focused feedback', async () => {
  const h = await signupPageHarness(); h.choose('intent', 'yes'); h.submit();
  h.submit(); assert.equal(h.document.activeElement?.id, 'up-name');
  h.details(); h.element('up-email').value = 'bad email'; h.submit();
  assert.equal(h.document.activeElement?.id, 'up-email');
  assert.equal(h.element('up-email').validityChecked, true);
  h.element('up-email').value = 'fictional@example.test'; h.element('up-pw').value = 'short'; h.submit();
  assert.equal(h.document.activeElement?.id, 'up-pw');
  assert.equal(h.fixture.history.filter(x => x.method === 'createUser').length, 0);
});

test('signup busy controls lock navigation and same-UID retry keeps the draft after a failed save', async () => {
  const h = await signupPageHarness(); h.choose('intent', 'yes'); h.submit(); h.details();
  h.fixture.failNext('update', 'registrations/fictional-1');
  const release = h.fixture.delayNext('createUser', 'fictional@example.test');
  h.submit();
  assert.equal(h.element('up-back').disabled, true); assert.equal(h.element('up-continue').disabled, true);
  h.element('up-back').onclick(); h.submit();
  assert.equal(h.element('up-details').hidden, false);
  release(); await h.settle();
  assert.equal(h.element('up-details').hidden, false);
  assert.equal(h.element('up-name').value, 'Fictional Guest');
  assert.equal(h.element('password-row').hidden, true);
  h.element('up-pw').value = ''; h.submit(); await h.settle();
  assert.equal(h.fixture.history.filter(x => x.method === 'createUser').length, 1);
  assert.equal(h.fixture.inspect().registrations['fictional-1'].name, 'Fictional Guest');
  assert.equal(h.element('done').hidden, false);
  assert.ok(h.writes.every(write => !Object.hasOwn(write.patch, 'partner')));
  h.fixture.signOut(); await h.settle();
  assert.equal(h.element('up-reply').hidden, false); assert.equal(h.element('up-details').hidden, true);
});

test('Google requires a reply but saves provider identity without manual email or password', async () => {
  const h = await signupPageHarness(); h.google[0].onclick(); await h.settle();
  assert.equal(h.fixture.history.filter(x => x.method === 'popup').length, 0);
  assert.equal(h.document.activeElement?.name, 'intent');
  h.choose('intent', 'yes'); h.submit(); h.google[0].onclick(); await h.settle();
  const saved = h.fixture.inspect().registrations['fictional-guest'];
  assert.equal(saved.name, 'Fictional Guest'); assert.equal(saved.email, 'guest@example.test');
  assert.equal(saved.partner, undefined);
  assert.equal(h.element('done').hidden, false);
});

test('signing in without a saved reply starts at the first incomplete step', async () => {
  const h = await signupPageHarness();
  h.fixture.signIn({ uid: 'missing', email: 'missing@example.test' }); await h.settle();
  assert.equal(h.element('up-reply').hidden, false); assert.equal(h.element('password-row').hidden, true);
  assert.equal(h.element('up-name').value, 'Fictional Guest');
  h.choose('intent', 'no'); h.submit(); h.submit(); await h.settle();
  assert.equal(h.fixture.inspect().registrations.missing.intent, 'no');
  assert.equal(h.fixture.history.filter(x => x.method === 'createUser').length, 0);
});

test('Google existing-account load preserves saved couple details and payment count', async () => {
  const h = await signupPageHarness(), partner = { name: 'Existing Partner', intent: 'yes', diet: 'Vegan' };
  h.fixture.seed({ registrations: { 'fictional-guest': { name: 'Existing Guest', intent: 'yes', partner } } });
  h.choose('intent', 'no'); h.submit(); h.google[0].onclick(); await h.settle();
  assert.equal(h.element('d-name').textContent, 'Existing Guest');
  assert.equal(h.element('dp-name').textContent, 'Existing Partner');
  assert.equal(h.element('pay-h').textContent, 'Your £300 for the weekend');
  assert.equal(h.writes.length, 0);
});

test('ordinary reply and travel edits preserve saved partner and their public binder pocket', async () => {
  const h = await signupPageHarness(), partner = { name: 'Existing Partner', intent: 'yes', diet: 'Vegan' };
  const pocket = { name: partner.name, line: 'Keep this', song: 'Keep that', partnerOf: 'couple' };
  h.fixture.seed({ registrations: { couple: { name: 'Existing Guest', intent: 'yes', partner, travel: { home: 'LHR', into: 'PSA' } } }, public: { profiles: { 'couple-p': pocket } } });
  h.fixture.signIn({ uid: 'couple' }); await h.settle();
  h.choose('ed-intent', 'no');
  assert.equal(h.element('ed-travel').hidden, false, 'saved attending partner still needs shared travel');
  h.element('ed-fin').value = 'AB 123'; h.submit('form-edit'); await h.settle();
  const data = h.fixture.inspect();
  assert.ok(h.writes.every(write => !Object.hasOwn(write.patch, 'partner')), 'ordinary edits must omit partner writes entirely');
  assert.deepEqual(data.registrations.couple.partner, partner);
  assert.equal(data.registrations.couple.travel.flightIn, 'AB123');
  assert.deepEqual(data.public.profiles['couple-p'], pocket);
  assert.equal(h.element('pay-h').textContent, 'Your £150 for the weekend');
  assert.ok(h.writes.every(write => !Object.hasOwn(write.patch, 'partner')));
  assert.equal(h.fixture.history.filter(x => x.method === 'remove').length, 0);
});
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
    paymentOperation: 0, registrationBusy: false, authUid: null, authVersion: 0, screenVersion: 0, current: null, formOwner: null, INAPP: false, window: {},
    session: { setUser() {} }, $: element, document: { querySelectorAll: () => [] },
    sameUser: user => !!(auth.currentUser && auth.currentUser.uid === user.uid),
    hideErr: id => { element(id).hidden = true; }, showErr: id => { element(id).hidden = false; },
    render() {}, fillTravel() {}, syncUpTravel() {}, syncChoiceHint() {}, setSignupStep() {}, busyRegistration() {}, recalled: () => null, entryParams: new URLSearchParams(''),
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
