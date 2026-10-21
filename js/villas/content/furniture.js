// Furniture and small structures, each drawn at its own origin (x right, y up, z towards the viewer) with
// material names: loungers, umbrellas, slatted tables and chairs, rush chairs, picnic tables, the garden lounge,
// railings, timber fences, kerb blocks, stepping stones, the curved lamp post, the pool shower and ladder.
import { THREE, V3, mat4, boxG, cylG, barG, rodG, tubeG, seeded, flipped } from './kit.js';

// ---------- pool deck ----------

// An aluminium lounger with teal sling, its back raised, head towards -z.
export function lounger(p) {
  const fr = 'aluminium', sl = 'sling.teal';
  for (const k of [-1, 1]) {
    p.box(fr, 0.03, 0.03, 1.36, k * 0.31, 0.3, 0.28);
    p.put(fr, barG(V3(k * 0.31, 0.32, -0.4), V3(k * 0.31, 0.86, -0.92), 0.03));
    p.box(fr, 0.03, 0.3, 0.03, k * 0.31, 0, 0.9);
    p.box(fr, 0.03, 0.3, 0.03, k * 0.31, 0, -0.38);
  }
  p.box(sl, 0.6, 0.02, 1.32, 0, 0.31, 0.28);
  const back = new THREE.BoxGeometry(0.6, 0.02, 0.74);
  back.rotateX(-0.79);
  back.translate(0, 0.6, -0.66);
  p.put(sl, back);
}

export function foldingArmchair(p, { fr = 'aluminium', seat = 'sling.teal' } = {}) {
  for (const k of [-1, 1]) {
    p.put(fr, barG(V3(k * 0.27, 0, 0.25), V3(k * 0.27, 0.62, -0.22), 0.025));
    p.put(fr, barG(V3(k * 0.27, 0, -0.25), V3(k * 0.27, 0.45, 0.2), 0.025));
    p.box(fr, 0.04, 0.03, 0.46, k * 0.28, 0.62, 0.02);
  }
  p.box(seat, 0.52, 0.02, 0.44, 0, 0.42, 0.02);
  const back = new THREE.BoxGeometry(0.52, 0.48, 0.02);
  back.rotateX(-0.18);
  back.translate(0, 0.7, -0.22);
  p.put(seat, back);
}

// A big square umbrella in ecru canvas on a central pole and a round stone base.
export function squareUmbrella(p, { size = 2.8, h = 2.45 } = {}) {
  p.put('stone.sandstone', cylG(0.32, 0.36, 0.16, 12));
  p.put('aluminium', cylG(0.025, 0.025, h + 0.15, 6), mat4({ y: 0.1 }));
  const half = size / 2;
  const canopy = new THREE.ConeGeometry(half * Math.SQRT2, 0.55, 4, 1, true);
  canopy.rotateY(Math.PI / 4);
  canopy.translate(0, h + 0.05, 0);
  p.put('canvas.ecru', canopy.clone());
  p.put('canvas.ecru', flipped(canopy.clone().translate(0, -0.025, 0)));
  // a valance round the edge
  for (const [x, z, ry] of [[0, half, 0], [0, -half, 0], [half, 0, Math.PI / 2], [-half, 0, Math.PI / 2]]) {
    p.box('canvas.ecru', size, 0.14, 0.01, x, h - 0.38, z, ry);
  }
  p.box('canvas.ecru', 0.12, 0.12, 0.12, 0, h + 0.3, 0);
}

export function closedUmbrella(p, { h = 2.45 } = {}) {
  p.put('stone.sandstone', cylG(0.32, 0.36, 0.16, 12));
  p.put('aluminium', cylG(0.025, 0.025, h + 0.15, 6), mat4({ y: 0.1 }));
  p.put('canvas.ecru', cylG(0.1, 0.03, 1.5, 6), mat4({ y: h - 1.3 }));
}

// ---------- tables and chairs ----------

export function slattedTable(p, { length = 2.2, width = 0.9, wood = 'timber.honey', h = 0.74 } = {}) {
  const n = Math.max(4, Math.round(width / 0.11));
  for (let i = 0; i < n; i++) p.box(wood, length, 0.035, width / n - 0.012, 0, h - 0.035, -width / 2 + (width * (i + 0.5)) / n);
  for (const k of [-1, 1]) p.box(wood, 0.07, 0.07, width - 0.06, k * (length / 2 - 0.12), h - 0.1, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(wood, 0.065, h - 0.035, 0.065, sx * (length / 2 - 0.12), 0, sz * (width / 2 - 0.08));
}

// a folding slatted garden chair, facing +z
export function slattedChair(p, { wood = 'timber.honey' } = {}) {
  for (const k of [-1, 1]) {
    p.put(wood, barG(V3(k * 0.22, 0, 0.22), V3(k * 0.22, 0.92, -0.2), 0.035, 0.035));
    p.put(wood, barG(V3(k * 0.22, 0, -0.2), V3(k * 0.22, 0.45, 0.18), 0.035, 0.035));
  }
  for (let i = 0; i < 4; i++) p.box(wood, 0.46, 0.022, 0.08, 0, 0.44, -0.14 + i * 0.1);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.BoxGeometry(0.46, 0.07, 0.02);
    s.rotateX(-0.42);
    s.translate(0, 0.6 + i * 0.11, -0.16 - i * 0.045);
    p.put(wood, s);
  }
}

// a Tuscan ladder-back chair with a rush seat, facing +z
export function rushChair(p, { wood = 'timber.honey', rush = 'rush' } = {}) {
  for (const sx of [-1, 1]) {
    p.box(wood, 0.035, 0.45, 0.035, sx * 0.2, 0, 0.19);
    p.box(wood, 0.035, 1.0, 0.035, sx * 0.2, 0, -0.19);
  }
  p.box(rush, 0.42, 0.05, 0.4, 0, 0.43, 0.0);
  for (const y of [0.62, 0.76, 0.9]) p.box(wood, 0.4, 0.06, 0.02, 0, y, -0.19);
  for (const y of [0.15, 0.3]) { p.box(wood, 0.4, 0.02, 0.02, 0, y, 0.19); p.box(wood, 0.02, 0.02, 0.38, 0.2, y, 0); p.box(wood, 0.02, 0.02, 0.38, -0.2, y, 0); }
}

export function picnicTable(p, { length = 2.0, wood = 'timber.rough' } = {}) {
  for (let i = 0; i < 5; i++) p.box(wood, length, 0.045, 0.14, 0, 0.73, -0.32 + i * 0.16);
  for (const k of [-1, 1]) {
    for (let i = 0; i < 2; i++) p.box(wood, length, 0.04, 0.14, 0, 0.44, k * (0.62 + i * 0.16));
    // the A-frame legs
    for (const s of [-1, 1]) p.put(wood, barG(V3(k * (length / 2 - 0.25), 0, s * 0.85), V3(k * (length / 2 - 0.25), 0.73, s * 0.12), 0.08, 0.06));
    p.box(wood, 0.06, 0.06, 1.9, k * (length / 2 - 0.25), 0.4, 0);
  }
}

// garden lounge: taupe aluminium frames with textilene
export function gardenArmchair(p) {
  const fr = 'aluminium', fab = 'fabric.taupe';
  for (const k of [-1, 1]) { p.box(fr, 0.05, 0.62, 0.7, k * 0.36, 0, 0); }
  p.box(fab, 0.68, 0.12, 0.62, 0, 0.32, 0.02);
  p.box(fab, 0.68, 0.48, 0.1, 0, 0.42, -0.3);
}

export function gardenSofa(p) {
  const fr = 'aluminium', fab = 'fabric.taupe';
  for (const k of [-1, 1]) p.box(fr, 0.05, 0.62, 0.72, k * 0.72, 0, 0);
  p.box(fab, 1.4, 0.12, 0.64, 0, 0.32, 0.02);
  p.box(fab, 1.4, 0.48, 0.1, 0, 0.42, -0.31);
}

export function lowTable(p) {
  p.box('aluminium', 0.9, 0.04, 0.55, 0, 0.38, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('aluminium', 0.04, 0.38, 0.04, sx * 0.42, 0, sz * 0.24);
}

// a refectory table on X-braced trestles with its two long benches
export function refectory(p, { length = 3.0, wood = 'timber.walnut', benches = true } = {}) {
  p.box(wood, length, 0.07, 0.86, 0, 0.7, 0);
  for (const k of [-1, 1]) {
    const x = k * (length / 2 - 0.35);
    p.put(wood, barG(V3(x - 0.05, 0, -0.32), V3(x + 0.05, 0.7, 0.32), 0.07, 0.07));
    p.put(wood, barG(V3(x - 0.05, 0, 0.32), V3(x + 0.05, 0.7, -0.32), 0.07, 0.07));
    p.box(wood, 0.08, 0.06, 0.78, x, 0.64, 0);
  }
  p.box(wood, length - 0.8, 0.06, 0.06, 0, 0.3, 0);
  if (benches) for (const s of [-1, 1]) {
    p.box(wood, length, 0.05, 0.3, 0, 0.44, s * 0.72);
    for (const k of [-1, 1]) p.box(wood, 0.06, 0.44, 0.24, k * (length / 2 - 0.3), 0, s * 0.72);
  }
}

// ---------- railings and fences (along a polyline of points in the frame) ----------

// rust-bronze or black iron: thin vertical bars between a top and a bottom rail
export function barRailing(p, pts, { h = 1.0, gap = 0.12, metal = 'iron.rust', y = 0, posts = 2.0 } = {}) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ya = a[2] ?? y, yb = b[2] ?? y;
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, cy = (ya + yb) / 2;
    for (const t of [0.08, h - 0.03]) p.put(metal, barG(V3(a[0], ya + t, a[1]), V3(b[0], yb + t, b[1]), 0.03, 0.025));
    const n = Math.max(1, Math.round(len / gap));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, yy = ya + (yb - ya) * f;
      const thick = k % Math.max(1, Math.round(posts / gap)) === 0 ? 0.045 : 0.016;
      p.box(metal, thick, h, thick, x, yy, z, ry);
    }
    void cx; void cz; void cy;
  }
}

// a two-rail iron railing with posts (the tettoia's parapet, handrails)
export function twoRail(p, pts, { h = 0.9, metal = 'iron', y = 0, every = 1.4 } = {}) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const ya = a[2] ?? y, yb = b[2] ?? y;
    for (const t of [h * 0.5, h]) p.put(metal, barG(V3(a[0], ya + t, a[1]), V3(b[0], yb + t, b[1]), 0.035, 0.035));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / every));
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      p.box(metal, 0.035, h, 0.035, a[0] + (b[0] - a[0]) * f, ya + (yb - ya) * f, a[1] + (b[1] - a[1]) * f);
    }
  }
}

// dark split-rail timber fence: rough posts and two rails; `groundAt(x, z)` in frame coordinates
export function splitRail(p, pts, groundAt, { wood = 'timber.rough', h = 1.05, every = 2.2, seed = 5 } = {}) {
  const rnd = seeded(seed);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / every));
    let prev = null;
    for (let k = 0; k <= n; k++) {
      if (i > 1 && k === 0) { prev = [a[0], a[1], groundAt(a[0], a[1])]; continue; }
      const f = k / n;
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, y = groundAt(x, z);
      const post = rodG(V3(x, y - 0.3, z), V3(x + (rnd() - 0.5) * 0.04, y + h + 0.05, z + (rnd() - 0.5) * 0.04), 0.06 + rnd() * 0.015, 6);
      p.put(wood, post);
      if (prev) for (const t of [h * 0.48, h * 0.92]) p.put(wood, rodG(V3(prev[0], prev[2] + t, prev[1]), V3(x, y + t + (rnd() - 0.5) * 0.05, z), 0.045, 5));
      prev = [x, z, y];
    }
  }
}

// ---------- stone in the garden ----------

export function roughBlock(p, x, y, z, { w = 0.9, h = 0.45, d = 0.5, ry = 0, seed = 1, stone = 'stone.sandstone' } = {}) {
  const rnd = seeded(seed);
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.92 + rnd() * 0.12), pos.getY(i) * (0.9 + rnd() * 0.15), pos.getZ(i) * (0.9 + rnd() * 0.15));
  g.translate(0, h / 2 - 0.06, 0);
  g.computeVertexNormals();
  p.put(stone, g, mat4({ x, y, z, ry: ry + (rnd() - 0.5) * 0.12 }));
}

export function standingStone(p, x, y, z, { h = 1.7, seed = 9 } = {}) {
  const rnd = seeded(seed);
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * 0.75 * (0.92 + rnd() * 0.16), pos.getY(i) * h * (0.96 + rnd() * 0.08), pos.getZ(i) * 0.55 * (0.92 + rnd() * 0.16));
  g.computeVertexNormals();
  g.translate(0, h / 2 - 0.15, 0);
  p.put('stone.sandstone', g, mat4({ x, y, z, ry: rnd() * Math.PI }));
}

// irregular flagstones laid as a path from a to b (frame coordinates), each resting on the ground
export function steppingStones(p, a, b, groundAt, { step = 0.85, seed = 4, stone = 'flag.crazy' } = {}) {
  const rnd = seeded(seed);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = a[0] + (b[0] - a[0]) * f + (rnd() - 0.5) * 0.2, z = a[1] + (b[1] - a[1]) * f + (rnd() - 0.5) * 0.2;
    const pts = [];
    const r = 0.3 + rnd() * 0.1, sides = 5 + Math.floor(rnd() * 3);
    for (let k = 0; k < sides; k++) { const t = (k / sides) * Math.PI * 2 + rnd() * 0.4; const rr = r * (0.8 + rnd() * 0.35); pts.push(new THREE.Vector2(Math.cos(t) * rr, Math.sin(t) * rr)); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.08, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    p.put(stone, g, mat4({ x, y: groundAt(x, z) - 0.03, z, ry: rnd() * 3 }));
  }
}

// ---------- pool kit ----------

export function poolLadder(p) {
  for (const k of [-1, 1]) {
    const pts = [V3(k * 0.25, -1.2, 0.08), V3(k * 0.25, 0.1, 0.08), V3(k * 0.25, 0.75, -0.05), V3(k * 0.25, 0.85, -0.35), V3(k * 0.25, 0.55, -0.6), V3(k * 0.25, 0.05, -0.62)];
    p.put('steel', tubeG(pts, 0.022, 6));
  }
  for (let i = 0; i < 3; i++) p.box('steel', 0.46, 0.03, 0.09, 0, -0.25 - i * 0.3, 0.1);
}

export function poolShower(p) {
  p.box('steel', 0.3, 0.02, 0.3, 0, 0, 0);
  p.put('steel', cylG(0.045, 0.05, 2.35, 10));
  p.put('steel', barG(V3(0, 2.3, 0), V3(0, 2.32, 0.32), 0.035, 0.035));
  p.put('steel', cylG(0.11, 0.11, 0.03, 12), mat4({ y: 2.26, z: 0.32 }));
  p.box('steel', 0.05, 0.08, 0.05, 0, 1.0, 0.05);
}

export function lifebuoy(p) {
  const g = new THREE.TorusGeometry(0.29, 0.065, 6, 16);
  p.put('flower.red', g, mat4({ y: 0.4 }));
  for (let i = 0; i < 4; i++) {
    const s = new THREE.TorusGeometry(0.29, 0.068, 6, 3, Math.PI / 7);
    s.rotateZ((i * Math.PI) / 2 + 0.6);
    p.put('linen', s, mat4({ y: 0.4 }));
  }
}

// The tall curved iron lamp post: a post that bends over at the top with a lantern hanging from the end.
export function curvedLampPost(p, emit, { h = 3.4 } = {}) {
  p.put('iron', cylG(0.09, 0.12, 0.4, 8));
  p.put('iron', tubeG([V3(0, 0.3, 0), V3(0, h * 0.6, 0), V3(0.02, h * 0.92, 0), V3(0.22, h + 0.08, 0), V3(0.5, h, 0)], 0.045, 7));
  p.box('iron', 0.2, 0.03, 0.2, 0.52, h - 0.2, 0);
  p.box('lamp.warm', 0.15, 0.24, 0.15, 0.52, h - 0.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iron', 0.018, 0.28, 0.018, 0.52 + sx * 0.085, h - 0.47, sz * 0.085);
  const cap = new THREE.ConeGeometry(0.16, 0.12, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0.52, h - 0.12, 0);
  p.put('iron', cap);
  if (emit) emit('lamp', p.world(0.52, h - 0.33, 0));
}

// fallow deer, low-poly: body, neck, head, legs (one material)
export function deer(p, { s = 1 } = {}) {
  const m = 'deer';
  const body = new THREE.CapsuleGeometry(0.22 * s, 0.75 * s, 3, 7);
  body.rotateZ(Math.PI / 2);
  body.translate(0, 0.85 * s, 0);
  p.put(m, body);
  p.put(m, barG(V3(0.42 * s, 0.95 * s, 0), V3(0.62 * s, 1.35 * s, 0), 0.12 * s, 0.1 * s));
  const head = new THREE.ConeGeometry(0.09 * s, 0.32 * s, 6);
  head.rotateZ(-Math.PI / 2 - 0.4);
  head.translate(0.75 * s, 1.36 * s, 0);
  p.put(m, head);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.put(m, barG(V3(sx * 0.33 * s, 0, sz * 0.1 * s), V3(sx * 0.3 * s, 0.8 * s, sz * 0.1 * s), 0.05 * s, 0.05 * s));
  for (const sz of [-1, 1]) p.put(m, barG(V3(0.66 * s, 1.44 * s, sz * 0.03), V3(0.62 * s, 1.56 * s, sz * 0.12 * s), 0.05 * s, 0.015));
  p.put('linen', barG(V3(-0.5 * s, 0.85 * s, 0), V3(-0.62 * s, 0.7 * s, 0), 0.06 * s, 0.03 * s));
}
