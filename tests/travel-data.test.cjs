const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'getting-there.json'), 'utf8'));
const widePath = path.join(root, 'data', 'getting-there-wide.json');
const readWide = () => JSON.parse(fs.readFileSync(widePath, 'utf8'));
const sources = fs.readFileSync(path.join(root, 'data', 'getting-there-sources.md'), 'utf8');

function eachPair(coords, fn) {
  if (typeof coords[0] === 'number') fn(coords);
  else coords.forEach(c => eachPair(c, fn));
}

test('every UK airport has a sourced position inside the British Isles', () => {
  assert.equal(Object.keys(data.ukAirports).length, 18);
  for (const [code, a] of Object.entries(data.ukAirports)) {
    assert.ok(a.pos && a.pos.source === 'osm-airports', code);
    assert.ok(a.pos.lat > 49.5 && a.pos.lat < 61 && a.pos.lon > -8.5 && a.pos.lon < 2, code);
  }
});
test('every route lands at an airport in the list', () => {
  const codes = data.airports.map(a => a.code);
  for (const a of Object.values(data.ukAirports)) for (const f of a.flies) assert.ok(codes.includes(f.to), f.to);
});
test('the wide map is small, in bounds and has one Italy', () => {
  const wide = readWide();
  assert.ok(fs.statSync(widePath).size < 60000);
  assert.equal(wide.type, 'FeatureCollection');
  assert.deepEqual(wide.bbox, [-11, 39.5, 19, 59.5]);
  assert.equal(wide.features.filter(f => f.properties.role === 'italy').length, 1);
  assert.ok(wide.features.filter(f => f.properties.role === 'land').length >= 1);
  let pairs = 0;
  for (const f of wide.features) {
    assert.ok(['land', 'italy'].includes(f.properties.role));
    eachPair(f.geometry.coordinates, ([lon, lat]) => {
      pairs++;
      assert.ok(lon >= -11 && lon <= 19 && lat >= 39.5 && lat <= 59.5, lon + ',' + lat);
      assert.equal(Math.round(lon * 100) / 100, lon);
      assert.equal(Math.round(lat * 100) / 100, lat);
    });
  }
  assert.ok(pairs > 300, 'an outline with real detail');
});
test('the wide map holds every airport and the villa', () => {
  const wide = readWide();
  const [w, s, e, n] = wide.bbox;
  const points = Object.values(data.ukAirports).map(a => a.pos).concat(data.airports.map(a => a.terminal));
  for (const p of points) assert.ok(p.lon > w && p.lon < e && p.lat > s && p.lat < n);
});
test('the sources file names the new sources', () => {
  assert.match(sources, /ne-50m-land/);
  for (const code of Object.keys(data.ukAirports)) assert.match(sources, new RegExp('\\b' + code + '\\b'));
});
