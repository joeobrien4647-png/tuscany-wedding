// Where the camera goes and what the guest reads: v1's actions (app.js before v2) moved here at Phase 0 and reading
// the registries. Villas, floors, rooms, places and notes; their cards; taps on the model; the villa names, pins and
// room tags in the scene; the wheel hint; the ?place= and ?villa= links. experience/index.js builds on this as
// `base`: the clock, the tour and search v2 take over setMoment, tour and search.
import { MODES, PRESETS, toHHMM } from '../api.js';
import { bearingDir } from '../util.js';

const VIEW_BEARING = { santarsa: 212, vallorsaia: 238 };   // standing downhill, the sunset light on the walls in view

export function createNav(api, { rig, labels, snapshot }) {
  const THREE = api.THREE;
  const { model, root, stage } = api;
  const camera = rig.camera;
  const estate = api.use('estate'), ground = api.use('ground'), pipeline = api.use('pipeline');
  let ui = null;
  let started = false;   // the first shot is in (start())
  const state = { view: 'estate', floor: 'outside', selected: null, moment: 'sunset' };

  // ---------- shots ----------
  const villaBox = (id, withPool = true) => estate.box(id, { withPool });
  const roomPlace = (key) => api.places.all((p) => p.room === key)[0];

  function roomShots(key) {
    const r = estate.rooms.get(key);
    const pad = r.cell.row === null ? 2.5 : 3.2;
    const box = { x1: r.box.x1 - pad, x2: r.box.x2 + pad, y1: r.box.y1, y2: r.box.y2, z1: r.box.z1 - pad, z2: r.box.z2 + pad };
    const bearing = estate.floorBearing(r.villa);
    const fly = { frame: { box, bearing, elevation: 62, margin: 0.04 }, limits: { min: 3, max: 600, maxPolar: 1.45 } };
    return { fly, eye: { frame: { box: { ...box }, bearing: bearing + 25, elevation: 48, margin: 0.02 }, hfov: 60 } };
  }
  const placeShots = (place) => (place.room ? roomShots(place.room) : place.shots());

  const allBox = (() => {
    const bs = ['santarsa', 'vallorsaia'].map((id) => villaBox(id));
    return { x1: Math.min(...bs.map((b) => b.x1)) - 30, x2: Math.max(...bs.map((b) => b.x2)) + 30, y1: -12, y2: 22, z1: Math.min(...bs.map((b) => b.z1)) - 20, z2: Math.max(...bs.map((b) => b.z2)) + 20 };
  })();
  // a camera `dist` metres out on a compass `bearing` from the middle of the estate, `height` up, looking along `look`
  function lookShot({ bearing, dist, height, look, pitch, fov }) {
    const c = new THREE.Vector3((allBox.x1 + allBox.x2) / 2, 0, (allBox.z1 + allBox.z2) / 2);
    const pos = c.clone().add(bearingDir(bearing).multiplyScalar(dist));
    pos.y = Math.max(height, ground.groundAt(pos.x, pos.z) + 60);
    const d = bearingDir(look), p = THREE.MathUtils.degToRad(pitch);
    const target = pos.clone().add(new THREE.Vector3(d.x * Math.cos(p), Math.sin(p), d.z * Math.cos(p)).multiplyScalar(dist * 1.1));
    return { pos, target, fov };
  }
  // a camera `dist` metres out on a compass bearing `from` a ground point, `h` above that point, looking along `look`
  function pointShot({ x, z, from, dist, h, look, pitch, fov }) {
    const pos = new THREE.Vector3(x, 0, z).add(bearingDir(from).multiplyScalar(dist));
    pos.y = ground.groundAt(x, z) + h;
    const d = bearingDir(look), p = THREE.MathUtils.degToRad(pitch);
    return { pos, target: pos.clone().add(new THREE.Vector3(d.x * Math.cos(p), Math.sin(p), d.z * Math.cos(p)).multiplyScalar(dist)), fov };
  }
  const shots = {
    // phones: from the south-east, Santarsa and its pool in front, Vallorsaia beyond, the lake and the sunset haze above
    // computers: closer and looking further down, so both houses show in their clearings, the valley beyond
    estate: { ...lookShot({ bearing: 108, dist: 560, height: 300, look: 284, pitch: -20, fov: 40 }), limits: { min: 20, max: 3000 },
      portrait: { ...pointShot({ x: 0, z: 60, from: 128, dist: 430, h: 250, look: 306, pitch: -21, fov: 58 }), fixed: true } },
    villa: (id) => ({ frame: { box: villaBox(id), bearing: VIEW_BEARING[id], elevation: 30, margin: 0.06 }, limits: { min: 6, max: 1400 } }),
    floor: (id, f = 0) => ({ frame: { box: estate.floorBox(id, f), bearing: estate.floorBearing(id), elevation: 58, margin: 0.02 }, limits: { min: 4, max: 800, maxPolar: 1.4 } }),
  };

  // the clock's words for a snippet: a quick button's name when the clock is on it, else the time
  const momentLabel = () => {
    const m = api.time.get();
    const k = Object.keys(PRESETS).find((n) => Math.abs(PRESETS[n].at - m) < 1);
    return k ? PRESETS[k].label : toHHMM(m);
  };

  // ---------- trees out of the way of a cut-open floor or a room (realism/trees.js TREE_CUT) ----------
  const treeCut = ground?.treeCut;
  let cutView = null;
  api.view.on((v) => {
    if (!treeCut) return;
    // closing a card keeps the trees out of the way of what it showed, until the guest goes somewhere else
    if (!v?.selected && v?.floor === 'outside' && v.view === cutView && treeCut.value.w > 0) return;
    cutView = v?.view ?? null;
    const sel = v?.selected;
    const place = sel?.type === 'place' ? api.places.get(sel.id) : null;
    const roomKey = sel?.type === 'room' ? sel.id : place?.room;
    const r = roomKey && estate.rooms.get(roomKey);
    const at = place && !r ? place.anchor?.() : null;
    if (r) treeCut.value.set(r.centre.x, r.centre.y, r.centre.z, 16);
    else if (v && v.view !== 'estate' && v.floor !== 'outside' && estate.villas.has(v.view)) {
      const b = estate.floorBox(v.view, v.floor);
      treeCut.value.set((b.x1 + b.x2) / 2, b.y1, (b.z1 + b.z2) / 2, 22);
    } else if (at) treeCut.value.set(at.x, at.y, at.z, 9);
    else treeCut.value.set(0, 0, 0, 0);
    api.loop.request();
  });

  // ---------- actions ----------
  function setVillaFloor(id, f) {
    estate.villas.forEach((v) => { estate.setFloor(v.id, v.id === id ? f : 'outside'); });
  }

  function goEstate() {
    state.view = 'estate';
    state.floor = 'outside';
    state.selected = null;
    setVillaFloor(null, 'outside');
    estate.highlight(null);
    ui.update(state);
    return rig.flyTo(shots.estate);
  }

  function openVilla(id, { floor = 'outside', fly = true, card = true } = {}) {
    if (!estate.villas.has(id)) return Promise.resolve();
    state.view = id;
    state.floor = floor;
    state.selected = card ? { type: 'villa', id } : state.selected;
    setVillaFloor(id, floor);
    estate.highlight(null);
    ui.update(state);
    if (card) ui.showCard(villaCard(id));
    if (!fly) return Promise.resolve();
    return rig.flyTo(floor === 'outside' ? shots.villa(id) : shots.floor(id, floor));
  }

  function setFloor(f) {
    if (state.view === 'estate') return Promise.resolve();
    state.floor = f;
    setVillaFloor(state.view, f);
    if (state.selected?.type === 'room') { state.selected = null; estate.highlight(null); ui.hideCard(); }
    ui.update(state);
    return rig.flyTo(f === 'outside' ? shots.villa(state.view) : shots.floor(state.view, f));
  }

  async function showRoom(key) {
    const r = estate.rooms.get(key);
    if (!r) return;
    state.view = r.villa;
    state.floor = r.floor;
    state.selected = { type: 'room', id: key };
    setVillaFloor(r.villa, r.floor);
    estate.highlight(key);
    ui.update(state);
    ui.showCard(roomCard(key));
    await rig.flyTo(roomShots(key).fly);
  }

  async function showPlace(id) {
    const place = api.places.get(id);
    if (!place) return;
    if (place.room) {
      const r = estate.rooms.get(place.room);
      state.view = r.villa;
      state.floor = r.floor;
      setVillaFloor(r.villa, r.floor);
      estate.highlight(place.room);
    } else {
      if (place.villa && state.view !== place.villa) state.view = place.villa;
      state.floor = 'outside';
      setVillaFloor(null, 'outside');
      estate.highlight(null);
    }
    const sel = { type: 'place', id };
    state.selected = sel;
    ui.update(state);
    const s = placeShots(place);
    ui.showCard(placeCard(place));
    const flight = rig.flyTo(s.fly);
    const snap = await shoot(s.eye);
    if (state.selected?.type === 'place' && state.selected.id === id) ui.setSnapshot(snap, momentLabel());
    await flight;
  }

  function showNote(id) {
    const n = api.notes.get(id);
    if (!n) return;
    state.selected = { type: 'note', id };
    ui.showCard({ kind: 'note', kicker: 'Good to know', title: n.title, text: n.text, status: n.status, actions: [{ id: 'close', label: 'Got it' }] });
    if (n.villa && state.view !== n.villa) openVilla(n.villa, { card: false });
  }

  async function lookFromHere() {
    const sel = state.selected;
    if (!sel) return;
    const place = sel.type === 'place' ? api.places.get(sel.id) : null;
    const s = place ? placeShots(place) : sel.type === 'room' ? roomShots(sel.id) : null;
    if (!s?.eye) return;
    ui.hideCard({ keepSelection: true });
    if (s.eye.frame) return rig.flyTo({ ...s.eye, limits: { min: 1, max: 600 } });
    return rig.flyTo({ pos: s.eye.pos, target: s.eye.pos.clone().lerp(s.eye.target, 0.04), fov: 58, fixed: true, eye: true, limits: { min: 0.5, max: 600 } });
  }

  // the places a guest can step through: outside ones, and a layer's only while it is on
  const stepList = () => api.places.all((p) => !p.room && (!p.layer || api.layers.isOn(p.layer)));
  function nextPlace(step = 1) {
    const list = stepList();
    if (!list.length) return Promise.resolve();
    const i = list.findIndex((p) => p.id === state.selected?.id);
    return showPlace(list[(i + step + list.length) % list.length].id);
  }

  function setGraphics(m) {
    pipeline.setMode(m);
    ui.setGraphics(pipeline.mode, pipeline.tier);
  }

  // ---------- cards ----------
  function villaCard(id) {
    const c = api.cards.get(`villa:${id}`) || {};
    return {
      kind: 'villa', kicker: c.kicker, title: c.title, text: c.text, facts: c.facts, photo: c.photo, status: c.status,
      where: c.where, actions: [{ id: 'floor-0', label: 'Ground floor' }, { id: 'floor-1', label: 'First floor' }],
    };
  }

  function roomCard(key) {
    const r = estate.rooms.get(key);
    if (!r.bedroom) {
      const place = roomPlace(key);
      if (place) return placeCard(place);
      const c = api.cards.get(`living:${r.villa}`) || { kicker: 'Inside', title: 'Living space', text: '' };
      return { kind: 'room', kicker: c.kicker, title: c.title, text: c.text, status: c.status, actions: [{ id: 'close', label: 'Close' }] };
    }
    const c = api.cards.get(`bedroom:${r.villa}`);
    const { id, ...card } = c;
    return { kind: 'room', ...card, actions: [{ id: 'close', label: 'Got it' }], roomKey: key };
  }

  function placeCard(place) {
    return {
      kind: 'place', kicker: place.kicker, title: place.title, text: place.text, facts: place.facts, photo: place.photo,
      where: place.where, approx: place.status !== 'fact', status: place.status, moment: place.moment, placeId: place.id,
      actions: [{ id: 'look', label: 'Look from here' }, { id: 'next-place', label: 'Next place' }],
    };
  }

  // ---------- snippets: the kernel renders them off to one side of the live view, at the card's shape ----------
  const shoot = (eye, opts = {}) => snapshot(eye, { aspect: ui.snapAspect(), ...opts });

  // ---------- taps on the model ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = api.renderer.domElement;
  const isShown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 600;
    downAt = null;
    if (moved > 8 || !quick || root.classList.contains('is-weekend')) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const owners = new Map();
    api.pickables.all((p) => !p.layer || api.layers.isOn(p.layer)).forEach((p) => p.objects.forEach((o) => owners.set(o, p)));
    const hit = raycaster.intersectObjects([...owners.keys()], false).find((h) => isShown(h.object));
    if (hit) tapped(owners.get(hit.object), hit.point);
  });

  function tapped(pick, p) {
    if (pick.room) {
      const r = estate.rooms.get(pick.room);
      if (r?.bedroom) showRoom(r.id);
      else if (pick.place) showPlace(pick.place);
      return;
    }
    // the layer's things and buildings with a place of their own (the chapel) open their cards
    if (pick.place && (pick.layer || pick.storey == null)) { showPlace(pick.place); return; }
    const villa = pick.villa;
    if (!villa) return;
    if (state.view !== villa || state.floor === 'outside') { openVilla(villa); return; }
    // inside a cut-open floor: which room did the tap land in?
    let best = null, bestD = Infinity;
    estate.rooms.forEach((r) => {
      if (r.villa !== villa || r.floor !== state.floor) return;
      if (p.x < r.box.x1 - 0.2 || p.x > r.box.x2 + 0.2 || p.z < r.box.z1 - 0.2 || p.z > r.box.z2 + 0.2) return;
      const d = Math.hypot(p.x - r.centre.x, p.z - r.centre.z);
      if (d < bestD) { bestD = d; best = r; }
    });
    if (best?.bedroom) showRoom(best.id);
    else if (best) { const place = roomPlace(best.id); if (place) showPlace(place.id); }
  }

  // ---------- labels in the scene ----------
  function addLabels() {
    estate.villas.forEach((v) => {
      const top = new THREE.Vector3((v.box.x1 + v.box.x2) / 2, v.box.y2 + 5, (v.box.z1 + v.box.z2) / 2);
      labels.add(`villa:${v.id}`, { position: top, el: ui.villaTag(v.data), group: 'villa', minDist: 60 });
    });
    // the base model's outside places; a layer's places get pins from pins.js when the layer arrives
    api.places.all((p) => !p.room && !p.layer).forEach((p) => {
      const a = p.anchor?.();
      if (!a) return;
      labels.add(`place:${p.id}`, { position: a, el: ui.pin(p), group: 'pin', minDist: p.pin?.minDist ?? 10, maxDist: p.pin?.maxDist ?? 620 });
    });
    estate.rooms.forEach((r) => {
      const place = roomPlace(r.id);
      if (!r.bedroom && !place) return;
      const pos = r.centre.clone().setY(r.centre.y + 1.5);
      labels.add(`room:${r.id}`, { position: pos, el: ui.roomTag(r, place), group: 'room' });
    });
  }

  function refreshLabels() {
    labels.setShown((it) => {
      if (it.group === 'villa') return state.view === 'estate' || state.floor === 'outside';
      if (it.group === 'pin') {
        const p = api.places.get(it.id.slice(6));
        if (!p) return false;
        if (state.view === 'estate') return true;
        return state.floor === 'outside' && (!p.villa || p.villa === state.view || p.id === 'sunset');
      }
      if (it.group === 'room') {
        const r = estate.rooms.get(it.id.slice(5));
        return !!r && state.view === r.villa && state.floor === r.floor;
      }
      return true;
    });
    api.loop.request();
  }
  // labels move with the camera, after the frame is drawn (spec section 3, frame order 7)
  api.loop.onFrame(({ moved, requested }) => { if (moved || requested) labels.update(); }, { phase: 'post' });
  const sizeLabels = () => { if (stage.clientWidth && stage.clientHeight) { labels.resize(stage.clientWidth, stage.clientHeight); api.loop.request(); } };
  new ResizeObserver(sizeLabels).observe(stage);
  sizeLabels();

  // ---------- wheel and touch: the page scrolls past the model ----------
  // The wheel scrolls the page unless Control (or Command) is held; a trackpad pinch arrives as Control + wheel.
  const zoomKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
  let wheelHintAt = -Infinity;
  stage.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation();
    const now = performance.now();
    if (now - wheelHintAt > 6000) { wheelHintAt = now; ui.toast(`Hold ${zoomKey} and scroll to zoom the model`); }
  }, { capture: true, passive: true });

  // ---------- graphics: the menu follows the level realism settles on ----------
  const RANK = { fast: 0, balanced: 1, best: 2 };
  api.tier.on((tier, prev) => {
    ui?.setGraphics(pipeline.mode, tier);
    if (pipeline.mode === 'auto' && RANK[tier] < RANK[prev] && started) ui?.toast(`Switched to ${tier === 'fast' ? 'Fast' : 'Balanced'} graphics to keep things smooth`);
  });

  // ---------- start: the first shot and the deep links (experience's ready) ----------
  function start() {
    refreshLabels();
    ui.update(state);
    ui.setGraphics(pipeline.mode, pipeline.tier);
    rig.jumpTo(shots.estate);
    started = true;
    const deep = api.params.get('place');
    if (deep && api.places.get(deep)) { showPlace(deep); return true; }
    const villa = api.params.get('villa');
    if (villa && estate.villas.has(villa)) { openVilla(villa); return true; }
    return false;
  }

  return {
    state, shots, rig, estate, pipeline: { MODES, get mode() { return pipeline.mode; }, get tier() { return pipeline.tier; } },
    goEstate, openVilla, setFloor, showRoom, showPlace, showNote, lookFromHere, nextPlace, setGraphics,
    setMoment: (name) => (PRESETS[name] ? api.time.set(PRESETS[name].at, { animate: true }) : Promise.resolve()),
    tour: () => {}, touring: false, search: () => [],
    snapshot: (eye) => shoot(eye),
    refreshLabels, roomShots, momentLabel, start,
    // the controls exist: the villa names, the base model's pins and the room tags go in (before pins.js looks)
    bindUI(u) { ui = u; addLabels(); },
  };
}
