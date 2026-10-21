// The villa explorer's kernel (research/villas/v2-spec.md in the video repo, section 3). It makes the seam (api.js),
// the scene and the camera, runs the three tracks' installers in a fixed order (declare for realism, content and
// experience; then build; then ready), and runs the frame loop: frames are drawn only while something changes, and
// not at all off screen or in a hidden tab. Snippets (the stills on a place's card) and the tests' grabs are taken
// here, inside the frame. Loaded on demand by js/villas/boot.js.
import * as THREE from './vendor/three-core.js';
import { createApi } from './api.js';
import * as realism from './realism/index.js';
import * as content from './content/index.js';
import * as experience from './experience/index.js';
import { aim, frameBox } from './camera.js';
import { tick, busy, reducedMotion } from './util.js';

const IDLE_MS = 2500;   // no camera move, request, tween, flight or pending pass for this long: no frames
const TRACKS = [realism, content, experience];

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export async function start({ root, stage, labelsLayer, model, onProgress = () => {} }) {
  const params = new URLSearchParams(location.search);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || false;
  const api = createApi({ THREE, model, root, stage, labelsLayer, params, coarse, store });
  api.scene = new THREE.Scene();
  api.camera = new THREE.PerspectiveCamera(40, (stage.clientWidth || innerWidth) / (stage.clientHeight || innerHeight), 1, 60000);
  const camera = api.camera;

  // ---------- the loop's switches, bound before any build (a track may ask for frames while it builds) ----------
  let needsFrame = true;
  let lastActive = performance.now();
  const wake = () => { lastActive = performance.now(); };
  api.loop.bind({ wake, request: () => { needsFrame = true; } });

  // ---------- snippets: a still of a viewpoint, rendered off to one side of the live view ----------
  let snapJob = null;
  function snapshot(eye, { aspect = 1.6, width = 760 } = {}) {
    return new Promise((resolve) => {
      const prev = snapJob;   // a newer still replaces one not yet taken; whoever waited for that one gets this one
      snapJob = { eye, aspect, width, resolve: (url) => { prev?.resolve(url); resolve(url); } };
      wake();
    });
  }

  // ---------- the tracks ----------
  TRACKS.forEach((track) => track.declare(api));
  let xp = null;
  for (const track of TRACKS) {
    const out = await track.build(api, { onProgress, snapshot });
    if (track === experience) xp = out;
    await frame();
  }
  const renderer = api.renderer;
  const sky = api.use('sky'), ground = api.use('ground'), estate = api.use('estate'), pipeline = api.use('pipeline');
  const rig = api.use('rig'), nav = api.use('nav');

  function onResize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    pipeline.setSize(w, h);
    rig.resize(w, h);
    needsFrame = true;
  }
  new ResizeObserver(onResize).observe(stage);
  onResize();
  TRACKS.forEach((track) => track.ready?.(api));

  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 40, aspect: 1, view: null, near: 1 };
  function runSnapshot(job) {
    const c = renderer.domElement;
    const W = c.width, H = c.height, A = W / H;
    const hfov = THREE.MathUtils.degToRad(job.eye.hfov ?? 64);
    const cropW = A >= job.aspect ? H * job.aspect : W, cropH = A >= job.aspect ? H : W / job.aspect;
    const tanH = Math.tan(hfov / 2);
    const vfov = 2 * Math.atan((tanH / job.aspect) * (H / cropH));
    let spec = job.eye;
    if (spec.frame) {
      const f = spec.frame;
      spec = frameBox(f.box, aim(f.bearing, f.elevation), { fov: THREE.MathUtils.radToDeg(2 * Math.atan(tanH / job.aspect)), aspect: job.aspect, margin: f.margin ?? 0.04 });
    }
    saved.pos.copy(camera.position); saved.quat.copy(camera.quaternion);
    saved.fov = camera.fov; saved.aspect = camera.aspect; saved.view = camera.view ? { ...camera.view } : null; saved.near = camera.near;
    camera.clearViewOffset();
    camera.position.copy(spec.pos);
    camera.lookAt(spec.target);
    camera.fov = THREE.MathUtils.radToDeg(vfov);
    camera.aspect = A;
    camera.near = 0.08;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.fitShadow(new THREE.Vector3().copy(spec.target).lerp(spec.pos, 0.85), 60);
    sky.update(camera);
    pipeline.render();
    const out = document.createElement('canvas');
    out.width = job.width;
    out.height = Math.round(job.width / job.aspect);
    out.getContext('2d').drawImage(c, (W - cropW) / 2, (H - cropH) / 2, cropW, cropH, 0, 0, out.width, out.height);
    let url = '';
    try { url = out.toDataURL('image/jpeg', 0.86); } catch { url = ''; }
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat);
    camera.fov = saved.fov; camera.aspect = saved.aspect; camera.near = saved.near;
    if (saved.view) camera.setViewOffset(saved.view.fullWidth, saved.view.fullHeight, saved.view.offsetX, saved.view.offsetY, saved.view.width, saved.view.height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.fitShadow(camera.userData.focus, camera.position.distanceTo(camera.userData.focus) + 0.01);
    sky.refreshShadow();
    needsFrame = true;
    job.resolve(url);
  }

  // ---------- the loop (spec section 3, frame order) ----------
  const grabs = [];
  const clock = new THREE.Clock();
  let t = 0;
  const lastCam = new THREE.Matrix4(), lastProj = new THREE.Matrix4();
  let frames = 0;
  let lastNow = 0;
  const frameTimes = [], workTimes = [];
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) => root.addEventListener(ev, wake, { passive: true }));
  rig.controls.addEventListener('change', wake);
  function loop() {
    const now = performance.now();
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    tick();
    rig.update(dt);
    camera.updateMatrixWorld();
    const moved = differs(lastCam, camera.matrixWorld) || differs(lastProj, camera.projectionMatrix);
    if (moved || needsFrame || snapJob || grabs.length || busy() || rig.flying || pipeline.pending()) lastActive = now;
    if (now - lastActive > IDLE_MS) { lastNow = 0; return; }
    if (lastNow) { frameTimes.push(now - lastNow); if (frameTimes.length > 240) frameTimes.shift(); }
    lastNow = now;
    const requested = needsFrame;
    needsFrame = false;
    const f = { dt, t: reducedMotion ? 0 : t, moved, requested, camera };
    api.loop.run('pre', f);
    renderer.info.reset();
    if (snapJob) { const j = snapJob; snapJob = null; runSnapshot(j); }
    pipeline.render();
    if (grabs.length) { const url = renderer.domElement.toDataURL('image/png'); grabs.splice(0).forEach((fn) => fn(url)); }
    camera.updateMatrixWorld();
    api.loop.run('post', f);
    if (moved) { lastCam.copy(camera.matrixWorld); lastProj.copy(camera.projectionMatrix); }
    frames++;
    workTimes.push(performance.now() - now);
    if (workTimes.length > 240) workTimes.shift();
  }

  let onScreen = true;
  const run = () => {
    const on = onScreen && !document.hidden;
    renderer.setAnimationLoop(on ? loop : null);
    if (on) { clock.getDelta(); lastNow = 0; wake(); }
  };
  // the first frame goes through Balanced's or Best's passes, never straight to the canvas (see render.js's ready)
  await pipeline.ready?.();
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }).observe(root);
  document.addEventListener('visibilitychange', run);
  run();

  // ---------- what boot.js and the tests drive ----------
  const base = xp.base;
  const app = {
    THREE, api, model, scene: api.scene, renderer, camera, rig, sky, ground, pipeline, labels: xp.labels, experience: xp,
    // the tests look for the room glow and the pool water here, as v1 had them
    estate: Object.assign(Object.create(estate), { mats: { highlight: estate.glow.material, get water() { return api.use('materials').get('water.pool'); } } }),
    get state() { return nav.state; },
    goEstate: nav.goEstate, openVilla: nav.openVilla, setFloor: nav.setFloor, showRoom: nav.showRoom, showPlace: nav.showPlace,
    showNote: nav.showNote, lookFromHere: nav.lookFromHere, nextPlace: nav.nextPlace, setMoment: nav.setMoment, tour: nav.tour,
    get touring() { return nav.touring; },
    search: nav.search,
    setGraphics: base.setGraphics,
    setTime: (m, opts) => api.time.set(m, opts),
    setLayer: (id, on) => api.layers.set(id, on),
    refreshLabels: base.refreshLabels,
    graphics: () => ({ mode: pipeline.mode, tier: pipeline.tier }),
    info: () => ({ ...nav.state, tier: pipeline.tier, mode: pipeline.mode, flying: rig.flying, frames, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),
    // intervals between frames, and the main-thread time each frame's own work took (ms)
    frameStats() {
      const stats = (list) => {
        const s = [...list].sort((a, b) => a - b);
        const q = (k) => s[Math.min(s.length - 1, Math.floor(s.length * k))] || 0;
        return { n: s.length, median: q(0.5), p90: q(0.9), mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length) };
      };
      return { ...stats(frameTimes), work: stats(workTimes) };
    },
    resetFrameStats() { frameTimes.length = 0; workTimes.length = 0; lastNow = 0; },
    snapshot: (eye) => base.snapshot(eye),
    // the weekend mode
    weekend: (target, opts) => xp.weekend.open(target, opts),
    reel: () => xp.weekend.reel(),
    get weekendMode() { return xp.weekend.mode; },
    get weekendStage() { return api.use('weekendStage'); },
    // the 3D view alone, as the next frame draws it (tests read its pixels)
    grab: () => new Promise((resolve) => { grabs.push(resolve); wake(); }),
  };
  // the tests drive the explorer through window.villas; guests' browsers do not get it
  if (navigator.webdriver || params.has('debug')) window.villas = app;
  return app;
}

function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }

// OrbitControls' damping nudges the camera by ever smaller amounts long after it looks still
function differs(a, b, eps = 1e-5) {
  for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > eps) return true;
  return false;
}
