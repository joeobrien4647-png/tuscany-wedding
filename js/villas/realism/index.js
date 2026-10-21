// The realism track's installer (v2 spec, section 3): the renderer, the sky and the sun, the ground and the woods,
// the named materials and the graphics pipeline. The kernel (app.js) runs declare, build and ready for realism,
// content and experience in that order; this file imports only from api.js, util.js, vendor/ and realism's own files.
//   provides  sky, ground, materials, pipeline
//   writes    api.renderer, api.light (from the sun), api.tier (from the pipeline)
//   reads     api.time (the minute to show), api.date (the day), api.site (pads, clearings, specimen trees: read once, at build, after
//             every declare), api.emitters and api.layers (the night look of what content says gives light)
import * as THREE from '../vendor/three-core.js';
import { createSky } from '../sky.js';
import { buildGround } from '../terrain.js';
import { createPipeline, GRAPHICS_KEY, MODES } from '../render.js';
import { createMaterials } from './materials.js';

export function declare() {
  // realism's data credits beyond the page's static ones go here when the far landscape brings new sources (R-M3)
}

export async function build(api, { onProgress = () => {} } = {}) {
  const { stage, params, coarse, store, model, scene, camera } = api;
  const asked = params.get('graphics');
  const mode = MODES.includes(asked) ? asked : store?.get(GRAPHICS_KEY, 'auto') ?? 'auto';
  const startTier = mode === 'fast' || (mode === 'auto' && coarse) ? 'fast' : mode === 'balanced' ? 'balanced' : 'best';

  const renderer = new THREE.WebGLRenderer({ antialias: startTier === 'fast', powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = startTier === 'fast' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  renderer.domElement.className = 'vx-canvas';
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional model of the two villas. Drag to look around; pinch, or hold Control and scroll, to zoom.');
  renderer.domElement.setAttribute('role', 'img');
  stage.prepend(renderer.domElement);
  api.renderer = renderer;

  onProgress('Painting the sky');
  const sky = createSky(scene, renderer, model, { tier: startTier });
  sky.setDate(api.date.get());
  sky.setMinutes(api.time.get());
  api.time.on((m) => sky.setMinutes(m));
  api.date.on((d) => sky.setDate(d));
  const writeLight = (s) => api.light.set({ minutes: s.minutes, az: s.az, el: s.el, night: s.night, phase: s.phase });
  sky.onChange(writeLight);
  writeLight(sky.state);
  await frame();

  onProgress('Raising the hills');
  const ground = buildGround(model, sky, { tier: startTier, site: api.site, isLayerOn: (id) => api.layers.isOn(id) });
  scene.add(ground.group);
  // what content says gives light, now and as it changes (the wedding layer adds its own when first switched on)
  api.emitters.all().forEach((e) => ground.emitters.add(e));
  api.emitters.on((op, e) => (op === 'add' ? ground.emitters.add(e) : ground.emitters.remove(e.id)));
  api.layers.state.on(() => ground.emitters.refresh());
  await frame();

  const materials = createMaterials({ tier: startTier, sky });

  const pipeline = createPipeline({
    renderer, scene, camera, sky, mode, coarse,
    onTier: (t) => api.tier.set(t),
    onAutoDrop: () => api.tier.set('fast'),
  });
  api.tier.set(pipeline.tier);

  api.provide('sky', sky);
  api.provide('ground', ground);
  api.provide('materials', materials);
  api.provide('pipeline', {
    get renderer() { return renderer; },
    get mode() { return pipeline.mode; },
    get tier() { return pipeline.tier; },
    get fx() { return pipeline.fx; },       // Best's and Balanced's passes (tests look at the sun shafts)
    get lost() { return pipeline.lost; },   // the WebGL context is lost right now
    MODES,
    setMode(m) { pipeline.setMode(m); try { store?.set(GRAPHICS_KEY, pipeline.mode); } catch { /* private mode */ } },
    render: () => pipeline.render(),
    setSize: (w, h) => { renderer.setSize(w, h); pipeline.setSize(w, h); },
    pending: () => pipeline.pending(),
    ready: () => pipeline.ready(),          // Balanced's and Best's passes loaded (the kernel waits before frame one)
    info: () => pipeline.info(),
    photo: (opts) => pipeline.photo(opts),
    setNight: (n) => pipeline.setNight(n),
  });
  sky.onChange((s) => pipeline.setNight(s.night));
  pipeline.setNight(sky.state.night);

  // frame order (spec section 3): the sky and its shadow box, then the ground (water, sway, tufts, night) before the
  // render; the woods' culling, the fireflies and the tufts hang off the dome, so they see whichever camera draws
  api.loop.onFrame(({ t, camera: cam }) => {
    const focus = cam.userData.focus || cam.position;
    sky.fitShadow(focus, cam.position.distanceTo(focus));
    sky.update(cam);
    ground.update(t);
  }, { phase: 'pre' });
}

export function ready() {}

function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }
