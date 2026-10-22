// The air between the camera and everything it sees: haze that thickens with distance and thins with height (so the
// valley sits in it below the villas and the far ridges stack in paler layers), warmed towards the sun.
//
// It replaces three's fog chunks for every material with `fog: true`. Three of its numbers are shared by all of them:
// the uniform values below are plain objects, which three's uniform cloning passes by reference, so one write here
// reaches every material. fogColor and fogDensity still come from scene.fog (a FogExp2), as before.
import * as THREE from '../vendor/three-core.js';

// haze: x unused, y the height (m, world) where fogDensity applies, z the height over which it falls by e, w its cap
// sun:  xyz the direction to the sun, w how much the haze glows towards it
// glow: rgb the glow's colour (in the same space as fogColor reaches the shader), w how tight it is round the sun
export const AIR = Object.freeze({
  haze: { x: 0, y: -420, z: 300, w: 1 },
  sun: { x: 0, y: 1, z: 0, w: 0 },
  glow: { x: 0, y: 0, z: 0, w: 6 },
});

const PARS_VERTEX = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;

// world position from the view-space one, so instancing, skinning and every material get it for free
const VERTEX = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );
#endif`;

const PARS_FRAGMENT = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec4 uAirHaze, uAirSun, uAirGlow;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

// Exponential height fog integrated along the ray (density d0 * exp(-(h - h0) / H)), after Inigo Quilez.
const FRAGMENT = /* glsl */`
#ifdef USE_FOG
  {
    #ifdef FOG_EXP2
      float airD0 = fogDensity;
    #else
      float airD0 = 1.0 / max(fogFar, 1.0);
    #endif
    vec3 airRay = vFogWorld - cameraPosition;
    float airDist = length(airRay);
    float airB = 1.0 / uAirHaze.z;
    float airK = airB * airRay.y;
    float airSlope = abs(airK) > 1e-3 ? (1.0 - exp(-airK)) / airK : 1.0 - 0.5 * airK;
    float airOptical = airD0 * exp(-(cameraPosition.y - uAirHaze.y) * airB) * airDist * airSlope;
    float fogFactor = (1.0 - exp(-max(airOptical, 0.0))) * uAirHaze.w;
    float airSun = pow(max(dot(airRay / max(airDist, 1e-3), uAirSun.xyz), 0.0), uAirGlow.w) * uAirSun.w;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor + uAirGlow.rgb * airSun, fogFactor);
  }
#endif`;

let installed = false;

// Patch once, before any material compiles (createSky calls it first thing).
export function installAir() {
  if (installed) return AIR;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = PARS_VERTEX;
  C.fog_vertex = VERTEX;
  C.fog_pars_fragment = PARS_FRAGMENT;
  C.fog_fragment = FRAGMENT;
  const extra = () => ({ uAirHaze: { value: AIR.haze }, uAirSun: { value: AIR.sun }, uAirGlow: { value: AIR.glow } });
  Object.assign(THREE.UniformsLib.fog, extra());
  Object.values(THREE.ShaderLib).forEach((s) => { if (s.uniforms?.fogColor) Object.assign(s.uniforms, extra()); });
  return AIR;
}

// For a ShaderMaterial built before or without UniformsLib.fog: the uniforms the air needs.
export const airUniforms = () => ({
  fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, fogNear: { value: 1 }, fogFar: { value: 2000 },
  uAirHaze: { value: AIR.haze }, uAirSun: { value: AIR.sun }, uAirGlow: { value: AIR.glow },
});
