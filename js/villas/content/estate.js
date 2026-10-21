// The estate service: builds both villas, their grounds and the estate's own details from material names, merges
// them per material per villa (a cut-open floor is a draw range), keeps the rooms (unnumbered, every bedroom the
// same), and answers setFloor, highlight, box, floorBox, floorBearing and colliders.
import { THREE, V3, mat4, createCollector, createPen, showBands, pickBox, seeded, cylG, barG, rodG, tubeG, catenary, kitParts, instancedKit } from './kit.js';
import { CUT } from './houses.js';
import { buildSantarsa } from './santarsa.js';
import { buildVallorsaia } from './vallorsaia.js';
import * as F from './furniture.js';
import { buildFar, FAR_AT } from './far.js';
import { setRoofDetail } from './roofs.js';
import { setHouseDetail } from './houses.js';

export const BANDS = ['grounds', 's0', 's1', 's2', 'roof'];
const CUT_BANDS = ['c0', 'c1', 'c2'];
const VIEW_BEARING = { santarsa: 212, vallorsaia: 238 };   // standing downhill, the sunset light on the walls in view

const blockToWorld = (b, lx, lz) => {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return V3(b.c[0] + lx * c + lz * s, 0, b.c[1] - lx * s + lz * c);
};

export function createEstate({ model, layout: L, mat, groundAt, tier = 'fast', loadInteriors = null }) {
  const group = new THREE.Group();
  group.name = 'estate';
  setRoofDetail(tier);
  setHouseDetail(tier);
  const emitted = [];
  const picks = [];
  const rnd = seeded(101);
  let currentVilla = null;
  const emit = (kind, pos, extra = {}) => emitted.push({ kind, pos: pos.clone(), villa: currentVilla, ...extra });
  const pickApi = {
    // a house block: one box per storey and one for the roof, so a cut-open floor can be tapped; an outbuilding
    // (info.cut false): one box for the whole thing
    block(villa, b, info = {}) {
      const top = b.floor + b.storeys * b.storeyH;
      if (info.cut === false) {
        const m = pickBox({ c: b.c, rot: b.rot, length: b.length, width: b.width, y1: Math.min(b.floor, b.groundMin), y2: top + (b.ridgeOver || 1.5) }, `pick:${b.id}`);
        picks.push({ id: info.id || b.id, mesh: m, villa, block: b.id, storey: null, place: info.place ?? null, cut: false });
        return;
      }
      for (let s = 0; s < (b.storeys || 1); s++) {
        const y1 = b.floor + s * b.storeyH, y2 = y1 + b.storeyH + (s === b.storeys - 1 ? 0.1 : 0);
        const m = pickBox({ c: b.c, rot: b.rot, length: b.length, width: b.width, y1, y2 }, `pick:${b.id}:${s}`);
        picks.push({ id: `${b.id}:${s}`, mesh: m, villa, block: b.id, storey: s, place: info.place ?? null, y1, cut: true });
      }
      const m = pickBox({ c: b.c, rot: b.rot, length: b.length + 0.8, width: b.width + 0.8, y1: top, y2: top + (b.ridgeOver || 1.5) + 0.3 }, `pick:${b.id}:roof`);
      picks.push({ id: `${b.id}:roof`, mesh: m, villa, block: b.id, storey: 'roof', place: info.place ?? null, y1: top, cut: true });
    },
    box(id, obb, info = {}) {
      picks.push({ id, mesh: pickBox(obb, `pick:${id}`), villa: info.villa ?? null, place: info.place ?? null, storey: null });
    },
  };

  // ---------- the two villas ----------
  const villas = new Map();
  const built = {};
  ['santarsa', 'vallorsaia'].forEach((id) => {
    currentVilla = id;
    const main = createCollector(BANDS);
    const cut = createCollector(CUT_BANDS);
    const mov = createCollector(['base']);
    const pen = createPen(main, { band: 'grounds' });
    const ctx = { pen, cutPen: createPen(cut, { band: 'c0' }), movPen: createPen(mov), L, model, groundAt, emit, rnd, picks: pickApi };
    if (id === 'santarsa') buildSantarsa(ctx); else buildVallorsaia(ctx);
    const vg = new THREE.Group();
    vg.name = `villa-${id}`;
    const meshes = main.finish(mat, { label: id, shadows: (n) => !['glass.window', 'lamp.warm', 'iron', 'iron.rust'].includes(n) });
    const cutMeshes = cut.finish(mat, { label: `${id}-cut` });
    cutMeshes.forEach((m) => { m.visible = false; });
    const movMeshes = mov.finish(mat, { label: `${id}-loungers` });
    // near: everything; far (past FAR_AT metres): plain massing. three.js's LOD picks per camera, shadows included
    const far = createCollector(['base']);
    buildFar(createPen(far), { villa: id, model, L });
    const farMeshes = far.finish(mat, { label: `${id}-far`, shadows: () => true });
    const data0 = model.villas.find((v) => v.id === id);
    const pool0 = model.pools.find((p) => p.villa === id);
    const cx = (data0.blocks.reduce((s, b) => s + b.c[0], 0) / data0.blocks.length + pool0.c[0]) / 2;
    const cz = (data0.blocks.reduce((s, b) => s + b.c[1], 0) / data0.blocks.length + pool0.c[1]) / 2;
    const cy = pool0.level;
    const lod = new THREE.LOD();
    lod.name = `lod-${id}`;
    lod.position.set(cx, cy, cz);
    const nearG = new THREE.Group(), farG = new THREE.Group();
    nearG.name = `near-${id}`; farG.name = `far-${id}`;
    nearG.position.set(-cx, -cy, -cz); farG.position.set(-cx, -cy, -cz);
    [...meshes, ...cutMeshes, ...movMeshes].forEach((m) => nearG.add(m));
    farMeshes.forEach((m) => farG.add(m));
    lod.addLevel(nearG, 0, 0.08);
    lod.addLevel(farG, FAR_AT, 0.08);
    vg.add(lod);
    group.add(vg);
    built[id] = { group: vg, meshes, cutMeshes, movMeshes };
    const data = model.villas.find((v) => v.id === id);
    villas.set(id, { id, data, blocks: data.blocks, box: villaBox(data), floor: 'outside', group: vg, meshes, cutMeshes, loungers: movMeshes });
  });
  currentVilla = null;

  // ---------- the estate: the road up, the cypress row's lane, the Segheria's log stacks, the deer ----------
  const est = createCollector(['base']);
  const ep = createPen(est);
  buildRoadside(ep, L, model, groundAt, emit);
  buildLogYard(ep, L, groundAt);
  const estateMeshes = est.finish(mat, { label: 'estate', shadows: () => true });
  const estateGroup = new THREE.Group();
  estateGroup.name = 'estate-extras';
  estateMeshes.forEach((m) => estateGroup.add(m));
  group.add(estateGroup);
  const deer = buildDeer(L, groundAt, mat);
  group.add(deer);

  // ---------- water: one mesh per pool area, named for realism (the jet bay tagged so it can tint and bubble) ----------
  const pools = model.pools.map((p) => {
    const holder = new THREE.Group();
    holder.position.set(p.c[0], 0, p.c[1]);
    holder.rotation.y = p.rot;
    holder.name = `${p.id}-frame`;
    holder.updateMatrixWorld(true);
    group.add(holder);
    const waterMat = mat('water.pool');
    // one plane the pool's length and width (realism's water reads its size); the shallow jet bay is tagged as
    // `userData.shallow = { from }`, metres from the +x (east) end, as realism's water material expects
    const g = new THREE.PlaneGeometry(p.length, p.width).rotateX(-Math.PI / 2);
    g.translate(0, p.level - 0.12, 0);
    const water = new THREE.Mesh(g, waterMat);
    water.name = `${p.id}-water`;
    water.userData.pool = p.id;
    if (p.villa === 'santarsa') water.userData.shallow = { from: p.length / 2 - L.santarsa.bay.x1 };
    water.receiveShadow = true;
    holder.add(water);
    const bay = p.villa === 'santarsa' ? { from: p.length / 2 - L.santarsa.bay.x1, centre: holder.localToWorld(new THREE.Vector3((L.santarsa.bay.x1 + p.length / 2) / 2, p.level - 0.12, 0)) } : null;
    const tettoia = p.villa === 'santarsa' ? { centre: new THREE.Vector3(14.0, p.level, 0), oven: L.santarsa.tettoia } : null;
    return { pool: p, group: holder, water, bay, terrace: tettoia, villa: p.villa };
  });

  // ---------- rooms (from the model's illustrative layout: every bedroom the same, none numbered) ----------
  const rooms = new Map();
  model.villas.forEach((v) => {
    const byBlock = new Map(v.blocks.map((b) => [b.id, b]));
    v.cells.forEach((c) => {
      const b = byBlock.get(c.block);
      const lx = (c.x[0] + c.x[1]) / 2, lz = (c.z[0] + c.z[1]) / 2;
      const centre = blockToWorld(b, lx, lz);
      const floorY = b.floor + c.floor * b.storeyH;
      centre.y = floorY;
      const corners = [[c.x[0], c.z[0]], [c.x[1], c.z[0]], [c.x[0], c.z[1]], [c.x[1], c.z[1]]].map(([x, z]) => blockToWorld(b, x, z));
      const box = { x1: Math.min(...corners.map((p) => p.x)), x2: Math.max(...corners.map((p) => p.x)), y1: floorY, y2: floorY + 1.4, z1: Math.min(...corners.map((p) => p.z)), z2: Math.max(...corners.map((p) => p.z)) };
      const key = c.id || `${c.block}-${c.floor}-${c.x[0]}-${c.z[0]}`;
      rooms.set(key, { id: key, villa: v.id, cell: c, block: b, floor: c.floor, centre, box, bedroom: c.kind === 'bedroom', kind: c.kind });
    });
  });

  // ---------- pick proxies ----------
  const pickGroup = new THREE.Group();
  pickGroup.name = 'picks';
  picks.forEach((p) => { p.mesh.userData.villa = p.villa; p.mesh.userData.pick = p.id; p.mesh.userData.place = p.place; pickGroup.add(p.mesh); });
  group.add(pickGroup);

  // ---------- floors: cut a villa open at a storey (draw ranges), interiors arrive by lazy import ----------
  const interiors = new Map();      // villa -> Promise of { setFloor(mode) }
  function setFloor(villaId, mode) {
    const v = villas.get(villaId);
    if (!v) return Promise.resolve();
    v.floor = mode;
    const open = mode !== 'outside';
    // a cut-open villa is always drawn near
    const lod = v.group.children.find((o) => o.isLOD);
    if (lod) lod.levels[1].distance = open ? Infinity : FAR_AT;
    v.meshes.forEach((m) => showBands(m, (band) => !open || band === 'grounds' || (band[0] === 's' && Number(band.slice(1)) < mode)));
    v.cutMeshes.forEach((m) => { if (open) showBands(m, (band) => band === `c${Math.min(mode, 2)}`); else m.visible = false; });
    picks.filter((p) => p.villa === villaId && p.cut).forEach((p) => {
      const h = p.mesh.geometry.parameters.height;
      const roof = p.storey === 'roof';
      p.mesh.visible = !open || (!roof && p.storey <= mode);
      const want = open && !roof && p.storey === mode ? CUT : h;
      p.mesh.scale.y = want / h;
      p.mesh.position.y = p.y1 + want / 2;
      p.mesh.updateMatrixWorld(true);
    });
    if (!open) { interiors.forEach((pr) => pr.then((x) => x?.setFloor(villaId, 'outside'))); return Promise.resolve(); }
    if (!loadInteriors) return Promise.resolve();
    if (!interiors.has(villaId)) interiors.set(villaId, loadInteriors(villaId).then((x) => x).catch((e) => { console.error('content: interiors did not load', e); return null; }));
    return interiors.get(villaId).then((x) => { if (x && villas.get(villaId).floor === mode) x.setFloor(villaId, mode); });
  }

  // a gold frame round a chosen room's floor: an outline, not a wash, so the floor keeps its own colour
  const glowMat = mat('ui.highlight');
  const glowMesh = new THREE.Mesh(new THREE.BufferGeometry(), glowMat);
  glowMesh.visible = false;
  glowMesh.renderOrder = 4;
  glowMesh.name = 'room-highlight';
  group.add(glowMesh);
  function frameGeometry(w, d, band = 0.2) {
    const outer = new THREE.Shape([new THREE.Vector2(-w / 2, -d / 2), new THREE.Vector2(w / 2, -d / 2), new THREE.Vector2(w / 2, d / 2), new THREE.Vector2(-w / 2, d / 2)]);
    const iw = Math.max(0.1, w / 2 - band), id = Math.max(0.1, d / 2 - band);
    outer.holes.push(new THREE.Path([new THREE.Vector2(-iw, -id), new THREE.Vector2(-iw, id), new THREE.Vector2(iw, id), new THREE.Vector2(iw, -id)]));
    return new THREE.ShapeGeometry(outer).rotateX(-Math.PI / 2);
  }
  function highlight(roomKey) {
    const r = roomKey && rooms.get(roomKey);
    if (!r) { glowMesh.visible = false; return; }
    const c = r.cell;
    glowMesh.geometry.dispose();
    glowMesh.geometry = frameGeometry(c.x[1] - c.x[0] - 0.1, c.z[1] - c.z[0] - 0.1);
    glowMesh.position.copy(r.centre).setY(r.centre.y + 0.1);
    glowMesh.rotation.y = r.block.rot;
    glowMesh.visible = true;
  }

  function villaBox(data) {
    const pts = data.blocks.flatMap((b) => [-1, 1].flatMap((i) => [-1, 1].map((j) => blockToWorld(b, (i * b.length) / 2, (j * b.width) / 2))));
    const top = Math.max(...data.blocks.map((b) => b.floor + b.storeys * b.storeyH + (b.ridgeOver || 1.5) + 1.2));
    const bottom = Math.min(...data.blocks.map((b) => b.floor));
    return { x1: Math.min(...pts.map((p) => p.x)), x2: Math.max(...pts.map((p) => p.x)), y1: bottom, y2: top, z1: Math.min(...pts.map((p) => p.z)), z2: Math.max(...pts.map((p) => p.z)) };
  }

  function box(id, { withPool = true } = {}) {
    const v = villas.get(id);
    const b = { ...v.box };
    if (withPool) {
      const pl = model.pools.find((p) => p.villa === id);
      const r = pl.length / 2 + 4;
      b.x1 = Math.min(b.x1, pl.c[0] - r); b.x2 = Math.max(b.x2, pl.c[0] + r);
      b.z1 = Math.min(b.z1, pl.c[1] - r); b.z2 = Math.max(b.z2, pl.c[1] + r);
      b.y1 = Math.min(b.y1, pl.level);
    }
    return b;
  }

  function floorBox(id, f) {
    const v = villas.get(id);
    const live = v.data.blocks.filter((b) => b.storeys > f);
    const y = Math.min(...(live.length ? live : v.data.blocks).map((b) => b.floor + f * b.storeyH));
    return { ...v.box, y1: y, y2: y + 1.6 };
  }

  function floorBearing(id) {
    const longest = model.villas.find((v) => v.id === id).blocks.reduce((a, b) => (b.length > a.length ? b : a));
    const axis = (Math.atan2(Math.cos(longest.rot), Math.sin(longest.rot)) * 180) / Math.PI;
    const options = [axis + 90, axis - 90].map((b) => (b + 360) % 360);
    const off = (b) => Math.abs(((b - VIEW_BEARING[id] + 540) % 360) - 180);
    return off(options[0]) < off(options[1]) ? options[0] : options[1];
  }

  // oriented boxes nobody should walk or land inside: houses, outbuildings, the tettoie, pool water
  function colliders() {
    const out = [];
    model.villas.forEach((v) => v.blocks.forEach((b) => out.push({ id: b.id, kind: 'house', c: b.c, rot: b.rot, length: b.length, width: b.width, y1: Math.min(b.groundMin, b.floor) - 1, y2: b.floor + b.storeys * b.storeyH + (b.ridgeOver || 1.5) })));
    model.outbuildings.forEach((b) => { if (b.kind !== 'tettoia') out.push({ id: b.id, kind: 'outbuilding', c: b.c, rot: b.rot, length: b.length, width: b.width, y1: b.groundMin - 1, y2: b.floor + b.storeys * b.storeyH + (b.ridgeOver || 1.5) }); });
    const ts = L.santarsa.tettoia, tv = L.vallorsaia.tettoia;
    out.push({ id: 'santarsa-tettoia-oven', kind: 'outbuilding', c: ts.w(-ts.length / 2 + 1.2, 0), rot: ts.rot, length: 2.4, width: ts.width, y1: ts.floor, y2: ts.floor + 4 });
    out.push({ id: 'vallorsaia-tettoia-wall', kind: 'outbuilding', c: tv.w(0, -tv.width / 2 + 0.5), rot: tv.rot, length: tv.length, width: 1.2, y1: tv.floor, y2: tv.floor + 3.5 });
    model.pools.forEach((p) => out.push({ id: `${p.id}-water`, kind: 'pool', c: p.c, rot: p.rot, length: p.length, width: p.width, y1: p.level - 2, y2: p.level + 0.2 }));
    return out;
  }

  let t0 = 0;
  function update(frame) {
    const t = typeof frame === 'number' ? frame : frame?.t ?? 0;
    t0 = t;
    if (glowMesh.visible && glowMat.transparent) glowMat.opacity = 0.7 + 0.25 * Math.sin(t * 3);
  }

  const service = {
    group, villas, rooms, pools, setFloor, highlight, box, floorBox, floorBearing, colliders, update,
    deer, emitted, picks, built, glow: glowMesh, estateGroup, tier,   // the tier its detail was built for
  };
  return service;
}

// ---------- the road up: power poles with an overhead line, stock fencing, pale concrete on the steepest bends ----------

function buildRoadside(p, L, model, groundAt, emit) {
  const road = L.estate.access.points;
  const lenAt = [0];
  for (let i = 1; i < road.length; i++) lenAt.push(lenAt[i - 1] + Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]));
  const total = lenAt[lenAt.length - 1];
  const at = (s, off = 0) => {
    let i = 1;
    while (i < road.length - 1 && lenAt[i] < s) i++;
    const t = (s - lenAt[i - 1]) / Math.max(1e-6, lenAt[i] - lenAt[i - 1]);
    const [ax, az] = road[i - 1], [bx, bz] = road[i];
    const dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz) || 1;
    return [ax + dx * t + (-dz / n) * off, az + dz * t + (dx / n) * off, dx / n, dz / n];
  };
  // wooden power poles with an overhead line along part of the road (the stretch below the villa)
  const poles = [];
  for (let s = 40; s < total * 0.72; s += 46) {
    const [x, z, dx, dz] = at(s, 4.2);
    const y = groundAt(x, z);
    p.put('timber.rough', cylG(0.11, 0.14, 8.2, 7), mat4({ x, y: y - 0.3, z }));
    p.put('timber.rough', barG(V3(x - dz * 0.8, y + 7.6, z + dx * 0.8), V3(x + dz * 0.8, y + 7.6, z - dx * 0.8), 0.1, 0.1));
    poles.push([x, y + 7.66, z, dx, dz]);
  }
  for (let i = 1; i < poles.length; i++) {
    for (const k of [-0.6, 0.6]) {
      const [ax, ay, az, adx, adz] = poles[i - 1], [bx, by, bz, bdx, bdz] = poles[i];
      const a = V3(ax - adz * k, ay, az + adx * k), b = V3(bx - bdz * k, by, bz + bdx * k);
      p.put('iron', tubeG(catenary(a, b, 0.9, 8), 0.012, 3));
    }
  }
  // wire stock fencing on rough posts beside part of the road: three strands and a mesh band low down
  const tops = [];
  for (let s = 20; s < total * 0.5; s += 3.2) {
    const [x, z] = at(s, -3.6);
    const y = groundAt(x, z);
    p.put('timber.rough', cylG(0.045, 0.055, 1.3, 6), mat4({ x, y: y - 0.1, z }));
    tops.push([x, y, z]);
  }
  for (let i0 = 0; i0 < tops.length - 1; i0 += 12) {
    const run = tops.slice(i0, Math.min(tops.length, i0 + 13));
    for (const h of [0.35, 0.7, 1.08]) p.put('iron', tubeG(run.map(([x, y, z]) => V3(x, y + h, z)), 0.007, 3, false, 1));
  }
  // short pale concrete strips on the steepest bends
  const steep = [];
  for (let i = 1; i < road.length; i++) {
    const [ax, az] = road[i - 1], [bx, bz] = road[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 6) continue;
    steep.push({ i, grade: Math.abs(groundAt(bx, bz) - groundAt(ax, az)) / len });
  }
  steep.sort((a, b) => b.grade - a.grade).slice(0, 3).forEach(({ i }) => {
    const s0 = lenAt[i - 1], s1 = lenAt[i];
    const mid = (s0 + s1) / 2, half = Math.min(14, (s1 - s0) / 2);
    // two strips under the wheels, cast in short slabs with a joint between each
    for (let s = mid - half; s < mid + half; s += 2.2) {
      for (const off of [-0.78, 0.78]) {
        const [x, z, dx, dz] = at(s, off);
        const y = groundAt(x, z);
        p.put('coping.pale', new THREE.BoxGeometry(0.62, 0.07, 2.08), mat4({ x, y: y - 0.015, z, ry: Math.atan2(dx, dz) }));
      }
    }
  });
}

// the Segheria (OSM: a sawmill with a timber yard): stacks of logs
function buildLogYard(p, L, groundAt) {
  const [cx, cz] = L.estate.logYard;
  const seg = L.estate.segheria;
  const rnd = seeded(61);
  for (let k = 0; k < 3; k++) {
    const ox = cx + Math.cos(seg.rot) * (k - 1) * 3.2, oz = cz - Math.sin(seg.rot) * (k - 1) * 3.2;
    const y = groundAt(ox, oz);
    const sp = p.at(mat4({ x: ox, y, z: oz, ry: seg.rot + Math.PI / 2 }));
    for (let row = 0; row < 3; row++) {
      const n = 5 - row;
      for (let i = 0; i < n; i++) {
        const r = 0.16 + rnd() * 0.05;
        const log = cylG(r, r, 4.0 + rnd() * 0.4, 7);
        log.rotateZ(Math.PI / 2);
        sp.put('timber.rough', log, mat4({ x: 2.0, y: 0.17 + row * 0.3, z: (i - (n - 1) / 2) * 0.36 }));
      }
    }
  }
}

// a few low-poly fallow deer at the woodland edge behind Santarsa, shown at golden hour and blue hour
function buildDeer(L, groundAt, mat) {
  const parts = kitParts((p) => F.deer(p, { s: 1 }));
  const mats = L.estate.deer.map(([x, z, ry], i) => {
    const m = new THREE.Matrix4();
    m.compose(V3(x, groundAt(x, z) - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(1, 1, 1).multiplyScalar(i === 2 ? 0.8 : 1));
    return m;
  });
  const g = instancedKit(parts, mat, mats, { name: 'deer', shadows: true });
  g.visible = false;
  g.userData.showWhen = ['golden', 'blue'];
  return g;
}
