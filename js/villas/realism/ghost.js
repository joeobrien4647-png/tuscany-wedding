// The weekend's sketch material (weekend-mode-spec.md, section 5), loaded only when the weekend mode opens
// (materials.ready). Never see-through: opaque cream that writes depth, a fixed 4 x 4 ordered dither in screen space
// keeping uCover of its pixels (about 55 percent), a soft rim and a little light of its own so it reads at night.
// Nothing is blended or sorted. Each fork() is the same program with its own coverage, so two layouts can cross-fade.
import * as THREE from '../vendor/three-core.js';
import { MATERIALS } from '../api.js';

const GHOST_GLSL = /* glsl */`
uniform float uCover;
float ghostBayer(vec2 p) {
  const float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  ivec2 q = ivec2(mod(floor(p), 4.0));
  return (m[q.x + q.y * 4] + 0.5) / 16.0;
}`;

export function ghostMaterial() {
  const m = new THREE.MeshLambertMaterial({ color: MATERIALS.ghost.colour });
  const cover = { value: 0.55 };
  m.onBeforeCompile = (s) => {
    s.uniforms.uCover = cover;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${GHOST_GLSL}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (ghostBayer(gl_FragCoord.xy) > uCover) discard;')
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * (0.16 + 0.4 * pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'villas-ghost';
  m.userData.cover = cover;
  m.userData.fork = ghostMaterial;
  return m;
}
