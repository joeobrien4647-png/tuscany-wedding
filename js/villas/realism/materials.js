// Every named material in api.js's MATERIALS, made real: content builds with names, realism paints them.
// Geometry UVs are in metres (util.worldUV, util.slopeUV for roofs); each texture repeats over its painter's `tile`
// metres, and material.userData.tile says how many. Fast uses Lambert (normal maps on the stone, tiles and paving);
// Balanced and Best use Standard with roughness and metalness, lit by the sky probe and, where set, the scene's
// environment. Window glass mirrors the sky at a glancing angle and, from 20:30 to 22:00, lights from inside in the
// order of its `lightSeed` attribute, warm and uneven. Lamps, candles, fire and paper lanterns glow by themselves
// after dusk. Stone mixes two scales of its own texture so the repeat does not show.
import * as THREE from '../vendor/three-core.js';
import { MATERIALS } from '../api.js';
import { SKY_GLSL } from './skydome.js';
import { waterMaterial } from './water.js';
import { normalFromHeight } from '../textures.js';
import * as P from './painters.js';
import { smoothstep } from '../util.js';

const WINDOWS_FROM = 1230, WINDOWS_TO = 1320;   // 20:30 to 22:00: the order windows light up in

// name -> how to make it: a painter (returning { c, h, tile, relief }), surface properties, or a special kind
const RECIPES = {
  'stone.santarsa': { paint: () => P.rubble({ palette: ['#a69a86', '#b8955f', '#9c6b45', '#8e8b83', '#a89c88', '#b3a58e', '#a69a86'], mortar: '#d4cab6', tile: 2.4, seed: 31 }), rough: 0.92, blend: true },
  'stone.dressed': { paint: () => P.coursed({ palette: ['#c8a676', '#b99363', '#d2b98c', '#bf9d6c', '#a98a62', '#cdb083', '#b8a07a'], mortar: '#bba987', tile: 2.4 }), rough: 0.9, blend: true },
  'stone.vallorsaia': { paint: () => P.rubble({ palette: ['#938d80', '#a8916c', '#7d776c', '#a39c8c', '#8b8475', '#9a8a70'], mortar: '#aea38c', pinning: 0.55, brick: 0.03, tile: 2.4, courses: 9, seed: 37 }), rough: 0.93, blend: true },
  'stone.dry': { paint: () => P.rubble({ palette: ['#9a9286', '#8d8579', '#a59b8a', '#7f786e', '#958a76'], mortar: '#5a5244', dry: true, tile: 2.2, seed: 43 }), rough: 0.95, blend: true },
  'stone.sandstone': { paint: () => P.grain({ base: '#c9b08a', mottle: 0.08, tile: 1.2, seed: 72 }), rough: 0.88 },
  'stone.pietra': { paint: () => P.grain({ base: '#8f9190', mottle: 0.05, tile: 1.0, seed: 73 }), rough: 0.8 },
  'flag.crazy': { paint: () => P.crazy({ palette: ['#c4bba7', '#bcb19c', '#b0a68f', '#c9c0ab', '#a89f8b', '#cdc3ad', '#b8ae98'], joint: '#6f6858', tile: 3.2 }), rough: 0.85 },
  'flag.interior': { paint: () => P.slabs({ base: '#979a9d', joint: '#6e7072', rows: 3, cols: 2, jitter: 0.1, tile: 2.0, seed: 63 }), rough: 0.7 },
  'slab.grey': { paint: () => P.slabs({ base: '#a9a69f', joint: '#7d7a73', tile: 2.4 }), rough: 0.85 },
  'coping.pale': { paint: () => P.grain({ base: '#e8e4dc', tile: 1, seed: 74 }), rough: 0.7 },
  coppi: { paint: () => P.coppi({ palette: ['#b85e3c', '#9f4a33', '#c87a4a', '#7d6352', '#b06a45', '#8f5a42', '#a8684a', '#76523e', '#c2724a'] }), rough: 0.85, side: THREE.DoubleSide, weathered: true },
  brick: { paint: () => P.brick({}), rough: 0.9 },
  firebrick: { paint: () => P.brick({ base: '#e2d3b8', mortar: '#cdbfa4', seed: 22 }), rough: 0.9 },
  soot: { paint: () => P.grain({ base: '#2b2623', light: 0.2, seed: 75 }), rough: 1 },
  plaster: { paint: () => P.grain({ base: '#f2ede3', mottle: 0.04, alpha: 0.05, seed: 76 }), rough: 0.95 },
  'timber.dark': { paint: () => P.planks({ base: '#4a3424', boardW: 0.24, seed: 11 }), rough: 0.8 },
  'timber.walnut': { paint: () => P.planks({ base: '#4a3423', boardW: 0.12, tile: 1.2, seed: 12 }), rough: 0.7 },
  'timber.honey': { paint: () => P.planks({ base: '#9a6b40', boardW: 0.15, tile: 0.9, seed: 13, joints: false }), rough: 0.75 },
  'timber.rough': { paint: () => P.planks({ base: '#7d6a52', boardW: 0.2, grain: 1, seed: 14 }), rough: 0.95 },
  'timber.oak': { paint: () => P.planks({ base: '#b08d63', boardW: 0.2, seed: 15 }), rough: 0.7 },
  cotto: { paint: () => P.squares({ base: '#b4683f', joint: '#8a5a40', n: 4, tile: 1.2, jitter: 0.12 }), rough: 0.8 },
  'boards.dark': { paint: () => P.planks({ base: '#4b3424', boardW: 0.2, tile: 2, seed: 16 }), rough: 0.6 },
  iron: { colour: '#1f1f1f', rough: 0.55, metal: 0.6 },
  copper: { colour: '#9c5a34', rough: 0.45, metal: 0.65 },
  'tile.pool': { colour: '#5fb3c2', rough: 0.35 },
  'iron.rust': { paint: () => P.grain({ base: '#6b4a35', mottle: 0.12, tile: 0.8, seed: 77 }), rough: 0.7, metal: 0.4 },
  steel: { colour: '#dde1e3', rough: 0.22, metal: 0.75 },
  aluminium: { colour: '#d9d9d6', rough: 0.4, metal: 0.7 },
  'sling.teal': { paint: () => P.weave({ base: '#3e9a8c', tile: 0.5, threads: 10, contrast: 0.05, seed: 82 }), rough: 0.8 },
  'canvas.ecru': { paint: () => P.weave({ base: '#e8dfcb', tile: 0.2, contrast: 0.04, seed: 83 }), rough: 0.95 },
  'fabric.taupe': { paint: () => P.weave({ base: '#8d8377', tile: 0.2, contrast: 0.06, seed: 84 }), rough: 0.95 },
  'fabric.stripe': { paint: () => P.stripes({ colours: ['#c8622b', '#a84f2e', '#2c3550', '#5a3a4a', '#d8c3a0'] }), rough: 0.95 },
  'fabric.check': { paint: () => P.check({ colours: ['#7a2b33', '#8a8886', '#ece4d2'] }), rough: 0.95 },
  linen: { paint: () => P.weave({ base: '#f3efe6', tile: 0.15, contrast: 0.03, seed: 85 }), rough: 0.95 },
  rush: { paint: () => P.weave({ base: '#c4a46a', tile: 0.18, threads: 14, contrast: 0.16, seed: 86 }), rough: 0.9 },
  'paint.white': { colour: '#f1efe9', rough: 0.6 },
  leaf: { colour: '#5f7d3c', rough: 0.8 },
  'flower.red': { colour: '#c23a2e', rough: 0.8 },
  'flower.white': { colour: '#f4f1ea', rough: 0.8 },
  'flower.pink': { colour: '#e7a3a8', rough: 0.8 },
  deer: { colour: '#7a5a3e', rough: 0.9 },
  'glass.window': { kind: 'glass' },
  'glass.clear': { kind: 'glass', clear: true },
  'water.pool': { kind: 'water' },
  'lamp.warm': { kind: 'emissive', day: 0.35, night: 3.2 },
  candle: { kind: 'emissive', day: 0.25, night: 2.4 },
  fire: { kind: 'emissive', day: 1.2, night: 3.5 },
  'paper.lantern': { kind: 'emissive', day: 0.85, night: 2.2 },
  'ui.highlight': { kind: 'highlight' },
  ghost: { kind: 'ghost' },
  'ghost.glow': { kind: 'emissive', day: 0.6, night: 1.05 },
  'car.body': { colour: '#ffffff', rough: 0.45 },
};

// the weekend's sketch material (ghost.js), loaded when the weekend asks (ready)
let ghostMaterial = null;

const BLEND_GLSL = /* glsl */`
float matHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float matNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(matHash(i), matHash(i + vec2(1.0, 0.0)), u.x), mix(matHash(i + vec2(0.0, 1.0)), matHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

// Every surface gets this one shader (Standard on Balanced and Best, Lambert on Fast), with two switches as uniforms: the repeat
// hidden (the texture at its own scale blended with itself at a slightly larger one, by a slow noise; stone) and old
// roofs (across a whole roof, patches of darker, browner tiles and grey-green lichen, at a scale of metres the painted
// tile cannot hold; UVs are in metres times the repeat). One program per mix of maps, side and instancing, where
// separate shaders made one each. The retaining walls (walls.js) use it too.
export function surfaceShader(m, { blend = 0, weather = 0, tile = 1 } = {}) {
  m.userData.surface = { uMatBlend: { value: blend }, uMatWeather: { value: weather }, uMatTile: { value: tile } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, m.userData.surface);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uMatBlend, uMatWeather, uMatTile;\n${BLEND_GLSL}`)
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  float matMix = smoothstep(0.3, 0.7, matNoise(vMapUv * 0.37 + 3.1)) * uMatBlend;
  vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map, vMapUv * 0.78 + vec2(0.37, 0.71)), matMix);
  diffuseColor *= sampledDiffuseColor;
  if (uMatWeather > 0.5) {
    vec2 rm = vMapUv * uMatTile;
    float big = matNoise(rm / 4.5 + 2.3), mid = matNoise(rm / 1.4 + 7.1);
    diffuseColor.rgb *= mix(vec3(0.74, 0.7, 0.68), vec3(1.05, 1.0, 0.95), smoothstep(0.25, 0.75, big * 0.7 + mid * 0.3));
    float lichen = smoothstep(0.68, 0.82, matNoise(rm / 0.9 + 13.0)) * smoothstep(0.35, 0.6, big);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.42, 0.33), lichen * 0.45);
  }
#endif`);
  };
  m.customProgramCacheKey = () => 'villas-surface';
}

const PLAIN_ON_BALANCED = new Set(['linen', 'fabric.check', 'fabric.taupe', 'fabric.stripe', 'canvas.ecru', 'sling.teal', 'rush']);
function averageColour(canvas) {
  const c = new THREE.Color();
  try {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 64) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    c.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch { c.set('#cccccc'); }
  return c;
}

export function createMaterials({ tier = 'fast', sky = null, size } = {}) {
  const standard = tier !== 'fast';
  P.setPainterSize(size || (tier === 'best' ? 512 : 256));
  const cache = new Map();
  const shared = {
    windows: { value: 0 }, night: { value: 0 },
    glow: { value: new THREE.Color('#ffb15e') },
  };
  const emissives = [];

  function texturesFor(r) {
    const out = r.paint();
    const repeat = 1 / out.tile;
    const map = new THREE.CanvasTexture(out.c);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = standard ? 8 : 4;
    map.repeat.set(repeat, repeat);
    let normalMap = null;
    if (out.h && out.relief) {
      normalMap = new THREE.CanvasTexture(normalFromHeight(out.h, out.relief * 2.4, Math.min(out.h.width, 256)));
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      normalMap.repeat.set(repeat, repeat);
      normalMap.anisotropy = map.anisotropy;
    }
    return { map, normalMap, tile: out.tile };
  }

  function surface(name, r) {
    const tex = r.paint ? texturesFor(r) : null;
    const params = { color: r.colour || '#ffffff', side: r.side ?? THREE.FrontSide };
    if (tex) { params.map = tex.map; if (tex.normalMap && (standard || r.blend || name === 'coppi' || /flag|slab|cotto/.test(name))) params.normalMap = tex.normalMap; }
    const m = standard
      ? new THREE.MeshStandardMaterial({ ...params, roughness: r.rough ?? 0.85, metalness: r.metal ?? 0 })
      : new THREE.MeshLambertMaterial(params);
    if (params.normalMap) m.normalScale.set(1, -1);
    surfaceShader(m, { blend: r.blend && tex ? 1 : 0, weather: r.weathered && tex ? 1 : 0, tile: tex?.tile ?? 1 });
    // shiny metal mirrors the filmed sky (Best only: on Balanced the environment's two extra programs and the metal
    // variants are not worth it, and metal there is less metallic so it does not go dark)
    if (tier === 'best' && (r.metal ?? 0) > 0.3 && sky?.environment) m.envMap = sky.environment;
    else if (standard && (r.metal ?? 0) > 0.3) m.metalness = Math.min(m.metalness, 0.35);
    // Balanced: the small fabrics are plain colour (their weave only shows close up, and each map is a program)
    if (tier === 'balanced' && PLAIN_ON_BALANCED.has(name) && m.map) { m.color.copy(averageColour(m.map.image)); m.map = null; m.normalMap = null; }
    m.userData.tile = tex?.tile ?? 1;
    return m;
  }

  // Window glass: dark, mirroring the sky more as you look along it; at night a warm, uneven glow from inside.
  function glass(name, r) {
    const m = standard
      ? new THREE.MeshStandardMaterial({ color: r.clear ? '#9fb3b8' : '#20282b', roughness: 0.08, metalness: 0 })
      : new THREE.MeshLambertMaterial({ color: r.clear ? '#9fb3b8' : '#20282b' });
    if (r.clear) Object.assign(m, { transparent: true, opacity: 0.35, depthWrite: false });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, sky?.uniforms || {});
      s.uniforms.uWindows = shared.windows;
      s.uniforms.uGlowColour = shared.glow;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float lightSeed;\nvarying float vSeed;\nvarying vec3 vGlassWorld;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvSeed = lightSeed;\nvGlassWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>\n${sky ? SKY_GLSL : ''}\nuniform float uWindows;\nuniform vec3 uGlowColour;\nvarying float vSeed;\nvarying vec3 vGlassWorld;\n${BLEND_GLSL}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${r.clear ? '' : `{
  float on = smoothstep(vSeed * 0.92, vSeed * 0.92 + 0.06, uWindows);
  // a lamp somewhere in the room: brighter low down and to one side, never a flat pane
  float uneven = 0.55 + 0.45 * matNoise(vGlassWorld.xz * 1.3 + vGlassWorld.y * 2.1) - 0.25 * smoothstep(0.0, 1.2, fract(vGlassWorld.y * 0.6));
  totalEmissiveRadiance += uGlowColour * on * uneven * 2.2;
}`}`)
        .replace('#include <opaque_fragment>', `${sky ? `{
  vec3 gv = normalize(vGlassWorld - cameraPosition);
  vec3 gn = normalize(inverseTransformDirection(normal, viewMatrix));
  vec3 gr = reflect(gv, gn);
  float fres = ${r.clear ? '0.04' : '0.12'} + ${r.clear ? '0.96' : '0.88'} * pow(1.0 - abs(dot(-gv, gn)), 5.0);
  ${r.clear ? '' : `// by day, a dim room behind the glass: a darker floor, a lighter far wall, never a flat black pane
  {
    float dayIn = clamp(uSunDir.y * 3.0 + 0.2, 0.0, 1.0);
    float roomY = gv.y + 0.35 * (matNoise(vGlassWorld.xz * 0.6 + vGlassWorld.y) - 0.5);
    outgoingLight += mix(vec3(0.03, 0.026, 0.022), vec3(0.12, 0.1, 0.08), smoothstep(-0.45, 0.25, roomY)) * dayIn * (1.0 - smoothstep(0.0, 0.4, length(totalEmissiveRadiance)));
  }`}
  outgoingLight = mix(outgoingLight, skyColour(gr) * ${r.clear ? '1.0' : '0.8'}, fres * ${r.clear ? '0.6' : '0.62'} * (1.0 - 0.8 * smoothstep(0.0, 0.4, length(totalEmissiveRadiance))));
}` : ''}
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `villas-glass-${r.clear ? 1 : 0}-${standard ? 1 : 0}`;
    return m;
  }

  function emissive(name, r) {
    const base = new THREE.Color(MATERIALS[name].colour);
    const m = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(r.day) });
    m.userData.base = base;
    m.userData.levels = r;
    emissives.push(m);
    return m;
  }

  function make(name) {
    const r = RECIPES[name];
    if (!r) return new THREE.MeshLambertMaterial({ color: MATERIALS[name].colour });
    if (r.kind === 'glass') return glass(name, r);
    if (r.kind === 'water') return sky ? waterMaterial(sky, { pool: true }) : new THREE.MeshLambertMaterial({ color: MATERIALS[name].colour });
    if (r.kind === 'emissive') return emissive(name, r);
    if (r.kind === 'ghost') return ghostMaterial ? ghostMaterial() : new THREE.MeshLambertMaterial({ color: MATERIALS[name].colour });
    if (r.kind === 'highlight') return new THREE.MeshBasicMaterial({ color: MATERIALS[name].colour, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    return surface(name, r);
  }

  function setTime({ minutes, night }) {
    shared.windows.value = smoothstep(WINDOWS_FROM, WINDOWS_TO, minutes ?? 0);
    shared.night.value = night;
    emissives.forEach((m) => {
      const { day, night: atNight } = m.userData.levels;
      m.color.copy(m.userData.base).multiplyScalar(day + (atNight - day) * night);
    });
    // the pools light up by themselves at dusk (their lamps under the water)
    const poolGlow = smoothstep(0.12, 0.7, night ?? 0);
    cache.forEach((m) => { if (m.uniforms?.uGlow) m.uniforms.uGlow.value = poolGlow; });
  }
  sky?.onChange?.((s) => setTime(s));
  if (sky?.state) setTime(sky.state);

  return {
    get(name) {
      if (!(name in MATERIALS)) throw new Error(`materials: there is no material called ${name}`);
      if (!cache.has(name)) {
        const m = make(name);
        m.name = name;
        cache.set(name, m);
      }
      return cache.get(name);
    },
    names: Object.keys(MATERIALS),
    ready: () => (ghostMaterial ? Promise.resolve() : import('./ghost.js').then((m) => { ghostMaterial = m.ghostMaterial; })),
    setTime,
    dispose() { cache.forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); }); cache.clear(); },
  };
}
