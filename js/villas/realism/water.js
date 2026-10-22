// Water: the two pools and Lake Montedoglio.
//   Pools: two ripple normal maps scrolling different ways (painted at load, as Mill Lane's rippleTexture), the sky
//   reflected by Fresnel, bright turquoise over the floor and deeper in the middle, caustics wandering over the floor,
//   the darker tile band at the waterline, paler water and a churned, bubbly surface over a shallow jet bay, and at
//   night the light of the lamps under the water: bright spots on one long wall, falling off across the floor.
//   The lake: broad slow ripples and, at golden hour, the sun's glitter drawn out along its path.
// One material serves both pools: before each is drawn it reads that pool's size from its plane (and its shallow
// end from userData.shallow if content sets one: { from: metres from the +x end }).
import * as THREE from '../vendor/three-core.js';
import { SKY_GLSL } from './skydome.js';
import { normalFromHeight, toTexture } from '../textures.js';
import { seeded } from '../util.js';

let ripples = null;
function rippleNormals() {
  if (ripples) return ripples;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, S, S);
  const rnd = seeded(91);
  for (let i = 0; i < 140; i++) {
    const px = rnd() * S, py = rnd() * S, r = 3 + rnd() * 13, v = rnd() > 0.5 ? 255 : 0;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]]) {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.32)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      x.fillStyle = g;
      x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    }
  }
  ripples = toTexture(normalFromHeight(c, 2.2), { srgb: false, aniso: 4 });
  return ripples;
}

export function waterMaterial(sky, { colour = '#24464a', pool = false } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDeep: { value: new THREE.Color(colour) }, uTime: { value: 0 }, uGlow: { value: 0 }, uPool: { value: pool ? 1 : 0 },
    uRipple: { value: rippleNormals() }, uSize: { value: new THREE.Vector2(15, 5.5) }, uShallow: { value: 0 },
    uReflect: { value: null }, uReflectMatrix: { value: new THREE.Matrix4() }, uReflectOn: { value: 0 },
  }]);
  Object.assign(uniforms, sky.uniforms);
  const m = new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: /* glsl */`
      uniform mat4 uReflectMatrix;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec4 vReflect;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vReflect = uReflectMatrix * wp;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform vec3 uDeep;
      uniform float uTime, uGlow, uPool, uShallow;
      uniform vec2 uSize;
      uniform sampler2D uRipple, uReflect;
      uniform float uReflectOn;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec4 vReflect;
      #include <fog_pars_fragment>
      float wHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      // a wandering web of bright lines, as sunlight makes through a rippled surface
      float caustic(vec2 p, float t) {
        vec2 q = p;
        float c = 0.0;
        for (int i = 0; i < 3; i++) {
          q += vec2(sin(q.y * 1.7 + t * 0.9 + float(i)), cos(q.x * 1.5 - t * 0.7 + float(i) * 1.3)) * 0.35;
          c += abs(sin(q.x * 2.1 + q.y * 1.3));
        }
        return pow(1.0 - c / 3.0, 4.0);
      }
      void main() {
        vec3 v = normalize(vWorld - cameraPosition);
        vec3 c;
        if (uPool > 0.5) {
          vec2 L = vUv * uSize;                                     // metres along and across the pool
          float shallow = uShallow > 0.0 ? smoothstep(uSize.x - uShallow - 0.1, uSize.x - uShallow + 0.15, L.x) : 0.0;
          vec2 a = vWorld.xz / 2.6 + vec2(uTime * 0.035, uTime * 0.021);
          vec2 b = vWorld.xz / 0.9 - vec2(uTime * 0.05, -uTime * 0.04);
          vec3 r1 = texture2D(uRipple, a).xyz * 2.0 - 1.0, r2 = texture2D(uRipple, b).xyz * 2.0 - 1.0;
          vec2 tilt = (r1.xy * 0.55 + r2.xy * 0.45) * (0.16 + 0.5 * shallow);
          // over the jets: a churned patch
          float churn = shallow * (0.5 + 0.5 * sin(uTime * 5.0 + wHash(floor(L * 3.0)) * 6.28));
          tilt += (vec2(wHash(floor(L * 9.0 + uTime * 3.0)), wHash(floor(L.yx * 9.0 - uTime * 3.0))) - 0.5) * 0.35 * shallow;
          vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
          vec3 rf = reflect(v, n);
          rf.y = abs(rf.y);
          float fres = 0.05 + 0.95 * pow(1.0 - max(dot(-v, n), 0.0), 4.0);
          // the body: pale turquoise over the floor, deeper in the middle, paler still in the shallow bay
          vec2 e = min(L, uSize - L);
          float edge = min(e.x, e.y);
          float deep = smoothstep(0.2, 2.2, edge) * (1.0 - shallow);
          vec3 shallowC = vec3(0.21, 0.69, 0.72), deepC = vec3(0.03, 0.42, 0.56);
          vec3 body = mix(shallowC, deepC, deep * 0.85) * (0.3 + 0.75 * clamp(uSunDir.y * 3.0 + 0.3, 0.0, 1.0));
          float sunLight = clamp(uSunDir.y * 2.5, 0.0, 1.0);
          body += vec3(0.85, 1.0, 0.95) * caustic(vWorld.xz * 1.7 + tilt * 3.0, uTime * 1.2) * 0.32 * sunLight * (1.0 - 0.5 * deep);
          // the tile band at the waterline shows as a darker rim
          body *= mix(0.62, 1.0, smoothstep(0.05, 0.28, edge));
          // white water over the jets
          // round bubbles, thickest over three jets along the bay's back wall
          vec2 bq = L * 11.0 + vec2(0.0, uTime * 4.0);
          vec2 bc = floor(bq);
          vec2 bo = vec2(wHash(bc), wHash(bc + 3.7));
          float bub = smoothstep(0.32, 0.12, length(fract(bq) - bo)) * step(0.55, wHash(bc + 9.1));
          float jets = 0.0;
          for (int i = 0; i < 3; i++) { vec2 jp = vec2(uSize.x - 0.35, uSize.y * (0.25 + 0.25 * float(i))); jets += exp(-dot(L - jp, L - jp) * 1.6); }
          float bubbles = shallow * clamp(bub * (0.25 + 1.2 * jets) + jets * 0.35, 0.0, 1.0) * (0.7 + 0.3 * churn);
          body = mix(body, vec3(0.92, 0.97, 0.98) * (0.5 + 0.5 * sunLight), bubbles * 0.7);
          // night: lamps under the water along one long wall, the water brightest near them
          if (uGlow > 0.01) {
            float lamps = 0.0;
            for (int i = 0; i < 3; i++) {
              vec2 lp = vec2(uSize.x * (0.2 + 0.3 * float(i)), 0.0);
              vec2 d = (L - lp) / vec2(1.0, 1.25);
              lamps += 1.0 / (1.0 + dot(d, d) * 1.8);
            }
            float spot = 0.0;
            for (int i = 0; i < 3; i++) { vec2 lp = vec2(uSize.x * (0.2 + 0.3 * float(i)), 0.12); spot += exp(-dot(L - lp, L - lp) * 9.0); }
            vec3 glow = vec3(0.03, 0.3, 0.38) * (0.1 + 1.5 * lamps) + vec3(0.55, 0.95, 0.92) * pow(lamps, 3.0) * 0.5 + vec3(0.9, 1.0, 0.95) * spot * 1.6;
            glow += vec3(0.5, 0.8, 0.8) * caustic(vWorld.xz * 1.7 + tilt * 3.0, uTime * 1.2) * 0.2 * lamps;
            body = mix(body, glow, uGlow);
          }
          vec3 sky = skyColour(rf);
          {
            float az = atan(rf.z, rf.x);
            float top = 0.1 + 0.09 * sin(az * 5.0 + 1.3) + 0.05 * sin(az * 13.0 + 0.4) + 0.03 * sin(az * 31.0);
            float ring = 1.0 - smoothstep(top - 0.03, top + 0.03, rf.y);
            float day = clamp(uSunDir.y * 2.5 + 0.15, 0.0, 1.0);
            vec3 woods = vec3(0.05, 0.075, 0.035) * (0.25 + 0.9 * day) + uSunColor * 0.02 * uSunGlow;
            sky = mix(sky, woods, ring * (1.0 - uReflectOn));
          }
          if (uReflectOn > 0.5) {
            // the house and the trees, upside down in the water (Best, close by)
            vec4 rp = vReflect;
            rp.xy += tilt * 0.35 * rp.w;
            vec4 mirror = texture2DProj(uReflect, rp);
            sky = mix(sky, mirror.rgb, mirror.a > 0.0 ? 1.0 : 0.0);
          }
          c = mix(body, sky, fres * (1.0 - 0.75 * uGlow));
          float glint = pow(max(dot(rf, uSunDir), 0.0), 600.0);
          c += uSunColor * glint * 4.0 * uSunGlow;
        } else {
          // the lake: broad slow ripples, glitter along the sun's path when it is low
          vec2 a = vWorld.xz / 40.0 + vec2(uTime * 0.01, uTime * 0.006);
          vec2 b = vWorld.xz / 13.0 - vec2(uTime * 0.012, -uTime * 0.01);
          vec3 r1 = texture2D(uRipple, a).xyz * 2.0 - 1.0, r2 = texture2D(uRipple, b).xyz * 2.0 - 1.0;
          vec3 n = normalize(vec3((r1.x * 0.6 + r2.x * 0.4) * 0.07, 1.0, (r1.y * 0.6 + r2.y * 0.4) * 0.07));
          vec3 rf = reflect(v, n);
          rf.y = abs(rf.y);
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
          c = mix(uDeep, skyColour(rf), fres * 0.92);
          float low = 1.0 - smoothstep(4.0, 22.0, degrees(asin(clamp(uSunDir.y, -1.0, 1.0))));
          float glint = pow(max(dot(rf, uSunDir), 0.0), mix(900.0, 120.0, low));
          c += uSunColor * glint * (2.5 + 5.0 * low) * uSunGlow;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  if (pool) {
    const mirror = createMirror();
    m.onBeforeRender = (renderer, scene, camera, geometry, object) => {
      const p = geometry.parameters;
      if (p?.width) m.uniforms.uSize.value.set(p.width, p.height);
      const sh = object.userData?.shallow;
      m.uniforms.uShallow.value = sh ? sh.from : /santarsa/.test(object.name) ? 2 : 0;
      m.uniforms.uReflectOn.value = 0;
      // never leave the mirror's own texture bound while it is not in use: both pools share this material, so the
      // other pool can be drawn inside the mirror's pass, and a sampler on the target being drawn into is a
      // feedback loop (WebKit skipped those draws, with an INVALID_OPERATION each time)
      m.uniforms.uReflect.value = BLANK;
      if (sky.tier === 'best' && !mirror.busy) {
        object.updateMatrixWorld();
        const y = object.matrixWorld.elements[13];
        const near = camera.position.distanceTo(object.getWorldPosition(tmpV)) < 45 && camera.position.y > y + 0.05;
        if (near && mirror.render(renderer, scene, camera, object, y, sky)) {
          m.uniforms.uReflect.value = mirror.target.texture;
          m.uniforms.uReflectMatrix.value.copy(mirror.textureMatrix);
          m.uniforms.uReflectOn.value = 1;
          m.userData.reflections = (m.userData.reflections || 0) + 1;
        }
      }
      m.uniformsNeedUpdate = true;
    };
  }
  return m;
}

const tmpV = new THREE.Vector3();
const BLANK = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })();

// A mirrored camera about the water's plane, its near plane bent onto the water (Lengyel's oblique projection, as
// three's Reflector), rendering the scene at half resolution into an HDR target.
function createMirror() {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  const cam = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const normal = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), look = new THREE.Vector3(), rot = new THREE.Matrix4();
  const size = new THREE.Vector2();
  const self = {
    target, textureMatrix, busy: false,
    render(renderer, scene, camera, object, y, sky) {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, Math.round(size.x / 2)), h = Math.max(1, Math.round(size.y / 2));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      at.set(camera.position.x, 2 * y - camera.position.y, camera.position.z);
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(camera.position);
      look.y = 2 * y - look.y;
      cam.position.copy(at);
      cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
      cam.lookAt(look);
      cam.far = camera.far;
      cam.near = camera.near;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      // bend the near plane onto the water, so nothing under it is reflected
      plane.setFromNormalAndCoplanarPoint(normal, tmpV.set(0, y, 0)).applyMatrix4(cam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const P = cam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + P[8]) / P[0];
      q.y = (Math.sign(clip.y) + P[9]) / P[5];
      q.z = -1;
      q.w = (1 + P[10]) / P[14];
      clip.multiplyScalar(2 / clip.dot(q));
      P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1; P[14] = clip.w;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

      self.busy = true;
      const was = object.visible, prevTarget = renderer.getRenderTarget(), shadowAuto = renderer.shadowMap.autoUpdate;
      object.visible = false;
      renderer.shadowMap.autoUpdate = false;
      const hooks = sky.hooksOn;
      sky.hooksOn = false;   // the woods stay culled for the live camera
      // the heavy, far or flat things the water could hardly show (the canopy blanket, the far terrain, far trees,
      // tufts, the night's points) are left out of the mirror, so Best stays inside its triangle ceiling
      const hidden = [];
      sky.mirrorHide?.forEach((o) => { if (o.visible) { o.visible = false; hidden.push(o); } });
      // and the near trees with lighter crowns (the middle level's geometry on the same instances)
      const swapped = [];
      sky.mirrorLod?.forEach((g, o) => { if (o.visible && o.count) { swapped.push([o, o.geometry]); o.geometry = g; } });
      renderer.setRenderTarget(target);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prevTarget);
      swapped.forEach(([o, g]) => { o.geometry = g; });
      hidden.forEach((o) => { o.visible = true; });
      sky.hooksOn = hooks;
      renderer.shadowMap.autoUpdate = shadowAuto;
      object.visible = was;
      self.busy = false;
      return true;
    },
  };
  return self;
}
