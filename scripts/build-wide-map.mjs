// One-off: builds data/getting-there-wide.json, the land outline from the UK down to central Italy.
// Run by hand, never by tests or CI:   node scripts/build-wide-map.mjs <path-to-world-atlas>
// Source: Natural Earth 1:50m land and countries (public domain), as packaged by world-atlas. See
// data/getting-there-sources.md, entry `ne-50m-land`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BBOX = [-11, 39.5, 19, 59.5];
const TOLERANCE = 0.012;   // degrees; lines closer than this to their neighbours are dropped
const MIN_AREA = 0.01;     // square degrees; smaller islands are dropped
const atlas = process.argv[2];
if (!atlas) { console.error('Usage: node scripts/build-wide-map.mjs <path-to-world-atlas>'); process.exit(1); }
const readJson = name => JSON.parse(fs.readFileSync(path.join(atlas, name), 'utf8'));

// TopoJSON arcs are delta-encoded integers; this turns one topology's arcs into lon/lat lines.
function decoder(topology) {
  const { scale, translate } = topology.transform;
  const lines = topology.arcs.map(function (arc) {
    let x = 0, y = 0;
    return arc.map(function (d) { x += d[0]; y += d[1]; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
  const ring = refs => refs.reduce(function (pts, ref, i) {
    const line = ref < 0 ? lines[~ref].slice().reverse() : lines[ref];
    return pts.concat(i ? line.slice(1) : line);
  }, []);
  return function polygons(geometry) {
    if (geometry.type === 'GeometryCollection') return geometry.geometries.reduce((all, g) => all.concat(polygons(g)), []);
    const polys = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
    return polys.map(poly => poly.map(ring));
  };
}

// Sutherland-Hodgman against one edge of the box at a time.
function clipRing(ring, [w, s, e, n]) {
  const edges = [
    [p => p[0] >= w, (a, b) => [w, a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= e, (a, b) => [e, a[1] + (b[1] - a[1]) * (e - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= s, (a, b) => [a[0] + (b[0] - a[0]) * (s - a[1]) / (b[1] - a[1]), s]],
    [p => p[1] <= n, (a, b) => [a[0] + (b[0] - a[0]) * (n - a[1]) / (b[1] - a[1]), n]]
  ];
  let pts = ring;
  for (const [inside, cross] of edges) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(a)) { out.push(a); if (!inside(b)) out.push(cross(a, b)); }
      else if (inside(b)) out.push(cross(a, b));
    }
    pts = out;
    if (!pts.length) return pts;
  }
  return pts;
}

function simplify(pts, tol) {   // Douglas-Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(), a = pts[i], b = pts[j];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    let far = -1, most = tol;
    for (let k = i + 1; k < j; k++) {
      // A closed ring starts and ends on one point, so there the distance is from that point.
      const d = len ? Math.abs(dy * (pts[k][0] - a[0]) - dx * (pts[k][1] - a[1])) / len : Math.hypot(pts[k][0] - a[0], pts[k][1] - a[1]);
      if (d > most) { most = d; far = k; }
    }
    if (far > 0) { keep[far] = 1; stack.push([i, far], [far, j]); }
  }
  return pts.filter((p, i) => keep[i]);
}
const area = ring => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const round = v => Math.max(-180, Math.min(180, Math.round(v * 100) / 100));

function tidy(polys) {
  const out = [];
  for (const poly of polys) {
    const outer = clipRing(poly[0].slice(0, -1), BBOX);   // holes (lakes) are not drawn
    if (outer.length < 3 || area(outer) < MIN_AREA) continue;
    const ring = simplify(outer.concat([outer[0]]), TOLERANCE).map(p => [round(p[0]), round(p[1])])
      .filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
    if (ring.length >= 4) out.push([ring]);
  }
  return out;
}

const land = readJson('land-50m.json'), countries = readJson('countries-50m.json');
const italy = countries.objects.countries.geometries.find(g => g.properties && g.properties.name === 'Italy');
if (!italy) throw new Error('Italy not found in countries-50m.json');
const feature = (role, polys) => ({ type: 'Feature', properties: { role }, geometry: { type: 'MultiPolygon', coordinates: polys } });
const out = {
  about: 'Land outline from the UK to central Italy for the Getting there card. Raw lon/lat; project on the page.',
  source: 'ne-50m-land',
  bbox: BBOX,
  type: 'FeatureCollection',
  features: [feature('land', tidy(decoder(land)(land.objects.land))), feature('italy', tidy(decoder(countries)(italy)))]
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'getting-there-wide.json');
fs.writeFileSync(file, JSON.stringify(out) + '\n', 'utf8');
console.log('wrote', file, fs.statSync(file).size, 'bytes,', out.features.map(f => f.geometry.coordinates.length + ' ' + f.properties.role).join(', '));
