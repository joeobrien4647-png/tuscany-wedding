// The time bar: the real sun of Saturday 29 May 2027 from 05:00 to midnight, on a slider painted with the sky's own
// colours. It writes api.time (throttled while dragging) and reads api.light for the phase. Its marks are facts,
// found from sky.sunAt and model.sun: sunrise, the sun over the hill at Santarsa (from the terrain), solar noon,
// golden hour, behind the ridge, sunset and the end of blue hour. Day, Sunset and Night stay as quick buttons.
import { DAY, PRESETS, toHHMM, toMinutes } from '../api.js';
import { clamp } from '../util.js';
import { crossing, peak } from './sun.js';

const PHASE_WORDS = { day: 'Daylight', golden: 'Golden hour', blue: 'Blue hour', night: 'Night' };
const SNAP = 4;          // minutes: a drag this close to a mark lands on it
const THROTTLE_MS = 80;  // at most this often while dragging (each change redraws the sun's shadows)
const R_EARTH = 6371000;

// the hills' skyline from a spot, in degrees above level, towards a compass bearing (bare terrain, no trees)
function skyline(heightAt, x, z, eye, bearing) {
  const b = (bearing * Math.PI) / 180, dx = Math.sin(b), dz = -Math.cos(b);
  const h0 = heightAt(x, z) + eye;
  let best = -90;
  for (let d = 30; d < 40000; d = d * 1.035 + 15) {
    const h = heightAt(x + dx * d, z + dz * d) - h0 - ((d * d) / (2 * R_EARTH)) * 0.87;
    best = Math.max(best, (Math.atan2(h, d) * 180) / Math.PI);
  }
  return best;
}
// the sun's upper limb, with Bennett's refraction, clears a skyline `h` degrees up
const limbClears = (el, h) => el + 0.27 + 1 / 60 / Math.tan(((h + 7.31 / (h + 4.4)) * Math.PI) / 180) > h;

export function findMarks(api) {
  const sky = api.use('sky'), sun = api.model.sun || {};
  const el = (m) => sky.sunAt(m).el;
  const at = (s) => (s ? toMinutes(s) : null);
  const marks = [];
  const add = (id, minutes, label, { major = false } = {}) => {
    if (minutes == null || Number.isNaN(minutes)) return;
    marks.push({ id, at: Math.floor(minutes + 1e-6), label, major });
  };
  add('sunrise', crossing((m) => el(m) >= -0.833, DAY.start, 9 * 60), 'Sunrise', { major: true });
  const villa = api.model.villas?.find((v) => v.id === 'santarsa');
  if (villa?.view && api.has('ground')) {
    const { heightAt } = api.use('ground');
    const [x, z] = villa.view;
    const sees = (m) => { const p = sky.sunAt(m); return p.el > -2 && limbClears(p.el, skyline(heightAt, x, z, 1.6, p.az)); };
    add('over-the-hill', crossing(sees, DAY.start, 10 * 60, 5), 'Sun over the hill at Santarsa');
  }
  add('noon', peak(el, 11 * 60, 15 * 60), 'Solar noon', { major: true });
  add('golden', at(sun.goldenHour?.start), 'Golden hour');
  add('ridge', at(sun.terrainSunset?.santarsa), 'Behind the ridge');
  add('sunset', at(sun.sunset?.time) ?? crossing((m) => el(m) < -0.833, 18 * 60, 22 * 60), 'Sunset', { major: true });
  add('blue', crossing((m) => el(m) < -6, 20 * 60, 23 * 60), 'Blue hour ends');
  return marks.sort((a, b) => a.at - b.at);
}

// the slider's track: the horizon's colour through the day, from the sun's height
const SKY = [[-18, '#141a33'], [-9, '#26305a'], [-4, '#5d5582'], [-1, '#c77d6e'], [1.5, '#ef9f63'], [5, '#f4c07e'], [10, '#d9d6be'], [20, '#a9c6dc'], [70, '#86b2dd']];
function skyColour(e) {
  const i = SKY.findIndex(([a]) => a >= e);
  if (i <= 0) return SKY[i === 0 ? 0 : SKY.length - 1][1];
  const [a0, c0] = SKY[i - 1], [a1, c1] = SKY[i];
  const k = (e - a0) / (a1 - a0);
  const p = (c) => [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16));
  const [r0, g0, b0] = p(c0), [r1, g1, b1] = p(c1);
  return `rgb(${Math.round(r0 + (r1 - r0) * k)},${Math.round(g0 + (g1 - g0) * k)},${Math.round(b0 + (b1 - b0) * k)})`;
}

// the sky's colours from `from` to `to` minutes, for the date the sky is on (the weekend's gold line too)
export function skyGradient(sky, from, to, step = 15) {
  const stops = [];
  for (let m = from; m <= to; m += step) stops.push(`${skyColour(sky.sunAt(m).el)} ${(((m - from) / (to - from)) * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function installTimebar(ctx) {
  const { api, $ } = ctx;
  const box = $('vx-time'), range = $('vx-time-range'), clock = $('vx-clock'), phase = $('vx-phase'), marksEl = $('vx-marks');
  const sky = api.use('sky');
  const span = DAY.end - DAY.start;
  const pct = (m) => `${(((m - DAY.start) / span) * 100).toFixed(3)}%`;
  const marks = findMarks(api);

  // the track, painted every 15 minutes
  box.style.setProperty('--vx-sky', skyGradient(sky, DAY.start, DAY.end));
  marksEl.innerHTML = marks.map((k) => `<span class="vx-mark${k.major ? ' is-major' : ''}" data-mark="${k.id}" style="left:${pct(k.at)}" title="${k.label} ${toHHMM(k.at)}"><span class="vx-mark-label">${k.label.replace(' at Santarsa', '')}</span></span>`).join('');

  range.min = String(DAY.start);
  range.max = String(DAY.end);
  range.step = '1';

  const nearMark = (m, within = 2) => marks.find((k) => Math.abs(k.at - m) <= within);
  function show(m) {
    const minutes = Math.round(m);
    const mk = nearMark(minutes);
    const word = PHASE_WORDS[api.light.get().phase] || '';
    clock.textContent = minutes >= DAY.end ? '24:00' : toHHMM(minutes);
    phase.textContent = mk ? mk.label : word;
    range.setAttribute('aria-valuetext', `${clock.textContent}, ${mk ? mk.label.toLowerCase() : word.toLowerCase()}`);
    box.dataset.phase = api.light.get().phase;
    marksEl.querySelectorAll('.vx-mark').forEach((el) => el.classList.toggle('is-here', !!mk && el.dataset.mark === mk.id));
    if (!dragging) range.value = String(minutes);
    box.style.setProperty('--vx-at', pct(m));
  }

  // dragging: snap to a mark when close, write the clock at most every THROTTLE_MS
  let dragging = false, pending = null, timer = 0, lastWrite = 0;
  function write(m) {
    pending = m;
    const now = performance.now();
    const go = () => { timer = 0; lastWrite = performance.now(); if (pending != null) { api.time.set(pending); pending = null; } };
    if (now - lastWrite >= THROTTLE_MS) go();
    else if (!timer) timer = setTimeout(go, THROTTLE_MS - (now - lastWrite));
  }
  const snapped = (v) => { const mk = nearMark(v, SNAP); return mk ? mk.at : v; };
  range.addEventListener('pointerdown', () => { dragging = true; });
  ['pointerup', 'pointercancel', 'blur'].forEach((ev) => range.addEventListener(ev, () => { dragging = false; }));
  range.addEventListener('input', () => {
    const v = snapped(Number(range.value));
    ctx.onTimeInput?.(v);
    write(v);
    show(v);
  });
  range.addEventListener('change', () => {
    dragging = false;
    clearTimeout(timer);
    timer = 0;
    api.time.set(snapped(Number(range.value)));
  });
  // arrows step 5 minutes, Page keys an hour; the native slider's 1-minute steps are too fine for a key
  range.addEventListener('keydown', (e) => {
    const steps = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 60, PageDown: -60 };
    if (!(e.key in steps)) return;
    e.preventDefault();
    const v = clamp(Math.round((api.time.get() + steps[e.key]) / 5) * 5, DAY.start, DAY.end);
    api.time.set(v);
  });

  api.time.on(show);
  api.light.on(() => show(api.time.get()));
  show(api.time.get());

  // which quick button matches the clock
  const presetAt = (m) => Object.keys(PRESETS).find((k) => Math.abs(PRESETS[k].at - m) < 1) || null;
  return { marks, presetAt, show };
}
