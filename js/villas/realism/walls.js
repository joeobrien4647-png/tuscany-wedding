// Dry-stone retaining walls where a level pad stands more than about a metre above the natural ground on its
// downhill side (content's `pad` entries with `retain`; the photos show the pool terraces on stone walls). The
// ground mesh drops to the natural slope just inside the pad's edge on those sides (retainCut) and the wall's outer
// face and flat capping stones cover the step; the ground's surface for placing things (groundAt) stays the pad's
// level. One merged mesh for every wall, UVs in metres, the dry-stone painter's texture with relief.
import * as THREE from '../vendor/three-core.js';
import { mergeGeometries } from '../vendor/three-core.js';
import { rubble, setPainterSize } from './painters.js';
import { surfaceShader } from './materials.js';
import { normalFromHeight } from '../textures.js';

export const BAND = 1.4;   // metres inside the pad's edge that the capping stones cover
const DROP = 0.8;          // the step that earns a wall

// The ground mesh's height near a retaining pad: the natural slope wherever it falls more than DROP below the pad,
// from BAND inside the edge outwards; the pad's level elsewhere inside. `d` is the signed distance to the pad's edge.
export function retainCut(p, d, h) {
  if (d <= -BAND) return p.level;
  if (h < p.level - DROP) return h;
  if (d <= 0) return p.level;
  return null;   // outside, uphill or barely lower: the pad's usual blend applies
}

function wallMaterial(tier) {
  setPainterSize(tier === 'best' ? 512 : 256);
  const out = rubble({ palette: ['#9a9286', '#8d8579', '#a59b8a', '#7f786e', '#aaa08e'], mortar: '#564e41', dry: true, tile: 2.2, seed: 43 });
  const map = new THREE.CanvasTexture(out.c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.repeat.set(1 / out.tile, 1 / out.tile);
  const normalMap = new THREE.CanvasTexture(normalFromHeight(out.h, out.relief * 2.4, Math.min(out.h.width, 256)));
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.copy(map.repeat);
  // Balanced and Best: Standard with the explorer's surface shader, two-sided, so the walls share a program with the
  // other two-sided stone and tile surfaces (materials.js) instead of adding a Lambert one
  const m = tier === 'fast' ? new THREE.MeshLambertMaterial({ map, normalMap }) : new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  m.normalScale.set(1, -1);
  m.name = 'stone.dry';
  surfaceShader(m);
  return m;
}

function quad(a, b, c, d, uv, normal) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[0], uv[1], uv[4], uv[5], uv[6], uv[7]], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...normal, ...normal, ...normal, ...normal, ...normal, ...normal], 3));
  return g;
}

// pads: rectPad objects ({ c, cs, sn, hl, hw, level }) that retain
export function buildWalls({ pads, heightAt, tier = 'fast' }) {
  const parts = [];
  const step = 1;
  pads.forEach((p) => {
    const toWorld = (lx, lz) => [p.c[0] + lx * p.cs + lz * p.sn, p.c[1] - lx * p.sn + lz * p.cs];
    // the four edges: along (u) one axis at the other's extent, outward normal in local axes
    const edges = [
      { len: p.hl, at: (u, o) => [u, p.hw + o], n: [0, 1] },
      { len: p.hl, at: (u, o) => [-u, -p.hw - o], n: [0, -1] },
      { len: p.hw, at: (u, o) => [p.hl + o, -u], n: [1, 0] },
      { len: p.hw, at: (u, o) => [-p.hl - o, u], n: [-1, 0] },
    ];
    edges.forEach((e) => {
      const nw = [e.n[0] * p.cs + e.n[1] * p.sn, -e.n[0] * p.sn + e.n[1] * p.cs];
      const normal = [nw[0], 0, nw[1]];
      const samples = [];
      for (let u = -e.len; u <= e.len + 1e-6; u += step) {
        const [ox, oz] = toWorld(...e.at(u, 0.6));
        const hn = heightAt(ox, oz);
        samples.push({ u, low: p.level - hn > DROP, bottom: Math.min(hn, heightAt(...toWorld(...e.at(u, 0.05)))) - 0.5 });
      }
      const top = p.level + 0.08;
      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i], b = samples[i + 1];
        if (!a.low && !b.low) continue;
        const fa = toWorld(...e.at(a.u, 0.05)), fb = toWorld(...e.at(b.u, 0.05));
        const ia = toWorld(...e.at(a.u, -BAND)), ib = toWorld(...e.at(b.u, -BAND));
        // the outer face
        parts.push(quad([fa[0], a.bottom, fa[1]], [fb[0], b.bottom, fb[1]], [fb[0], top, fb[1]], [fa[0], top, fa[1]],
          [a.u, a.bottom, b.u, b.bottom, b.u, top, a.u, top], normal));
        // the capping stones
        parts.push(quad([fa[0], top, fa[1]], [ia[0], top, ia[1]], [ib[0], top, ib[1]], [fb[0], top, fb[1]],
          [a.u, 0, a.u, BAND, b.u, BAND, b.u, 0], [0, 1, 0]));
        // an end where the wall stops
        for (const [s, w, end] of [[a, fa, !samples[i - 1]?.low], [b, fb, !samples[i + 2]?.low]]) {
          if (!end) continue;
          const iw = toWorld(...e.at(s.u, -BAND));
          parts.push(quad([w[0], s.bottom, w[1]], [iw[0], s.bottom, iw[1]], [iw[0], top, iw[1]], [w[0], top, w[1]],
            [0, s.bottom, BAND, s.bottom, BAND, top, 0, top], [0, 0, 0]));
        }
      }
    });
  });
  const group = new THREE.Group();
  group.name = 'retaining-walls';
  if (!parts.length) return group;
  const g = mergeGeometries(parts, false);
  parts.forEach((x) => x.dispose());
  // the end faces were given no normal: work them out
  const nor = g.attributes.normal, pos = g.attributes.position;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    if (nor.getX(i) || nor.getY(i) || nor.getZ(i)) continue;
    va.fromBufferAttribute(pos, i); vb.fromBufferAttribute(pos, i + 1); vc.fromBufferAttribute(pos, i + 2);
    n.subVectors(vc, vb).cross(vb.clone().sub(va)).normalize().negate();
    for (let k = 0; k < 3; k++) nor.setXYZ(i + k, n.x, n.y, n.z);
  }
  const mesh = new THREE.Mesh(g, wallMaterial(tier));
  mesh.material.side = THREE.DoubleSide;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'retaining-walls';
  group.add(mesh);
  return group;
}
