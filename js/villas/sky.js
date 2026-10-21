// Sun, sky, air and night for La Conca on the wedding day, after mill-lane-home's lighting.js.
// The sun is the real one for any minute of Saturday 29 May 2027 (NOAA, realism/sun.js), so time can be scrubbed
// from 05:00 to midnight; the sky's own light reaches everything through a LightProbe (realism/skylight.js); the air
// thickens towards the valley and glows towards the sun (realism/air.js); the dome has clouds, the Belt of Venus,
// stars and the Milky Way (realism/skydome.js).
import * as THREE from './vendor/three-core.js';
import { acesInverse, aces } from './tonemap.js';
import { tween, ease, smoothstep, skyDir, clamp, reducedMotion } from './util.js';
import { solarPosition, equatorialToHorizon, GALACTIC } from './realism/sun.js';
import { installAir, AIR } from './realism/air.js';
import { createDome, domeUniforms } from './realism/skydome.js';
import { createSkyLight } from './realism/skylight.js';

export { SKY_GLSL } from './realism/skydome.js';

const DATE = '2027-05-29';
const UTC_OFFSET = 120;   // CEST
const DAY_START = 300, DAY_END = 1440;

// The three moments of v1's toggle, now minutes on the real day: mid-afternoon, golden hour, and after dark.
export const MOMENTS = {
  day: { label: 'Day', time: '15:30', at: 930 },
  sunset: { label: 'Sunset', time: '20:00', at: 1200 },
  night: { label: 'Night', time: '22:30', at: 1350 },
};

export const phaseOf = (el) => (el >= 6 ? 'day' : el >= -0.833 ? 'golden' : el >= -6 ? 'blue' : 'night');
const toMinutes = (t) => (typeof t === 'number' ? t : (([h, m = 0]) => h * 60 + m)(String(t).split(':').map(Number)));

// Display colours keyed by the sun's height (degrees), warmed for a Tuscan evening.
const SKY_KEYS = [
  { alt: -18, top: '#071027', horizon: '#111b33', ground: '#0a0f1b' },
  { alt: -12, top: '#0b1634', horizon: '#1b2744', ground: '#0f1526' },
  { alt: -8, top: '#13214a', horizon: '#34405f', ground: '#1a2033' },
  { alt: -4, top: '#24376a', horizon: '#7b6a80', ground: '#363a4e' },
  { alt: -1, top: '#36528a', horizon: '#d2906f', ground: '#5b5559' },
  { alt: 1.5, top: '#4769a2', horizon: '#eda774', ground: '#7a7266' },
  { alt: 4, top: '#567cb2', horizon: '#f1bb86', ground: '#90896f' },
  { alt: 8, top: '#6189bf', horizon: '#ecd0a8', ground: '#a29c80' },
  { alt: 14, top: '#6a95c9', horizon: '#dfdcc8', ground: '#aea98f' },
  { alt: 30, top: '#6497ce', horizon: '#d4e0e6', ground: '#b5bcb4' },
  { alt: 65, top: '#5a90cc', horizon: '#cbdbe8', ground: '#b5bcb4' },
];
const SUN_KEYS = [
  { alt: -1, color: '#ff6e36', intensity: 0 },
  { alt: 1, color: '#ff8746', intensity: 1.3 },
  { alt: 3, color: '#ff9c58', intensity: 2.2 },
  { alt: 6, color: '#ffb46e', intensity: 2.8 },
  { alt: 12, color: '#ffcf9e', intensity: 3.1 },
  { alt: 25, color: '#ffe5c8', intensity: 3.4 },
  { alt: 50, color: '#fff2e2', intensity: 3.6 },
  { alt: 70, color: '#fff6ec', intensity: 3.7 },
];
// exposure; the sky light's gain; a cool fill (starlight and sky glow) that keeps night readable; cloud cover
const AMBIENT_KEYS = [
  { alt: -18, exposure: 1.5, gain: 1.0, fill: '#3c4c7c', fillI: 0.62, cloud: 0.18 },
  { alt: -10, exposure: 1.42, gain: 1.0, fill: '#46578c', fillI: 0.5, cloud: 0.2 },
  { alt: -5, exposure: 1.28, gain: 1.1, fill: '#56628e', fillI: 0.16, cloud: 0.24 },
  { alt: 0, exposure: 1.16, gain: 1.25, fill: '#8a7a8c', fillI: 0.04, cloud: 0.28 },
  { alt: 6, exposure: 1.08, gain: 1.3, fill: '#000000', fillI: 0, cloud: 0.3 },
  { alt: 14, exposure: 1.02, gain: 1.25, fill: '#000000', fillI: 0, cloud: 0.32 },
  { alt: 30, exposure: 0.98, gain: 1.15, fill: '#000000', fillI: 0, cloud: 0.34 },
  { alt: 65, exposure: 0.97, gain: 1.1, fill: '#000000', fillI: 0, cloud: 0.32 },
];
const GROUND_ALBEDO = new THREE.Color('#5e6a3c');   // the woods and meadows round the villas, for the bounce

const ta = new THREE.Color(), tb = new THREE.Color();
function sample(keys, alt, field, out) {
  const i = keys.findIndex((k) => k.alt >= alt);
  const hi = i === -1 ? keys[keys.length - 1] : keys[i];
  const lo = i <= 0 ? hi : keys[i - 1];
  const t = hi === lo ? 0 : (alt - lo.alt) / (hi.alt - lo.alt);
  const a = lo[field], b = hi[field];
  if (typeof a === 'number') return a + (b - a) * t;
  return out.copy(ta.set(a)).lerp(tb.set(b), t);
}

const placeOf = (model) => ({ lat: model.origin.lat, lon: model.origin.lon });

// The sun's bearing and height (degrees) at a time ('HH:MM' or minutes after midnight) on the wedding day.
export function sunAt(model, time) {
  const p = solarPosition(placeOf(model), model.sun?.date || DATE, toMinutes(time), UTC_OFFSET);
  return { az: p.az, el: p.el };
}

export function createSky(scene, renderer, model, { tier = 'fast' } = {}) {
  installAir();
  const place = placeOf(model);
  let date = model.sun?.date || DATE;   // api.date moves it (the weekend)
  const uniforms = {
    uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() }, uSkyGround: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunGlow: { value: 1 },
  };
  const dU = { ...uniforms, ...domeUniforms() };
  const dome = createDome(dU, { octaves: tier === 'fast' ? 2 : 4 });
  scene.add(dome);
  // The dome is drawn first in every render of the scene (live view, snippets, Best's passes), so per-camera work
  // such as the woods' culling hangs off it and always sees the camera about to be used.
  const preRender = new Set();
  dome.onBeforeRender = (r, s, camera) => { if (api.hooksOn) preRender.forEach((fn) => fn(camera)); };

  const town = model.landmarks?.find((l) => l.id === 'sansepolcro')?.local;
  if (town) dU.uTownDir.value.set(town[0], 0, town[1]).normalize();

  scene.fog = new THREE.FogExp2(0xffffff, 1.7e-4);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const mapSize = tier === 'best' ? 4096 : 2048;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target);
  const skyLight = createSkyLight();
  scene.add(skyLight.probe);

  // Reflections for shiny surfaces on Balanced and Best (metal, steel, glass): the dome filmed into a small cube when
  // the sun rests, never while it is moving. Rough surfaces take the sky only through the probe, so nothing is lit
  // twice. Made on first request (sky.environment) and only off Fast.
  let skyTier = tier, env = null;
  const tierListeners = new Set();
  function ensureEnv() {
    if (env || skyTier === 'fast') return env;
    const skyScene = new THREE.Scene();
    const copy = new THREE.Mesh(dome.geometry, dome.material);
    copy.frustumCulled = false;
    skyScene.add(copy);
    const target = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType });
    env = { scene: skyScene, camera: new THREE.CubeCamera(1, 60000, target), target, due: true };
    return env;
  }
  function filmEnv() {
    const keep = [dU.uSunDisc.value, dU.uStars.value, dU.uMilky.value];
    dU.uSunDisc.value = 0; dU.uStars.value = 0; dU.uMilky.value = 0;
    env.camera.update(renderer, env.scene);
    [dU.uSunDisc.value, dU.uStars.value, dU.uMilky.value] = keep;
    env.due = false;
  }

  const state = { minutes: MOMENTS.sunset.at, az: 0, el: 30, night: 0, phase: 'golden', moment: 'sunset' };
  const listeners = new Set();
  let hdrFog = false;
  const horizon = new THREE.Color(), display = new THREE.Color(), glow = new THREE.Color(), tmp = new THREE.Color();
  const sunDir = new THREE.Vector3(), sunDirTrue = new THREE.Vector3();
  const sunCol = new THREE.Color(), fill = new THREE.Color();
  let shadowDirty = true, shadowAt = 0;

  function sunFor(minutes) {
    const p = solarPosition(place, date, minutes, UTC_OFFSET);
    return { az: p.az, el: p.el, jd: p.jd };
  }

  function apply() {
    const s = sunFor(state.minutes);
    state.az = s.az;
    state.el = s.el;
    const alt = s.el;
    state.phase = phaseOf(alt);
    skyDir(state.az, Math.max(alt, -4), sunDir);
    skyDir(state.az, alt, sunDirTrue);
    uniforms.uSunDir.value.copy(sunDirTrue);
    const exposure = sample(AMBIENT_KEYS, alt, 'exposure');
    renderer.toneMappingExposure = exposure;
    acesInverse(sample(SKY_KEYS, alt, 'top', display), exposure, uniforms.uSkyTop.value);
    sample(SKY_KEYS, alt, 'horizon', horizon);
    acesInverse(horizon, exposure, uniforms.uSkyHorizon.value);
    acesInverse(sample(SKY_KEYS, alt, 'ground', display), exposure, uniforms.uSkyGround.value);
    sample(SUN_KEYS, alt, 'color', sunCol);
    uniforms.uSunColor.value.copy(sunCol).multiplyScalar(smoothstep(-6, 2, alt));
    uniforms.uSunGlow.value = smoothstep(-8, 1, alt) * (1 - 0.6 * smoothstep(15, 50, alt));
    dU.uSunDisc.value = smoothstep(-1.2, 0.4, alt);
    state.night = smoothstep(1, -9, alt);
    dU.uNight.value = state.night;
    dU.uStars.value = smoothstep(-5, -13, alt);
    dU.uMilky.value = smoothstep(-13, -18, alt);
    dU.uTownGlow.value = 0.06 * smoothstep(-3, -12, alt);
    dU.uBelt.value = smoothstep(1.5, -0.5, alt) * (1 - smoothstep(-5, -8, alt));
    dU.uShadowTop.value = Math.max(0, -alt) * 0.85;
    const cover = sample(AMBIENT_KEYS, alt, 'cloud');
    dU.uCloudCover.value = cover;
    // the Belt of Venus: pink, a little warmer while the sun is just down
    acesInverse(tmp.set('#d79aa2').lerp(ta.set('#c8a0b8'), smoothstep(-1, -5, alt)), exposure, dU.uBeltColour.value).multiplyScalar(0.55);
    dU.uShadowColour.value.set(0.72, 0.76, 0.92);
    // clouds: warm white on the sun side, grey-blue underneath; pink and orange undersides round sunset, then dimming
    const day = smoothstep(-6, 4, alt);
    const dusk = smoothstep(-4, 1, alt) * (1 - smoothstep(6, 16, alt));
    tmp.set('#f6f2ea').lerp(ta.set('#ffb08a'), 0.75 * dusk).lerp(display.copy(sample(SKY_KEYS, alt, 'top', display)), 1 - day);
    tmp.multiplyScalar(1 - 0.45 * smoothstep(-4, -12, alt));   // moonless: the clouds go dark against the stars
    acesInverse(tmp, exposure, dU.uCloudLit.value);
    tmp.set('#a9b0ba').lerp(ta.set('#9a7f98'), 0.7 * dusk).multiplyScalar(0.5 + 0.45 * day);
    tmp.lerp(sample(SKY_KEYS, alt, 'top', display), 0.6 * (1 - day));
    tmp.multiplyScalar(1 - 0.45 * smoothstep(-4, -12, alt));
    acesInverse(tmp, exposure, dU.uCloudShade.value);
    // the Milky Way, where it really is in the sky that minute
    const pole = equatorialToHorizon(place, s.jd, GALACTIC.pole.ra, GALACTIC.pole.dec);
    const centre = equatorialToHorizon(place, s.jd, GALACTIC.centre.ra, GALACTIC.centre.dec);
    skyDir(pole.az, pole.el, dU.uGalPole.value);
    skyDir(centre.az, centre.el, dU.uGalCentre.value);

    sun.color.copy(sunCol);
    sun.intensity = sample(SUN_KEYS, alt, 'intensity');
    sample(AMBIENT_KEYS, alt, 'fill', fill).multiplyScalar(sample(AMBIENT_KEYS, alt, 'fillI'));
    skyLight.update({
      sky: { top: uniforms.uSkyTop.value, horizon: uniforms.uSkyHorizon.value, ground: uniforms.uSkyGround.value, sunDir: sunDirTrue, sunColor: uniforms.uSunColor.value, sunGlow: uniforms.uSunGlow.value, cover },
      sun: { color: sunCol, intensity: sun.intensity, el: alt },
      tint: 0.55, gain: sample(AMBIENT_KEYS, alt, 'gain'), fill, groundAlbedo: GROUND_ALBEDO,
    });
    applyAir();
    shadowDirty = true;
    if (env) env.due = true;
    listeners.forEach((fn) => fn(state));
  }

  // The haze's colour is the horizon's; its glow towards the sun matches the dome's. Fast mixes it after tone mapping
  // and sRGB (three converts fogColor itself), Best before (in OutputPass), so each gets the matching value.
  function applyAir() {
    const exposure = renderer.toneMappingExposure;
    const hdrHorizon = uniforms.uSkyHorizon.value;
    glow.copy(uniforms.uSunColor.value).multiplyScalar(0.3 * uniforms.uSunGlow.value);
    if (hdrFog) {
      scene.fog.color.copy(hdrHorizon);
      AIR.glow.x = glow.r; AIR.glow.y = glow.g; AIR.glow.z = glow.b;
    } else {
      scene.fog.color.copy(horizon);
      aces(tmp.copy(hdrHorizon).add(glow), exposure, ta).convertLinearToSRGB();
      tb.copy(horizon).convertLinearToSRGB();
      AIR.glow.x = Math.max(0, ta.r - tb.r); AIR.glow.y = Math.max(0, ta.g - tb.g); AIR.glow.z = Math.max(0, ta.b - tb.b);
    }
    AIR.sun.x = sunDir.x; AIR.sun.y = sunDir.y; AIR.sun.z = sunDir.z;
    AIR.sun.w = smoothstep(-6, 0, state.el);
    AIR.glow.w = 8;
  }

  let job = null;
  function setMinutes(minutes, { animate = false, duration = 2.4 } = {}) {
    const to = clamp(toMinutes(minutes), DAY_START, DAY_END);
    job?.cancel();
    job = null;
    if (!animate) { state.minutes = to; apply(); return Promise.resolve(); }
    const from = state.minutes;
    const j = tween({ duration, easing: ease.inOut, onUpdate: (e) => { state.minutes = from + (to - from) * e; apply(); } });
    job = j;
    j.then(() => { if (job === j) job = null; });
    return j;
  }

  function setMoment(name, { animate = true } = {}) {
    const m = MOMENTS[name];
    if (!m) return Promise.resolve();
    state.moment = name;
    return setMinutes(m.at, { animate });
  }

  // The shadow box follows what is in view; it is redrawn only when the view's focus or the sun moves, and at most
  // every 100 ms while the sun is moving.
  const lastFocus = new THREE.Vector3(1e9, 0, 0);
  let lastSize = 0;
  function fitShadow(focus, distance) {
    const size = Math.min(520, Math.max(16, distance * 0.62));
    const step = size * 0.08;
    if (focus.distanceTo(lastFocus) < step && Math.abs(size - lastSize) / size < 0.15) return;
    lastFocus.copy(focus);
    lastSize = size;
    const cam = sun.shadow.camera;
    Object.assign(cam, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 2400 });
    cam.updateProjectionMatrix();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 1200);
    sun.target.updateMatrixWorld();
    sun.shadow.normalBias = 0.02 + size * 0.0012;
    sun.shadow.needsUpdate = true;
    shadowDirty = false;
    shadowAt = performance.now();
  }

  let clockAt = 0;
  function update(camera) {
    dome.position.copy(camera.position);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 1200);
    const now = performance.now();
    if (shadowDirty && now - shadowAt >= 100) { sun.shadow.needsUpdate = true; shadowDirty = false; shadowAt = now; }
    // clouds drift only while frames are drawn, and not at all with reduced motion
    const dt = clockAt ? Math.min(0.1, (now - clockAt) / 1000) : 0;
    clockAt = now;
    if (!reducedMotion) dU.uTime.value += dt;
    if (env?.due && !job) filmEnv();
  }

  const api = {
    hooksOn: true,
    mirrorHide: new Set(),   // what the pool's mirror leaves out (realism/water.js)
    mirrorLod: new Map(),    // meshes the mirror draws with a lighter geometry: mesh -> geometry (realism/water.js)
    get tier() { return skyTier; },
    uniforms, dome, sun, probe: skyLight.probe, state, setMoment, setMinutes, fitShadow,
    sunAt: (minutes) => { const s = sunFor(toMinutes(minutes)); return { az: s.az, el: s.el }; },
    get date() { return date; },
    setDate(d) { if (!/^\d{4}-\d\d-\d\d$/.test(d) || d === date) return; date = d; apply(); },
    setHdrFog(on) { hdrFog = !!on; applyAir(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refreshShadow() { sun.shadow.needsUpdate = true; shadowDirty = false; shadowAt = performance.now(); },
    update,
    beforeRender(fn) { preRender.add(fn); return () => preRender.delete(fn); },
    // the pipeline says when the level changes (Auto's step-up, a drop, the menu); the ground listens
    setTier(t) { if (t === skyTier) return; skyTier = t; tierListeners.forEach((fn) => fn(t)); },
    onTierChange(fn) { tierListeners.add(fn); return () => tierListeners.delete(fn); },
    get environment() { return ensureEnv()?.target.texture ?? null; },
    get moment() { return state.moment; },
  };
  return api;
}
