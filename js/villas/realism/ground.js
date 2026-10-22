// The ground's material: the painted map (realism/land.js) near the villas, the far terrain's colours beyond it,
// and close up the detail a 1.2 m texel cannot hold: clumps of greener and yellower grass, blades that catch the
// sun, grit in the gravel. Everything is computed from world position, so nothing tiles and nothing is an image.
import * as THREE from '../vendor/three-core.js';
import { CROWN_GLSL, CANOPY_TEX_GLSL, canopyTextures } from './canopy.js';

export const NOISE_GLSL = /* glsl */`
float gHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

export function groundMaterial({ land, detail, half = 600, offset = false, fine = true, canopySize = 1024 }) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const woods = canopyTextures(canopySize);
  if (offset) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLand = { value: land };
    s.uniforms.uDetail = { value: detail };
    s.uniforms.uCanopy = { value: woods.colour };
    s.uniforms.uCanopyH = { value: woods.height };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGround;
uniform sampler2D uLand, uDetail, uCanopy, uCanopyH;
${NOISE_GLSL}
${CROWN_GLSL}
${CANOPY_TEX_GLSL}
float groundFine, groundGrass, groundEdge;
vec2 groundTilt;
vec3 groundCrownN = vec3(0.0);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 uv = (vGround.xz + ${half.toFixed(1)}) / ${(2 * half).toFixed(1)};
  float edge = max(abs(vGround.x), abs(vGround.z));
  float near = 1.0 - smoothstep(${(half - 50).toFixed(1)}, ${(half - 8).toFixed(1)}, edge);
  vec3 land = texture2D(uLand, uv).rgb;
  float dist = length(vGround - cameraPosition);
  // Beyond the painted map: wooded hills with fields on the gentler, lower ground, in parcels with hedgerows between
  // them; the woods dark and mottled at a scale the eye can still see. Illustrative until real land cover (R-M3)
  // replaces it; past 16 km it gives way to the far terrain's own colours under the haze.
  float farW = (1.0 - near) * (1.0 - smoothstep(16000.0, 30000.0, dist));
  if (farW > 0.001) {
    vec3 fdn = normalize(cross(dFdx(vGround), dFdy(vGround)));
    float slope = 1.0 - abs(fdn.y);
    vec2 q = vGround.xz;
    float n1 = gNoise(q / 520.0), n2 = gNoise(q / 150.0 + 3.0);
    float valley = smoothstep(-250.0, -380.0, vGround.y);
    float open = smoothstep(0.52, 0.6, n1 * 0.65 + n2 * 0.35 + valley * 0.32 - slope * 1.5 - smoothstep(-320.0, -80.0, vGround.y) * 0.2);
    float m1 = gNoise(q / 21.0), m2 = gNoise(q / 75.0 + 9.0);
    float near3 = 1.0 - smoothstep(2500.0, 9000.0, dist);
    vec3 woodsC = vec3(0.1, 0.16, 0.055) * mix(1.0, 0.68 + 0.45 * m1 + 0.25 * m2, near3) * (0.85 + 0.3 * gNoise(q / 900.0));
    // the near part of the far woods (the estate view looks across them): the canopy's own painted crowns
    float crownNear = (1.0 - smoothstep(500.0, 1800.0, dist)) * (1.0 - open);
    if (crownNear > 0.0) {
      float ck = canopyMix(q);
      woodsC = mix(woodsC, canopyColour(q, ck) * 0.95, crownNear);
      groundCrownN = canopyNormal(q, ck) * crownNear * farW;
    }
    // each farm its own field pattern: the grid turns and changes size from one block of land to the next
    vec2 block = floor(q / 1300.0);
    float ang = gHash(block + 5.0) * 3.1416;
    float ca = cos(ang), sa = sin(ang);
    vec2 r = mat2(ca, -sa, sa, ca) * q;
    vec2 csize = vec2(110.0 + 140.0 * gHash(block + 11.0), 70.0 + 70.0 * gHash(block + 23.0));
    vec2 cell = r / csize;
    cell.x += floor(cell.y) * 0.37;
    vec2 cellId = floor(cell);
    float h1 = gHash(cellId), h2 = gHash(cellId + 17.0);
    // late May: hay meadows and young wheat in greens, a few parcels already yellowing, the odd ploughed one
    vec3 fieldC = mix(vec3(0.2, 0.3, 0.075), vec3(0.4, 0.38, 0.13), h1 * h1 * h1) * (0.85 + 0.3 * h2);
    fieldC = mix(fieldC, vec3(0.25, 0.21, 0.12), step(0.96, h2));
    vec2 fr = fract(cell);
    float hedge = 1.0 - smoothstep(0.0, 0.05, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)));
    fieldC = mix(fieldC, woodsC, hedge * 0.75 * near3);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(woodsC, fieldC, open), farW);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, land, near);
  // grass a touch less saturated than the paint: late-May hay and lawns in strong sun, not lime
  float grassMask = clamp((land.g - max(land.r, land.b)) * 9.0, 0.0, 1.0) * near;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.16 * grassMask);
  groundEdge = max(abs(vGround.x), abs(vGround.z)) - (520.0 + 40.0 * sin(vGround.x * 0.029 + 0.7) * sin(vGround.z * 0.023 + 1.9));
  groundGrass = clamp((land.g - max(land.r, land.b)) * 9.0, 0.0, 1.0);
  groundFine = ${fine ? '(1.0 - smoothstep(30.0, 170.0, dist)) * near' : '0.0'};
  groundTilt = vec2(0.0);
  if (groundFine > 0.0) {
    vec2 p = mat2(0.8, -0.6, 0.6, 0.8) * vGround.xz;
    float near2 = 1.0 - smoothstep(12.0, 55.0, dist);
    float clump = gNoise(p / 3.1) * 0.7 + (gNoise(p / 0.9 + 7.0) - 0.5) * 0.6 * near2 + 0.15 * (1.0 - near2);
    float grain = mix(0.5, texture2D(uDetail, p / 1.7).r, near2);
    vec3 grass = vec3(0.72 + 0.56 * clump) * (0.9 + 0.2 * grain) * mix(vec3(0.94, 1.0, 1.02), vec3(1.08, 1.04, 0.82), smoothstep(0.3, 0.7, clump));
    vec3 grit = vec3(0.88 + 0.24 * grain);
    float lum = dot(land, vec3(0.2126, 0.7152, 0.0722));
    // gravel, stone by stone: pebbles of a few centimetres with darker gaps, a few bigger stones, each its own shade
    float gravel = smoothstep(0.26, 0.4, lum) * (1.0 - groundGrass);
    if (gravel > 0.0) {
      float pebNear = 1.0 - smoothstep(4.0, 22.0, dist);
      float cid;
      vec4 peb = crowns(p / 0.042, cid);
      float stone = smoothstep(0.0, 0.2, peb.y - peb.x);
      float cid2;
      vec4 big = crowns(p / 0.13 + 3.7, cid2);
      float bigStone = step(0.88, cid2) * smoothstep(0.04, 0.22, big.y - big.x);
      vec3 pebble = vec3(0.88 + 0.24 * cid) * mix(vec3(1.0), vec3(1.03, 1.0, 0.93), step(0.7, fract(cid * 7.3))) * mix(0.86, 1.0, stone);
      pebble = mix(pebble, vec3(0.78 + 0.2 * cid2) * vec3(0.98, 0.99, 1.02), bigStone * 0.75);
      // and further off, the mottle of it: damp and dry patches, finer and coarser drifts
      float mottle = 0.9 + 0.2 * gNoise(p / 0.7) + 0.12 * (gNoise(p / 3.3 + 2.0) - 0.5);
      grit = mix(grit * mottle, pebble * (0.94 + 0.12 * grain), pebNear);
    }
    // the woods' floor: leaf litter in browns and olives, mossy patches, darker hollows
    float litter = smoothstep(0.12, 0.05, lum) * (1.0 - gravel);
    if (litter > 0.0) {
      float l1 = gNoise(p / 0.35), l2 = gNoise(p / 1.7 + 4.0), l3 = gNoise(p / 6.0 + 9.0);
      vec3 leafLit = mix(vec3(1.18, 0.98, 0.72), vec3(0.84, 1.08, 0.72), smoothstep(0.4, 0.75, l3)) * (0.78 + 0.34 * l1) * (0.86 + 0.24 * l2);
      grit = mix(grit, leafLit, litter);
      grass = mix(grass, leafLit, litter);
    }
    diffuseColor.rgb *= mix(vec3(1.0), mix(grit, grass, groundGrass), groundFine);
    groundTilt = (vec2(gNoise(p / 0.9 + vec2(7.3, 7.0)), gNoise(p / 0.9 + vec2(7.0, 7.3))) - gNoise(p / 0.9 + 7.0)) * groundGrass * groundFine * near2;
  }
}`)
      .replace('#include <lights_fragment_begin>', `
#ifdef USE_SHADOWMAP
  bool receiveShadow = groundEdge < 0.0;
#endif
#include <lights_fragment_begin>`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal - mat3(viewMatrix) * vec3(groundTilt.x, 0.0, groundTilt.y) * 3.0);
if (dot(groundCrownN, groundCrownN) > 0.0) normal = normalize(mix(normal, normalize(mat3(viewMatrix) * normalize(groundCrownN)), 0.6 * length(groundCrownN) / max(length(groundCrownN), 1e-3) * min(length(groundCrownN), 1.0)));`);
  };
  m.customProgramCacheKey = () => `villas-ground-${fine ? 1 : 0}`;
  return m;
}
