const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../js/first/store.js');
const f = require('../js/first/food-core.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const TOKEN = 'tok_FOODabcdefghij01';
const good = { reply: { answer: 'yes', coming: [true, false], at: 1700000000000 }, stay: { choice: 'villa', at: 1700000001000 } };
const SV = { '.sv': 'timestamp' };
const LOCAL = { location: { hostname: 'localhost', search: '?wtest=1' } };

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

test('saveFood PUTs household/<token>/food with the whole entry and a server timestamp', async () => {
  const r = recorder();
  await withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveFood(TOKEN, [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }]), true);
    assert.equal(r.calls.length, 1);
    const { url, init } = r.calls[0];
    assert.ok(url.endsWith('/household/' + TOKEN + '/food.json'), url);
    assert.equal(init.method, 'PUT');
    assert.equal(init.credentials, 'omit');
    assert.deepEqual(JSON.parse(init.body), { people: { 0: { name: 'Kit', picks: { vegan: true } } }, at: SV });
  });
});
test('saveFood: nothing filled in still saves, as a clear', async () => {
  const r = recorder();
  await withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveFood(TOKEN, [{ i: 0, name: 'Kit', picks: [], note: '  ' }]), true);
    assert.equal(r.calls.length, 1);
    assert.deepEqual(JSON.parse(r.calls[0].init.body), { at: SV });
  });
});
test('saveFood resolves false on failure, and sends nothing for a bad token or a draft that is not a list', async () => {
  const draft = [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }];
  const bad = recorder(false);
  await withGlobals({ fetch: bad.fetch }, async () => {
    assert.equal(await store.saveFood(TOKEN, draft), false);
    assert.equal(bad.calls.length, 1);
  });
  const none = recorder();
  await withGlobals({ fetch: none.fetch }, async () => {
    assert.equal(await store.saveFood('bad', draft), false);
    assert.equal(await store.saveFood(TOKEN, null), false);
    assert.equal(await store.saveFood(TOKEN, 'x'), false);
    assert.equal(await store.saveFood(TOKEN, { 0: draft[0] }), false);
    assert.equal(none.calls.length, 0);
  });
  await withGlobals({ fetch: () => Promise.reject(new Error('offline')) }, async () => {
    assert.equal(await store.saveFood(TOKEN, draft), false);
  });
});
test('clean keeps a valid food entry beside the reply and drops a bad one', () => {
  const food = { at: 9, people: { 0: { name: 'Kit', picks: { vegan: true } } } };
  assert.deepEqual(store.clean({ reply: good.reply, food }).food, f.cleanFood(food));
  assert.deepEqual(store.clean({ reply: good.reply, food }).food, { at: 9, people: [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }] });
  assert.equal('food' in store.clean({ reply: good.reply, food: { at: 'x' } }), false);
  assert.deepEqual(store.clean({ reply: good.reply, food: { at: 'x' } }), { reply: good.reply });
  assert.deepEqual(store.clean({ food: { at: 9 } }), { food: { at: 9, people: [] } });
  assert.equal(store.clean({ food: { at: 'x' } }), null);
});
test('local-test mode keeps a food save in memory and load returns it cleaned', async () => {
  const token = 'tok_FOODlocaltest0001';
  const fetch = () => Promise.resolve({ ok: false });
  await withGlobals(Object.assign({ fetch }, LOCAL), async () => {
    assert.equal(await store.saveFood(token, [{ i: 1, name: 'Sam', picks: ['nuts', 'vegan'], note: ' Soft food ' }]), true);
    const got = await store.load(token);
    assert.equal(got.food.people.length, 1);
    assert.deepEqual(got.food.people[0], { i: 1, name: 'Sam', picks: ['vegan', 'nuts'], note: 'Soft food' });
    assert.equal(typeof got.food.at, 'number');
    // a clear in local-test mode leaves an entry with nobody in it
    assert.equal(await store.saveFood(token, []), true);
    assert.deepEqual((await store.load(token)).food.people, []);
  });
});
test('rules: food is written or removed only by a yes household, before the cut-off', () => {
  const rules = JSON.parse(read('firebase.rules.json')).rules, h = rules.household.$token, food = h.food;
  assert.equal(rules.household['.read'], undefined);
  assert.equal(h['.read'], true);
  assert.equal(food['.read'], undefined);
  assert.match(food['.write'], /reply.*answer.*=== 'yes'/);
  assert.match(food['.write'], /now < 1803859200000/);
  assert.doesNotMatch(food['.write'], /newData\.exists\(\)/);   // a link may remove it: an empty save could already clear it
  assert.match(food['.validate'], /hasChildren\(\['at'\]\)/);
  assert.match(food.at['.validate'], /== now/);
  assert.equal(food.$other['.validate'], false);
  const person = food.people.$i;
  assert.match(food.people['.validate'], /hasChildren\(\)/);
  assert.match(person.picks['.validate'], /hasChildren\(\)/);
  assert.match(person['.validate'], /\$i\.matches\(\/\^\[0-7\]\$\/\)/);
  assert.match(person.name['.validate'], /isString\(\).*<= 80/);
  assert.match(person.note['.validate'], /isString\(\).*<= 80/);
  assert.equal(person.$other['.validate'], false);
  assert.equal(h.$other['.validate'], false);
});
test('rules: the picks the database accepts are exactly PICKS', () => {
  const pick = JSON.parse(read('firebase.rules.json')).rules.household.$token.food.people.$i.picks.$pick['.validate'];
  assert.match(pick, /newData\.val\(\) === true/);
  assert.deepEqual(pick.match(/\^\(([a-z|]+)\)\$/)[1].split('|'), f.PICKS);
});
test('the layer load list puts food-core straight after core', () => {
  assert.match(read('index.html'), /\["core", "food-core", "words", "store"/);
});
