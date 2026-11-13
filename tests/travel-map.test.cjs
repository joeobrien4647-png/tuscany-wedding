const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../js/first/travel-map.js');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const data = JSON.parse(read('data/getting-there.json'));
const wide = JSON.parse(read('data/getting-there-wide.json'));
const at = p => m.project(p.lon, p.lat);
const airport = code => data.airports.find(a => a.code === code);

test('project puts Manchester above and left of Pisa, and La Conca right of Pisa', () => {
  const man = at(data.ukAirports.MAN.pos), psa = at(airport('PSA').terminal), villa = at(data.venue.satnav);
  assert.ok(man[0] < psa[0] && man[1] < psa[1]);
  assert.ok(villa[0] > psa[0]);
  assert.ok(Math.abs(villa[1] - psa[1]) < Math.abs(man[1] - psa[1]) / 10, 'the villa is about level with Pisa');
});
test('project is the film\'s projection: straight up the middle at 11.6 E, and the same shape either side', () => {
  assert.ok(Math.abs(m.project(11.6, 43)[0]) < 1e-9);
  const w = m.project(9.6, 43), e = m.project(13.6, 43);
  assert.ok(Math.abs(w[0] + e[0]) < 1e-9 && Math.abs(w[1] - e[1]) < 1e-9);
  assert.ok(m.project(11.6, 50)[1] < m.project(11.6, 43)[1], 'north is up');
});
test('fitBox holds every point and has the asked-for shape', () => {
  const b = m.fitBox([[0, 0], [100, 50]], 0.1, 2);
  assert.ok(b.x <= 0 && b.y <= 0 && b.x + b.w >= 100 && b.y + b.h >= 50);
  assert.ok(Math.abs(b.w / b.h - 2) < 1e-9);
  const tall = m.fitBox([[0, 0], [100, 50]], 0.1, 0.5);
  assert.ok(Math.abs(tall.w / tall.h - 0.5) < 1e-9 && tall.w >= 120);
  assert.ok(Math.abs((b.x + b.w / 2) - 50) < 1e-9 && Math.abs((b.y + b.h / 2) - 25) < 1e-9, 'centred on the points');
});
test('fitBox never zooms closer than a minimum size for two points that nearly touch', () => {
  const b = m.fitBox([[10, 10], [10.5, 10.2]], 0, 1);
  assert.ok(b.w >= m.MIN_SPAN && b.h >= m.MIN_SPAN);
  const one = m.fitBox([[10, 10]], 0.2, 1.5);
  assert.ok(one.w >= m.MIN_SPAN && isFinite(one.x) && isFinite(one.y));
  const none = m.fitBox([], 0.2, 1.5);
  assert.ok(isFinite(none.x) && isFinite(none.w) && none.w > 0);
});
test('arcPath starts and ends on its two points', () => {
  const d = m.arcPath([1, 2], [30, 40], 0.14);
  assert.match(d, /^M1,2 Q[-\d.]+,[-\d.]+ 30,40$/);
  assert.notEqual(m.arcPath([1, 2], [30, 40], 0.14), m.arcPath([1, 2], [30, 40], -0.14));
});
test('outlinePath draws the real outline by role and survives a broken one', () => {
  const land = m.outlinePath(wide, 'land'), italy = m.outlinePath(wide, 'italy');
  assert.match(land, /^M[-\d.]+,[-\d.]+L/);
  assert.ok(land.endsWith('Z') && italy.endsWith('Z') && land.length > italy.length);
  assert.ok(!/NaN|undefined/.test(land + italy));
  for (const bad of [null, {}, { features: 'x' }, { features: [{ properties: { role: 'land' }, geometry: null }] }]) assert.equal(m.outlinePath(bad, 'land'), '');
});
test('linePath draws a drive from the data, lat then lon, and skips bad points', () => {
  const d = m.linePath(airport('PEG').drive.polyline);
  assert.match(d, /^M[-\d.]+,[-\d.]+(L[-\d.]+,[-\d.]+)+$/);
  const first = m.project(12.50261, 43.09495);
  assert.ok(d.startsWith('M' + first[0].toFixed(2) + ',' + first[1].toFixed(2)));
  assert.equal(m.linePath(null), '');
  assert.equal(m.linePath([[43, 12], 'x', [43.1]]), '');
});
test('scene: what the map shows for each kind of view', () => {
  const known = { uk: { MAN: 1, LHR: 1 }, it: { PSA: 1, PEG: 1 } };
  const scene = v => m.sceneOf(v, known);
  assert.equal(scene({ froms: [], from: null, to: null }), 'all');
  assert.equal(scene(null), 'all');
  assert.equal(scene({ froms: ['MAN', 'LHR'], from: null, to: null }), 'fan');
  assert.equal(scene({ froms: ['MAN'], from: 'MAN', to: 'PSA' }), 'trip');
  assert.equal(scene({ froms: ['MAN'], from: 'MAN', to: 'OTHER' }), 'origin');
  assert.equal(scene({ froms: [], from: 'ABROAD', to: null }), 'italy');
  assert.equal(scene({ froms: [], from: 'ITALY', to: 'PEG' }), 'trip');
  assert.equal(scene({ froms: [], from: 'ITALY', to: 'NONE' }), 'italy');
  assert.equal(scene({ froms: [], from: 'ABROAD', to: 'OTHER' }), 'italy');
  assert.equal(scene({ froms: [], from: 'ROAD', to: null }), 'overland');
  assert.equal(scene({ froms: [], from: 'TRAIN', to: null }), 'overland');
  assert.equal(scene({ froms: ['ZZZ'], from: null, to: null }), 'all', 'airports the data does not know are ignored');
  assert.equal(scene({ froms: ['MAN'], from: 'MAN', to: 'XXX' }), 'origin', 'an unknown landing airport draws no line');
});
test('the map writes labels as text and the stylesheet styles it under the travel card', () => {
  const js = read('js/first/travel-map.js'), css = read('css/first.css');
  assert.doesNotMatch(js, /innerHTML/);
  assert.match(css, /#first \.fc-travel \.tm-svg/);
  assert.match(css, /#first \.fc-travel \.tm-dot/);
});

test('the map marks itself still once a scene has finished drawing, so a check can wait for it', () => {
  const js = read('js/first/travel-map.js');
  assert.match(js, /classList\.remove\('tm-still'\)/);
  assert.match(js, /classList\.add\('tm-still'\)/);
});
