const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class Element {
  constructor(attributes = {}, sourceHTML = '') {
    this.attributes = { ...attributes };
    this.id = attributes.id || '';
    this.hidden = false;
    this.open = false;
    this.tabIndex = 0;
    this.value = '';
    this.textContent = '';
    this.handlers = {};
    this.children = [];
    this.selectors = {};
    this.sourceHTML = sourceHTML;
    this.focusCount = 0;
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  querySelector(key) { return this.querySelectorAll(key)[0] || null; }
  querySelectorAll(key) { return this.selectors[key] || []; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  focus() { this.focusCount++; }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  cloneNode() { return new Element(this.attributes, this.sourceHTML); }
  set innerHTML(value) { throw new Error('HTML injection must not be used'); }
  fire(type, properties = {}) {
    const event = { ...properties, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    this.handlers[type]?.(event);
    return event;
  }
}

function harness({ hash = '', weekendEnabled = true, routeEnabled = true, missingPanel = false, historyThrows = false } = {}) {
  const ids = {};
  const document = new Element();
  document.getElementById = id => ids[id] || null;
  const windowHandlers = {};
  const historyCalls = [];
  const networkCalls = [];
  const forbidden = type => () => { networkCalls.push(type); throw new Error('Unexpected network or storage access'); };
  const window = {
    location: { hash },
    history: { replaceState(...args) { if (historyThrows) throw new Error('History disabled'); historyCalls.push(args); window.location.hash = args[2]; } },
    addEventListener: (type, handler) => { windowHandlers[type] = handler; },
    fetch: forbidden('fetch'), open: forbidden('open'),
  };
  Object.defineProperty(window, 'localStorage', { get: forbidden('localStorage') });
  const weekend = new Element();
  const tablist = new Element();
  const days = ['friday', 'saturday', 'sunday', 'monday'];
  const tabs = days.map(day => new Element({ id: day + '-tab', href: '#' + day }));
  const panels = days.map(day => new Element({ id: day }));
  panels.forEach(panel => { ids[panel.id] = panel; });
  if (missingPanel) delete ids.monday;
  weekend.selectors = { '[data-weekend-tabs]': [tablist], '[data-weekend-tab]': tabs };
  document.selectors['[data-weekend]'] = weekendEnabled ? [weekend] : [];

  const planner = new Element();
  planner.hidden = true;
  const form = new Element();
  const airport = new Element({ id: 'route-airport' });
  const transport = new Element({ id: 'route-transport' });
  const status = new Element({ id: 'route-status' });
  const result = new Element();
  result.hidden = true;
  const title = new Element({ id: 'route-result-title' });
  const airportResult = new Element();
  const transportResult = new Element();
  const comparison = new Element();
  comparison.hidden = true;
  const airports = new Element();
  const transports = new Element();
  [airport, transport, status, title].forEach(element => { ids[element.id] = element; });
  const html = read('getting-here.html');
  const sources = type => Array.from(html.matchAll(new RegExp('<article[^>]*data-' + type + '-guidance="([^"]+)"[^>]*data-route-label="([^"]+)"[^>]*>([\\s\\S]*?)<\\/article>', 'g')), match => new Element({ ['data-' + type + '-guidance']: match[1], 'data-route-label': match[2] }, match[3]));
  const airportGuides = sources('airport');
  const transportGuides = sources('transport');
  airports.selectors['[data-airport-guidance]'] = airportGuides;
  transports.selectors['[data-transport-guidance]'] = transportGuides;
  planner.selectors = { '[data-route-form]': [form], '[data-route-result]': [result], '[data-route-airport-result]': [airportResult], '[data-route-transport-result]': [transportResult] };
  Object.assign(document.selectors, { '[data-route-planner]': routeEnabled ? [planner] : [], '[data-route-comparison]': [comparison], '[data-route-airports]': [airports], '[data-route-transports]': [transports] });
  vm.runInNewContext(read('js/postcard-guides.js'), { document, window, fetch: forbidden('fetch'), XMLHttpRequest: forbidden('XMLHttpRequest'), WebSocket: forbidden('WebSocket') });
  return { tabs, panels, tablist, window, windowHandlers, historyCalls, networkCalls, planner, form, airport, transport, status, result, title, airportResult, transportResult, comparison, airports, transports, airportGuides, transportGuides };
}

function selected(h, index) {
  h.tabs.forEach((tab, i) => {
    assert.equal(tab.getAttribute('aria-selected'), String(i === index));
    assert.equal(tab.tabIndex, i === index ? 0 : -1);
    assert.equal(h.panels[i].hidden, i !== index);
  });
}

test('actual module creates linked tab semantics with one selected day', () => {
  const h = harness({ routeEnabled: false });
  assert.equal(h.tablist.getAttribute('role'), 'tablist');
  selected(h, 0);
  h.tabs.forEach((tab, index) => {
    assert.equal(tab.getAttribute('role'), 'tab');
    assert.equal(tab.getAttribute('aria-controls'), h.panels[index].id);
    assert.equal(h.panels[index].getAttribute('role'), 'tabpanel');
    assert.equal(h.panels[index].getAttribute('aria-labelledby'), tab.id);
    assert.equal(h.panels[index].tabIndex, 0);
  });
});

test('day tabs support arrows with wrapping, Home, End, Space, clicks and normal Tab', () => {
  const h = harness();
  assert.equal(h.tabs[0].fire('keydown', { key: 'ArrowLeft' }).defaultPrevented, true);
  selected(h, 3);
  assert.equal(h.tabs[3].focusCount, 1);
  h.tabs[3].fire('keydown', { key: 'ArrowRight' });
  selected(h, 0);
  h.tabs[0].fire('keydown', { key: 'End' });
  selected(h, 3);
  h.tabs[3].fire('keydown', { key: 'Home' });
  selected(h, 0);
  assert.equal(h.tabs[0].fire('keydown', { key: 'Tab' }).defaultPrevented, false);
  h.tabs[0].fire('keydown', { key: ' ' });
  selected(h, 0);
  assert.equal(h.tabs[1].fire('click').defaultPrevented, true);
  selected(h, 1);
  assert.equal(h.window.location.hash, '#saturday');
});

test('initial and changing hashes select the day without stealing focus; unknown hashes are safe', () => {
  const h = harness({ hash: '#sunday' });
  selected(h, 2);
  assert.deepEqual(h.historyCalls, []);
  h.window.location.hash = '#monday';
  h.windowHandlers.hashchange();
  selected(h, 3);
  assert.equal(h.tabs.reduce((count, tab) => count + tab.focusCount, 0), 0);
  h.window.location.hash = '#unknown';
  h.windowHandlers.hashchange();
  selected(h, 3);
  const restricted = harness({ historyThrows: true });
  restricted.tabs[1].fire('click');
  selected(restricted, 1);
});

test('a missing chapter leaves the full static content available', () => {
  const h = harness({ missingPanel: true });
  h.panels.forEach(panel => assert.equal(panel.hidden, false));
  assert.equal(h.tablist.getAttribute('role'), null);
});

test('static markup offers every chapter and all travel guidance without JavaScript', () => {
  const weekend = read('weekend-guide.html');
  const travel = read('getting-here.html');
  const chapters = Array.from(weekend.matchAll(/<section[^>]*data-weekend-panel[^>]*>/g));
  assert.equal(chapters.length, 4);
  chapters.forEach(([tag]) => assert.doesNotMatch(tag, /\bhidden\b/));
  for (const day of ['friday', 'saturday', 'sunday', 'monday']) assert.match(weekend, new RegExp('href="#' + day + '"'));
  assert.doesNotMatch(weekend, /role="tab(?:list|panel)?"/);
  for (const name of ['airports', 'transports']) {
    const tag = travel.match(new RegExp('<section[^>]*data-route-' + name + '[^>]*>'))[0];
    assert.doesNotMatch(tag, /\bhidden\b/);
  }
  assert.match(travel, /data-route-comparison hidden><summary>[^<]+<\/summary><\/details>/);
  assert.equal((travel.match(/data-airport-guidance=/g) || []).length, 4);
  assert.equal((travel.match(/data-transport-guidance=/g) || []).length, 2);
  for (const name of ['Perugia', 'Florence', 'Bologna', 'Pisa', 'Trenitalia', 'Autolinee Toscane']) assert.ok(travel.includes(name));
  for (const image of weekend.matchAll(/<img[^>]+>/g)) {
    assert.match(image[0], /width="\d+" height="\d+"/);
    assert.match(image[0], /loading="lazy"/);
    assert.match(image[0], /srcset=/);
  }
});

test('enhancement shows the chooser and moves full guidance into an optional disclosure', () => {
  const h = harness({ weekendEnabled: false });
  assert.equal(h.planner.hidden, false);
  assert.equal(h.result.hidden, true);
  assert.equal(h.comparison.hidden, false);
  assert.deepEqual(h.comparison.children, [h.airports, h.transports]);
  assert.equal(h.status.textContent, '');
});

test('route validation announces missing fields and focuses the first missing choice', () => {
  const h = harness();
  assert.equal(h.form.fire('submit').defaultPrevented, true);
  assert.match(h.status.textContent, /Choose an airport and/);
  assert.equal(h.airport.focusCount, 1);
  assert.equal(h.airport.getAttribute('aria-invalid'), 'true');
  assert.equal(h.transport.getAttribute('aria-invalid'), 'true');
  h.airport.value = 'perugia';
  h.form.fire('submit');
  assert.equal(h.airport.getAttribute('aria-invalid'), 'false');
  assert.equal(h.transport.focusCount, 1);
  assert.match(h.status.textContent, /Choose how/);
  assert.equal(h.result.hidden, true);
});

test('unknown or unsafe input values never select guidance or render input as HTML', () => {
  for (const value of ['__proto__', 'constructor', '<img src=x onerror=alert(1)>', 'PERUGIA']) {
    const h = harness();
    h.airport.value = value;
    h.transport.value = 'car';
    h.form.fire('submit');
    assert.equal(h.result.hidden, true);
    assert.equal(h.airportResult.children.length, 0);
    assert.equal(h.title.textContent, '');
    assert.match(h.status.textContent, /Choose an airport from the list/);
  }
  const h = harness();
  h.airport.value = 'pisa';
  h.transport.value = '__proto__';
  h.form.fire('submit');
  assert.equal(h.result.hidden, true);
  assert.equal(h.transport.focusCount, 1);
});

test('all eight submitted routes copy the exact existing official guidance and announce a result', () => {
  const h = harness();
  for (const airportGuide of h.airportGuides) {
    for (const transportGuide of h.transportGuides) {
      h.airport.value = airportGuide.getAttribute('data-airport-guidance');
      h.transport.value = transportGuide.getAttribute('data-transport-guidance');
      h.form.fire('submit');
      assert.equal(h.result.hidden, false);
      assert.equal(h.airportResult.children[0].sourceHTML, airportGuide.sourceHTML);
      assert.equal(h.transportResult.children[0].sourceHTML, transportGuide.sourceHTML);
      assert.notEqual(h.airportResult.children[0], airportGuide);
      assert.match(h.airportResult.children[0].sourceHTML, /href="https:\/\//);
      assert.match(h.status.textContent, /planning guide is ready below/);
      assert.equal(h.title.textContent, 'From ' + airportGuide.getAttribute('data-route-label') + ', ' + transportGuide.getAttribute('data-route-label'));
      assert.equal(h.status.getAttribute('data-state'), null);
    }
  }
  assert.deepEqual(h.networkCalls, []);
});

test('changing a choice clears a stale route and requires another explicit submission', () => {
  const h = harness();
  h.airport.value = 'florence';
  h.transport.value = 'car';
  h.form.fire('submit');
  assert.equal(h.result.hidden, false);
  h.transport.value = 'no-car';
  h.transport.fire('change');
  assert.equal(h.result.hidden, true);
  assert.match(h.status.textContent, /Select Show my route/);
  h.form.fire('submit');
  assert.equal(h.result.hidden, false);
  assert.match(h.title.textContent, /without a car/);
  assert.match(h.transportResult.children[0].sourceHTML, /still to be confirmed/);
  assert.deepEqual(h.networkCalls, []);
});

test('printing exposes the complete comparison and restores the guest’s disclosure choice', () => {
  const h = harness();
  h.windowHandlers.beforeprint();
  assert.equal(h.comparison.open, true);
  h.windowHandlers.afterprint();
  assert.equal(h.comparison.open, false);
  h.comparison.open = true;
  h.windowHandlers.beforeprint();
  h.windowHandlers.afterprint();
  assert.equal(h.comparison.open, true);
});

test('new guide assets stay small and perform no runtime requests or storage', () => {
  const script = read('js/postcard-guides.js');
  assert.ok(Buffer.byteLength(script) < 8000);
  assert.ok(Buffer.byteLength(read('css/postcard-guides.css')) < 10000);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|innerHTML|window\.open|location\.(?:assign|replace)/);
  assert.match(read('css/postcard-guides.css'), /@media print/);
  assert.match(read('getting-here.html'), /id="route-status" role="status" aria-live="polite"/);
});
