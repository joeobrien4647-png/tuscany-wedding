// The weekend's stage (weekend-mode-spec.md, sections 3 to 5 and 7), loaded the first time the mode opens: each
// moment's lazy half (its longer words, options, props and camera keyframes) and the props themselves, built on
// first use. Anything not decided is drawn as a sketch: the two long tables and the string lights in the dithered
// `ghost` material from wedding.js's own builders, the candles, bulbs and oven fires as ghost emitters. v2's wedding
// layer is left as it is (the mode switches it off). The ceremony spots stay off (CEREMONY_IDEAS in wedding.js), so
// Saturday's ceremony shows the grounds and no chairs. The cars are illustrative: four low-poly cars, no people.
// Nothing here writes api.view: experience flies the camera and owns the cards.
import { THREE, V3, mat4, createCollector, createPen, prep, seeded, instanced, cylG } from './kit.js';
import { mergeGeometries } from '../vendor/three-core.js';
import { stringLights, longTable } from './wedding.js';
import { blockToWorld, bearingDir } from '../util.js';
import { facePoint } from './houses.js';

// ---------- words (the light half of each moment is in words.js, registered at declare) ----------
const WORDS = Object.freeze({
  name: 'The weekend',
  honest: 'The rough plan. Times and spots follow nearer the day',
  days: {
    fri: { it: 'Venerdì', title: 'Pizza <em>night</em>', name: 'Friday 28 May', tab: 'Fri', date: '28', line: 'Arrive and settle in, then drinks and pizza as the sun goes down' },
    sat: { it: 'Sabato', title: 'The <em>wedding</em>', name: 'Saturday 29 May', tab: 'Sat', date: '29', night: true, line: 'The ceremony, a long Italian lunch, then dancing' },
    sun: { it: 'Domenica', title: '<em>Pool</em>', name: 'Sunday 30 May', tab: 'Sun', date: '30', line: 'Nothing before noon, then the pools' },
    mon: { it: 'Lunedì', title: '<em>Home</em>', name: 'Monday 31 May', tab: 'Mon', date: '31', line: 'One last breakfast, then home, or stay on and see a bit more of Italy' },
  },
  intro: { when: 'Fri 28 to Mon 31 May', title: 'The <em>weekend</em>', caption: 'Pizza on Friday, the wedding on Saturday, the pool on Sunday, home on Monday' },
  end: { title: 'Arrivederci, or <em>stay on</em>', names: 'Sophie & Joe', dates: 'Fri 28 to Mon 31 May 2027', again: 'Play it again', back: 'Back to the explorer' },
  reel: 'The weekend in 60 seconds',
});
// the gold line's labels, one word a moment
const SHORT = { 'fri-arrive': 'Arrive', 'fri-settle': 'Settle in', 'fri-pizza': 'Pizza', 'sat-ceremony': 'Ceremony', 'sat-table': 'Lunch', 'sat-dancing': 'Dancing', 'sun-morning': 'Morning', 'sun-pools': 'Pools', 'mon-breakfast': 'Breakfast', 'mon-leave': 'Home' };
const STARS = 'No moon till the small hours, so on a clear night it’s all stars';
const LA_VERNA = 'The sun sets just left of La Verna, give or take';

// what the view shows, by shot: place names only, so a sketch's spot is never read as the plan's
const HERE = {
  'fri-open': 'La Conca, from the valley', fork: 'The estate road', 'santarsa-sw': 'Santarsa', 's-pool-eye': 'Santarsa’s pool',
  'v-pool': 'Vallorsaia’s pool', 'v-pool-eye': 'Vallorsaia’s pool', 'lane-south': 'The lane to Vallorsaia', 's-oven-eye': 'Santarsa’s oven',
  'v-oven-eye': 'Vallorsaia’s oven', 'sunset-eye': 'Above Santarsa, looking west', 'sat-open': 'Santarsa and Vallorsaia', grounds: 'Santarsa and Vallorsaia',
  'table-eye': 'Santarsa’s pool', 'both-floors': 'Santarsa’s pool and covered terrace', 'terrace-eye': 'Santarsa’s covered terrace',
  'deck-dance': 'Santarsa’s pool', 'sun-open': 'Santarsa and Vallorsaia', 's-front': 'Santarsa', 'mon-open': 'Santarsa and Vallorsaia',
  'both-villas': 'Santarsa and Vallorsaia', 'fork-down': 'The estate road', 'out-west': 'The valley',
};
// the props that are ideas from weddings here (the idea notice); which oven is lit is an open choice, not an idea
const IDEA_PROPS = new Set(['table:deck', 'table:tettoia', 'lights']);
// too small in the frame to tag "How it could look"
const QUIET = new Set(['cars:parked']);
const CAR_COLOURS = ['#f1f0ec', '#b9bdc0', '#2b3a55', '#6b6a3c'];   // white, silver, dark blue, olive
const SIZES = { bulb: 0.18, candle: 0.08, fire: 0.5 };

export function createStage(api, state) {
  const { L } = state;
  const model = api.model;
  const mats = api.use('materials');
  const ground = api.use('ground');
  const g = (x, z) => ground.groundAt(x, z);
  const tier = api.tier.get();
  const dense = tier === 'best' ? 1 : tier === 'balanced' ? 0.75 : 0.55;
  const S = L.santarsa, P = S.pool, T = S.tettoia;
  const place = (id) => api.places.get(id);
  const EYE_LIMITS = { min: 0.5, max: 600, maxPolar: 2.6 };   // looking out level, as v2's eye shots do
  const eyeOf = (id) => { const e = place(id)?.shots()?.eye; return e && { pos: e.pos.clone(), target: e.target.clone(), hfov: e.hfov, eye: true, limits: EYE_LIMITS }; };
  const flyOf = (id) => place(id)?.shots()?.fly;
  const at = (x, y, z, tx, ty, tz, fov = 45) => ({ pos: V3(x, y, z), target: V3(tx, ty, tz), fov, limits: { min: 4, max: 2600 } });
  const eye = (pos, target, hfov) => ({ pos, target, hfov, eye: true, limits: EYE_LIMITS });
  const atY = ([x, z], y) => V3(x, y, z);

  // ---------- the shot list (spec section 5): positions from layout.js and the places' own shots ----------
  const ovenX = -T.length / 2 + 0.6 + 1.25 - 0.62;               // the mouth of Santarsa's oven, as wedding.js lights it
  const santarsaMouth = atY(T.w(ovenX, 0), T.floor + 1.12);
  // Vallorsaia's old oven mouth: the iron door on the lower wing's south face (vallorsaia.js, buildOldOven), as places.js
  const lower = model.villas.find((v) => v.id === 'vallorsaia').blocks.find((b) => b.id === 'vallorsaia-lower');
  const vallorsaiaMouth = () => { const q = facePoint(lower, 's', 1.25, lower.floor + 0.73, -0.87); return blockToWorld(lower, q.x, q.z).setY(q.y); };
  // the sunset beat: off the west wing's end, looking 291 degrees, so the setting sun (301 to 302) sits about ten
  // degrees right of centre. At standing height the model's oaks below the wing hide the sun (the grabs said so), so
  // the eye rises along the wing's end until it clears them, about 22 m up: the valley, the lake and the ridge
  const wing = model.villas.find((v) => v.id === 'santarsa').blocks.find((b) => b.id === 'santarsa-west');
  const sunsetEye = () => {
    const e = blockToWorld(wing, -wing.length / 2 - 1.2, 0).setY(wing.floor + 22);
    return eye(e, e.clone().add(bearingDir(291).multiplyScalar(1000)).setY(e.y - 70), 74);
  };
  const SHOTS = {
    'fri-open': [at(-560, 120, 420, 20, 10, 220), at(-470, 100, 380, 20, 10, 220)],
    fork: [at(-125, 28, 236, -78, -3, 192, 48), at(-112, 55, 262, -40, 0, 205, 48)],
    'santarsa-sw': at(-5, 40, 300, 35, 6, 232, 50),
    's-pool-eye': () => eyeOf('santarsa-pool'),
    'v-pool': () => flyOf('vallorsaia-pool'),
    'v-pool-eye': () => eyeOf('vallorsaia-pool'),
    'lane-south': at(-2, 120, 13, -24, -6, -170, 50),
    's-oven-eye': eye(V3(41.6, 3.75, 246.9), santarsaMouth.clone(), 72),
    'v-oven-eye': () => eyeOf('vallorsaia-oven'),
    'sunset-eye': sunsetEye,
    'sat-open': [at(-300, 220, 600, -20, 0, 0), at(-270, 200, 560, -20, 0, 0)],
    // the grounds round both villas, low enough to read as land, from the south so a tall phone stacks them
    grounds: { frame: { box: { x1: -120, x2: 160, y1: -20, y2: 40, z1: -240, z2: 290 }, bearing: 200, elevation: 34, margin: 0.04 }, limits: { min: 4, max: 2600 } },
    'table-eye': eye(atY(P.w(-10.4, -4.4), P.level + 1.7), atY(P.w(9, -4.9), P.level + 0.8), 70),
    'both-floors': { frame: { box: { x1: 17, x2: 51, y1: 0, y2: 6, z1: 238, z2: 252 }, bearing: 225, elevation: 35, margin: 0.06 }, limits: { min: 4, max: 900 } },
    'terrace-eye': eye(atY(T.w(6.3, -1.3), T.floor + 1.6), atY(T.w(-4.5, 0.4), T.floor + 2.5), 80),
    'deck-dance': eye(V3(24.8, 3.7, 241.3), V3(43.6, 4.5, 245.1), 74),
    'sun-open': [at(-420, 140, 300, 0, 0, 0), at(-400, 136, 270, 0, 0, 0)],
    's-front': [at(20, 12, 240, 40, 13, 221, 52), at(45, 12, 246, 40, 13, 221, 52)],
    'mon-open': [at(300, 160, 380, 0, 0, 120), at(290, 156, 350, 0, 0, 120)],
    // both villas, neither singled out; on a tall phone from the south and higher, so they stack in the frame
    'both-villas': () => { const f = flyOf('lane'); return { ...f, portrait: { frame: { ...f.frame, bearing: 170, elevation: 62 } } }; },
    'fork-down': [at(-112, 55, 262, -78, -3, 192, 48), at(-160, 35, 250, -250, -20, 230, 48)],
    // out over the valley to the lake (bearing 262): an eye shot, so no screen's framing pulls it back over the estate
    'out-west': () => { const e = V3(-200, 260, 300); return eye(e, e.clone().add(bearingDir(262).multiplyScalar(5000)).setY(-430), 80); },
  };
  const shot = (name, i = 0) => { const s = typeof SHOTS[name] === 'function' ? SHOTS[name]() : SHOTS[name]; return Array.isArray(s) ? s[i] : s; };
  // a keyframe: fly to `name` over `dur` s, hold `hold` s (drifting to its second shot when it has one), the clock at
  // `from` on arrival and through `to` (one minute, or several spread evenly over the hold) when it ends: stand-in
  // minutes, never shown. `props` are visible from its start; `line` replaces the caption from minute `lineFrom`
  const key = (name, dur, hold, from, to = from, props = [], extra = {}) => {
    const two = Array.isArray(SHOTS[name]);
    return { name, here: HERE[name], shot: shot(name, 0), end: two ? shot(name, 1) : null, dur, hold, at: [from, ...[].concat(to)], props, ...extra };
  };

  // ---------- the moments' lazy halves ----------
  const ovens = { group: 'oven', header: 'Both villas have a wood oven', note: 'Which one is still to be decided', exclusive: true,
    items: [
      { id: 'santarsa', label: 'Santarsa’s oven', place: 'santarsa-terrace', props: ['fire:santarsa'] },
      { id: 'vallorsaia', label: 'Vallorsaia’s oven', place: 'vallorsaia-oven', props: ['fire:vallorsaia'] },
    ] };
  const dinner = { group: 'dinner', header: 'How it could look', note: 'Two ways weddings here have done it. Ours is still to be decided', default: 'both',
    items: [
      { id: 'both', label: 'Both', place: 'santarsa-pool', props: ['table:deck', 'table:tettoia'] },
      { id: 'deck', label: 'Along the pool', place: 'santarsa-pool', props: ['table:deck'] },
      { id: 'tettoia', label: 'Under the covered terrace', place: 'santarsa-terrace', props: ['table:tettoia'] },
    ] };
  const tables = (o) => (o.dinner === 'deck' ? ['table:deck'] : o.dinner === 'tettoia' ? ['table:tettoia'] : ['table:deck', 'table:tettoia']);

  const DETAIL = {
    'fri-arrive': {
      light: { at: [870, 975], quiet: true }, where: 'road', sound: ['gravel'],
      text: 'Roll in to La Conca whenever you land, up the estate road through the oak woods to two stone villas on a hill above Sansepolcro, both ours for the weekend. Which villa you’re in comes nearer the time.',
      shots: () => [key('fork', 4, 5, 930, 940, ['cars:arrive'])],
      still: () => key('fork', 0, 0, 930, 930, ['cars:fork']),
    },
    'fri-settle': {
      light: { at: [975, 1110], quiet: true }, where: 'estate',
      text: 'Find your room, find the pool, find everyone else. Two stone villas, both ours for the weekend, each with its own pool.',
      shots: () => [key('santarsa-sw', 4, 0, 1015), key('s-pool-eye', 3, 3, 1020, 1025), key('lane-south', 2.5, 0, 1028), key('v-pool', 2.5, 3, 1031, 1035)],
      still: () => key('both-villas', 0, 0, 1020),
    },
    'fri-pizza': {
      light: { at: [1215, 1320], marks: ['sunset'] }, where: null, options: ovens, sound: ['crackle', 'clink'],
      text: 'Both villas have a wood oven, so which one gets lit is still to be decided.',
      shots: (o) => {
        // the sun behind the ridge and down (20:38, 20:42), then blue hour and the first stars
        const sunset = (fire) => [key('sunset-eye', 5, 13, 1232, [1244, 1320], fire, { line: STARS, lineFrom: 1305 })];
        if (o.oven === 'santarsa') return [key('s-oven-eye', 5, 4, 1215, 1222, ['fire:santarsa']), ...sunset(['fire:santarsa'])];
        if (o.oven === 'vallorsaia') return [key('v-oven-eye', 5, 4, 1215, 1222, ['fire:vallorsaia']), ...sunset(['fire:vallorsaia'])];
        return [key('s-oven-eye', 5, 4, 1215, 1220, ['fire:santarsa']), key('lane-south', 2.5, 0, 1222), key('v-oven-eye', 2.5, 3, 1224, 1228, ['fire:vallorsaia']), ...sunset([])];
      },
      still: (o) => (o.oven === 'santarsa' ? key('s-oven-eye', 0, 0, 1225, 1225, ['fire:santarsa'])
        : o.oven === 'vallorsaia' ? key('v-oven-eye', 0, 0, 1225, 1225, ['fire:vallorsaia']) : key('sunset-eye', 0, 0, 1232)),
    },
    'sat-ceremony': {
      light: { at: [900, 1020] }, where: 'estate',
      text: 'Outside, in the grounds. The exact time and spot follow nearer the day, so nothing in the model marks one.',
      shots: () => [key('grounds', 4, 5, 960, 962)],
      still: () => key('grounds', 0, 0, 960),
    },
    'sat-table': {
      light: { at: [1050, 1260], marks: ['sunset'] }, where: null, options: dinner,
      text: 'Weddings here have had one long table along Santarsa’s pool, long tables under what is probably its covered terrace, and some were at Vallorsaia, probably with the lake view. Ours is still to be decided.',
      shots: (o) => {
        const lights = (list) => [...list, 'lights'];
        const sunset = key('sunset-eye', 5, 6, 1230, [1242, 1250], lights(tables(o)), { line: LA_VERNA });
        if (o.dinner === 'deck') return [key('table-eye', 5, 4, 1050, 1150, lights(['table:deck'])), sunset];
        if (o.dinner === 'tettoia') return [key('terrace-eye', 5, 4, 1050, 1150, lights(['table:tettoia'])), sunset];
        return [key('both-floors', 5, 3, 1050, 1110, lights(tables(o))), key('table-eye', 4, 2, 1150, 1170, lights(['table:deck'])),
          key('terrace-eye', 4, 2, 1190, 1205, lights(['table:tettoia'])), sunset];
      },
      still: (o) => (o.dinner === 'deck' ? key('table-eye', 0, 0, 1200, 1200, ['table:deck', 'lights'])
        : o.dinner === 'tettoia' ? key('terrace-eye', 0, 0, 1200, 1200, ['table:tettoia', 'lights']) : key('both-floors', 0, 0, 1200, 1200, [...tables(o), 'lights'])),
    },
    'sat-dancing': {
      light: { at: [1320, 1439] }, where: null, options: dinner,
      text: `Dancing until the villa says stop. ${STARS}.`,
      shots: (o) => [key(o.dinner === 'deck' ? 'terrace-eye' : o.dinner === 'tettoia' ? 'deck-dance' : 'both-floors', 5, 5, 1330, 1400, [...tables(o), 'lights'])],
      still: (o) => key(o.dinner === 'deck' ? 'terrace-eye' : o.dinner === 'tettoia' ? 'deck-dance' : 'both-floors', 0, 0, 1350, 1350, [...tables(o), 'lights']),
    },
    'sun-morning': {
      light: { at: [570, 705] }, where: 'villa:santarsa',
      text: 'Nothing before noon. Sleep it off: the morning is yours.',
      shots: () => [key('s-front', 4, 6, 600, 612)],
      still: () => key('s-front', 0, 0, 600),
    },
    'sun-pools': {
      light: { at: [720, 930] }, where: 'estate', sound: ['splash'],
      text: 'Two pools, the valley, and nowhere to be. The soundtrack is everyone’s song from the binder. Every meal, Friday night to Monday morning, is on us; what Sunday’s look like is still to be decided.',
      shots: () => [key('s-pool-eye', 4, 4, 730, 780), key('lane-south', 2.5, 0, 800), key('v-pool', 2.5, 4, 840, 900)],
      still: () => key('v-pool-eye', 0, 0, 780),
    },
    'mon-breakfast': {
      light: { at: [510, 585] }, where: 'estate',
      text: 'One last breakfast, then goodbyes. Where is still to be decided.',
      shots: () => [key('both-villas', 4, 4, 540, 548, ['cars:parked'])],
      still: () => key('both-villas', 0, 0, 540, 540, ['cars:parked']),
    },
    'mon-leave': {
      light: { at: [600, 690] }, where: 'road', sound: ['gravel'],
      text: 'One last look at the valley, then home, or stay on and see a bit more of Italy.',
      shots: () => [key('fork-down', 5, 4, 600, 615, ['cars:leave']), key('out-west', 8, 2, 625, 630, ['cars:leave'])],
      still: () => key('fork-down', 0, 0, 615, 615, ['cars:forkdown']),
    },
  };
  const OPENERS = {
    fri: () => key('fri-open', 0, 3, 900, 905),
    sat: () => key('sat-open', 0, 3, 660, 662),
    sun: () => key('sun-open', 0, 3, 570, 572),
    mon: () => key('mon-open', 0, 3, 540, 541, ['cars:parked']),
  };

  // ---------- the props, each built the first time it is shown ----------
  const root = new THREE.Group();
  root.name = 'weekend-stage';
  api.scene.add(root);
  const ghostMat = () => { const base = mats.get('ghost'); return base.userData.fork ? base.userData.fork() : base; };
  // a pen whose every piece lands in one material: wedding.js's builders draw in their own names, the sketch in ghost
  const ghostPen = (c) => createPen({ bands: c.bands, add: (name, geo, band) => c.add('ghost', geo, band) });
  const oneGeometry = (parts) => { const list = Object.values(parts).map(prep); return list.length === 1 ? list[0] : mergeGeometries(list); };
  const sketchy = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } }); return o; };

  function buildTable(where) {
    const mat = ghostMat();
    const c = createCollector(['base']);
    const emitted = [];
    const t = longTable(ghostPen(c), L, where, { dense, rnd: seeded(2027), emit: (kind, pos) => emitted.push([kind, pos.clone()]) });
    const group = new THREE.Group();
    c.finish(() => mat, { label: `weekend-table-${where}`, shadows: () => false, receive: false }).forEach((m) => group.add(m));
    t.kits.forEach((k) => group.add(instanced(oneGeometry(k.parts), mat, k.matrices, { name: `weekend-${where}-${k.name}`, shadows: false })));
    return { group: sketchy(group), mat, emitted };
  }

  function buildLights() {
    const mat = ghostMat();
    const c = createCollector(['base']);
    const bulbs = [], emitted = [];
    // no wash: a light that is not decided throws no light on what is round it
    stringLights(ghostPen(c), L, { dense, bulbs, emit: (kind, pos) => { if (kind !== 'wash') emitted.push([kind, pos.clone()]); } });
    const group = new THREE.Group();
    c.finish(() => mat, { label: 'weekend-lights', shadows: () => false, receive: false }).forEach((m) => group.add(m));
    group.add(instanced(prep(new THREE.OctahedronGeometry(0.032, 0)), mats.get('ghost.glow'), bulbs.map((p) => mat4({ x: p.x, y: p.y, z: p.z })), { name: 'weekend-bulbs', shadows: false }));
    return { group: sketchy(group), mat, emitted };
  }

  // an undecided fire: its ghost emitter, and three pale tongues in the oven's mouth so the marker reads by day too
  const fire = (pos, base, s) => () => {
    const p = pos();
    const tongues = [[0, 0.34, 0.075], [-0.1, 0.22, 0.055], [0.1, 0.26, 0.06]].map(([x, h, r]) => prep(new THREE.ConeGeometry(r, h, 6).translate(x, h / 2, 0)));
    const group = new THREE.Group();
    group.add(instanced(mergeGeometries(tongues), mats.get('ghost.glow'), [mat4({ x: p.x, y: p.y + base, z: p.z, s })], { name: 'weekend-flame', shadows: false }));
    return { group: sketchy(group), mat: null, emitted: [['fire', p]] };
  };
  const BUILDERS = {
    'table:deck': () => buildTable('deck'),
    'table:tettoia': () => buildTable('tettoia'),
    lights: buildLights,
    // each mouth's point as the oven's own build gives it: Santarsa's on its hearth, Vallorsaia's at the door's middle
    'fire:santarsa': fire(() => santarsaMouth, 0.03, 1.5),
    'fire:vallorsaia': fire(vallorsaiaMouth, -0.2, 1),
  };
  const bands = new Map();   // prop -> { group, mat, emitted, on, fade }
  function band(prop) {
    if (!bands.has(prop)) {
      const b = BUILDERS[prop]();
      if (b.group) { b.group.name = `weekend:${prop}`; b.group.userData.prop = prop; b.group.visible = false; root.add(b.group); }
      if (b.mat?.userData.cover) b.mat.userData.cover.value = 0;
      bands.set(prop, { ...b, on: false, fade: null });
    }
    return bands.get(prop);
  }

  // the emitter groups of one prop, by kind: `weekend:<prop>:<kind>`, ghost, added while shown
  function emitters(prop, b, on) {
    const byKind = new Map();
    b.emitted.forEach(([kind, p]) => { if (!byKind.has(kind)) byKind.set(kind, []); byKind.get(kind).push(p.x, p.y, p.z); });
    byKind.forEach((positions, kind) => {
      const id = `weekend:${prop}:${kind}`;
      if (api.emitters.get(id)) api.emitters.remove(id);
      if (on) api.emitters.add({ id, kind, positions, seeds: positions.filter((_, i) => i % 3 === 0).map((_, i) => (i * 0.37) % 1), colour: '#efe6d2', size: SIZES[kind] ?? 0.3, ghost: true, prop, status: 'idea' });
    });
  }

  const COVER = 0.55;
  function fadeTo(b, target, seconds) {
    b.fade = { from: b.mat?.userData.cover?.value ?? target, to: target, t: 0, seconds: Math.max(0.001, seconds) };
  }

  // v2's loungers and the tettoia's tables (estate's movables) step aside while a long table is out
  const movables = () => state.estate?.villas.get('santarsa')?.loungers || [];
  let movedAside = false;
  function moveAside(on) {
    if (on === movedAside) return;
    movedAside = on;
    movables().forEach((m) => { m.visible = !on; });
  }

  // ---------- the cars: one instanced mesh, a colour per car, paths along the estate road and the lane ----------
  let cars = null;
  const carState = { mode: null, route: null, t: 0, pace: 1, moving: false };
  function carGeometry() {
    const parts = [
      new THREE.BoxGeometry(1.76, 0.62, 4.2).translate(0, 0.62, 0),
      new THREE.BoxGeometry(1.5, 0.5, 2.2).translate(0, 1.18, -0.25),
    ];
    [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]].forEach(([x, z]) => parts.push(cylG(0.33, 0.33, 0.24, 10).rotateZ(Math.PI / 2).translate(x, 0.33, z)));
    return mergeGeometries(parts.map(prep));
  }
  const road = model.roads.find((r) => r.id === 'access-road').points;
  const lane = model.roads.find((r) => r.id === 'link-santarsa-vallorsaia').points;
  const forkAt = road.reduce((best, p, i) => (Math.hypot(p[0] - lane[0][0], p[1] - lane[0][1]) < Math.hypot(road[best][0] - lane[0][0], road[best][1] - lane[0][1]) ? i : best), 0);
  const bays = [0, 1, 2, 3].map((i) => S.parking.w(-5 + i * 2.7, 0));
  const length = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  // the stretch of road `back` metres before the fork, up to the fork
  function approach(back) {
    const out = [road[forkAt]];
    let d = 0;
    for (let i = forkAt - 1; i >= 0 && d < back; i--) { d += Math.hypot(road[i][0] - road[i + 1][0], road[i][1] - road[i + 1][1]); out.unshift(road[i]); }
    return out;
  }
  const upLane = (metres) => { const out = [lane[0]]; let d = 0; for (let i = 1; i < lane.length && d < metres; i++) { d += Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]); out.push(lane[i]); } return out; };
  const toSantarsa = road.slice(forkAt + 1);
  const down = road.slice(0, forkAt + 1).reverse();
  const ROUTES = {
    // four cars come up from the valley in a line, passing the fork while the crane holds on it: one runs on to
    // Santarsa's bays, two turn up the lane and fade before Vallorsaia (its parking is not mapped), one stops on the drive
    arrive: [
      { path: [...approach(50), ...toSantarsa, bays[0]], delay: 0 },
      { path: [...approach(50), ...upLane(140)], delay: 1.6, fadeEnd: true },
      { path: [...approach(50), ...upLane(140)], delay: 3.2, fadeEnd: true },
      { path: [...approach(50), ...toSantarsa], delay: 4.8 },
    ],
    parked: [{ path: [bays[0]] }, { path: [bays[1]] }, { path: [bays[2]] }, { path: [bays[3]], hidden: true }],
    // from Santarsa's bays and down Vallorsaia's lane, joining at the fork, down the white road and out of the model
    // (the first two are already on their way when the shot arrives)
    leave: [
      { path: [bays[0], ...[...toSantarsa].reverse(), ...down], delay: -3 },
      { path: [...upLane(60).reverse(), ...down], delay: 0.5, fadeStart: true },
      { path: [bays[1], ...[...toSantarsa].reverse(), ...down], delay: -1 },
      { path: [...upLane(60).reverse(), ...down], delay: 2.5, fadeStart: true },
    ],
  };
  Object.values(ROUTES).forEach((list) => list.forEach((r) => { r.length = length(r.path); }));
  const SPEED = 11;   // metres a second: a film's pace up a gravel road
  // the paused stills: the arrival frozen as the cars split at the fork, the leaving as they join it
  const toFork = length(approach(50)), fromBays = length([bays[0], ...toSantarsa.slice().reverse(), road[forkAt]]);
  const STILLS = { fork: ['arrive', (toFork + 30) / SPEED], forkdown: ['leave', (fromBays + 22) / SPEED - 3] };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sv = new THREE.Vector3(), pv = new THREE.Vector3();

  function pointAt(path, s) {
    for (let i = 1; i < path.length; i++) {
      const [x0, z0] = path[i - 1], [x1, z1] = path[i];
      const d = Math.hypot(x1 - x0, z1 - z0);
      if (s <= d || i === path.length - 1) { const k = d ? Math.min(1, s / d) : 0; return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, dx: x1 - x0, dz: z1 - z0 }; }
      s -= d;
    }
    const [x, z] = path[0];
    return { x, z, dx: 1, dz: 0 };
  }

  function placeCars() {
    const list = ROUTES[carState.route] || [];
    list.forEach((r, i) => {
      let s = r.delay == null ? r.length : Math.max(0, (carState.t - r.delay) * SPEED);
      s = Math.min(s, r.length);
      // parked: nose into the bay, across the row
      const p = r.path.length > 1 ? pointAt(r.path, s) : { x: r.path[0][0], z: r.path[0][1], dx: Math.sin(S.parking.rot), dz: Math.cos(S.parking.rot) };
      let k = r.hidden ? 0 : 1;
      if (r.fadeEnd) k = Math.min(1, (r.length - s) / 20);
      if (r.fadeStart) k = Math.min(1, s / 20);
      const yaw = Math.atan2(p.dx, p.dz);
      const ahead = g(p.x + Math.sin(yaw) * 1.6, p.z + Math.cos(yaw) * 1.6), behind = g(p.x - Math.sin(yaw) * 1.6, p.z - Math.cos(yaw) * 1.6);
      e.set(-Math.atan2(ahead - behind, 3.2), yaw, 0);
      m4.compose(pv.set(p.x, g(p.x, p.z) + 0.02, p.z), q.setFromEuler(e), sv.setScalar(Math.max(0.0001, k)));
      cars.setMatrixAt(i, m4);
    });
    cars.instanceMatrix.needsUpdate = true;
  }

  // mode: arrive, leave or parked (moving while frames run), or fork and forkdown (frozen); pace speeds them up when
  // the reel squeezes a moment
  function setCars(mode, pace = 1) {
    carState.pace = pace;
    if (!mode) { if (cars) cars.visible = false; carState.mode = null; return; }
    if (!cars) {
      cars = new THREE.InstancedMesh(carGeometry(), mats.get('car.body'), 4);
      cars.name = 'weekend:cars';
      cars.userData.prop = 'cars';
      const c = new THREE.Color();
      CAR_COLOURS.forEach((hex, i) => cars.setColorAt(i, c.set(hex)));
      cars.castShadow = false;
      cars.receiveShadow = false;
      cars.frustumCulled = false;
      root.add(cars);
    }
    if (carState.mode !== mode) {
      carState.mode = mode;
      const still = STILLS[mode];
      carState.route = still ? still[0] : mode;
      carState.t = still ? still[1] : 0;
      carState.moving = !still && mode !== 'parked';
    }
    cars.visible = true;
    placeCars();
  }

  // ---------- the stage's members (the weekendStage service) ----------
  const shown = new Set();
  const options = { oven: null, dinner: 'both', ceremony: null };

  function show(ids = [], { fade = 0.5, pace = 1 } = {}) {
    const want = new Set(ids);
    const carMode = [...want].find((id) => id.startsWith('cars:'));
    setCars(carMode ? carMode.slice(5) : null, pace);
    Object.keys(BUILDERS).forEach((prop) => {
      const on = want.has(prop);
      if (!on && !bands.has(prop)) return;
      const b = band(prop);
      if (on === b.on) return;
      b.on = on;
      if (on && b.group) b.group.visible = true;
      emitters(prop, b, on);
      if (b.mat?.userData.cover) fadeTo(b, on ? COVER : 0, fade);
      else if (b.group && !on) b.group.visible = false;
    });
    shown.clear();
    want.forEach((id) => { if (BUILDERS[id] || id.startsWith('cars:')) shown.add(id); });
    moveAside([...shown].some((id) => id.startsWith('table:')));
    api.loop.request();
    api.loop.wake();
    return new Promise((resolve) => setTimeout(resolve, fade * 1000));
  }

  function update({ dt = 0 } = {}) {
    bands.forEach((b) => {
      if (!b.fade) return;
      b.fade.t += dt;
      const k = Math.min(1, b.fade.t / b.fade.seconds);
      b.mat.userData.cover.value = b.fade.from + (b.fade.to - b.fade.from) * k;
      if (k >= 1) { if (!b.on && b.group) b.group.visible = false; b.fade = null; }
    });
    if (cars?.visible && carState.moving) { carState.t += dt * carState.pace; placeCars(); }
  }

  // picks within an option group; touches only the weekend's own build (experience flies and owns the cards)
  function option(group, id) {
    if (group === 'oven') options.oven = ['santarsa', 'vallorsaia'].includes(id) ? id : null;
    else if (group === 'dinner') options.dinner = ['deck', 'tettoia'].includes(id) ? id : 'both';
    else if (group === 'ceremony') options.ceremony = null;   // CEREMONY_IDEAS is off: no spot is ever shown
    return { ...options };
  }

  function detail(id) {
    const d = DETAIL[id];
    const m = api.moments.get(id);
    if (!d || !m) return null;
    return {
      id, short: SHORT[id], light: d.light, text: d.text, where: d.where, options: d.options || null, sound: d.sound || [], props: [],
      shots: (o = options) => d.shots({ ...options, ...o }),
      still: (o = options) => d.still({ ...options, ...o }),
    };
  }

  // the sketches and the cars built ahead, one a turn while the page is idle, so no flight stalls on a first build
  let prebuilt = null;
  function prebuild() {
    const idle = (fn) => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(fn()), { timeout: 400 }) : setTimeout(() => r(fn()), 16)));
    prebuilt ??= ['table:deck', 'table:tettoia', 'lights', 'fire:santarsa', 'fire:vallorsaia']
      .reduce((p, prop) => p.then(() => idle(() => band(prop))), Promise.resolve())
      .then(() => idle(() => { if (!cars) { setCars('parked'); setCars(null); } }));
    return prebuilt;
  }

  return {
    words: WORDS,
    detail,
    opener: (day) => OPENERS[day]?.() ?? null,
    show,
    prebuild,
    shown: () => [...shown],
    ideas: () => [...shown].filter((id) => IDEA_PROPS.has(id)),
    looks: () => [...shown].filter((id) => !QUIET.has(id)),
    option,
    options: () => ({ ...options }),
    update,
    group: root,
    // for the tests: the weekend's own meshes, and whether each sketch is opaque and depth-writing
    meshes: () => { const out = []; root.traverse((o) => { if (o.isMesh && o.visible && o.parent?.visible !== false) out.push(o); }); return out; },
  };
}
