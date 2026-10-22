// Villa Santarsa as the listing photos show it (villa-detail.md): three parts in a row, the covered stone stair,
// the raised flagstone terrace, the gravel in front of the tall block, the new pool with its jet bay at the east
// end, crazy-paved deck, rust-bronze railing, teal loungers and square ecru umbrellas, the tettoia on stone piers
// at the east end with the wood oven built into its back wall, the outbuildings and (probably) the chapel.
import { THREE, V3, mat4, cylG, prismG, barG, tubeG, seeded, wallStrip } from './kit.js';
import { buildBlock, faceAt, lantern, pot } from './houses.js';
import { WALL, blockRoof, chimney, gutter, boxAlong } from './roofs.js';
import * as F from './furniture.js';

const STONE = 'stone.santarsa';

// Openings per block and face (u in metres from the face's left end seen from outside; s storey; sill above that
// storey's floor). Faces: s south (the front), n north, e east, w west. Auto windows fill faces left open to them.
export function santarsaDress(L) {
  const wing = L.santarsa.wingBlock;
  return {
    'santarsa-west': {
      faces: {
        s: {
          auto: false,
          openings: [
            { kind: 'barn', u: 2.9, w: 2.3, h: 2.45, lantern: 'left' },
            { kind: 'glazed', u: 6.0, w: 1.15, h: 2.25, pots: 'flower.red' },
            { kind: 'barn', u: 9.0, w: 2.3, h: 2.45, lantern: 'right' },
            { kind: 'window', u: 16.7, w: 0.7, h: 0.75, sill: 1.15 },
          ],
        },
        n: { openings: [{ kind: 'door', u: 12.6, w: 1.0, h: 2.1, lantern: 'left' }], density: 0.4 },
        w: { openings: [{ kind: 'window', u: 4.0, w: 0.8, h: 0.95, sill: 1.1, shutters: true }], auto: false },
        e: { skip: true },
      },
      skipGable: { e: true },
      chimneys: [{ x: -0.12, z: -0.62, w: 0.9, d: 0.75, above: 0.7 }],
      gutters: [0],
      _wing: wing,
    },
    'santarsa-tall': {
      faces: {
        s: {
          auto: false,
          openings: [
            { kind: 'arch', u: 4.9, w: 1.3, h: 2.05, lantern: 'both', lanternDy: 2.95, pots: 'flower.red' },
            { kind: 'window', u: 1.6, w: 0.8, h: 0.9, sill: 1.25, shutters: true },
            { kind: 'window', s: 1, u: 2.0, w: 0.85, h: 1.0, sill: 0.95, shutters: true, box: true },
            { kind: 'window', s: 1, u: 7.4, w: 0.8, h: 0.95, sill: 1.05, box: true },
            { kind: 'window', s: 2, u: 3.2, w: 0.75, h: 0.85, sill: 1.0 },
            { kind: 'window', s: 2, u: 8.0, w: 0.8, h: 0.9, sill: 0.9, shutters: true },
          ],
        },
        // the covered stair arrives at a first-floor door on the strip of west wall in front of the wing
        w: { auto: false, openings: [{ kind: 'door', s: 1, u: 9.15, w: 0.8, h: 2.0, sill: 0, lantern: 'left', lanternDy: 2.35 }] },
        e: { auto: false, openings: [{ kind: 'window', s: 2, u: 2.0, w: 0.7, h: 0.75, sill: 1.6 }] },
        n: { openings: [{ kind: 'door', u: 3.0, w: 1.0, h: 2.1, lantern: 'right' }], density: 0.45 },
      },
      chimneys: [{ x: 0.32, z: 0, above: 1.05 }],
    },
    'santarsa-east': {
      faces: {
        s: {
          auto: false,
          openings: [
            { kind: 'door', u: 2.1, w: 1.0, h: 2.1, lantern: 'right', pots: 'flower.red' },
            { kind: 'window', u: 5.9, w: 0.85, h: 0.95, sill: 1.1, shutters: true, box: true },
            { kind: 'window', s: 1, u: 1.6, w: 0.8, h: 0.9, sill: 1.0 },
            { kind: 'window', s: 1, u: 4.8, w: 0.75, h: 0.85, sill: 1.1, shutters: true, box: true },
            { kind: 'window', s: 1, u: 7.3, w: 0.8, h: 0.9, sill: 0.95 },
          ],
        },
        e: {
          auto: false,
          openings: [
            { kind: 'stable', u: 4.9, w: 1.25, h: 2.2 },
            { kind: 'window', s: 1, u: 3.0, w: 0.8, h: 0.9, sill: 1.0 },
            { kind: 'window', s: 1, u: 7.4, w: 0.7, h: 0.8, sill: 1.15, shutters: true },
          ],
        },
        n: { openings: [{ kind: 'door', u: 4.4, w: 1.0, h: 2.1 }], density: 0.5 },
        w: { skip: true },
      },
      skipGable: { w: true },
      chimneys: [{ x: -0.45, z: -0.45, above: 0.6 }],
      gutters: [0],
    },
  };
}

export function buildSantarsa({ pen, cutPen, movPen, L, model, groundAt, emit, rnd, picks }) {
  const S = L.santarsa;
  const villa = model.villas.find((v) => v.id === 'santarsa');
  const dress = santarsaDress(L);
  const g = pen.inBand('grounds');
  const blocks = villa.blocks.map((b) => {
    const built = buildBlock(pen, cutPen, b, dress[b.id] || {}, { stone: STONE, rnd, emit });
    picks.block('santarsa', b);
    return built;
  });
  // stable door pots
  const east = villa.blocks.find((b) => b.id === 'santarsa-east');
  const eFace = faceAt(g, east, 'e', 4.9, east.floor);
  pot(eFace, -1.0, 0, 0.35, { seed: 11 });
  pot(eFace, 1.0, 0, 0.35, { seed: 12 });
  buildStair(g, S, villa);
  buildTerrace(g, S, groundAt, rnd);
  buildForecourt(g, S, groundAt, rnd);
  buildPool(g, movPen, S, groundAt, emit, rnd);
  buildTettoia(pen, movPen, S, groundAt, emit, rnd);
  buildOutbuildings(pen, cutPen, S, groundAt, emit, rnd, picks);
  buildGrounds(g, S, groundAt, rnd);
  picks.box('santarsa-tettoia', { c: S.tettoia.c, rot: S.tettoia.rot, length: S.tettoia.length, width: S.tettoia.width, y1: S.tettoia.floor, y2: S.tettoia.floor + 4.6 }, { villa: 'santarsa', place: 'santarsa-terrace' });
  picks.box('santarsa-pool', { c: S.pool.c, rot: S.pool.rot, length: S.pool.length + 4, width: S.pool.width + 4, y1: S.deckLevel - 0.5, y2: S.deckLevel + 0.4 }, { villa: 'santarsa', place: 'santarsa-pool' });
  return { blocks };
}

// ---------- the covered stone stair up to the tall block's first floor, under a lean-to on a stone pier ----------

function buildStair(g, S, villa) {
  const st = S.stair;
  const p = g.frame(mat4({ x: S.wing.c[0], z: S.wing.c[1], ry: S.wing.rot }));
  const n = 18;
  const rise = (st.top - st.bottom) / n;
  const run = (st.x2 - st.x1) / n;
  const zIn = S.wingBlock.width / 2;
  // the solid stone body under the treads, stepped
  for (let i = 0; i < n; i++) {
    const x0 = st.x1 + i * run;
    p.span(STONE, x0, x0 + run + 0.02, st.bottom - 1.2, st.bottom + (i + 1) * rise - 0.06, zIn, st.z2);
    p.span('stone.sandstone', x0 - 0.02, x0 + run + 0.02, st.bottom + (i + 1) * rise - 0.06, st.bottom + (i + 1) * rise, st.z1, st.z2 + 0.03);
  }
  // the landing at the top, in front of the door
  const lx1 = st.landing.x1, lx2 = st.landing.x2;
  p.span(STONE, lx1, lx2, st.bottom - 1.2, st.top - 0.08, zIn, st.z2 + 0.32);
  p.span('stone.sandstone', lx1 - 0.02, lx2, st.top - 0.08, st.top, st.z1, st.z2 + 0.34);
  // a low parapet on the open side
  p.span(STONE, st.x1 + 1.2, lx2 - 0.0, st.bottom, st.top + 0.75, st.z2 + 0.02, st.z2 + 0.32);
  for (let i = 0; i < n; i++) {
    const x0 = st.x1 + i * run;
    if (x0 < st.x1 + 1.2) continue;
    p.span(STONE, x0, x0 + run, st.bottom, st.bottom + (i + 1) * rise + 0.75, st.z2 + 0.02, st.z2 + 0.32);
  }
  // the pier and the little lean-to roof of coppi, leaning on the tall block's west wall
  const pierX = lx1 + 0.3, pierZ = st.z2 + 0.17;
  p.span(STONE, pierX - 0.25, pierX + 0.25, st.top, st.top + 2.1, pierZ - 0.25, pierZ + 0.25);
  // the roof's frame is turned so its high side (+z) leans on the tall block's west wall (the wing frame's +x)
  const rp = p.frame(mat4({ x: (lx1 + lx2) / 2 + 0.05, z: (st.z1 + st.z2) / 2 + 0.5, ry: Math.PI / 2 }));
  blockRoof(rp, { length: st.z2 - st.z1 + 1.4, width: lx2 - lx1 + 0.6, roof: 'lean', lean: 's', ridgeOver: 0.5 }, { stone: STONE, top: st.top + 2.15, eavesCourse: null, skipGable: { e: true, w: true } });
  p.box('timber.dark', 0.18, 0.2, st.z2 - st.z1 + 1.2, pierX, st.top + 2.1, (st.z1 + st.z2) / 2 + 0.5);
  // the iron handrail along the wall
  const hr = [];
  for (let i = 0; i <= n; i += 3) hr.push(V3(st.x1 + i * run, st.bottom + i * rise + 0.95, zIn + 0.08));
  p.put('iron', tubeG(hr, 0.02, 5));
}

// ---------- the raised flagstone terrace along the west wing ----------

function buildTerrace(g, S, groundAt, rnd) {
  const t = S.terrace;
  const p = g.frame(mat4({ x: S.wing.c[0], z: S.wing.c[1], ry: S.wing.rot }));
  const lowest = Math.min(...[[t.x1, t.z2], [t.x2, t.z2], [(t.x1 + t.x2) / 2, t.z2]].map(([x, z]) => groundAt(...S.wing.w(x, z))));
  p.span(STONE, t.x1, t.x2, lowest - 1.0, t.level - 0.08, t.z1, t.z2);
  p.span('flag.crazy', t.x1, t.x2, t.level - 0.08, t.level, t.z1, t.z2 - 0.32);
  // the stone kerb along its edge, and steps down to the lawn in the middle
  const steps = { x1: -4.6, x2: -2.6 };
  p.span('stone.sandstone', t.x1, steps.x1, t.level - 0.1, t.level + 0.06, t.z2 - 0.34, t.z2);
  p.span('stone.sandstone', steps.x2, t.x2, t.level - 0.1, t.level + 0.06, t.z2 - 0.34, t.z2);
  p.span('stone.sandstone', t.x1, t.x1 + 0.32, t.level - 0.1, t.level + 0.06, t.z1, t.z2);
  // steps of 17 cm risers and 32 cm treads, down until they meet the lawn, each one solid to the ground
  const stepX = (steps.x1 + steps.x2) / 2;
  const foot = groundAt(...S.wing.w(stepX, t.z2 + 0.6));
  const nSteps = Math.max(1, Math.min(7, Math.round((t.level - foot) / 0.17)));
  const riser = (t.level - foot) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    const top = t.level - (i + 1) * riser, z0 = t.z2 - 0.3 + i * 0.3;
    p.span('stone.sandstone', steps.x1, steps.x2, foot - 0.4, top + 0.02, z0, z0 + 0.32);
  }
  // wooden garden tables with folding slatted chairs
  [[-7.2, t.z1 + 2.2], [-0.8, t.z1 + 2.3]].forEach(([x, z], k) => {
    const tp = p.at(mat4({ x, y: t.level, z, ry: k * 0.08 }));
    F.slattedTable(tp, { length: 1.8, width: 0.85 });
    [[-0.5, 0.75, 0], [0.5, 0.75, 0.1], [-0.5, -0.75, Math.PI], [0.5, -0.75, Math.PI - 0.15]].forEach(([cx, cz, ry]) => F.slattedChair(tp.at(mat4({ x: cx, z: cz, ry }))));
  });
  const [sx, sz] = S.standingStone;
  F.standingStone(g, sx, t.level - 0.05, sz, { h: 1.65 });
}

// ---------- gravel in front of the tall block: big rough sandstone blocks as kerbs and seats ----------

function buildForecourt(g, S, groundAt, rnd) {
  const f = S.forecourt;
  const p = g.frame(mat4({ x: S.wing.c[0], z: S.wing.c[1], ry: S.wing.rot }));
  // the dry-stone wall that holds the gravel up, where the lawn falls away in front of it
  const span = f.x2 - f.x1;
  const n = Math.ceil(span / 1.5);
  const wall = [];
  for (let i = 0; i <= n; i++) {
    const x = f.x1 + (span * i) / n;
    wall.push([x, f.z2 + 0.17, f.level - 0.05, Math.min(f.level - 0.3, groundAt(...S.wing.w(x, f.z2 + 0.8)))]);
  }
  wallStrip(p, 'stone.dry', wall, { thick: 0.55, sink: 0.4 });
  let x = f.x1 + 0.6, k = 0;
  while (x < f.x2 - 0.6) {
    const w = 0.85 + rnd() * 0.4;
    if (x > f.x1 + 6.0 && x < f.x1 + 8.0) { x += 2.2; continue; }      // a gap opposite the arched door
    F.roughBlock(p, x + w / 2, f.level, f.z2 + 0.05, { w, h: 0.42 + rnd() * 0.12, d: 0.55, seed: 40 + k++ });
    x += w + 0.08 + rnd() * 0.15;
  }
  // a few squared cube seats
  [[f.x1 + 3.2, f.z1 + 1.6], [f.x1 + 3.9, f.z1 + 1.7], [f.x2 - 4.0, f.z1 + 1.5]].forEach(([cx, cz], i) => p.box('stone.sandstone', 0.45, 0.45, 0.45, cx, f.level, cz, 0.2 * i));
}

// ---------- the pool ----------

function buildPool(g, movPen, S, groundAt, emit, rnd) {
  const P = S.pool, y = S.deckLevel;
  const Lp = P.length, Wp = P.width;
  const p = g.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  const lining = 'tile.pool';
  const deep = 1.5, bayDepth = 0.6;
  const bx = S.bay.x1;
  // the basin: walls and floor seen from the water
  p.span(lining, -Lp / 2, bx, y - deep - 0.3, y - deep, -Wp / 2, Wp / 2);
  p.span(lining, bx, Lp / 2, y - bayDepth - 0.3, y - bayDepth, -Wp / 2, Wp / 2);
  p.span(lining, -Lp / 2 - 0.3, -Lp / 2, y - deep - 0.3, y - 0.02, -Wp / 2 - 0.3, Wp / 2 + 0.3);
  p.span(lining, Lp / 2, Lp / 2 + 0.3, y - bayDepth - 0.3, y - 0.02, -Wp / 2 - 0.3, Wp / 2 + 0.3);
  for (const k of [-1, 1]) p.span(lining, -Lp / 2, Lp / 2, y - deep - 0.3, y - 0.02, k > 0 ? Wp / 2 : -Wp / 2 - 0.3, k > 0 ? Wp / 2 + 0.3 : -Wp / 2);
  // the submerged wall that parts the jet bay, its top under the water, with seat ledges and steps in the bay
  p.span(lining, bx - 0.25, bx, y - deep, y - 0.32, -Wp / 2, Wp / 2);
  p.span(lining, bx, bx + 0.42, y - bayDepth, y - 0.32, -Wp / 2, Wp / 2);
  for (const k of [-1, 1]) p.span(lining, bx + 0.42, Lp / 2, y - bayDepth, y - 0.32, k > 0 ? Wp / 2 - 0.42 : -Wp / 2, k > 0 ? Wp / 2 : -Wp / 2 + 0.42);
  p.span(lining, Lp / 2 - 0.42, Lp / 2, y - bayDepth, y - 0.32, -Wp / 2 + 0.42, Wp / 2 - 0.42);
  p.span(lining, Lp / 2 - 0.9, Lp / 2 - 0.42, y - bayDepth, y - 0.2, -Wp / 2 + 0.42, -Wp / 2 + 1.4);
  // coping
  p.span('coping.pale', -Lp / 2 - 0.32, Lp / 2 + 0.32, y - 0.06, y + 0.02, -Wp / 2 - 0.32, -Wp / 2);
  p.span('coping.pale', -Lp / 2 - 0.32, Lp / 2 + 0.32, y - 0.06, y + 0.02, Wp / 2, Wp / 2 + 0.32);
  p.span('coping.pale', -Lp / 2 - 0.32, -Lp / 2, y - 0.06, y + 0.02, -Wp / 2, Wp / 2);
  p.span('coping.pale', Lp / 2, Lp / 2 + 0.32, y - 0.06, y + 0.02, -Wp / 2, Wp / 2);
  // the crazy-paved deck, a slab with stone under it where the ground falls away
  S.deck.forEach((r) => p.span('flag.crazy', r.x1, r.x2, y - 0.12, y - 0.005, r.z1, r.z2));
  S.deck.forEach((r) => p.span('stone.dry', r.x1, r.x2, y - 2.6, y - 0.12, r.z1, r.z2));
  S.lawnStrips.forEach((r) => p.span('stone.dry', r.x1, r.x2, y - 2.6, y - 0.2, r.z1, r.z2));
  // the low stone wall on the valley side, and the rust-bronze railing of thin bars all round
  const valley = S.valleyEdge;
  const low = [];
  for (let i = 1; i < valley.length; i++) {
    const [ax, az] = valley[i - 1], [cx, cz] = valley[i];
    const n = Math.max(1, Math.round(Math.hypot(cx - ax, cz - az) / 1.5));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const x = ax + ((cx - ax) * k) / n, z = az + ((cz - az) * k) / n;
      low.push([x, z, y + 0.28, Math.min(y - 0.3, groundAt(...P.w(x, z)))]);
    }
  }
  wallStrip(p, 'stone.dry', low, { thick: 0.42, sink: 0.6 });
  F.barRailing(p, valley.map(([x, z]) => [x, z, y + 0.28]), { h: 0.98, metal: 'iron.rust' });
  // the black iron fence and gate between the house's gravel and the deck
  const gt = S.gate, nf = S.northFence;
  F.barRailing(p, [[nf[0][0], gt.z, y], [gt.x - gt.w / 2, gt.z, y]], { h: 1.15, metal: 'iron', gap: 0.13 });
  F.barRailing(p, [[gt.x + gt.w / 2, gt.z, y], [nf[1][0], gt.z, y]], { h: 1.15, metal: 'iron', gap: 0.13 });
  F.barRailing(p, [[gt.x - gt.w / 2 + 0.05, gt.z - 0.02, y], [gt.x + 0.02, gt.z - 0.65, y]], { h: 1.1, metal: 'iron', gap: 0.12 });
  for (const k of [-1, 1]) p.box('iron', 0.08, 1.35, 0.08, gt.x + k * (gt.w / 2 + 0.04), y, gt.z);
  // the steel ladder at the deep (west) end, the shower column, the lifebuoy on the fence
  F.poolLadder(p.at(mat4({ x: -Lp / 2 + 0.05, y, z: -1.2, ry: -Math.PI / 2 })));
  F.poolShower(p.at(mat4({ x: -9.2, y, z: -6.6 })));
  F.lifebuoy(p.at(mat4({ x: 2.2, y: y + 0.28 + 0.15, z: valley[2][1] - 0.06, ry: 0 })));
  F.curvedLampPost(g.at(mat4({ x: S.lampPost[0], y, z: S.lampPost[1], ry: Math.PI - P.rot })), emit);
  // a long row of teal sling loungers on the north side, square ecru umbrellas on stone bases behind them
  const lp = movPen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  const nL = 16;
  for (let i = 0; i < nL; i++) {
    const x = -Lp / 2 + 0.2 + (i * (Lp - 0.4)) / (nL - 1);
    F.lounger(lp.at(mat4({ x, y, z: -4.15, ry: Math.PI })));
  }
  [[-9.0, -3.6, 0.6], [-9.0, -4.6, 0.3]].forEach(([x, z, ry]) => F.foldingArmchair(lp.at(mat4({ x, y, z, ry }))));
  [-5.6, -0.2, 5.2].forEach((x) => F.squareUmbrella(lp.at(mat4({ x, y, z: -6.15, ry: 0.05 }))));
  F.closedUmbrella(p.at(mat4({ x: 9.4, y, z: -3.6 })));
  emit('pool', g.world(P.c[0], y - 0.6, P.c[1]), { pool: 'santarsa' });
}

// ---------- the tettoia: an open pavilion on rubble-stone piers, the oven built into its back wall ----------

function buildTettoia(pen, movPen, S, groundAt, emit, rnd) {
  const T = S.tettoia, y0 = T.floor, Lt = T.length, Wt = T.width;
  const g = pen.inBand('grounds');
  const p = g.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
  // local x runs SSW (+) to NNE (-, the back, towards the house); +z faces WNW (the pool and the lawn, open);
  // -z faces ESE over the woods (the valley side, with a parapet)
  p.span('flag.crazy', -Lt / 2, Lt / 2, y0 - 0.25, y0, -Wt / 2, Wt / 2);
  p.span('stone.dry', -Lt / 2, Lt / 2, y0 - 3.5, y0 - 0.25, -Wt / 2, Wt / 2);
  const pierTop = y0 + 2.7;
  const xs = [0, 1, 2, 3].map((i) => -Lt / 2 + 0.31 + (i * (Lt - 0.62)) / 3);
  xs.forEach((x) => [-1, 1].forEach((k) => p.span(STONE, x - 0.31, x + 0.31, y0, pierTop, k * (Wt / 2 - 0.31) - 0.31, k * (Wt / 2 - 0.31) + 0.31)));
  // the back wall, full height, and the retaining wall behind it holding up the slope towards the house
  p.span(STONE, -Lt / 2, -Lt / 2 + 0.6, y0, pierTop, -Wt / 2, Wt / 2);
  const back = [];
  for (let z = -Wt / 2 - 1.2; z <= Wt / 2 + 1.21; z += 0.9) {
    const behind = groundAt(...T.w(-Lt / 2 - 1.8, z));
    const top = Math.abs(z) < Wt / 2 ? Math.max(pierTop, behind + 0.2) : Math.max(y0 + 0.3, behind + 0.2);
    back.push([-Lt / 2 - 0.45, z, top, y0 - 0.2]);
  }
  wallStrip(p, 'stone.dry', back, { thick: 0.85, sink: 0.2 });
  // the low parapet with a two-rail iron railing on the valley side and the far end
  p.span(STONE, xs[0] + 0.31, xs[3] - 0.31, y0, y0 + 0.62, -Wt / 2, -Wt / 2 + 0.42);
  p.span(STONE, Lt / 2 - 0.42, Lt / 2, y0, y0 + 0.62, -Wt / 2 + 0.62, Wt / 2 - 0.62);
  F.twoRail(p, [[xs[0] + 0.31, -Wt / 2 + 0.21, y0 + 0.62], [xs[3] - 0.31, -Wt / 2 + 0.21, y0 + 0.62]], { h: 0.42, every: 1.35 });
  F.twoRail(p, [[Lt / 2 - 0.21, -Wt / 2 + 0.62, y0 + 0.62], [Lt / 2 - 0.21, Wt / 2 - 0.62, y0 + 0.62]], { h: 0.42, every: 1.35 });
  // dark timber: ring beams on the piers, a king-post truss over each pair, close rafters
  const beamY = pierTop;
  for (const k of [-1, 1]) p.span('timber.dark', -Lt / 2, Lt / 2, beamY, beamY + 0.3, k * (Wt / 2 - 0.31) - 0.14, k * (Wt / 2 - 0.31) + 0.14);
  const top = beamY + 0.3;
  const rise = 1.5;
  const rb = { length: Lt, width: Wt, roof: 'hip', ridgeOver: rise };
  const roof = blockRoof(p, rb, { stone: STONE, top, under: 'boards.dark', eavesCourse: null });
  // a tie beam over every pier pair; king-post trusses only where the roof stands at full height (inside the hips)
  const ridgeHalf = (Lt - Wt) / 2;
  xs.forEach((x) => {
    p.span('timber.dark', x - 0.13, x + 0.13, top - 0.28, top, -Wt / 2 + 0.1, Wt / 2 - 0.1);
    if (Math.abs(x) > ridgeHalf - 0.3) return;
    p.span('timber.dark', x - 0.1, x + 0.1, top, roof.ridge - 0.3, -0.1, 0.1);
    for (const k of [-1, 1]) p.put('timber.dark', boxAlong(V3(x, top, k * (Wt / 2 - 0.2)), V3(x, roof.ridge - 0.3, 0), 0.18, 0.2));
  });
  p.span('timber.dark', -ridgeHalf, ridgeHalf, roof.ridge - 0.5, roof.ridge - 0.28, -0.1, 0.1);
  // close rafters, just under the boards: the sheet's height at z is top + (Wt / 2 - |z|) * tan(pitch)
  const tp = rise / (Wt / 2);
  const under = (z) => top + (Wt / 2 - Math.abs(z)) * tp - 0.11;
  for (let x = -Lt / 2 + 0.25; x < Lt / 2 - 0.2; x += 0.55) {
    for (const k of [-1, 1]) p.put('timber.dark', boxAlong(V3(x, under(Wt / 2 + 0.3), k * (Wt / 2 + 0.3)), V3(x, under(0.05), k * 0.05), 0.08, 0.1));
  }
  // long slatted teak-colour tables end to end, folding slatted chairs (movable: the wedding layer clears them)
  const tz = 0.55;
  const mp = movPen.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
  [-2.4, 0, 2.4].forEach((x) => F.slattedTable(mp.at(mat4({ x, y: y0, z: tz })), { length: 2.35, width: 0.9 }));
  for (let i = 0; i < 7; i++) {
    const x = -3.3 + i * 1.1;
    F.slattedChair(mp.at(mat4({ x, y: y0, z: tz + 0.78, ry: Math.PI })));
    F.slattedChair(mp.at(mat4({ x: x + 0.1, y: y0, z: tz - 0.78 })));
  }
  F.slattedChair(mp.at(mat4({ x: 4.15, y: y0, z: tz, ry: -Math.PI / 2 })));
  F.slattedChair(mp.at(mat4({ x: -4.15, y: y0, z: tz, ry: Math.PI / 2 })));
  buildOven(p, -Lt / 2 + 0.6, y0, roof.ridge, emit);
  // two stone barbecues on the same back wall (published; where exactly they stand is not)
  for (const k of [-1, 1]) {
    const z = k * 2.15;
    const x0 = -Lt / 2 + 0.6;
    p.span(STONE, x0, x0 + 0.75, y0, y0 + 0.82, z - 0.62, z + 0.62);
    p.span('soot', x0 + 0.02, x0 + 0.5, y0 + 0.5, y0 + 0.83, z - 0.42, z + 0.42);
    p.span('stone.sandstone', x0, x0 + 0.85, y0 + 0.82, y0 + 0.9, z - 0.66, z - 0.44);
    p.span('stone.sandstone', x0, x0 + 0.85, y0 + 0.82, y0 + 0.9, z + 0.44, z + 0.66);
    for (let i = 0; i < 9; i++) p.box('iron', 0.62, 0.015, 0.015, x0 + 0.36, y0 + 0.84, z - 0.38 + i * 0.095);
    p.span(STONE, x0, x0 + 0.5, y0 + 1.6, y0 + 2.2, z - 0.6, z + 0.6);
  }
}

// The wood oven, built into a stone stack against the back wall: a square mouth under a massive dressed
// sandstone lintel, stone jambs and sill, soot above, a loose iron door plate, peels and a rake leaning by it,
// and its chimney stack up through the roof. The mouth stays dark: a lit fire is in the "how it could look" layer.
function buildOven(p, x0, y0, ridge, emit) {
  const d = 1.25, w = 1.9, hStack = 2.7;
  const mouthY = y0 + 0.98, mw = 0.6, mh = 0.46;
  const xf = x0 + d;
  p.span(STONE, x0, xf, y0, mouthY, -w / 2, w / 2);
  p.span(STONE, x0, xf, mouthY + mh, y0 + hStack, -w / 2, w / 2);
  p.span(STONE, x0, xf, mouthY, mouthY + mh, -w / 2, -mw / 2);
  p.span(STONE, x0, xf, mouthY, mouthY + mh, mw / 2, w / 2);
  p.span('soot', x0 + 0.2, xf - 0.55, mouthY, mouthY + mh, -mw / 2, mw / 2);
  p.span('soot', xf - 0.56, xf - 0.02, mouthY + mh - 0.02, mouthY + mh, -mw / 2, mw / 2);
  p.span('stone.sandstone', xf - 0.3, xf + 0.06, mouthY + mh, mouthY + mh + 0.32, -mw / 2 - 0.32, mw / 2 + 0.32);
  for (const k of [-1, 1]) p.span('stone.sandstone', xf - 0.2, xf + 0.03, mouthY - 0.02, mouthY + mh, k * mw / 2 + (k > 0 ? 0 : -0.2), k * mw / 2 + (k > 0 ? 0.2 : 0));
  p.span('stone.sandstone', xf - 0.4, xf + 0.18, mouthY - 0.09, mouthY, -mw / 2 - 0.3, mw / 2 + 0.3);
  p.span('soot', xf + 0.065, xf + 0.072, mouthY + mh + 0.32, mouthY + mh + 0.62, -0.3, 0.3);
  // the iron door plate leaning on the sill, two peels and a rake
  const plate = new THREE.BoxGeometry(0.02, 0.5, 0.64);
  plate.rotateZ(0.18);
  plate.translate(xf + 0.12, mouthY + 0.23, mw / 2 + 0.55);
  p.put('iron', plate);
  [[0.95, -1.05], [1.05, -1.25]].forEach(([dx, z]) => {
    p.put('iron', barG(V3(x0 + dx + 0.05, y0 + 0.02, z), V3(x0 + dx - 0.32, y0 + 2.1, z), 0.025, 0.025));
    p.box('iron', 0.32, 0.012, 0.3, x0 + dx + 0.08, y0 + 0.02, z);
  });
  p.put('iron', barG(V3(x0 + 1.25, y0 + 0.02, 1.15), V3(x0 + 0.9, y0 + 1.95, 1.2), 0.022, 0.022));
  p.box('iron', 0.06, 0.12, 0.42, x0 + 1.25, y0 + 0.02, 1.15);
  // the chimney stack up through the roof, with a tiled cap
  chimney(p, x0 + 0.45, 0, y0 + hStack - 0.1, ridge + 0.95, { w: 0.85, d: 0.85, brick: STONE });
  emit('fire', p.world(xf - 0.45, mouthY + 0.18, 0), { layer: 'wedding', status: 'idea' });
}

// ---------- the outbuildings by the pool and the chapel (probably) ----------

function buildOutbuildings(pen, cutPen, S, groundAt, emit, rnd, picks) {
  const grounds = pen.inBand('grounds');
  const flat = { bandOf: () => 'grounds', roofPen: grounds, plinthBand: 'grounds' };
  const store = S.store.b, chapel = S.chapel.b;
  const storeDress = {
    faces: {
      s: { auto: false, openings: [0, 1, 2, 3, 4].map((i) => ({ kind: 'slit', u: 1.7 + i * 1.6, w: 0.2, h: 1.35, sill: 1.45 })) },
      n: { auto: false, openings: [{ kind: 'door', u: 3.0, w: 1.0, h: 2.1, lantern: 'right' }, { kind: 'window', u: 7.0, w: 0.7, h: 0.75, sill: 1.3 }] },
      e: { auto: false, openings: [{ kind: 'window', u: 3.1, w: 0.7, h: 0.75, sill: 3.0, shutters: true }] },
      w: { auto: false },
    },
    chimneys: [{ x: 0.55, z: -0.45, w: 0.55, d: 0.55, above: 0.55 }],
    gutters: [0],
  };
  buildBlock(pen, null, store, storeDress, { stone: 'stone.dressed', rnd, emit, ...flat });
  picks.block('santarsa', store, { cut: false });
  const sp = grounds.frame(mat4({ x: store.c[0], z: store.c[1], ry: store.rot }));
  // the covered porch and stone steps on the north side, at the top of the slope
  const pz = -store.width / 2;
  for (const k of [-1, 1]) sp.span('timber.dark', 3.0 + k * 0.8 - 0.08, 3.0 + k * 0.8 + 0.08, store.floor, store.floor + 2.5, pz - 1.6, pz - 1.44);
  const porch = blockRoof(sp.frame(mat4({ x: 3.0, z: pz - 0.8 })), { length: 2.2, width: 1.7, roof: 'lean', lean: 's', ridgeOver: 0.4 }, { stone: 'stone.dressed', top: store.floor + 2.55, eavesCourse: null, skipGable: { e: true, w: true } });
  void porch;
  for (let i = 0; i < 3; i++) sp.span('stone.sandstone', 2.2, 3.8, store.floor - 0.18 * (i + 1) - 0.4, store.floor - 0.18 * i + 0.0, pz - 1.0 - i * 0.32, pz - 0.68 - i * 0.32);
  // the trail-map board under a tiny coppi canopy on the gable facing the pool
  const ep = faceAt(grounds, store, 'e', 4.8, store.floor + 1.2);
  ep.box('timber.walnut', 1.15, 0.85, 0.06, 0, 0, 0.03);
  ep.box('canvas.ecru', 1.0, 0.7, 0.01, 0, 0.075, 0.065);
  ep.box('timber.walnut', 0.05, 0.12, 0.3, -0.62, 0.95, 0.15);
  ep.box('timber.walnut', 0.05, 0.12, 0.3, 0.62, 0.95, 0.15);
  const tile = new THREE.BoxGeometry(1.45, 0.04, 0.42);
  tile.rotateX(0.32);
  tile.translate(0, 1.12, 0.2);
  ep.put('coppi', tile);

  // the chapel: dressed honey stone, a two-leaf door under a stone lunette, a small window high in the gable,
  // two lanterns, slit windows down the side, a moulded stone cornice
  const chapelDress = {
    faces: {
      e: { auto: false, openings: [
        { kind: 'lunette', u: (chapel.width - 1.1) / 2, w: 1.3, h: 2.3, lantern: 'both', lanternDy: 2.55 },
        { kind: 'window', u: (chapel.width - 1.1) / 2, w: 0.48, h: 0.48, sill: 3.45, lintel: 'stone.sandstone' },
      ] },
      s: { auto: false, openings: [{ kind: 'slit', u: 2.2, w: 0.18, h: 1.2, sill: 1.9 }, { kind: 'slit', u: 5.2, w: 0.18, h: 1.2, sill: 1.9 }] },
      w: { auto: false },
      n: { skip: true },
    },
  };
  // the chapel opens with the house: cutting Santarsa's ground floor lifts its roof too, and its nave is drawn
  // with the interiors (how it could look)
  buildBlock(pen, cutPen, chapel, chapelDress, { stone: 'stone.dressed', rnd, emit, plinthBand: 'grounds' });
  picks.block('santarsa', chapel, { place: 'chapel', id: 'santarsa-chapel', cut: false });
  const cpRoof = pen.inBand('roof').frame(mat4({ x: chapel.c[0], z: chapel.c[1], ry: chapel.rot }));
  const cp = grounds.frame(mat4({ x: chapel.c[0], z: chapel.c[1], ry: chapel.rot }));
  const ct = chapel.floor + chapel.storeys * chapel.storeyH + 0.1;
  for (const k of [-1, 1]) {
    cpRoof.span('stone.sandstone', -chapel.length / 2 - 0.05, chapel.length / 2 + 0.05, ct - 0.34, ct - 0.18, k * (chapel.width / 2) - (k > 0 ? 0 : 0.16), k * (chapel.width / 2) + (k > 0 ? 0.16 : 0));
    cpRoof.span('stone.sandstone', -chapel.length / 2 - 0.1, chapel.length / 2 + 0.1, ct - 0.18, ct - 0.02, k * (chapel.width / 2) - (k > 0 ? 0 : 0.26), k * (chapel.width / 2) + (k > 0 ? 0.26 : 0));
  }
  const rise = chapel.ridgeOver;
  for (const k of [-1, 1]) cpRoof.put('stone.sandstone', boxAlong(V3(chapel.length / 2 + 0.08, ct, k * (chapel.width / 2 + 0.25)), V3(chapel.length / 2 + 0.08, ct + rise + 0.05, 0), 0.22, 0.2));
  // a big rough stone threshold, and a rustic timber rail fence going down the slope
  F.roughBlock(cp, chapel.length / 2 + 0.5, chapel.floor - 0.02, 0, { w: 0.85, h: 0.26, d: 1.9, ry: 0, seed: 77 });
  const fence = [[chapel.length / 2 + 1.1, -chapel.width / 2 - 0.4], [chapel.length / 2 + 5.5, -chapel.width / 2 - 1.6], [chapel.length / 2 + 10.5, -chapel.width / 2 - 2.0]];
  F.splitRail(cp, fence, (x, z) => groundAt(...S.chapel.w(x, z)), { seed: 21, h: 1.0 });
}

// ---------- the lawn, the garden lounge, the parking on the drive ----------

function buildGrounds(g, S, groundAt, rnd) {
  // the stepping-stone path across the lawn from the terrace steps to the pool gate
  F.steppingStones(g, S.lawn.from, S.lawn.to, groundAt, { step: 0.82, seed: 31 });
  // the garden lounge on the lawn by the outbuildings
  if (S.lounge) {
    const [lx, lz] = S.lounge;
    const ly = groundAt(lx, lz);
    const lp = g.at(mat4({ x: lx, y: ly, z: lz, ry: S.store.rot + 0.3 }));
    F.gardenSofa(lp.at(mat4({ z: -0.9 })));
    F.gardenArmchair(lp.at(mat4({ x: -1.25, z: 0.1, ry: Math.PI / 2 - 0.2 })));
    F.gardenArmchair(lp.at(mat4({ x: 1.25, z: 0.1, ry: -Math.PI / 2 + 0.2 })));
    F.lowTable(lp.at(mat4({ z: 0.1 })));
  }
  // parking: gravel bays on the drive below the house, edged with big rough sandstone blocks
  const pk = S.parking;
  const pp = g.frame(mat4({ x: pk.c[0], z: pk.c[1], ry: pk.rot }));
  let x = -pk.length / 2, k = 0;
  while (x < pk.length / 2) {
    const w = 0.8 + rnd() * 0.45;
    const [wx, wz] = pk.w(x + w / 2, pk.width / 2 + 0.3);
    F.roughBlock(pp, x + w / 2, groundAt(wx, wz), pk.width / 2 + 0.3, { w, h: 0.4, d: 0.5, seed: 90 + k++ });
    x += w + 0.35 + rnd() * 0.5;
  }
}
