// Free walk: from a standing view, walk about at 1.4 m/s. On phones a left-thumb joystick walks and a drag anywhere
// else looks round; on computers WASD or the arrows walk and a drag looks. The ground is ground.groundAt (eye at
// 1.65 m), the walls and the water are estate.colliders(), and the walk stays in the villa gardens and on the lane.
// Loaded the first time the walk button is pressed.
import { distanceToPolyline } from '../util.js';
import { blockedAt, EYE } from './hop.js';

const SPEED = 1.4;
const GARDEN = 75;     // metres round each house
const POOLSIDE = 32;   // and round each pool
const LANE = 12;       // either side of the lane between the villas

export function createWalk(ctx) {
  const { api, root, ui } = ctx;
  const THREE = api.THREE;
  const rig = api.use('rig'), ground = api.use('ground'), estate = api.use('estate');
  const model = api.model;
  const canvas = api.renderer.domElement;
  const boxes = () => (ctx.colliders ??= estate.colliders());
  const centres = model.villas.map((v) => v.blocks.reduce((s, b) => [s[0] + b.c[0] / v.blocks.length, s[1] + b.c[1] / v.blocks.length], [0, 0]));
  const lane = model.roads.find((r) => r.id === 'link-santarsa-vallorsaia')?.points || [];
  const allowed = (x, z) => centres.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < GARDEN)
    || model.pools.some((p) => Math.hypot(x - p.c[0], z - p.c[1]) < POOLSIDE)
    || (lane.length > 1 && distanceToPolyline(x, z, lane) < LANE);

  const el = document.createElement('div');
  el.className = 'vx-walk';
  el.hidden = true;
  el.innerHTML = `
    <div class="vx-joy" aria-hidden="true"><span class="vx-joy-knob"></span></div>
    <div class="vx-walk-bar"><span class="vx-walk-tip">${api.coarse ? 'Left thumb to walk, drag to look round' : 'W A S D or the arrows to walk, drag to look round'}</span>
      <button type="button" class="vx-btn vx-btn--primary vx-walk-stop">Stop walking</button></div>`;
  root.append(el);
  const joy = el.querySelector('.vx-joy'), knob = el.querySelector('.vx-joy-knob');

  const pos = new THREE.Vector3(), dir = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), target = new THREE.Vector3();
  let yaw = 0, pitch = 0, walking = false, idle = 0;
  const keys = new Set();
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  let look = null;

  function aimFrom(camera, at) {
    dir.subVectors(at, camera.position).normalize();
    yaw = Math.atan2(dir.x, -dir.z);
    pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  }

  function step(dt) {
    const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - stick.y;
    const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + stick.x;
    const moving = Math.abs(f) > 0.05 || Math.abs(s) > 0.05;
    if (!moving && !look?.moved) { idle += dt; if (idle > 0.2) return null; } else idle = 0;
    if (look) look.moved = false;
    fwd.set(Math.sin(yaw), 0, -Math.cos(yaw));
    side.set(Math.cos(yaw), 0, Math.sin(yaw));
    if (moving) {
      const mag = Math.min(1, Math.hypot(f, s));
      const k = (SPEED * (keys.has('shift') ? 2 : 1) * mag * Math.min(dt, 0.1)) / Math.max(1e-6, Math.hypot(f, s));
      const nx = pos.x + (fwd.x * f + side.x * s) * k, nz = pos.z + (fwd.z * f + side.z * s) * k;
      // into a wall or the water: slide along it if one way is clear, else stay put
      const free = (x, z) => allowed(x, z) && !blockedAt(boxes(), ground.groundAt, x, z);
      if (free(nx, nz)) { pos.x = nx; pos.z = nz; } else if (free(nx, pos.z)) pos.x = nx; else if (free(pos.x, nz)) pos.z = nz;
    }
    const want = ground.groundAt(pos.x, pos.z) + EYE;
    pos.y += (want - pos.y) * Math.min(1, dt * 10);
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    target.copy(pos).addScaledVector(dir, 2);
    api.loop.wake();
    return { pos, target, fov: 60 };
  }

  function enter() {
    if (walking) return;
    walking = true;
    ctx.stopTour?.();
    ui.hideCard({ keepSelection: true });
    pos.copy(rig.camera.position);
    if (pos.y - ground.groundAt(pos.x, pos.z) > 3) pos.y = ground.groundAt(pos.x, pos.z) + EYE;
    aimFrom(rig.camera, rig.controls.target);
    el.hidden = false;
    root.classList.add('is-walking');
    canvas.style.touchAction = 'none';
    rig.drive(step);
    api.loop.wake();
    el.querySelector('.vx-walk-stop').focus({ preventScroll: true });
    // below 900 px the walk bar has no room for its tip, so a phone gets it once, as a toast
    if (api.stage.clientWidth < 900) ui.toast(api.coarse ? 'Left thumb to walk, drag to look round' : 'W A S D or the arrows to walk, drag to look round');
  }

  function leave() {
    if (!walking) return;
    walking = false;
    keys.clear();
    Object.assign(stick, { x: 0, y: 0, id: null });
    knob.style.transform = '';
    el.hidden = true;
    root.classList.remove('is-walking');
    canvas.style.touchAction = 'pan-y';
    rig.release({ limits: { min: 0.3, max: 600, maxPolar: 2.6 }, eye: true });
    api.loop.request();
  }

  // the joystick: a thumb's drag from where it went down, up to 46 px
  joy.addEventListener('pointerdown', (e) => {
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
    joy.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const r = Math.hypot(dx, dy), max = 46;
    if (r > max) { dx *= max / r; dy *= max / r; }
    stick.x = dx / max; stick.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    api.loop.wake();
  });
  const letGo = (e) => { if (e.pointerId !== stick.id) return; Object.assign(stick, { x: 0, y: 0, id: null }); knob.style.transform = ''; };
  joy.addEventListener('pointerup', letGo);
  joy.addEventListener('pointercancel', letGo);

  // look: a drag on the model
  canvas.addEventListener('pointerdown', (e) => { if (walking) { look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture?.(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => {
    if (!walking || !look || e.pointerId !== look.id) return;
    yaw += (e.clientX - look.x) * 0.0045;
    pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - look.y) * 0.0035));
    look.x = e.clientX; look.y = e.clientY; look.moved = true;
    api.loop.wake();
  });
  const endLook = (e) => { if (look && e.pointerId === look.id) look = null; };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  window.addEventListener('keydown', (e) => {
    if (!walking || e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { leave(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { keys.add(k); e.preventDefault(); api.loop.wake(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  el.querySelector('.vx-walk-stop').addEventListener('click', leave);
  // a flight elsewhere (a pin, a search, the map) ends the walk
  rig.onEvent((e) => { if (e === 'released' && walking) leave(); });

  return { enter, leave, allowed, get walking() { return walking; }, get position() { return pos.clone(); }, keys, stick };
}
