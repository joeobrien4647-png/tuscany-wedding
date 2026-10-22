// What content tells the ground, the woods and the night about the estate: level pads under the houses, decks and
// terraces; what each surface is (lawn, gravel, flagstone, the timber yard); the specimen trees content places on
// purpose (the fig and the oaks by Santarsa's outbuildings, the big oak in Vallorsaia's forecourt, the row of
// cypresses low on the approach lane and nowhere else); broom on the road's verges; and where no trees grow.
import { rectIn, frame } from './layout.js';

export function siteEntries(model, L) {
  const out = [];
  const S = L.santarsa, V = L.vallorsaia, E = L.estate;
  const add = (e) => out.push(e);
  const pad = (id, c, rot, length, width, level, blend, extra = {}) => add({ id, kind: 'pad', c, rot, length, width, level, blend, ...extra });

  // ---------- pads ----------
  // highest first: where wings at different levels touch (Vallorsaia's are a storey apart), the lower one's pad comes
  // later, so the ground inside it is its own level and not pulled up by its neighbour's blend
  const buildings = [
    ...model.villas.flatMap((v) => v.blocks).map((b) => ({ b, grow: 1.6, drop: 0.18, blend: 6 })),
    ...model.outbuildings.filter((b) => b.kind === 'outbuilding' || b.kind === 'chapel').map((b) => ({ b, grow: 1.2, drop: 0.12, blend: 3.5 })),
  ];
  buildings.sort((p, q) => q.b.floor - p.b.floor)
    .forEach(({ b, grow, drop, blend }) => pad(`pad:${b.id}`, b.c, b.rot, b.length + grow, b.width + grow, b.floor - drop, blend));
  const P = S.pool;
  pad('pad:santarsa-deck', P.w(2.55, -1.2), P.rot, 25.3, 12.3, S.deckLevel - 0.15, 4.5, { retain: true });
  pad('pad:santarsa-basin', P.c, P.rot, P.length + 0.6, P.width + 0.6, S.deckLevel - 1.9, 0, { hard: true });
  const T = S.tettoia;
  pad('pad:santarsa-tettoia', T.c, T.rot, T.length + 1.2, T.width + 1.2, T.floor - 0.25, 3.0);
  const t = S.terrace, W = S.wing;
  pad('pad:santarsa-terrace', W.w((t.x1 + t.x2) / 2, (t.z1 + t.z2) / 2), W.rot, t.x2 - t.x1, t.z2 - t.z1, t.level - 0.1, 2.5, { retain: true });
  const f = S.forecourt;
  pad('pad:santarsa-forecourt', W.w((f.x1 + f.x2) / 2, (f.z1 + f.z2) / 2), W.rot, f.x2 - f.x1, f.z2 - f.z1, f.level - 0.06, 2.5, { retain: true });
  const pk = S.parking;
  const VP = V.pool;
  pad('pad:vallorsaia-deck', VP.w(0, -0.9), VP.rot, 16.4, 10.6, V.deckLevel - 0.15, 4.5, { retain: true });
  pad('pad:vallorsaia-basin', VP.c, VP.rot, VP.length + 0.6, VP.width + 0.6, V.deckLevel - 1.9, 0, { hard: true });
  const fc = V.forecourt;
  pad('pad:vallorsaia-forecourt', fc.c, fc.rot, fc.length, fc.width, fc.level - 0.05, 3);
  const VT = V.tettoia;
  pad('pad:vallorsaia-tettoia', VT.c, VT.rot, VT.length + 1.4, VT.width + 1.4, VT.floor - 0.25, 3);
  const LO = V.lookout;
  pad('pad:vallorsaia-lookout', LO.c, LO.rot, LO.length + 0.6, LO.width, LO.level - 0.05, 4, { retain: true });

  // ---------- surfaces ----------
  const surface = (id, material, shape) => add({ id, kind: 'surface', material, ...shape });
  surface('surface:santarsa-lawn', 'lawn', { polygon: [
    W.w(-12.0, t.z2 + 0.2), W.w(2.0, t.z2 + 0.2), W.w(2.0, t.z1 + 2.0), W.w(9.2, t.z1 + 2.0), W.w(9.2, f.z2 + 0.4), W.w(f.x1 + 8.5, f.z2 + 0.4),
    T.w(-T.length / 2 + 1.0, T.width / 2 + 0.6), T.w(T.length / 2 - 3.2, T.width / 2 + 0.6), P.w(10.6, -7.6), P.w(-10.4, -7.6),
    S.store.w(5.4, -S.store.b.width / 2 - 0.8), S.store.w(-5.4, -S.store.b.width / 2 - 0.8), S.chapel.w(S.chapel.b.length / 2 + 0.6, S.chapel.b.width / 2 + 3.0),
  ] });
  S.lawnStrips.forEach((r, i) => surface(`surface:santarsa-pool-lawn-${i}`, 'lawn', { polygon: rectIn(P, r.x1, r.x2, r.z1, r.z2) }));
  S.deck.forEach((r, i) => surface(`surface:santarsa-deck-${i}`, 'flagstone', { polygon: rectIn(P, r.x1, r.x2, r.z1, r.z2) }));
  surface('surface:santarsa-tettoia', 'flagstone', { polygon: rectIn(T, -T.length / 2, T.length / 2, -T.width / 2, T.width / 2) });
  surface('surface:santarsa-terrace', 'flagstone', { polygon: rectIn(W, t.x1, t.x2, t.z1, t.z2) });
  surface('surface:santarsa-gravel', 'gravel', { polygon: rectIn(W, f.x1, f.x2, f.z1, f.z2) });
  surface('surface:santarsa-parking', 'gravel', { polygon: rectIn(pk, -pk.length / 2, pk.length / 2, -pk.width / 2, pk.width / 2) });
  surface('surface:santarsa-stepping-stones', 'path', { line: [S.lawn.from, S.lawn.to], width: 0.9 });
  V.deck.forEach((r, i) => surface(`surface:vallorsaia-deck-${i}`, 'flagstone', { polygon: rectIn(VP, r.x1, r.x2, r.z1, r.z2) }));
  surface('surface:vallorsaia-pool-lawn', 'lawn', { polygon: rectIn(VP, -13, 13, -12, 9) });
  surface('surface:vallorsaia-forecourt', 'gravel', { polygon: rectIn(fc, -fc.length / 2 + fc.apron, fc.length / 2, -fc.width / 2, fc.width / 2) });
  surface('surface:vallorsaia-apron', 'flagstone', { polygon: rectIn(fc, -fc.length / 2, -fc.length / 2 + fc.apron, -fc.width / 2, fc.width / 2) });
  surface('surface:vallorsaia-tettoia', 'flagstone', { polygon: rectIn(VT, -VT.length / 2, VT.length / 2, -VT.width / 2, VT.width / 2) });
  surface('surface:vallorsaia-lookout', 'gravel', { polygon: rectIn(LO, -LO.length / 2, LO.length / 2, -LO.width / 2, LO.width / 2) });
  surface('surface:vallorsaia-steps', 'path', { line: [fc.w(0, -fc.width / 2 + 1.0), VP.w(-VP.length / 2 - 1.2, 3.8)], width: 1.4 });
  const yard = frame(E.segheria.c, E.segheria.rot);
  surface('surface:segheria-yard', 'yard', { polygon: rectIn(yard, -9, 5, 5.5, 14) });

  // ---------- specimen trees ----------
  // the trees are seen in the photos; where exactly each stands is drawn by eye, so approximate
  const tree = (id, species, [x, z], height, spread, status = 'approx') => add({ id, kind: 'tree', species, x, z, height, spread, status });
  tree('tree:santarsa-fig', 'fig', S.fig, 6.5, 7.5);
  S.oaks.forEach((p, i) => tree(`tree:santarsa-oak-${i}`, 'oak', p, 16 + i * 1.5, 15 + i));
  tree('tree:meadow-oak', 'oak', [-101.0, 246.5], 15, 15);
  tree('tree:vallorsaia-forecourt-oak', 'oak', V.oak, 18, 19);
  V.lookoutOaks.forEach((p, i) => tree(`tree:vallorsaia-lookout-oak-${i}`, 'oak', p, 15 + i * 2, 14 + i * 2));
  V.oaksNearHouse.forEach((p, i) => tree(`tree:vallorsaia-oak-${i}`, 'oak', p, 16 + i, 15));
  // big gnarled oaks where the road nears Santarsa
  const road = E.access.points;
  [road.length - 3, road.length - 5, road.length - 7].forEach((i, k) => {
    const [ax, az] = road[i], [bx, bz] = road[i + 1];
    const dx = bx - ax, dz = bz - az, n = Math.hypot(dx, dz) || 1;
    const side = k % 2 ? 1 : -1;
    tree(`tree:road-oak-${k}`, 'oak', [ax + (-dz / n) * 7.5 * side, az + (dx / n) * 7.5 * side], 15 + k, 16);
  });
  // the cypress row, low on the approach lane only
  cypressRow(road, E.cypressRun).forEach(([x, z], i) => tree(`tree:cypress-${i}`, 'cypress', [x, z], 15 + (i % 3) * 1.5, 2.6, 'likely'));

  // ---------- the pond: a reed fringe, and poplars where the ground stays wet (illustrative) ----------
  const pond = E.pond;
  if (pond?.polygon?.length > 2) {
    add({ id: 'shrub:pond-reeds', kind: 'shrub', species: 'reed', line: [...pond.polygon, pond.polygon[0]], width: 2.6, density: 34 });
    const [pcx, pcz] = pond.c;
    const far = pond.polygon.map(([x, z]) => [x, z, Math.hypot(x - pcx, z - pcz)]).sort((p, q) => q[2] - p[2]);
    far.slice(0, 3).forEach(([x, z], i) => {
      const dx = x - pcx, dz = z - pcz, n = Math.hypot(dx, dz) || 1;
      tree(`tree:pond-poplar-${i}`, 'poplar', [x + (dx / n) * 4.5, z + (dz / n) * 4.5], 19 + i * 2, 4.5);
    });
  }

  // ---------- broom on the verges ----------
  add({ id: 'shrub:road-broom-1', kind: 'shrub', species: 'broom', line: road.slice(6, 14), width: 3.5, density: 0.35 });
  add({ id: 'shrub:road-broom-2', kind: 'shrub', species: 'broom', line: road.slice(18, 26), width: 3.5, density: 0.3 });

  // ---------- where no generated trees grow ----------
  const clear = (id, polygon) => add({ id, kind: 'clear', polygon });
  clear('clear:santarsa', [W.w(-16, -9), W.w(32, -9), T.w(T.length / 2 + 3, -T.width / 2 - 4), P.w(17, 8), P.w(-12, 8), S.chapel.w(S.chapel.b.length / 2 + 6, S.chapel.b.width / 2 + 5), S.chapel.w(-S.chapel.b.length / 2 - 3, S.chapel.b.width / 2 + 3), W.w(-16, 9)]);
  clear('clear:santarsa-parking', rectIn(pk, -pk.length / 2 - 2, pk.length / 2 + 2, -pk.width / 2 - 2, pk.width / 2 + 2));
  clear('clear:vallorsaia', rectIn(V.front, -22, 40, -24, 12));
  clear('clear:vallorsaia-pool', rectIn(VP, -12, 12, -9, 7));
  clear('clear:vallorsaia-lookout', rectIn(LO, -LO.length / 2 - 1, LO.length / 2 + 1, -LO.width / 2 - 2, LO.width / 2 + 0.5));
  clear('clear:vallorsaia-tettoia', rectIn(VT, -VT.length / 2 - 2, VT.length / 2 + 2, -VT.width / 2 - 1.5, VT.width / 2 + 5));
  return out;
}

// Tall cypresses along one side of the lane, near where it enters the model: from road point `from` to `to`.
export function cypressRow(road, { from, to }) {
  const pts = [];
  for (let i = from + 1; i <= to; i++) {
    const [ax, az] = road[i - 1], [bx, bz] = road[i];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let s = 3; s < len - 2; s += 6.5) pts.push([ax + ((bx - ax) * s) / len + nx * 4.2, az + ((bz - az) * s) / len + nz * 4.2]);
  }
  return pts;
}
