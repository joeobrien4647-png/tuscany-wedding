// Pins from the places registry, each with its status tag ("Probably", "Approximate spot", "How it could look"),
// and the far landmarks across the valley at the sunset view and through golden hour. v1's own pins
// (place:<id>, made before the seam existed) get the same markup; places v1 never knew get pins of their own.
import { STATUS } from '../api.js';
import { esc } from './dom.js';

export const pinName = (p) => p.label || String(p.kicker || p.id).split(', ').pop();
const villaName = (id) => (id ? ` Villa ${id[0].toUpperCase()}${id.slice(1)}` : '');

export function fillPin(el, place) {
  const words = STATUS[place.status] || '';
  el.classList.add('vx-pin');
  el.classList.toggle('is-approx', place.status === 'approx' || place.status === 'likely');
  el.classList.toggle('is-idea', place.status === 'idea');
  el.dataset.place = place.id;
  el.dataset.status = place.status || 'fact';
  el.setAttribute('aria-label', `${pinName(place)},${villaName(place.villa)}${words ? `, ${words.toLowerCase()}` : ''}`.replace(/,$/, ''));
  el.innerHTML = `<span class="vx-pin-dot" aria-hidden="true"></span><span class="vx-pin-text"><span class="vx-pin-name">${esc(pinName(place))}</span>${words ? `<span class="vx-pin-tag">${esc(words)}</span>` : ''}</span>`;
}

// short names for the peaks and places across the valley (the model's names are long and exact)
const LANDMARKS = {
  'lago-di-montedoglio': 'Lake Montedoglio',
  'la-verna': 'La Verna',
  'monte-altuccia': 'Alpe di Catenaia',
  'monte-dei-frati': 'Monte dei Frati',
  sansepolcro: 'Sansepolcro',
};

export function installPins(ctx) {
  const { api, labels, base } = ctx;
  const nav = () => api.use('nav');
  const own = new Map();   // place id -> label id, for pins this file made

  const v1Pin = (id) => labels.items.get(`place:${id}`);
  const visible = (place) => {
    if (place.layer && !api.layers.isOn(place.layer)) return false;
    const st = base.state;
    if (st.view === 'estate') return true;
    return st.floor === 'outside' && (!place.villa || place.villa === st.view);
  };

  function pinFor(place) {
    if (place.room) return;
    const old = v1Pin(place.id);
    if (old) {
      fillPin(old.el, place);
      labels.remeasure(old.id);
      return;
    }
    const anchor = place.anchor?.();
    if (!anchor) return;
    let item = own.get(place.id) && labels.items.get(own.get(place.id));
    if (!item) {
      const el = document.createElement('button');
      el.type = 'button';
      el.addEventListener('click', () => nav().showPlace(place.id));
      const id = `xpin:${place.id}`;
      item = labels.add(id, { position: anchor, el, group: 'xpin', anchor: 'dot', priority: 20, minDist: place.pin?.minDist ?? 10, maxDist: place.pin?.maxDist ?? 620, when: () => visible(place) });
      own.set(place.id, id);
    }
    fillPin(item.el, place);
    labels.remeasure(item.id);
  }

  api.places.all().forEach(pinFor);
  api.places.on((op, place) => {
    if (op === 'add') pinFor(place);
    else if (own.has(place.id)) { labels.remove(own.get(place.id)); own.delete(place.id); }
    api.loop.request();
  });
  api.layers.state.on(() => api.loop.request());

  // ---------- the far landmarks ----------
  const ground = api.use('ground');
  const marks = (api.model.landmarks || []).filter((l) => LANDMARKS[l.id]);
  const setting = (minutes) => minutes >= 19 * 60 + 40 && minutes <= 21 * 60 + 20;
  const westward = () => {
    const d = api.camera.getWorldDirection(api.camera.position.clone());
    const bearing = (Math.atan2(d.x, -d.z) * 180) / Math.PI;
    return Math.abs(((bearing - 285 + 540) % 360) - 180) < 75;
  };
  const showLandmarks = () => base.state.floor === 'outside' && (ctx.landmarkFocus || ((base.state.selected?.id === 'sunset' || setting(api.time.get()) || ctx.tourAt === 'sunset') && westward()));
  marks.forEach((l, i) => {
    const [x, z] = l.local;
    const dist = Math.hypot(x, z);
    const y = Math.max(ground.heightAt(x, z), l.elevation != null ? l.elevation - (api.model.origin?.groundElevation_m ?? 0) - (dist * dist) / (2 * 6371000) * 0.87 : -Infinity);
    const el = document.createElement('div');
    el.className = 'vx-landmark';
    el.dataset.landmark = l.id;
    const km = dist >= 9500 ? Math.round(dist / 1000) : Math.round(dist / 100) / 10;
    const sun = l.id === 'la-verna' ? '<span class="vx-landmark-sun">The sun sets just left of it on the day, roughly</span>' : '';
    el.innerHTML = `<span class="vx-landmark-name">${esc(LANDMARKS[l.id])}</span><span class="vx-landmark-sub">${km} km</span>${sun}<span class="vx-landmark-stem" aria-hidden="true"></span>`;
    labels.add(`landmark:${l.id}`, { position: new api.THREE.Vector3(x, y + 40, z), el, group: 'landmark', anchor: 'foot', priority: 600 + i, when: showLandmarks, clip: true });
  });
  api.time.on(() => api.loop.request());
  const rig = api.use('rig');
  labels.setClip(() => rig.insets.top);
  labels.setObstacles(controlRects(api));
  // the controls settle after the first frames: place the labels again once they have
  [700, 1600].forEach((ms) => setTimeout(() => api.loop.request(), ms));
  labels.setOccluder(occluder(api, ground));

  return { pinFor, visible };
}

// the page's controls over the model, in stage pixels, measured at most every quarter second (labels move each frame)
function controlRects(api) {
  const stage = api.stage, root = api.root;
  let at = -1e9, rects = [];
  const shown = (el) => el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  return () => {
    const now = performance.now();
    if (now - at < 250) return rects;
    at = now;
    const s = stage.getBoundingClientRect();
    const rect = (el, side = false, top = false) => { const r = el.getBoundingClientRect(); return { x0: r.left - s.left, x1: r.right - s.left, y0: r.top - s.top, y1: r.bottom - s.top, side, top }; };
    const side = [...root.querySelectorAll('#vx-side .vx-side-btn')].filter(shown).map((el) => rect(el, true));
    const search = root.querySelector('#vx-search input');
    const rest = ['#vx-week', '#vx-time', '#vx-floors', '.vx-places', '#vx-map', '#vx-notice', '#vx-inside', '#vx-note']
      .map((q) => root.querySelector(q)).filter(shown).map((el) => rect(el));
    rects = [...side, ...(shown(search) ? [rect(search, false, true)] : []), ...rest].filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
    return rects;
  };
}

// Whether something solid stands between the camera and a label's spot, for a camera near the ground (at eye level a
// villa's name should not float over the woods or a nearer building): the hills, the woods' crowns (about 11 m up
// where the blanket is) and the houses as boxes. The last stretch before the spot is not tested, so a label is
// never hidden by the thing it names.
function occluder(api, ground) {
  const boxes = [...api.model.villas.flatMap((v) => v.blocks), ...api.model.outbuildings].map((b) => ({
    c: b.c, cs: Math.cos(b.rot), sn: Math.sin(b.rot), hl: b.length / 2, hw: b.width / 2, y0: b.floor - 1, y1: b.floor + (b.eaves ?? 3) + (b.ridgeOver ?? 0) * 0.5,
  }));
  const crown = (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > 560 || !ground.mask) return 0;
    const m = ground.mask(x, z);
    return m < 0.3 ? 0 : 11 * Math.min(1, (m - 0.3) / 0.45);
  };
  return (c, p) => {
    if (c.y - ground.groundAt(c.x, c.z) > 60) return false;
    const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
    const len = Math.hypot(dx, dy, dz);
    const end = 1 - Math.max(14, len * 0.05) / Math.max(len, 1e-6);
    if (end <= 0) return false;
    const step = Math.min(25, Math.max(2, len / 60)) / len;
    for (let t = step; t < end; t += step) {
      const x = c.x + dx * t, y = c.y + dy * t, z = c.z + dz * t;
      if (y < ground.groundAt(x, z) + crown(x, z) - 0.5) return true;
    }
    for (const b of boxes) {
      // the segment against the box's footprint (slabs in its own frame), then the height where it enters
      const lx0 = (c.x - b.c[0]) * b.cs - (c.z - b.c[1]) * b.sn, lz0 = (c.x - b.c[0]) * b.sn + (c.z - b.c[1]) * b.cs;
      const ldx = dx * b.cs - dz * b.sn, ldz = dx * b.sn + dz * b.cs;
      let t0 = 0, t1 = end;
      for (const [o, d, h] of [[lx0, ldx, b.hl], [lz0, ldz, b.hw]]) {
        if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) { t0 = 1; break; } continue; }
        const a = (-h - o) / d, e = (h - o) / d;
        t0 = Math.max(t0, Math.min(a, e));
        t1 = Math.min(t1, Math.max(a, e));
      }
      if (t0 >= t1) continue;
      const ya = c.y + dy * t0, yb = c.y + dy * t1;
      if (Math.min(ya, yb) < b.y1 && Math.max(ya, yb) > b.y0) return true;
    }
    return false;
  };
}
