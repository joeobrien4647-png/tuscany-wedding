// Geometry kit for the content track: everything is built from MATERIALS names, with UVs in metres, merged per
// material per villa, and split into bands (the grounds, each storey, the roof) so a cut-open floor is a draw range
// rather than a separate mesh. Instanced meshes for anything repeated in large numbers.
import * as THREE from '../vendor/three-core.js';
import { mergeGeometries } from '../vendor/three-core.js';

export { THREE };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// ---------- UVs in metres (the same as util.worldUV and util.slopeUV) ----------

export function worldUV(g, metresPerTile = 1) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  if (!pos || !nor) return g;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u / metresPerTile;
    uv[i * 2 + 1] = v / metresPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Roof slopes: u across the slope, v up it, per face (so coppi rows run down the roof).
export function slopeUV(g, metresPerTile = 1) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  if (!pos || !nor) return g;
  const uv = new Float32Array(pos.count * 2);
  const n = new THREE.Vector3(), across = new THREE.Vector3(), upSlope = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    if (Math.abs(n.y) > 0.985 || Math.abs(n.y) < 0.05) {
      const ny = Math.abs(n.y), nx = Math.abs(n.x), nz = Math.abs(n.z);
      p.fromBufferAttribute(pos, i);
      const [u, v] = ny >= nx && ny >= nz ? [p.x, p.z] : nx >= nz ? [p.z, p.y] : [p.x, p.y];
      uv[i * 2] = u / metresPerTile; uv[i * 2 + 1] = v / metresPerTile;
      continue;
    }
    across.crossVectors(UP, n).normalize();
    upSlope.crossVectors(n, across);
    p.fromBufferAttribute(pos, i);
    uv[i * 2] = p.dot(across) / metresPerTile;
    uv[i * 2 + 1] = p.dot(upSlope) / metresPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------- making geometry ready to merge ----------

const ATTRS = ['position', 'normal', 'uv'];

export function prep(g) {
  let out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) worldUV(out, 1);
  for (const k of Object.keys(out.attributes)) if (!ATTRS.includes(k) && k !== 'lightSeed') out.deleteAttribute(k);
  out.morphAttributes = {};
  out.clearGroups();
  return out;
}

// A unit-ish box with its base centred on the origin.
export function boxG(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

export function cylG(rTop, rBottom, h, seg = 8, open = false, thetaStart = 0, thetaLength = Math.PI * 2) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open, thetaStart, thetaLength);
  g.translate(0, h / 2, 0);
  return g;
}

// A prism from a 2D outline (x right, y up) extruded `depth` along +z, centred on z = 0.
export function prismG(points, depth, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  holes.forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function shapeG(shape, depth, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

// A flat polygon (x, z pairs) at height y, facing up (or down).
export function flatG(points, y = 0, down = false) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  if (down) g.rotateX(Math.PI);
  g.translate(0, y, 0);
  return g;
}

// A quad from four corners (counter-clockwise seen from the front).
// the same surface facing the other way (the underside of a canopy)
export function flipped(g) {
  const out = g.index ? g.toNonIndexed() : g;
  const p = out.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, y, z);
  }
  out.deleteAttribute('normal');
  out.computeVertexNormals();
  return out;
}

export function quadG(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.computeVertexNormals();
  return g;
}

export function triG(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.computeVertexNormals();
  return g;
}

// A thin bar (box) from point a to point b with a square section.
export function barG(a, b, t = 0.04, t2 = t) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.BoxGeometry(t, len, t2);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export function rodG(a, b, r = 0.02, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// A tube along a list of points (string-light wires, scroll brackets, curved lamp posts).
export function tubeG(points, r = 0.012, seg = 4, closed = false, perPoint = 3) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.2);
  return new THREE.TubeGeometry(curve, Math.max(2, Math.round(points.length * perPoint)), r, seg, closed);
}

// Points along a hanging wire from a to b, `sag` metres below the straight line at the middle.
export function catenary(a, b, sag, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    out.push(p);
  }
  return out;
}

// A wall along a polyline in the pen's frame, its top and its foot following the points: [x, z, top, foot].
// Retaining walls whose top follows the ground, low walls on a sloping edge.
export function wallStrip(pen, name, pts, { thick = 0.5, sink = 0.5 } = {}) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az, at, af] = pts[i - 1], [bx, bz, bt, bf] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3) continue;
    const g = new THREE.BoxGeometry(len, 1, thick);
    g.translate(len / 2, 0.5, 0);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getX(k) / len;
      pos.setY(k, pos.getY(k) > 0.5 ? at + (bt - at) * t : af + (bf - af) * t - sink);
    }
    g.computeVertexNormals();
    g.rotateY(Math.atan2(-(bz - az), bx - ax));
    g.translate(ax, 0, az);
    pen.put(name, g);
  }
}

export function mat4({ x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1, sx = s, sy = s, sz = s } = {}) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  return m;
}

// ---------- the pen: places pieces in a frame (UVs in that frame's metres), then into the world ----------
// pen.frame(m) starts a new UV frame placed by m (a block, a pool, a building); pen.at(m) moves pieces within the
// current frame without changing where its UVs come from. Every piece lands in the collector under a material name
// and a band.

export function createPen(collector, { toWorld = new THREE.Matrix4(), local = new THREE.Matrix4(), band = 'base', uvMode = 'world' } = {}) {
  const pen = {
    toWorld, local, band, collector,
    frame(m) { return createPen(collector, { toWorld: toWorld.clone().multiply(local).multiply(m), band, uvMode }); },
    at(m) { return createPen(collector, { toWorld, local: local.clone().multiply(m), band, uvMode }); },
    move(x, y, z, ry = 0) { return pen.at(mat4({ x, y, z, ry })); },
    inBand(b) { return createPen(collector, { toWorld, local, band: b, uvMode }); },
    slopes() { return createPen(collector, { toWorld, local, band, uvMode: 'slope' }); },
    // g is built at the piece's origin; `m` places it within the frame
    put(name, g, m = null, { uv = uvMode, tile = 1, seed = null } = {}) {
      g = prep(g);
      if (m) g.applyMatrix4(m);
      g.applyMatrix4(local);
      if (uv === 'slope') slopeUV(g, tile); else if (uv === 'world') worldUV(g, tile);
      g.applyMatrix4(toWorld);
      if (seed !== null) g.setAttribute('lightSeed', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(seed), 1));
      collector.add(name, g, band);
      return pen;
    },
    box(name, w, h, d, x = 0, y = 0, z = 0, ry = 0, opts) { return pen.put(name, boxG(w, h, d), mat4({ x, y, z, ry }), opts); },
    // a box between two corners in the frame (x1..x2, y1..y2, z1..z2)
    span(name, x1, x2, y1, y2, z1, z2, opts) {
      if (x2 - x1 < 1e-3 || y2 - y1 < 1e-3 || z2 - z1 < 1e-3) return pen;
      return pen.put(name, boxG(x2 - x1, y2 - y1, z2 - z1), mat4({ x: (x1 + x2) / 2, y: y1, z: (z1 + z2) / 2 }), opts);
    },
    // world position of a point in this pen's frame
    world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(local).applyMatrix4(toWorld); },
    worldMatrix(m = null) { const out = toWorld.clone().multiply(local); return m ? out.multiply(m) : out; },
  };
  return pen;
}

// ---------- the collector: geometry per material and band, merged on finish ----------

export function createCollector(bands = ['base']) {
  const items = new Map();   // material name -> band -> [geometries]
  return {
    bands,
    add(name, g, band = 'base') {
      if (!bands.includes(band)) throw new Error(`content: no band called ${band}`);
      if (!items.has(name)) items.set(name, new Map());
      const byBand = items.get(name);
      if (!byBand.has(band)) byBand.set(band, []);
      byBand.get(band).push(g);
    },
    names: () => [...items.keys()],
    // One mesh per material, bands in order, each band's vertex range recorded for draw ranges.
    finish(getMaterial, { shadows = (name) => true, receive = true, label = 'content' } = {}) {
      const meshes = [];
      items.forEach((byBand, name) => {
        const list = [];
        const ranges = {};
        let start = 0;
        const withSeed = [...byBand.values()].flat().some((g) => g.attributes.lightSeed);
        bands.forEach((b) => {
          const gs = byBand.get(b) || [];
          let count = 0;
          gs.forEach((g) => {
            if (withSeed && !g.attributes.lightSeed) g.setAttribute('lightSeed', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
            count += g.attributes.position.count;
            list.push(g);
          });
          ranges[b] = [start, count];
          start += count;
        });
        if (!list.length) return;
        const g = list.length === 1 ? list[0] : mergeGeometries(list);
        if (!g) throw new Error(`content: could not merge ${name}`);
        if (list.length > 1) list.forEach((x) => x.dispose());
        g.computeBoundingSphere();
        g.computeBoundingBox();
        const mesh = new THREE.Mesh(g, getMaterial(name));
        mesh.name = `${label}:${name}`;
        mesh.userData.material = name;
        mesh.userData.ranges = ranges;
        mesh.castShadow = shadows(name);
        mesh.receiveShadow = receive;
        if (mesh.castShadow && mesh.material?.map) mesh.customDepthMaterial = plainDepth();
        meshes.push(mesh);
      });
      items.clear();
      return meshes;
    },
  };
}

// Show only some bands of a merged mesh: `show(band)` says yes or no. Bands must be contiguous to stay one range;
// a gap hides everything after it (bands are ordered so this never happens in use).
export function showBands(mesh, show) {
  const ranges = mesh.userData.ranges;
  let start = null, end = 0;
  for (const [b, [s, c]] of Object.entries(ranges)) {
    if (!c) continue;
    if (show(b)) { if (start === null) start = s; end = s + c; }
    else if (start !== null) break;
  }
  if (start === null) { mesh.geometry.setDrawRange(0, 0); mesh.visible = false; return; }
  mesh.visible = true;
  mesh.geometry.setDrawRange(start, end - start);
}

// A shadow is the same shape whatever the surface's texture: one depth material for every textured caster, its map
// held empty (three.js copies a caster's map onto its depth material, and each texture-or-not mix is a shader)
let PLAIN_DEPTH = null;
function plainDepth() {
  if (PLAIN_DEPTH) return PLAIN_DEPTH;
  PLAIN_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  Object.defineProperty(PLAIN_DEPTH, 'map', { get: () => null, set: () => {} });
  return PLAIN_DEPTH;
}

// ---------- instancing ----------

export function instanced(geometry, material, matrices, { name = 'instances', shadows = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  if (shadows && material?.map) mesh.customDepthMaterial = plainDepth();
  return mesh;
}

// Several geometries (one per material) instanced together: a lounger, a chair.
export function instancedKit(parts, getMaterial, matrices, { name = 'kit', shadows = true } = {}) {
  const group = new THREE.Group();
  group.name = name;
  Object.entries(parts).forEach(([mname, g]) => {
    const m = instanced(prep(g), getMaterial(mname), matrices, { name: `${name}:${mname}`, shadows });
    m.userData.material = mname;
    group.add(m);
  });
  return group;
}

// A kit collector: build one object with a pen, get back { material: geometry } for instancedKit.
export function kitParts(build) {
  const c = createCollector(['base']);
  build(createPen(c, { uvMode: 'world' }));
  const out = {};
  c.finish(() => null, {}).forEach((m) => { out[m.userData.material] = m.geometry; });
  return out;
}

// An invisible box for taps: drawn never (its material is not visible), still found by a raycaster.
const PICK_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
export function pickBox({ c, rot = 0, length, width, y1, y2 }, name = 'pick') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(length, y2 - y1, width), PICK_MATERIAL);
  m.position.set(c[0], (y1 + y2) / 2, c[1]);
  m.rotation.y = rot;
  m.name = name;
  m.updateMatrixWorld(true);
  return m;
}

// Oriented box helpers: a local (x along, z across) frame for { c, rot }.
export function frameOf({ c, rot = 0 }, y = 0) {
  return mat4({ x: c[0], y, z: c[1], ry: rot });
}

export function toLocal({ c, rot = 0 }, x, z) {
  const dx = x - c[0], dz = z - c[1];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return [dx * cs - dz * sn, dx * sn + dz * cs];
}

export function fromLocal({ c, rot = 0 }, lx, lz) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return [c[0] + lx * cs + lz * sn, c[1] - lx * sn + lz * cs];
}

// Compass bearing (degrees) of a frame's local direction (dx along, dz across).
export function bearingOf({ rot = 0 }, dx, dz) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const wx = dx * cs + dz * sn, wz = -dx * sn + dz * cs;
  return ((Math.atan2(wx, -wz) * 180) / Math.PI + 360) % 360;
}

export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
