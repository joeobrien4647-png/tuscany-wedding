// The ground: one polar mesh from the estate out to 40 km (EU-DEM), finer patches round each villa with
// level pads for the houses and pools, a painted map of meadows, woods and lanes (OpenStreetMap), a
// woodland canopy, single trees along the edges, and Lake Montedoglio in the valley to the west.
import * as THREE from './vendor/three-core.js';
import { groundDetail } from './textures.js';
import { SKY_GLSL } from './realism/skydome.js';
import { canopyMaterial, canopyDepthMaterial } from './realism/canopy.js';
import { placeTrees, createTrees, TREE_CUT } from './realism/trees.js';
import { paintLand, forestMask } from './realism/land.js';
import { groundMaterial } from './realism/ground.js';
import { waterMaterial } from './realism/water.js';
import { createNight } from './realism/night.js';
import { createTufts } from './realism/tufts.js';
import { createEmitters } from './realism/emitters.js';
import { buildWalls, retainCut } from './realism/walls.js';

export { waterMaterial };
const TREE_WANTED = { value: new THREE.Vector4(0, 0, 0, 0) };
import { clamp, lerp, smoothstep, seeded, pointInPolygon, distanceToPolyline } from './util.js';

const HALF = 600;                 // the painted map and the 40 m grid cover x and z from -600 to 600
const R_EARTH = 6371000;
const PATCH_MARGIN = 30;
const PATCH_INNER = 14;           // polar vertices this far inside a patch drop out of sight under it

// ---------- height ----------

function cubic(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

function gridSampler(g) {
  const at = (i, j) => g.h[clamp(j, 0, g.rows - 1) * g.cols + clamp(i, 0, g.cols - 1)];
  return (x, z) => {
    const fx = (x - g.xMin) / g.spacing, fz = (z - g.zMin) / g.spacing;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const rows = [];
    for (let k = -1; k <= 2; k++) rows.push(cubic(at(i - 1, j + k), at(i, j + k), at(i + 1, j + k), at(i + 2, j + k), tx));
    return cubic(rows[0], rows[1], rows[2], rows[3], tz);
  };
}

function raySampler(far) {
  const [cx, cz] = far.centre;
  const d = far.dists, n = far.azs.length, step = 360 / n;
  return (x, z) => {
    const dx = x - cx, dz = z - cz;
    const r = Math.hypot(dx, dz);
    let b = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (b < 0) b += 360;
    const fa = b / step, a0 = Math.floor(fa) % n, a1 = (a0 + 1) % n, ta = fa - Math.floor(fa);
    let k = 0;
    while (k < d.length - 2 && d[k + 1] < r) k++;
    const tr = clamp((r - d[k]) / (d[k + 1] - d[k]), 0, 1);
    const h0 = lerp(far.h[a0][k], far.h[a0][k + 1], tr), h1 = lerp(far.h[a1][k], far.h[a1][k + 1], tr);
    return lerp(h0, h1, ta);
  };
}

export function createHeight(model) {
  const local = gridSampler(model.terrain.local);
  const context = gridSampler(model.terrain.context);
  const far = raySampler(model.terrain.far);
  const lake = model.lake;
  const lb = lake.outline.reduce((b, [x, z]) => [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], z), Math.max(b[3], z)], [Infinity, -Infinity, Infinity, -Infinity]);
  return function heightAt(x, z) {
    const m = Math.max(Math.abs(x), Math.abs(z));
    const r = Math.hypot(x, z);
    let h;
    if (m < 520) h = local(x, z);
    else {
      const wC = 1 - smoothstep(4300, 4900, m);
      const c = wC > 0 ? context(x, z) - (r * r) / (2 * R_EARTH) * 0.87 : 0;
      const f = wC < 1 ? far(x, z) : 0;
      const outer = wC * c + (1 - wC) * f;
      h = m < 590 ? lerp(local(x, z), outer, smoothstep(520, 590, m)) : outer;
    }
    if (x > lb[0] && x < lb[1] && z > lb[2] && z < lb[3] && pointInPolygon(x, z, lake.outline)) h = Math.min(h, lake.level - 4);
    return h;
  };
}

// ---------- pads: level ground for the houses and pools ----------

function rectPad(c, rot, length, width, level, blend, hard = false, retain = false) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return { c, cs, sn, hl: length / 2, hw: width / 2, level, blend, hard, retain };
}

// Signed distance (m) from a point to the pad's rectangle, negative inside.
function padDistance(p, x, z) {
  const dx = x - p.c[0], dz = z - p.c[1];
  const lx = dx * p.cs - dz * p.sn, lz = dx * p.sn + dz * p.cs;
  const qx = Math.abs(lx) - p.hl, qz = Math.abs(lz) - p.hw;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

export const DECK = 3;

export function padsFor(model) {
  const pads = [];
  model.villas.forEach((v) => v.blocks.forEach((b) => pads.push(rectPad(b.c, b.rot, b.length + 1.6, b.width + 1.6, b.floor - 0.18, 6))));
  model.pools.forEach((p) => {
    const extra = p.villa === 'santarsa' ? 9 : 0;   // the covered terrace at Santarsa's west end (approximate)
    const shift = -extra / 2;
    const c = [p.c[0] + Math.cos(p.rot) * shift, p.c[1] - Math.sin(p.rot) * shift];
    pads.push(rectPad(c, p.rot, p.length + 2 * DECK + extra, p.width + 2 * DECK, p.level - 0.3, 5));
    pads.push(rectPad(p.c, p.rot, p.length + 3, p.width + 3, p.level - 1.8, 0, true));
  });
  return pads;
}

// mesh: the ground mesh's own height, where a retaining pad's wall stands over the drop (realism/walls.js); without
// it, the surface things stand on (the pad's level up to its edge)
function applyPads(pads, x, z, h, mesh = false) {
  for (const p of pads) {
    const d = padDistance(p, x, z);
    if (mesh && p.retain) {
      const cut = retainCut(p, d, h);
      if (cut !== null) { h = cut; continue; }
    }
    if (p.hard) { if (d <= 0) h = Math.min(h, p.level); continue; }
    if (d <= 0) h = p.level;
    else if (d < p.blend) h = lerp(p.level, h, smoothstep(0, 1, d / p.blend));
  }
  return h;
}

// value noise, for crowns and fields
function noise2(seed = 1) {
  const hash = (i, j) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), tx = x - i, tz = z - j;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    return lerp(lerp(hash(i, j), hash(i + 1, j), sx), lerp(hash(i, j + 1), hash(i + 1, j + 1), sx), sz);
  };
}

// ---------- meshes ----------

function polarMesh(heightAt, patches, farColour, { azSteps }) {
  const radii = [0];
  for (let r = 10; r <= 700; r += 10) radii.push(r);
  for (let r = 700 * 1.04; r < 40000; r *= 1.04) radii.push(r);
  radii.push(40000);
  const cols = azSteps + 1;
  const pos = new Float32Array(radii.length * cols * 3);
  const col = new Float32Array(radii.length * cols * 3);
  const tmp = new THREE.Color();
  let p = 0;
  radii.forEach((r) => {
    for (let a = 0; a < cols; a++) {
      const t = (a / azSteps) * Math.PI * 2;
      const x = Math.sin(t) * r, z = -Math.cos(t) * r;
      let h = heightAt(x, z);
      if (patches.some((q) => x > q.x0 + PATCH_INNER && x < q.x1 - PATCH_INNER && z > q.z0 + PATCH_INNER && z < q.z1 - PATCH_INNER)) h -= 25;
      pos[p] = x; pos[p + 1] = h; pos[p + 2] = z;
      farColour(x, z, h, tmp);
      col[p] = tmp.r; col[p + 1] = tmp.g; col[p + 2] = tmp.b;
      p += 3;
    }
  });
  const idx = [];
  for (let i = 0; i < radii.length - 1; i++) {
    for (let a = 0; a < azSteps; a++) {
      const v0 = i * cols + a, v1 = v0 + 1, v2 = v0 + cols, v3 = v2 + 1;
      if (i > 0) idx.push(v0, v1, v2);
      idx.push(v1, v3, v2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // pieces over the same attributes: sectors of rings (finer near the middle), each with a bounding sphere of its own,
  // so a camera at eye level draws the ground in front of it, not all round
  const pieces = [];
  const ringOf = (r) => radii.findIndex((x) => x >= r);
  const bands = [[0, ringOf(300), 8], [ringOf(300), ringOf(700), 12], [ringOf(700), ringOf(1600), 12], [ringOf(1600), ringOf(6000), 8], [ringOf(6000), radii.length - 1, 6]];
  bands.forEach(([r0, r1, sectors]) => {
    for (let k = 0; k < sectors; k++) {
      const a0 = Math.floor((k * azSteps) / sectors), a1 = Math.floor(((k + 1) * azSteps) / sectors);
      const pIdx = [];
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (let i = r0; i < r1; i++) for (let a = a0; a < a1; a++) {
        const v0 = i * cols + a, v1 = v0 + 1, v2 = v0 + cols, v3 = v2 + 1;
        if (i > 0) pIdx.push(v0, v1, v2);
        pIdx.push(v1, v3, v2);
        for (const q of [v0, v1, v2, v3]) box.expandByPoint(v.set(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]));
      }
      if (!pIdx.length) continue;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position);
      pg.setAttribute('color', g.attributes.color);
      pg.setAttribute('normal', g.attributes.normal);
      pg.setIndex(pIdx);
      pg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      pieces.push(pg);
    }
  });
  return pieces;
}

function patchMesh(q, heightAt, pads, step = 1) {
  const nx = Math.round((q.x1 - q.x0) / step) + 1, nz = Math.round((q.z1 - q.z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3).fill(0.5);
  let p = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = q.x0 + i * step, z = q.z0 + j * step;
    pos[p] = x; pos[p + 1] = applyPads(pads, x, z, heightAt(x, z), true); pos[p + 2] = z;
    p += 3;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function canopyMesh(groundAt, mask, step) {
  const n = Math.round((2 * HALF) / step) + 1;
  const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  const keep = new Uint8Array(n * n);
  const n1 = noise2(3), n2 = noise2(7);
  const c = new THREE.Color();
  let p = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -HALF + i * step, z = -HALF + j * step;
    // the blanket only where the woods are deep: along an edge the single trees and their scrub stand on the
    // ground, and the blanket starts behind them, so a clearing is never ringed by a wall of it
    const m = smoothstep(0.22, 0.85, mask(x, z)) * (1 - smoothstep(440, 585, Math.max(Math.abs(x), Math.abs(z))));
    const lump = n1(x / 6.5, z / 6.5), big = n2(x / 60, z / 60), mid = n1(x / 23 + 50, z / 23);
    const top = Math.pow(m, 1.6) * (8 + 5 * lump + 3 * mid + 4 * big);
    pos[p] = x; pos[p + 1] = groundAt(x, z) + top - (1 - m) * 3; pos[p + 2] = z;
    keep[j * n + i] = m > 0.02 ? 1 : 0;
    // the painted crowns carry the colour (canopy.js): here only a gentle lift and dip, and a little hue
    const hue = n2(x / 35 + 9, z / 35);
    c.setRGB(0.42 + 0.06 * hue + 0.03 * big, 0.45 + 0.04 * mid, 0.42 + 0.04 * (1 - hue)).multiplyScalar(0.8 + 0.3 * lump);
    col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
    p += 3;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
    if (keep[a] | keep[b] | keep[cc] | keep[d]) idx.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // tiles of TILES x TILES cells over the same attributes (uploaded once), each with its own bounding sphere
  const tiles = [];
  const per = Math.ceil((n - 1) / TILES);
  for (let tj = 0; tj < TILES; tj++) for (let ti = 0; ti < TILES; ti++) {
    const tIdx = [];
    let minY = Infinity, maxY = -Infinity;
    for (let j = tj * per; j < Math.min(n - 1, (tj + 1) * per); j++) for (let i = ti * per; i < Math.min(n - 1, (ti + 1) * per); i++) {
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      if (!(keep[a] | keep[b] | keep[cc] | keep[d])) continue;
      tIdx.push(a, cc, b, b, cc, d);
      for (const v of [a, b, cc, d]) { minY = Math.min(minY, pos[v * 3 + 1]); maxY = Math.max(maxY, pos[v * 3 + 1]); }
    }
    if (!tIdx.length) continue;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', g.attributes.position);
    tg.setAttribute('color', g.attributes.color);
    tg.setAttribute('normal', g.attributes.normal);
    tg.setIndex(tIdx);
    const x0 = -HALF + ti * per * step, x1 = -HALF + Math.min(n - 1, (ti + 1) * per) * step;
    const z0 = -HALF + tj * per * step, z1 = -HALF + Math.min(n - 1, (tj + 1) * per) * step;
    const c3 = new THREE.Vector3((x0 + x1) / 2, (minY + maxY) / 2, (z0 + z1) / 2);
    tg.boundingSphere = new THREE.Sphere(c3, Math.hypot((x1 - x0) / 2, (maxY - minY) / 2, (z1 - z0) / 2));
    tiles.push(tg);
  }
  return tiles;
}
const TILES = 6;

// ---------- water ----------

export { SKY_GLSL };

function lakeMesh(model, sky) {
  const shape = new THREE.Shape(model.lake.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, waterMaterial(sky, { colour: '#2c4f57' }));
  mesh.position.y = model.lake.level;
  mesh.name = 'lake';
  return mesh;
}

// ---------- assembly ----------

// site: api.site (content's pads, surfaces, specimen trees, shrubs and clear areas), read once here; without it the
// pads come from v1's model. isLayerOn: whether a layer is on, for emitters that belong to one.
export function buildGround(model, sky, { tier = 'fast', site = null, isLayerOn = () => true } = {}) {
  const best = tier === 'best';
  const heightAt = createHeight(model);
  const entries = (kind) => site?.all?.((e) => e.kind === kind) ?? [];
  const sitePads = entries('pad');
  const pads = sitePads.length
    ? sitePads.map((e) => rectPad(e.c, e.rot ?? 0, e.length, e.width, e.level, e.blend ?? 5, !!e.hard, !!e.retain))
    : padsFor(model);
  const villaZones = model.villas.map((v) => {
    const pts = [...v.blocks.map((b) => b.c), ...model.pools.filter((p) => p.villa === v.id).map((p) => p.c)];
    const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const r = Math.max(...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) + 26;
    return { id: v.id, c, r };
  });
  const patches = villaZones.map((z) => {
    const r = z.r + PATCH_MARGIN;
    return { id: z.id, x0: Math.floor(z.c[0] - r), x1: Math.ceil(z.c[0] + r), z0: Math.floor(z.c[1] - r), z1: Math.ceil(z.c[1] + r) };
  });
  const inPatch = (x, z) => patches.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
  const groundAt = (x, z) => (inPatch(x, z) ? applyPads(pads, x, z, heightAt(x, z)) : heightAt(x, z));

  const mask = forestMask(model, villaZones);
  const trees = placeTrees({
    groundAt, mask, model, zones: villaZones, density: best ? 1 : 0.55, noise: noise2(29),
    clear: entries('clear').map((e) => e.polygon).filter(Boolean),
    specimens: entries('tree').map((e) => ({ species: e.species, x: e.x, z: e.z, height: e.height, spread: e.spread })),
    shrubs: entries('shrub'),
  });
  const land = toLandTexture(paintLand(model, best ? 2048 : 1024, { zones: villaZones, trees, heightAt, surfaces: entries('surface') }));
  const detail = groundDetail();
  const n = noise2(11);
  const forest = new THREE.Color('#6a9446'), fields = [new THREE.Color('#8fa552'), new THREE.Color('#b3a866'), new THREE.Color('#7d9a48'), new THREE.Color('#9fb05c')], high = new THREE.Color('#6d8250');
  const farColour = (x, z, h, out) => {
    const valley = smoothstep(-300, -380, h);             // the Tiber valley floor, about 500 m up
    const f = fields[Math.floor(n(x / 700, z / 700) * 4) % 4];
    out.copy(forest).lerp(f, valley * 0.85);
    if (h > 250) out.lerp(high, smoothstep(250, 600, h) * 0.5);
    out.multiplyScalar(0.85 + 0.3 * n(x / 180, z / 180));
    return out;
  };

  const group = new THREE.Group();
  group.name = 'ground';
  // the terrain in pieces the frustum can drop (the group is what the rest reads as 'terrain')
  const polarMat = groundMaterial({ land, detail, half: HALF, canopySize: tier === 'fast' ? 512 : 1024 });
  const polar = new THREE.Group();
  polar.name = 'terrain';
  polar.material = polarMat;
  polarMesh(heightAt, patches, farColour, { azSteps: best ? 360 : 240 }).forEach((pg, i) => {
    const m = new THREE.Mesh(pg, polarMat);
    m.receiveShadow = true;
    m.name = `terrain-${i}`;
    polar.add(m);
  });
  group.add(polar);
  const patchMat = groundMaterial({ land, detail, half: HALF, offset: true, canopySize: tier === 'fast' ? 512 : 1024 });
  // each villa's fine ground, with a coarser copy for when the camera is far from it (the other villa, the estate)
  const patchMeshes = patches.map((q) => {
    const m = new THREE.Mesh(patchMesh(q, heightAt, pads, best ? 1 : 1.5), patchMat);
    m.receiveShadow = true;
    m.name = `patch-${q.id}`;
    const far = new THREE.Mesh(patchMesh(q, heightAt, pads, 3), patchMat);
    far.receiveShadow = true;
    far.name = `patch-${q.id}-far`;
    const lod = new THREE.LOD();
    lod.addLevel(m, 0);
    lod.addLevel(far, 260);
    lod.name = `patch-lod-${q.id}`;
    group.add(lod);
    return m;
  });

  // the blanket: one material over tiles the frustum can drop (the group stands in for the old single mesh: its
  // material, castShadow and visible are what the rest of the explorer and the tests read)
  const canopyMat = canopyMaterial({ size: tier === 'fast' ? 512 : 1024 });
  // a heightfield drawn back faces first into the shadow map does not shadow itself in stripes at a low sun
  canopyMat.shadowSide = THREE.BackSide;
  const canopyDepth = canopyDepthMaterial();
  const canopy = new THREE.Group();
  canopy.material = canopyMat;
  // on every tier: the woods shade the meadows at sunset, and the trees standing in them shade nothing they should not
  canopy.castShadow = true;
  canopyMesh(groundAt, mask, best ? 5 : 7.5).forEach((tg, i) => {
    const m = new THREE.Mesh(tg, canopyMat);
    m.receiveShadow = true;
    m.castShadow = true;
    m.customDepthMaterial = canopyDepth;
    m.name = `canopy-${i}`;
    m.raycast = () => {};
    canopy.add(m);
  });
  // ...and only its inner part casts: the blanket ends at the edge of the mapped square, and a straight edge there
  // would throw a long straight shadow across the hills beyond at sunset. The cut is ragged, like a wood's edge.
  // its shadow (canopyDepth) lets the sun through the gaps between small crowns: flecks of light on the woods' floor
  canopy.name = 'canopy';
  group.add(canopy);

  const woods = createTrees({ trees, tier, groundAt, sky });
  group.add(woods.group);
  sky.beforeRender?.((camera) => woods.cull(camera));
  // the woods at their own density round a camera at eye level, where the blanket has sunk out of the way
  const fillWoods = createTrees({ trees: trees.fill || [], tier, groundAt, sky, eyeOnly: true });
  fillWoods.group.name = 'trees-eye';
  group.add(fillWoods.group);
  sky.beforeRender?.((camera) => fillWoods.cull(camera));
  // at eye level among the trees the blanket sinks round the camera (canopy.js), past the nearest trees
  const canopyEye = canopy.material.userData.eye;
  sky.beforeRender?.((camera) => {
    const c = camera.position;
    const above = c.y - groundAt(c.x, c.z);
    const k = 1 - smoothstep(14, 34, above);
    canopyEye.value.set(c.x, c.z, 30, k);
    // trees step aside for what is chosen only when the camera looks down on it, never round a camera at eye level
    TREE_CUT.value.copy(TREE_WANTED.value);
    TREE_CUT.value.w *= smoothstep(6, 14, above);
  });
  // grass tufts and flowers round a camera near the ground (Balanced and Best), on the painted map's open grass
  const grassC = document.createElement('canvas');
  grassC.width = grassC.height = 512;
  grassC.getContext('2d').drawImage(land.image, 0, 0, 512, 512);
  const grassPx = grassC.getContext('2d').getImageData(0, 0, 512, 512).data;
  const isGrass = (x, z) => {
    if (Math.abs(x) > HALF - 12 || Math.abs(z) > HALF - 12 || mask(x, z) > 0.3) return false;
    const i = (Math.floor(((z + HALF) / (2 * HALF)) * 512) * 512 + Math.floor(((x + HALF) / (2 * HALF)) * 512)) * 4;
    const r = grassPx[i], g = grassPx[i + 1], b = grassPx[i + 2];
    return g > r * 1.06 && g > b * 1.35;
  };
  const tuftTime = { value: 0 };
  let tufts = null;
  function ensureTufts(t) {
    if (t === 'fast' || tufts) return;
    tufts = createTufts({ tier: t, heightAt, groundAt, isGrass, time: tuftTime });
    if (tufts) group.add(tufts.mesh);
  }
  let groundTier = tier;
  ensureTufts(tier);
  sky.beforeRender?.((camera) => { if (groundTier !== 'fast') tufts?.beforeRender(camera); else if (tufts) tufts.mesh.visible = false; });
  sky.onTierChange?.((t) => { groundTier = t; ensureTufts(t); });

  // the night look of everything content says gives light (api.emitters after Phase 0): cores, halos, light on the
  // surfaces below, bulbs doubled in the pools
  const emitters = createEmitters({
    sky, tier, isLayerOn,
    surfaceBelow: (x, y, z) => groundAt(x, z),
    pools: () => model.pools.map((p) => ({ x: p.c[0], z: p.c[1], y: p.level - 0.12, r: Math.hypot(p.length, p.width) / 2, length: p.length, width: p.width, rot: p.rot })),
  });
  group.add(emitters.group);
  sky.beforeRender?.((camera) => emitters.beforeRender(camera));

  const walls = buildWalls({ pads: pads.filter((q) => q.retain), heightAt, tier });
  group.add(walls);

  const night = createNight({ model, heightAt, mask, sky });
  group.add(night.group);
  sky.beforeRender?.((camera) => night.beforeRender(camera));

  const lake = lakeMesh(model, sky);
  group.add(lake);
  const ponds = model.water.filter((w) => w.polygon && w.level != null).map((w) => {
    const shape = new THREE.Shape(w.polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), lake.material);
    m.position.y = Math.min(...w.polygon.map(([x, z]) => groundAt(x, z))) + 0.4;
    group.add(m);
    return m;
  });

  // what the pool's mirror leaves out (Best): heavy, far or flat things the water could hardly show
  [polar, canopy, lake, night.group, emitters.group, fillWoods.group, ...patchMeshes.map((m) => m.parent), ...woods.meshes.filter(Boolean).flatMap((row) => [row[1], row[2]])].forEach((o) => sky.mirrorHide?.add(o));
  // the near trees are reflected with the middle level's crowns: the mirror is half resolution and rippled
  woods.meshes.filter(Boolean).forEach((row) => sky.mirrorLod?.set(row[0], row[1].geometry));
  sky.beforeRender?.(() => { if (tufts) sky.mirrorHide?.add(tufts.mesh); });

  return {
    treeCut: TREE_WANTED,
    group, heightAt, groundAt, pads, patches, villaZones, mask, trees, woods, fillWoods, night, emitters, walls, land, lake, ponds, patchMeshes, canopy,
    update(t) { lake.material.uniforms.uTime.value = t; woods.update(t); fillWoods.update(t); night.update(t); emitters.update(t); tuftTime.value = t; },
  };
}

function toLandTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  // canvas rows run north to south, as world z does: v1 left three's default flip on, which mirrored the map
  t.flipY = false;
  return t;
}
