// The seam between the villa explorer's three v2 tracks. Only the integrator edits this file (and app.js, boot.js,
// util.js). Each track has an installer, js/villas/<track>/index.js, exporting declare(api), build(api, { onProgress })
// and optionally ready(api); app.js runs them for realism, content and experience in that order. Tracks import from
// here, util.js and vendor/ only, never from each other. The plan: research/villas/v2-spec.md in the video repo.
//   realism     render.js, sky.js, terrain.js, textures.js, tonemap.js, vendor/, realism/, data/villas-land/
//   content     buildings.js, content.js, content/, data/villas-model.json
//   experience  camera.js, ui.js, labels.js, villas.html, css/villas.css, experience/
// Units: metres; x east, z south, y up; bearings clockwise from north; times in minutes after local midnight.
import { tween, ease, clamp } from './util.js';

export const API_VERSION = 3;   // 2: MATERIALS copper and tile.pool; 3: the weekend

// ---------- the day: Saturday 29 May 2027 at La Conca, Central European Summer Time ----------
export const DAY = Object.freeze({ date: '2027-05-29', utcOffsetMin: 120, start: 300, end: 1440 });
export const PRESETS = Object.freeze({
  day: Object.freeze({ label: 'Day', at: 930 }),
  sunset: Object.freeze({ label: 'Sunset', at: 1200 }),
  night: Object.freeze({ label: 'Night', at: 1350 }),
});
export const toMinutes = (hhmm) => { const [h, m = 0] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const toHHMM = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// sun elevation (degrees) to the light's phase; the same words everywhere
export const phaseOf = (el) => (el >= 6 ? 'day' : el >= -0.833 ? 'golden' : el >= -6 ? 'blue' : 'night');

// ---------- graphics ----------
export const TIERS = Object.freeze(['fast', 'balanced', 'best']);
export const MODES = Object.freeze(['auto', 'fast', 'balanced', 'best']);
// ceilings for the main pass at every fixed view (texture memory in MB); see the spec's budgets
export const BUDGETS = Object.freeze({
  fast: Object.freeze({ triangles: 350000, calls: 150, programs: 25, textureMB: 64 }),
  balanced: Object.freeze({ triangles: 500000, calls: 200, programs: 35, textureMB: 128 }),
  best: Object.freeze({ triangles: 900000, calls: 300, programs: 60, textureMB: 256 }),
});
export const LOAD = Object.freeze({ firstLoadMB: 4, lazyChunkKB: 400, smallChunkKB: 40, landDataKB: 400 });

// ---------- honesty: every place, note, card and layer has one of these ----------
export const STATUS = Object.freeze({
  fact: '',                       // published by La Conca, mapped by OpenStreetMap, or measured
  likely: 'Probably',             // read from photos, not confirmed
  approx: 'Approximate spot',     // real, but where it stands is not known
  idea: 'How it could look',      // from other couples' weddings here; nothing is decided
});
export const IDEA_NOTICE = 'Ideas from weddings here. Nothing is decided';

// ---------- the weekend: each day's scrubber (minutes), and how sure the plan is ----------
export const WEEKEND = Object.freeze([
  { id: 'fri', date: '2027-05-28', from: 780, to: 1410 },
  { id: 'sat', date: '2027-05-29', from: 600, to: 1440 },
  { id: 'sun', date: '2027-05-30', from: 480, to: 1080 },
  { id: 'mon', date: '2027-05-31', from: 420, to: 720 },
].map(Object.freeze));
export const PLAN = Object.freeze({
  what: Object.freeze({ decided: '', likely: 'Likely', tbd: 'To be decided' }),
  when: Object.freeze({ decided: '', likely: 'Rough timing', tbd: 'Time to be decided' }),
  where: Object.freeze({ decided: '', likely: 'Likely spot', tbd: 'Spot to be decided' }),
});
export const MODEL_NOTICE = 'An illustrative model, not an exact plan';

// ---------- materials: content asks by name, realism makes them ----------
// Each name has a fallback colour, so content can build before realism has made the real thing. UVs are in metres
// (util.worldUV; util.slopeUV for roofs). `glass` takes ATTRIBUTES.lightSeed; `emissive` lights up at dusk by itself.
export const MATERIALS = Object.freeze({
  'stone.santarsa': { colour: '#a69a86' },     // rubble: warm grey-beige with honey and rust stones
  'stone.dressed': { colour: '#bf8f5a' },      // coursed honey-ochre: outbuildings and chapel
  'stone.vallorsaia': { colour: '#938d80' },   // smaller rounder rubble, pinning stones, wide pale joints
  'stone.dry': { colour: '#9a9286' },          // dry-stone and retaining walls, parapets, slab roofs
  'stone.sandstone': { colour: '#c9b08a' },    // lintels, sills, quoins, kerb blocks, cube seats, thresholds
  'stone.pietra': { colour: '#8f9190' },       // pietra serena surrounds and columns
  'flag.crazy': { colour: '#c8c0ae' },         // irregular flagstones: Santarsa deck, front terrace, tettoia floor
  'flag.interior': { colour: '#979a9d' },      // blue-grey flagstones indoors
  'slab.grey': { colour: '#a9a69f' },          // sawn slabs: Vallorsaia deck and tettoia floor
  'coping.pale': { colour: '#e8e4dc' },
  'tile.pool': { colour: '#cfe3e2' },          // pool lining below the waterline
  'coppi': { colour: '#b0603e' },              // half-round roof tiles, mottled tile by tile
  'brick': { colour: '#a5583a' },
  'firebrick': { colour: '#e2d3b8' },
  'soot': { colour: '#2b2623' },
  'plaster': { colour: '#f2ede3' },
  'timber.dark': { colour: '#4a3424' },        // beams, trusses, rafters, mantel beams
  'timber.walnut': { colour: '#4a3423' },      // shutters, doors, casements, furniture
  'timber.honey': { colour: '#9a6b40' },       // roof boards, ladder-back chairs, garden tables
  'timber.rough': { colour: '#7d6a52' },       // split-rail fences, peeled posts, log stacks, power poles
  'timber.oak': { colour: '#b08d63' },         // bare trestle tops, cross-back chairs
  'cotto': { colour: '#b4683f' },
  'boards.dark': { colour: '#4b3424' },
  'iron': { colour: '#1f1f1f' },               // lanterns, gates, handrails, lamp posts
  'iron.rust': { colour: '#6b4a35' },          // Santarsa's pool railing
  'copper': { colour: '#9a5a3a' },             // gutters and downpipes, weathered
  'steel': { colour: '#c4c8ca' },              // ladder, shower, group kitchen
  'aluminium': { colour: '#d9d9d6' },
  'sling.teal': { colour: '#3e9a8c' },
  'canvas.ecru': { colour: '#e8dfcb' },
  'fabric.taupe': { colour: '#8d8377' },
  'fabric.stripe': { colour: '#c8622b' },      // Santarsa bedspreads: realism paints the stripes
  'fabric.check': { colour: '#7a2b33' },       // Vallorsaia bedspreads: realism paints the checks
  'linen': { colour: '#f3efe6' },
  'rush': { colour: '#c4a46a' },
  'paint.white': { colour: '#f1efe9' },        // white wooden chairs, cocktail tables, enamel shades
  'leaf': { colour: '#5f7d3c' },               // garlands, window boxes, pots
  'flower.red': { colour: '#c23a2e' },
  'flower.white': { colour: '#f4f1ea' },
  'flower.pink': { colour: '#e7a3a8' },
  'deer': { colour: '#7a5a3e' },
  'glass.window': { colour: '#20282b', glass: true },
  'glass.clear': { colour: '#9fb3b8', glass: true },  // hurricanes and lantern panes
  'water.pool': { colour: '#2fb6c8', water: true },
  'lamp.warm': { colour: '#ffcf8a', emissive: true }, // lantern glass, bulbs, pendants, lamp posts
  'candle': { colour: '#ffd9a0', emissive: true },
  'fire': { colour: '#ff8a3a', emissive: true },      // oven and hearth mouths
  'paper.lantern': { colour: '#f6efe0', emissive: true },
  'ui.highlight': { colour: '#e9c46a' },              // the glow over a chosen room
  'ghost': { colour: '#f3ead8', ghost: true },        // options as a sketch: opaque, dithered, depth-writing
  'ghost.glow': { colour: '#efe6d2', ghost: true },   // undecided lights: pale, no bloom, lights nothing
  'car.body': { colour: '#9aa0a3' },                  // tinted per car (instanceColor)
});
export const ATTRIBUTES = Object.freeze({
  lightSeed: 'lightSeed',   // float 0..1 per vertex on window glass: the order windows light up from 20:30 to 22:00
});

// ---------- what content tells the ground, the woods and the night ----------
export const SITE_KINDS = Object.freeze(['pad', 'surface', 'tree', 'shrub', 'clear']);
export const SURFACES = Object.freeze(['lawn', 'meadow', 'rough', 'gravel', 'track', 'path', 'flagstone', 'yard', 'woodfloor']);
export const SPECIES = Object.freeze(['oak', 'chestnut', 'hornbeam', 'fig', 'cypress', 'poplar', 'broom', 'scrub', 'reed']);
export const EMITTERS = Object.freeze(['window', 'lantern', 'lamp', 'bulb', 'candle', 'fire', 'pool', 'pendant', 'glow', 'wash']);

// ---------- services: who provides what (the members each must have) ----------
export const SERVICES = Object.freeze({
  sky: ['state', 'sunAt', 'fitShadow', 'refreshShadow', 'update'],                                   // realism
  ground: ['group', 'heightAt', 'groundAt', 'update'],                                              // realism
  materials: ['get', 'ready'],                                                                      // realism
  pipeline: ['renderer', 'mode', 'tier', 'setMode', 'render', 'setSize', 'pending', 'info', 'photo'], // realism
  estate: ['group', 'villas', 'rooms', 'pools', 'setFloor', 'highlight', 'box', 'floorBox', 'floorBearing', 'colliders', 'update'], // content
  rig: ['camera', 'controls', 'flyTo', 'jumpTo', 'update', 'resize', 'onEvent', 'flying'],           // experience
  nav: ['state', 'goEstate', 'openVilla', 'setFloor', 'showRoom', 'showPlace', 'showNote', 'lookFromHere', 'nextPlace', 'tour', 'touring', 'setMoment', 'search'], // experience
  weekendStage: ['load', 'detail', 'show', 'shown', 'option', 'update'],                            // content
});

function signal(initial) {
  let value = initial;
  const fns = new Set();
  return Object.freeze({
    get: () => value,
    set(v) { if (v === value) return; const prev = value; value = v; fns.forEach((fn) => fn(v, prev)); },
    on(fn) { fns.add(fn); return () => fns.delete(fn); },
  });
}

function registry(name, required) {
  const items = new Map();
  const fns = new Set();
  return Object.freeze({
    add(item) {
      const missing = required.filter((k) => item?.[k] === undefined);
      if (missing.length) throw new Error(`${name}: ${item?.id ?? '(no id)'} has no ${missing.join(', ')}`);
      if (items.has(item.id)) throw new Error(`${name}: ${item.id} is already registered`);
      if ('status' in item && !(item.status in STATUS)) throw new Error(`${name}: ${item.id} has an unknown status`);
      items.set(item.id, item);
      fns.forEach((fn) => fn('add', item));
      return item;
    },
    remove(id) { const item = items.get(id); if (!item) return; items.delete(id); fns.forEach((fn) => fn('remove', item)); },
    get: (id) => items.get(id),
    all: (filter) => [...items.values()].filter(filter || (() => true)),
    on(fn) { fns.add(fn); return () => fns.delete(fn); },
  });
}

// the weekend's moments: a day in WEEKEND, a plan status on every axis
function momentRegistry() {
  const reg = registry('moments', ['id', 'day', 'order', 'when', 'title', 'caption', 'plan']);
  return Object.freeze({ ...reg, add(m) {
    if (!WEEKEND.some((d) => d.id === m?.day) || ['what', 'when', 'where'].some((k) => !(m.plan?.[k] in PLAN[k]))) throw new Error(`moments: ${m?.id} needs a day and a plan`);
    return reg.add(m);
  } });
}

export function createApi({ THREE, model, root, stage, labelsLayer, params, coarse = false, store }) {
  const services = new Map();
  const waiting = new Map();

  const time = (() => {
    const sig = signal(PRESETS.sunset.at);
    let moving = null;
    return Object.freeze({
      get: sig.get,
      on: sig.on,
      // jump there, or move there over `duration` seconds; resolves on arrival or when a later set() takes over
      set(minutes, { animate = false, duration = 2.4 } = {}) {
        const to = clamp(minutes, DAY.start, DAY.end);
        moving?.cancel();
        moving = null;
        if (!animate) { sig.set(to); return Promise.resolve(); }
        const from = sig.get();
        moving = tween({ duration, easing: ease.inOut, onUpdate: (k) => sig.set(from + (to - from) * k) });
        return moving;
      },
    });
  })();

  const loop = (() => {
    const hooks = { pre: new Set(), post: new Set() };
    let wakeFn = () => {};
    let requestFn = () => {};
    return Object.freeze({
      // fn({ dt, t, moved, camera }) every drawn frame; phase 'pre' runs before the render, 'post' after it
      onFrame(fn, { phase = 'pre' } = {}) { hooks[phase].add(fn); return () => hooks[phase].delete(fn); },
      wake: () => wakeFn(),         // keep drawing for the idle time from now
      request: () => requestFn(),   // draw at least one more frame
      // kernel only
      bind({ wake, request }) { wakeFn = wake; requestFn = request; },
      run(phase, frame) { hooks[phase].forEach((fn) => fn(frame)); },
    });
  })();

  const api = {
    version: API_VERSION, THREE, model, root, stage, labelsLayer, params, coarse, store,
    scene: null, camera: null,   // the kernel sets these before any build
    renderer: null,              // realism sets this in its build

    places: registry('places', ['id', 'kicker', 'title', 'text', 'status', 'words', 'anchor', 'shots']),
    notes: registry('notes', ['id', 'title', 'sub', 'text', 'words']),
    cards: registry('cards', ['id', 'kicker', 'title', 'text']),
    site: registry('site', ['id', 'kind']),
    emitters: registry('emitters', ['id', 'kind', 'positions', 'colour']),
    pickables: registry('pickables', ['id', 'objects']),
    credits: registry('credits', ['id', 'html']),
    moments: momentRegistry(),
    layers: null,

    time,                                                                              // experience writes
    date: signal(DAY.date),   // experience writes (the weekend)
    light: signal({ minutes: PRESETS.sunset.at, az: 0, el: 0, night: 0, phase: 'golden' }), // realism writes
    tier: signal('fast'),                                                              // realism writes
    view: signal({ view: 'estate', floor: 'outside', selected: null }),                // experience writes
    loop,

    provide(name, impl) {
      const need = SERVICES[name];
      if (!need) throw new Error(`api: there is no service called ${name}`);
      if (services.has(name)) throw new Error(`api: ${name} is already provided`);
      const missing = need.filter((k) => !(k in impl));
      if (missing.length) throw new Error(`api: ${name} is missing ${missing.join(', ')}`);
      services.set(name, impl);
      (waiting.get(name) || []).forEach((resolve) => resolve(impl));
      waiting.delete(name);
      return impl;
    },
    use(name) {
      const impl = services.get(name);
      if (!impl) throw new Error(`api: ${name} is not provided yet (builds run realism, content, experience)`);
      return impl;
    },
    has: (name) => services.has(name),
    ready(name) {
      if (services.has(name)) return Promise.resolve(services.get(name));
      return new Promise((resolve) => { if (!waiting.has(name)) waiting.set(name, []); waiting.get(name).push(resolve); });
    },
  };

  // Layers: content registers each with load(api), which builds its group the first time it is switched on (its code
  // arrives by dynamic import inside load). set() adds the group to the scene and shows or hides it.
  api.layers = (() => {
    const reg = registry('layers', ['id', 'label', 'status', 'notice', 'load']);
    const on = new Map();
    const built = new Map();
    const state = signal(Object.freeze({}));
    async function set(id, value) {
      const layer = reg.get(id);
      if (!layer) throw new Error(`layers: there is no layer called ${id}`);
      on.set(id, !!value);
      if (value && !built.has(id)) built.set(id, Promise.resolve().then(() => layer.load(api)).then((obj) => { api.scene.add(obj); return obj; }));
      let obj = null;
      try {
        obj = built.has(id) ? await built.get(id) : null;
      } catch (err) {
        // it did not load (a dropped connection): off again, and the next switch-on tries afresh
        built.delete(id);
        on.set(id, false);
        state.set(Object.freeze({ ...state.get(), [id]: false }));
        throw err;
      }
      if (obj) obj.visible = !!on.get(id);   // the latest call wins
      state.set(Object.freeze({ ...state.get(), [id]: !!on.get(id) }));
      loop.request();
    }
    return Object.freeze({ ...reg, set, isOn: (id) => !!on.get(id), state: Object.freeze({ get: state.get, on: state.on }) });
  })();

  return api;
}
