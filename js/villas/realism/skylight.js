// Light from the sky itself, for every tier: a LightProbe whose spherical harmonics are projected on the CPU from the
// same sky the dome draws (gradient, sun glow, cloud cover), plus warm bounce from the sunlit ground below the
// horizon. Lambert and Standard materials both take it, at almost no cost per pixel, so shade turns cool and
// readable instead of green-black. A few hundred directions a time: well under a millisecond, so it follows the sun.
import * as THREE from '../vendor/three-core.js';

const ROWS = 12, COLS = 24;
const SAMPLES = (() => {
  const out = [];
  const basis = Array.from({ length: 9 }, () => new THREE.Vector3());
  for (let i = 0; i < ROWS; i++) {
    const th = ((i + 0.5) / ROWS) * Math.PI;
    for (let j = 0; j < COLS; j++) {
      const ph = ((j + 0.5) / COLS) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      const w = Math.sin(th) * (Math.PI / ROWS) * ((2 * Math.PI) / COLS);
      const b = new Float32Array(9);
      THREE.SphericalHarmonics3.getBasisAt(dir, b);
      out.push({ dir, w, b });
    }
  }
  return out;
})();

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const addScaled = (out, c, k) => { out.r += c.r * k; out.g += c.g * k; out.b += c.b * k; return out; };

// sky: { top, horizon, ground, sunDir, sunColor, sunGlow, cover } in HDR linear (the dome's uniforms);
// sun: { color, intensity, el }; tint: share of the sky's colour kept (the rest greyed); gain; fill: extra light
// (a Color, applied mostly from above) that keeps night readable; groundAlbedo: a Color
export function createSkyLight() {
  const probe = new THREE.LightProbe();
  probe.name = 'sky-light';
  const c = new THREE.Color(), g = new THREE.Color(), up = new THREE.Color(), bounce = new THREE.Color();
  const acc = Array.from({ length: 9 }, () => new THREE.Vector3());

  function radiance(d, sky, tint, out) {
    const e = d.y;
    if (e > 0) out.copy(sky.horizon).lerp(sky.top, Math.pow(Math.min(e, 1), 0.55));
    else return out.copy(bounce);
    const s = Math.max(d.dot(sky.sunDir), 0);
    addScaled(out, sky.sunColor, (Math.pow(s, 6) * 0.32 + Math.pow(s, 64) * 0.6) * sky.sunGlow);
    const l = lum(out);
    out.lerp(g.setRGB(l, l, l), (1 - tint) + sky.cover * 0.4 * tint);
    return out;
  }

  function update({ sky, sun, tint = 0.5, gain = 1, fill = null, groundAlbedo }) {
    // the ground below: lit by the sun and by the sky's average, reflecting its own colour
    const skyAvg = lum(up.copy(sky.horizon).lerp(sky.top, 0.4));
    const sunOnGround = sun.intensity * Math.max(Math.sin((sun.el * Math.PI) / 180), 0);
    bounce.copy(sun.color).multiplyScalar(sunOnGround / Math.PI).add(g.setRGB(skyAvg, skyAvg, skyAvg)).multiply(groundAlbedo);
    acc.forEach((v) => v.set(0, 0, 0));
    for (const { dir, w, b } of SAMPLES) {
      radiance(dir, sky, tint, c).multiplyScalar(gain);
      if (fill) addScaled(c, fill, 0.55 + 0.45 * dir.y);
      for (let k = 0; k < 9; k++) acc[k].x += c.r * b[k] * w, acc[k].y += c.g * b[k] * w, acc[k].z += c.b * b[k] * w;
    }
    for (let k = 0; k < 9; k++) probe.sh.coefficients[k].copy(acc[k]);
    return probe;
  }

  return { probe, update };
}
