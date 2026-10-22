// After dark, beyond the villas: the lights of the valley below (Sansepolcro, Anghiari, Pieve Santo Stefano and the
// farms between, placed round the towns' mapped centres: illustrative until OSM footprints place them), a faint
// orange glow low in the sky over Sansepolcro, and fireflies drifting over the meadows near the camera (typical of
// these hills in late May and June). Each is one draw of points; all of it fades in with the night and costs
// nothing by day (the draws are skipped while it is light).
import * as THREE from '../vendor/three-core.js';
import { seeded, clamp } from '../util.js';

const TOWNS = [
  { id: 'sansepolcro', n: 900, r: 900 },
  { id: 'anghiari', n: 260, r: 380 },
  { id: 'pieve-santo-stefano', n: 220, r: 420 },
];

// one program for the valley's lights and the fireflies: uFlies picks the fireflies' drift, blink and size
function pointsMaterial({ fireflies = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 }, uFlies: { value: fireflies ? 1 : 0 } },
    vertexShader: /* glsl */`
      attribute float size;
      attribute float phase;
      attribute vec3 tint;
      uniform float uNight, uTime, uScale, uFlies;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float a = uNight;
        // fireflies drift and blink: each one glows for about a second in every few; valley lights twinkle
        p += vec3(sin(uTime * 0.5 + phase * 7.0), sin(uTime * 0.8 + phase * 3.0) * 0.4, cos(uTime * 0.45 + phase * 5.0)) * 0.9 * uFlies;
        float cycle = fract(uTime * 0.23 + phase);
        float blink = smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.18, 0.32, cycle));
        float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + phase * 40.0);
        a *= mix(twinkle, blink, uFlies);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_PointSize = mix(size * uScale, size * uScale * clamp(12.0 / max(dist, 1.0), 0.6, 3.0), uFlies);
        a *= mix(exp(-dist / 26000.0), 1.0, uFlies);
        vTint = tint;
        vAlpha = a;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vTint * a * vAlpha, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function points(positions, sizes, tints, phases, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  g.setAttribute('tint', new THREE.Float32BufferAttribute(tints, 3));
  g.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  g.computeBoundingSphere();
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.raycast = () => {};
  return p;
}

export function createNight({ model, heightAt, mask, sky, renderer }) {
  const group = new THREE.Group();
  group.name = 'night';
  const rnd = seeded(404);
  const warm = [new THREE.Color('#ffb46a'), new THREE.Color('#ffd49a'), new THREE.Color('#fff1d8'), new THREE.Color('#ff9f4a')];

  // the valley's lights, on the ground, lifted a little so they clear the terrain mesh
  const pos = [], size = [], tint = [], phase = [];
  const add = (x, z, s, c, k) => {
    pos.push(x, heightAt(x, z) + 6, z);
    size.push(s);
    tint.push(c.r * k, c.g * k, c.b * k);
    phase.push(rnd());
  };
  const landmark = (id) => model.landmarks?.find((l) => l.id === id)?.local;
  TOWNS.forEach((t) => {
    const at = landmark(t.id);
    if (!at) return;
    for (let i = 0; i < t.n; i++) {
      // a dense centre thinning out to the edges, with a few lines of lights along streets
      const a = rnd() * Math.PI * 2, r = t.r * Math.pow(rnd(), 0.75);
      const street = rnd() < 0.3;
      const x = at[0] + Math.cos(street ? Math.round(a / 0.9) * 0.9 : a) * r, z = at[1] + Math.sin(street ? Math.round(a / 0.9) * 0.9 : a) * r;
      add(x, z, 1.6 + rnd() * 1.6, warm[Math.floor(rnd() * warm.length)], 2.4 + rnd() * 2.5);
    }
  });
  // farms and hamlets on the valley floor and the lower slopes
  for (let placed = 0, tries = 0; placed < 520 && tries < 6000; tries++) {
    const r = 2500 + Math.pow(rnd(), 0.8) * 17000, a = rnd() * Math.PI * 2;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    if (heightAt(x, z) > -150 && rnd() < 0.85) continue;
    placed++;
    const n = rnd() < 0.25 ? 3 + Math.floor(rnd() * 4) : 1;
    for (let k = 0; k < n; k++) add(x + (rnd() - 0.5) * 60, z + (rnd() - 0.5) * 60, 1.4 + rnd() * 1.2, warm[Math.floor(rnd() * warm.length)], 2 + rnd() * 2.5);
  }
  const valleyMat = pointsMaterial();
  const valley = points(pos, size, tint, phase, valleyMat);
  valley.name = 'valley-lights';
  valley.renderOrder = 2;
  group.add(valley);

  // fireflies: respawned round the camera when it moves on, over open ground only
  const N = 260;
  const fpos = new Float32Array(N * 3), fsize = [], ftint = [], fphase = [];
  const green = new THREE.Color('#d8ff8a');
  for (let i = 0; i < N; i++) { fsize.push(3 + rnd() * 3); ftint.push(green.r * 3, green.g * 3, green.b * 3); fphase.push(rnd()); }
  const flyMat = pointsMaterial({ fireflies: true });
  const flies = points(fpos, fsize, ftint, fphase, flyMat);
  flies.name = 'fireflies';
  flies.renderOrder = 3;
  group.add(flies);
  const spawnAt = new THREE.Vector3(1e9, 0, 0);
  function spawn(camera) {
    const c = camera.position;
    spawnAt.copy(c);
    const arr = flies.geometry.attributes.position.array;
    let n = 0, tries = 0;
    while (n < N && tries < N * 20) {
      tries++;
      const a = rnd() * Math.PI * 2, r = 4 + Math.pow(rnd(), 0.7) * 55;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (Math.abs(x) > 590 || Math.abs(z) > 590) continue;
      if (mask && mask(x, z) > 0.35) continue;
      arr[n * 3] = x; arr[n * 3 + 1] = heightAt(x, z) + 0.4 + rnd() * 2.2; arr[n * 3 + 2] = z;
      n++;
    }
    for (; n < N; n++) arr[n * 3 + 1] = -1e5;
    flies.geometry.attributes.position.needsUpdate = true;
  }

  // the town's glow, low over Sansepolcro: a uniform the dome reads
  const town = landmark('sansepolcro');
  const townDir = town ? new THREE.Vector3(town[0], 0, town[1]).normalize() : new THREE.Vector3(0, 0, 1);

  let night = 0;
  function setNight(n) {
    night = n;
    valleyMat.uniforms.uNight.value = n;
    flyMat.uniforms.uNight.value = clamp((n - 0.55) / 0.45, 0, 1);
    valley.visible = n > 0.02;
    flies.visible = n > 0.6;
  }
  sky?.onChange?.((s) => setNight(s.night));
  setNight(sky?.state?.night ?? 0);

  function beforeRender(camera) {
    const pr = renderer ? renderer.getPixelRatio() : Math.min(window.devicePixelRatio || 1, 2);
    valleyMat.uniforms.uScale.value = pr;
    flyMat.uniforms.uScale.value = pr;
    if (!flies.visible) return;
    // only near the ground: fireflies are invisible from the air
    const above = camera.position.y - heightAt(camera.position.x, camera.position.z);
    flies.material.visible = above < 70;
    if (above < 70 && camera.position.distanceTo(spawnAt) > 25) spawn(camera);
  }

  return {
    group, townDir, setNight, beforeRender,
    update(t) { valleyMat.uniforms.uTime.value = t; flyMat.uniforms.uTime.value = t; },
    get night() { return night; },
  };
}
