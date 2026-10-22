// The experience track's installer (research/villas/v2-spec.md, section 9): how the explorer feels. The camera
// rig, navigation, cards, labels, search, the time bar, the weekend on the map, layers, the tour, share links, the
// minimap, tap to hop, and the lazy sound, photo mode, walk mode and weekend mode. Everything reads the registries: no place,
// note or card text lives here. Imports come from api.js, util.js, vendor/ and this folder only.
//
// The kernel (app.js) runs it after realism and content: build() makes the camera rig on the kernel's camera, the
// labels, v1's actions on the registries (nav.js, `base`) and the page's controls (ui.js), then everything v2 adds.
// The kernel hands over `snapshot(eye, { aspect })`, its snippet renderer.
import { PRESETS, toHHMM } from '../api.js';
import { createCameraRig } from '../camera.js';
import { createLabels } from '../labels.js';
import { createUI } from '../ui.js';
import { createNav } from './nav.js';
import { installTimebar } from './timebar.js';
import { installPins } from './pins.js';
import { installLayersUI } from './layers-ui.js';
import { installWeekend } from './weekend.js';
import { createSearch } from './search.js';
import { installShare } from './share.js';
import { installMinimap } from './minimap.js';
import { createTour } from './tour.js';
import { installHop } from './hop.js';
import { installOnboarding } from './onboarding.js';

const contexts = new WeakMap();

export function declare() {}

export async function build(api, { snapshot, onProgress } = {}) {
  const root = api.root;
  const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
  onProgress?.('Finding the paths');
  const ground = api.use('ground');
  const rig = api.provide('rig', createCameraRig(api.renderer, api.stage, { groundAt: ground.groundAt, camera: api.camera }));
  const labels = createLabels(api.labelsLayer, api.camera);
  const base = createNav(api, { rig, labels, snapshot });
  const ui = createUI(base, root, api);
  base.bindUI(ui);
  const ctx = { api, base, ui, labels, root, $, snapshot };
  contexts.set(api, ctx);

  const time = installTimebar(ctx);
  ctx.time = time;

  // ---------- nav: v1's actions, with the light on the clock ----------
  const v1Tour = base.tour;
  const v1Search = base.search;
  const v1Touring = Object.getOwnPropertyDescriptor(base, 'touring')?.get;
  let animatingTo = null;
  const momentLabel = (m) => { const k = time.presetAt(m); return k ? PRESETS[k].label : toHHMM(m); };

  async function refreshSnapshot() {
    const st = base.state, sel = st.selected;
    if (sel?.type !== 'place') return;
    const place = api.places.get(sel.id);
    const eye = place?.shots()?.eye;
    if (!eye) return;
    const snap = await base.snapshot(eye);
    if (base.state.selected === sel) ui.setSnapshot(snap, momentLabel(api.time.get()));
  }

  async function setMoment(name) {
    const p = PRESETS[name];
    if (!p) return;
    base.state.moment = name;
    animatingTo = name;
    ui.update(base.state);
    await api.time.set(p.at, { animate: true });
    if (animatingTo === name) animatingTo = null;
    await refreshSnapshot();
  }

  // the quick buttons follow the clock: one is pressed only while the clock is on its time
  api.time.on((m) => {
    if (animatingTo) return;
    const k = time.presetAt(m);
    if (base.state.moment !== k) { base.state.moment = k; ui.update(base.state); }
  });
  let snapTimer = 0;
  ctx.onTimeInput = () => { clearTimeout(snapTimer); snapTimer = setTimeout(refreshSnapshot, 450); };

  const nav = {
    get state() { return base.state; },
    goEstate: (...a) => base.goEstate(...a),
    openVilla: (...a) => base.openVilla(...a),
    setFloor: (...a) => base.setFloor(...a),
    showRoom: (...a) => base.showRoom(...a),
    showPlace: (...a) => base.showPlace(...a),
    showNote: (...a) => base.showNote(...a),
    lookFromHere: (...a) => base.lookFromHere(...a),
    nextPlace: (...a) => base.nextPlace(...a),
    tour: () => (ctx.tour ? ctx.tour.start() : v1Tour()),
    get touring() { return ctx.tour ? ctx.tour.touring : !!v1Touring?.call(base); },
    setMoment,
    search: (q) => (ctx.search ? ctx.search.search(q) : v1Search(q)),
    momentLabel,
  };
  api.provide('nav', nav);
  ctx.nav = nav;

  ctx.pins = installPins(ctx);
  ctx.layersUI = installLayersUI(ctx);
  ctx.weekend = installWeekend(ctx);
  ctx.search = createSearch(ctx);
  ui.onChoose = (r) => ctx.search.choose(r);
  ctx.share = installShare(ctx);
  ctx.minimap = installMinimap(ctx);
  ctx.tour = createTour(ctx);
  ctx.stopTour = () => ctx.tour.stop();
  ctx.hop = installHop(ctx);
  ctx.onboarding = installOnboarding(ctx);

  // ---------- the lazy ones: sound, photo mode, walk (each loads on its first press) ----------
  const lazy = (load) => { let p = null; return () => (p ??= load().catch((err) => { p = null; throw err; })); };
  const soundBtn = $('vx-sound');
  soundBtn.hidden = !(window.AudioContext || window.webkitAudioContext);   // no Web Audio, no speaker
  let audio = null;
  ctx.loadSound = lazy(async () => (await import('./sound.js')).createSound(ctx, audio));
  soundBtn.addEventListener('click', async () => {
    // iPhones only let sound start inside the tap itself, so the context is made here, before the module arrives.
    // A playback session plays with the silent switch on (Safari 17 and later); without one, Web Audio is muted then
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* no Web Audio */ }
    if (!audio) { ui.toast('This browser cannot play sound'); return; }
    soundBtn.setAttribute('aria-busy', '');
    try {
      const sound = await ctx.loadSound();
      sound.set(!sound.on);
      soundBtn.setAttribute('aria-pressed', String(sound.on));
      const muteable = !navigator.audioSession && /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (sound.on) ui.toast(muteable ? 'Sound on. Nothing? Check the silent switch' : 'Sound on: what you might hear here at the end of May');
    } catch (err) {
      console.warn('[villas] sound', err);
    } finally { soundBtn.removeAttribute('aria-busy'); }
  });

  // one thing at a time: the tour ends a walk and photo mode (if they were ever loaded)
  let walkMod = null, photoMod = null;
  ctx.stopOthers = () => { walkMod?.leave(); photoMod?.leave(); };
  ctx.loadPhoto = lazy(async () => (photoMod = (await import('./photo-ui.js')).createPhoto(ctx)));
  $('vx-shoot').addEventListener('click', async (e) => { (await ctx.loadPhoto()).enter(e.currentTarget); });

  ctx.loadWalk = lazy(async () => (walkMod = (await import('./walk.js')).createWalk(ctx)));
  const walkBtn = $('vx-walk');
  walkBtn.addEventListener('click', async () => { (await ctx.loadWalk()).enter(); });
  api.loop.onFrame(() => { const show = rig.eye && !rig.flying; if (walkBtn.hidden === show) walkBtn.hidden = !show; }, { phase: 'post' });

  // credits for data the tracks add, after the page's own
  const credits = $('vx-credits-extra');
  const showCredits = () => { if (credits) credits.innerHTML = api.credits.all().map((c) => ` ${c.html}`).join(''); };
  api.credits.on(showCredits);
  showCredits();
  ctx.closeMenu = () => { const m = $('vx-gfx-menu'); m.hidden = true; $('vx-gfx-btn').setAttribute('aria-expanded', 'false'); };

  // a landmark from search: stand at Santarsa's view west and look towards it
  ctx.lookToward = (id) => {
    const l = (api.model.landmarks || []).find((x) => x.id === id);
    const v = api.model.villas.find((x) => x.id === 'santarsa');
    if (!l || !v?.view) return;
    const [vx, vz] = v.view;
    const pos = new api.THREE.Vector3(vx, ground.groundAt(vx, vz) + 34, vz);
    const ly = ground.heightAt(l.local[0], l.local[1]);
    const d = Math.hypot(l.local[0] - vx, l.local[1] - vz);
    const dir = new api.THREE.Vector3(l.local[0] - vx, 0, l.local[1] - vz).normalize();
    const target = pos.clone().addScaledVector(dir, 400).setY(pos.y + ((ly - pos.y) / d) * 400);
    base.state.selected = null;
    ui.hideCard();
    ctx.landmarkFocus = id;
    rig.flyTo({ pos, target, fov: 42, fixed: true, limits: { min: 4, max: 2600 } });
  };
  rig.onEvent((e) => { if (e === 'user') ctx.landmarkFocus = null; });

  // card buttons the v1 card does not know: places and layers by id
  ui.onAction = (a) => {
    if (a.startsWith('place:')) nav.showPlace(a.slice(6));
    else if (a.startsWith('layer:')) ctx.layersUI.set(a.slice(6), true);
  };

  // the page's controls and the kernel's window.villas reach the clock, the tour and search v2 through base
  Object.assign(base, { setMoment, tour: nav.tour, search: nav.search });
  Object.defineProperty(base, 'touring', { get: () => nav.touring, configurable: true });
  return ctx;
}

export function ready(api) {
  const ctx = contexts.get(api);
  if (!ctx) return;
  const deep = ctx.base.start();
  const linked = ctx.share.applyLink();
  if (!linked && !deep) ctx.onboarding.start();
}
