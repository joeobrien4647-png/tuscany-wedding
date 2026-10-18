const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const createFixture = require('./fixtures/firebase-stub.js');
const { createSession } = require('../js/guest-registration.js');
const { createPreview } = require('../js/guest-card-preview.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function dom() {
  const elements = {};
  function element(id) {
    return elements[id] ||= { id, value: '', textContent: '', hidden: false, listeners: {}, attributes: {},
      addEventListener(event, listener) { this.listeners[event] = listener; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      classList: { add() {}, contains() { return false; } }, reset() {}, focus() {}, insertAdjacentHTML() {},
      set innerHTML(value) { if (id.startsWith('guest-card-')) throw new Error('Guest card must never use HTML rendering'); }
    };
  }
  const document = { getElementById: element, querySelectorAll() { return []; }, querySelector() { return null; }, documentElement: { classList: { add() {} } } };
  for (const id of ['done', 'd-name', 'pr-line', 'pr-song', 'guest-card-preview', 'guest-card-name', 'guest-card-line', 'guest-card-song']) element(id);
  return { document, element };
}

function ready() {
  const h = dom();
  h.element('d-name').textContent = 'Fictional Guest';
  h.controller = createPreview(h.document);
  return h;
}

test('preview renders the existing name and useful empty-field placeholders', () => {
  const h = ready();
  h.controller.refresh();
  assert.equal(h.element('guest-card-preview').hidden, false);
  assert.equal(h.element('guest-card-name').textContent, 'Fictional Guest');
  assert.match(h.element('guest-card-line').textContent, /about you/i);
  assert.match(h.element('guest-card-song').textContent, /song/i);
});

test('typing updates only text and respects the saved field length', () => {
  const h = ready();
  h.element('pr-line').value = '  We met at university  ';
  h.element('pr-line').listeners.input();
  assert.equal(h.element('guest-card-line').textContent, 'We met at university');
  h.element('pr-song').value = 'x'.repeat(150);
  h.element('pr-song').listeners.input();
  assert.equal(h.element('guest-card-song').textContent.length, 120);
});

test('markup and script-like guest strings are rendered as literal text', () => {
  const h = ready(), payload = '<img src=x onerror=alert(1)>';
  h.element('d-name').textContent = payload;
  h.element('pr-line').value = payload;
  h.element('pr-song').value = '<script>steal()</script>';
  h.controller.refresh();
  assert.equal(h.element('guest-card-name').textContent, payload);
  assert.equal(h.element('guest-card-line').textContent, payload);
  assert.equal(h.element('guest-card-song').textContent, '<script>steal()</script>');
});

test('clear removes all previous identity and hides the preview', () => {
  const h = ready(); h.controller.refresh(); h.controller.clear();
  assert.equal(h.element('guest-card-preview').hidden, true);
  for (const id of ['guest-card-name', 'guest-card-line', 'guest-card-song']) assert.equal(h.element(id).textContent, '');
  h.element('done').hidden = true;
  h.element('pr-line').listeners.input();
  assert.equal(h.element('guest-card-preview').hidden, true);
  assert.equal(h.element('guest-card-name').textContent, '');
});

test('preview needs no network, Firebase or storage and tolerates a missing mount', () => {
  const h = dom(), browser = { document: h.document };
  for (const name of ['firebase', 'fetch', 'localStorage', 'sessionStorage']) Object.defineProperty(browser, name, { get() { throw new Error('No network or storage access'); } });
  vm.runInNewContext(read('js/guest-card-preview.js'), { window: browser });
  h.element('d-name').textContent = 'Fictional Guest';
  browser.GuestCardPreview.refresh();
  h.element('pr-line').value = 'Draft only'; h.element('pr-line').listeners.input();
  browser.GuestCardPreview.clear();
  const missing = createPreview({ getElementById() { return null; } });
  missing.refresh(); missing.clear();
});

async function page() {
  const h = dom(), fixture = createFixture(), auth = fixture.firebase.auth(), html = read('index.html'), store = {};
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) h.element(match[1]).hidden = /\bhidden\b/.test(match[0]);
  const browser = { document: h.document, GuestCardPreview: createPreview(h.document) };
  const context = { window: browser, document: h.document, firebase: fixture.firebase, GuestRegistration: { createSession },
    location: { search: '', protocol: 'http:', origin: 'http://fictional.test', assign() {} }, navigator: { userAgent: 'Fictional test browser' },
    URLSearchParams, Date, localStorage: { getItem(key) { return store[key]; }, setItem(key, value) { store[key] = value; } },
    setTimeout() {}, setInterval() {}, clearTimeout() {} };
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1], context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return { ...h, fixture, auth, settle };
}

test('real page refreshes hydrated fields and only explicit Save my pocket writes', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' } }, public: { profiles: { one: { line: 'Saved line', song: 'Saved song' } } } });
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  assert.equal(h.element('guest-card-name').textContent, 'Fictional One');
  assert.equal(h.element('guest-card-line').textContent, 'Saved line');
  h.element('pr-line').value = 'Changed locally'; h.element('pr-line').listeners.input();
  assert.equal(h.element('guest-card-line').textContent, 'Changed locally');
  assert.equal(h.fixture.history.filter(item => ['set', 'update', 'remove'].includes(item.method)).length, 0);
  h.element('form-profile').onsubmit({ preventDefault() {} }); await h.settle();
  assert.equal(h.fixture.inspect().public.profiles.one.line, 'Changed locally');
  assert.equal(h.fixture.history.filter(item => item.method === 'set').length, 1);
  h.fixture.signOut(); await h.settle();
  assert.equal(h.element('guest-card-preview').hidden, true);
  assert.equal(h.element('guest-card-name').textContent, '');
});

test('delayed previous-account hydration cannot restore another guest card', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' }, two: { name: 'Fictional Two', intent: 'yes' } }, public: { profiles: { one: { line: 'Old account' }, two: { line: 'Current account' } } } });
  const release = h.fixture.delayNext('once', 'public/profiles/one');
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.fixture.signIn({ uid: 'two' });
  assert.equal(h.element('guest-card-preview').hidden, true);
  assert.equal(h.element('guest-card-name').textContent, '');
  await h.settle(); release(); await h.settle();
  assert.equal(h.element('guest-card-name').textContent, 'Fictional Two');
  assert.equal(h.element('guest-card-line').textContent, 'Current account');
});

test('returning to the same account does not accept hydration from its earlier session', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' } }, public: { profiles: { one: { line: 'Saved line' } } } });
  const release = h.fixture.delayNext('once', 'public/profiles/one');
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.fixture.signOut(); h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.element('pr-line').value = 'Fresh draft'; h.element('pr-line').listeners.input();
  release(); await h.settle();
  assert.equal(h.element('guest-card-line').textContent, 'Fresh draft');
  assert.equal(h.element('pr-line').value, 'Fresh draft');
});
