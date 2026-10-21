// Inside the villas, "how it could look" (loaded the first time a floor is cut open). Drawn from the listing
// photos, but rooms are not where they really are: no plan is public. Every bedroom is the same and none is
// numbered; beds per room are not shown; bathrooms are not drawn.
import { THREE, V3, mat4, createCollector, createPen, cylG, barG, pickBox } from './kit.js';
import { WALL } from './roofs.js';
import * as F from './furniture.js';
import { registerEmitters } from './index.js';

const PART = 0.14;
const CUT = 1.15;

export function loadInteriors(api, state, villaId) {
  const estate = state.estate;
  const mat = (n) => api.use('materials').get(n);
  const v = api.model.villas.find((x) => x.id === villaId);
  const floors = new Map();     // storey -> Group
  const groupAll = new THREE.Group();
  groupAll.name = `interiors-${villaId}`;
  const emitted = [];
  const maxStoreys = Math.max(...v.blocks.map((b) => b.storeys));
  for (let f = 0; f < maxStoreys; f++) {
    const c = createCollector(['base']);
    const pen = createPen(c);
    const emit = (kind, pos) => emitted.push({ kind, pos, villa: villaId, floor: f, status: 'idea' });
    v.blocks.filter((b) => b.storeys > f).forEach((b) => furnishFloor(pen, v, b, f, emit));
    const chapel = api.model.outbuildings.find((o) => o.kind === 'chapel' && o.villa === villaId);
    if (chapel && f === 0) chapelNave(pen, chapel);
    const g = new THREE.Group();
    g.name = `interiors-${villaId}-${f}`;
    c.finish(mat, { label: `${villaId}-inside-${f}`, shadows: (n) => !['plaster', 'flag.interior', 'cotto', 'boards.dark'].includes(n) }).forEach((m) => g.add(m));
    g.visible = false;
    floors.set(f, g);
    groupAll.add(g);
  }
  // the rooms, for taps on a cut-open floor
  const roomPicks = [];
  estate.rooms.forEach((r) => {
    if (r.villa !== villaId) return;
    const m = pickBox({ c: [(r.box.x1 + r.box.x2) / 2, (r.box.z1 + r.box.z2) / 2], rot: 0, length: r.box.x2 - r.box.x1, width: r.box.z2 - r.box.z1, y1: r.box.y1, y2: r.box.y1 + 0.25 }, `pick:room:${r.id}`);
    // the box above is axis-aligned around the rotated room; use the room's own frame instead
    const c = r.cell, b = r.block;
    m.geometry.dispose();
    m.geometry = new THREE.BoxGeometry(c.x[1] - c.x[0], 0.3, c.z[1] - c.z[0]);
    m.position.set(r.centre.x, r.centre.y + 0.15, r.centre.z);
    m.rotation.y = b.rot;
    m.visible = false;
    m.userData = { villa: villaId, room: r.id, pick: `room:${r.id}` };
    m.updateMatrixWorld(true);
    groupAll.add(m);
    roomPicks.push({ m, r });
    if (!api.pickables.get(`room:${r.id}`)) api.pickables.add({ id: `room:${r.id}`, objects: [m], villa: villaId, room: r.id, place: r.cell.id ? placeFor(api, r.cell.id) : undefined });
  });
  estate.villas.get(villaId).group.add(groupAll);
  return {
    group: groupAll,
    emitted,
    setFloor(id, mode) {
      if (id !== villaId) return;
      floors.forEach((g, f) => { g.visible = mode !== 'outside' && f === mode; });
      roomPicks.forEach(({ m, r }) => { m.visible = mode !== 'outside' && r.floor === mode; });
      // the lamps inside are the night's only while their floor is open
      api.emitters.all((e) => e.id.startsWith(`inside:${villaId}:`)).forEach((e) => api.emitters.remove(e.id));
      if (mode !== 'outside') registerEmitters(api, emitted.filter((e) => e.floor === mode), { prefix: 'inside:' });
      api.loop.request();
    },
  };
}

const placeFor = (api, room) => api.places.all((p) => p.room === room)[0]?.id;

function furnishFloor(pen, v, b, f, emit) {
  const y0 = b.floor + f * b.storeyH;
  const p = pen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const L = b.length - 2 * WALL, W = b.width - 2 * WALL;
  const cells = v.cells.filter((c) => c.block === b.id && c.floor === f);
  const ground = f === 0;
  // dark boards upstairs; cotto (Vallorsaia) or blue-grey flagstones (Santarsa) below
  const floorMat = ground ? (v.id === 'santarsa' ? 'flag.interior' : 'cotto') : 'boards.dark';
  p.span(floorMat, -L / 2, L / 2, y0 - 0.22, y0, -W / 2, W / 2);
  // limewash on the inside of the outer walls, to the cut, with a grey foot band
  for (const [x1, x2, z1, z2] of [[-L / 2, L / 2, -W / 2, -W / 2 + 0.02], [-L / 2, L / 2, W / 2 - 0.02, W / 2], [-L / 2, -L / 2 + 0.02, -W / 2, W / 2], [L / 2 - 0.02, L / 2, -W / 2, W / 2]]) {
    p.span('plaster', x1, x2, y0, y0 + CUT, z1, z2);
  }
  cells.forEach((c) => {
    const x0 = c.x[0], x1 = c.x[1], z0 = c.z[0], z1 = c.z[1];
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (c.row !== null) p.span('plaster', x1, x1 + PART, y0, y0 + CUT, z0, z1);
    else p.span('plaster', x1, x1 + PART, y0, y0 + CUT, -W / 2, W / 2);
    const fp = p.at(mat4({ x: cx, y: y0, z: cz }));
    if (c.kind === 'bedroom') bedroom(fp, v.id, c, x1 - x0, z1 - z0);
    else if (c.kind === 'salone') salone(fp, x1 - x0, z1 - z0, emit);
    else if (c.kind === 'stable') stable(fp, x1 - x0, z1 - z0, emit);
    else if (c.kind === 'kitchen') kitchen(fp, v.id, x1 - x0, z1 - z0, emit);
    else living(fp, v.id, x1 - x0, z1 - z0);
  });
  const rows = cells.filter((c) => c.row !== null);
  if (rows.length && rows.some((c) => c.row === 1)) {
    const xs = Math.min(...rows.map((c) => c.x[0]));
    p.span('plaster', xs, L / 2, y0, y0 + CUT, -PART / 2, PART / 2);
  }
}

// one illustrative bed (walnut panelled headboard, a quilted spread in stripes at Santarsa or checks at
// Vallorsaia), a walnut armoire, a rush chair, a small chest, a little rug
function bedroom(p, villa, c, len, dep) {
  const head = c.row === 1 ? 1 : -1;
  const bz = head * (dep / 2 - 1.08);
  const bp = p.at(mat4({ z: bz, ry: head < 0 ? 0 : Math.PI }));
  bp.box('timber.walnut', 1.45, 0.3, 2.0, 0, 0, 0);
  bp.box('linen', 1.38, 0.2, 1.94, 0, 0.3, 0);
  bp.box('timber.walnut', 1.52, 1.05, 0.07, 0, 0, -1.02);
  for (const x of [-0.42, 0, 0.42]) bp.box('timber.walnut', 0.34, 0.42, 0.03, x, 0.48, -0.985);
  bp.box('linen', 1.15, 0.12, 0.38, 0, 0.5, -0.75);
  bp.box(villa === 'santarsa' ? 'fabric.stripe' : 'fabric.check', 1.5, 0.07, 1.42, 0, 0.5, 0.27);
  bp.box(villa === 'santarsa' ? 'fabric.stripe' : 'fabric.check', 0.02, 0.32, 1.42, 0.75, 0.25, 0.27);
  bp.box(villa === 'santarsa' ? 'fabric.stripe' : 'fabric.check', 0.02, 0.32, 1.42, -0.75, 0.25, 0.27);
  for (const k of [-1, 1]) bp.box('timber.walnut', 0.42, 0.5, 0.36, k * 1.0, 0, -0.8);
  p.box('timber.walnut', 1.1, 1.95, 0.6, len / 2 - 0.72, 0, -head * (dep / 2 - 0.36));
  p.box('timber.dark', 1.14, 0.06, 0.64, len / 2 - 0.72, 1.95, -head * (dep / 2 - 0.36));
  F.rushChair(p.at(mat4({ x: -len / 2 + 0.5, z: -head * (dep / 2 - 0.55), ry: head < 0 ? Math.PI : 0 })));
  p.box('timber.walnut', 0.7, 0.78, 0.42, -len / 2 + 0.45, 0, head * (dep / 2 - 0.3));
  p.box('fabric.taupe', 1.1, 0.012, 0.7, 0, 0, bz - head * 1.45);
}

// Santarsa's salone: long dark walnut refectory tables on X-trestles with benches, rush chairs at the ends, the
// big stone fireplace with its thick timber mantel beam and the chimney breast, white enamel dome pendants
function salone(p, len, dep, emit) {
  const tl = Math.min(2.6, (len - 3.2) / 3 - 0.2);
  [-1, 0, 1].forEach((k) => {
    const x = 0.9 + k * (tl + 0.45);
    F.refectory(p.at(mat4({ x, z: 0.55 })), { length: tl });
    pendant(p, x, 2.35, 0.55, emit);
  });
  F.refectory(p.at(mat4({ x: 0.9, z: -dep / 2 + 1.3 })), { length: Math.min(4.2, len - 3.6) });
  for (const k of [-1, 1]) F.rushChair(p.at(mat4({ x: 0.9 + k * (1.5 * tl + 0.95), z: 0.55, ry: -k * Math.PI / 2 })));
  // the fireplace on the end wall: a stone hearth and breast, the thick dark mantel beam, soot in the mouth
  const fx = -len / 2;
  p.box('stone.santarsa', 0.75, 3.4, 2.6, fx + 0.38, 0, -0.2);
  p.box('soot', 0.05, 1.05, 1.5, fx + 0.76, 0.05, -0.2);
  p.box('stone.sandstone', 0.9, 0.12, 2.0, fx + 0.6, -0.02, -0.2);
  p.box('timber.dark', 0.5, 0.34, 2.8, fx + 0.85, 1.1, -0.2);
  p.box('iron', 0.3, 0.02, 0.3, fx + 1.05, 0.06, -0.2);
  p.put('fire', cylG(0.18, 0.05, 0.25, 6), mat4({ x: fx + 0.95, y: 0.1, z: -0.2 }));
  emit('fire', p.world(fx + 0.95, 0.25, -0.2));
  // a low sofa and an armchair by the fire
  p.box('fabric.taupe', 0.85, 0.75, 1.9, fx + 2.6, 0, -0.2);
  p.box('fabric.taupe', 0.85, 0.75, 0.8, fx + 1.9, 0, 1.25);
}

function pendant(p, x, y, z, emit) {
  p.box('iron', 0.01, 0.6, 0.01, x, y + 0.15, z);
  const dome = new THREE.SphereGeometry(0.2, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  p.put('paint.white', dome, mat4({ x, y: y + 0.0, z }));
  p.put('lamp.warm', new THREE.SphereGeometry(0.06, 6, 4), mat4({ x, y: y - 0.02, z }));
  emit('pendant', p.world(x, y - 0.05, z));
}

// Vallorsaia's old stable: a big round stone arch across the room, one very long thick plank table, rush chairs,
// and the table football
function stable(p, len, dep, emit) {
  const archX = -len / 2 + 2.6;
  const r = dep / 2 - 0.1;
  const shape = new THREE.Shape();
  shape.moveTo(-dep / 2, 0);
  shape.lineTo(-r, 0);
  shape.lineTo(-r, 1.3);
  shape.absarc(0, 1.3, r, Math.PI, 0, true);
  shape.lineTo(r, 0);
  shape.lineTo(dep / 2, 0);
  shape.lineTo(dep / 2, 1.3 + r + 0.45);
  shape.lineTo(-dep / 2, 1.3 + r + 0.45);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -0.3);
  g.rotateY(Math.PI / 2);
  p.put('stone.vallorsaia', g, mat4({ x: archX }));
  const tl = Math.min(6.2, len - 3.4);
  const tx = archX + 0.6 + tl / 2;
  p.box('timber.dark', tl, 0.1, 0.95, tx, 0.7, 0);
  for (const k of [-1, 1]) for (const s of [-1, 1]) p.box('timber.dark', 0.12, 0.7, 0.12, tx + k * (tl / 2 - 0.3), 0, s * 0.35);
  for (let i = 0; i < Math.floor(tl / 0.62); i++) {
    const x = tx - tl / 2 + 0.35 + i * 0.62;
    F.rushChair(p.at(mat4({ x, z: 0.78, ry: Math.PI })));
    F.rushChair(p.at(mat4({ x, z: -0.78 })));
  }
  // the table football, past the arch
  const fx = archX - 1.3;
  p.box('timber.walnut', 1.25, 0.75, 0.75, fx, 0.0, 0);
  p.box('leaf', 1.15, 0.02, 0.65, fx, 0.75, 0);
  for (let i = 0; i < 6; i++) p.put('steel', cylG(0.012, 0.012, 1.25, 5).rotateX(Math.PI / 2), mat4({ x: fx - 0.48 + i * 0.19, y: 0.86, z: 0 }));
  pendant(p, tx - tl / 4, 2.3, 0, emit);
  pendant(p, tx + tl / 4, 2.3, 0, emit);
}

// Santarsa's group kitchen: stainless range under a big hood, steel work tables and island, open steel shelves.
// Vallorsaia's big kitchen: a long refectory table with rush chairs, a stainless run, a black cast-iron stove.
function kitchen(p, villa, len, dep, emit) {
  if (villa === 'santarsa') {
    p.box('steel', len - 0.4, 0.9, 0.65, 0, 0, -dep / 2 + 0.35);
    p.box('iron', 1.2, 0.03, 0.6, -len / 2 + 1.0, 0.9, -dep / 2 + 0.35);
    p.box('steel', 1.3, 0.55, 0.85, -len / 2 + 1.0, 1.75, -dep / 2 + 0.45);
    p.box('steel', 2.2, 0.9, 0.95, 0, 0, 0.55);
    for (const y of [1.1, 1.5]) p.box('steel', len - 2.6, 0.03, 0.35, 0.8, y, dep / 2 - 0.2);
    for (let i = 0; i < 4; i++) p.put('steel', cylG(0.14, 0.14, 0.24, 10), mat4({ x: 0.2 + i * 0.4, y: 1.53, z: dep / 2 - 0.2 }));
    pendant(p, 0, 2.2, 0.55, emit);
  } else {
    const tl = Math.min(4.4, len - 1.6);
    F.refectory(p.at(mat4({ x: 0.3, z: 0.5 })), { length: tl, wood: 'timber.walnut', benches: false });
    for (let i = 0; i < Math.floor(tl / 0.62); i++) {
      const x = 0.3 - tl / 2 + 0.35 + i * 0.62;
      F.rushChair(p.at(mat4({ x, z: 1.28, ry: Math.PI })));
      F.rushChair(p.at(mat4({ x, z: -0.28 })));
    }
    p.box('steel', len - 0.6, 0.9, 0.62, 0, 0, -dep / 2 + 0.33);
    p.box('timber.walnut', len - 0.6, 0.86, 0.04, 0, 0, -dep / 2 + 0.66);
    p.put('iron', cylG(0.3, 0.3, 0.75, 12), mat4({ x: len / 2 - 0.6, z: dep / 2 - 0.6 }));
    p.put('iron', cylG(0.07, 0.07, 1.6, 8), mat4({ x: len / 2 - 0.6, y: 0.75, z: dep / 2 - 0.6 }));
    pendant(p, 0.3, 2.2, 0.5, emit);
  }
}

// The chapel (probably the stone building by the pool): a single small nave on a flagstone floor, the altar end
// limewashed with a round-arched niche over a stone altar, old walnut kneeling benches. Nothing more is modelled.
function chapelNave(pen, b) {
  const p = pen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const L = b.length - 2 * WALL, W = b.width - 2 * WALL, y0 = b.floor;
  p.span('flag.interior', -L / 2, L / 2, y0 - 0.2, y0 + 0.01, -W / 2, W / 2);
  // the altar wall at the north end (local -x), full height, with its niche
  const x0 = -L / 2;
  p.span('plaster', x0, x0 + 0.03, y0, y0 + 3.6, -W / 2, W / 2);
  const niche = new THREE.Shape();
  niche.moveTo(-0.38, 0); niche.lineTo(0.38, 0); niche.lineTo(0.38, 0.7); niche.absarc(0, 0.7, 0.38, 0, Math.PI, false); niche.closePath();
  const ng = new THREE.ExtrudeGeometry(niche, { depth: 0.02, bevelEnabled: false, curveSegments: 10 });
  ng.rotateY(Math.PI / 2);
  p.put('stone.sandstone', ng, mat4({ x: x0 + 0.04, y: y0 + 1.45 }));
  const inner = new THREE.Shape();
  inner.moveTo(-0.3, 0); inner.lineTo(0.3, 0); inner.lineTo(0.3, 0.68); inner.absarc(0, 0.68, 0.3, 0, Math.PI, false); inner.closePath();
  const ig = new THREE.ExtrudeGeometry(inner, { depth: 0.02, bevelEnabled: false, curveSegments: 10 });
  ig.rotateY(Math.PI / 2);
  p.put('soot', ig, mat4({ x: x0 + 0.065, y: y0 + 1.52 }));
  p.box('stone.sandstone', 0.8, 0.95, 1.7, x0 + 0.45, y0, 0);
  p.box('brick', 0.02, 0.7, 1.4, x0 + 0.86, y0 + 0.1, 0);
  p.box('stone.sandstone', 0.92, 0.08, 1.85, x0 + 0.47, y0 + 0.95, 0);
  p.box('linen', 0.6, 0.01, 1.5, x0 + 0.45, y0 + 1.03, 0);
  // kneeling benches: a seat rail, a kneeler and a book rest, in walnut
  for (let i = 0; i < 5; i++) {
    const x = x0 + 1.9 + i * 0.95;
    for (const k of [-1, 1]) {
      const z = k * 0.95;
      p.box('timber.walnut', 0.07, 0.85, 1.1, x - 0.28, y0, z);
      p.box('timber.walnut', 0.36, 0.04, 1.1, x, y0 + 0.45, z);
      p.box('timber.walnut', 0.18, 0.06, 1.1, x + 0.3, y0 + 0.1, z);
      p.box('timber.walnut', 0.22, 0.04, 1.1, x - 0.36, y0 + 0.85, z);
      for (const s of [-1, 1]) p.box('timber.walnut', 0.05, 0.45, 0.05, x + 0.15, y0, z + s * 0.5);
    }
  }
}

// apartment living rooms: a farmhouse table, rush chairs, a dresser
function living(p, villa, len, dep) {
  if (len < 1.6) return;
  F.slattedTable(p.at(mat4({})), { length: Math.min(1.4, len - 0.7), width: 0.8, wood: 'timber.walnut' });
  F.rushChair(p.at(mat4({ x: -0.3, z: 0.65, ry: Math.PI })));
  F.rushChair(p.at(mat4({ x: 0.3, z: -0.65 })));
  if (len > 2.4) p.box('timber.walnut', 1.2, 1.8, 0.45, len / 2 - 0.75, 0, dep / 2 - 0.3);
}
