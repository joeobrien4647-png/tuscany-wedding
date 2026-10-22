// The sky dome: the gradient and glow of v1, plus fair-weather cumulus over the Apennines (Mill Lane's fbm clouds),
// the Belt of Venus over the earth's shadow at dusk, finer stars and a faint Milky Way placed by the real sky.
import * as THREE from '../vendor/three-core.js';

// The sky's colour in a direction (HDR, linear), shared with the water so reflections match the dome.
export const SKY_GLSL = /* glsl */`
uniform vec3 uSkyTop, uSkyHorizon, uSkyGround, uSunDir, uSunColor;
uniform float uSunGlow;
vec3 skyColour(vec3 dir) {
  float e = dir.y;
  vec3 c = e > 0.0 ? mix(uSkyHorizon, uSkyTop, pow(clamp(e, 0.0, 1.0), 0.55)) : mix(uSkyHorizon, uSkyGround, clamp(-e * 6.0, 0.0, 1.0));
  float s = max(dot(dir, uSunDir), 0.0);
  float band = 1.0 - smoothstep(0.0, 0.5, abs(e - uSunDir.y));
  c += uSunColor * (pow(s, 6.0) * 0.32 * (0.5 + 0.5 * band) + pow(s, 64.0) * 0.6) * uSunGlow;
  return c;
}`;

export const WIND = [0.0045, -0.0016];   // cloud drift, cloud-plane units a second (from the south-west)

export function createDome(uniforms, { octaves = 4 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    defines: { CLOUD_OCTAVES: octaves },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform float uNight, uSunDisc, uTime, uCloudCover, uStars, uMilky, uBelt, uShadowTop;
      uniform vec3 uCloudLit, uCloudShade, uBeltColour, uShadowColour, uGalPole, uGalCentre, uTownDir;
      uniform float uTownGlow;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float hash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5, n = 0.0;
        for (int i = 0; i < CLOUD_OCTAVES; i++) { s += a * vnoise(p); n += a; p = p * 2.03 + 17.1; a *= 0.5; }
        return s / n;
      }
      float stars(vec3 d, float res, float keep) {
        vec3 q = d * res;
        vec3 cell = floor(q);
        float h = hash(cell);
        float on = step(keep, h);
        vec3 local = fract(q) - 0.5;
        return on * smoothstep(0.42, 0.0, length(local)) * (0.35 + 0.65 * hash(cell + 7.1));
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        float s = dot(d, uSunDir);
        c += uSunColor * (smoothstep(0.99993, 0.99996, s) * 7.0 + pow(max(s, 0.0), 900.0) * 1.2) * uSunDisc;

        // dusk: the earth's shadow rising opposite the sun, the pink Belt of Venus above it
        if (uBelt > 0.001) {
          vec2 anti = -normalize(uSunDir.xz + vec2(1e-5));
          float facing = dot(normalize(d.xz + vec2(1e-5)), anti) * 0.5 + 0.5;
          float e = degrees(asin(clamp(d.y, -1.0, 1.0)));
          float shadow = 1.0 - smoothstep(uShadowTop - 1.5, uShadowTop + 2.0, e);
          float belt = smoothstep(uShadowTop + 0.5, uShadowTop + 4.0, e) * (1.0 - smoothstep(uShadowTop + 6.0, uShadowTop + 20.0, e));
          float w = uBelt * pow(facing, 1.4);
          c = mix(c, c * uShadowColour, shadow * w * step(-0.02, d.y));
          c += uBeltColour * belt * w;
        }

        // the town's lights on the haze, low over Sansepolcro
        if (uTownGlow > 0.001 && d.y > -0.05) {
          float ang = acos(clamp(dot(normalize(d.xz + vec2(1e-5)), normalize(uTownDir.xz)), -1.0, 1.0));
          c += vec3(0.5, 0.27, 0.11) * exp(-ang * ang / 0.05) * exp(-max(d.y, 0.0) * 16.0) * uTownGlow;
        }

        float cover = 0.0;
        if (uCloudCover > 0.0 && d.y > 0.0) {
          vec2 p = d.xz / (d.y + 0.1) * 0.42 + vec2(${WIND[0]}, ${WIND[1]}) * uTime;
          float n = fbm(p);
          // more cumulus low over the Apennines to the east and north-east
          float hills = max(dot(normalize(d.xz + vec2(1e-5)), vec2(0.906, -0.423)), 0.0) * (1.0 - smoothstep(0.05, 0.4, d.y));
          float cov = uCloudCover + 0.22 * hills;
          cover = smoothstep(0.86 - cov, 1.0 - cov, n) * smoothstep(0.0, 0.1, d.y);
          float toSun = max(s, 0.0);
          float thick = smoothstep(0.55, 0.95, n);
          vec3 cloud = mix(uCloudShade, uCloudLit, clamp(0.3 + 0.7 * pow(toSun, 2.0) + 0.25 * (1.0 - thick) - 0.2 * thick, 0.0, 1.0));
          cloud += uSunColor * pow(toSun, 20.0) * (1.0 - thick) * 0.9 * uSunGlow;
          c = mix(c, cloud, cover * 0.94);
        }

        if (uStars > 0.001 && d.y > 0.0) {
          float clear = (1.0 - cover) * smoothstep(0.0, 0.18, d.y);
          float st = stars(d, 430.0, 0.9962) * 0.9 + stars(d, 170.0, 0.9975) * 1.6;
          vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.86, 1.0), hash(floor(d * 430.0) + 3.3));
          c += tint * st * uStars * clear;
          if (uMilky > 0.001) {
            float lat = dot(d, uGalPole);
            float band = exp(-lat * lat / 0.022);
            vec2 q = d.xz / (d.y + 0.35) * 3.2;
            float dust = smoothstep(0.35, 0.75, vnoise(q * 1.7 + 4.0)) * exp(-lat * lat / 0.004);
            float glow = band * (0.55 + 0.45 * vnoise(q * 3.1)) * (0.6 + 0.9 * pow(max(dot(d, uGalCentre), 0.0), 3.0));
            c += vec3(0.62, 0.64, 0.72) * 0.11 * uMilky * clear * max(glow - 0.7 * dust * band, 0.0);
          }
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(45000, 48, 24), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.name = 'sky';
  mesh.raycast = () => {};
  return mesh;
}

// The uniforms the dome adds to the shared sky ones.
export function domeUniforms() {
  return {
    uNight: { value: 0 }, uSunDisc: { value: 1 }, uTime: { value: 0 }, uCloudCover: { value: 0.32 },
    uStars: { value: 0 }, uMilky: { value: 0 }, uBelt: { value: 0 }, uShadowTop: { value: 0 },
    uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uBeltColour: { value: new THREE.Color() }, uShadowColour: { value: new THREE.Color(1, 1, 1) },
    uGalPole: { value: new THREE.Vector3(0, 1, 0) }, uGalCentre: { value: new THREE.Vector3(0, -1, 0) },
    uTownDir: { value: new THREE.Vector3(0, 0, 1) }, uTownGlow: { value: 0 },
  };
}
