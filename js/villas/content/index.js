// The content track's installer (spec section 3): declare() fills the registries (site entries for the ground,
// places, notes, cards, the "how it could look" layer); build() builds the estate from material names and provides
// the `estate` service; ready() sets what depends on the light. Interiors and the wedding layer arrive by dynamic
// import the first time they are needed.
import { IDEA_NOTICE } from '../api.js';
import { computeLayout } from './layout.js';
import { siteEntries } from './siteplan.js';
import { registerWords } from './places.js';
import { MOMENT_WORDS } from './words.js';
import { createEstate } from './estate.js';

const COLOURS = { window: '#ffb45e', lantern: '#ffc27a', lamp: '#ffcf8a', pendant: '#ffd08f', pool: '#46d5e6', fire: '#ff8a3a', bulb: '#ffcf86', candle: '#ffd9a0', glow: '#fff3e6', wash: '#ffb070' };
const SIZES = { window: 1.0, lantern: 0.5, lamp: 0.6, pendant: 0.4, pool: 9, fire: 0.5, bulb: 0.18, candle: 0.08, glow: 0.12, wash: 1 };

export function declare(api) {
  const state = stateOf(api);
  state.L = computeLayout(api.model);
  siteEntries(api.model, state.L).forEach((e) => api.site.add(e));
  state.words = registerWords(api, state.L, state.ctx);
  api.layers.add({
    id: 'wedding', label: 'How it could look', status: 'idea', notice: IDEA_NOTICE,
    load: (a) => import('./wedding.js').then((m) => m.loadWedding(a, state)),
  });
  MOMENT_WORDS.forEach((m) => api.moments.add({ ...m, kicker: DAY_NAMES[m.day] }));
  api.provide('weekendStage', weekendShell(api, state));
}

const DAY_NAMES = { fri: 'Friday 28 May', sat: 'Saturday 29 May', sun: 'Sunday 30 May', mon: 'Monday 31 May' };

// the weekend's stage: a shell until content/weekend.js loads
function weekendShell(api, state) {
  let impl = null, loading = null;
  const load = () => (loading ??= Promise.all([import('./weekend.js'), api.use('materials').ready()]).then(([m]) => (impl = m.createStage(api, state))).catch((err) => { loading = null; throw err; }));
  const later = (k) => (...a) => (impl ? impl[k](...a) : load().then((s) => s[k](...a)));
  const now = (k, none) => (...a) => (impl ? impl[k](...a) : none);
  return { load, show: later('show'), option: later('option'), detail: now('detail', null), shown: now('shown', []), opener: now('opener', null),
    update: now('update'), ideas: now('ideas', []), meshes: now('meshes', []), get words() { return impl?.words ?? null; } };
}

export async function build(api, { onProgress } = {}) {
  onProgress?.('Building the villas');
  buildNow(api);
}

// The same build, synchronous (build() runs it; a test can run it on a second api).
export function buildNow(api) {
  const state = stateOf(api);
  const mats = api.use('materials');
  const ground = api.use('ground');
  state.ctx.groundAt = ground.groundAt;
  state.ctx.heightAt = ground.heightAt;
  const estate = createEstate({
    model: api.model, layout: state.L, mat: (n) => mats.get(n), groundAt: ground.groundAt, tier: api.tier.get(),
    loadInteriors: (villa) => import('./interiors.js').then((m) => m.loadInteriors(api, state, villa)),
  });
  state.estate = estate;
  state.ctx.estate = estate;
  api.scene.add(estate.group);
  // the road, the yard and the parking never show in a pool's reflection: Best's mirror leaves them out
  api.use('sky').mirrorHide?.add(estate.estateGroup);
  api.provide('estate', estate);
  registerEmitters(api, estate.emitted);
  estate.picks.forEach((p) => api.pickables.add({ id: p.id, objects: [p.mesh], villa: p.villa, place: p.place || undefined, block: p.block, storey: p.storey }));
  api.light.on((l) => showDeer(estate, l));
  api.loop.onFrame((frame) => estate.update(frame));
  return estate;
}

export function ready(api) {
  const state = stateOf(api);
  if (state.estate) showDeer(state.estate, api.light.get());
}

function showDeer(estate, light) {
  const on = !!light && estate.deer.userData.showWhen.includes(light.phase);
  if (estate.deer.visible !== on) { estate.deer.visible = on; }
}

export function registerEmitters(api, emitted, { layer = null, prefix = '' } = {}) {
  const groups = new Map();
  emitted.forEach((e) => {
    const lay = e.layer ?? layer;
    const key = `${prefix}${e.villa || 'estate'}:${e.kind}${lay ? `:${lay}` : ''}`;
    if (!groups.has(key)) groups.set(key, { id: key, kind: e.kind, positions: [], seeds: [], colour: COLOURS[e.kind] || '#ffcf8a', size: SIZES[e.kind] ?? 0.3, villa: e.villa || undefined, layer: lay || undefined, status: e.status || (lay ? 'idea' : 'fact') });
    const g = groups.get(key);
    if (e.rect) g.rect = e.rect;   // a wash: [length, width, rotation] of the light it lays on a roof's underside
    g.positions.push(e.pos.x, e.pos.y, e.pos.z);
    g.seeds.push(e.seed ?? 0);
  });
  groups.forEach((g) => { if (api.emitters.get(g.id)) api.emitters.remove(g.id); api.emitters.add(g); });
  return [...groups.keys()];
}

// per-api state, so the installer can run against more than one api (tests build a second one)
const STATES = new WeakMap();
function stateOf(api) {
  if (!STATES.has(api)) STATES.set(api, { L: null, ctx: {}, estate: null });
  return STATES.get(api);
}
export { stateOf };
