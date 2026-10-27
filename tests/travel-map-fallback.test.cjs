const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js/getting-there.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/getting-there.json'), 'utf8'));
const shapes = JSON.parse(fs.readFileSync(path.join(root, 'data/getting-there-map.json'), 'utf8'));

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.hidden = false; this.value = ''; this.listeners = {}; this.textContent = ''; this._html = ''; const classes = new Set(); this.classList = { toggle(name, on) { if (on === undefined) on = !classes.has(name); if (on) classes.add(name); else classes.delete(name); }, add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); } }; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  setAttribute(k,v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] || null; }
  addEventListener(k,fn) { (this.listeners[k] ||= []).push(fn); }
  dispatch(k) { for (const fn of this.listeners[k] || []) fn({ target: this }); }
  getBoundingClientRect() { return { width: 350, height: 300, top: 1200, bottom: 1500 }; }
  scrollIntoView() { this.scrolled = true; }
  focus() { this.focused = true; }
  set innerHTML(value) { this._html = value; }
  get innerHTML() { return this._html; }
  querySelector(sel) {
    if (sel === '.gt-calc-slot') return { parentNode: { replaceChild() {} } };
    if (sel === '.gt-strip-car' || sel === '.gt-when') return null;
    if (sel === 'figcaption') return this.caption || null;
    return null;
  }
}
async function setup(kind, hash = '') {
  const ids = ['gt-svg','gt-map','gt-map-details','gt-card','gt-loading','gt-chips','gt-from','gt-from-note','gt-card-body','gt-calc','gt-reply-box','gt-reply','gt-reply-hint','gt-result','gt-status','gt-allow','gt-land','gt-day','gt-calc-hint','gt-sun','gt-sun-note','gt-stretch-summary','gt-coords','gt-satnav-note','gt-tips','gt-copy','gt-checked','gt-mini'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  nodes['gt-map'].caption = new Element('figcaption');
  nodes['gt-day'].value = 'fri'; nodes['gt-land'].value = '12:00'; nodes['gt-allow'].value = '45';
  nodes['gt-calc'].hidden = nodes['gt-reply-box'].hidden = true;
  const doc = {
    documentElement: { clientHeight: 844 },
    getElementById: id => nodes[id] || null,
    createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
    querySelectorAll: sel => sel === '.gt-chip' ? nodes['gt-chips'].children : [],
    querySelector: sel => { const m = /data-code="([A-Z]{3})"/.exec(sel); return m ? nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === m[1]) || null : null; }
  };
  const warning = [], timers = new Map(), controllers = [];
  let nextTimer = 0, releaseMap, releaseAirports;
  class AbortController {
    constructor() { this.signal = {}; this.aborted = false; controllers.push(this); }
    abort() { this.aborted = true; }
  }
  const setTimer = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; };
  const clearTimer = id => timers.delete(id);
  const win = { document: doc, innerHeight: 844, history: {}, console: { warn: (...x) => warning.push(x) }, matchMedia: query => ({ matches: query.includes('reduce') || query.includes('max-width') }) };
  const context = { window: win, document: doc, location: { hash }, history: { replaceState() {} }, navigator: {}, console: win.console,
    fetch: url => url.includes('getting-there-map')
      ? (kind === 'missing' ? Promise.reject(Error('map failed')) : (kind === 'hanging' || kind === 'airport-failed-map-hanging') ? new Promise(resolve => { releaseMap = resolve; }) : Promise.resolve({ ok: true, json: () => {
        if (kind === 'invalid-json') return Promise.reject(new SyntaxError('invalid JSON'));
        if (kind === 'malformed') return Promise.resolve({ features: [] });
        if (kind === 'bad-coordinates') return Promise.resolve({ type: 'FeatureCollection', features: [{ properties: { role: 'italy' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 'bad'], [0, 0]]] } }] });
        return Promise.resolve(shapes);
      } }))
      : ((kind === 'airport-failed' || kind === 'airport-failed-map-hanging') ? Promise.reject(Error('airports failed')) : kind === 'airport-hanging' ? new Promise(resolve => { releaseAirports = resolve; }) : Promise.resolve({ ok: true, json: () => Promise.resolve(structuredClone(data)) })),
    AbortController, setTimeout: setTimer, clearTimeout: clearTimer, requestAnimationFrame: () => { throw Error('unexpected animation'); }, cancelAnimationFrame() {} };
  vm.runInNewContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, win, warning, timers, controllers, releaseMap, releaseAirports };
}

for (const kind of ['missing', 'invalid-json', 'malformed', 'bad-coordinates']) {
  test(`${kind} base map leaves the airport journey usable`, async () => {
    const { nodes, win, timers } = await setup(kind, '#PEG');
    assert.equal(timers.size, 0);
    assert.equal(nodes['gt-chips'].children.length, 6);
    assert.equal(nodes['gt-svg'].hidden, true);
    assert.equal(nodes['gt-svg'].attrs.hidden, '');
    assert.equal(nodes['gt-svg'].getAttribute('aria-hidden'), 'true');
    assert.equal(nodes['gt-map'].caption.hidden, true);
    assert.equal(nodes['gt-map'].getAttribute('aria-label'), 'Map unavailable');
    assert.match(nodes['gt-loading'].textContent, /map.*unavailable/i);
    assert.equal(nodes['gt-loading'].getAttribute('role'), 'status');
    assert.equal(win.__gtState().current, 'PEG');
    assert.equal(nodes['gt-reply-box'].hidden, false);
    assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=PEG#card');
    assert.match(nodes['gt-result'].innerHTML, /Estimated arrival/);
    nodes['gt-from'].value = Object.keys(data.ukAirports)[0];
    nodes['gt-from'].dispatch('change');
    assert.equal(nodes['gt-from-note'].hidden, false);
    nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === 'FLR').dispatch('click');
    assert.equal(win.__gtState().current, 'FLR');
    assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=FLR#card');
    assert.notEqual(nodes['gt-map'].scrolled, true);
  });
}

test('normal map still renders and airport selection works', async () => {
  const { nodes, win } = await setup('normal');
  assert.equal(nodes['gt-chips'].children.length, 6);
  assert.equal(nodes['gt-svg'].hidden, false);
  assert.equal(nodes['gt-loading'].hidden, true);
  nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === 'PEG').dispatch('click');
  assert.equal(win.__gtState().current, 'PEG');
  assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=PEG#card');
  assert.notEqual(nodes['gt-map'].scrolled, true);
});

test('failure of the essential airport data retains its existing error', async () => {
  const { nodes } = await setup('airport-failed');
  assert.equal(nodes['gt-chips'].children.length, 0);
  assert.match(nodes['gt-loading'].textContent, /travel planner didn.t load.*refresh/i);
});


test('a stalled map times out, aborts, and leaves the airport journey usable', async () => {
  const run = await setup('hanging', '#PEG');
  assert.equal(run.nodes['gt-chips'].children.length, 6);
  assert.equal(run.win.__gtState().current, 'PEG');
  assert.equal(run.nodes['gt-reply'].getAttribute('href'), 'index.html?into=PEG#card');
  assert.equal(run.timers.size, 1);
  const [timer] = run.timers.values();
  assert.ok(timer.ms > 0 && timer.ms <= 5000);
  timer.fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.controllers[0].aborted, true);
  assert.equal(run.timers.size, 0);
  assert.equal(run.nodes['gt-chips'].children.length, 6);
  assert.equal(run.win.__gtState().current, 'PEG');
  assert.equal(run.nodes['gt-reply'].getAttribute('href'), 'index.html?into=PEG#card');
  assert.match(run.nodes['gt-loading'].textContent, /map.*unavailable/i);
  run.releaseMap({ ok: true, json: () => Promise.resolve(shapes) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.nodes['gt-svg'].hidden, true);
  assert.equal(run.nodes['gt-chips'].children.length, 6);
});

test('map timeout is cleared when the map loads successfully', async () => {
  const run = await setup('normal');
  assert.equal(run.timers.size, 0);
});


test('an airport-data failure cancels an outstanding optional map request', async () => {
  const run = await setup('airport-failed-map-hanging');
  assert.equal(run.nodes['gt-chips'].children.length, 0);
  assert.match(run.nodes['gt-loading'].textContent, /travel planner didn.t load.*refresh/i);
  assert.equal(run.controllers[0].aborted, true);
  assert.equal(run.timers.size, 0);
});


test('airport choices and latest state remain usable while the map is loading', async () => {
  const run = await setup('hanging', '#PEG');
  const { nodes, win } = run;
  assert.equal(nodes['gt-chips'].children.length, 6);
  assert.equal(win.__gtState().current, 'PEG');
  nodes['gt-from'].value = Object.keys(data.ukAirports)[0];
  nodes['gt-from'].dispatch('change');
  nodes['gt-land'].value = '14:25';
  nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === 'FLR').dispatch('click');
  nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === 'PSA').dispatch('click');
  assert.equal(win.__gtState().current, 'PSA');
  assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=PSA#card');
  assert.equal(nodes['gt-land'].value, '14:25');
  assert.notEqual(nodes['gt-map'].scrolled, true);
  const before = nodes['gt-result'].innerHTML;
  run.releaseMap({ ok: true, json: () => Promise.resolve(shapes) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(win.__gtState().current, 'PSA');
  assert.equal(nodes['gt-land'].value, '14:25');
  assert.equal(nodes['gt-result'].innerHTML, before);
  assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=PSA#card');
  assert.notEqual(nodes['gt-map'].scrolled, true);
  assert.equal(nodes['gt-loading'].hidden, true);
  const walk = (node) => [node, ...node.children.flatMap(walk)];
  const airportGroups = walk(nodes['gt-svg']).filter(n => n.getAttribute('class') === 'gt-apt');
  assert.equal(airportGroups.filter(n => n.classList.contains('is-on')).length, 2);
  assert.ok(airportGroups.filter(n => n.classList.contains('is-on')).every(n => n.getAttribute('data-code') === 'PSA'));
  for (const group of airportGroups) {
    const airport = data.airports.find(a => a.code === group.getAttribute('data-code'));
    const served = airport.ukRoutes.some(route => route.from.includes(nodes['gt-from'].value));
    assert.equal(group.classList.contains('is-dim'), !served);
  }
});


test('map arriving before the airport data still attaches the preselected route', async () => {
  const run = await setup('airport-hanging', '#PEG');
  assert.equal(run.nodes['gt-chips'].children.length, 0);
  assert.equal(run.timers.size, 0);
  run.releaseAirports({ ok: true, json: () => Promise.resolve(structuredClone(data)) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.nodes['gt-chips'].children.length, 6);
  assert.equal(run.win.__gtState().current, 'PEG');
  assert.equal(run.nodes['gt-loading'].hidden, true);
  assert.equal(run.nodes['gt-reply'].getAttribute('href'), 'index.html?into=PEG#card');
  assert.notEqual(run.nodes['gt-map'].scrolled, true);
});


test('a map selection offers a deliberate way back to its route without changing airport', async () => {
  const { nodes, win } = await setup('normal');
  const walk = (node) => [node, ...node.children.flatMap(walk)];
  const hit = walk(nodes['gt-svg']).find(n => n.getAttribute('class') === 'gt-hit' && n.getAttribute('data-code') === 'PSA');
  hit.dispatch('click');
  assert.equal(win.__gtState().current, 'PSA');
  assert.equal(nodes['gt-map-details'].hidden, false);
  assert.match(nodes['gt-map-details'].textContent, /Pisa.*route details/i);
  assert.notEqual(nodes['gt-card'].scrolled, true);
  nodes['gt-map-details'].dispatch('click');
  assert.equal(nodes['gt-card'].scrolled, true);
  assert.equal(nodes['gt-card'].focused, true);
  assert.equal(win.__gtState().current, 'PSA');
  assert.equal(nodes['gt-reply'].getAttribute('href'), 'index.html?into=PSA#card');
  nodes['gt-chips'].children.find(c => c.getAttribute('data-code') === 'PEG').dispatch('click');
  assert.equal(nodes['gt-map-details'].hidden, true);
});
