// The houses: stone walls 55 cm thick with real openings cut through them, deep-set dark brown casements with the
// glass about 15 cm back, stone sills and lintels, dark walnut board shutters on some windows and none on many,
// planked doors, round-arched doorways, barn doors folded open, iron lanterns on scroll brackets, and roofs from
// roofs.js. Windows are small (0.7 to 0.9 m), roughly square, sparse and irregular, never a grid. Every window's
// glass carries a lightSeed (0..1): the order the windows light up in the evening.
import { THREE, V3, mat4, boxG, cylG, prismG, quadG, seeded, clamp } from './kit.js';
import { WALL, blockRoof, chimney, gutter } from './roofs.js';

export const CUT = 1.15;
let QUOINS = false;          // squared corner stones standing just proud of the wall: Balanced and Best only
export function setHouseDetail(tier) { QUOINS = tier !== 'fast'; }
const EPS = 1e-4;
const ARCHED = new Set(['arch', 'lunette']);

// faces of a block in its own frame (x along, z across): left end seen from outside, the direction along the
// face to the right, and the outward normal. e and w run between the n and s walls.
const FACE = {
  s: { left: (L, W) => [-L / 2, W / 2], along: [1, 0], out: [0, 1], len: (L) => L, ry: 0 },
  n: { left: (L, W) => [L / 2, -W / 2], along: [-1, 0], out: [0, -1], len: (L) => L, ry: Math.PI },
  e: { left: (L, W) => [L / 2, W / 2 - WALL], along: [0, -1], out: [1, 0], len: (L, W) => W - 2 * WALL, ry: Math.PI / 2 },
  w: { left: (L, W) => [-L / 2, -W / 2 + WALL], along: [0, 1], out: [-1, 0], len: (L, W) => W - 2 * WALL, ry: -Math.PI / 2 },
};
export const FACES = Object.keys(FACE);

export function faceLength(b, f) { return FACE[f].len(b.length, b.width); }

// a point on a face: u along it from the left end, v up (absolute), d into the wall from the outer face
export function facePoint(b, f, u, v, d = 0) {
  const F = FACE[f];
  const [lx, lz] = F.left(b.length, b.width);
  return V3(lx + F.along[0] * u - F.out[0] * d, v, lz + F.along[1] * u - F.out[1] * d);
}

// a pen whose x runs along the face (to the right), y up, z out of the wall, origin at (u, v) on the outer face
export function facePen(pen, b, f, u, v, d = 0) {
  const p = facePoint(b, f, u, v, d);
  return pen.at(mat4({ x: p.x, y: p.y, z: p.z, ry: FACE[f].ry }));
}

// the same, from a pen in world coordinates (the villa's pen): goes into the block's frame first
export function faceAt(pen, b, f, u, v, d = 0) {
  return facePen(pen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot })), b, f, u, v, d);
}

function faceSpan(pen, name, b, f, u0, u1, v0, v1, d0, d1) {
  const a = facePoint(b, f, u0, v0, d0), c = facePoint(b, f, u1, v1, d1);
  pen.span(name, Math.min(a.x, c.x), Math.max(a.x, c.x), v0, v1, Math.min(a.z, c.z), Math.max(a.z, c.z));
}

// ---------- the wall of one face for one band of height, with its openings cut out ----------

function holeOf(o) {
  const top = ARCHED.has(o.kind) ? o.v0 + o.h + o.w / 2 + 0.02 : o.v0 + o.h;
  return { u0: o.u - o.w / 2, u1: o.u + o.w / 2, v0: o.v0, v1: top };
}

export function wallFace(pen, b, f, y0, y1, openings, stone) {
  const len = faceLength(b, f);
  const holes = openings.map(holeOf).filter((h) => h.v1 > y0 + EPS && h.v0 < y1 - EPS);
  const us = [...new Set([0, len, ...holes.flatMap((h) => [h.u0, h.u1])].map((u) => clamp(u, 0, len)))].sort((a, c) => a - c);
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], c = us[i + 1];
    if (c - a < EPS) continue;
    const cover = holes.filter((h) => h.u0 <= a + EPS && h.u1 >= c - EPS).map((h) => [Math.max(y0, h.v0), Math.min(y1, h.v1)]).sort((p, q) => p[0] - q[0]);
    let v = y0;
    for (const [h0, h1] of cover) {
      if (h0 > v + EPS) faceSpan(pen, stone, b, f, a, c, v, h0, 0, WALL);
      v = Math.max(v, h1);
    }
    if (y1 > v + EPS) faceSpan(pen, stone, b, f, a, c, v, y1, 0, WALL);
  }
  // the stone over a round arch: the rectangle up to the crown, less the half circle
  openings.filter((o) => ARCHED.has(o.kind)).forEach((o) => {
    const r = o.w / 2, spring = o.v0 + o.h;
    if (spring < y0 - EPS || spring > y1 + EPS) return;
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0); shape.absarc(0, 0, r, Math.PI, 0, true); shape.lineTo(r, r + 0.02); shape.lineTo(-r, r + 0.02); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: WALL, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -WALL);
    facePen(pen, b, f, o.u, spring).put(stone, g);
  });
}

// ---------- what goes in an opening ----------

function casement(fp, w, h, seed, { depth = 0.16, frame = 0.055, mullion = true, wood = 'timber.walnut', glass = 'glass.window' } = {}) {
  const z = -depth;
  fp.box(wood, w, frame, 0.07, 0, 0, z);
  fp.box(wood, w, frame, 0.07, 0, h - frame, z);
  fp.box(wood, frame, h, 0.07, -w / 2 + frame / 2, 0, z);
  fp.box(wood, frame, h, 0.07, w / 2 - frame / 2, 0, z);
  if (mullion && w > 0.55) fp.box(wood, frame * 0.8, h, 0.07, 0, 0, z);
  if (h > 1.05) fp.box(wood, w, frame * 0.7, 0.06, 0, h * 0.62, z);
  const pane = new THREE.PlaneGeometry(w - frame, h - frame);
  pane.translate(0, h / 2, z - 0.01);
  fp.put(glass, pane, null, { seed });
}

function shutters(fp, w, h) {
  for (const k of [-1, 1]) {
    const x = k * (w / 2 + w / 4 + 0.02);
    fp.box('timber.walnut', w / 2, h, 0.035, x, 0, 0.02);
    fp.box('timber.walnut', w / 2 - 0.05, 0.07, 0.025, x, 0.16, 0.05);
    fp.box('timber.walnut', w / 2 - 0.05, 0.07, 0.025, x, h - 0.23, 0.05);
  }
}

function sillAndLintel(fp, o, { lintel = 'stone.sandstone', sill = 'stone.sandstone', deep = 0.3 } = {}) {
  if (sill) fp.box(sill, o.w + 0.14, 0.07, deep + 0.05, 0, -0.06, -deep / 2 + 0.05);
  if (lintel) fp.box(lintel, o.w + 0.34, lintel.startsWith('timber') ? 0.2 : 0.22, deep, 0, o.h - 0.01, -deep / 2 + 0.014);
}

function plankLeaf(fp, w, h, x, z, { wood = 'timber.walnut', thick = 0.06, iron = true } = {}) {
  fp.box(wood, w, h, thick, x, 0, z);
  const n = Math.max(2, Math.round(w / 0.16));
  for (let i = 1; i < n; i++) fp.box(wood, 0.012, h - 0.04, 0.008, x - w / 2 + (w * i) / n, 0.02, z + thick / 2);
  if (iron) for (const y of [0.25, h - 0.35]) fp.box('iron', w * 0.62, 0.045, 0.01, x - w * 0.16, y, z + thick / 2 + 0.006);
}

function glazedDoor(fp, w, h, seed, { depth = 0.28, wood = 'timber.walnut', leaves = 2 } = {}) {
  const z = -depth;
  const fr = 0.07;
  fp.box(wood, w, fr, 0.08, 0, h - fr, z);
  fp.box(wood, fr, h, 0.08, -w / 2 + fr / 2, 0, z);
  fp.box(wood, fr, h, 0.08, w / 2 - fr / 2, 0, z);
  for (let i = 1; i < leaves; i++) fp.box(wood, fr, h, 0.08, -w / 2 + (w * i) / leaves, 0, z);
  fp.box(wood, w, 0.32, 0.07, 0, 0, z);
  for (const y of [h * 0.48]) fp.box(wood, w, fr * 0.6, 0.06, 0, y, z);
  const pane = new THREE.PlaneGeometry(w - fr, h - 0.32 - fr);
  pane.translate(0, 0.32 + (h - 0.32 - fr) / 2, z - 0.012);
  fp.put('glass.window', pane, null, { seed });
}

// voussoirs: a ring of dressed stone just proud of the wall, a keystone, and dressed jambs
function archRing(fp, o) {
  const r = o.w / 2;
  const ring = new THREE.Shape();
  ring.absarc(0, 0, r + 0.36, 0, Math.PI, false);
  ring.lineTo(-r, 0);
  ring.absarc(0, 0, r, Math.PI, 0, true);
  ring.lineTo(r + 0.36, 0);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: false, curveSegments: 14 });
  rg.translate(0, o.h, -0.03);
  fp.put('stone.sandstone', rg);
  fp.box('stone.sandstone', 0.26, 0.42, 0.08, 0, o.h + r - 0.04, 0.0);
  for (const k of [-1, 1]) fp.box('stone.sandstone', 0.34, o.h, 0.04, k * (r + 0.17), 0, -0.005);
}

function threshold(fp, w, stone = 'stone.sandstone') {
  fp.box(stone, w + 0.3, 0.14, 0.62, 0, -0.13, -0.05);
}

export function dressOpening(pen, b, f, o, emit) {
  const fp = facePen(pen, b, f, o.u, o.v0);
  switch (o.kind) {
    case 'window':
      sillAndLintel(fp, o, { lintel: o.lintel || 'stone.sandstone' });
      casement(fp, o.w, o.h, o.seed, { mullion: o.w > 0.62 });
      if (o.shutters) shutters(fp, o.w, o.h);
      if (o.box) windowBox(fp.at(mat4({ y: 0.01, z: 0.02 })), o.w, { seed: Math.round(o.seed * 1000) });
      break;
    case 'slit':
      sillAndLintel(fp, o, { lintel: 'stone.sandstone', deep: 0.22 });
      casement(fp, o.w, o.h, o.seed, { depth: 0.3, frame: 0.035, mullion: false });
      break;
    case 'door':
      sillAndLintel(fp, o, { lintel: o.lintel || 'stone.sandstone', sill: null });
      threshold(fp, o.w, o.threshold);
      fp.box('timber.dark', o.w, 0.06, 0.1, 0, o.h - 0.06, -0.2);
      plankLeaf(fp, o.w - 0.04, o.h - 0.06, 0, -0.2);
      break;
    case 'glazed':
      sillAndLintel(fp, o, { lintel: o.lintel || 'timber.dark', sill: null });
      threshold(fp, o.w);
      glazedDoor(fp, o.w, o.h, o.seed, { leaves: o.w > 1.3 ? 2 : 1 });
      break;
    case 'barn': {
      sillAndLintel(fp, o, { lintel: 'timber.dark', sill: null, deep: 0.4 });
      threshold(fp, o.w);
      glazedDoor(fp, o.w, o.h, o.seed, { depth: 0.36, leaves: 2 });
      // the big plank doors folded open against the wall
      for (const k of [-1, 1]) plankLeaf(fp, o.w / 2, o.h, k * (o.w * 0.75 + 0.04), 0.05, { thick: 0.07 });
      break;
    }
    case 'stable': {
      sillAndLintel(fp, o, { lintel: 'timber.dark', sill: null, deep: 0.5 });
      threshold(fp, o.w);
      plankLeaf(fp, o.w - 0.04, o.h - 0.02, 0, -0.22);
      // old iron tethering rings and hooks in the stone above
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.TorusGeometry(0.06, 0.012, 4, 10);
        ring.translate(-0.7 + i * 0.47, o.h + 0.42 + (i % 2) * 0.05, 0.02);
        fp.put('iron', ring);
      }
      break;
    }
    case 'arch': {
      threshold(fp, o.w);
      archRing(fp, o);
      // the glazed door with its half-round fanlight
      const r = o.w / 2;
      glazedDoor(fp, o.w, o.h, o.seed, { depth: 0.26, leaves: 2 });
      const fan = new THREE.CircleGeometry(r - 0.05, 12, 0, Math.PI);
      fan.translate(0, o.h, -0.275);
      fp.put('glass.window', fan, null, { seed: o.seed });
      const bar = new THREE.Shape();
      bar.absarc(0, 0, r, 0, Math.PI, false);
      bar.lineTo(-r + 0.06, 0);
      bar.absarc(0, 0, r - 0.06, Math.PI, 0, true);
      const bg = new THREE.ExtrudeGeometry(bar, { depth: 0.08, bevelEnabled: false, curveSegments: 12 });
      bg.translate(0, o.h, -0.3);
      fp.put('timber.walnut', bg);
      break;
    }
    case 'lunette': {
      // a two-leaf dark door under a half-round stone lunette with a carved keystone (the chapel)
      threshold(fp, o.w);
      archRing(fp, o);
      for (const k of [-1, 1]) plankLeaf(fp, o.w / 2 - 0.03, o.h - 0.02, k * (o.w / 4 + 0.005), -0.22, { iron: false });
      fp.box('timber.dark', o.w, 0.12, 0.2, 0, o.h - 0.06, -0.2);
      const disc = new THREE.CircleGeometry(o.w / 2 - 0.01, 14, 0, Math.PI);
      disc.translate(0, o.h + 0.05, -0.12);
      fp.put('stone.sandstone', disc);
      const inner = new THREE.CircleGeometry(o.w / 2 - 0.16, 14, 0, Math.PI);
      inner.translate(0, o.h + 0.07, -0.115);
      fp.put('stone.dressed', inner);
      break;
    }
    case 'loggia':
      // an open first-floor porch between stone piers (the wall left between the openings); its recess is built
      // by the villa's own module
      fp.box('stone.sandstone', o.w + 0.1, 0.08, WALL + 0.04, 0, -0.07, -WALL / 2 + 0.02);
      break;
    default:
      break;
  }
  if (o.lantern) lanternPair(pen, b, f, o, emit);
  if (o.pots) for (const k of [-1, 1]) pot(fp, k * (o.w / 2 + 0.42), 0, 0.3, { flower: o.pots, r: 0.2, seed: Math.round(o.u * 10) + k });
  if (emit && GLAZED.has(o.kind)) emit('window', fp.world(0, Math.min(o.h * 0.55, 1.3), -0.25), { seed: o.seed });
}
const GLAZED = new Set(['window', 'slit', 'glazed', 'barn', 'arch']);

// ---------- iron wall lanterns on scroll brackets ----------

export function lantern(fp, x, y, emit, { arm = 0.36 } = {}) {
  fp.box('iron', 0.08, 0.16, 0.03, x, y - 0.08, 0.015);
  fp.box('iron', 0.025, 0.025, arm, x, y, arm / 2);
  const scroll = new THREE.TorusGeometry(0.075, 0.009, 4, 10, Math.PI * 1.5);
  scroll.rotateY(Math.PI / 2);
  scroll.translate(x, y - 0.08, arm * 0.45);
  fp.put('iron', scroll);
  const cx = x, cy = y - 0.05, cz = arm - 0.02;
  fp.box('iron', 0.012, 0.06, 0.012, cx, cy - 0.06, cz);
  // the cage, its glass, a little roof and a finial
  const top = cy - 0.06;
  fp.box('iron', 0.22, 0.03, 0.22, cx, top - 0.03, cz);
  fp.box('iron', 0.18, 0.025, 0.18, cx, top - 0.37, cz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) fp.box('iron', 0.018, 0.32, 0.018, cx + sx * 0.085, top - 0.35, cz + sz * 0.085);
  fp.box('lamp.warm', 0.15, 0.27, 0.15, cx, top - 0.33, cz);
  const cap = new THREE.ConeGeometry(0.17, 0.12, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(cx, top + 0.06, cz);
  fp.put('iron', cap);
  if (emit) emit('lantern', fp.world(cx, top - 0.2, cz));
}

function lanternPair(pen, b, f, o, emit) {
  const top = ARCHED.has(o.kind) ? o.v0 + o.h + o.w / 2 : o.v0 + o.h;
  const y = o.lanternDy !== undefined ? o.v0 + o.lanternDy : top + 0.35;
  const xs = o.lantern === 'both' ? [-(o.w / 2 + 0.55), o.w / 2 + 0.55] : o.lantern === 'left' ? [-(o.w / 2 + 0.5)] : [o.w / 2 + 0.5];
  xs.forEach((x) => lantern(facePen(pen, b, f, o.u, 0), x, y, emit));
}

// ---------- pots of flowers and window boxes ----------

export function pot(pen, x, y, z, { flower = 'flower.white', r = 0.22, seed = 1 } = {}) {
  pen.put('cotto', cylG(r, r * 0.75, r * 1.5, 9), mat4({ x, y, z }));
  pen.put('cotto', cylG(r * 1.08, r * 1.08, 0.06, 9), mat4({ x, y: y + r * 1.5 - 0.05, z }));
  const rnd = seeded(seed);
  const bush = new THREE.IcosahedronGeometry(r * 1.15, 0);
  bush.scale(1, 0.75, 1);
  bush.translate(x, y + r * 1.5 + r * 0.45, z);
  pen.put('leaf', bush);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.9;
    const fl = new THREE.IcosahedronGeometry(0.055 + rnd() * 0.03, 0);
    fl.translate(x + Math.cos(a) * d, y + r * 1.5 + r * 0.55 + rnd() * r * 0.4, z + Math.sin(a) * d);
    pen.put(flower, fl);
  }
}

export function windowBox(fp, w, { flower = 'flower.red', seed = 3 } = {}) {
  fp.box('timber.walnut', w + 0.1, 0.18, 0.2, 0, 0.0, 0.1);
  const rnd = seeded(seed);
  const n = Math.max(3, Math.round(w / 0.16));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    const g = new THREE.IcosahedronGeometry(0.11 + rnd() * 0.04, 0);
    g.scale(1, 0.8, 1);
    g.translate(x, 0.24, 0.1);
    fp.put('leaf', g);
    if (rnd() < 0.8) {
      const fl = new THREE.IcosahedronGeometry(0.06 + rnd() * 0.03, 0);
      fl.translate(x + (rnd() - 0.5) * 0.08, 0.33 + rnd() * 0.06, 0.12 + (rnd() - 0.5) * 0.06);
      fp.put(flower, fl);
    }
  }
}

// ---------- automatic windows: sparse, irregular, never a grid ----------

export function autoOpenings(b, dress, rnd, explicitAll = []) {
  const out = [];
  const L = b.length, W = b.width;
  FACES.forEach((f) => {
    const fd = dress.faces?.[f] || {};
    if (fd.skip || fd.auto === false) return;
    const len = faceLength(b, f);
    const explicit = explicitAll.filter((o) => o.face === f);
    const cover = fd.cover || [];
    for (let s = 0; s < b.storeys; s++) {
      if (fd.storeys && !fd.storeys.includes(s)) continue;
      const y0 = b.floor + s * b.storeyH;
      const density = fd.density ?? (s === 0 ? 0.55 : 0.48);
      const bays = Math.max(1, Math.floor((len - 1.2) / 2.5));
      for (let i = 0; i < bays; i++) {
        if (rnd() > density) continue;
        const w = 0.7 + rnd() * 0.2;
        const h = w + 0.05 + rnd() * 0.25;
        const u = clamp(0.9 + ((len - 1.8) * (i + 0.5)) / bays + (rnd() - 0.5) * 0.9, 0.75 + w / 2, len - 0.75 - w / 2);
        const sill = s === 0 ? 1.0 + rnd() * 0.25 : 0.85 + rnd() * 0.35;
        const o = { kind: 'window', u, w, h, v0: y0 + sill, s, shutters: rnd() < (fd.shutterRate ?? 0.38), lintel: rnd() < 0.72 ? 'stone.sandstone' : 'timber.dark', seed: rnd() };
        o.box = rnd() < (fd.boxRate ?? 0);
        const clash = [...explicit, ...out.filter((x) => x.face === f)].some((e) => Math.abs(e.u - u) < (e.w + w) / 2 + 0.9 && Math.abs((e.v0 ?? 0) - o.v0) < 2.4);
        const covered = cover.some((c) => u + w / 2 > c.u0 - 0.3 && u - w / 2 < c.u1 + 0.3 && o.v0 < c.v1);
        if (clash || covered || o.v0 + h > y0 + b.storeyH - 0.3) continue;
        out.push({ ...o, face: f });
      }
    }
  });
  return out;
}

// ---------- quoins: bigger squared stones at the outside corners, long and short in turn ----------
// corner (sx, sz) and the two faces that meet there, with the end of each face (u at the corner)
const CORNERS = [
  { sx: -1, sz: 1, faces: [['s', 0], ['w', 'len']] },
  { sx: 1, sz: 1, faces: [['s', 'len'], ['e', 0]] },
  { sx: 1, sz: -1, faces: [['n', 0], ['e', 'len']] },
  { sx: -1, sz: -1, faces: [['n', 'len'], ['w', 0]] },
];

function quoins(frame, b, dress, stone, wallTop, bandOf, openings) {
  CORNERS.forEach(({ sx, sz, faces }) => {
    let from = b.floor;
    for (const [f, end] of faces) {
      const fd = dress.faces?.[f] || {};
      if (fd.skip) return;
      const u = end === 'len' ? faceLength(b, f) : 0;
      (fd.cover || []).forEach((c) => { if (u >= c.u0 - 0.4 && u <= c.u1 + 0.4) from = Math.max(from, c.v1); });
    }
    const near = faces.flatMap(([f, end]) => {
      const u = end === 'len' ? faceLength(b, f) : 0;
      return openings.filter((o) => o.face === f && Math.abs(o.u - u) < o.w / 2 + 0.65);
    });
    for (let y = from, k = 0; y < wallTop - 0.25; y += 0.31, k++) {
      if (near.some((o) => y + 0.28 > o.v0 - 0.25 && y < o.v0 + o.h + (o.kind === 'arch' || o.kind === 'lunette' ? o.w / 2 : 0) + 0.3)) continue;
      const s = Math.min(b.storeys - 1, Math.max(0, Math.floor((y - b.floor) / b.storeyH)));
      const lx = k % 2 ? 0.55 : 0.3, lz = k % 2 ? 0.3 : 0.55;
      const x0 = sx * (b.length / 2 + 0.02), z0 = sz * (b.width / 2 + 0.02);
      frame.inBand(bandOf(s)).span(stone, Math.min(x0, x0 - sx * (lx + 0.02)), Math.max(x0, x0 - sx * (lx + 0.02)), y, y + 0.28, Math.min(z0, z0 - sz * (lz + 0.02)), Math.max(z0, z0 - sz * (lz + 0.02)));
    }
  });
}

// ---------- one block ----------
// bands: 'grounds' always drawn; 's0', 's1', 's2' storeys; 'roof'. cutPen: the low walls shown on a cut floor.

export function buildBlock(pen, cutPen, b, dress, { stone, rnd, emit, roofPen = pen.inBand('roof'), bandOf = (s) => `s${Math.min(s, 2)}`, plinthBand = 'grounds' }) {
  const frame = pen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const cutFrame = cutPen ? cutPen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot })) : null;
  const roofFrame = roofPen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const L = b.length, W = b.width;
  const explicit = FACES.flatMap((f) => (dress.faces?.[f]?.openings || []).map((o) => ({ ...o, face: f, v0: o.v0 ?? b.floor + (o.s || 0) * b.storeyH + (o.sill ?? 0), seed: o.seed ?? rnd() })));
  const auto = autoOpenings(b, dress, rnd, explicit);
  const openings = [...explicit, ...auto];
  // plinth: the stone carried down into the ground
  const plinthBottom = Math.min(b.groundMin, b.floor) - 2.0;
  frame.inBand(plinthBand).span(stone, -L / 2, L / 2, plinthBottom, b.floor, -W / 2, W / 2);
  const wallTop = b.floor + b.storeys * b.storeyH + 0.1;
  for (let s = 0; s < b.storeys; s++) {
    const y0 = b.floor + s * b.storeyH;
    const y1 = s === b.storeys - 1 ? wallTop : y0 + b.storeyH;
    const band = frame.inBand(bandOf(s));
    FACES.forEach((f) => {
      const fd = dress.faces?.[f] || {};
      if (fd.skip) return;
      const mine = openings.filter((o) => o.face === f);
      wallFace(band, b, f, y0, y1, mine, stone);
      if (cutFrame) wallFace(cutFrame.inBand(`c${Math.min(s, 2)}`), b, f, y0, y0 + CUT, mine, stone);
      mine.filter((o) => o.v0 >= y0 - 0.01 && o.v0 < y1 - 0.01).forEach((o) => dressOpening(band, b, f, o, emit));
    });
  }
  if (QUOINS) quoins(frame, b, dress, stone, wallTop, bandOf, openings);
  const roof = blockRoof(roofFrame, b, { stone, top: wallTop, gablePen: roofFrame, skipGable: dress.skipGable || {} });
  (dress.chimneys || []).forEach((c) => {
    const yb = wallTop - 1;
    const yt = roof.ridge + (c.above ?? 0.9);
    chimney(roofFrame, c.x * (L / 2), c.z * (W / 2), yb, yt, { w: c.w || 0.62, d: c.d || 0.62 });
  });
  (dress.gutters || []).forEach((k) => {
    const e = roof.eaves[k];
    if (e) gutter(roofFrame, e.a, e.b, b.groundMin);
  });
  return { frame, roofFrame, roof, openings, wallTop };
}

export { WALL };
