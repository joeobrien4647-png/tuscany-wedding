// From mill-lane-home. ACES filmic tone mapping exactly as three.js r170 applies it (tonemapping_pars_fragment), and its
// inverse. Colours tuned by eye as display colours (the sky keys) go in as the HDR values that tone-map
// back to themselves, so the sky looks the same whether ACES runs in the material or in OutputPass.
import * as THREE from './vendor/three-core.js';

// Column-major, as the GLSL mat3 constructors in three's chunk.
const IN = new THREE.Matrix3().fromArray([0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777]);
const OUT = new THREE.Matrix3().fromArray([1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602]);
const IN_INV = IN.clone().invert();
const OUT_INV = OUT.clone().invert();
const MAX = 0.98;   // ACES tops out near 1.0165; nothing brighter than this is inverted, so no blow-ups

const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);

// Positive root of fit(v) = y.
function fitInverse(y) {
  const a = 0.983729 * y - 1, b = 0.432951 * y - 0.0245786, c = 0.238081 * y + 0.000090537;
  return (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

const v3 = new THREE.Vector3();
const clamp = (x) => Math.min(MAX, Math.max(0, x));

// Linear display colour -> HDR linear colour that ACES (at this exposure) maps back to it.
export function acesInverse(color, exposure = 1, out = new THREE.Color()) {
  v3.set(color.r, color.g, color.b).applyMatrix3(OUT_INV);
  v3.set(fitInverse(clamp(v3.x)), fitInverse(clamp(v3.y)), fitInverse(clamp(v3.z))).applyMatrix3(IN_INV).multiplyScalar(0.6 / exposure);
  return out.setRGB(Math.max(0, v3.x), Math.max(0, v3.y), Math.max(0, v3.z));
}

// HDR linear colour -> linear display colour, as the GPU does it.
export function aces(color, exposure = 1, out = new THREE.Color()) {
  v3.set(color.r, color.g, color.b).multiplyScalar(exposure / 0.6).applyMatrix3(IN);
  v3.set(fit(v3.x), fit(v3.y), fit(v3.z)).applyMatrix3(OUT);
  return out.setRGB(Math.min(1, Math.max(0, v3.x)), Math.min(1, Math.max(0, v3.y)), Math.min(1, Math.max(0, v3.z)));
}
