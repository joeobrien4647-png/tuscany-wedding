// "How it could look": ideas from weddings here, nothing decided (loaded the first time the layer is switched on).
// Only the patterns wedding-decor.md saw again and again, built our own way: string lights (a canopy of strands
// under Santarsa's tettoia, swoops to tall curved poles over the pool deck), one long dinner table, drinks on the
// front lawn, a cake corner with a glowing blossom tree, a gelato cart, blankets for the cool evening, paper
// lanterns in Vallorsaia's big oak and birdcage lanterns at its lookout. No names, no seating plan, no arch or aisle
// at any real spot (the ceremony ideas below stay off until Joe says yes), nothing about dress, no kids corner, no people.
import { THREE, V3, mat4, createCollector, createPen, cylG, barG, tubeG, catenary, seeded, instanced, instancedKit, kitParts, prep, pickBox } from './kit.js';
import * as F from './furniture.js';
import { registerEmitters } from './index.js';
import { IDEAS } from './words.js';

// Joe's calls (spec section 13): the builders build the default and keep the other one constant away
export const CEREMONY_IDEAS = false;  // Joe's yes needed (spec 13.1): true shows kinds of ceremony spot as ideas, a vignette while a card is open
export const DINNER_AT = 'deck';      // 'deck': one long table along Santarsa's pool deck; 'tettoia': under its roof
const NEAR_M = 260;                   // past this, only the lights themselves are drawn
export const IDEAS_CARD = false;      // Joe's call: a card of standout ideas from weddings here, in words only

export function loadWedding(api, state) {
  const { L, estate } = state;
  const mats = api.use('materials');
  const mat = (n) => mats.get(n);
  const tier = api.tier.get();
  const dense = tier === 'best' ? 1 : tier === 'balanced' ? 0.75 : 0.55;
  const groundAt = state.ctx.groundAt;
  const rnd = seeded(2027);
  const group = new THREE.Group();
  group.name = 'layer-wedding';
  // detail near each villa (wires, poles, tables, chairs, cages) sits under a LOD and is not drawn from far off;
  // the bulbs and lanterns themselves are always drawn
  const c = createCollector(['base']);
  const pen = createPen(c);
  const cV = createCollector(['base']);
  const penV = createPen(cV);
  const nearS = new THREE.Group(), nearV = new THREE.Group();
  nearS.name = 'wedding-near-santarsa';
  nearV.name = 'wedding-near-vallorsaia';
  const emitted = [];
  const bulbs = [];
  const emit = (kind, pos, villa, extra = {}) => emitted.push({ kind, pos: pos.clone(), villa, layer: 'wedding', status: 'idea', ...extra });
  const S = L.santarsa, P = S.pool, T = S.tettoia, W = S.wing, V = L.vallorsaia;
  const deck = S.deckLevel;
  const tw = (lx, lz, y) => { const [x, z] = T.w(lx, lz); return V3(x, y, z); };

  stringLights(pen, L, { dense, emit, bulbs });
  const table = longTable(pen, L, DINNER_AT, { dense, rnd, emit });
  table.kits.forEach((k) => nearS.add(instancedKit(k.parts, mat, k.matrices, { name: `wedding-${k.name}`, shadows: k.shadows })));
  const { frame: tf, mid, tz, len, ty } = table;

  // the loungers moved away: stacked at the far west end of the deck
  const stack = pen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  for (let i = 0; i < 5; i++) F.lounger(stack.at(mat4({ x: -8.9, y: deck + i * 0.13, z: 1.2, ry: Math.PI / 2 })));
  [-9.5, -9.5, -9.5].forEach((x, i) => F.closedUmbrella(stack.at(mat4({ x: x + i * 0.45, y: deck, z: -1.8 + i * 0.5 }))));

  // ---------- under the tettoia: a clear dance floor, a small DJ table, a gelato cart ----------
  const ttp = pen.frame(mat4({ x: T.c[0], z: T.c[1], ry: T.rot }));
  ttp.box('timber.oak', 1.4, 0.04, 0.7, -T.length / 2 + 2.1, T.floor + 0.74, T.width / 2 - 1.3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ttp.box('iron', 0.035, 0.74, 0.035, -T.length / 2 + 2.1 + sx * 0.62, T.floor, T.width / 2 - 1.3 + sz * 0.3);
  ttp.box('iron', 0.38, 0.04, 0.26, -T.length / 2 + 2.1, T.floor + 0.78, T.width / 2 - 1.3);
  for (const k of [-1, 1]) ttp.box('iron', 0.32, 0.5, 0.3, -T.length / 2 + 2.1 + k * 0.95, T.floor, T.width / 2 - 1.25);
  gelatoCart(ttp.at(mat4({ x: T.length / 2 - 1.7, y: T.floor, z: T.width / 2 - 1.1, ry: Math.PI / 2 + 0.3 })));
  // the oven lit for the pizza moment: embers on the oven floor under an arch of glow, not a flat square
  const oven = S.tettoia;
  const ox = -oven.length / 2 + 0.6 + 1.25;
  const er = seeded(19);
  for (let i = 0; i < 14; i++) ttp.put('fire', new THREE.IcosahedronGeometry(0.035 + er() * 0.04, 0).scale(1.3, 0.6, 1.0), mat4({ x: ox - 0.6 - er() * 0.25, y: T.floor + 1.0 + er() * 0.05, z: (er() - 0.5) * 0.4 }));
  emit('fire', tw(ox - 0.62, 0, T.floor + 1.12), 'santarsa');
  emit('glow', tw(ox - 0.5, 0, T.floor + 1.2), 'santarsa');

  // ---------- drinks on the front lawn: white high tables and a rustic drinks counter ----------
  const t = S.terrace;
  [[-5.8, t.z2 + 2.8], [-3.2, t.z2 + 4.6], [-0.6, t.z2 + 3.0], [1.6, t.z2 + 5.2]].forEach(([x, z]) => {
    const [wx, wz] = W.w(x, z);
    cocktailTable(pen.at(mat4({ x: wx, y: groundAt(wx, wz), z: wz })));
  });
  const [cx, cz] = W.w(-8.0, t.z2 + 4.4);
  drinksCounter(pen.at(mat4({ x: cx, y: groundAt(cx, cz), z: cz, ry: W.rot + 0.5 })));

  // ---------- the cake corner at the railing: a small table and a glowing blossom tree ----------
  const cake = pen.frame(mat4({ x: P.c[0], z: P.c[1], ry: P.rot }));
  cake.put('linen', cylG(0.5, 0.55, 0.76, 16), mat4({ x: 9.0, y: deck, z: 3.7 }));
  [[0.24, 0.2], [0.18, 0.16], [0.12, 0.14]].reduce((y, [r, h]) => { cake.put('paint.white', cylG(r, r, h, 14), mat4({ x: 9.0, y, z: 3.7 })); return y + h; }, deck + 0.76);
  blossomTree(cake, 9.8, deck, 4.3, rnd, (p) => emit('glow', p, 'santarsa'));

  // ---------- blankets and lanterns on the terrace steps, for when the mountain air turns cool ----------
  const [bx, bz] = W.w(-2.4, t.z2 + 0.35);
  const by = groundAt(bx, bz);
  pen.put('rush', cylG(0.32, 0.26, 0.38, 12), mat4({ x: bx, y: Math.max(by, t.level - 0.6), z: bz }));
  [['fabric.check', 0.0], ['linen', 0.1], ['fabric.check', 0.2]].forEach(([m, dy], i) => pen.put(m, new THREE.BoxGeometry(0.42, 0.08, 0.3).rotateY(i * 0.4), mat4({ x: bx, y: Math.max(by, t.level - 0.6) + 0.36 + dy, z: bz })));
  [[-4.3, t.z2 - 0.15], [-2.9, t.z2 - 0.15]].forEach(([x, z]) => {
    const [lx, lz] = W.w(x, z);
    candleLantern(pen.at(mat4({ x: lx, y: t.level, z: lz })), (p) => emit('candle', p, 'santarsa'));
  });

  // ---------- Vallorsaia: white paper lanterns in the forecourt's big oak, birdcage lanterns at the lookout ----------
  const oak = api.site.get('tree:vallorsaia-forecourt-oak');
  if (oak) {
    const gy = groundAt(oak.x, oak.z);
    const r2 = seeded(19);
    const lanterns = [];
    const n = Math.round(26 * Math.max(0.7, dense));
    for (let i = 0; i < n; i++) {
      const a = r2() * Math.PI * 2, d = 1.5 + r2() * oak.spread * 0.36;
      const x = oak.x + Math.cos(a) * d, z = oak.z + Math.sin(a) * d;
      const y = gy + oak.height * (0.3 + r2() * 0.22);
      const s = 0.14 + r2() * 0.2;
      lanterns.push(mat4({ x, y, z, s }));
      penV.put('iron', barG(V3(x, y + s, z), V3(x, y + s + 0.5, z), 0.006, 0.006));
      emit('lantern', V3(x, y, z), 'vallorsaia');
    }
    group.add(instancedKit({ 'paper.lantern': prep(new THREE.SphereGeometry(1, 10, 7).scale(1, 0.9, 1)) }, mat, lanterns, { name: 'wedding-paper-lanterns', shadows: false }));
  }
  const LO = V.lookout;
  const piers = [];
  for (let i = 0; i < 6; i++) piers.push(-LO.length / 2 + 0.3 + (i * (LO.length - 0.6)) / 5);
  const lp = penV.frame(mat4({ x: LO.c[0], z: LO.c[1], ry: LO.rot }));
  piers.forEach((x) => birdcage(lp.at(mat4({ x, y: LO.level + 1.25, z: LO.width / 2 - 0.22 })), (p) => emit('candle', p, 'vallorsaia')));
  // glass orbs with candles hanging from the lookout's oaks
  const orbs = [];
  V.lookoutOaks.forEach(([ox, oz], k) => {
    const tree = api.site.get(`tree:vallorsaia-lookout-oak-${k}`);
    const h = tree?.height ?? 15, gy = groundAt(ox, oz);
    const r3 = seeded(40 + k);
    for (let i = 0; i < 5; i++) {
      const a = r3() * Math.PI * 2, d = 1.6 + r3() * 3.2;
      const x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d, y = gy + h * 0.28 + r3() * 1.6;
      orbs.push(mat4({ x, y, z }));
      penV.put('iron', barG(V3(x, y + 0.12, z), V3(x, y + 1.0, z), 0.005, 0.005));
      emit('candle', V3(x, y - 0.03, z), 'vallorsaia');
    }
  });
  nearV.add(instancedKit(kitParts((g) => { g.put('glass.clear', new THREE.SphereGeometry(0.13, 10, 7)); g.put('candle', new THREE.ConeGeometry(0.012, 0.04, 6).translate(0, -0.03, 0)); }), mat, orbs, { name: 'wedding-orbs', shadows: false }));
  // under the big oak: a long trestle table on the gravel with benches, a white linen runner, greenery and candles
  if (oak) {
    const fc = V.forecourt;
    const tf2 = penV.frame(mat4({ x: oak.x, z: oak.z, ry: fc.rot + Math.PI / 2 }));
    const y2 = groundAt(oak.x, oak.z);
    F.refectory(tf2.at(mat4({ x: 0, y: y2, z: 2.2 })), { length: 6.0, wood: 'timber.oak' });
    tf2.box('linen', 6.0, 0.012, 0.36, 0, y2 + 0.775, 2.2);
    for (let i = 0; i < 9; i++) {
      tf2.put('leaf', new THREE.OctahedronGeometry(0.09, 0).scale(1.6, 0.5, 1), mat4({ x: -2.6 + i * 0.65, y: y2 + 0.8, z: 2.2, ry: i }));
      // candles straight on the table (clear glass here would be a shader of its own on Balanced)
      if (i % 2) { tf2.put('paint.white', cylG(0.03, 0.03, 0.12, 8), mat4({ x: -2.6 + i * 0.65, y: y2 + 0.78, z: 2.32 })); emit('candle', tf2.world(-2.6 + i * 0.65, y2 + 0.95, 2.32), 'vallorsaia'); }
    }
  }

  // ---------- finish: one mesh per material, the bulbs instanced ----------
  const shadows = (n) => ['linen', 'timber.oak', 'timber.rough', 'paint.white'].includes(n);
  c.finish(mat, { label: 'wedding', shadows }).forEach((m) => nearS.add(m));
  cV.finish(mat, { label: 'wedding-vallorsaia', shadows }).forEach((m) => nearV.add(m));
  const lodAt = (near, [x, z], y) => {
    const lod = new THREE.LOD();
    lod.position.set(x, y, z);
    near.position.set(-x, -y, -z);
    lod.addLevel(near, 0, 0.08);
    lod.addLevel(new THREE.Group(), NEAR_M, 0.08);
    group.add(lod);
    return lod;
  };
  lodAt(nearS, P.c, deck);
  lodAt(nearV, V.forecourt.c, V.forecourt.level);
  // the table, chairs and garland are left out of Best's pool mirror (the lights and their poles are not)
  const sky = api.use('sky');
  // (their LODs, which would otherwise show them again for the mirror's camera)
  sky?.mirrorHide?.add(nearS.parent || nearS);
  sky?.mirrorHide?.add(nearV.parent || nearV);
  group.add(instanced(prep(new THREE.OctahedronGeometry(0.032, 0)), mat('lamp.warm'), bulbs.map((p) => mat4({ x: p.x, y: p.y, z: p.z })), { name: 'wedding-bulbs', shadows: false }));

  // ---------- the ceremony: spots couples have used here, a light vignette only while its card is open ----------
  const vignettes = new Map();
  if (CEREMONY_IDEAS) {
    Object.entries(L.ceremony).forEach(([id, spot]) => {
      const vg = ceremonyVignette(spot, groundAt, mat, (p) => emit('candle', p, id.includes('lookout') ? 'vallorsaia' : 'santarsa'));
      vg.name = `vignette-${id}`;
      vg.visible = false;
      vignettes.set(id, vg);
      group.add(vg);
    });
    const show = (view) => {
      const sel = view?.selected;
      vignettes.forEach((g, id) => { g.visible = !!sel && sel.type === 'place' && sel.id === id; });
      api.loop.request();
    };
    api.view.on(show);
    show(api.view.get());
  }

  // the layer's places, its emitters, and the deck and tettoia cleared while it is on
  (state.words?.layerPlaces(CEREMONY_IDEAS) || []).forEach((p) => { if (!api.places.get(p.id)) api.places.add(p); });
  if (IDEAS_CARD && !api.cards.get('ideas')) api.cards.add({ id: 'ideas', ...IDEAS, layer: 'wedding' });
  registerEmitters(api, emitted, { layer: 'wedding' });
  // taps on the layer's things open their cards (the boxes live in the layer, so they go when it is off)
  const tapBoxes = [
    ['wedding-table', { c: tf.w(mid, tz), rot: tf.rot, length: len + 1.2, width: 2.4, y1: ty, y2: ty + 1.2 }],
    ['wedding-lights', { c: T.c, rot: T.rot, length: T.length, width: T.width, y1: T.floor + 2.2, y2: T.floor + 3.3 }],
    ['wedding-lawn', { c: W.w(-2.5, t.z2 + 4.0), rot: W.rot, length: 12, width: 6, y1: groundAt(...W.w(-2.5, t.z2 + 4.0)) - 1, y2: groundAt(...W.w(-2.5, t.z2 + 4.0)) + 1.5 }],
  ];
  if (oak) tapBoxes.push(['wedding-lookout', { c: [oak.x, oak.z], rot: 0, length: oak.spread * 0.8, width: oak.spread * 0.8, y1: groundAt(oak.x, oak.z) + oak.height * 0.25, y2: groundAt(oak.x, oak.z) + oak.height * 0.6 }]);
  tapBoxes.forEach(([place, obb]) => {
    const m = pickBox(obb, `pick:${place}`);
    m.userData = { place, layer: 'wedding', villa: place === 'wedding-lookout' ? 'vallorsaia' : 'santarsa' };
    group.add(m);
    if (!api.pickables.get(place)) api.pickables.add({ id: place, objects: [m], villa: m.userData.villa, place, layer: 'wedding' });
  });
  const movables = ['santarsa'].flatMap((id) => estate.villas.get(id).loungers);
  const clear = (on) => { movables.forEach((m) => { m.visible = !on; }); api.loop.request(); };
  api.layers.state.on((s) => clear(!!s.wedding));
  clear(true);
  group.userData.vignettes = vignettes;
  group.userData.counts = { bulbs: bulbs.length, ...table.counts };
  state.wedding = group;
  return group;
}

// ---------- the builders the weekend mode shares (content/weekend.js builds its own sketched copies with them) ----------

// String lights at Santarsa: a canopy of strands under the tettoia's beams, tall curved iron poles along both sides of
// the pool deck with strands across and zigzag, swoops from the house, and a warm wash on the roof's underside.
// Wires and poles go to `pen` in iron; each bulb's position is pushed to `bulbs` and emitted.
export function stringLights(pen, L, { dense, emit, bulbs }) {
  const S = L.santarsa, P = S.pool, T = S.tettoia, W = S.wing;
  const deck = S.deckLevel;
  const pw = (lx, lz, y) => { const [x, z] = P.w(lx, lz); return V3(x, y, z); };
  const tw = (lx, lz, y) => { const [x, z] = T.w(lx, lz); return V3(x, y, z); };
  const strand = (a, b, sag, spacing, villa = 'santarsa') => {
    const pts = catenary(a, b, sag, Math.max(6, Math.round(a.distanceTo(b) / 0.6)));
    pen.put('iron', tubeG(pts, 0.011, 3, false, 1));
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.round(len / spacing));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t) + 0.06;
      bulbs.push(p);
      emit('bulb', p, villa);
    }
  };
  // a canopy of parallel strands under the tettoia's beams, so the roof reads as a ceiling of light
  const beamTop = T.floor + 2.7 + 0.28;
  const bulbGap = 0.42 / dense;
  for (let x = -T.length / 2 + 1.7; x <= T.length / 2 - 0.35; x += 0.5 / Math.sqrt(dense)) {
    strand(tw(x, -(T.width / 2 - 0.3), beamTop), tw(x, T.width / 2 - 0.3, beamTop), 0.32, bulbGap);
  }
  // tall curved iron poles along both sides of the pool deck, strands across and zigzag, swoops from the house
  const poleXs = [-8.6, -2.9, 2.9, 8.6];
  const poleTop = deck + 4.5;
  const north = poleXs.map((x) => pw(x, -7.05, deck)), south = poleXs.map((x) => pw(x, 4.6, deck + 0.28));
  [...north.map((p) => [p, 1]), ...south.map((p) => [p, -1])].forEach(([p, k]) => {
    const dir = new THREE.Vector3(0, 0, k * 0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.rot);
    pen.put('iron', cylG(0.07, 0.09, 0.3, 8), mat4({ x: p.x, y: p.y, z: p.z }));
    pen.put('iron', tubeG([p.clone(), p.clone().setY(p.y + 3.2), p.clone().add(dir.clone().multiplyScalar(0.3)).setY(p.y + 4.25), p.clone().add(dir).setY(poleTop - (p.y - deck))], 0.04, 6));
  });
  const hook = (p, k) => p.clone().add(new THREE.Vector3(0, 0, k * 0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.rot)).setY(poleTop - 0.05);
  const nh = north.map((p) => hook(p, 1)), sh = south.map((p) => hook(p, -1));
  for (let i = 0; i < poleXs.length; i++) {
    strand(nh[i], sh[i], 0.7, bulbGap * 1.1);
    if (i + 1 < poleXs.length) { strand(nh[i], sh[i + 1], 0.8, bulbGap * 1.1); strand(nh[i], nh[i + 1], 0.45, bulbGap * 1.1); strand(sh[i], sh[i + 1], 0.45, bulbGap * 1.1); }
  }
  const eave = S.wingBlock.floor + S.wingBlock.storeyH - 0.25;
  [[-6.5, 0], [-1.0, 1], [5.0, 2]].forEach(([x, i]) => {
    const [ax, az] = W.w(x, S.wingBlock.width / 2 + 0.3);
    strand(V3(ax, eave, az), nh[i].clone(), 1.6, bulbGap * 1.2);
  });

  // the roof over the canopy of bulbs, lit from below: a warm wash on the underside of the beams, drawn by realism's
  // light pools (so it adds no shader of its own) and on as the string lights come on
  emit('wash', tw(0.15, 0, beamTop + 0.22), 'santarsa', { rect: [T.length - 0.6, T.width - 0.4, T.rot] });
}

// One long dinner table at Santarsa, `where` 'deck' (along the pool's north deck) or 'tettoia' (under its roof):
// linen, legs, an olive and eucalyptus garland, candles in glass, plates, cross-back chairs, a bottle of oil at each
// place. The cloth and legs go to `pen`; the repeated pieces come back as kits ({ name, parts, matrices, shadows })
// for instancedKit; the candles are emitted.
export function longTable(pen, L, where, { dense, rnd, emit }) {
  const S = L.santarsa, P = S.pool, T = S.tettoia;
  const deck = S.deckLevel;
  const tableAt = where === 'tettoia'
    ? { frame: T, from: -T.length / 2 + 2.2, to: T.length / 2 - 0.8, z: 0.5, y: T.floor }
    : { frame: P, from: -9.4, to: 10.4, z: -4.65, y: deck };
  const tf = tableAt.frame;
  const tp = pen.frame(mat4({ x: tf.c[0], z: tf.c[1], ry: tf.rot }));
  const len = tableAt.to - tableAt.from, mid = (tableAt.from + tableAt.to) / 2, ty = tableAt.y, tz = tableAt.z;
  tp.box('linen', len, 0.04, 1.12, mid, ty + 0.74, tz);
  for (const k of [-1, 1]) tp.box('linen', len, 0.3, 0.012, mid, ty + 0.46, tz + k * 0.56);
  for (const k of [-1, 1]) tp.box('linen', 0.012, 0.3, 1.12, mid + k * len / 2, ty + 0.46, tz);
  for (let x = tableAt.from + 0.4; x < tableAt.to; x += 2.0) for (const k of [-1, 1]) tp.box('timber.oak', 0.06, 0.46, 0.06, x, ty, tz + k * 0.4);
  // olive and eucalyptus: a soft heap of small leaves, grey-green and darker green, standing up off the cloth, with
  // a white flower here and there
  const garland = kitParts((g) => {
    const r = seeded(7);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.IcosahedronGeometry(0.035 + r() * 0.025, 0);
      leaf.scale(1.6, 0.9 + r() * 0.5, 1.1);
      leaf.rotateY(r() * Math.PI);
      leaf.translate((r() - 0.5) * 0.18, 0.03 + r() * 0.06, (r() - 0.5) * 0.14);
      g.put(i % 3 === 0 ? 'flower.white' : 'leaf', i % 3 === 0 ? leaf.scale(0.5, 0.5, 0.5) : leaf);
    }
  });
  const gm = [], candles = [], plates = [], chairs = [], bottles = [];
  const tableWorld = (x, y, z, ry = 0) => tp.worldMatrix(mat4({ x, y, z, ry }));
  for (let x = tableAt.from + 0.1; x < tableAt.to - 0.1; x += 0.14 / dense) gm.push(tableWorld(x, ty + 0.76, tz + (rnd() - 0.5) * 0.06, rnd() * 3));
  for (let x = tableAt.from + 0.5, k = 0; x < tableAt.to - 0.3; x += 0.95, k++) {
    candles.push(tableWorld(x, ty + 0.76, tz + (k % 2 ? 0.2 : -0.2)));
    emit('candle', tp.world(x, ty + 1.0, tz + (k % 2 ? 0.2 : -0.2)), 'santarsa');
  }
  for (let x = tableAt.from + 0.45; x < tableAt.to - 0.3; x += 0.66) {
    for (const k of [-1, 1]) {
      plates.push(tableWorld(x, ty + 0.765, tz + k * 0.36));
      chairs.push(tableWorld(x, ty, tz + k * 0.82, k > 0 ? Math.PI : 0));
      // a little bottle of the estate's own olive oil at each place
      bottles.push(tableWorld(x + 0.2, ty + 0.765, tz + k * 0.3));
    }
  }
  chairs.push(tableWorld(tableAt.from - 0.55, ty, tz, Math.PI / 2), tableWorld(tableAt.to + 0.55, ty, tz, -Math.PI / 2));
  const kits = [
    { name: 'garland', parts: garland, matrices: gm, shadows: false },
    { name: 'candles', parts: hurricane(), matrices: candles, shadows: false },
    { name: 'plates', parts: { 'paint.white': prep(cylG(0.13, 0.12, 0.018, 14)) }, matrices: plates, shadows: false },
    { name: 'chairs', parts: crossBackChair('timber.oak'), matrices: chairs, shadows: true },
    { name: 'oil', parts: kitParts((g) => { g.put('glass.clear', cylG(0.022, 0.022, 0.1, 6)); g.put('glass.clear', cylG(0.008, 0.012, 0.035, 5).translate(0, 0.1, 0)); g.put('timber.oak', cylG(0.009, 0.009, 0.015, 5).translate(0, 0.135, 0)); }), matrices: bottles, shadows: false },
  ];
  return { kits, frame: tf, mid, tz, len, ty, counts: { chairs: chairs.length, candles: candles.length, garland: gm.length } };
}

// ---------- pieces ----------

function hurricane() {
  return kitParts((p) => {
    p.put('glass.clear', cylG(0.065, 0.06, 0.24, 10, true));
    p.put('paint.white', cylG(0.035, 0.035, 0.14, 8));
    p.put('candle', new THREE.ConeGeometry(0.014, 0.05, 6).translate(0, 0.165, 0));
  });
}

// a natural cross-back chair, low-poly, facing +z
function crossBackChair(wood) {
  return kitParts((p) => {
    for (const sx of [-1, 1]) {
      p.box(wood, 0.035, 0.45, 0.035, sx * 0.2, 0, 0.19);
      p.box(wood, 0.035, 0.92, 0.035, sx * 0.2, 0, -0.19);
    }
    p.box(wood, 0.44, 0.04, 0.42, 0, 0.44, 0);
    p.box(wood, 0.4, 0.06, 0.03, 0, 0.86, -0.19);
    p.box(wood, 0.4, 0.04, 0.03, 0, 0.52, -0.19);
    p.put(wood, barG(V3(-0.18, 0.54, -0.19), V3(0.18, 0.84, -0.19), 0.025, 0.02));
    p.put(wood, barG(V3(0.18, 0.54, -0.19), V3(-0.18, 0.84, -0.19), 0.025, 0.02));
  });
}

function cocktailTable(p) {
  p.put('paint.white', cylG(0.3, 0.3, 0.03, 16), mat4({ y: 1.07 }));
  p.put('linen', cylG(0.31, 0.24, 0.55, 16, true), mat4({ y: 0.52 }));
  p.put('linen', cylG(0.24, 0.3, 0.52, 16, true));
  p.put('glass.window', cylG(0.035, 0.03, 0.16, 8), mat4({ x: 0.1, y: 1.1 }));
}

function drinksCounter(p) {
  p.box('timber.rough', 2.4, 1.0, 0.62, 0, 0, 0);
  p.box('timber.oak', 2.56, 0.06, 0.74, 0, 1.0, 0);
  // bottles of dark glass
  for (let i = 0; i < 6; i++) p.put('glass.window', cylG(0.04, 0.04, 0.3, 8), mat4({ x: -0.9 + i * 0.22, y: 1.06, z: 0.12 }));
  p.put('steel', cylG(0.16, 0.13, 0.24, 12), mat4({ x: 0.8, y: 1.06, z: 0.05 }));
  p.put('leaf', new THREE.IcosahedronGeometry(0.2, 0).scale(1.6, 0.6, 0.8), mat4({ x: 0.3, y: 1.12, z: -0.15 }));
}

function gelatoCart(p) {
  p.box('paint.white', 1.1, 0.75, 0.66, 0, 0.42, 0);
  p.box('steel', 1.1, 0.04, 0.66, 0, 1.17, 0);
  for (const [x, r] of [[-0.4, 0.3], [0.4, 0.3]]) for (const z of [-0.36, 0.36]) {
    const w = new THREE.TorusGeometry(r, 0.025, 5, 16);
    p.put('iron', w, mat4({ x, y: r, z }));
  }
  p.put('iron', barG(V3(0.55, 0.85, 0), V3(1.15, 0.9, 0), 0.03, 0.03));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iron', 0.02, 0.85, 0.02, sx * 0.48, 1.17, sz * 0.28);
  const canopy = new THREE.ConeGeometry(0.85, 0.32, 4, 1, true).rotateY(Math.PI / 4).translate(0, 2.18, 0);
  p.put('canvas.ecru', canopy);
}

function blossomTree(p, x, y, z, rnd, glow) {
  p.put('timber.dark', tubeG([V3(x, y, z), V3(x + 0.1, y + 1.0, z), V3(x - 0.05, y + 1.9, z + 0.05)], 0.05, 5));
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.85, h = y + 1.7 + (rnd() - 0.4) * 0.9;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    p.put('flower.white', new THREE.IcosahedronGeometry(0.045 + rnd() * 0.03, 0), mat4({ x: px, y: h, z: pz }));
    if (i % 3 === 0) glow(p.world(px, h, pz));
  }
}

function candleLantern(p, emit) {
  p.box('iron', 0.18, 0.02, 0.18, 0, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iron', 0.015, 0.3, 0.015, sx * 0.08, 0.02, sz * 0.08);
  p.put('paint.white', cylG(0.03, 0.03, 0.1, 8), mat4({ y: 0.03 }));
  p.put('candle', new THREE.ConeGeometry(0.012, 0.04, 6), mat4({ y: 0.15 }));
  p.put('iron', new THREE.ConeGeometry(0.13, 0.08, 4).rotateY(Math.PI / 4), mat4({ y: 0.36 }));
  emit(p.world(0, 0.16, 0));
}

function birdcage(p, emit) {
  p.put('paint.white', cylG(0.17, 0.17, 0.03, 12));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.put('paint.white', barG(V3(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16), V3(Math.cos(a) * 0.15, 0.36, Math.sin(a) * 0.15), 0.01, 0.01));
  }
  p.put('paint.white', new THREE.SphereGeometry(0.16, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat4({ y: 0.36 }));
  p.put('paint.white', new THREE.TorusGeometry(0.04, 0.008, 4, 10), mat4({ y: 0.56 }));
  p.put('paint.white', cylG(0.035, 0.035, 0.12, 8), mat4({ y: 0.03 }));
  p.put('candle', new THREE.ConeGeometry(0.013, 0.045, 6), mat4({ y: 0.17 }));
  emit(p.world(0, 0.18, 0));
}

// gently curved rows of white wooden chairs either side of an aisle, two big urns of white flowers at the front,
// facing the view (the bearing `facing`); no sides named
function ceremonyVignette(spot, groundAt, mat, emit) {
  const g = new THREE.Group();
  const c = createCollector(['base']);
  const pen = createPen(c);
  const [ax, az] = spot.at;
  const yaw = -((spot.facing) * Math.PI) / 180 + Math.PI;     // the rows' local +z points back, away from the view
  const base = spot.level ?? groundAt(ax, az);
  const frame = (x, z) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    return [ax + x * cs + z * sn, az - x * sn + z * cs];
  };
  const yAt = (x, z) => (spot.level !== undefined ? spot.level : groundAt(...frame(x, z)));
  const chairs = [];
  const R = 22;
  for (let row = 0; row < 6; row++) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const x = side * (0.95 + k * 0.56);
        const z = 2.2 + row * 1.0 + (x * x) / (2 * R);
        const [wx, wz] = frame(x, z);
        const turn = Math.atan2(x, R);
        chairs.push(mat4({ x: wx, y: yAt(x, z), z: wz, ry: yaw + Math.PI + turn }));
      }
    }
  }
  // at the chapel the flowers go down its aisle inside (as couples here did), so no chairs on the grass
  if (!spot.drifts) g.add(instancedKit(crossBackChair('paint.white'), mat, chairs, { name: 'vignette-chairs' }));
  for (const side of [-1, 1]) {
    const [wx, wz] = frame(side * 1.5, 0.4);
    const y = yAt(side * 1.5, 0.4);
    pen.put('stone.sandstone', cylG(0.22, 0.32, 0.28, 12), mat4({ x: wx, y, z: wz }));
    pen.put('stone.sandstone', cylG(0.42, 0.24, 0.55, 14), mat4({ x: wx, y: y + 0.28, z: wz }));
    pen.put('leaf', new THREE.IcosahedronGeometry(0.55, 1).scale(1, 0.75, 1), mat4({ x: wx, y: y + 1.05, z: wz }));
    const r = seeded(side > 0 ? 3 : 4);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.5;
      pen.put('flower.white', new THREE.IcosahedronGeometry(0.07 + r() * 0.04, 0), mat4({ x: wx + Math.cos(a) * d, y: y + 1.1 + r() * 0.4, z: wz + Math.sin(a) * d }));
    }
  }
  // drifts of small white flowers lining the aisle (a chapel wedding here did this)
  if (spot.drifts) {
    const r4 = seeded(11);
    for (let z = 0.8; z < 8.2; z += 0.28) for (const side of [-1, 1]) {
      const x = side * (0.62 + r4() * 0.1);
      const [wx, wz] = frame(x, z);
      pen.put('flower.white', new THREE.IcosahedronGeometry(0.1 + r4() * 0.05, 0).scale(1, 0.6, 1), mat4({ x: wx, y: yAt(x, z) + 0.05, z: wz }));
      pen.put('leaf', new THREE.OctahedronGeometry(0.07, 0), mat4({ x: wx + 0.05, y: yAt(x, z) + 0.03, z: wz + 0.05 }));
    }
  }
  void base; void emit;
  c.finish(mat, { label: 'vignette', shadows: () => true }).forEach((m) => g.add(m));
  return g;
}
