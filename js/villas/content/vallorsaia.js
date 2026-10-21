// Villa Vallorsaia as the listing photos show it (villa-detail.md): a compact knot of stone wings with roofs at
// several heights and a tall narrow corner, an open loggia over the front with a big stone stair up the right-hand
// side, a stair to a portico on stone columns, the old bread oven, brick chimneys with little tile caps, red
// geraniums; the tettoia with its twin barbecue hearths and the lookout over the lake (both where exactly is not
// published, so approximate), split-rail fences, the pool on its sawn grey slabs, the forecourt and its big oak.
import { THREE, V3, mat4, cylG, barG, tubeG, seeded } from './kit.js';
import { buildBlock, faceAt, lantern, pot, windowBox } from './houses.js';
import { WALL, blockRoof, chimney } from './roofs.js';
import * as F from './furniture.js';

const STONE = 'stone.vallorsaia';

export function vallorsaiaDress() {
  return {
    'vallorsaia-lower': {
      faces: {
        s: { openings: [{ kind: 'stable', u: 6.6, w: 1.4, h: 2.3 }, { kind: 'door', u: 3.4, w: 1.0, h: 2.1, lantern: 'left', pots: 'flower.white' }], density: 0.55, shutterRate: 0.22, boxRate: 0.45 },
        w: { auto: false, openings: [{ kind: 'door', s: 1, u: 2.05, w: 0.95, h: 2.05, sill: 0, lantern: 'left', lanternDy: 2.3 }, { kind: 'window', u: 5.6, w: 0.75, h: 0.85, sill: 1.2 }] },
        n: { skip: true },
        e: { cover: [{ u0: -1, u1: 4.4, v1: 99 }, { u0: 4.0, u1: 9, v1: -1.3 }], density: 0.6 },
      },
      chimneys: [{ x: -0.35, z: 0.35, w: 0.55, d: 0.55, above: 0.7 }],
    },
    'vallorsaia-tower': {
      faces: {
        e: { auto: false, openings: [{ kind: 'window', s: 1, u: 1.9, w: 0.8, h: 0.9, sill: 1.0, shutters: true }, { kind: 'window', s: 2, u: 1.7, w: 0.7, h: 0.8, sill: 0.95 }, { kind: 'window', u: 2.2, w: 0.75, h: 0.85, sill: 1.25 }] },
        s: { density: 0.7, shutterRate: 0.25, boxRate: 0.4 },
        w: { cover: [{ u0: -1, u1: 99, v1: 2.0 }] },
        n: { cover: [{ u0: -1, u1: 99, v1: -1.3 }] },
      },
      chimneys: [{ x: 0.0, z: 0.0, w: 0.5, d: 0.5, above: 0.75 }],
    },
    'vallorsaia-annex': {
      faces: {
        e: { auto: false, openings: [{ kind: 'door', u: 1.2, w: 0.95, h: 2.05, lantern: 'right', pots: 'flower.red' }] },
        s: { skip: true }, n: { skip: true }, w: { skip: true },
      },
      skipGable: { w: true },
    },
    'vallorsaia-upper': {
      faces: {
        n: { openings: [{ kind: 'door', u: 5.6, w: 1.0, h: 2.1, lantern: 'left', pots: 'flower.white' }], density: 0.55, shutterRate: 0.3, boxRate: 0.3 },
        w: { density: 0.65, boxRate: 0.35 },
        s: { cover: [{ u0: -1, u1: 99, v1: 1.95 }] },
        e: { auto: false, cover: [{ u0: -1, u1: 99, v1: 99 }] },
      },
      chimneys: [{ x: 0.25, z: 0, above: 0.85 }],
    },
    'vallorsaia-front': {
      faces: {
        // the front: a central door under the loggia; the loggia's left bay has a parapet with geraniums, the
        // right bay opens to the floor where the stair arrives
        e: {
          auto: false,
          openings: [
            { kind: 'door', u: 2.0, w: 1.1, h: 2.15, lantern: 'right' },
            { kind: 'loggia', s: 1, u: 2.0, w: 2.5, h: 1.75, sill: 0.95 },
            { kind: 'loggia', s: 1, u: 5.35, w: 2.4, h: 2.7, sill: 0.0 },
          ],
        },
        n: { cover: [{ u0: -1, u1: 99, v1: -0.2 }], density: 0.5, boxRate: 0.3 },
        s: { cover: [{ u0: -1, u1: 1.3, v1: 1.95 }, { u0: 0.9, u1: 99, v1: -1.3 }], density: 0.6, boxRate: 0.4 },
        w: { skip: true },
      },
      skipGable: { w: true },
      chimneys: [{ x: -0.3, z: -0.4, w: 0.5, d: 0.5, above: 0.6 }],
    },
  };
}

export function buildVallorsaia({ pen, cutPen, movPen, L, model, groundAt, emit, rnd, picks }) {
  const V = L.vallorsaia;
  const villa = model.villas.find((v) => v.id === 'vallorsaia');
  const dress = vallorsaiaDress();
  const g = pen.inBand('grounds');
  villa.blocks.forEach((b) => {
    buildBlock(pen, cutPen, b, dress[b.id] || {}, { stone: STONE, rnd, emit });
    picks.block('vallorsaia', b);
  });
  const by = (id) => villa.blocks.find((b) => b.id === id);
  buildLoggia(pen, by('vallorsaia-front'), groundAt, emit);
  buildPortico(pen, by('vallorsaia-lower'), groundAt, emit);
  buildOldOven(g, by('vallorsaia-lower'));
  buildForecourt(g, V, by('vallorsaia-front'), groundAt, rnd);
  buildPool(g, movPen, V, groundAt, emit);
  buildTettoia(g, V, groundAt, emit, rnd);
  buildLookout(g, V, groundAt, rnd);
  buildShed(pen, V, groundAt, rnd);
  buildPaths(g, V, groundAt, rnd);
  picks.box('vallorsaia-tettoia', { c: V.tettoia.c, rot: V.tettoia.rot, length: V.tettoia.length, width: V.tettoia.width, y1: V.tettoia.floor, y2: V.tettoia.floor + 3.4 }, { villa: 'vallorsaia', place: 'vallorsaia-tettoia' });
  picks.box('vallorsaia-lookout', { c: V.lookout.c, rot: V.lookout.rot, length: V.lookout.length, width: V.lookout.width, y1: V.lookout.level - 0.5, y2: V.lookout.level + 1.2 }, { villa: 'vallorsaia', place: 'vallorsaia-lookout' });
  picks.box('vallorsaia-pool', { c: V.pool.c, rot: V.pool.rot, length: V.pool.length + 4, width: V.pool.width + 4, y1: V.deckLevel - 0.5, y2: V.deckLevel + 0.4 }, { villa: 'vallorsaia', place: 'vallorsaia-pool' });
}

// ---------- the loggia over the front, and the big stone stair up its right-hand side ----------

function buildLoggia(pen, b, groundAt, emit) {
  const s1 = b.floor + b.storeyH;
  const top = b.floor + b.storeys * b.storeyH + 0.1;
  const p = pen.inBand('s1').frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const x2 = b.length / 2 - WALL, x1 = b.length / 2 - 2.3;
  const z1 = -b.width / 2 + WALL, z2 = b.width / 2 - WALL;
  p.span('flag.crazy', x1, x2 + 0.02, s1 - 0.25, s1, z1, z2);
  p.span(STONE, x1 - WALL, x1, s1, top, z1, z2);
  // limewashed inside, so the open bays read as open; dark timber lintels across them
  p.span('plaster', x1, x1 + 0.02, s1, top - 0.3, z1, z2);
  for (const z of [z1, z2 - 0.02]) p.span('plaster', x1, x2, s1, top - 0.3, z, z + 0.02);
  const fp1 = faceAt(pen.inBand('s1'), b, 'e', 0, 0);
  [[0.75, 3.25, s1 + 0.95 + 1.75], [4.15, 6.55, s1 + 2.7]].forEach(([u0, u1, y]) => fp1.span('timber.dark', u0 - 0.15, u1 + 0.15, y - 0.01, y + 0.22, -WALL + 0.05, 0.03));
  // a planked door and a small window in the loggia's back wall, beams and boards over it
  const back = p.at(mat4({ x: x1, y: s1, z: 0.4, ry: Math.PI / 2 }));
  back.box('timber.walnut', 1.0, 2.05, 0.06, 0, 0, 0.03);
  back.box('timber.dark', 1.3, 0.16, 0.1, 0, 2.05, 0.05);
  back.box('glass.window', 0.6, 0.7, 0.02, -2.0, 1.1, 0.01);
  back.box('timber.walnut', 0.7, 0.06, 0.06, -2.0, 1.04, 0.03);
  for (let x = x1 + 0.3; x < x2; x += 0.55) p.span('timber.dark', x - 0.07, x + 0.07, top - 0.32, top - 0.14, z1, z2);
  p.span('boards.dark', x1, x2, top - 0.14, top - 0.04, z1, z2);
  // geraniums along the left bay's parapet
  windowBox(faceAt(pen.inBand('s1'), b, 'e', 2.0, s1 + 0.95).at(mat4({ z: -0.3 })), 2.3, { seed: 7 });
  // the stair: a landing in front of the right bay at the loggia's floor, the flight running on to the right
  // and down past the corner
  const fp = faceAt(pen.inBand('grounds'), b, 'e', 0, 0);
  const landing = { u1: 4.15, u2: 6.6, d: 1.35 };
  const n = 16, run = 0.3;
  const base = groundAt(...worldOf(b, b.length / 2 + 1.0, -b.width / 2 - 2.5)) - 0.2;
  const rise = (s1 - Math.min(base, b.floor)) / n;
  fp.span(STONE, landing.u1, landing.u2, b.floor - 1.0, s1 - 0.06, 0, landing.d);
  fp.span('stone.sandstone', landing.u1, landing.u2 + 0.02, s1 - 0.06, s1, 0, landing.d + 0.03);
  for (let i = 0; i < n; i++) {
    const u0 = landing.u2 + i * run;
    const y = s1 - (i + 1) * rise;
    fp.span(STONE, u0, u0 + run + 0.01, b.floor - 1.0, y - 0.05, 0, landing.d - 0.1);
    fp.span('stone.sandstone', u0 - 0.01, u0 + run + 0.01, y - 0.05, y, 0, landing.d - 0.07);
  }
  // a thin black iron handrail on the open side
  const rail = [];
  for (let i = -8; i <= n; i += 4) {
    const u = landing.u2 + i * run;
    rail.push(V3(u, (i < 0 ? s1 : s1 - i * rise) + 0.95, landing.d - 0.12));
  }
  fp.put('iron', tubeG(rail, 0.018, 5));
  for (let i = -8; i <= n; i += 4) fp.box('iron', 0.025, 0.95, 0.025, landing.u2 + i * run, i < 0 ? s1 : s1 - i * rise, landing.d - 0.12);
  pot(fp, landing.u1 + 0.35, s1, landing.d - 0.35, { flower: 'flower.red', r: 0.2, seed: 15 });
}

// ---------- the stair to the first-floor portico on square stone columns ----------

function buildPortico(pen, b, groundAt, emit) {
  const s1 = b.floor + b.storeyH;
  const fp = faceAt(pen.inBand('grounds'), b, 'w', 0, 0);
  const n = 15, run = 0.29;
  const landing = { u1: 1.15, u2: 3.0, d: 1.55 };
  const rise = (s1 - b.floor) / n;
  fp.span(STONE, landing.u1, landing.u2, b.floor - 1.5, s1 - 0.06, 0, landing.d);
  fp.span('stone.sandstone', landing.u1, landing.u2 + 0.02, s1 - 0.06, s1, 0, landing.d + 0.03);
  for (let i = 0; i < n; i++) {
    const u0 = landing.u2 + i * run;
    const y = s1 - (i + 1) * rise;
    fp.span(STONE, u0, u0 + run + 0.01, b.floor - 1.5, y - 0.05, 0, 1.1);
    fp.span('stone.sandstone', u0 - 0.01, u0 + run + 0.01, y - 0.05, y, 0, 1.13);
  }
  const rail = [V3(landing.u1 + 0.1, s1 + 0.95, landing.d - 0.08), V3(landing.u2, s1 + 0.95, 1.02)];
  for (let i = 0; i <= n; i += 5) rail.push(V3(landing.u2 + i * run, s1 - i * rise + 0.95, 1.02));
  fp.put('iron', tubeG(rail, 0.018, 5));
  // two square stone columns and a lean-to coppi roof against the wall
  const colH = 2.35;
  [landing.u1 + 0.2, landing.u2 - 0.2].forEach((u) => fp.span('stone.sandstone', u - 0.19, u + 0.19, s1, s1 + colH, landing.d - 0.38, landing.d));
  fp.span('timber.dark', landing.u1, landing.u2, s1 + colH, s1 + colH + 0.18, landing.d - 0.34, landing.d - 0.06);
  const rp = fp.frame(mat4({ x: (landing.u1 + landing.u2) / 2, z: landing.d / 2 + 0.05 }));
  blockRoof(rp, { length: landing.u2 - landing.u1 + 0.3, width: landing.d + 0.1, roof: 'lean', lean: 'n', ridgeOver: 0.45 }, { stone: STONE, top: s1 + colH + 0.2, eavesCourse: null, skipGable: { e: true, w: true } });
  pot(fp, landing.u1 + 0.3, s1, landing.d - 0.75, { flower: 'flower.red', r: 0.18, seed: 17 });
  pot(fp, landing.u2 - 0.55, s1, 0.35, { flower: 'flower.red', r: 0.2, seed: 18 });
  lantern(fp, landing.u1 + 1.4, s1 + 2.25, emit, { arm: 0.3 });
}

// ---------- the old bread oven: a half-round stone bump on the wall, roofed with flat stone slabs ----------

function buildOldOven(g, b) {
  const fp = faceAt(g, b, 's', 1.25, b.floor);
  const r = 0.95, h = 1.25;
  const body = cylG(r, r * 1.02, h, 14, false, -Math.PI / 2, Math.PI);
  fp.put(STONE, body, mat4({ z: -0.1 }));
  for (let i = 0; i < 5; i++) {
    const slab = new THREE.CylinderGeometry(r + 0.18 - i * 0.2, r + 0.22 - i * 0.2, 0.08, 14, 1, false, -Math.PI / 2, Math.PI);
    slab.translate(0, h + 0.04 + i * 0.07, -0.1);
    fp.put('stone.dry', slab);
  }
  fp.box('iron', 0.42, 0.36, 0.03, 0, 0.55, r - 0.08);
  fp.box('stone.sandstone', 0.7, 0.08, 0.3, 0, 0.47, r - 0.1);
}

// ---------- the forecourt: a paved apron, then gravel, under the big oak ----------

function buildForecourt(g, V, b, groundAt, rnd) {
  const fc = V.forecourt;
  const p = g.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  p.span('flag.crazy', b.length / 2, b.length / 2 + fc.apron, fc.level - 0.3, fc.level, -b.width / 2 - 0.5, b.width / 2 + 0.5);
  // the rusty spoked iron wheel and the iron tractor seat on the lawn
  const [wx, wz] = V.wheel;
  const wy = groundAt(wx, wz);
  const wp = g.at(mat4({ x: wx, y: wy, z: wz, ry: b.rot + 0.4 }));
  const rim = new THREE.TorusGeometry(0.62, 0.035, 5, 22);
  wp.put('iron.rust', rim, mat4({ y: 0.6 }));
  for (let i = 0; i < 10; i++) wp.put('iron.rust', barG(V3(0, 0.6, 0), V3(Math.cos((i * Math.PI) / 5) * 0.6, 0.6 + Math.sin((i * Math.PI) / 5) * 0.6, 0), 0.025, 0.025));
  wp.put('iron.rust', cylG(0.09, 0.09, 0.16, 8), mat4({ y: 0.6, rx: Math.PI / 2, z: -0.08 }));
  const [sx, sz] = V.seat;
  const sp = g.at(mat4({ x: sx, y: groundAt(sx, sz), z: sz, ry: 0.7 }));
  sp.put('iron', barG(V3(0, 0, 0), V3(0.1, 0.55, 0.15), 0.05, 0.05));
  const seat = new THREE.CylinderGeometry(0.24, 0.22, 0.05, 10, 1, false);
  seat.translate(0.12, 0.58, 0.2);
  sp.put('iron.rust', seat);
  sp.box('iron.rust', 0.4, 0.22, 0.04, 0.12, 0.6, 0.0);
}

// ---------- the pool above the house: sawn grey slabs, a pale rounded coping, teal loungers at the lawn edge ----------

function buildPool(g, movPen, V, groundAt, emit) {
  const P = V.pool, y = V.deckLevel, Lp = P.length, Wp = P.width;
  const p = g.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  const lining = 'coping.pale';
  p.span(lining, -Lp / 2, Lp / 2, y - 1.8, y - 1.5, -Wp / 2, Wp / 2);
  p.span(lining, -Lp / 2 - 0.3, -Lp / 2, y - 1.8, y - 0.02, -Wp / 2 - 0.3, Wp / 2 + 0.3);
  p.span(lining, Lp / 2, Lp / 2 + 0.3, y - 1.8, y - 0.02, -Wp / 2 - 0.3, Wp / 2 + 0.3);
  for (const k of [-1, 1]) p.span(lining, -Lp / 2, Lp / 2, y - 1.8, y - 0.02, k > 0 ? Wp / 2 : -Wp / 2 - 0.3, k > 0 ? Wp / 2 + 0.3 : -Wp / 2);
  // steps at the shallow (south) end
  for (let i = 0; i < 3; i++) p.span(lining, Lp / 2 - 0.9 - i * 0.35, Lp / 2, y - 1.5, y - 0.3 - i * 0.3, -Wp / 2, -Wp / 2 + 1.6);
  // the coping: crisp, pale, with a rounded nose
  const cop = [[-Lp / 2 - 0.35, Lp / 2 + 0.35, -Wp / 2 - 0.35, -Wp / 2], [-Lp / 2 - 0.35, Lp / 2 + 0.35, Wp / 2, Wp / 2 + 0.35], [-Lp / 2 - 0.35, -Lp / 2, -Wp / 2, Wp / 2], [Lp / 2, Lp / 2 + 0.35, -Wp / 2, Wp / 2]];
  cop.forEach(([x1, x2, z1, z2]) => p.span('coping.pale', x1, x2, y - 0.07, y + 0.01, z1, z2));
  for (const k of [-1, 1]) {
    const nose = cylG(0.04, 0.04, Lp + 0.7, 8);
    nose.rotateZ(Math.PI / 2);
    p.put('coping.pale', nose, mat4({ x: (Lp + 0.7) / 2, y: y - 0.03, z: k * (Wp / 2 + 0.01) }));
  }
  V.deck.forEach((r) => p.span('slab.grey', r.x1, r.x2, y - 0.1, y - 0.005, r.z1, r.z2));
  V.deck.forEach((r) => p.span('stone.dry', r.x1, r.x2, y - 2.4, y - 0.1, r.z1, r.z2));
  // timber rail fences on the lawn edges, all round
  const fence = [[-8.2, -6.4], [8.2, -6.4], [8.2, 4.6], [-8.2, 4.6], [-8.2, -2.2]];
  F.splitRail(p, fence, () => y, { seed: 13, h: 1.1, every: 2.0 });
  F.poolLadder(p.at(mat4({ x: -Lp / 2 + 0.05, y, z: 1.0, ry: -Math.PI / 2 })));
  F.poolShower(p.at(mat4({ x: 7.3, y, z: -5.6 })));
  const lp = movPen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  for (let i = 0; i < 7; i++) F.lounger(lp.at(mat4({ x: -5.2 + i * 1.6, y, z: -4.45, ry: Math.PI })));
  emit('pool', g.world(P.c[0], y - 0.6, P.c[1]), { pool: 'vallorsaia' });
}

// ---------- the tettoia: timber posts with knee braces, the twin barbecue hearths in its stone back wall ----------

function buildTettoia(g, V, groundAt, emit, rnd) {
  const T = V.tettoia, y0 = T.floor, Lt = T.length, Wt = T.width;
  const p = g.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
  // -z is the back (uphill), +z opens to the lawn
  p.span('slab.grey', -Lt / 2, Lt / 2, y0 - 0.25, y0, -Wt / 2, Wt / 2);
  p.span('stone.dry', -Lt / 2, Lt / 2, y0 - 2.5, y0 - 0.25, -Wt / 2, Wt / 2);
  const postH = 2.55;
  const xs = [0, 1, 2, 3].map((i) => -Lt / 2 + 0.15 + (i * (Lt - 0.3)) / 3);
  xs.forEach((x) => p.span('timber.honey', x - 0.11, x + 0.11, y0, y0 + postH, Wt / 2 - 0.26, Wt / 2 - 0.04));
  // the stone back wall, the retaining wall behind it
  p.span(STONE, -Lt / 2, Lt / 2, y0, y0 + postH + 0.65, -Wt / 2, -Wt / 2 + 0.55);
  const behind = groundAt(...T.w(0, -Wt / 2 - 2.5));
  p.span('stone.dry', -Lt / 2 - 3, Lt / 2 + 3, y0 - 0.3, Math.max(y0 + 1.2, behind + 0.3), -Wt / 2 - 1.3, -Wt / 2 - 0.55);
  // heavy beams, knee braces at each post, rafters, a lean-to roof of coppi
  p.span('timber.honey', -Lt / 2 - 0.2, Lt / 2 + 0.2, y0 + postH, y0 + postH + 0.26, Wt / 2 - 0.28, Wt / 2 - 0.02);
  xs.forEach((x) => {
    for (const k of [-1, 1]) if ((k < 0 && x > -Lt / 2 + 0.3) || (k > 0 && x < Lt / 2 - 0.3)) p.put('timber.honey', barG(V3(x + k * 0.08, y0 + postH - 0.75, Wt / 2 - 0.15), V3(x + k * 0.72, y0 + postH + 0.02, Wt / 2 - 0.15), 0.1, 0.1));
    p.span('timber.honey', x - 0.09, x + 0.09, y0 + postH + 0.02, y0 + postH + 0.24, -Wt / 2 + 0.3, Wt / 2 - 0.02);
    p.put('timber.honey', barG(V3(x, y0 + postH - 0.6, Wt / 2 - 0.15), V3(x, y0 + postH + 0.05, Wt / 2 - 0.85), 0.1, 0.1));
  });
  const top = y0 + postH + 0.3;
  blockRoof(p, { length: Lt, width: Wt, roof: 'lean', lean: 'n', ridgeOver: 0.6 }, { stone: STONE, top, under: 'boards.dark', eavesCourse: null, skipGable: { e: true, w: true } });
  for (let x = -Lt / 2 + 0.2; x < Lt / 2; x += 0.5) p.put('timber.dark', barG(V3(x, top - 0.06, Wt / 2 + 0.35), V3(x, top + 0.48, -Wt / 2 + 0.4), 0.07, 0.07));
  // small metal pendant lamps from the beams
  [-2.2, 0, 2.2].forEach((x) => {
    p.box('iron', 0.012, 0.6, 0.012, x, top - 0.65, 0.4);
    const shade = new THREE.ConeGeometry(0.16, 0.14, 10, 1, true);
    shade.translate(x, top - 0.72, 0.4);
    p.put('iron', shade);
    p.put('lamp.warm', new THREE.SphereGeometry(0.05, 6, 4), mat4({ x, y: top - 0.8, z: 0.4 }));
    emit('pendant', p.world(x, top - 0.82, 0.4));
  });
  // the twin barbecue hearths: pale firebrick, brick ribs for the grills, a blackened stone lintel across both,
  // a flat hearth ledge, a stone hood and flue
  const wz = -Wt / 2 + 0.55;
  const hy = y0 + 0.85;
  const hw = 0.72, hh = 0.62;
  [-0.48, 0.48].forEach((x) => {
    p.span('firebrick', x - hw / 2, x + hw / 2, hy, hy + hh, wz - 0.45, wz + 0.02);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) p.span('brick', x + s * hw / 2 - (s > 0 ? 0.06 : 0), x + s * hw / 2 + (s > 0 ? 0 : 0.06), hy + 0.12 + k * 0.15, hy + 0.16 + k * 0.15, wz - 0.42, wz + 0.02);
    p.span('soot', x - hw / 2 + 0.04, x + hw / 2 - 0.04, hy + 0.01, hy + 0.05, wz - 0.42, wz);
    for (let i = 0; i < 8; i++) p.box('iron', 0.012, 0.012, 0.42, x - hw / 2 + 0.08 + i * 0.08, hy + 0.27, wz - 0.2);
  });
  p.span(STONE, -1.6, 1.6, y0, hy, wz, wz + 0.5);
  p.span(STONE, -1.6, -0.84, hy, hy + hh, wz, wz + 0.5);
  p.span(STONE, 0.84, 1.6, hy, hy + hh, wz, wz + 0.5);
  p.span(STONE, -0.12, 0.12, hy, hy + hh, wz, wz + 0.5);
  p.span('stone.sandstone', -1.65, 1.65, hy - 0.06, hy, wz + 0.45, wz + 0.72);
  p.span('soot', -1.3, 1.3, hy + hh, hy + hh + 0.2, wz + 0.4, wz + 0.56);
  p.put(STONE, cylG(0.55, 1.25, 0.95, 4, false, Math.PI / 4), mat4({ y: hy + hh + 0.2, z: wz + 0.18, sz: 0.55 }));
  p.span(STONE, -0.35, 0.35, hy + hh + 1.1, top + 1.45, wz - 0.3, wz + 0.3);
  // long wooden tables end to end, honey ladder-back chairs with rush seats
  [-1.9, 1.9].forEach((x) => F.refectory(p.at(mat4({ x, y: y0, z: 0.75 })), { length: 3.6, wood: 'timber.oak', benches: false }));
  for (let i = 0; i < 10; i++) {
    const x = -3.4 + i * 0.76;
    F.rushChair(p.at(mat4({ x, y: y0, z: 1.5, ry: Math.PI })));
    F.rushChair(p.at(mat4({ x: x + 0.05, y: y0, z: 0.0 })));
  }
}

// ---------- the lookout and the lake terrace ----------

function buildLookout(g, V, groundAt, rnd) {
  const T = V.lookout, y = T.level;
  const p = g.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
  const Lt = T.length, Wt = T.width;
  // +z faces the lake (downhill); the low wall with a flat coping, rough stone piers, peeled timber rails
  const zEdge = Wt / 2;
  const nPier = 6;
  const piers = [];
  for (let i = 0; i < nPier; i++) piers.push(-Lt / 2 + 0.3 + (i * (Lt - 0.6)) / (nPier - 1));
  const gy = Math.min(...piers.map((x) => groundAt(...T.w(x, zEdge + 1.0))));
  p.span('stone.dry', -Lt / 2, Lt / 2, Math.min(gy, y) - 1.2, y + 0.45, zEdge - 0.45, zEdge);
  p.span('stone.sandstone', -Lt / 2 - 0.04, Lt / 2 + 0.04, y + 0.45, y + 0.53, zEdge - 0.5, zEdge + 0.04);
  piers.forEach((x, i) => F.roughBlock(p, x, y + 0.5, zEdge - 0.22, { w: 0.48, h: 0.75, d: 0.48, seed: 300 + i, stone: 'stone.vallorsaia' }));
  for (let i = 1; i < piers.length; i++) {
    for (const t of [0.85, 1.12]) p.put('timber.rough', barG(V3(piers[i - 1] + 0.2, y + t, zEdge - 0.22), V3(piers[i] - 0.2, y + t + (rnd() - 0.5) * 0.04, zEdge - 0.22), 0.09, 0.08));
  }
  // the side edges: split rails down the slope
  F.splitRail(p, [[-Lt / 2, zEdge - 0.3], [-Lt / 2, -Wt / 2 + 0.5]], (x, z) => Math.max(y, groundAt(...T.w(x, z))), { seed: 41 });
  F.splitRail(p, [[Lt / 2, zEdge - 0.3], [Lt / 2, -Wt / 2 + 0.5]], (x, z) => Math.max(y, groundAt(...T.w(x, z))), { seed: 42 });
  // the dry-stone wall that holds the slope up behind the terrace, with stone steps down to it
  const upY = groundAt(...T.w(0, -Wt / 2 - 1.2));
  p.span('stone.dry', -Lt / 2, Lt / 2, y - 0.3, Math.max(y + 0.6, upY), -Wt / 2 - 0.5, -Wt / 2);
  const nS = Math.max(2, Math.round((upY - y) / 0.18));
  for (let i = 0; i < nS; i++) p.span('stone.sandstone', -0.75 - 0.0, 0.75, y - 0.2, y + (i + 1) * ((upY - y) / nS), -Wt / 2 - 0.5 - i * 0.0 + (nS - i) * 0.3 - 0.3 * nS, -Wt / 2 - 0.5 + (nS - i) * 0.3 - 0.3 * nS + 0.32);
  // wooden picnic tables with their benches fixed on
  [[-4.2, 1.2, 0.1], [0.6, 2.0, -0.05], [4.8, 0.9, 0.12]].forEach(([x, z, ry]) => F.picnicTable(p.at(mat4({ x, y, z, ry })), { length: 2.0 }));
}

// ---------- a small stone building up the slope ----------

function buildShed(pen, V, groundAt, rnd) {
  const s = V.shed;
  const gy = groundAt(...s.c);
  const b = { id: 'vallorsaia-shed', c: s.c, rot: s.rot, length: s.length, width: s.width, floor: gy + 0.1, storeys: 1, storeyH: 2.6, ridgeOver: 0.9, roof: 'gable', groundMin: gy - 0.6 };
  const dress = { faces: { s: { auto: false, openings: [{ kind: 'door', u: 2.1, w: 0.9, h: 1.9 }] }, n: { auto: false }, e: { auto: false, openings: [{ kind: 'window', u: 1.15, w: 0.5, h: 0.5, sill: 1.3 }] }, w: { auto: false } } };
  buildBlock(pen, null, b, dress, { stone: STONE, rnd, emit: null, bandOf: () => 'grounds', roofPen: pen.inBand('grounds') });
}

// ---------- paths: stone steps up from the forecourt to the pool, split-rail fences beside them ----------

function buildPaths(g, V, groundAt, rnd) {
  const a = V.forecourt.w(0, -V.forecourt.width / 2 + 1.0);
  const b = V.pool.w(-V.pool.length / 2 - 1.2, 3.8);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.round(len / 1.1);
  const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    g.put('stone.sandstone', new THREE.BoxGeometry(0.42, 0.16, 1.3), mat4({ x, y: groundAt(x, z) - 0.04, z, ry }));
  }
  const side = [Math.sin(ry) * 0.95, Math.cos(ry) * 0.95];
  F.splitRail(g, [[a[0] + side[0], a[1] + side[1]], [b[0] + side[0], b[1] + side[1]]], groundAt, { seed: 51 });
}

export function worldOf(b, lx, lz) {
  const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
  return [b.c[0] + lx * cs + lz * sn, b.c[1] - lx * sn + lz * cs];
}
