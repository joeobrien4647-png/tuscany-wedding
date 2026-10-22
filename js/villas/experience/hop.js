// Tap to hop: standing at eye level (after "Look from here"), tap the ground up to 30 m away and glide there at
// 1.65 m, facing the same way. The ground comes from ground.groundAt and the walls and water from
// estate.colliders(), so nobody lands inside a house or in a pool; a tap on a wall is left to v1's picking.
import { clamp } from '../util.js';

export const EYE = 1.65;
const REACH = 30;
const MARGIN = 0.6;

// where a point sits in an oriented box { c, rot, length, width, y1, y2 }: local coordinates and whether inside
export function inBox(b, x, z, y = null, margin = 0) {
  const dx = x - b.c[0], dz = z - b.c[1];
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const hl = b.length / 2 + margin, hw = b.width / 2 + margin;
  const inside = Math.abs(lx) < hl && Math.abs(lz) < hw && (y == null || (y > b.y1 - margin && y < b.y2 + margin));
  return { inside, lx, lz, hl, hw };
}

// someone standing at (x, z) on ground g (their body from g to g + 1.8) is in the box's way
export function inWay(b, x, z, g, margin = MARGIN) {
  return inBox(b, x, z, null, margin).inside && g < b.y2 && g + 1.8 > b.y1;
}
export const blockedAt = (boxes, groundAt, x, z) => { const g = groundAt(x, z); return boxes.some((b) => inWay(b, x, z, g)); };

// the nearest spot to (x, z) that is in nobody's way: out of each box it is in by each of its four sides, and once
// more for a spot that lands in a neighbour (two blocks of one house); null if none is clear
export function pushOut(boxes, groundAt, x, z) {
  if (!blockedAt(boxes, groundAt, x, z)) return { x, z };
  const exits = (px, pz) => boxes.filter((b) => inWay(b, px, pz, groundAt(px, pz))).flatMap((b) => {
    const k = inBox(b, px, pz, null, MARGIN), c = Math.cos(b.rot), s = Math.sin(b.rot);
    return [[k.hl + 0.05, k.lz], [-k.hl - 0.05, k.lz], [k.lx, k.hw + 0.05], [k.lx, -k.hw - 0.05]]
      .map(([lx, lz]) => ({ x: b.c[0] + lx * c + lz * s, z: b.c[1] - lx * s + lz * c }));
  });
  let best = null, bestD = Infinity;
  const consider = (p) => {
    if (blockedAt(boxes, groundAt, p.x, p.z)) return false;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
    return true;
  };
  exits(x, z).forEach((p) => { if (!consider(p)) exits(p.x, p.z).forEach(consider); });
  return best;
}

export function installHop(ctx) {
  const { api, ui } = ctx;
  const THREE = api.THREE;
  const rig = api.use('rig'), ground = api.use('ground'), estate = api.use('estate');
  const canvas = api.renderer.domElement;
  const wk = () => api.root.classList.contains('is-weekend');
  const boxes = () => (ctx.colliders ??= estate.colliders());
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, hinted = false;

  // march along the ray: the first time it dips under the ground, or into a wall first (then null)
  function groundHit(origin, dir) {
    const p = new THREE.Vector3();
    let prev = 0;
    for (let d = 0.4; d < 400; d += d < 40 ? 0.25 : 2) {
      p.copy(origin).addScaledVector(dir, d);
      if (boxes().some((b) => b.kind !== 'pool' && inBox(b, p.x, p.z, p.y).inside)) return null;
      if (p.y <= ground.groundAt(p.x, p.z)) {
        let lo = prev, hi = d;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          p.copy(origin).addScaledVector(dir, mid);
          if (p.y <= ground.groundAt(p.x, p.z)) hi = mid; else lo = mid;
        }
        return p.copy(origin).addScaledVector(dir, hi);
      }
      prev = d;
    }
    return null;
  }

  // the spot a hop towards (x, z) lands on: no further than REACH, clear of walls and water
  function landing(x, z) {
    const cam = rig.camera.position;
    const dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz);
    if (d > REACH) { x = cam.x + (dx / d) * REACH; z = cam.z + (dz / d) * REACH; }
    let spot = pushOut(boxes(), ground.groundAt, x, z);
    // nothing clear round it: come back along the line towards where we stand
    for (let k = 0.95; !spot && k > 0; k -= 0.05) {
      const px = cam.x + (x - cam.x) * k, pz = cam.z + (z - cam.z) * k;
      if (!blockedAt(boxes(), ground.groundAt, px, pz)) spot = { x: px, z: pz };
    }
    spot ??= { x: cam.x, z: cam.z };
    return new THREE.Vector3(spot.x, ground.groundAt(spot.x, spot.z) + EYE, spot.z);
  }

  function hopTo(x, z) {
    const cam = rig.camera.position, look = rig.controls.target.clone().sub(cam);
    const to = landing(x, z);
    const dist = to.distanceTo(cam);
    if (dist < 0.3) return null;
    ripple(to);
    rig.flyTo({ pos: to, target: to.clone().add(look), fov: rig.lens, fixed: true, eye: true, limits: { min: 0.3, max: 600, maxPolar: 2.6 } }, { duration: clamp(dist / 6, 0.6, 2.2) });
    api.loop.wake();
    return to;
  }

  // a soft ring where the tap landed
  const stage = api.stage;
  function ripple(p) {
    const v = p.clone().setY(p.y - EYE).project(rig.camera);
    if (v.z > 1) return;
    const el = document.createElement('span');
    el.className = 'vx-hop';
    el.style.left = `${((v.x + 1) / 2) * stage.clientWidth}px`;
    el.style.top = `${((1 - v.y) / 2) * stage.clientHeight}px`;
    stage.append(el);
    setTimeout(() => el.remove(), 900);
  }

  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !rig.eye || rig.driving || rig.flying || wk()) { down = null; return; }
    const quick = performance.now() - down.t < 600 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
    down = null;
    if (!quick) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, rig.camera);
    const hit = groundHit(ray.ray.origin, ray.ray.direction);
    if (hit) hopTo(hit.x, hit.z);
  });

  // say so once, the first time someone is standing
  let was = false;
  api.loop.onFrame(() => {
    if (rig.eye && !was && !hinted && !rig.flying && !wk()) { hinted = true; ui.toast(api.coarse ? 'Tap the ground to walk there' : 'Click the ground to walk there'); }
    was = rig.eye;
  }, { phase: 'post' });

  return { hopTo, landing, groundHit };
}
