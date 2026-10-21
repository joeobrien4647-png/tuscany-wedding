// How light-giving things look at night: every entry in api.emitters (content's lanterns, lamp posts, string-light
// bulbs, candles, fires, pendants and glows), drawn per kind in one draw each, never as real lights.
//   Every tier: a bright core and a soft halo per point (additive sprites), fading in from dusk; candles and fires
//   flicker; bulbs sag-free as given. Balanced and Best add bloom on top (render.js).
//   Light on the surfaces below: a soft warm pool painted on the deck, terrace or table under each lantern, lamp,
//   pendant, fire and (thinned) string-light bulb, additive and flat, so a long table or a deck reads lit.
//   Bulbs doubled in the pool: a mirrored, dimmer copy of every bulb over a pool's water, drawn by the same points
//   (Balanced and Best; on Best the planar reflection would take over).
// An emitter with a layer shows only while that layer is on (isLayerOn), and its status does not change its look.
// A `ghost` group (an undecided light) is a marker: pale, a third as strong, no halo, no light below, no reflection.
import * as THREE from '../vendor/three-core.js';

// core: brightness of the point; halo: the glow's diameter in metres; pool: radius (m) of the light on the surface
// below and how strong it is
const KINDS = {
  window: { core: 0.6, halo: 1.0, pool: 0, poolI: 0 },
  lantern: { core: 3.0, halo: 0.9, pool: 2.6, poolI: 0.55 },
  lamp: { core: 3.5, halo: 1.3, pool: 4.0, poolI: 0.6 },
  bulb: { core: 3.0, halo: 0.5, pool: 2.2, poolI: 0.18, early: true },
  candle: { core: 1.6, halo: 0.22, pool: 0.6, poolI: 0.35, flicker: 1, early: true },
  fire: { core: 4.0, halo: 1.4, pool: 3.0, poolI: 0.7, flicker: 1 },
  pool: { core: 0, halo: 0, pool: 0, poolI: 0 },
  pendant: { core: 2.6, halo: 0.7, pool: 2.4, poolI: 0.5 },
  glow: { core: 1.0, halo: 2.4, pool: 2.0, poolI: 0.3 },
  wash: { core: 0, halo: 0, pool: 1, poolI: 0.5, early: true },   // light on a roof's underside, facing down
};

const GHOST = '~ghost';

// one program for every kind: flicker is a per-point weight (candles and fires 1, steady lights 0)
function spriteMaterial({ scale = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uScale: { value: scale }, uView: { value: 1 }, uHalo: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float size;
      attribute vec3 tint;
      attribute float phase;
      attribute float mirror;
      attribute float flicker;
      uniform float uNight, uTime, uScale, uView;
      varying vec3 vTint;
      varying float vCore;
      void main() {
        vec3 p = position;
        float d = max(-(modelViewMatrix * vec4(p, 1.0)).z, 0.5);
        if (mirror != 0.0) {
          // a light doubled in a pool: drawn where the ray to its mirror image meets the water, so the water does not
          // hide it, at the size of the image it is
          float t = (cameraPosition.y - mirror) / max(cameraPosition.y - p.y, 1e-3);
          p = cameraPosition + (p - cameraPosition) * t + vec3(0.0, 0.02, 0.0);
          if (cameraPosition.y < mirror) p = vec3(0.0, -1e5, 0.0);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // size in metres, with a floor in pixels so a far bulb is still a point of light
        gl_PointSize = clamp(size * uView / d, 2.0, 160.0) * uScale;
        float f = mix(1.0, 0.82 + 0.12 * sin(uTime * 13.0 + phase * 31.0) + 0.06 * sin(uTime * 23.0 + phase * 17.0), flicker);
        vTint = tint * uNight * f;
        vCore = clamp(size * uView / d / 6.0, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uHalo;
      varying vec3 vTint;
      varying float vCore;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float halo = exp(-r * r * 4.5) * 0.55 * uHalo;
        float core = smoothstep(0.22, 0.0, r) * 1.6;
        gl_FragColor = vec4(vTint * (halo + core), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// soft warm pools of light painted flat below the lights
function poolMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { uNight: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 tint;
      attribute vec2 ring;
      varying vec3 vTint;
      varying vec2 vLocal;
      varying vec2 vRing;
      void main() {
        vLocal = position.xz;
        vTint = tint;
        vRing = ring;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uNight;
      varying vec3 vTint;
      varying vec2 vLocal;
      varying vec2 vRing;
      void main() {
        float a;
        if (vRing.x > 0.0) {
          // a frame of light round a rectangle (a pool's own lamps on its deck): nothing inside, brightest at its edge
          vec2 q = max(abs(vLocal) - vRing * 0.5, 0.0) / max(vec2(0.5) - vRing * 0.5, vec2(1e-3));
          float d = length(q);
          float inside = step(abs(vLocal.x), vRing.x * 0.5) * step(abs(vLocal.y), vRing.y * 0.5);
          a = (1.0 - inside) * exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d));
        } else {
          float r = length(vLocal) * 2.0;
          a = exp(-r * r * 3.0) * (1.0 - smoothstep(0.85, 1.0, r));
        }
        gl_FragColor = vec4(vTint * a * uNight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createEmitters({ sky, tier = 'fast', surfaceBelow = null, pools = () => [], isLayerOn = () => true }) {
  const group = new THREE.Group();
  group.name = 'emitters';
  const entries = new Map();
  const kinds = new Map();   // kind -> { points, pool }
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  let dirty = true, night = 0, time = 0;

  function rebuild() {
    dirty = false;
    kinds.forEach(({ points, pool }) => { group.remove(points); points.geometry.dispose(); if (pool) { group.remove(pool); pool.geometry.dispose(); } });
    kinds.clear();
    const byKind = new Map();
    entries.forEach((e) => {
      if (e.layer && !isLayerOn(e.layer)) return;
      if (e.ghost && (e.kind === 'wash' || e.kind === 'pool')) return;
      const key = e.ghost ? `${e.kind}${GHOST}` : e.kind;
      if (!byKind.has(key)) byKind.set(key, []);
      byKind.get(key).push(e);
    });
    const waters = pools();
    byKind.forEach((list, key) => {
      const ghost = key.endsWith(GHOST), kind = ghost ? key.slice(0, -GHOST.length) : key;
      const base = KINDS[kind] || KINDS.glow;
      const k = ghost ? { ...base, pool: 0, core: base.core / 3, flicker: base.flicker ? 0.5 : 0 } : base;
      const pos = [], size = [], tint = [], phase = [], mirror = [], poolAt = [];
      const c = new THREE.Color();
      list.forEach((e) => {
        c.set(ghost ? '#efe6d2' : e.colour);   // ghost.glow's cream
        const s = e.size ?? 1;
        for (let i = 0; i < e.positions.length; i += 3) {
          const x = e.positions[i], y = e.positions[i + 1], z = e.positions[i + 2];
          if (k.halo) {
            pos.push(x, y, z);
            size.push(k.halo * s);
            tint.push(c.r * k.core, c.g * k.core, c.b * k.core);
            phase.push(Math.random());
            mirror.push(0);
            // doubled in a pool's water when one lies below (Balanced and Best)
            if (tier !== 'fast' && !ghost) {
              const w = waters.find((p) => Math.abs(x - p.x) < p.r && Math.abs(z - p.z) < p.r && y > p.y);
              if (w && Math.hypot(x - w.x, z - w.z) < w.r) {
                pos.push(x, 2 * w.y - y, z);
                size.push(k.halo * s * 0.9);
                tint.push(c.r * k.core * 0.35, c.g * k.core * 0.4, c.b * k.core * 0.45);
                phase.push(Math.random());
                mirror.push(w.y);
              }
            }
          }
          // a festoon-lit roof: a soft warm glow on its underside, facing down, the size of the roof
          if (kind === 'wash') {
            if (e.rect) poolAt.push([x, y, z, 0, c.r * k.poolI, c.g * k.poolI, c.b * k.poolI, e.rect[0], e.rect[1], e.rect[2], 0, 0, 1]);
            continue;
          }
          // a swimming pool's lamps light its own deck: a soft glow the shape of the pool, a little bigger
          if (kind === 'pool') {
            const w = waters.find((p) => Math.hypot(x - p.x, z - p.z) < p.r);
            if (w && w.length) poolAt.push([w.x, w.y + 0.14, w.z, 0, 0.06, 0.32, 0.36, w.length + 6, w.width + 6, w.rot || 0, w.length / (w.length + 6), w.width / (w.width + 6)]);
            continue;
          }
          // a pool of light on whatever is below, every bulb for short strings, every third for long ones
          if (k.pool && surfaceBelow && (kind !== 'bulb' || (i / 3) % 3 === 0)) {
            const below = surfaceBelow(x, y, z);
            if (below != null && y - below < 6) poolAt.push([x, below + 0.03, z, k.pool * s, c.r * k.poolI, c.g * k.poolI, c.b * k.poolI]);
          }
        }
      });
      if (!pos.length && !poolAt.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
      g.setAttribute('tint', new THREE.Float32BufferAttribute(tint, 3));
      g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
      g.setAttribute('mirror', new THREE.Float32BufferAttribute(mirror, 1));
      g.setAttribute('flicker', new THREE.Float32BufferAttribute(new Float32Array(mirror.length).fill(k.flicker || 0), 1));
      const points = new THREE.Points(g, spriteMaterial());
      points.material.uniforms.uHalo.value = ghost ? 0 : 1;
      points.frustumCulled = false;
      points.renderOrder = 6;
      points.name = `emitters-${key}`;
      points.raycast = () => {};
      group.add(points);
      let pool = null;
      if (poolAt.length) {
        const disc = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        disc.setAttribute('tint', new THREE.InstancedBufferAttribute(new Float32Array(poolAt.flatMap((q) => [q[4], q[5], q[6]])), 3));
        disc.setAttribute('ring', new THREE.InstancedBufferAttribute(new Float32Array(poolAt.flatMap((q) => (q.length > 10 ? [q[10], q[11]] : [0, 0]))), 2));
        pool = new THREE.InstancedMesh(disc, poolMaterial(), poolAt.length);
        const m4 = new THREE.Matrix4();
        const rq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), pv = new THREE.Vector3();
        const flipX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        poolAt.forEach((q, i) => {
          // a wash faces down: turned over (a turn, not a mirror, which instancing would not flip the faces for)
          if (q.length > 7) m4.compose(pv.set(q[0], q[1], q[2]), q[12] ? rq.setFromAxisAngle(up, q[9]).multiply(flipX) : rq.setFromAxisAngle(up, q[9]), sv.set(q[7], 1, q[8]));
          else m4.makeScale(q[3] * 2, 1, q[3] * 2).setPosition(q[0], q[1], q[2]);
          pool.setMatrixAt(i, m4);
        });
        pool.frustumCulled = false;
        pool.renderOrder = 5;
        pool.name = `emitters-${key}-light`;
        pool.raycast = () => {};
        group.add(pool);
      }
      kinds.set(key, { points, pool });
    });
    apply();
  }

  function apply() {
    kinds.forEach(({ points, pool }, key) => {
      const u = points.material.uniforms;
      // a ghost: faint by day, full from dusk
      const n = key.endsWith(GHOST) ? 0.45 + 0.55 * early : (KINDS[key] || KINDS.glow).early ? early : night;
      u.uNight.value = n;
      u.uTime.value = time;
      u.uScale.value = pixelRatio();
      points.visible = n > 0.02;
      if (pool) { pool.material.uniforms.uNight.value = n; pool.visible = n > 0.02; }
    });
  }

  // festoon bulbs and candles are switched on as the sun goes: full by the end of blue hour
  let early = 0;
  const earlyAt = (s) => Math.max(0, Math.min(1, ((s?.minutes ?? 0) - 1215) / 35)) * 0.85 + Math.max(0, Math.min(1, ((s?.night ?? 0) - 0.05) / 0.6)) * 0.15;
  sky?.onChange?.((s) => { night = Math.max(0, Math.min(1, (s.night - 0.05) / 0.6)); early = Math.max(night, earlyAt(s)); apply(); });
  night = Math.max(0, Math.min(1, ((sky?.state?.night ?? 0) - 0.05) / 0.6));
  early = Math.max(night, earlyAt(sky?.state));

  return {
    group,
    add(e) { entries.set(e.id, e); dirty = true; },
    remove(id) { if (entries.delete(id)) dirty = true; },
    refresh() { dirty = true; },
    beforeRender(camera) {
      if (dirty) rebuild();
      // the sprites are sized in metres: the projection's scale turns that into pixels
      const h = (camera.projectionMatrix.elements[5] || 1) * (window.innerHeight || 800) * 0.5;
      kinds.forEach(({ points }) => { points.material.uniforms.uView.value = h; });
    },
    update(t) { time = t; kinds.forEach(({ points }) => { points.material.uniforms.uTime.value = t; }); },
    get count() { let n = 0; entries.forEach((e) => { n += e.positions.length / 3; }); return n; },
    kinds: () => [...kinds.keys()],
  };
}
