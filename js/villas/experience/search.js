// Search v2, across everything the registries and the model hold: places, notes, cards, layers, the villas, the
// far landmarks, the weekend and times of day ("sunset" offers 20:43 and the view, "20:30" sets the clock).
// Forgiving: one slip in a word of five letters or more, and a few synonyms (hot tub, bbq, loo). A number on its own
// is a room number, which gets the honest answer, as in v1. Ideas from the wedding layer come back tagged
// "How it could look", and choosing one switches the layer on.
import { STATUS, DAY, PRESETS, toHHMM, toMinutes } from '../api.js';
import { strip } from './dom.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').trim();

// words that say nothing about what to find ("where am I sleeping", "show me the pool")
const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'at', 'on', 'to', 'for', 'and', 'or', 'is', 'are', 'am', 'i', 'im', 'me', 'my',
  'we', 'our', 'us', 'you', 'your', 'it', 'its', 's', 'where', 'whats', 'what', 'which', 'who', 'how', 'when', 'can', 'do', 'does',
  'there', 'here', 'will', 'be', 'by', 'with', 'near', 'show', 'find', 'see', 'get', 'go', 'please', 'villa', 'villas', 'la', 'conca']);

// each word finds the others too
const SYNONYMS = [
  ['tub', 'jacuzzi', 'spa', 'whirlpool', 'hydromassage'],
  ['bbq', 'barbecue', 'barbecues', 'barbeque', 'grill'],
  ['loo', 'toilet', 'toilets', 'wc', 'bathroom', 'bathrooms', 'restroom'],
  ['chapel', 'church'],
  ['salone', 'lounge', 'living'],
  ['dinner', 'dining', 'supper'],
  ['dancing', 'dance', 'disco'],
  ['walk', 'walking', 'hike', 'hiking', 'trail', 'trails'],
  ['pool', 'swim', 'swimming'],
  ['sunbed', 'sunbeds', 'loungers', 'lounger'],
  ['foosball', 'football', 'fussball'],
  ['car', 'cars', 'parking', 'park'],
  ['lake', 'montedoglio', 'reservoir'],
];
const SYN = new Map();
SYNONYMS.forEach((group) => group.forEach((w) => SYN.set(w, group)));

// times of day people ask for, as marks on the time bar or the quick buttons
const TIME_WORDS = {
  sunrise: 'sunrise', dawn: 'sunrise', morning: 'over-the-hill', noon: 'noon', midday: 'noon', lunchtime: 'noon',
  golden: 'golden', sunset: 'sunset', dusk: 'sunset', ridge: 'ridge', blue: 'blue', twilight: 'blue',
  afternoon: 'day', night: 'night', stars: 'night', dark: 'night', evening: 'golden',
};

const VILLA_IDS = ['santarsa', 'vallorsaia'];
const villaOf = (w) => (w.length >= 3 ? VILLA_IDS.find((id) => id.startsWith(w)) : undefined);

// one insertion, deletion, substitution or swap of neighbours
function oneEdit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// how well a query word hits a list of terms: 2 exact or a prefix (4+ letters), 1.5 by a synonym, 1 by a slip
function hit(terms, w) {
  const alts = SYN.get(w) || [w];
  if (terms.some((x) => x === w || (w.length >= 4 && x.startsWith(w)))) return 2;
  if (alts.some((a) => a !== w && terms.includes(a))) return 1.5;
  if (w.length >= 5 && terms.some((x) => x.length >= 4 && oneEdit(x, w))) return 1;
  return 0;
}

// "20:30", "8.15pm", "9pm", "21h" -> minutes, or null
function timeIn(query) {
  const q = String(query).toLowerCase();
  let m = q.match(/\b(\d{1,2})[:.h](\d{2})\s*(am|pm)?\b/);
  let h, min = 0, ap;
  if (m) { h = +m[1]; min = +m[2]; ap = m[3]; } else if ((m = q.match(/\b(\d{1,2})\s*(am|pm)\b/))) { h = +m[1]; ap = m[2]; } else if ((m = q.match(/\b(\d{1,2})h\b/))) { h = +m[1]; } else return null;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  const t = h * 60 + min;
  return h <= 24 && min < 60 && t >= DAY.start && t <= DAY.end ? t : null;
}

export function createSearch(ctx) {
  const { api } = ctx;
  const model = api.model;

  function items() {
    const out = [];
    api.places.all().forEach((p) => out.push({ type: p.room ? 'room-place' : 'place', id: p.id, villa: p.villa || null, layer: p.layer || null, status: p.status,
      terms: [...(p.words || []), ...norm(p.kicker).split(' ')],
      title: p.kicker, sub: strip(p.title), base: 4 }));
    api.notes.all().forEach((n) => out.push({ type: 'note', id: n.id, villa: n.villa || null, status: n.status,
      terms: [...(n.words || []), ...norm(n.title).split(' ')], title: n.title, sub: n.sub, base: 4 }));
    api.cards.all((c) => !/^(villa|bedroom|living):/.test(c.id) && c.id !== 'estate').forEach((c) => out.push({ type: 'card', id: c.id, status: c.status,
      terms: [...(c.words || []), ...norm(c.kicker).split(' '), ...norm(strip(c.title)).split(' ')], title: c.kicker, sub: strip(c.title), base: 3 }));
    api.layers.all().forEach((l) => out.push({ type: 'layer', id: l.id, layer: l.id, status: l.status,
      terms: [...(l.words || []), ...norm(l.label).split(' '), 'wedding', 'decor', 'decorations', 'ideas', 'lights', 'lanterns', 'tables'],
      title: l.label, sub: l.notice, base: 3 }));
    (model.landmarks || []).forEach((l) => {
      const name = l.name.replace(/\s*\(.*?\)/g, '');
      const short = { 'la-verna': 'La Verna', 'monte-altuccia': 'Alpe di Catenaia', 'lago-di-montedoglio': 'Lake Montedoglio' }[l.id] || name.split(',')[0];
      const km = Math.hypot(l.local[0], l.local[1]) / 1000;
      out.push({ type: 'landmark', id: l.id, terms: [...norm(l.name).split(' '), ...norm(short).split(' ')], title: short,
        sub: `${km >= 9.5 ? Math.round(km) : km.toFixed(1)} km away, across the valley`, base: 3 });
    });
    api.moments.all().forEach((m) => out.push({ type: 'moment', id: m.id, terms: [m.day, norm(m.kicker).split(' ')[0], ...m.words, ...norm(strip(m.title)).split(' ')],
      title: `${m.kicker.split(' ')[0]}: ${strip(m.title)}`, sub: m.caption, food: m.sub, base: 2.5 }));
    out.push({ type: 'moment', id: '', terms: 'weekend plan schedule itinerary programme program'.split(' '), title: 'The weekend', sub: 'Friday to Monday, the rough plan', base: 3 });
    return out;
  }

  function search(query) {
    const raw = String(query || '');
    const words = norm(raw).split(/\s+/).filter((w) => w && !STOP.has(w));
    const out = [];
    const at = timeIn(raw);
    if (at != null) {
      const mark = ctx.time.marks.find((k) => Math.abs(k.at - at) <= 2);
      out.push({ type: 'time', id: `t${at}`, at, title: `${toHHMM(at)} on the day`, sub: mark ? mark.label : 'Set the clock', score: 20 });
      return out;
    }
    if (!words.length) return [];
    const villaWord = words.map(villaOf).find(Boolean) || null;
    // a number on its own means a room number: "Room 7", "santarsa 7", "room7"
    const topic = [...new Set(words.filter((w) => !villaOf(w)).map((w) => (/^\d+$/.test(w) ? 'room' : w)))];
    if (villaWord) {
      const v = model.villas.find((x) => x.id === villaWord);
      out.push({ type: 'villa', id: v.id, title: v.name, sub: `${v.bedrooms} bedrooms, sleeps ${v.sleeps}`, score: topic.length ? 3 : 9 });
    }
    // times of day
    const seen = new Set();
    topic.forEach((w) => {
      const id = TIME_WORDS[w] || (w.length >= 5 && Object.keys(TIME_WORDS).find((k) => k.length >= 5 && oneEdit(k, w)) && TIME_WORDS[Object.keys(TIME_WORDS).find((k) => k.length >= 5 && oneEdit(k, w))]);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const mark = ctx.time.marks.find((k) => k.id === id);
      const preset = PRESETS[id];
      const minutes = mark ? mark.at : preset ? preset.at : null;
      if (minutes == null) return;
      const label = mark ? mark.label : preset.label;
      out.push({ type: 'time', id: `t${minutes}`, at: minutes, title: `${label} at ${toHHMM(minutes)}`, sub: 'Set the clock', score: 5.5 });
    });
    items().forEach((it) => {
      if (villaWord && it.villa && it.villa !== villaWord) return;
      let score = 0, hits = 0;
      if (topic.length) {
        topic.forEach((w) => { const h = hit(it.terms, w); if (h) { hits++; score += h; } });
      } else if (it.villa === villaWord) { hits = 1; score = 1; }
      if (!hits) return;
      // anything from a layer is an idea, whatever its own status says about its spot: tagged, and below the
      // base model's honest answers (the ceremony note before the spots couples have used)
      const fromLayer = !!it.layer && it.type !== 'layer';
      const idea = it.status === 'idea' || fromLayer;
      const tag = idea ? STATUS.idea : '';
      const sub = it.food && topic.some((w) => /^(lunch|food|meal)/.test(w)) ? it.food : it.sub;
      out.push({ type: it.type === 'room-place' ? 'place' : it.type, id: it.id, title: it.title, sub, tag, layer: it.layer, at: it.at,
        score: it.base + score + (it.villa && it.villa === villaWord ? 1 : 0) - (fromLayer ? 2 : idea ? 0.5 : 0) });
    });
    const ranked = out.sort((a, b) => b.score - a.score);
    return ranked.filter((r, i) => ranked.findIndex((x) => x.type === r.type && x.id === r.id) === i).slice(0, 8);
  }

  // the kinds v1's search box does not know
  async function choose(r) {
    const nav = api.use('nav');
    if (r.type === 'time') { await api.time.set(r.at, { animate: true }); return; }
    if (r.type === 'moment') { ctx.weekend.open(r.id || null); return; }
    if (r.type === 'layer') { ctx.layersUI.set(r.id, true); return; }
    if (r.type === 'landmark') { ctx.lookToward?.(r.id); return; }
    if (r.type === 'card') {
      const c = api.cards.get(r.id);
      if (c) ctx.ui.showCard({ kind: 'card', ...c, actions: [{ id: 'close', label: 'Got it' }] });
      return;
    }
    if (r.layer && !api.layers.isOn(r.layer)) await ctx.layersUI.set(r.layer, true);
    if (r.type === 'place') nav.showPlace(r.id);
  }

  return { search, choose, timeIn };
}

export { toMinutes };
