// Grass tufts and late-May flowers (poppies, daisies, buttercups, clover) within about 25 m of a camera near the
// ground, on Balanced and Best: one instanced draw, re-seeded round the camera when it moves on, only on open grass
// (the painted map's green, outside the woods and off the lanes, gravel and decks). They sway with the trees.
import * as THREE from '../vendor/three-core.js';
import { mergeGeometries } from '../vendor/three-core.js';
import { seeded } from '../util.js';

const RADIUS = 26;
const COUNT = { balanced: 2400, best: 2800 };

function tuftGeometry() {
  const rnd = seeded(5);
  const parts = [];
  // late-May greens with a few blades already going straw, short and leaning only a little: a clump, not spikes
  const green = [new THREE.Color('#6a8a3c'), new THREE.Color('#7d9a46'), new THREE.Color('#5b7d36'), new THREE.Color('#98a45a'), new THREE.Color('#b0a868')];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, lean = 0.08 + rnd() * 0.22, h = 0.1 + rnd() * 0.16, w = 0.016 + rnd() * 0.012;
    const bx = (rnd() - 0.5) * 0.12, bz = (rnd() - 0.5) * 0.12;
    const tip = [bx + Math.cos(a) * lean * h, h, bz + Math.sin(a) * lean * h];
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([bx - px, 0, bz - pz, bx + px, 0, bz + pz, ...tip], 3));
    const c = green[Math.floor(rnd() * green.length)], dark = c.clone().multiplyScalar(0.78);
    g.setAttribute('color', new THREE.Float32BufferAttribute([dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, c.r, c.g, c.b], 3));
    g.setAttribute('sway', new THREE.Float32BufferAttribute([0, 0, 0.04], 1));
    g.setAttribute('flower', new THREE.Float32BufferAttribute([0, 0, 0], 1));
    parts.push(g);
  }
  // a flower head on a stalk (coloured per instance, hidden on most)
  const head = new THREE.OctahedronGeometry(0.03, 0).scale(1, 0.55, 1).translate(0.02, 0.3, 0.01).toNonIndexed();
  head.deleteAttribute('normal');
  head.deleteAttribute('uv');
  const n = head.attributes.position.count;
  head.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  head.setAttribute('sway', new THREE.Float32BufferAttribute(new Array(n).fill(0.05), 1));
  head.setAttribute('flower', new THREE.Float32BufferAttribute(new Array(n).fill(1), 1));
  parts.push(head);
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  // blades lit as if facing up, so they read as grass rather than shards
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, nor.getX(i) * 0.3, 1, nor.getZ(i) * 0.3);
  g.normalizeNormals();
  return g;
}

export function createTufts({ tier, heightAt, groundAt, isGrass, time }) {
  const count = COUNT[tier];
  if (!count) return null;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (s) => {
    s.uniforms.uTuftTime = time;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nattribute float flower;\nattribute vec3 tuftTint;\nuniform float uTuftTime;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, tuftTint, flower * step(0.001, dot(tuftTint, vec3(1.0))));\nif (flower > 0.5 && dot(tuftTint, vec3(1.0)) < 0.001) vColor.rgb = vec3(0.0);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 ip = instanceMatrix[3].xyz;
  float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  transformed.x += sin(uTuftTime * 1.6 + ph + ip.x * 0.3) * sway;
  transformed.z += cos(uTuftTime * 1.3 + ph) * sway * 0.6;
  // flower heads without a colour shrink away
  if (flower > 0.5 && dot(tuftTint, vec3(1.0)) < 0.001) transformed *= 0.0;
}`);
  };
  material.customProgramCacheKey = () => 'villas-tufts';
  const geo = tuftGeometry();
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute('tuftTint', tint);
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'tufts';
  mesh.raycast = () => {};

  const FLOWERS = [new THREE.Color('#d8382a'), new THREE.Color('#f4f1e6'), new THREE.Color('#e9c53a'), new THREE.Color('#c79ad6')];
  const rnd = seeded(808);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3(1e9, 0, 0);
  function seed(camera) {
    const c = camera.position;
    at.copy(c);
    let n = 0, tries = 0;
    while (n < count && tries < count * 4) {
      tries++;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * RADIUS;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!isGrass(x, z)) continue;
      const y = groundAt(x, z);
      // not on a raised deck or pad (where content's paving stands), only on the ground itself
      if (Math.abs(y - heightAt(x, z)) > 0.6 && rnd() < 0.85) continue;
      const s = 0.7 + rnd() * 0.9;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      m4.compose(p.set(x, y - 0.02, z), q, sc.set(s, s * (0.8 + rnd() * 0.5), s));
      mesh.setMatrixAt(n, m4);
      const f = rnd();
      const col = f < 0.07 ? FLOWERS[0] : f < 0.16 ? FLOWERS[1] : f < 0.22 ? FLOWERS[2] : f < 0.25 ? FLOWERS[3] : null;
      tint.setXYZ(n, col ? col.r * 1.4 : 0, col ? col.g * 1.4 : 0, col ? col.b * 1.4 : 0);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    tint.needsUpdate = true;
  }

  return {
    mesh,
    beforeRender(camera) {
      const above = camera.position.y - groundAt(camera.position.x, camera.position.z);
      mesh.visible = above < 7;   // seen from higher, blades read as dark specks
      if (mesh.visible && camera.position.distanceTo(at) > 6) seed(camera);
    },
  };
}
