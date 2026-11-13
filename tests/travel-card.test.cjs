const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const card = require('../js/first/travel-card.js');
const t = require('../js/first/travel-core.js');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const FILES = { data: 'data/getting-there.json', outline: 'data/getting-there-wide.json', prices: 'data/flight-prices.json' };
const body = name => JSON.parse(read(name));
const PRICES = { for: { out: '2027-05-28', back: '2027-05-31', adults: 1, currency: 'GBP' }, routes: { 'MAN-PSA': { gbp: 84, at: 1798761600000 } } };

// A stand-in for fetch: answers each file from `answers` (a value, 'missing' for a 404, 'offline' to reject, 'garbled').
function fetcher(answers) {
  const calls = [];
  const fetch = function (url) {
    calls.push(url);
    const a = answers[Object.keys(FILES).find(k => url.endsWith(FILES[k]))];
    if (a === 'offline') return Promise.reject(new Error('offline'));
    if (a === 'missing') return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('no body')) });
    if (a === 'garbled') return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(a) });
  };
  return { fetch, calls };
}
const good = () => ({ data: body(FILES.data), outline: body(FILES.outline), prices: PRICES });

test('loadData resolves the data, the outline and the prices', async () => {
  card.forgetData();
  const f = fetcher(good());
  const got = await card.loadData(f.fetch);
  assert.equal(got.data.airports.length, 6);
  assert.equal(got.outline.type, 'FeatureCollection');
  assert.deepEqual(got.prices, PRICES);
  assert.deepEqual(f.calls.slice().sort(), Object.values(FILES).sort());
});
test('loadData resolves null when the data file fails, and still resolves when only the prices file is missing', async () => {
  for (const bad of ['missing', 'offline', 'garbled', { airports: [] }, null, []]) {
    card.forgetData();
    assert.equal(await card.loadData(fetcher({ ...good(), data: bad }).fetch), null, JSON.stringify(bad));
  }
  for (const bad of ['missing', 'offline', 'garbled', { features: 'x' }, null]) {
    card.forgetData();
    assert.equal(await card.loadData(fetcher({ ...good(), outline: bad }).fetch), null, JSON.stringify(bad));
  }
  for (const bad of ['missing', 'offline', 'garbled', 'x', null, []]) {
    card.forgetData();
    const got = await card.loadData(fetcher({ ...good(), prices: bad }).fetch);
    assert.ok(got && got.data && got.outline, JSON.stringify(bad));
    assert.equal(got.prices, null, JSON.stringify(bad));
  }
});
test('loadData fetches each file once however many times it is called', async () => {
  card.forgetData();
  const f = fetcher(good());
  const [a, b] = await Promise.all([card.loadData(f.fetch), card.loadData(f.fetch)]);
  const c = await card.loadData(f.fetch);
  assert.equal(f.calls.length, 3);
  assert.equal(a, b);
  assert.equal(b, c);
});
test('loadData tries again after a failure', async () => {
  card.forgetData();
  assert.equal(await card.loadData(fetcher({ ...good(), data: 'offline' }).fetch), null);
  const f = fetcher(good());
  assert.ok(await card.loadData(f.fetch));
  assert.equal(f.calls.length, 3);
});
test('loadData never throws when there is no fetch at all', async () => {
  card.forgetData();
  assert.equal(await card.loadData(null), null);
  card.forgetData();
});
test('stepAfter: airports wait for the compare button, everything else moves on', () => {
  const comparing = t.choose(t.newPlan(), { froms: ['MAN'] });
  assert.equal(card.stepAfter(comparing, { froms: ['MAN'] }), 'from');
  assert.equal(card.stepAfter(t.choose(t.newPlan(), { kind: 'ABROAD' }), { kind: 'ABROAD' }), 'route');
  assert.equal(card.stepAfter(t.choose(t.newPlan(), { kind: 'ROAD' }), { kind: 'ROAD' }), 'days');
  const routed = t.choose(comparing, { route: { from: 'MAN', to: 'PSA', via: 'direct' } });
  assert.equal(card.stepAfter(routed, { route: {} }), 'last');
  const other = t.choose(comparing, { route: { from: 'MAN', to: 'OTHER' } });
  assert.equal(card.stepAfter(other, { route: {} }), 'route');
  const arrived = t.choose(t.choose(routed, { last: 'hire' }), { arrive: 'fri' });
  assert.equal(card.stepAfter(arrived, { arrive: 'fri' }), 'days');
  assert.equal(card.stepAfter(t.choose(arrived, { leave: 'mon' }), { leave: 'mon' }), 'done');
});
test('cards.js hands the travel card to travel-card.js and has no travelView', () => {
  const cardsJs = read('js/first/cards.js');
  assert.match(cardsJs, /CARDS\.travel = \{ build: card => root\.sjFirst\.travelCard\.build\(card\) \}/);
  assert.doesNotMatch(cardsJs, /travelView/);
});
test('the travel card sets words with textContent only', () => {
  const travelCardJs = read('js/first/travel-card.js');
  assert.doesNotMatch(travelCardJs, /innerHTML\s*=\s*[^'"]/);
  assert.doesNotMatch(travelCardJs, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  const all = travelCardJs + read('js/first/travel-map.js') + read('js/first/travel-core.js');
  assert.doesNotMatch(all, /console\./);
  assert.ok(!all.includes(String.fromCharCode(0x2014)) && !all.includes(String.fromCharCode(0xb7)));
});
test('index.html loads the three travel files before cards', () => {
  const html = read('index.html');
  assert.match(html, /\["core", "words", "store", "sound", "fx", "minute", "reply", "home", "travel-core", "travel-map", "travel-card", "cards", "app"\]/);
  assert.match(html, /data-first-enabled="false"/);
});
test('the card frame tells a card when it closes, so the map can stop', () => {
  assert.match(read('js/first/cards.js'), /onClose/);
  assert.match(read('js/first/travel-card.js'), /card\.onClose\(/);
});
test('the card is styled under the travel card, with a tray that scrolls inside itself', () => {
  const css = read('css/first.css');
  assert.match(css, /#first \.fc-travel \.tc-tray/);
  assert.match(css, /#first \.fc-travel \.tc-opts \{[^}]*overflow-y: auto/);
  assert.match(css, /#first \.fc-travel \.tc-ticket/);
});
test('the prices file ships empty until the price job exists, so the card never asks for a missing file', () => {
  const prices = body(FILES.prices);
  assert.deepEqual(prices.routes, {});
  assert.equal(prices.for.currency, 'GBP');
});

// ---- from the whole-branch review ----
test('backTo: a ticket that is already stamped can always be gone back to; a brand-new first ticket has nowhere to go', () => {
  const tk = { from: 'ROAD', last: 'own', arrive: 'fri', leave: 'mon' };
  assert.equal(card.backTo('last', 0, [tk]), 0, 'changing the stamped household ticket');
  assert.equal(card.backTo('from', 1, [tk]), 0, 'a new separate ticket goes back to the first');
  assert.equal(card.backTo('done', 1, [tk, tk]), 1, 'changing a stamped separate ticket');
  assert.equal(card.backTo('days', 2, [null, tk]), 1, 'the first one that exists');
  assert.equal(card.backTo('from', 0, []), -1);
  assert.equal(card.backTo('from', 0, [null, null]), -1);
  assert.equal(card.backTo('stamped', 0, [tk]), -1, 'already there');
});
test('the other ways of setting off come before the long list of single airports', () => {
  const js = read('js/first/travel-card.js');
  const kinds = js.indexOf("chip('k-' + k"), each = js.indexOf("chip('a-' + c"), areas = js.indexOf("chip('g-' + g.key");
  assert.ok(areas > 0 && kinds > areas && each > kinds, [areas, kinds, each].join(' '));
});
