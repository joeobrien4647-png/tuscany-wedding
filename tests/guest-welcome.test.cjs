const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const createFixture = require('./fixtures/firebase-stub.js');
const { createSession } = require('../js/guest-registration.js');
const { createWelcome } = require('../js/guest-welcome.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function dom() {
  const elements = {}, radios = {};
  const document = { activeElement: null, documentElement: { classList: { add() {} } } };
  function element(id) {
    return elements[id] ||= { id, value: '', textContent: '', hidden: false, listeners: {}, attributes: {},
      addEventListener(event, listener) { this.listeners[event] = listener; },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key] ?? null; },
      removeAttribute(key) { delete this.attributes[key]; },
      classList: { add() {}, contains() { return false; } }, reset() {}, insertAdjacentHTML() {},
      focus() { document.activeElement = this; },
      click() { if (this.onclick) this.onclick(); if (this.listeners.click) this.listeners.click(); },
      set innerHTML(value) { if (id.startsWith('guest-welcome')) throw new Error('Welcome must render literal text'); }
    };
  }
  document.getElementById = element;
  document.querySelectorAll = query => {
    const match = /^input\[name="([^"]+)"\](?:\[value="([^"]*)"\])?(:checked)?$/.exec(query);
    return match ? (radios[match[1]] || []).filter(r => (!match[2] || r.value === match[2]) && (!match[3] || r.checked)) : [];
  };
  document.querySelector = query => document.querySelectorAll(query)[0] || null;
  for (const name of ['intent', 'ed-intent']) radios[name] = ['yes', 'maybe', 'no'].map(value => Object.assign(element(name + '-' + value), { name, value, checked: false }));
  return { document, element, choose(name, value) { radios[name].forEach(r => { r.checked = r.value === value; }); } };
}

function ready() {
  const h = dom();
  h.element('d-name').textContent = 'Fictional Guest';
  h.controller = createWelcome(h.document);
  return h;
}

test('welcome renders one literal line without a fabricated letter or extra action', () => {
  const h = ready();
  h.element('d-name').textContent = '<img src=x onerror=alert(1)>';
  h.controller.refresh('yes');
  assert.equal(h.element('guest-welcome').hidden, false);
  assert.equal(h.element('guest-welcome').textContent, '<img src=x onerror=alert(1)>, see you in Tuscany.');
  for (const intent of ['no', 'maybe', '', undefined, 'unexpected']) {
    h.controller.refresh(intent);
    assert.equal(h.element('guest-welcome').textContent, '<img src=x onerror=alert(1)>, thank you for letting us know.');
    assert.doesNotMatch(h.element('guest-welcome').textContent, /see you|letter|with love/i);
  }
});

test('clear, missing name and hidden reply erase the previous welcome', () => {
  const h = ready(); h.controller.refresh('yes'); h.controller.clear();
  assert.equal(h.element('guest-welcome').hidden, true);
  assert.equal(h.element('guest-welcome').textContent, '');
  h.element('done').hidden = true; h.controller.refresh('yes');
  assert.equal(h.element('guest-welcome').hidden, true);
  h.element('done').hidden = false; h.element('d-name').textContent = ' '; h.controller.refresh('yes');
  assert.equal(h.element('guest-welcome').hidden, true);
});

test('welcome has no network, Firebase, storage or timer dependency and tolerates missing mounts', () => {
  const h = dom(), browser = { document: h.document };
  for (const key of ['firebase', 'fetch', 'localStorage', 'sessionStorage', 'setInterval', 'setTimeout']) Object.defineProperty(browser, key, { get() { throw new Error('Unnecessary dependency'); } });
  vm.runInNewContext(read('js/guest-welcome.js'), { window: browser });
  h.element('d-name').textContent = 'Fictional Guest'; browser.GuestWelcome.refresh('yes'); browser.GuestWelcome.clear();
  const missing = createWelcome({ getElementById() { return null; } }); missing.refresh('yes'); missing.clear();
});

async function page(enabled = true) {
  const h = dom(), fixture = createFixture(), html = read('index.html'), store = {};
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) h.element(match[1]).hidden = /\bhidden\b/.test(match[0]);
  const browser = { document: h.document };
  if (enabled) browser.GuestWelcome = createWelcome(h.document);
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1], {
    window: browser, document: h.document, firebase: fixture.firebase, GuestRegistration: { createSession },
    location: { search: '', protocol: 'http:', origin: 'http://fictional.test', assign() {} }, navigator: { userAgent: 'Fictional test browser' },
    URLSearchParams, Date, localStorage: { getItem(key) { return store[key]; }, setItem(key, value) { store[key] = value; } },
    setTimeout() {}, setInterval() {}, clearTimeout() {}
  });
  const settle = () => new Promise(resolve => setImmediate(resolve)); await settle();
  return { ...h, fixture, settle };
}

test('real page hides old identity immediately on account swap and rejects delayed registration', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' }, two: { name: 'Fictional Two', intent: 'no' } } });
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  assert.equal(h.element('guest-welcome').textContent, 'Fictional One, see you in Tuscany.');
  const release = h.fixture.delayNext('once', 'registrations/two');
  h.fixture.signIn({ uid: 'two' });
  assert.equal(h.element('guest-welcome').hidden, true);
  assert.equal(h.element('guest-welcome').textContent, '');
  h.fixture.signIn({ uid: 'one' }); await h.settle(); release(); await h.settle();
  assert.equal(h.element('guest-welcome').textContent, 'Fictional One, see you in Tuscany.');
});

test('signout and a return to the same account ignore an earlier session read', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' } } });
  const release = h.fixture.delayNext('once', 'registrations/one');
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.fixture.signOut();
  assert.equal(h.element('guest-welcome').hidden, true);
  assert.equal(h.element('guest-welcome').textContent, '');
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.choose('ed-intent', 'no'); h.element('form-edit').onsubmit({ preventDefault() {} }); await h.settle();
  release(); await h.settle();
  assert.equal(h.element('guest-welcome').textContent, 'Fictional One, thank you for letting us know.');
});

test('missing and failed registrations do not show stale personal notes', async () => {
  const h = await page();
  h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'yes' }, failure: { name: 'Fictional Failure', intent: 'yes' } } });
  h.fixture.signIn({ uid: 'one' }); await h.settle();
  h.fixture.signIn({ uid: 'missing' }); await h.settle();
  assert.equal(h.element('guest-welcome').hidden, true);
  assert.equal(h.element('guest-welcome').textContent, '');
  h.fixture.failNext('once', 'registrations/failure');
  h.fixture.signIn({ uid: 'failure' }); await h.settle();
  assert.equal(h.element('registration-recovery').hidden, false);
  assert.equal(h.element('guest-welcome').hidden, true);
  assert.equal(h.element('guest-welcome').textContent, '');
});

test('existing reply editor refreshes the plain welcome without additional database work', async () => {
  async function scenario(enabled) {
    const h = await page(enabled);
    h.fixture.seed({ registrations: { one: { name: 'Fictional One', intent: 'maybe', partner: { name: 'Saved companion', intent: 'yes' } } } });
    h.fixture.signIn({ uid: 'one' }); await h.settle();
    if (enabled) {
      h.element('reply-action').click();
      assert.equal(h.element('form-edit').hidden, false);
      assert.equal(h.document.activeElement.name, 'ed-intent');
    }
    h.choose('ed-intent', 'yes'); h.element('form-edit').onsubmit({ preventDefault() {} }); await h.settle();
    if (enabled) {
      assert.equal(h.element('guest-welcome').textContent, 'Fictional One, see you in Tuscany.');
    }
    return h;
  }
  const withWelcome = await scenario(true), withoutWelcome = await scenario(false);
  assert.deepEqual(withWelcome.fixture.history, withoutWelcome.fixture.history);
  assert.deepEqual(withWelcome.fixture.inspect(), withoutWelcome.fixture.inspect());
  assert.equal(withWelcome.fixture.inspect().registrations.one.partner.name, 'Saved companion');
  assert.equal(withWelcome.fixture.history.filter(x => ['set', 'update', 'remove'].includes(x.method)).length, 1);
});
