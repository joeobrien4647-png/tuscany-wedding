// Where everything content adds stands, worked out once from the model (OpenStreetMap outlines, EU-DEM levels) so
// the builders, the site entries for the ground and the places all agree. Positions read from photos are
// approximate and say so in their status; nothing here is surveyed.

export function frame(c, rot = 0, extra = {}) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  return {
    c, rot, ...extra,
    w: (lx, lz) => [c[0] + lx * cs + lz * sn, c[1] - lx * sn + lz * cs],
    l: (x, z) => { const dx = x - c[0], dz = z - c[1]; return [dx * cs - dz * sn, dx * sn + dz * cs]; },
    poly: (pts) => pts.map(([lx, lz]) => [c[0] + lx * cs + lz * sn, c[1] - lx * sn + lz * cs]),
  };
}

// compass bearing (degrees) of a frame's local direction (dx along, dz across)
export function bearingIn({ rot = 0 }, dx, dz) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const wx = dx * cs + dz * sn, wz = -dx * sn + dz * cs;
  return ((Math.atan2(wx, -wz) * 180) / Math.PI + 360) % 360;
}

// a rectangle in a frame, as a world polygon (x1..x2 along, z1..z2 across)
export const rectIn = (f, x1, x2, z1, z2) => f.poly([[x1, z1], [x2, z1], [x2, z2], [x1, z2]]);

const TETTOIA_SHIFT = 6.5;

export function computeLayout(model) {
  const villa = (id) => model.villas.find((v) => v.id === id);
  const block = (id) => model.villas.flatMap((v) => v.blocks).find((b) => b.id === id);
  const out = (id) => model.outbuildings.find((b) => b.id === id);
  const pool = (id) => model.pools.find((p) => p.villa === id);

  // ---------- Santarsa ----------
  const sp = pool('santarsa');
  const P = frame(sp.c, sp.rot, { length: sp.length, width: sp.width, level: sp.level });
  const wing = block('santarsa-west'), tall = block('santarsa-tall'), east = block('santarsa-east');
  const W = frame(wing.c, wing.rot);                 // the wing's frame: x east along the house, z south
  const wingHalf = wing.length / 2;
  const tallFloor1 = tall.floor + tall.storeyH;
  const tett = out('santarsa-outbuilding-429326973');
  const store = out('santarsa-outbuilding-429326968');
  const chapel = out('santarsa-chapel');
  const deckLevel = sp.level;
  const santarsa = {
    pool: P,
    deckLevel,
    // the deck, in the pool's frame (x east along the pool, z south): wider on the north side, an arm east to
    // the tettoia, lawn strips on the valley side and at the west end
    deck: [
      { x1: -10.1, x2: 12.6, z1: -7.35, z2: -2.75 },
      { x1: 7.5, x2: 10.5, z1: -2.75, z2: 4.95 },
      { x1: 10.5, x2: 12.4, z1: -2.75, z2: 0.6 },
      { x1: -8.1, x2: 7.5, z1: 2.75, z2: 3.35 },
      { x1: -8.1, x2: -7.5, z1: -2.75, z2: 2.75 },
    ],
    lawnStrips: [{ x1: -8.1, x2: 7.5, z1: 3.35, z2: 4.95 }, { x1: -10.1, x2: -8.1, z1: -2.75, z2: 4.95 }],
    // the deck's edge: north (the black iron fence and gate, as far as the tettoia), then the valley side
    northFence: [[-10.1, -7.35], [12.4, -7.35]],
    valleyEdge: [[10.5, 1.75], [10.5, 4.95], [-10.1, 4.95], [-10.1, -7.35]],
    bay: { x1: 5.5, x2: 7.5 },                 // the shallow jet bay, the full width of the pool, at the east end
    gate: { x: -3.2, z: -7.35, w: 1.4 },
    // OSM's outline would sink its north half 4 m into the slope; the photos put it at deck level at the east end of
    // the pool, so it is drawn 6.5 m down its own long axis from the outline (likely, approximate spot)
    tettoia: { ...frame(frame(tett.c, tett.rot).w(TETTOIA_SHIFT, 0), tett.rot), length: tett.length, width: tett.width, floor: deckLevel + 0.15, osm: tett.osm, osmC: tett.c },
    store: { ...frame(store.c, store.rot), b: store },
    chapel: { ...frame(chapel.c, chapel.rot), b: chapel },
    wing: W,
    wingBlock: wing,
    // raised flagstone terrace along the west wing's front; the covered stair at its east end
    terrace: { x1: -wingHalf, x2: 2.0, z1: wing.width / 2, z2: wing.width / 2 + 4.5, level: wing.floor - 0.05 },
    stair: { x1: 2.2, x2: 7.5, z1: wing.width / 2 + 0.43, z2: wing.width / 2 + 1.78, bottom: wing.floor - 0.05, top: tallFloor1, landing: { x1: 7.5, x2: wingHalf } },
    forecourt: { x1: wingHalf, x2: wingHalf + tall.length + east.length, z1: tall.width - wing.width / 2, z2: tall.width - wing.width / 2 + 3.4, level: tall.floor - 0.25 },
    lawn: { from: W.w(-3.6, wing.width / 2 + 4.7), to: P.w(-3.2, -7.6) },
    lounge: store ? frame(store.c, store.rot).w(-1.0, -7.2) : null,
    fig: frame(store.c, store.rot).w(3.6, -5.2),
    oaks: [frame(store.c, store.rot).w(-9.0, -8.5), frame(store.c, store.rot).w(-15.5, 1.5), frame(store.c, store.rot).w(2.5, -15.5), frame(chapel.c, chapel.rot).w(4.5, -4.8)],
    standingStone: W.w(-2.2, wing.width / 2 + 4.2),
    lampPost: P.w(8.6, -6.9),
    parking: frame([-12.5, 227.5], -0.35, { length: 16, width: 6, level: null }),
  };

  // ---------- Vallorsaia ----------
  const vp = pool('vallorsaia');
  const VP = frame(vp.c, vp.rot, { length: vp.length, width: vp.width, level: vp.level });
  const front = block('vallorsaia-front'), upper = block('vallorsaia-upper'), lower = block('vallorsaia-lower');
  const FR = frame(front.c, front.rot);                 // x towards the forecourt (SSE), z downhill (WSW)
  const UP = frame(upper.c, upper.rot);
  const faceFront = FR.w(front.length / 2, 0);
  const vallorsaia = {
    pool: VP,
    deckLevel: vp.level,
    deck: [
      { x1: -8.0, x2: 8.0, z1: -6.2, z2: -3.0 },
      { x1: -8.0, x2: 8.0, z1: 3.0, z2: 4.4 },
      { x1: -8.0, x2: -6.0, z1: -3.0, z2: 3.0 },
      { x1: 6.0, x2: 8.0, z1: -3.0, z2: 3.0 },
    ],
    front: FR,
    frontBlock: front,
    // the forecourt is in front of the front block and its stair only: the downhill wings stand a storey lower
    forecourt: { ...frame(FR.w(front.length / 2 + 6.0, -2.9), front.rot), length: 13, width: 13.4, level: front.floor - 0.1, apron: 3.6 },
    oak: FR.w(front.length / 2 + 10.5, -2.5),
    tettoia: { ...frame(UP.w(-upper.length / 2 - 6.5, -1.5), upper.rot), length: 8.2, width: 4.0, floor: upper.floor - 0.1 },
    // the lookout faces the lake (about 265 degrees from here)
    lookout: { ...frame([-61.5, -219.5], -1.4835), length: 15, width: 8.5, level: -12.4 },
    lookoutOaks: [[-57.0, -230.5], [-60.5, -208.0], [-53.0, -214.0]],
    shed: { ...frame([14.5, -226.5], -1.0), length: 4.2, width: 3.4 },
    wheel: FR.w(front.length / 2 + 6.5, -11.6),
    seat: FR.w(front.length / 2 + 4.8, -12.8),
    oaksNearHouse: [UP.w(-2.0, -10.5), VP.w(-2.0, -11.0), VP.w(9.5, -9.0)],
    faceFront,
  };

  // ---------- the estate ----------
  const access = model.roads.find((r) => r.id === 'access-road');
  const pond = model.water.find((w) => w.id === 'pond-west-of-vallorsaia');
  const pc = pond.polygon.reduce((a, [x, z]) => [a[0] + x / pond.polygon.length, a[1] + z / pond.polygon.length], [0, 0]);
  const estate = {
    access,
    // the row of tall cypresses: low on the approach lane only, near where it enters the model (seen in a 2023
    // guest video near the start of the lane), and nowhere else
    cypressRun: { from: 0, to: 4 },
    segheria: out('segheria'),
    logYard: frame(out('segheria').c, out('segheria').rot).w(-2.5, 9.5),
    pond: { c: pc, level: pond.level, polygon: pond.polygon },
    deer: [[46.5, 201.0, 2.2], [52.0, 199.4, 0.4], [57.5, 202.6, 3.4], [61.0, 200.2, 1.2]],
  };
  // spots other couples have used for a ceremony here (the "how it could look" layer only): where a vignette would
  // stand and which way its rows would face (towards the view)
  const CH = santarsa.chapel, LO = vallorsaia.lookout;
  const ceremony = {
    'ceremony-railing': { at: P.w(-1.5, 3.7), facing: bearingIn(P, 0, 1), level: deckLevel },
    'ceremony-lookout': { at: LO.w(0.5, 1.6), facing: bearingIn(LO, 0, 1), level: LO.level },
    'ceremony-meadow': { at: [-104.5, 251.0], facing: 268 },
    'ceremony-glade': { at: [150.0, 160.0], facing: 60 },
    'ceremony-chapel': { at: CH.w(CH.b.length / 2 + 5.6, 0), facing: bearingIn(CH, -1, 0), drifts: true },
  };
  return { santarsa, vallorsaia, estate, ceremony, villa, block, out, pool };
}
