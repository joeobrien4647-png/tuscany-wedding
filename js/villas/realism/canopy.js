// The woods beyond the single trees, as one blanket: crowns drawn in its shader, not painted on a canvas. A cellular
// (Voronoi) pattern of crowns, its cells bent by a slow noise so they are uneven in size and shape, each crown with its
// own radius, brightness and green, a dome normal lit by the real sun and shadow, and soft dark valleys between them
// that come and go (neighbouring crowns often merge). Broad patches of chestnut, oak and hornbeam greens and slow
// lighter and darker swathes break it up further. It fades to plain colour with distance, so nothing shimmers far off.
// Near a camera at eye level the blanket sinks into the ground (uEye), so the single trees round it are seen with
// their trunks, and the blanket shows only further off, as the wall of foliage a wood is from inside.
import * as THREE from '../vendor/three-core.js';
import { toTexture } from '../textures.js';

export const CROWN_GLSL = /* glsl */`
// hashes without sin(), steady at the large coordinates of a 1.2 km map (Dave Hoskins)
vec2 crownHash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float crownHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float crownNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(crownHash(i), crownHash(i + vec2(1.0, 0.0)), u.x), mix(crownHash(i + vec2(0.0, 1.0)), crownHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// nearest crown: x distance, y distance to the next (edge), zw the vector from here to its centre; id in crownId
vec4 crowns(vec2 x, out float crownId) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  vec2 off = vec2(0.0);
  crownId = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.1 + 0.8 * crownHash2(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; off = r; crownId = crownHash(n + g); }
    else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d1), sqrt(d2), off);
}
// the blanket's crowns at a point on the map (metres): the cell pattern bent by a slow noise so crowns differ in
// size and shape. Returns the crown's radius in cell units in w of the result's out parameter.
vec4 canopyCrowns(vec2 p, float size, out float crownId, out float crownRad) {
  vec2 warp = vec2(crownNoise(p / 21.0), crownNoise(p / 21.0 + 17.3)) - 0.5;
  vec2 q = p / size + warp * 0.9;
  vec4 cr = crowns(q, crownId);
  // small, mid and big crowns; big ones where a slow noise says the trees are old
  float old = crownNoise(p / 53.0 + 4.1);
  crownRad = mix(0.46, 0.82, fract(crownId * 7.13)) * mix(0.85, 1.18, old);
  return cr;
}`;

// The woods from above, painted once: a tile of TILE metres holding a hundred-odd crowns of oak, chestnut and
// hornbeam, each a heap of leaf clumps, lighter where a clump catches the sky and darker to the crown's rim and in
// the gaps; taller crowns drawn over shorter ones. Colour (sRGB) and a height map for its normals. Wraps both ways.
export const CANOPY_TILE = 64;
function canopyPaint(size) {
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; };
  const [cc, cx] = make();
  const [hc, hx] = make();
  const k = size / CANOPY_TILE;
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  cx.fillStyle = '#1d2a14';
  cx.fillRect(0, 0, size, size);
  hx.fillStyle = '#000';
  hx.fillRect(0, 0, size, size);
  // late-May greens: chestnut yellow-green, oak, hornbeam darker and bluer, the odd fresh one
  const greens = [[124, 150, 64], [104, 132, 56], [92, 120, 54], [80, 108, 56], [70, 98, 52], [134, 158, 70]];
  const crowns = [];
  for (let tries = 0; tries < 2400 && crowns.length < 150; tries++) {
    const x = rnd() * CANOPY_TILE, z = rnd() * CANOPY_TILE;
    const r = 2.4 + rnd() * rnd() * 4.6;
    let ok = true;
    for (const o of crowns) {
      let dx = Math.abs(o.x - x), dz = Math.abs(o.z - z);
      dx = Math.min(dx, CANOPY_TILE - dx); dz = Math.min(dz, CANOPY_TILE - dz);
      if (Math.hypot(dx, dz) < (o.r + r) * 0.62) { ok = false; break; }
    }
    if (ok) crowns.push({ x, z, r, h: rnd(), g: greens[Math.floor(rnd() * greens.length)], v: 0.85 + rnd() * 0.3 });
  }
  crowns.sort((a, b) => a.h - b.h);
  const wraps = (x, z, r, fn) => {
    for (const ox of [-CANOPY_TILE, 0, CANOPY_TILE]) for (const oz of [-CANOPY_TILE, 0, CANOPY_TILE]) {
      const px = x + ox, pz = z + oz;
      if (px + r < 0 || px - r > CANOPY_TILE || pz + r < 0 || pz - r > CANOPY_TILE) continue;
      fn(px * k, pz * k, r * k);
    }
  };
  const rgb = (c, f) => `rgb(${Math.round(Math.min(255, c[0] * f))},${Math.round(Math.min(255, c[1] * f))},${Math.round(Math.min(255, c[2] * f))})`;
  for (const t of crowns) {
    // the crown's shadow on what is below it, then its body, then the clumps
    wraps(t.x + 0.6, t.z + 0.6, t.r * 1.08, (px, pz, pr) => {
      const g = cx.createRadialGradient(px, pz, pr * 0.6, px, pz, pr);
      g.addColorStop(0, 'rgba(10,16,8,0.55)');
      g.addColorStop(1, 'rgba(10,16,8,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(px, pz, pr, 0, Math.PI * 2); cx.fill();
    });
    const top = 0.35 + 0.5 * t.h;
    wraps(t.x, t.z, t.r, (px, pz, pr) => {
      const g = cx.createRadialGradient(px, pz, 0, px, pz, pr);
      g.addColorStop(0, rgb(t.g, 0.62 * t.v));
      g.addColorStop(1, rgb(t.g, 0.3 * t.v));
      cx.fillStyle = g; cx.beginPath(); cx.arc(px, pz, pr, 0, Math.PI * 2); cx.fill();
      const h = hx.createRadialGradient(px, pz, 0, px, pz, pr);
      const hv = Math.round(255 * top);
      h.addColorStop(0, `rgb(${hv},${hv},${hv})`);
      h.addColorStop(1, `rgb(${Math.round(hv * 0.45)},${Math.round(hv * 0.45)},${Math.round(hv * 0.45)})`);
      hx.fillStyle = h; hx.beginPath(); hx.arc(px, pz, pr, 0, Math.PI * 2); hx.fill();
    });
    const n = Math.round(t.r * t.r * 2.6);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * t.r * 0.92;
      const cr = 0.45 + rnd() * 0.75;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      const rim = d / t.r;
      const f = t.v * (0.95 - 0.42 * rim * rim) * (0.85 + rnd() * 0.3);
      wraps(x, z, cr, (px, pz, pr) => {
        const g = cx.createRadialGradient(px - pr * 0.2, pz - pr * 0.2, pr * 0.05, px, pz, pr);
        g.addColorStop(0, rgb(t.g, f * 1.12));
        g.addColorStop(0.7, rgb(t.g, f * 0.8));
        g.addColorStop(1, rgb(t.g, f * 0.5));
        cx.fillStyle = g; cx.beginPath(); cx.arc(px, pz, pr, 0, Math.PI * 2); cx.fill();
        const hv = Math.round(255 * (top * (1 - 0.45 * rim * rim) + 0.08));
        const h = hx.createRadialGradient(px, pz, 0, px, pz, pr);
        h.addColorStop(0, `rgba(${hv},${hv},${hv},1)`);
        h.addColorStop(1, `rgba(${hv},${hv},${hv},0)`);
        hx.fillStyle = h; hx.beginPath(); hx.arc(px, pz, pr, 0, Math.PI * 2); hx.fill();
      });
    }
  }
  return { colour: cc, height: hc };
}

// size: the painted tile's resolution (Fast paints a smaller one)
// the painted tile as textures, made once per size: { colour, height, far (its average colour) }
const tiles = new Map();
export function canopyTextures(size = 1024) {
  if (tiles.has(size)) return tiles.get(size);
  const painted = canopyPaint(size);
  const colour = toTexture(painted.colour, { srgb: true, aniso: 8 });
  const height = toTexture(painted.height, { srgb: false, aniso: 8 });
  const px = painted.colour.getContext('2d').getImageData(0, 0, size, size).data;
  const avg = [0, 0, 0];
  for (let i = 0; i < px.length; i += 64) { avg[0] += px[i]; avg[1] += px[i + 1]; avg[2] += px[i + 2]; }
  const n = px.length / 64;
  const far = new THREE.Color().setRGB(avg[0] / n / 255, avg[1] / n / 255, avg[2] / n / 255, THREE.SRGBColorSpace);
  const out = { colour, height, far };
  tiles.set(size, out);
  return out;
}

// sampling the tile (needs CROWN_GLSL's crownNoise, and uCanopy and uCanopyH declared): two copies of it, the second
// turned and shifted, mixed by a slow noise so the repeat never shows
export const CANOPY_TEX_GLSL = /* glsl */`
const mat2 CANOPY_TURN = mat2(0.8, 0.6, -0.6, 0.8);
float canopyMix(vec2 p) { return smoothstep(0.32, 0.68, crownNoise(p / 47.0)); }
vec2 canopyUv2(vec2 uv) { return CANOPY_TURN * uv * 1.13 + vec2(0.37, 0.61); }
vec3 canopyColour(vec2 p, float k) {
  vec2 uv = p / ${CANOPY_TILE.toFixed(1)};
  return mix(texture2D(uCanopy, uv).rgb, texture2D(uCanopy, canopyUv2(uv)).rgb, k);
}
float canopyHeight(vec2 p, float k) {
  vec2 uv = p / ${CANOPY_TILE.toFixed(1)};
  return mix(texture2D(uCanopyH, uv).r, texture2D(uCanopyH, canopyUv2(uv)).r, k);
}
// the crowns' relief (about 4 m from gap to top), as a world normal
vec3 canopyNormal(vec2 p, float k) {
  float e = 0.35;
  float h0 = canopyHeight(p, k);
  float hx = canopyHeight(p + vec2(e, 0.0), k), hz = canopyHeight(p + vec2(0.0, e), k);
  return normalize(vec3(-(hx - h0) * 4.0 / e, 1.0, -(hz - h0) * 4.0 / e));
}`;

export function canopyMaterial({ size = 1024, fadeFrom = 380, fadeTo = 1400 } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const { colour, height, far } = canopyTextures(size);
  m.userData.textures = [colour, height];
  // x, z of a camera at eye level and how far round it the blanket has sunk (0: not at all)
  const eye = { value: new THREE.Vector4(0, 0, 0, 0) };
  m.userData.eye = eye;
  m.onBeforeCompile = (s) => {
    s.uniforms.uCanopy = { value: colour };
    s.uniforms.uCanopyH = { value: height };
    s.uniforms.uCanopyFar = { value: far };
    s.uniforms.uCanopyEye = eye;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCanopyWorld;\nuniform vec4 uCanopyEye;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  // at eye level the blanket goes under the ground round the camera, and rises again beyond the near trees
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float dEye = length(wp.xz - uCanopyEye.xy);
  transformed.y -= 30.0 * (1.0 - smoothstep(uCanopyEye.z, uCanopyEye.z + 40.0, dEye)) * uCanopyEye.w;
}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCanopyWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCanopyWorld;\nuniform sampler2D uCanopy, uCanopyH;\nuniform vec3 uCanopyFar;\n${CROWN_GLSL}\n${CANOPY_TEX_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float crownDist = length(vCanopyWorld - cameraPosition);
float crownFade = 1.0 - smoothstep(${fadeFrom.toFixed(1)}, ${fadeTo.toFixed(1)}, crownDist);
vec2 cp = vCanopyWorld.xz;
float cmix = canopyMix(cp);
vec3 crownC = canopyColour(cp, cmix);
// broad species patches: chestnut yellow-green, oak, darker hornbeam; and slow lighter and darker swathes
float patchN = crownNoise(cp / 140.0) * 0.7 + crownNoise(cp / 37.0) * 0.3;
vec3 patchTint = patchN < 0.42 ? vec3(1.07, 1.05, 0.86) : patchN < 0.7 ? vec3(1.0) : vec3(0.86, 0.93, 0.92);
patchTint = mix(patchTint, vec3(1.0), 0.35 * smoothstep(0.0, 0.08, abs(patchN - 0.42)) * smoothstep(0.0, 0.08, abs(patchN - 0.7)));
float swathe = 0.86 + 0.28 * crownNoise(cp / 75.0 + 9.0);
diffuseColor.rgb *= mix(uCanopyFar, crownC, crownFade) * patchTint * swathe * 2.2;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  normal = normalize(mix(normal, normalize(mat3(viewMatrix) * canopyNormal(cp, cmix)), 0.85 * crownFade));
}`);
  };
  m.customProgramCacheKey = () => 'villas-canopy-3';
  return m;
}

// The blanket's shadow: crowns, with the sun let through where two small crowns leave a gap (flecks of sun on the
// woods' floor and on the trunks round a camera at eye level). `edge`: the ragged line past which it casts nothing.
export function canopyDepthMaterial({ size = 6.4 } = {}) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.BackSide });
  d.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCanopyXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCanopyXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vCanopyXZ;\n${CROWN_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float edgeR = max(abs(vCanopyXZ.x), abs(vCanopyXZ.y));
  float ragged = 400.0 + 45.0 * sin(vCanopyXZ.x * 0.031 + 1.3) * sin(vCanopyXZ.y * 0.027 + 0.4) + 25.0 * sin((vCanopyXZ.x + vCanopyXZ.y) * 0.07);
  if (edgeR > ragged) discard;
  {
    float id, rad;
    vec4 cr = canopyCrowns(vCanopyXZ, ${size.toFixed(2)}, id, rad);
    if (cr.x > rad * 0.96 && crownNoise(vCanopyXZ / 7.0 + id) > 0.38) discard;
  }`);
  };
  d.customProgramCacheKey = () => 'villas-canopy-depth-2';
  return d;
}
