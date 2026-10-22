// What each villa looks like from far off (the estate view, the tour's wide shots): its blocks as plain stone
// boxes under plain roof planes, the outbuildings, the tettoia's roof, the pool decks. three.js's LOD swaps it in
// past FAR_AT metres, so the detail (tile rows, casements, railings, furniture) is only drawn where it can be seen.
import { V3, mat4, quadG, triG } from './kit.js';

export const FAR_AT = 230;

function roofPlanes(p, b, top, stone = 'stone.dry', tiles = 'coppi') {
  const L = b.length + 0.8, W = b.width + 0.8;
  const rise = b.ridgeOver || 1.5;
  const y = top - 0.12;
  const c = [V3(-L / 2, y, -W / 2), V3(L / 2, y, -W / 2), V3(L / 2, y, W / 2), V3(-L / 2, y, W / 2)];
  if (b.roof === 'lean') {
    const hi = b.lean === 's' ? 1 : -1;
    const lift = (v) => (Math.sign(v.z) === hi ? v.clone().setY(y + rise + 0.12) : v);
    const [a, bb, cc, d] = c.map(lift);
    p.put(tiles, quadG(d, cc, bb, a), null, { uv: 'slope' });
    return;
  }
  if (b.roof === 'hip') {
    const r = Math.max(0, L / 2 - W / 2);
    const r0 = V3(-r, y + rise, 0), r1 = V3(r, y + rise, 0);
    p.put(tiles, quadG(c[3], c[2], r1, r0), null, { uv: 'slope' });
    p.put(tiles, quadG(c[1], c[0], r0, r1), null, { uv: 'slope' });
    p.put(tiles, triG(c[2], c[1], r1), null, { uv: 'slope' });
    p.put(tiles, triG(c[0], c[3], r0), null, { uv: 'slope' });
    return;
  }
  const r0 = V3(-L / 2, y + rise, 0), r1 = V3(L / 2, y + rise, 0);
  p.put(tiles, quadG(c[3], c[2], r1, r0), null, { uv: 'slope' });
  p.put(tiles, quadG(c[1], c[0], r0, r1), null, { uv: 'slope' });
  p.put(stone, triG(V3(L / 2 - 0.4, y, W / 2 - 0.4), V3(L / 2 - 0.4, y, -W / 2 + 0.4), V3(L / 2 - 0.4, y + rise - 0.1, 0)), null, { uv: 'world' });
  p.put(stone, triG(V3(-L / 2 + 0.4, y, -W / 2 + 0.4), V3(-L / 2 + 0.4, y, W / 2 - 0.4), V3(-L / 2 + 0.4, y + rise - 0.1, 0)), null, { uv: 'world' });
}

function farBlock(pen, b, stone, { roof = true } = {}) {
  const p = pen.frame(mat4({ x: b.c[0], z: b.c[1], ry: b.rot }));
  const top = b.floor + b.storeys * b.storeyH + 0.1;
  const bottom = Math.min(b.groundMin, b.floor) - 1.0;
  p.span(stone, -b.length / 2, b.length / 2, bottom, top, -b.width / 2, b.width / 2);
  if (b.roof === 'lean') {
    const hi = b.lean === 's' ? 1 : -1;
    const z = hi > 0 ? [b.width / 2 - 0.55, b.width / 2] : [-b.width / 2, -b.width / 2 + 0.55];
    p.span(stone, -b.length / 2, b.length / 2, top, top + (b.ridgeOver || 1.5), z[0], z[1]);
  }
  if (roof) roofPlanes(p, b, top, stone);
}

export function buildFar(pen, { villa, model, L }) {
  const v = model.villas.find((x) => x.id === villa);
  const stone = villa === 'santarsa' ? 'stone.santarsa' : 'stone.vallorsaia';
  v.blocks.forEach((b) => farBlock(pen, b, stone));
  model.outbuildings.filter((o) => o.villa === villa && o.kind !== 'tettoia').forEach((o) => farBlock(pen, o, 'stone.dressed'));
  if (villa === 'santarsa') {
    const S = L.santarsa, T = S.tettoia, P = S.pool;
    const tp = pen.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
    tp.span('flag.crazy', -T.length / 2, T.length / 2, T.floor - 1.5, T.floor, -T.width / 2, T.width / 2);
    roofPlanes(tp, { length: T.length, width: T.width, roof: 'hip', ridgeOver: 1.5 }, T.floor + 3.1);
    const pp = pen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
    S.deck.forEach((r) => pp.span('flag.crazy', r.x1, r.x2, S.deckLevel - 1.5, S.deckLevel, r.z1, r.z2));
  } else {
    const V = L.vallorsaia, P = V.pool, T = V.tettoia;
    const pp = pen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
    V.deck.forEach((r) => pp.span('slab.grey', r.x1, r.x2, V.deckLevel - 1.5, V.deckLevel, r.z1, r.z2));
    const tp = pen.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
    tp.span('slab.grey', -T.length / 2, T.length / 2, T.floor - 1.0, T.floor, -T.width / 2, T.width / 2);
    roofPlanes(tp, { length: T.length, width: T.width, roof: 'lean', lean: 'n', ridgeOver: 0.6 }, T.floor + 2.85);
  }
}
