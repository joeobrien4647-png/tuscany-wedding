// The food step driven in Node with a small stand-in for the page. Invented names and tokens only.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/first/core.js');
const food = require('../js/first/food-core.js');
const { words } = require('../js/first/words.js');
const foodCard = require('../js/first/food-card.js');

const NOV = Date.UTC(2026, 10, 10, 12);
const TOKEN = 'tFoodStepTwo0001';
const TWO = ['Kit', 'Sam'];
const yes = coming => ({ reply: { answer: 'yes', coming, at: 1 } });
const settle = () => new Promise(r => setImmediate(r));

function fakeDom() {
  const doc = { activeElement: null };
  const make = tag => {
    const e = {
      tagName: String(tag).toUpperCase(), className: '', children: [], attrs: {}, parentNode: null, hidden: false, disabled: false,
      readOnly: false, value: '', textContent: '', listeners: {},
      get firstChild() { return this.children[0] || null; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      removeAttribute(k) { delete this.attrs[k]; },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      click() { if (!this.disabled) (this.listeners.click || []).forEach(fn => fn({})); },
      focus() { doc.activeElement = this; }, blur() {}
    };
    e.classList = {
      list: () => e.className.split(' ').filter(Boolean),
      add(c) { if (!this.contains(c)) e.className = this.list().concat(c).join(' '); },
      remove(c) { e.className = this.list().filter(x => x !== c).join(' '); },
      toggle(c, on) { if (on === undefined ? !this.contains(c) : on) this.add(c); else this.remove(c); },
      contains(c) { return this.list().includes(c); }
    };
    return e;
  };
  doc.createElement = make;
  doc.getElementById = () => null;
  const all = (e, cls, out = []) => { if (e.classList.contains(cls)) out.push(e); e.children.forEach(x => all(x, cls, out)); return out; };
  return { doc, make, all, find: (e, cls) => all(e, cls)[0] || null };
}

// A Reply card as the frame hands it to the step, with the store's load and saveFood under the test's control.
function setup(opts) {
  const dom = fakeDom(), o = opts || {};
  const before = globalThis.document;
  globalThis.document = dom.doc;
  const inner = dom.make('div'), body = dom.make('div');
  inner.className = 'fc-inner';
  inner.appendChild(body);
  const log = { saves: [], loads: 0, refreshed: 0, closed: 0, exits: [] };
  let live = true, guard = null;
  const ctx = { invite: { token: TOKEN, people: o.people || TWO }, household: o.household || yes([true, true]), now: () => o.now || NOV };
  const loads = o.loads.slice();
  const store = {
    load() { log.loads++; const next = loads.shift(); return typeof next === 'function' ? next() : Promise.resolve(next); },
    saveFood(token, draft) { log.saves.push(JSON.parse(JSON.stringify(draft))); return o.save ? o.save(draft) : Promise.resolve(true); }
  };
  const first = { food, store, fill: core.fill, home: { refresh() { log.refreshed++; return Promise.resolve(); } } };
  const card = {
    body, ctx, w: words, first, el: null,
    heading() {}, rise: e => e, live: () => live,
    beforeClose(fn) { guard = fn; }, closeLabel() {},
    close() { if (live) { live = false; log.closed++; } }
  };
  foodCard.show(card, { mode: 'edit', onExit: saved => log.exits.push(saved) });
  return {
    dom, inner, body, ctx, log,
    pressClose: () => (guard ? guard() : false),
    tap: (cls, n) => dom.all(body, cls)[n || 0].click(),
    pick: key => dom.all(body, 'ff-pick')[food.PICKS.indexOf(key)].click(),
    done: () => dom.find(body, 'ff-done'),
    restore() { if (before === undefined) delete globalThis.document; else globalThis.document = before; }
  };
}

test('Done reads the household again and keeps a partner entry saved meanwhile, sent with this phone\'s own', async () => {
  const partner = Object.assign(yes([true, true]), { food: food.cleanFood({ at: 3, people: { 1: { name: 'Sam', picks: { nuts: true }, note: 'Severe' } } }) });
  const s = setup({ loads: [yes([true, true]), partner] });
  try {
    await settle();
    s.pick('vegan');
    s.tap('ff-next');
    s.done().click();
    await settle(); await settle();
    assert.equal(s.log.loads, 2, 'one read on opening, one on Done');
    assert.deepEqual(s.log.saves, [[{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }, { i: 1, name: 'Sam', picks: ['nuts'], note: 'Severe' }]]);
    assert.deepEqual(s.log.exits, [true]);
    assert.deepEqual(food.foodStatus(s.ctx.household, TWO).entries.map(e => e.i), [0, 1]);
  } finally { s.restore(); }
});

test('Done with an unclear read sends what this phone has; a person this phone changed is sent as it has them', async () => {
  const partner = Object.assign(yes([true, true]), { food: food.cleanFood({ at: 3, people: { 1: { name: 'Sam', picks: { nuts: true } } } }) });
  const s = setup({ loads: [yes([true, true]), () => Promise.reject(new Error('offline')), partner] });
  try {
    await settle();
    s.pick('vegan');
    s.tap('ff-next');
    s.pick('none');
    s.done().click();
    await settle(); await settle();
    assert.deepEqual(s.log.saves[0], [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }, { i: 1, name: 'Sam', picks: ['none'], note: '' }]);
  } finally { s.restore(); }
});

// Two phones, one household. This phone opened the step while Kit's pick and note were saved; the partner's phone
// then took both away and pressed Done, which leaves the household's food with nobody in it.
const kitSaved = () => Object.assign(yes([true, true]), { food: food.cleanFood({ at: 3, people: { 0: { name: 'Kit', picks: { vegan: true }, note: 'Oat milk' } } }) });
const kitRemoved = () => Object.assign(yes([true, true]), { food: food.cleanFood({ at: 9 }) });

test('Done on a phone that changed nothing keeps a removal the partner saved meanwhile: the stale draft is not sent back', async () => {
  const s = setup({ household: kitSaved(), loads: [kitSaved(), kitRemoved()] });
  try {
    await settle();
    assert.equal(s.dom.all(s.body, 'ff-on').length, 1, 'the draft began as a copy of the save');
    s.tap('ff-next');
    s.done().click();
    await settle(); await settle();
    assert.deepEqual(s.log.saves, [[{ i: 0, name: 'Kit', picks: [], note: '' }, { i: 1, name: 'Sam', picks: [], note: '' }]]);
    assert.deepEqual(s.log.exits, [true]);
    assert.equal(food.foodStatus(s.ctx.household, TWO).given, 0, 'this phone now shows the removal');
    assert.deepEqual(food.startDraft(s.ctx.household.food, food.foodScreens(TWO, [true, true]))[0], { i: 0, name: 'Kit', picks: [], note: '' });
  } finally { s.restore(); }
});

test('Done keeps what this phone really changed, next to a removal the partner saved meanwhile', async () => {
  // a change to the other person
  let s = setup({ household: kitSaved(), loads: [kitSaved(), kitRemoved()] });
  try {
    await settle();
    s.tap('ff-next');
    s.pick('nuts');
    s.done().click();
    await settle(); await settle();
    assert.deepEqual(s.log.saves, [[{ i: 0, name: 'Kit', picks: [], note: '' }, { i: 1, name: 'Sam', picks: ['nuts'], note: '' }]]);
    assert.deepEqual(food.foodStatus(s.ctx.household, TWO).entries, [{ i: 1, name: 'Sam', picks: ['nuts'], note: '' }]);
  } finally { s.restore(); }
  // a change to the same person: the pick added here is kept, the pick and note removed there stay removed
  s = setup({ household: kitSaved(), loads: [kitSaved(), kitRemoved()] });
  try {
    await settle();
    s.pick('nuts');
    s.tap('ff-next');
    s.done().click();
    await settle(); await settle();
    assert.deepEqual(s.log.saves, [[{ i: 0, name: 'Kit', picks: ['nuts'], note: '' }, { i: 1, name: 'Sam', picks: [], note: '' }]]);
  } finally { s.restore(); }
});

test('a failed save puts focus back on Try again; anything that throws counts as a failed save and never leaves the step busy', async () => {
  let n = 0;
  const s = setup({ loads: [yes([true]), yes([true]), yes([true])], people: ['Alex'], household: yes([true]),
    save: () => { n++; if (n === 1) return Promise.resolve(false); throw new Error('boom'); } });
  try {
    await settle();
    s.pick('vegan');
    s.done().click();
    await settle(); await settle();
    assert.equal(s.done().textContent, words.errors.retry);
    assert.equal(s.dom.doc.activeElement, s.done(), 'focus is back on Try again');
    s.done().click();
    await settle(); await settle();
    assert.equal(s.log.saves.length, 2, 'Try again sent a second write');
    assert.equal(s.done().disabled, false, 'not left busy after a throw');
    assert.equal(s.dom.find(s.body, 'ff-err').hidden, false);
    assert.equal(s.pressClose(), true, 'the close control steps back again');
    assert.deepEqual(s.log.exits, [false]);
  } finally { s.restore(); }
});

test('a double press of Done sends one write; the cut-off is checked when Done is pressed', async () => {
  const s = setup({ loads: [yes([true]), yes([true])], people: ['Alex'], household: yes([true]) });
  try {
    await settle();
    s.pick('vegan');
    s.ctx.now = () => core.REPLIES_CLOSE_MS;
    s.done().click();
    await settle();
    assert.equal(s.log.saves.length, 0, 'nothing sent after the cut-off');
    assert.equal(s.dom.find(s.body, 'ff-closed').hidden, false);
    s.ctx.now = () => NOV;
    s.done().click(); s.done().click();
    await settle(); await settle();
    assert.equal(s.log.saves.length, 1);
  } finally { s.restore(); }
});

test('the step marks the card\'s inner box while open and unmarks it when it steps back', async () => {
  const s = setup({ loads: [yes([true, true])] });
  try {
    assert.equal(s.inner.classList.contains('ff-open'), true);
    await settle();
    s.pressClose();
    assert.equal(s.inner.classList.contains('ff-open'), false);
    assert.equal(s.log.saves.length, 0, 'leaving saves nothing');
  } finally { s.restore(); }
});

test('a fresh read with no record, or no longer a yes, leaves the step, closes the card and refreshes home', async () => {
  for (const fresh of [null, { reply: { answer: 'no', coming: [false, false], at: 2 } }]) {
    const s = setup({ loads: [fresh] });
    try {
      await settle();
      assert.equal(s.log.closed, 1, JSON.stringify(fresh));
      assert.equal(s.log.refreshed, 1);
      assert.deepEqual(s.ctx.household, yes([true, true]), 'the household is left for home to refresh');
      assert.equal(s.inner.classList.contains('ff-open'), false);
    } finally { s.restore(); }
  }
  // the same on Done: nothing is sent for a household that no longer says yes
  const s = setup({ loads: [yes([true, true]), null] });
  try {
    await settle();
    s.pick('vegan');
    s.tap('ff-next');
    s.done().click();
    await settle(); await settle();
    assert.equal(s.log.saves.length, 0);
    assert.equal(s.log.closed, 1);
    assert.equal(s.log.refreshed, 1);
  } finally { s.restore(); }
});
