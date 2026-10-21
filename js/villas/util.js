// Animation and small helpers, after mill-lane-home's util.js. app.js calls tick(dt) once per frame.
import * as THREE from './vendor/three-core.js';

const active = new Set();

export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

export const reducedMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

// onUpdate gets eased progress 0..1. Resolves when done or cancelled; the promise has .cancel(). Progress follows the
// wall clock, not the frames' (capped) steps, so a slow device lands on time, only in fewer steps.
export function tween({ duration = 0.8, delay = 0, easing = ease.inOut, onUpdate, onComplete } = {}) {
  const job = { start: performance.now() + delay * 1000, duration: reducedMotion ? 0.001 : Math.max(0.001, duration), easing, onUpdate, done: false };
  let resolveFn;
  const p = new Promise((res) => { resolveFn = res; });
  job.finish = () => {
    if (job.done) return;
    job.done = true;
    active.delete(job);
    onComplete?.();
    resolveFn();
  };
  active.add(job);
  p.cancel = () => { job.done = true; active.delete(job); resolveFn(); };
  return p;
}

export function tick() {
  const now = performance.now();
  for (const job of [...active]) {
    if (job.done) continue;
    const t = (now - job.start) / 1000;
    if (t < 0) continue;
    const p = Math.min(t / job.duration, 1);
    job.onUpdate?.(job.easing(p));
    if (p >= 1) job.finish();
  }
}

export const busy = () => active.size > 0;

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const deg = (d) => (d * Math.PI) / 180;

// Compass bearing (degrees clockwise from north) to a unit vector on the ground: x east, z south.
export function bearingDir(bearing, out = new THREE.Vector3()) {
  const b = deg(bearing);
  return out.set(Math.sin(b), 0, -Math.cos(b));
}

// Bearing and elevation (degrees) to a unit vector pointing at that spot in the sky.
export function skyDir(bearing, elevation, out = new THREE.Vector3()) {
  const b = deg(bearing), e = deg(elevation);
  return out.set(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e));
}

// Deterministic pseudo random, so the woods grow the same way on every visit.
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [x1, z1] = pts[i - 1], [x2, z2] = pts[i];
    const dx = x2 - x1, dz = z2 - z1;
    const l2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((x - x1) * dx + (z - z1) * dz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)));
  }
  return best;
}

// Block-local (along, across) to world x/z for a block { c, rot }.
export function blockToWorld(block, lx, lz, out = new THREE.Vector3()) {
  const c = Math.cos(block.rot), s = Math.sin(block.rot);
  return out.set(block.c[0] + lx * c + lz * s, 0, block.c[1] - lx * s + lz * c);
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
  });
}

// ---------- UVs in metres (after mill-lane-home's materials.js): walls and ground by their facing, roofs down the slope ----------
const UP = new THREE.Vector3(0, 1, 0);

export function worldUV(g, metresPerTile = 1) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  if (!pos || !nor) return g;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u / metresPerTile;
    uv[i * 2 + 1] = v / metresPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Roof slopes: u across the slope, v up it, per face (so coppi rows run down the roof).
export function slopeUV(g, metresPerTile = 1) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  if (!pos || !nor) return g;
  const uv = new Float32Array(pos.count * 2);
  const n = new THREE.Vector3(), across = new THREE.Vector3(), upSlope = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    if (Math.abs(n.y) > 0.985 || Math.abs(n.y) < 0.05) {
      const ny = Math.abs(n.y), nx = Math.abs(n.x), nz = Math.abs(n.z);
      p.fromBufferAttribute(pos, i);
      const [u, v] = ny >= nx && ny >= nz ? [p.x, p.z] : nx >= nz ? [p.z, p.y] : [p.x, p.y];
      uv[i * 2] = u / metresPerTile; uv[i * 2 + 1] = v / metresPerTile;
      continue;
    }
    across.crossVectors(UP, n).normalize();
    upSlope.crossVectors(n, across);
    p.fromBufferAttribute(pos, i);
    uv[i * 2] = p.dot(across) / metresPerTile;
    uv[i * 2 + 1] = p.dot(upSlope) / metresPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
