// Camera rig, after mill-lane-home's camera.js: eased fly-to arcs, framing a box from a compass bearing,
// and composition inside the "clear area" the page's own controls leave visible (the rig measures the
// search bar, the dock and the card, and shifts the lens with setViewOffset so a shot is centred where
// the viewer can actually see it). v2 adds an eye mode (standing at 1.65 m, for tap to hop and walking),
// a driver that steers the camera frame by frame (the tour, walk mode) and hooks that run on every update.
import * as THREE from './vendor/three-core.js';
import { OrbitControls } from './vendor/three-core.js';
import { tween, ease, clamp, deg } from './util.js';

const FOV = 40;
const REF_ASPECT = 1.45;
const UP = new THREE.Vector3(0, 1, 0);
const OCCLUDERS = '.vx-search, .vx-notice, .vx-dock, .vx-card:not([hidden]):not(.is-caption), .vx-side, .vx-map.is-open, .vx-wk-bar, .vx-wk-bottom';
const BOUNDS = 1400;   // the look point stays within this many metres of the middle of the estate

// unit vector from the subject towards the camera: standing at `bearing` (degrees from north) of it, `elevation` up
export const aim = (bearing, elevation) => {
  const b = deg(bearing), e = deg(elevation);
  return new THREE.Vector3(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e));
};
const v3 = (a) => (a?.isVector3 ? a.clone() : Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : new THREE.Vector3(a?.x ?? 0, a?.y ?? 0, a?.z ?? 0));
const tanHalf = (fov) => Math.tan(THREE.MathUtils.degToRad(fov) / 2);

function corners(b) {
  const out = [];
  [b.x1, b.x2].forEach((x) => [b.y1, b.y2].forEach((y) => [b.z1, b.z2].forEach((z) => out.push(new THREE.Vector3(x, y, z)))));
  return out;
}

function screenBasis(dir) {
  const fwd = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, UP);
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0);
  right.normalize();
  return { right, up: new THREE.Vector3().crossVectors(right, fwd).normalize() };
}

function fitDistance(pts, target, dir, basis, tanV, tanH) {
  let d = 0;
  const rel = new THREE.Vector3();
  pts.forEach((p) => {
    rel.subVectors(p, target);
    const along = rel.dot(dir);
    d = Math.max(d, along + Math.abs(rel.dot(basis.right)) / tanH, along + Math.abs(rel.dot(basis.up)) / tanV);
  });
  return d;
}

// Place the camera on dir so the box fills the lens (less a margin), centred.
export function frameBox(box, dir, { fov = FOV, aspect = REF_ASPECT, margin = 0.08, minDist = 0 } = {}) {
  const pts = corners(box);
  const basis = screenBasis(dir);
  const tanV = tanHalf(fov) * (1 - margin), tanH = tanHalf(fov) * aspect * (1 - margin);
  const target = new THREE.Vector3((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, (box.z1 + box.z2) / 2);
  const rel = new THREE.Vector3();
  for (let i = 0; i < 4; i++) {
    const d = fitDistance(pts, target, dir, basis, tanV, tanH);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach((p) => {
      rel.subVectors(p, target);
      const depth = Math.max(0.05, d - rel.dot(dir));
      const sx = rel.dot(basis.right) / depth, sy = rel.dot(basis.up) / depth;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    });
    target.addScaledVector(basis.right, ((x0 + x1) / 2) * d).addScaledVector(basis.up, ((y0 + y1) / 2) * d);
  }
  const d = Math.max(minDist, fitDistance(pts, target, dir, basis, tanV, tanH));
  return { pos: target.clone().addScaledVector(dir, d), target, fov };
}

// `camera`: the kernel's camera (v2), set up here as the rig's own; without one the rig makes its own
export function createCameraRig(renderer, container, { groundAt, camera: given = null }) {
  const w0 = container.clientWidth || window.innerWidth, h0 = container.clientHeight || window.innerHeight;
  const camera = given || new THREE.PerspectiveCamera(FOV, w0 / h0, 1, 60000);
  if (given) { camera.fov = FOV; camera.aspect = w0 / h0; camera.near = 1; camera.far = 60000; camera.updateProjectionMatrix(); }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 1.0;
  controls.rotateSpeed = 0.7;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = 1.48;
  controls.minPolarAngle = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 3200;
  controls.zoomToCursor = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // OrbitControls claims every touch (touch-action: none). Leave vertical swipes to the page so a phone can
  // scroll past the model: one finger sideways turns it, two fingers pinch and move it.
  renderer.domElement.style.touchAction = 'pan-y';
  // a pinch is much gentler than the wheel: one moderate pinch went from the estate view to a pool's edge
  renderer.domElement.addEventListener('pointerdown', (e) => { controls.zoomSpeed = e.pointerType === 'touch' ? 0.5 : 1.0; }, { capture: true, passive: true });
  const focus = new THREE.Vector3();
  camera.userData.focus = focus;

  let flight = null;
  let lens = FOV, baseLens = FOV;
  let size = { w: w0, h: h0 };
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let wanted = { ...insets };
  let measureClock = 0;
  const listeners = new Set();
  const hooks = new Set();
  let driver = null;
  let eyeMode = false;

  const clear = () => ({ w: Math.max(1, size.w - insets.left - insets.right), h: Math.max(1, size.h - insets.top - insets.bottom) });
  const clearAspect = () => { const c = clear(); return c.w / c.h; };

  function applyProjection() {
    const { top: t, right: r, bottom: b, left: l } = insets;
    const c = clear();
    const fullW = size.w + Math.abs(l - r), fullH = size.h + Math.abs(t - b);
    camera.aspect = fullW / fullH;
    camera.fov = Math.min(170, THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf(lens) * fullH / c.h)));
    if (Math.abs(l - r) < 0.5 && Math.abs(t - b) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(fullW, fullH, r > l ? r - l : 0, b > t ? b - t : 0, size.w, size.h);
    camera.updateProjectionMatrix();
  }

  function setLens(f) { lens = f; applyProjection(); }

  // opacity is ignored on purpose: a card fading in already covers the view it is about to frame
  function isShown(el) {
    if (el.hidden) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function measureInsets() {
    const out = { top: 0, right: 0, bottom: 0, left: 0 };
    const box = container.getBoundingClientRect();
    const W = box.width || size.w, H = box.height || size.h;
    const rects = [];
    container.parentElement.querySelectorAll(OCCLUDERS).forEach((el) => {
      if (!isShown(el)) return;
      const r = el.getBoundingClientRect();
      const x0 = Math.max(0, r.left - box.left), x1 = Math.min(W, r.right - box.left);
      const y0 = Math.max(0, r.top - box.top), y1 = Math.min(H, r.bottom - box.top);
      if (x1 - x0 > 4 && y1 - y0 > 4) rects.push({ x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 });
    });
    rects.forEach((r) => {
      if (r.h < H * 0.4 || r.w > W * 0.6) return;
      if (r.x1 > W - 40) out.right = Math.max(out.right, W - r.x0);
      else if (r.x0 < 40) out.left = Math.max(out.left, r.x1);
    });
    const clearW = W - out.left - out.right;
    rects.forEach((r) => {
      if (r.h >= H * 0.4 && r.w <= W * 0.6) return;
      const overlap = Math.min(r.x1, W - out.right) - Math.max(r.x0, out.left);
      if (overlap < clearW * 0.4) return;
      if ((r.y0 + r.y1) / 2 > H / 2) out.bottom = Math.max(out.bottom, H - r.y0);
      else out.top = Math.max(out.top, r.y1);
    });
    const squeeze = (a, b, total) => { const k = Math.min(1, (total * 0.62) / Math.max(1, a + b)); return [a * k, b * k]; };
    [out.left, out.right] = squeeze(out.left, out.right, W);
    [out.top, out.bottom] = squeeze(out.top, out.bottom, H);
    return out;
  }

  function stepInsets(dt, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 7);
    let moved = false;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const d = wanted[side] - insets[side];
      if (Math.abs(d) < 0.25) { if (d) { insets[side] = wanted[side]; moved = true; } continue; }
      insets[side] += d * k;
      moved = true;
    }
    if (moved) applyProjection();
    return moved;
  }

  function refreshInsets() {
    wanted = measureInsets();
    stepInsets(0, true);
  }

  // A shot: { pos, target, fov } or { frame: { box, bearing, elevation, margin } }, optionally { portrait: {...} }.
  function resolve(s) {
    const aspect = clearAspect();
    if (s.portrait && aspect < 0.95) {
      const { portrait, ...rest } = s;
      return resolve({ ...rest, ...portrait });
    }
    const fov = s.fov ?? FOV;
    let pos = v3(s.pos), target = v3(s.target);
    if (s.frame) {
      ({ pos, target } = frameBox(s.frame.box, aim(s.frame.bearing, s.frame.elevation), { fov, aspect, margin: s.frame.margin ?? 0.08, minDist: s.frame.minDist ?? 0 }));
    } else if (aspect < REF_ASPECT && !s.fixed) {
      const narrow = REF_ASPECT / aspect;
      pos.sub(target).multiplyScalar(Math.pow(narrow, s.widen ? 0.35 : 0.6)).add(target);
    }
    const g = groundAt(pos.x, pos.z) + (s.eye ? 1.2 : 2.5);
    pos.y = Math.max(pos.y, g);
    let f = fov;
    if (s.widen && aspect < REF_ASPECT) f = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf(fov) * Math.pow(REF_ASPECT / aspect, 0.45))), fov, 72);
    return { pos, target, fov: f, limits: s.limits, eye: !!s.eye };
  }

  function configure(limits = {}) {
    controls.minDistance = limits.min ?? 2;
    controls.maxDistance = limits.max ?? 3200;
    controls.maxPolarAngle = limits.maxPolar ?? 1.48;
  }

  function stopDamping() {
    controls._sphericalDelta?.set(0, 0, 0);
    controls._panOffset?.set(0, 0, 0);
    if (controls._scale !== undefined) controls._scale = 1;
  }

  function land(spec) {
    eyeMode = !!spec.eye;
    configure(spec.limits);
    camera.position.copy(spec.pos);
    baseLens = spec.fov;
    setLens(spec.fov);
    controls.target.copy(spec.target);
    stopDamping();
    controls.update();
    stopDamping();
    focus.copy(controls.target);
    updateNear();
  }

  function cancelFlight() {
    if (!flight) return;
    const f = flight;
    flight = null;
    f.job.cancel();
  }

  // An eased arc: the look point glides, the camera orbits round it and lifts over the hill on long moves.
  function fly(spec, { duration } = {}) {
    cancelFlight();
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    const p1 = spec.pos, t1 = spec.target;
    const s0 = new THREE.Spherical().setFromVector3(p0.clone().sub(t0));
    const s1 = new THREE.Spherical().setFromVector3(p1.clone().sub(t1));
    let dTheta = s1.theta - s0.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    const r0 = Math.max(s0.radius, 0.05), r1 = Math.max(s1.radius, 0.05);
    const travel = p0.distanceTo(p1) + t0.distanceTo(t1) * 0.5;
    const turn = Math.abs(dTheta) + Math.abs(s1.phi - s0.phi);
    const dur = duration ?? clamp(1.1 + Math.log10(1 + travel) * 0.55 + turn * 0.3, 1.1, 3.4);
    const lift = clamp(travel * 0.12, 0, 160) * Math.min(1, Math.abs(dTheta) / 1.2 + 0.4);
    const lens0 = lens, lens1 = spec.fov;
    const T = new THREE.Vector3(), P = new THREE.Vector3(), S = new THREE.Spherical();
    configure({ min: 0.5, max: 6000, maxPolar: 1.55 });
    let resolveFlight;
    const done = new Promise((res) => { resolveFlight = res; });
    const job = tween({
      duration: dur,
      easing: ease.linear,
      onUpdate: (u) => {
        const e = ease.smoother(u);
        T.lerpVectors(t0, t1, e);
        S.set(Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * e), s0.phi + (s1.phi - s0.phi) * e, s0.theta + dTheta * e);
        P.setFromSpherical(S).add(T);
        P.y += lift * Math.sin(Math.PI * e);
        P.y = Math.max(P.y, groundAt(P.x, P.z) + 1.2);
        camera.position.copy(P);
        camera.lookAt(T);
        setLens(lens0 + (lens1 - lens0) * e);
        controls.target.copy(T);
        focus.copy(T);
        updateNear();
      },
    });
    flight = { job, spec, resolve: resolveFlight };
    job.then(() => {
      if (flight?.job === job) {
        flight = null;
        land(spec);
      }
      resolveFlight();
      listeners.forEach((fn) => fn('landed'));
    });
    return done;
  }

  function userInterrupt() {
    if (!flight) return;
    const f = flight;
    flight = null;
    f.job.cancel();
    configure(f.spec.limits);
    baseLens = lens;
    stopDamping();
    controls.update();
    f.resolve();
  }
  controls.addEventListener('start', () => { userInterrupt(); listeners.forEach((fn) => fn('user')); });

  // a flight or a jump takes the camera back from whoever was driving it (they hear 'released')
  function takeBack() {
    if (!driver) return;
    driver = null;
    controls.enabled = true;
    listeners.forEach((fn) => fn('released'));
  }

  function flyTo(shot, opts) {
    takeBack();
    refreshInsets();
    return fly(resolve(shot), opts);
  }

  function jumpTo(shot) {
    takeBack();
    refreshInsets();
    cancelFlight();
    land(resolve(shot));
  }

  // Near plane scales with how far away the subject is: close-ups stay crisp, the 40 km view stays stable.
  function updateNear() {
    const d = camera.position.distanceTo(controls.target);
    const above = camera.position.y - groundAt(camera.position.x, camera.position.z);
    const near = clamp(Math.min(d * 0.02, above * 0.5), 0.08, 6);
    if (Math.abs(near - camera.near) / camera.near > 0.1) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  const move = new THREE.Vector3();
  function clampExterior() {
    const t = controls.target;
    const len = Math.hypot(t.x, t.z);
    if (len > BOUNDS) {
      move.set(t.x, 0, t.z).multiplyScalar(BOUNDS / len - 1);
      t.add(move);
      camera.position.add(move);
    }
    const g = groundAt(camera.position.x, camera.position.z) + 1.0;
    if (camera.position.y < g) camera.position.y = g;
    const tg = groundAt(t.x, t.z) - 2;
    if (t.y < tg) t.y = tg;
  }

  // An outside hand on the camera (the tour, walk mode): fn(dt) returns { pos, target, fov } each update, and the
  // orbit controls sleep until release(). Returns release.
  function drive(fn) {
    cancelFlight();
    driver = fn;
    eyeMode = false;
    controls.enabled = false;
    return release;
  }
  function release({ limits, eye = false } = {}) {
    if (!driver) return;
    driver = null;
    controls.enabled = true;
    configure(limits);
    baseLens = lens;
    stopDamping();
    controls.update();
    stopDamping();
    eyeMode = eye;
  }
  function steer(dt) {
    const s = driver(dt);
    if (!s) return;
    camera.position.copy(s.pos);
    controls.target.copy(s.target);
    camera.lookAt(s.target);
    if (s.fov && Math.abs(s.fov - lens) > 1e-3) setLens(s.fov);
    focus.copy(s.focus || s.target);
    updateNear();
  }

  function update(dt = 0.016) {
    measureClock += dt;
    if (measureClock > 0.25) { measureClock = 0; wanted = measureInsets(); }
    stepInsets(dt);
    if (driver) steer(dt);
    else if (!flight) {
      controls.update(dt);
      clampExterior();
      focus.copy(controls.target);
      updateNear();
      // zoomed well out of a standing view: back to flying round
      if (eyeMode && camera.position.distanceTo(controls.target) > 40) eyeMode = false;
    }
    hooks.forEach((fn) => fn(dt));
  }

  function resize(w, h) {
    size = { w, h };
    refreshInsets();
    applyProjection();
  }

  return {
    camera, controls,
    get flying() { return !!flight; },
    get driving() { return !!driver; },
    get eye() { return eyeMode; },
    get lens() { return baseLens; },
    drive, release,
    onUpdate(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    get insets() { return { ...insets }; },
    get clearAspect() { return clearAspect(); },
    flyTo, jumpTo, update, resize, resolve,
    cancel: cancelFlight,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refreshInsets,
  };
}
