// The woods round La Conca, tree by tree: broadleaf only at and between the villas (the photos show oak, chestnut
// and hornbeam; no cypress, olive or pine), in late-May greens. Mill Lane's foliage (jittered blobs, lighter at the
// top, world-space leaf noise, a sway weight animated in the vertex shader), at three levels of detail.
//
// The trees are binned into 60 m cells. Each frame the camera moves, every cell is tested against the view (with a
// margin for shadows falling into it) and given a level of detail by distance; only when that changes are the
// visible cells' instances copied into one InstancedMesh per species and level (nine draws at most). Levels 0 and 1
// cast shadows; level 2 (beyond a few hundred metres) does not.
import * as THREE from '../vendor/three-core.js';
import { mergeGeometries } from '../vendor/three-core.js';
import { seeded, clamp, distanceToPolyline, pointInPolygon } from '../util.js';

const HALF = 600;
const CELL = 60;
const N = Math.ceil((2 * HALF) / CELL);

// late-May greens (display colours): fresh yellow-green chestnut and oak, darker hornbeam
export const SPECIES = {
  oak: { leaf: '#66843b', under: '#2c3f1c', trunk: '#6b6152', height: [12, 20], width: 0.78, clear: 0.3, lobes: 'spreading' },
  chestnut: { leaf: '#76923c', under: '#344b20', trunk: '#655849', height: [13, 21], width: 0.72, clear: 0.28, lobes: 'dome' },
  hornbeam: { leaf: '#56743c', under: '#263b1c', trunk: '#86817a', height: [10, 16], width: 0.5, clear: 0.25, lobes: 'ovoid' },
  // placed only on purpose (content's specimen trees and shrubs): the fig by Santarsa's outbuildings, a cypress row if
  // Joe wants one on the lower approach, poplars by water, flowering broom and scrub along tracks and wood edges
  fig: { leaf: '#4f6f34', under: '#2a3f1c', trunk: '#8a8478', height: [4.5, 6.5], width: 1.3, clear: 0.12, lobes: 'fig' },
  cypress: { leaf: '#2f4a2c', under: '#1b2d1a', trunk: '#4a3f35', height: [12, 18], width: 0.14, clear: 0.04, lobes: 'flame' },
  poplar: { leaf: '#6d8c42', under: '#3a5326', trunk: '#8d887c', height: [18, 24], width: 0.22, clear: 0.12, lobes: 'column' },
  broom: { leaf: '#cfb535', under: '#56662a', trunk: '#4f6326', height: [1.2, 2.2], width: 1.1, clear: 0, lobes: 'bush' },
  scrub: { leaf: '#58763a', under: '#26381a', trunk: '#2b3f1d', height: [1.0, 2.6], width: 1.3, clear: 0, lobes: 'bush' },
  // reeds round the pond: tight upright clumps, fresh green with last year's straw in them
  reed: { leaf: '#869350', under: '#59603a', trunk: '#59603a', height: [1.3, 2.3], width: 0.5, clear: 0, lobes: 'reed' },
};
const BUSHES = new Set(['broom', 'scrub']);
const NAMES = Object.keys(SPECIES);
// level 1 (one smooth crown on a trunk) to this far; level 2 (twenty faces, no trunk) beyond, where a crown is a few
// pixels across and the woods are mostly the blanket
const LOD = {
  fast: [40, 170],
  balanced: [45, 220],
  best: [50, 260],
};
// the eye-level fill: full detail close by, the middle level out to where the blanket has risen again
const EYE_LOD = {
  fast: [20, 58],
  balanced: [26, 66],
  best: [26, 66],
};
const EYE_ABOVE = 34;   // metres over the ground: higher than this, the fill is not drawn

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// One blob: an icosahedron pushed about by a hash of its corners, coloured lighter at the top and darker deep inside,
// with a sway weight. Its normals point mostly away from the whole crown's middle (`mid`), so a crown is lit as one
// soft rounded mass, not as facets; the blob's own roundness is mixed in for the lumps.
function blob(detail, x, y, z, rx, ry, rz, leaf, under, crown, seed, mid = null) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  const pos = ng.attributes.position;
  const col = new Float32Array(pos.count * 3), sway = new Float32Array(pos.count), nrm = new Float32Array(pos.count * 3);
  const a = new THREE.Color(leaf), b = new THREE.Color(under), c = new THREE.Color();
  const m = mid || { x, y, z, rx, ry, rz };
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const h = hash3(Math.round(ux * 1000) / 1000 + seed, Math.round(uy * 1000) / 1000 - seed * 0.7, Math.round(uz * 1000) / 1000 + seed * 0.3);
    const k = 1 + (h - 0.5) * 0.3;
    const wx = x + ux * rx * k, wy = y + uy * ry * k, wz = z + uz * rz * k;
    pos.setXYZ(i, wx, wy, wz);
    // the crown's own outward direction (scaled to its shape) and the blob's
    v.set((wx - m.x) / (m.rx * m.rx), (wy - m.y) / (m.ry * m.ry), (wz - m.z) / (m.rz * m.rz)).normalize();
    w.set(ux / rx, uy / ry, uz / rz).normalize();
    v.lerp(w, mid ? 0.32 : 1).normalize();
    nrm.set([v.x, v.y, v.z], i * 3);
    // how far out in the crown this corner is: the inside of a crown is in its own shade
    const out = clamp(Math.hypot((wx - m.x) / m.rx, (wy - m.y) / m.ry, (wz - m.z) / m.rz), 0, 1.2);
    const up = clamp((wy - crown.base) / (crown.top - crown.base), 0, 1);
    const side = 0.5 + 0.5 * v.y;
    c.copy(b).lerp(a, clamp(0.12 + 0.45 * up + 0.3 * side + 0.35 * (out - 0.6) + (h - 0.5) * 0.24, 0, 1.12));
    col.set([c.r, c.g, c.b], i * 3);
    sway[i] = crown.sway * up;
  }
  ng.deleteAttribute('uv');
  ng.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  return ng;
}

// A round, tapering stem from (x0, y0, z0) to (x1, y1, z1), flared at the foot when `flare` is set.
function stem(segs, x0, y0, z0, x1, y1, z1, r0, r1, colour, flare = 0) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
  const len = a.distanceTo(b);
  const rings = flare ? 3 : 1;
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, rings, true).translate(0, len / 2, 0);
  if (flare) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len;
      const k = 1 + flare * Math.max(0, 1 - t * 6) ** 2;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  g.computeVertexNormals();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(x0, y0, z0);
  const ng = g.toNonIndexed();
  g.dispose();
  const n = ng.attributes.position.count;
  const c = new THREE.Color(colour), col = new Float32Array(n * 3);
  const pos = ng.attributes.position;
  for (let i = 0; i < n; i++) {
    // bark: darker at the foot
    const k = 0.78 + 0.22 * clamp((pos.getY(i) - y0) / 3, 0, 1);
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  ng.deleteAttribute('uv');
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(n), 1));
  return ng;
}

// A tree of `height` metres for a species at one level of detail (broadleaf: 0 about 560 triangles, 1 about 100,
// 2 twenty). Oak, chestnut and hornbeam have a full rounded crown coming well down the trunk, as the woods round La
// Conca show: a broad dome on the oak, a taller dome on the chestnut, an upright oval on the hornbeam.
function treeGeometry(name, lod, height = 16) {
  const s = SPECIES[name];
  const rnd = seeded(name.length * 97 + 13);
  const R = height * s.width * 0.5;
  const base = height * s.clear;
  const cy = height - R * 0.95;
  const crown = { base, top: height, sway: 0.05 + height * 0.006 };
  const parts = [];
  if (s.lobes === 'bush') {
    const n = lod === 0 ? 2 : 1;
    const mid = { x: 0, y: height * 0.42, z: 0, rx: R, ry: height * 0.55, rz: R };
    for (let i = 0; i < n; i++) {
      const a = i * 2.1 + 0.4, d = n > 1 ? R * 0.42 : 0;
      parts.push(blob(lod === 2 ? 0 : 1, Math.cos(a) * d, height * (0.4 + 0.08 * (i % 2)), Math.sin(a) * d, R * (n > 1 ? 0.66 : 0.95), height * (n > 1 ? 0.46 : 0.5), R * (n > 1 ? 0.66 : 0.95), s.leaf, s.under, { base: 0, top: height, sway: 0.03 }, 1.3 + i, mid));
    }
  } else if (s.lobes === 'reed') {
    const n = lod === 0 ? 4 : 1;
    const mid = { x: 0, y: height * 0.5, z: 0, rx: R, ry: height * 0.5, rz: R };
    for (let i = 0; i < n; i++) {
      const a = i * 1.7 + 0.3, d = n > 1 ? R * 0.45 : 0;
      parts.push(blob(lod === 2 ? 0 : 1, Math.cos(a) * d, height * (0.46 + 0.05 * (i % 2)), Math.sin(a) * d, R * (n > 1 ? 0.42 : 0.8), height * 0.5, R * (n > 1 ? 0.42 : 0.8), s.leaf, s.under, { base: 0, top: height, sway: 0.05 }, 2.3 + i, mid));
    }
  } else if (s.lobes === 'flame' || s.lobes === 'column') {
    if (lod < 2) parts.push(stem(5, 0, -0.4, 0, 0, height * 0.3, 0, 0.18 + height * 0.006, 0.1, s.trunk));
    const n = lod === 0 ? 3 : 1, w = height * s.width * 0.5;
    const mid = { x: 0, y: height * 0.55, z: 0, rx: w, ry: height * 0.48, rz: w };
    for (let i = 0; i < n; i++) {
      const y0 = n > 1 ? height * (0.28 + 0.26 * i) : height * 0.52, k = n > 1 ? 1 - i * 0.28 : 1;
      parts.push(blob(lod === 2 ? 0 : 1, 0, y0, 0, w * k * (s.lobes === 'column' ? 1.1 : 1), n > 1 ? height * 0.24 : height * 0.48, w * k, s.leaf, s.under, crown, 1.3 + i, mid));
    }
  } else if (s.lobes === 'fig') {
    if (lod < 2) for (let i = 0; i < (lod === 0 ? 3 : 1); i++) {
      const a = i * 2.2;
      parts.push(stem(5, 0, -0.2, 0, Math.cos(a) * R * 0.45, cy - R * 0.1, Math.sin(a) * R * 0.45, 0.14, 0.07, s.trunk));
    }
    const n = lod === 0 ? 5 : lod === 1 ? 2 : 1;
    const mid = { x: 0, y: cy, z: 0, rx: R, ry: R * 0.5, rz: R };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, d = n > 1 ? R * 0.42 : 0;
      parts.push(blob(lod === 2 ? 0 : 1, Math.cos(a) * d, cy, Math.sin(a) * d, R * (n > 1 ? 0.58 : 1), R * 0.46, R * (n > 1 ? 0.58 : 1), s.leaf, s.under, crown, 1.3 + i, mid));
    }
  } else {
    // broadleaf: an ellipsoid crown from `base` to the top, wider than tall on the oak, taller on the hornbeam
    const ry = (height - base) / 2;
    const my = base + ry;
    const rx = Math.min(R, ry * (s.lobes === 'spreading' ? 1.18 : s.lobes === 'ovoid' ? 0.72 : 0.95));
    const lean = (rnd() - 0.5) * 0.5;
    const mid = { x: lean, y: my, z: lean * 0.4, rx, ry, rz: rx };
    const trunkTop = my - ry * 0.15;
    if (lod < 2) parts.push(stem(lod === 0 ? 7 : 5, 0, -0.4, 0, lean, trunkTop, lean * 0.4, 0.22 + height * 0.014, 0.1 + height * 0.005, s.trunk, lod === 0 ? 0.7 : 0));
    if (lod === 0) {
      // three main limbs into the crown, seen where it opens up
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + rnd() * 0.8;
        parts.push(stem(4, lean * 0.3, base + ry * 0.15, lean * 0.1, lean + Math.cos(a) * rx * 0.55, my + ry * 0.25, lean * 0.4 + Math.sin(a) * rx * 0.55, 0.1 + height * 0.004, 0.04, s.trunk));
      }
      // a big middle mass and lobes round it: lower ones out at the sides, one or two on top
      parts.push(blob(1, lean, my, lean * 0.4, rx * 0.74, ry * 0.74, rx * 0.74, s.leaf, s.under, crown, 1.3, mid));
      const lobes = [[0.55, -0.2, 0.0], [0.6, -0.12, 2.2], [0.55, -0.25, 4.2], [0.32, 0.46, 2.4]];
      lobes.forEach(([d, h, a], i) => {
        const r = (i < 3 ? 0.56 : 0.5) * (0.9 + rnd() * 0.2);
        parts.push(blob(1, lean + Math.cos(a) * rx * d, my + h * ry, lean * 0.4 + Math.sin(a) * rx * d, rx * r, ry * r * 0.95, rx * r, s.leaf, s.under, crown, 2.1 + i * 1.7, mid));
      });
    } else if (lod === 1) {
      parts.push(blob(1, lean, my, lean * 0.4, rx * 1.02, ry * 1.0, rx * 1.02, s.leaf, s.under, crown, 1.3, mid));
    } else {
      // far off: one lumpy crown reaching down over where the trunk would be
      parts.push(blob(0, lean, my - ry * 0.1, 0, rx * 1.05, ry * 1.12, rx * 1.05, s.leaf, s.under, { ...crown, base: 0 }, 1.3, mid));
    }
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

// Trees between the camera and a cut-open villa or room step out of the way (screen-door fade): x, y, z of what is
// being looked at and the radius round the line of sight; 0 when nothing is cut open. Shared by every tree mesh.
export const TREE_CUT = { value: new THREE.Vector4(0, 0, 0, 0) };

// World-space leaf clusters: hollows darker, faceted normals tilted, faded out with distance; sway in the vertex
// shader; and a little light through the leaves when you look towards a low sun.
function treeMaterial(shared) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTreeTime = shared.time;
    s.uniforms.uTreeCut = TREE_CUT;
    s.uniforms.uTreeSun = shared.sun;
    s.uniforms.uTreeSunCol = shared.sunCol;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTreeTime;\nuniform vec4 uTreeCut;\nvarying vec3 vLeafWorld;\nvarying float vTreeCut;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec3 instPos = instanceMatrix[3].xyz;
  #else
    vec3 instPos = vec3(0.0);
  #endif
  float ph = fract(sin(dot(instPos.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  float tt = uTreeTime * 0.85 + ph;
  transformed.x += (sin(tt * 1.3) + 0.35 * sin(tt * 3.1)) * sway;
  transformed.z += cos(tt * 1.05) * sway * 0.6;
  // out of the way of a cut-open villa: the crown's middle near the line from the camera to it
  vTreeCut = 0.0;
  if (uTreeCut.w > 0.0) {
    #ifdef USE_INSTANCING
      float crownUp = instanceMatrix[1].y * 9.0;
    #else
      float crownUp = 9.0;
    #endif
    vec3 cIn = (modelMatrix * vec4(instPos, 1.0)).xyz + vec3(0.0, crownUp, 0.0);
    vec3 seg = uTreeCut.xyz - cameraPosition;
    float t = clamp(dot(cIn - cameraPosition, seg) / max(dot(seg, seg), 1e-4), 0.0, 1.0);
    float dLine = length(cameraPosition + seg * t - cIn);
    // a cone: wide near the camera, where a crown would fill the frame, narrowing to the radius at the room
    // plus the crown's own reach, so a crown whose middle is just outside does not still hang across the view
    #ifdef USE_INSTANCING
      float reach = length(instanceMatrix[0].xyz) * 6.5;
    #else
      float reach = 6.5;
    #endif
    float rad = uTreeCut.w + (1.0 - t) * 0.85 * length(seg) + reach;
    // a narrow fade band: a half-faded crown is a speckled one
    vTreeCut = (1.0 - smoothstep(rad * 0.9, rad, dLine)) * (1.0 - smoothstep(0.95, 1.0, t));
  }
}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLeafWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vTreeCut;
uniform vec4 uTreeSun;
uniform vec3 uTreeSunCol;
varying vec3 vLeafWorld;
float leafHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float leafNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(leafHash(i), leafHash(i + vec3(1, 0, 0)), u.x), mix(leafHash(i + vec3(0, 1, 0)), leafHash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(leafHash(i + vec3(0, 0, 1)), leafHash(i + vec3(1, 0, 1)), u.x), mix(leafHash(i + vec3(0, 1, 1)), leafHash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vTreeCut > 0.0 && vTreeCut > fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453)) discard;
float leafDist = length(vLeafWorld - cameraPosition);
float leafFade = 1.0 - smoothstep(40.0, 200.0, leafDist);
vec3 leafP = vLeafWorld * 1.3;
float leafN = leafNoise(leafP);
vec3 leafG = vec3(leafNoise(leafP + vec3(0.37, 0.0, 0.0)), leafNoise(leafP + vec3(0.0, 0.37, 0.0)), leafNoise(leafP + vec3(0.0, 0.0, 0.37))) - leafN;
diffuseColor.rgb *= mix(0.9, mix(0.66, 1.1, smoothstep(0.2, 0.8, leafN)), leafFade);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal - mat3(viewMatrix) * leafG * 2.2 * leafFade);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 toFrag = normalize(vLeafWorld - cameraPosition);
  float back = pow(max(dot(toFrag, uTreeSun.xyz), 0.0), 5.0) * uTreeSun.w;
  totalEmissiveRadiance += diffuseColor.rgb * uTreeSunCol * back * 0.3;
}`);
  };
  m.customProgramCacheKey = () => 'villas-trees';
  return m;
}

// The trees' shadow: crowns let the sun through in flecks (gaps from a world-space noise, crowns only: `sway` is 0
// on trunks), so a tree's shadow on a lawn is dappled and its edge broken, not a flat shape.
function treeDepthMaterial() {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
attribute float sway;
varying vec3 vLeafW;
varying float vCrown;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 lw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      lw = instanceMatrix * lw;
    #endif
    vLeafW = (modelMatrix * lw).xyz;
    vCrown = step(0.0001, sway);
  }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLeafW;
varying float vCrown;
float dHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float dNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), u.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), u.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (vCrown > 0.5 && dNoise(vLeafW * 1.1) * 0.7 + dNoise(vLeafW * 3.1) * 0.3 < 0.36) discard;`);
  };
  d.customProgramCacheKey = () => 'villas-tree-depth';
  return d;
}
const TREE_DEPTH = treeDepthMaterial();

// Where the trees stand. mask(x, z) is 1 deep in the woods and 0 in the open; zones are the villa gardens.
export function placeTrees({ groundAt, mask, model, zones, density = 1, clear = [], specimens = [], shrubs = [], noise }) {
  const rnd = seeded(77);
  const out = [];
  const blocks = [...model.villas.flatMap((v) => v.blocks), ...model.outbuildings];
  const blocked = (x, z, r) => {
    // crowns stop short of the houses and pools rather than hanging over their roofs
    for (const b of blocks) if (Math.hypot(x - b.c[0], z - b.c[1]) < Math.max(b.length, b.width) / 2 + 4 + r * 0.9) return true;
    for (const p of model.pools) if (Math.hypot(x - p.c[0], z - p.c[1]) < p.length / 2 + 8 + r * 0.7) return true;
    for (const rd of model.roads) if (distanceToPolyline(x, z, rd.points) < rd.width / 2 + 1.5 + r * 0.45) return true;
    for (const poly of clear) if (pointInPolygon(x, z, poly)) return true;
    for (const w of model.water) if (w.polygon && pointInPolygon(x, z, w.polygon)) return true;
    return false;
  };
  const near = (x, z) => Math.min(...zones.map((zn) => Math.hypot(x - zn.c[0], z - zn.c[1]) - zn.r));
  const pick = (x, z, open) => {
    if (open) return rnd() < 0.8 ? 'oak' : 'chestnut';
    const n = noise(x / 150, z / 150) + (rnd() - 0.5) * 0.35;
    return n < 0.42 ? 'chestnut' : n < 0.74 ? 'oak' : 'hornbeam';
  };
  const step = 6.4;
  for (let gz = -HALF + 6; gz < HALF - 6; gz += step) {
    for (let gx = -HALF + 6; gx < HALF - 6; gx += step) {
      const x = gx + (rnd() - 0.5) * step * 0.9, z = gz + (rnd() - 0.5) * step * 0.9;
      const m = mask(x, z);
      const d = near(x, z);
      // clumps and gaps: a slow noise thins the woods in patches, so the trees are not evenly spread
      const clump = 0.55 + 0.9 * noise(x / 38 + 11, z / 38 - 7);
      let p;
      if (m > 0.12 && m < 0.88) p = 0.78;                        // the edge of every clearing and lane
      else if (m >= 0.88) p = d < 170 ? 0.42 : d < 330 ? 0.12 : 0.03;   // through the canopy, thickest by the villas
      else p = d < 0 ? 0.002 : 0.012;                            // the odd oak out in the meadows
      // the wood's edge has its scrub and broom (yellow in flower at the end of May) in front of the trees
      if (m > 0.1 && m < 0.6 && rnd() < (d < 260 ? 0.42 : 0.22) * density) {
        const sx = x + (rnd() - 0.5) * 3, sz = z + (rnd() - 0.5) * 3;
        const sp = rnd() < 0.3 ? 'broom' : 'scrub';
        const ss = SPECIES[sp];
        const sh = ss.height[0] + rnd() * (ss.height[1] - ss.height[0]);
        if (!blocked(sx, sz, sh * 0.6)) out.push({ species: sp, x: sx, z: sz, y: groundAt(sx, sz) - 0.15, h: sh, w: 0.8 + rnd() * 0.7, rot: rnd() * Math.PI * 2, tint: rnd(), shade: m });
      }
      if (rnd() > p * density * (m >= 0.88 ? clump : 1)) continue;
      const species = pick(x, z, m <= 0.12);
      const s = SPECIES[species];
      // young trees among the old: a wide spread of sizes
      const young = rnd() < 0.18;
      let h = (s.height[0] + rnd() * (s.height[1] - s.height[0])) * (young ? 0.45 + rnd() * 0.25 : 0.82 + rnd() * 0.36);
      if (m >= 0.88 && !young) h = Math.max(h, 13 + rnd() * 6);
      const r = h * s.width * 0.5;
      if (blocked(x, z, r)) continue;
      out.push({ species, x, z, y: groundAt(x, z) - 0.35, h, w: 0.72 + rnd() * 0.5, rot: rnd() * Math.PI * 2, tint: rnd(), shade: m });
    }
  }
  // the woods' own density, for a camera at eye level only (createTrees' eyeOnly): from the air the blanket stands
  // for these trees, so they are never drawn from there. Old trees, young ones under them, and scrub on the floor.
  const fill = [];
  const rf = seeded(91);
  for (let gz = -HALF + 6; gz < HALF - 6; gz += step) {
    for (let gx = -HALF + 6; gx < HALF - 6; gx += step) {
      const x = gx + (rf() - 0.5) * step * 0.9, z = gz + (rf() - 0.5) * step * 0.9;
      const m = mask(x, z);
      const a = rf(), b = rf(), c = rf(), e = rf();
      if (m < 0.5 || Math.max(Math.abs(x), Math.abs(z)) > 560) continue;
      const deep = Math.min(1, (m - 0.5) / 0.35);
      if (b < 0.45 * deep) {
        const sp = c < 0.2 ? 'broom' : 'scrub';
        const ss = SPECIES[sp];
        const sx = x + (e - 0.5) * 3, sz = z + (a - 0.5) * 3;
        if (!blocked(sx, sz, 1)) fill.push({ species: sp, x: sx, z: sz, y: groundAt(sx, sz) - 0.15, h: ss.height[0] + e * (ss.height[1] - ss.height[0]), w: 0.8 + c * 0.6, rot: a * 6.28, tint: e, shade: m });
      }
      // a young tree under the old ones: hornbeam and oak saplings, the trunks a wood is full of at eye level
      if (rf() < 0.4 * deep) {
        const yx = x + (rf() - 0.5) * 4, yz = z + (rf() - 0.5) * 4, yh = 3.2 + rf() * 4.5;
        const ysp = rf() < 0.55 ? 'hornbeam' : 'oak';
        if (!blocked(yx, yz, 1.5)) fill.push({ species: ysp, x: yx, z: yz, y: groundAt(yx, yz) - 0.25, h: yh, w: 0.6 + rf() * 0.3, rot: rf() * 6.28, tint: rf(), shade: m });
      }
      if (a > 0.5 * deep) continue;
      const species = pick(x, z, false);
      const s = SPECIES[species];
      const young = c < 0.25;
      const h = young ? 4 + e * 5 : 12.5 + e * 6.5;
      if (blocked(x, z, h * s.width * 0.5)) continue;
      fill.push({ species, x, z, y: groundAt(x, z) - 0.35, h, w: 0.62 + b * 0.4, rot: c * 6.28, tint: e, shade: m });
    }
  }
  out.fill = fill;
  // shrubs from content's site entries: { species, polygon or line (with width), density per 100 m2 }
  shrubs.forEach((e) => {
    if (!SPECIES[e.species]) return;
    const pts = e.polygon || e.line;
    if (!pts?.length) return;
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    const w = e.width ?? 3;
    const x0 = Math.min(...xs) - w, x1 = Math.max(...xs) + w, z0 = Math.min(...zs) - w, z1 = Math.max(...zs) + w;
    const n = Math.round(((x1 - x0) * (z1 - z0) / 100) * (e.density ?? 6));
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      const inside = e.polygon ? pointInPolygon(x, z, e.polygon) : distanceToPolyline(x, z, e.line) < w / 2;
      if (!inside) continue;
      const s = SPECIES[e.species];
      const h = s.height[0] + rnd() * (s.height[1] - s.height[0]);
      out.push({ species: e.species, x, z, y: groundAt(x, z) - 0.1, h, w: 0.8 + rnd() * 0.5, rot: rnd() * Math.PI * 2, tint: rnd(), shade: 0.5 });
    }
  });
  specimens.forEach((t) => {
    if (!SPECIES[t.species]) return;
    const s = SPECIES[t.species];
    const h = t.height ?? (s.height[0] + s.height[1]) / 2;
    out.push({ species: t.species, x: t.x, z: t.z, y: groundAt(t.x, t.z) - 0.35, h, w: (t.spread ? t.spread / (h * s.width) : 1), rot: rnd() * Math.PI * 2, tint: 0.5, shade: 0 });
  });
  return out;
}

export function createTrees({ trees, tier = 'fast', groundAt, sky, eyeOnly = false }) {
  const lodAt = eyeOnly ? EYE_LOD[tier] || EYE_LOD.fast : LOD[tier] || LOD.fast;
  const shared = { time: { value: 0 }, sun: { value: new THREE.Vector4(0, 1, 0, 0) }, sunCol: { value: new THREE.Color() } };
  const material = treeMaterial(shared);
  const group = new THREE.Group();
  group.name = 'trees';
  const BASE_H = 16;

  // cells: per species, the instance matrices and colours of the trees in it
  const cells = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = -HALF + (i + 0.5) * CELL, cz = -HALF + (j + 0.5) * CELL;
    cells.push({ i, j, cx, cz, cy: groundAt(cx, cz) + 8, per: NAMES.map(() => ({ m: [], c: [] })), count: 0, lod: -1 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const counts = NAMES.map(() => 0);
  trees.forEach((t) => {
    const i = clamp(Math.floor((t.x + HALF) / CELL), 0, N - 1), j = clamp(Math.floor((t.z + HALF) / CELL), 0, N - 1);
    const cell = cells[j * N + i];
    const k = NAMES.indexOf(t.species);
    const s = t.h / BASE_H;
    q.setFromAxisAngle(up, t.rot);
    m4.compose(p.set(t.x, t.y, t.z), q, sc.set(s * t.w, s, s * t.w));
    cell.per[k].m.push(...m4.elements);
    // per-tree variation: a little lighter or darker, a touch more yellow or blue-green
    col.setRGB(0.9 + 0.2 * t.tint, 0.92 + 0.16 * t.tint, 0.84 + 0.22 * (1 - t.tint));
    cell.per[k].c.push(col.r, col.g, col.b);
    cell.count++;
    cell.cy = Math.max(cell.cy, t.y + t.h * 0.5);
    counts[k]++;
  });
  cells.forEach((c) => c.per.forEach((x) => { x.m = new Float32Array(x.m); x.c = new Float32Array(x.c); }));
  const live = cells.filter((c) => c.count);

  // one InstancedMesh per species and level, sized for every tree of that species; none for a species not planted
  const meshes = NAMES.map((name, k) => (counts[k] ? [0, 1, 2].map((l) => {
    const mesh = new THREE.InstancedMesh(treeGeometry(name, l, BASE_H), material, counts[k]);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, counts[k]) * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    // the fill casts nothing (the blanket's shadow covers it) but takes that shade, so a wood is dim inside
    mesh.castShadow = !eyeOnly && l < 2;
    mesh.receiveShadow = eyeOnly;
    mesh.customDepthMaterial = TREE_DEPTH;
    mesh.name = `trees-${name}-${l}`;
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  }) : null));
  const planted = meshes.map((row, k) => (row ? k : -1)).filter((k) => k >= 0);
  const signatures = NAMES.map(() => ['', '', '']);

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const lastView = new THREE.Matrix4(), lastProj = new THREE.Matrix4();
  let shadowReach = 30;
  const toSun = new THREE.Vector3(), away = new THREE.Vector3(0, 0, 0);
  let rebuilds = 0;

  function cull(camera) {
    if (camera.matrixWorld.equals(lastView) && camera.projectionMatrix.equals(lastProj)) return;
    lastView.copy(camera.matrixWorld);
    lastProj.copy(camera.projectionMatrix);
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    const cam = camera.position;
    let changed = false;
    const low = !eyeOnly || cam.y - groundAt(cam.x, cam.z) < EYE_ABOVE;
    for (const c of live) {
      // the cell and the shadow it throws away from the sun: a sphere over both
      sphere.center.set(c.cx + away.x * shadowReach * 0.5, c.cy, c.cz + away.z * shadowReach * 0.5);
      sphere.radius = CELL * 0.71 + 14 + shadowReach * 0.5;
      let lod = -1;
      if (low && frustum.intersectsSphere(sphere)) {
        const d = Math.max(0, Math.hypot(cam.x - c.cx, cam.y - c.cy, cam.z - c.cz) - CELL * 0.5);
        // a few metres of hysteresis so a cell on a boundary does not flicker between levels
        const hold = c.lod >= 0 ? 6 : 0;
        lod = d < lodAt[0] + (c.lod === 0 ? hold : -hold) ? 0 : d < lodAt[1] + (c.lod <= 1 ? hold : -hold) ? 1 : 2;
        if (eyeOnly && lod === 2) lod = -1;
      }
      if (lod !== c.lod) { c.lod = lod; changed = true; }
    }
    if (!changed) return;
    rebuilds++;
    const byLod = [[], [], []];
    for (const c of live) if (c.lod >= 0) byLod[c.lod].push(c);
    for (const k of planted) {
      for (let l = 0; l < 3; l++) {
        // only the meshes whose cells changed are copied and uploaded again
        let sig = '';
        for (const c of byLod[l]) if (c.per[k].c.length) sig += `${c.i},${c.j};`;
        if (sig === signatures[k][l]) continue;
        signatures[k][l] = sig;
        const mesh = meshes[k][l];
        const mArr = mesh.instanceMatrix.array, cArr = mesh.instanceColor.array;
        let n = 0;
        for (const c of byLod[l]) {
          const src = c.per[k];
          const cnt = src.c.length / 3;
          if (!cnt) continue;
          mArr.set(src.m, n * 16);
          cArr.set(src.c, n * 3);
          n += cnt;
        }
        mesh.count = n;
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, n * 16);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, n * 3);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  function update(t) {
    shared.time.value = t;
    if (sky) {
      const st = sky.state, sun = sky.sun;
      // shadows fall up to this far into the view from trees just outside it
      shadowReach = clamp(18 / Math.tan(Math.max(st.el, 2) * Math.PI / 180), 0, 90);
      const d = toSun.copy(sun.position).sub(sun.target.position).normalize();
      away.set(-d.x, 0, -d.z).normalize();
      shared.sun.value.set(d.x, d.y, d.z, clamp((14 - st.el) / 14, 0, 1) * (1 - st.night));
      shared.sunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
    }
  }

  return {
    group, meshes, cull, update, material,
    stats: () => ({
      trees: trees.length, rebuilds,
      drawn: meshes.map((row, k) => ({ species: NAMES[k], lod: row ? row.map((m) => m.count) : [0, 0, 0] })),
      triangles: meshes.flat().filter(Boolean).reduce((s, m) => s + m.count * (m.geometry.attributes.position.count / 3), 0),
    }),
  };
}
