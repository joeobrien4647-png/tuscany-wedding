// Roofs in coppi: low-pitched slopes whose surface is shaped into the half-round tile rows (so the eaves show
// their wavy ends and the slopes catch light like the photos), ridge and hip caps of half-round tiles, a course of
// flat tiles under the eaves, dark boards under the overhang, stone gables, and brick chimneys with little pitched
// tile caps. Everything here is built in a block's own frame: x along its length, z across, y up.
import { THREE, V3, quadG, triG, prismG, cylG, boxG, mat4 } from './kit.js';

export const WALL = 0.55;
export const OVERHANG = 0.42;
export const VERGE = 0.28;
const PERIOD = 0.25;       // one cover tile and one pan
const AMP = 0.075;         // relief of the tile rows

const UPV = new THREE.Vector3(0, 1, 0);
let SAMPLES = 6;            // points per tile row across a slope: 4 on Fast, 6 on Best
export function setRoofDetail(tier) { SAMPLES = tier === 'best' ? 6 : tier === 'balanced' ? 5 : 4; }
const prof = (u) => 0.5 - 0.5 * Math.cos((2 * Math.PI * u) / PERIOD);

// One slope. e0: the eave corner where `along` starts; inward: horizontal, towards the ridge; D: plan depth from
// eave to ridge; hip0/hip1: the ends rise at 45 degrees in plan (hipped) instead of running straight (gable or lean).
export function tiledSlope(pen, { e0, along, inward, E, D, pitch, hip0 = false, hip1 = false, tiles = 'coppi', under = 'timber.dark', thick = 0.06 }) {
  const t = Math.tan(pitch);
  const upSlope = inward.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UPV, Math.sin(pitch)).normalize();
  const n = new THREE.Vector3().crossVectors(along, upSlope).normalize();
  if (n.y < 0) n.negate();
  const du = PERIOD / SAMPLES;
  const N = Math.max(2, Math.ceil(E / du));
  const pos = [], idx = [];
  const vmax = (u) => Math.max(0, Math.min(D, hip0 ? u : D, hip1 ? E - u : D));
  for (let i = 0; i <= N; i++) {
    const u = (E * i) / N;
    const r = AMP * prof(u);
    const b = e0.clone().addScaledVector(along, u).addScaledVector(n, r);
    const v = vmax(u);
    const top = e0.clone().addScaledVector(along, u).addScaledVector(inward, v).addScaledVector(UPV, v * t).addScaledVector(n, r * (v > 0.05 ? 1 : 0));
    const lip = b.clone().addScaledVector(n, -thick - r * 0.6);
    pos.push(b.x, b.y, b.z, top.x, top.y, top.z, lip.x, lip.y, lip.z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, c = (i + 1) * 3;
    idx.push(a, c, c + 1, a, c + 1, a + 1);        // the slope
    idx.push(a + 2, c + 2, c, a + 2, c, a);         // the tile ends at the eave
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setIndex(idx);
  sheet.computeVertexNormals();
  // make the slope face up and out
  const nrm = sheet.attributes.normal;
  if (nrm.getY(Math.floor(N / 2) * 3 + 1) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
    sheet.setIndex(idx);
    sheet.computeVertexNormals();
  }
  pen.put(tiles, sheet, null, { uv: 'slope' });
  // boards under the slope, facing down
  const off = n.clone().multiplyScalar(-thick - 0.02);
  const d0 = hip0 ? D : 0, d1 = hip1 ? D : 0;
  const rise = UPV.clone().multiplyScalar(D * t);
  const p0 = e0.clone().add(off), p1 = e0.clone().addScaledVector(along, E).add(off);
  const p2 = e0.clone().addScaledVector(along, E - d1).addScaledVector(inward, D).add(rise).add(off);
  const p3 = e0.clone().addScaledVector(along, d0).addScaledVector(inward, D).add(rise).add(off);
  const g = p2.distanceTo(p3) < 0.01 ? triG(p0, p2, p1) : quadG(p0, p3, p2, p1);
  pen.put(under, ensureFacing(g, -1), null, { uv: 'world' });
  return { n, upSlope, top: e0.clone().addScaledVector(inward, D).add(rise) };
}

// flip a single-sided piece so its normal's y has the sign wanted (-1 down, +1 up)
function ensureFacing(g, sign) {
  const ny = g.attributes.normal.getY(0);
  if (Math.sign(ny || 1) !== sign) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
    g.computeVertexNormals();
  }
  return g;
}

// Half-round tiles along a ridge or a hip, from a to b.
export function ridgeCap(pen, a, b, r = 0.105, tiles = 'coppi') {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 0.05) return;
  const g = new THREE.CylinderGeometry(r, r, len, 7, 1, true, 0, Math.PI);
  g.rotateZ(Math.PI / 2);          // axis along x, the round half facing up
  g.translate(len / 2, -r * 0.3, 0);
  const flat = Math.hypot(d.x, d.z);
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(-d.z, d.x)).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(d.y, flat))));
  g.translate(a.x, a.y, a.z);
  pen.put(tiles, g, null, { uv: 'world' });
}

// A block's roof: type gable (ridge along x), hip, or lean (one slope, high on side `lean`: 'n' is -z, 's' is +z).
// Returns heights and the ridge, and adds the stone gable ends to `gablePen` (the walls' material).
export function blockRoof(pen, b, { stone, tiles = 'coppi', under = 'timber.dark', eavesCourse = 'cotto', top, gablePen = pen, skipGable = {} }) {
  const L = b.length, W = b.width, o = OVERHANG, ov = VERGE;
  const yTop = top;
  const out = { yTop, ridge: yTop, slopes: [] };
  if (b.roof === 'lean') {
    const high = b.lean === 's' ? 1 : -1;               // +1: the high side is +z
    const pitch = Math.atan2(b.ridgeOver, W);
    const t = Math.tan(pitch);
    const yE = yTop - o * t;
    const e0 = high < 0 ? V3(-L / 2 - ov, yE, W / 2 + o) : V3(L / 2 + ov, yE, -W / 2 - o);
    const along = high < 0 ? V3(1, 0, 0) : V3(-1, 0, 0);
    const inward = V3(0, 0, high);
    const D = W + o;
    tiledSlope(pen, { e0, along, inward, E: L + 2 * ov, D, pitch, tiles, under });
    const yHigh = yTop + b.ridgeOver;
    out.ridge = yHigh + 0.05;
    out.high = high;
    // the cap along the high edge
    const za = high * (W / 2) + 0.0;
    ridgeCap(pen, V3(-L / 2 - ov, yHigh + 0.02, za), V3(L / 2 + ov, yHigh + 0.02, za), 0.1, tiles);
    // stone in the sloping side walls and up the high wall
    for (const k of [-1, 1]) {
      if (skipGable[k < 0 ? 'w' : 'e']) continue;
      const x = k * (L / 2) - k * (WALL / 2);
      const pts = [[-W / 2, 0], [W / 2, 0], [W / 2, high > 0 ? b.ridgeOver : 0], [-W / 2, high > 0 ? 0 : b.ridgeOver]];
      const g = prismG(pts.map(([z, y]) => [z, y]), WALL);
      g.rotateY(-Math.PI / 2);
      g.translate(x, yTop - 0.02, 0);
      gablePen.put(stone, g);
    }
    // the high wall carried up to meet the slope
    const zh = high < 0 ? [-W / 2, -W / 2 + WALL] : [W / 2 - WALL, W / 2];
    gablePen.span(stone, -L / 2, L / 2, yTop - 0.02, yHigh, zh[0], zh[1]);
    if (eavesCourse) pen.box(eavesCourse, L + 0.1, 0.07, o + 0.06, 0, yTop - 0.07, -high * (W / 2 + o / 2 - 0.03));
    out.eaves = [{ a: V3(-L / 2 - ov, yE, -high * (W / 2 + o)), b: V3(L / 2 + ov, yE, -high * (W / 2 + o)) }];
    return out;
  }
  const hip = b.roof === 'hip';
  const D = W / 2 + o;
  const pitch = Math.atan2(b.ridgeOver, W / 2);
  const t = Math.tan(pitch);
  const yE = yTop - o * t;
  const yR = yE + D * t;
  out.ridge = yR + 0.08;
  const Ex = L + 2 * (hip ? o : ov);
  const x0 = -Ex / 2;
  // long sides
  tiledSlope(pen, { e0: V3(x0, yE, W / 2 + o), along: V3(1, 0, 0), inward: V3(0, 0, -1), E: Ex, D, pitch, hip0: hip, hip1: hip, tiles, under });
  tiledSlope(pen, { e0: V3(-x0, yE, -W / 2 - o), along: V3(-1, 0, 0), inward: V3(0, 0, 1), E: Ex, D, pitch, hip0: hip, hip1: hip, tiles, under });
  out.eaves = [{ a: V3(x0, yE, W / 2 + o), b: V3(-x0, yE, W / 2 + o) }, { a: V3(-x0, yE, -W / 2 - o), b: V3(x0, yE, -W / 2 - o) }];
  if (hip) {
    const Ez = W + 2 * o;
    tiledSlope(pen, { e0: V3(L / 2 + o, yE, W / 2 + o), along: V3(0, 0, -1), inward: V3(-1, 0, 0), E: Ez, D, pitch, hip0: true, hip1: true, tiles, under });
    tiledSlope(pen, { e0: V3(-L / 2 - o, yE, -W / 2 - o), along: V3(0, 0, 1), inward: V3(1, 0, 0), E: Ez, D, pitch, hip0: true, hip1: true, tiles, under });
    const rx = Math.max(0, Ex / 2 - D);
    ridgeCap(pen, V3(-rx, yR, 0), V3(rx, yR, 0), 0.105, tiles);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ridgeCap(pen, V3(sx * (L / 2 + o), yE, sz * (W / 2 + o)), V3(sx * rx, yR, 0), 0.095, tiles);
    out.eaves.push({ a: V3(L / 2 + o, yE, W / 2 + o), b: V3(L / 2 + o, yE, -W / 2 - o) }, { a: V3(-L / 2 - o, yE, -W / 2 - o), b: V3(-L / 2 - o, yE, W / 2 + o) });
    if (eavesCourse) {
      for (const k of [-1, 1]) {
        pen.box(eavesCourse, L + 0.1, 0.07, o + 0.06, 0, yTop - 0.07, k * (W / 2 + o / 2 - 0.03));
        pen.box(eavesCourse, o + 0.06, 0.07, W + 0.1, k * (L / 2 + o / 2 - 0.03), yTop - 0.07, 0);
      }
    }
    return out;
  }
  ridgeCap(pen, V3(x0, yR, 0), V3(-x0, yR, 0), 0.105, tiles);
  // stone gables
  for (const k of [-1, 1]) {
    if (skipGable[k < 0 ? 'w' : 'e']) continue;
    const x = k * (L / 2) - k * (WALL / 2);
    const g = prismG([[-W / 2, 0], [W / 2, 0], [0, b.ridgeOver]], WALL);
    g.rotateY(-Math.PI / 2);
    g.translate(x, yTop - 0.02, 0);
    gablePen.put(stone, g);
    // the verge: a plain board of tiles bedded on the gable edge
    for (const s of [-1, 1]) {
      const a = V3(k * (L / 2 + ov), yE + 0.0, s * (W / 2 + o)), c = V3(k * (L / 2 + ov), yR, 0);
      pen.put(tiles, boxAlong(a, c, 0.07, 0.12));
    }
  }
  if (eavesCourse) for (const k of [-1, 1]) pen.box(eavesCourse, L + 0.1, 0.07, o + 0.06, 0, yTop - 0.07, k * (W / 2 + o / 2 - 0.03));
  return out;
}

// a box from a to b (section w by h, h vertical-ish)
export function boxAlong(a, b, w, h) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.BoxGeometry(len, h, w);
  g.translate(len / 2, -h / 2, 0);
  const flat = Math.hypot(d.x, d.z);
  const m = new THREE.Matrix4().makeRotationY(Math.atan2(-d.z, d.x)).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(d.y, flat)));
  g.applyMatrix4(m);
  g.translate(a.x, a.y, a.z);
  return g;
}

// A brick chimney with a little pitched cap of two tiles on brick posts (Vallorsaia has one on almost every roof).
export function chimney(pen, x, z, yBase, yTop, { w = 0.62, d = 0.62, brick = 'brick', tiles = 'coppi', rot = 0 } = {}) {
  const p = pen.at(mat4({ x, z, ry: rot }));
  p.box(brick, w, yTop - yBase, d, 0, yBase, 0);
  p.box(brick, w + 0.1, 0.08, d + 0.1, 0, yTop, 0);
  const postH = 0.26;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(brick, 0.11, postH, 0.11, sx * (w / 2 - 0.06), yTop + 0.08, sz * (d / 2 - 0.06));
  const capY = yTop + 0.08 + postH;
  const half = (d + 0.2) / 2;
  const pitch = 0.42;
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(w + 0.22, 0.05, half / Math.cos(pitch) + 0.02);
    g.rotateX(s * pitch);
    g.translate(0, capY + Math.tan(pitch) * half / 2 + 0.02, s * half / 2);
    p.put(tiles, g);
  }
  return capY + Math.tan(pitch) * half + 0.05;
}

// A copper-brown half-round gutter along a to b, and a round downpipe at b down to the ground.
export function gutter(pen, a, b, groundY, { metal = 'copper', pipeAt = 'b' } = {}) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(0.075, 0.075, len, 6, 1, true, Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.translate(len / 2, 0, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(-d.z, d.x)));
  g.translate(a.x, a.y - 0.08, a.z);
  pen.put(metal, g);
  const p = pipeAt === 'b' ? b : a;
  pen.put(metal, cylG(0.04, 0.04, Math.max(0.2, p.y - 0.12 - groundY), 6), mat4({ x: p.x, y: groundY, z: p.z }));
}

export { WALL as WALL_THICKNESS, boxG };
