// The weekend mode (research/villas/weekend-mode-spec.md, section 6): the explorer as a short film you can steer.
// Four day tabs, the day as a gold line with a diamond for each moment, a play button, a card per moment, and the
// whole weekend in 60 seconds. The words, options, props and camera keyframes are content's (the weekendStage
// service); this file flies the camera, sets the date and the clock, and owns the cards. Loaded on the first tap of
// a weekend chip (experience/weekend.js). The clock never shows a number it cannot back: the only minute on screen
// is the sun's own sunset, on the clock's second line; every other time is the plan's words and the light's.
import { WEEKEND, PLAN, STATUS, IDEA_NOTICE, toHHMM } from '../api.js';
import { clamp, reducedMotion } from '../util.js';
import { esc, strip } from './dom.js';
import { monotone } from './tour.js';
import { skyGradient } from './timebar.js';
import { CSS, ICON } from './weekend-style.js';

const PHASE = { day: 'Daylight', golden: 'Golden hour', blue: 'Blue hour', night: 'Night' };
const SNAP_PX = 22;        // the handle snaps to a moment this close either side (a 44 px target)
const LABEL_GAP = 24;      // labels on the gold line never sit closer than this
const TIME_STEP_MS = 150;  // while playing, the clock moves at most this often (each move redraws the sun's shadows)
const TITLE_S = 2.4;       // the day title's time on screen
// the 60-second reel: seconds for each day's opener and each moment (spec section 6, "The reel")
const REEL = { open: { fri: 4, sat: 2, sun: 2, mon: 0 }, 'fri-arrive': 4, 'fri-settle': 2, 'fri-pizza': 6, 'sat-ceremony': 5, 'sat-table': 8,
  'sat-dancing': 7, 'sun-morning': 3, 'sun-pools': 7, 'mon-breakfast': 3, 'mon-leave': 7 };
const FREE = { min: 0.5, max: 2600, maxPolar: 2.6 };   // the orbit's limits after a flight: level looks are fine
const MODE_KEYS = new Set(['ArrowLeft', 'ArrowRight', ' ', 'Spacebar', 'Escape', 'Home', 'End']);



export function createWeekendMode(ctx) {
  const { api, ui, $ } = ctx;
  const THREE = api.THREE;
  const rig = api.use('rig'), sky = api.use('sky'), ground = api.use('ground'), stage = api.use('weekendStage');
  const root = api.root;
  if (!document.getElementById('vx-wk-style')) {
    const st = document.createElement('style');
    st.id = 'vx-wk-style';
    st.textContent = CSS;
    document.head.append(st);
  }
  const box = $('vx-weekend');
  box.classList.add('vx-wk');
  box.innerHTML = `
    <div class="vx-wk-bar"><div class="vx-wk-row"><p class="vx-wk-name">The weekend</p>
      <button type="button" class="vx-wk-ic vx-wk-cam" aria-label="Photo mode" title="Photo mode">${ICON.camera}</button>
      <button type="button" class="vx-wk-ic vx-wk-snd" aria-pressed="false" aria-label="Sound" title="Sound">${ICON.sound}</button>
      <button type="button" class="vx-wk-ic vx-wk-x" aria-label="Back to the explorer" title="Back to the explorer">${ICON.close}</button></div>
      <p class="vx-wk-honest"></p><p class="vx-wk-idea" role="status" hidden>${esc(IDEA_NOTICE)}</p></div>
    <div class="vx-wk-stills" hidden></div>
    <div class="vx-wk-day" aria-hidden="true"><p></p><h2></h2><small></small></div>
    <p class="vx-wk-here"></p>
    <div class="vx-wk-fade"></div>
    <div class="vx-wk-bottom">
      <div class="vx-wk-pop" role="dialog" aria-label="More" hidden></div>
      <article class="vx-wk-card" aria-live="polite" tabindex="-1">
        <p class="vx-wk-when"><i class="vx-wk-mark"></i><span></span><button type="button" class="vx-wk-more" data-pop>More</button></p>
        <h3 class="vx-wk-title"></h3><p class="vx-wk-cap"></p><p class="vx-wk-tags"></p>
        <div class="vx-wk-opts" role="group"></div>
      </article>
      <div class="vx-wk-dock">
        <div class="vx-wk-days" role="group" aria-label="Day"></div>
        <div class="vx-wk-scrub">
          <button type="button" class="vx-wk-ic vx-wk-play" aria-pressed="false" aria-label="Play the day" title="Play the day">${ICON.play}</button>
          <div class="vx-wk-track"><output class="vx-wk-clock"><span class="vx-wk-c1"></span><span class="vx-wk-c2"></span></output>
            <div class="vx-wk-line" aria-hidden="true"></div>
            <input type="range" class="vx-wk-range" min="0" max="1" step="1" aria-label="The day, moment by moment"></div>
          <button type="button" class="vx-wk-ic vx-wk-next" aria-label="Next" title="Next">${ICON.next}</button>
        </div>
      </div>
    </div>
    <div class="vx-wk-end" role="dialog" aria-label="The end" hidden></div>`;
  const q = (s) => box.querySelector(s);
  const el = {
    bar: q('.vx-wk-bar'), honest: q('.vx-wk-honest'), idea: q('.vx-wk-idea'), snd: q('.vx-wk-snd'), day: q('.vx-wk-day'), fade: q('.vx-wk-fade'), here: q('.vx-wk-here'),
    stills: q('.vx-wk-stills'), pop: q('.vx-wk-pop'), card: q('.vx-wk-card'), when: q('.vx-wk-when span'), mark: q('.vx-wk-mark'), title: q('.vx-wk-title'), more: q('.vx-wk-more'),
    dock: q('.vx-wk-dock'),
    cap: q('.vx-wk-cap'), tags: q('.vx-wk-tags'), opts: q('.vx-wk-opts'), days: q('.vx-wk-days'), play: q('.vx-wk-play'), next: q('.vx-wk-next'),
    line: q('.vx-wk-line'), range: q('.vx-wk-range'), c1: q('.vx-wk-c1'), c2: q('.vx-wk-c2'), end: q('.vx-wk-end'),
  };

  const S = { open: false, day: null, moment: null, playing: null, opts: { oven: null, dinner: 'both' }, saved: null, pushed: false, line: '', W: null, frameHook: null, titleTimer: 0 };
  const dayOf = (id) => WEEKEND.find((d) => d.id === id);
  const momentsOf = (day) => api.moments.all((m) => m.day === day).sort((a, b) => a.order - b.order);
  const allMoments = () => WEEKEND.flatMap((d) => momentsOf(d.id));
  const detail = (id) => (id ? stage.detail(id) : null);
  // the light's word at a minute of the day on screen, by realism's own thresholds (sky.js, phaseOf), so a dragged
  // handle names the light where it is, not where the clock was
  const phaseAt = (m) => { const el = sky.sunAt(m).el; return el >= 6 ? 'day' : el >= -0.833 ? 'golden' : el >= -6 ? 'blue' : 'night'; };
  const phaseWord = (m) => PHASE[m == null ? api.light.get().phase : phaseAt(m)] || '';

  // ---------- shots: content's, resolved for this screen ----------
  const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
  function aimFov(hfov) {
    const a = Math.max(0.3, rig.clearAspect || 1);
    return clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / a)), 38, 64);
  }
  // { pos, target, fov } to fly through; `paused` keeps an eye shot's look point close, so dragging looks round
  function resolveShot(shot, { paused = false } = {}) {
    if (!shot) return null;
    if (shot.eye) {
      const pos = v3(shot.pos), target = v3(shot.target);
      return { pos, target: paused ? pos.clone().lerp(target, 0.04) : target, fov: aimFov(shot.hfov || 70), fixed: true, eye: true, limits: shot.limits };
    }
    const r = rig.resolve(shot);
    return { pos: r.pos, target: r.target, fov: r.fov, fixed: true, limits: shot.limits };
  }
  // a hold with no second shot drifts three metres sideways
  function drift(s) {
    const side = new THREE.Vector3().subVectors(s.target, s.pos).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(s.eye ? 0.6 : 3);
    return { ...s, pos: s.pos.clone().add(side), target: s.target.clone().add(side) };
  }
  function eyeFor(shot) {
    if (shot.eye) return { pos: v3(shot.pos), target: v3(shot.target), hfov: shot.hfov };
    if (shot.frame) return { frame: shot.frame, hfov: 62 };
    const a = 1.6;
    return { pos: v3(shot.pos), target: v3(shot.target), hfov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad((shot.fov || 45) / 2)) * a)) };
  }

  // ---------- the day: tabs, the gold line, the clock ----------
  function sunsetMinute() {
    let a = 18 * 60, b = 22 * 60;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (sky.sunAt(m).el > -0.833) a = m; else b = m; }
    return Math.round((a + b) / 2);
  }
  function renderTabs() {
    el.days.innerHTML = WEEKEND.map((d) => `<button type="button" class="vx-wk-tab" data-day="${d.id}" aria-pressed="${d.id === S.day}" aria-label="${esc(S.W.days[d.id].name)}"><b>${esc(S.W.days[d.id].tab)}</b><span>${esc(S.W.days[d.id].date)}</span></button>`).join('');
  }
  let sunset = 0;
  function setDay(id) {
    const d = dayOf(id) || WEEKEND[0];
    S.day = d.id;
    api.date.set(d.date);
    sunset = sunsetMinute();
    el.days.querySelectorAll('[data-day]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.day === d.id)));
    el.range.min = String(d.from);
    el.range.max = String(d.to);
    paintLine();
  }
  const pctOf = (m) => { const d = dayOf(S.day); return ((m - d.from) / (d.to - d.from)) * 100; };
  function paintLine() {
    const d = dayOf(S.day);
    const parts = [`<span class="vx-wk-rail" style="background:${skyGradient(sky, d.from, d.to)}"></span>`];
    momentsOf(S.day).forEach((m) => {
      const [a, b] = detail(m.id).light.at;
      parts.push(`<span class="vx-wk-band" data-moment="${m.id}" style="left:${pctOf(a).toFixed(2)}%;width:${(pctOf(b) - pctOf(a)).toFixed(2)}%"></span>`);
    });
    if (sunset > d.from && sunset < d.to) parts.push(`<span class="vx-wk-sun" style="left:${pctOf(sunset).toFixed(2)}%"></span><span class="vx-wk-sunlab" data-label="sun" style="left:${pctOf(sunset).toFixed(2)}%" title="Sunset">${ICON.sun}</span>`);
    momentsOf(S.day).forEach((m) => {
      const [a, b] = detail(m.id).light.at;
      const c = pctOf((a + b) / 2).toFixed(2);
      parts.push(`<span class="vx-wk-dia is-${m.plan.when}" data-dia="${m.id}" style="left:${c}%"></span><span class="vx-wk-lab" data-label="${m.id}" style="left:${c}%">${esc(detail(m.id).short)}</span>`);
    });
    el.line.innerHTML = parts.join('');
    requestAnimationFrame(spaceLabels);
    showClock();
  }
  // where two marks would sit closer than LABEL_GAP, only the moment's diamond keeps its label
  function spaceLabels() {
    const labels = [...el.line.querySelectorAll('[data-label]')].sort((a, b) => (a.dataset.label === 'sun') - (b.dataset.label === 'sun'));
    const kept = [];
    labels.forEach((l) => {
      l.style.visibility = '';
      const r = l.getBoundingClientRect(), c = (r.left + r.right) / 2;
      const clash = kept.some((k) => Math.abs(k.c - c) < LABEL_GAP || (r.left < k.r.right + 8 && r.right > k.r.left - 8));
      if (clash) l.style.visibility = 'hidden'; else kept.push({ c, r });
    });
  }
  const momentAt = (minutes) => momentsOf(S.day).find((m) => { const [a, b] = detail(m.id).light.at; return minutes >= a && minutes <= b; }) || null;
  // the clock's words: while playing, the card's moment; otherwise the moment whose band holds the minute, or the
  // card's when the minute sits between bands
  function clockWords(minutes) {
    const here = api.moments.get(S.moment);
    const mine = !dragging && here?.day === S.day ? here : null;
    const m = (S.playing && mine) || momentAt(minutes) || mine, d = detail(m?.id), phase = phaseWord(minutes);
    const line1 = !m ? phase : d.light.quiet ? m.when : `${m.when}, ${phase.toLowerCase()}`;
    const line2 = m && d.light.marks?.includes('sunset') ? `The sun sets at ${toHHMM(sunset)}` : '';
    const aria = [strip(S.W.days[S.day].name).split(' ')[0], m ? m.when.toLowerCase() : '', d?.light.quiet ? '' : phase.toLowerCase()].filter(Boolean).join(', ');
    return { m, line1, line2, aria };
  }
  let dragging = false;
  function showClock() {
    if (!S.open || !S.day) return;
    const minutes = api.time.get();
    const w = clockWords(minutes);
    el.c1.textContent = w.line1;
    el.c2.textContent = w.line2;
    el.c2.hidden = !w.line2;
    el.range.setAttribute('aria-valuetext', w.aria);
    if (!dragging) el.range.value = String(clamp(Math.round(minutes), Number(el.range.min), Number(el.range.max)));
    el.line.querySelectorAll('.vx-wk-band').forEach((b) => b.classList.toggle('is-here', !!w.m && b.dataset.moment === w.m.id));
    syncNight();
  }

  // ---------- the card ----------
  function tagsFor(m) {
    const out = [];
    const when = PLAN.when[m.plan.when], where = PLAN.where[m.plan.where];
    if (when) out.push([when, m.plan.when]);
    if (where) out.push([where, m.plan.where]);
    if (out.length < 2 && S.st.looks().length) out.push([STATUS.idea, 'idea']);
    return out.slice(0, 2);
  }
  // the options in a word or two, on the More button when the strip itself does not fit
  const optionsShort = (o) => (o.group === 'oven' ? 'Which oven' : `${o.items.length - 1} ways`);
  const folded = (d) => !!d?.options && getComputedStyle(el.opts).display === 'none';
  function renderTags() {
    const m = api.moments.get(S.moment);
    const tags = m ? tagsFor(m) : [];
    el.tags.innerHTML = tags.map(([t, k]) => `<span class="vx-wk-tag is-${k}">${esc(t)}</span>`).join('');
    el.more.hidden = !m;
    el.idea.hidden = !stage.ideas().length;
    measureBar();
    fitCard();
  }
  // the card keeps the middle third of the screen clear: when it would grow past its room it lets go of the options'
  // header, then the caption (in More), then the strip with its note (More then names the options, "2 ways", and
  // opens them), then the model's tag. The strip never shows without its note. Playing, the caption (where the
  // evening's lines appear) stays longer than the strip
  const FIT = [['no-head', 'no-cap', 'is-tight', 'no-model'], ['no-head', 'is-tight', 'no-cap', 'no-model']];
  function fitCard() {
    const d = detail(S.moment);
    el.card.classList.remove(...FIT[0]);
    const fold = () => { const f = folded(d); el.more.textContent = f ? optionsShort(d.options) : 'More'; el.more.classList.toggle('vx-wk-pill', f); el.more.setAttribute('aria-label', f ? `${d.options.header}: ${el.more.textContent}, and more` : 'More'); };
    fold();
    for (const c of S.open ? FIT[S.playing ? 1 : 0] : []) {
      if (el.card.scrollHeight <= el.card.clientHeight + 1) break;
      el.card.classList.add(c);
      fold();
    }
  }
  const segHTML = (o) => {
    const pick = o.group === 'oven' ? S.opts.oven : S.opts.dinner;
    return `<div class="vx-wk-seg">${o.items.map((it) => `<button type="button" data-opt="${esc(it.id)}" data-group="${o.group}" aria-pressed="${pick === it.id}">${esc(it.label)}</button>`).join('')}</div>`;
  };
  const dayLine = () => (S.day === 'fri' ? S.W.intro.caption : S.W.days[S.day].line);
  function renderCard() {
    const m = api.moments.get(S.moment);
    const d = detail(S.moment);
    const W = S.W;
    if (m) {
      el.when.textContent = m.when;
      el.mark.className = `vx-wk-mark is-${m.plan.when}`;
      el.title.innerHTML = m.title;
      el.cap.textContent = S.line || m.caption;
    } else {
      el.when.textContent = W.days[S.day].name;
      el.mark.className = 'vx-wk-mark';
      el.title.innerHTML = W.days[S.day].title;
      el.cap.textContent = dayLine();
    }
    const o = d?.options;
    el.opts.hidden = !o;
    el.opts.innerHTML = o ? `<p class="vx-wk-opts-h">${esc(o.header)}</p>${segHTML(o)}<p class="vx-wk-opts-n">${esc(o.note)}</p>` : '';
    if (o) el.opts.setAttribute('aria-label', o.header);
    el.card.dataset.moment = S.moment || '';
    el.card.setAttribute('aria-label', m ? `${S.W.days[S.day].name}: ${strip(m.title)}` : strip(W.days[S.day].title));
    closePop();
    renderTags();
    showClock();
  }
  function syncNight() {
    const night = !!S.W?.days[S.day ?? 'fri']?.night || ['blue', 'night'].includes(api.light.get().phase);
    el.card.classList.toggle('is-night', night);
  }
  function setLine(text) { if (S.line === text) return; S.line = text; const m = api.moments.get(S.moment); el.cap.textContent = text || m?.caption || dayLine(); }
  const setHere = (k) => { el.here.textContent = k?.here || ''; };

  // More: the moment in full, in place of the card, with the options when the card has folded them away (the words
  // say what is still to be decided, so nothing is said twice)
  function openPop() {
    const m = api.moments.get(S.moment), d = detail(S.moment);
    if (!m) return;
    el.pop.innerHTML = `<button type="button" class="vx-wk-ic vx-wk-x2" aria-label="Close">${ICON.close}</button><h3 class="vx-wk-title">${m.title}</h3><p><strong>${esc(m.caption)}</strong></p><p>${esc(d.text)}</p>${folded(d) ? segHTML(d.options) : ''}`;
    el.pop.hidden = false;
    el.pop.querySelector('button')?.focus({ preventScroll: true });
  }
  function closePop() { el.pop.hidden = true; el.pop.innerHTML = ''; }

  // the bar's height, for the day title and the map credit under it; the dock's, for the card's room above it
  function measureBar() {
    requestAnimationFrame(() => {
      root.style.setProperty('--wk-bar', `${Math.round(el.bar.getBoundingClientRect().height) + 2}px`);
      root.style.setProperty('--wk-dock', `${Math.round(el.dock.getBoundingClientRect().height)}px`);
      fitCard();
    });
  }

  function showDayTitle(id, { intro = false } = {}) {
    const W = S.W, d = W.days[id];
    el.day.querySelector('p').textContent = intro ? W.intro.when : d.it;
    el.day.querySelector('h2').innerHTML = intro ? W.intro.title : d.title;
    el.day.querySelector('small').textContent = intro ? '' : d.name;
    el.day.classList.add('is-on');
    clearTimeout(S.titleTimer);
    S.titleTimer = setTimeout(() => el.day.classList.remove('is-on'), TITLE_S * 1000);
  }

  // ---------- sound: the moment's cues, only if the speaker is already on ----------
  const soundOn = () => $('vx-sound')?.getAttribute('aria-pressed') === 'true';
  async function cues(list = []) {
    el.snd.setAttribute('aria-pressed', String(soundOn()));
    if (!soundOn()) return;
    try { (await ctx.loadSound()).cues?.(list); } catch { /* no sound */ }
  }

  // ---------- going to a moment, paused ----------
  async function goTo(id, { keepTime = false, fly = true } = {}) {
    stop();
    const m = api.moments.get(id);
    if (!m) return;
    if (m.day !== S.day) setDay(m.day);
    S.moment = id;
    S.line = '';
    const k = detail(id).still(S.opts);
    stage.show(k.props, { fade: reducedMotion ? 0 : 0.5 });
    renderCard();
    setHere(k);
    cues(detail(id).sound);
    if (!keepTime) api.time.set(k.at[0], { animate: fly && !reducedMotion, duration: 1.6 });
    const shot = resolveShot(k.shot, { paused: true });
    if (!shot) return;
    if (fly && !reducedMotion) rig.flyTo(shot); else rig.jumpTo(shot);
  }
  async function goToOpener(id) {
    stop();
    setDay(id);
    S.moment = null;
    S.line = '';
    const k = stage.opener(id);
    await stage.show(k.props, { fade: 0 });
    renderCard();
    setHere(k);
    cues([]);
    api.time.set(k.at[0]);
    const shot = resolveShot(k.end || k.shot);
    reducedMotion ? rig.jumpTo(shot) : rig.flyTo(shot);
    showDayTitle(id, { intro: id === 'fri' });
  }
  function step(dir) {
    const list = allMoments();
    const i = list.findIndex((m) => m.id === S.moment);
    if (dir > 0 && i === list.length - 1) { showEnd(); return; }
    const next = list[clamp(i + dir, 0, list.length - 1)];
    if (next.day !== S.day) showDayTitle(next.day);
    goTo(next.id);
  }
  function stepDay(dir) {
    const i = WEEKEND.findIndex((d) => d.id === S.day);
    const d = WEEKEND[clamp(i + dir, 0, WEEKEND.length - 1)];
    showDayTitle(d.id);
    goTo(momentsOf(d.id)[0].id);
  }

  // ---------- playing: one continuous flight through a day's keyframes ----------
  // items: [{ moment, kf }]; resolves true at the end, false when stopped
  function runFlight(items, token, { scale = 1, scales = null } = {}) {
    return new Promise((resolve) => {
      const cam = [], clock = [], events = [];
      let t = 0;
      items.forEach((it, i) => {
        const k = it.kf, sc = scales?.[i] ?? scale;
        const s = resolveShot(k.shot);
        let dur = k.dur * sc;
        const hold = k.hold * sc;
        if (i === 0 && dur < 0.05) dur = 0;
        else if (i === 0) { cam.push({ t: 0, pos: rig.camera.position.clone(), target: rig.controls.target.clone(), fov: rig.lens }); clock.push({ t: 0, m: api.time.get() }); }
        else dur = Math.max(dur, 0.3);
        events.push({ t, it, done: false, pace: clamp(1 / (sc || 1), 1, 3) });
        t += dur;
        cam.push({ t, ...s });
        clock.push({ t, m: k.at[0] });
        if (hold > 0) {
          const later = k.at.slice(1);
          later.forEach((mm, j) => clock.push({ t: t + (hold * (j + 1)) / later.length, m: mm }));
          t += hold;
          cam.push({ t, ...(k.end ? resolveShot(k.end) : drift(s)) });
        }
      });
      const end = t;
      if (cam.length < 2) cam.push({ ...cam[0], t: cam[0].t + 0.5 });
      // keys must move forward in time
      const camK = cam.filter((c, i) => i === 0 || c.t > cam[i - 1].t + 1e-3);
      const clockK = clock.filter((c, i) => i === 0 || c.t > clock[i - 1].t + 1e-3);
      const times = camK.map((c) => c.t);
      const posC = new THREE.CatmullRomCurve3(camK.map((c) => c.pos), false, 'centripetal');
      const tgtC = new THREE.CatmullRomCurve3(camK.map((c) => c.target), false, 'centripetal');
      const uAt = monotone(times, camK.map((_, i) => i));
      const fovAt = monotone(times, camK.map((c) => c.fov));
      const clockAt = clockK.length > 1 ? monotone(clockK.map((c) => c.t), clockK.map((c) => c.m)) : () => clockK[0].m;
      const n = camK.length;
      let tt = 0, lastClock = -Infinity, finished = false, ending = false;
      const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
      // this flight's own finish: the token carries the newest flight's, so a late call from an older one cannot end it
      const finish = (ok) => { if (finished) return; finished = true; resolve(ok); };
      token.finish = finish;
      const fire = () => events.forEach((e) => { if (!e.done && tt >= e.t - 1e-3) { e.done = true; onKey(e.it, token, e.pace); } });
      fire();
      rig.drive((dt) => {
        if (S.playing !== token || finished) return null;
        tt += Math.min(dt, 0.1);
        fire();
        const u = uAt(tt);
        posC.getPoint(clamp(u / (n - 1), 0, 1), pos);
        tgtC.getPoint(clamp(u / (n - 1), 0, 1), tgt);
        pos.y = Math.max(pos.y, ground.groundAt(pos.x, pos.z) + 1.2);
        const now = performance.now();
        if (now - lastClock > TIME_STEP_MS) {
          lastClock = now;
          const minutes = clockAt(tt);
          api.time.set(minutes);
          const k = token.key;
          if (k?.line && minutes >= (k.lineFrom ?? -1)) setLine(k.line);
        }
        api.loop.wake();
        if (tt >= end && !ending) { ending = true; setTimeout(() => { if (S.playing === token && !finished) { api.time.set(clockAt(end)); finish(true); } }, 0); }
        return { pos, target: tgt, fov: fovAt(tt) };
      });
    });
  }
  function onKey(it, token, pace = 1) {
    token.key = it.kf;
    setHere(it.kf);
    if (it.moment !== S.moment || (it.moment === null && token.first !== false)) {
      token.first = false;
      S.moment = it.moment;
      S.line = '';
      renderCard();
      cues(detail(it.moment)?.sound || []);
    } else if (S.line && !it.kf.line) setLine('');
    stage.show(it.kf.props, { fade: 0.6, pace }).then(() => { if (S.playing === token) renderTags(); });
    renderTags();
  }
  function dayItems(day, from = undefined) {
    const out = [];
    if (from === undefined) out.push({ moment: null, kf: stage.opener(day) });
    const list = momentsOf(day);
    const i = from ? Math.max(0, list.findIndex((m) => m.id === from)) : 0;
    list.slice(i).forEach((m) => detail(m.id).shots(S.opts).forEach((kf) => out.push({ moment: m.id, kf })));
    return out;
  }
  function setPlaying(token) {
    S.playing = token;
    const on = !!token;
    box.classList.toggle('is-playing', on);
    el.play.setAttribute('aria-pressed', String(on));
    el.play.innerHTML = on ? ICON.pause : ICON.play;
    el.play.setAttribute('aria-label', on ? 'Pause' : 'Play the day');
    fitCard();
  }
  // stop anything playing; the camera stays where it is
  function stop() {
    const t = S.playing;
    if (!t) return;
    setPlaying(null);
    t.finish?.(false);
    t.cancel?.();
    if (rig.driving) rig.release({ limits: FREE });
    el.fade.classList.remove('is-on');
    hideStills();
    api.loop.request();
  }
  async function play({ only = false } = {}) {
    if (S.playing) { stop(); return; }
    hideEnd();
    closePop();
    const token = {};
    setPlaying(token);
    const day = S.day;
    const items = S.moment ? dayItems(day, S.moment) : dayItems(day);
    const list = only ? items.filter((it) => it.moment === S.moment) : items;
    if (!S.moment) showDayTitle(day, { intro: day === 'fri' });
    const ok = reducedMotion ? await runStills(list, token, 4) : await runFlight(list, token);
    if (!ok || S.playing !== token) return;
    setPlaying(null);
    if (reducedMotion) { hideStills(); const k = S.moment ? detail(S.moment).still(S.opts) : null; if (k) rig.jumpTo(resolveShot(k.shot, { paused: true })); }
    if (rig.driving) rig.release({ limits: FREE });
    land();
    if (only) return;
    // the end of the day: offer the next
    const i = WEEKEND.findIndex((d) => d.id === day);
    if (i === WEEKEND.length - 1) showEnd();
    else offerNext(WEEKEND[i + 1].id);
  }
  // after a flight, the orbit's look point comes close so a drag looks round, as after any v2 flight
  function land() {
    const k = S.moment ? detail(S.moment).still(S.opts) : null;
    if (k?.shot?.eye) rig.jumpTo({ pos: rig.camera.position.clone(), target: rig.camera.position.clone().lerp(rig.controls.target, 0.04), fov: rig.lens, fixed: true, eye: true, limits: FREE });
  }
  function offerNext(id) {
    const name = S.W.days[id].name.split(' ')[0];
    el.tags.insertAdjacentHTML('beforeend', `<button type="button" class="vx-wk-go" data-day-next="${id}">Play ${esc(name)}</button>`);
  }

  // reduced motion: one still per keyframe's moment, cross-faded in 200 ms, from v2's snippet renderer
  async function runStills(items, token, seconds) {
    const seen = new Set();
    const list = items.filter((it) => { const k = it.moment ?? `open:${it.kf.name}`; if (seen.has(k)) return false; seen.add(k); return true; });
    el.stills.hidden = false;
    for (const it of list) {
      if (S.playing !== token) return false;
      const day = it.moment ? api.moments.get(it.moment).day : S.day;
      if (day !== S.day) setDay(day);
      onKey({ moment: it.moment, kf: it.kf }, token);
      const k = it.moment ? detail(it.moment).still(S.opts) : it.kf;
      await stage.show(k.props, { fade: 0 });
      api.time.set(k.at[0]);
      const w = api.stage.clientWidth || 800, h = api.stage.clientHeight || 600;
      const url = await ctx.snapshot(eyeFor(k.shot), { aspect: w / h, width: Math.min(1280, Math.round(w * Math.min(2, devicePixelRatio || 1))) });
      if (S.playing !== token) return false;
      const img = document.createElement('img');
      img.alt = strip(it.moment ? api.moments.get(it.moment).title : S.W.days[day].title);
      img.src = url;
      el.stills.append(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('is-in')));
      [...el.stills.children].slice(0, -2).forEach((x) => x.remove());
      await new Promise((r) => { token.cancel = r; setTimeout(r, seconds * 1000); });
    }
    return S.playing === token;
  }
  const hideStills = () => { el.stills.hidden = true; el.stills.innerHTML = ''; };

  // ---------- the whole weekend in 60 seconds ----------
  async function reel() {
    await openShell();
    stop();
    hideEnd();
    closePop();
    const token = { reel: true };
    setPlaying(token);
    await S.st.prebuild();
    if (S.playing !== token) return;
    if (reducedMotion) {
      const items = [{ moment: null, kf: stage.opener('fri') }, ...allMoments().map((m) => ({ moment: m.id, kf: detail(m.id).still(S.opts) }))];
      setDay('fri');
      showDayTitle('fri', { intro: true });
      const ok = await runStills(items, token, 5);
      if (ok && S.playing === token) { setPlaying(null); showEnd(); }
      return;
    }
    for (const d of WEEKEND) {
      if (S.playing !== token) return;
      if (d.id !== 'fri') { el.fade.classList.add('is-on'); await wait(200); }
      setDay(d.id);
      S.moment = undefined;
      const items = dayItems(d.id);
      // each moment fits its slot of the 60 seconds; the opener is a title over its shot
      const sum = (id) => items.filter((it) => it.moment === id).reduce((s, it) => s + it.kf.dur + it.kf.hold, 0);
      const scales = items.map((it) => (it.moment ? REEL[it.moment] / Math.max(0.1, sum(it.moment)) : REEL.open[d.id] / Math.max(0.1, it.kf.hold)));
      if (!REEL.open[d.id]) { items.shift(); scales.shift(); items[0] = { ...items[0], kf: { ...items[0].kf, dur: 0 } }; }
      showDayTitle(d.id, { intro: d.id === 'fri' });
      if (d.id === 'fri') setTimeout(() => { if (S.playing === token) showDayTitle('fri'); }, 2000);
      const flight = runFlight(items, token, { scales });
      if (d.id !== 'fri') { await wait(60); el.fade.classList.remove('is-on'); }
      if (!(await flight) || S.playing !== token) return;
    }
    setPlaying(null);
    if (rig.driving) rig.release({ limits: FREE });
    showEnd();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- the end card ----------
  function showEnd() {
    stop();
    const E = S.W.end;
    el.end.innerHTML = `<div><h2>${E.title}</h2><p>${esc(E.names)}</p><p>${esc(E.dates)}</p><div><button type="button" data-end="again">${esc(E.again)}</button><button type="button" data-end="back">${esc(E.back)}</button></div></div>`;
    el.end.hidden = false;
    el.end.querySelector('button').focus({ preventScroll: true });
  }
  function hideEnd() { el.end.hidden = true; hideStills(); }

  // ---------- open and close ----------
  async function openShell() {
    if (S.open) return;
    S.open = true;
    ctx.stopTour?.();
    ctx.stopOthers?.();
    ui.hideCard();
    S.saved = {
      time: api.time.get(), date: api.date.get(), layers: api.layers.all().filter((l) => api.layers.isOn(l.id)).map((l) => l.id),
      shot: { pos: rig.camera.position.clone(), target: rig.controls.target.clone(), fov: rig.lens, fixed: true, eye: rig.eye, limits: { min: rig.eye ? 0.5 : 4, max: 2600 } },
    };
    S.saved.layers.forEach((id) => ctx.layersUI.set(id, false));
    root.classList.add('is-weekend');
    document.documentElement.classList.add('vx-wk-lock');
    box.hidden = false;
    // the page under the mode loses any ?w= link, so leaving and reloading stays out; the mode's own entry keeps it
    try {
      const here = location.href, u = new URL(here);
      u.searchParams.delete('w'); u.searchParams.delete('o');
      history.replaceState(history.state, '', u);
      history.pushState({ vxWeekend: true }, '', here);
      S.pushed = true;
    } catch { S.pushed = false; }
    el.c1.textContent = 'Loading the weekend';
    S.st = await stage.load();
    S.W = stage.words;
    el.honest.textContent = S.W.honest;
    renderTabs();
    S.frameHook = api.loop.onFrame((f) => stage.update(f));
    S.timeOff = api.time.on(showClock);
    S.lightOff = api.light.on(() => showClock());
    setTimeout(S.st.prebuild, 2500);
    measureBar();
    rig.refreshInsets?.();
    el.card.focus({ preventScroll: true });
  }
  async function open(target = null, { option = null } = {}) {
    await openShell();
    hideEnd();
    if (option) applyOption(target, option);
    if (target === 'reel') {
      // a link to the reel never plays by itself: it waits for a tap
      await goToOpener('fri');
      el.tags.insertAdjacentHTML('beforeend', `<button type="button" class="vx-wk-go" data-reel>${esc(S.W.reel)}</button>`);
      return;
    }
    const m = target && api.moments.get(target);
    if (m) { showDayTitle(m.day); return goTo(m.id); }
    const day = dayOf(target) || dayOf(String(target || '').slice(0, 3));
    if (day) { showDayTitle(day.id); return goTo(momentsOf(day.id)[0].id); }
    return goToOpener('fri');
  }
  function close({ fromHistory = false } = {}) {
    if (!S.open) return;
    stop();
    hideEnd();
    closePop();
    S.open = false;
    S.day = null;
    clearTimeout(S.titleTimer);
    S.frameHook?.(); S.timeOff?.(); S.lightOff?.();
    stage.show([], { fade: 0 });
    cues([]);
    box.hidden = true;
    root.classList.remove('is-weekend');
    document.documentElement.classList.remove('vx-wk-lock');
    const sv = S.saved;
    api.date.set(sv.date);
    api.time.set(sv.time);
    sv.layers.forEach((id) => ctx.layersUI.set(id, true));
    rig.jumpTo(sv.shot);
    if (S.pushed && !fromHistory) { S.pushed = false; history.back(); }
    S.pushed = false;
    api.loop.request();
    $('vx-weekend-open')?.focus?.({ preventScroll: true });
  }
  window.addEventListener('popstate', () => { if (S.open) { S.pushed = false; close({ fromHistory: true }); } });

  function applyOption(id, value) {
    const m = api.moments.get(id);
    const o = detail(m?.id)?.options;
    if (!o || !o.items.some((it) => it.id === value)) return;
    if (o.group === 'oven') S.opts.oven = value; else S.opts.dinner = value;
    stage.option(o.group, value);
  }
  function pickOption(group, id) {
    if (group === 'oven') S.opts.oven = S.opts.oven === id ? null : id;
    else S.opts.dinner = id;
    stage.option(group, group === 'oven' ? S.opts.oven : S.opts.dinner);
    goTo(S.moment, { keepTime: true });
  }

  // ---------- the guest's hands ----------
  el.card.addEventListener('click', (e) => {
    const t = e.target;
    const opt = t.closest('[data-opt]');
    if (opt) { pickOption(opt.dataset.group, opt.dataset.opt); return; }
    if (t.closest('[data-reel]')) { reel(); return; }
    const nxt = t.closest('[data-day-next]');
    if (nxt) { setDay(nxt.dataset.dayNext); S.moment = null; renderCard(); play(); return; }
    // a tap on the card is for reading: it opens More (the dock's play shows the moment)
    if (S.moment) openPop();
  });
  el.pop.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-opt]');
    if (opt) { pickOption(opt.dataset.group, opt.dataset.opt); return; }
    if (e.target.closest('.vx-wk-x2')) { closePop(); fitCard(); }
  });
  el.days.addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    showDayTitle(b.dataset.day);
    goTo(momentsOf(b.dataset.day)[0].id);
  });
  el.play.addEventListener('click', () => play());
  el.next.addEventListener('click', () => step(1));
  q('.vx-wk-x').addEventListener('click', () => close());
  // photo mode while paused: a sketched long table at golden hour is a good photo (photo-ui.js marks it an idea)
  q('.vx-wk-cam').addEventListener('click', async (e) => { stop(); closePop(); (await ctx.loadPhoto()).enter(e.currentTarget); });
  el.snd.addEventListener('click', async () => { $('vx-sound')?.click(); setTimeout(() => cues(detail(S.moment)?.sound || []), 400); });
  el.end.addEventListener('click', (e) => {
    const b = e.target.closest('[data-end]');
    if (!b) return;
    if (b.dataset.end === 'again') reel(); else close();
  });

  // the scrubber: the light follows the handle; on letting go it snaps to a moment within SNAP_PX
  let writeTimer = 0;
  el.range.addEventListener('pointerdown', () => { stop(); dragging = true; box.classList.add('is-scrubbing'); });
  el.range.addEventListener('input', () => {
    if (S.playing) stop();
    const v = Number(el.range.value);
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => api.time.set(v), 60);
    const w = clockWords(v);
    el.c1.textContent = w.line1;
    el.c2.textContent = w.line2;
    el.c2.hidden = !w.line2;
  });
  el.range.addEventListener('change', () => {
    dragging = false;
    box.classList.remove('is-scrubbing');
    const v = Number(el.range.value);
    api.time.set(v);
    const width = el.line.getBoundingClientRect().width || 1;
    const px = (m) => (pctOf(m) / 100) * width;
    let best = null;
    momentsOf(S.day).forEach((m) => {
      const [a, b] = detail(m.id).light.at;
      const d = v >= a && v <= b ? 0 : Math.min(Math.abs(px(a) - px(v)), Math.abs(px(b) - px(v)), Math.abs(px((a + b) / 2) - px(v)));
      if (d <= SNAP_PX && (!best || d < best.d)) best = { m, d, inside: d === 0 };
    });
    if (best && best.m.id !== S.moment) goTo(best.m.id, { keepTime: best.inside });
    else if (best) renderCard();
  });
  ['pointerup', 'pointercancel', 'blur'].forEach((ev) => el.range.addEventListener(ev, () => { dragging = false; box.classList.remove('is-scrubbing'); }));

  // the mode's own keys: left and right for the moments, Shift for the days, space to play, Escape to leave
  box.addEventListener('keydown', (e) => {
    if (!S.open || e.target.closest('.vx-wk-end') && e.key !== 'Escape') return;
    const k = e.key;
    if (!MODE_KEYS.has(k) && !(e.target === el.range && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(k))) {
      if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Enter'].includes(k)) stop();
      return;
    }
    if ((k === ' ' || k === 'Spacebar') && e.target.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape') { if (!el.pop.hidden) closePop(); else close(); return; }
    if (k === ' ' || k === 'Spacebar') { play(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { const dir = k === 'ArrowLeft' ? -1 : 1; if (e.shiftKey) stepDay(dir); else step(dir); return; }
    if (k === 'Home') goTo(momentsOf(S.day)[0].id);
    else if (k === 'End') goTo(momentsOf(S.day).at(-1).id);
    else stop();
  });
  // Escape from anywhere on the page leaves; any other key, a touch, a scroll pauses
  document.addEventListener('keydown', (e) => {
    if (!S.open || root.classList.contains('is-photo')) return;
    if (e.key === 'Escape' && !box.contains(e.target)) { e.preventDefault(); close(); return; }
    if (S.playing && !box.contains(e.target) && !['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) stop();
  }, { capture: true });
  root.addEventListener('pointerdown', (e) => { if (S.playing && !e.target.closest('.vx-wk-play')) stop(); }, { capture: true });
  root.addEventListener('wheel', () => { if (S.playing) stop(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  rig.onEvent((ev) => { if (ev === 'released' && S.playing && !reducedMotion) stop(); });
  window.addEventListener('resize', () => { if (S.open) { measureBar(); requestAnimationFrame(() => { spaceLabels(); fitCard(); }); } });

  box.hidden = true;
  return {
    open, close, reel, goTo, play, stop, step,
    resolveShot,   // for the tests: a keyframe's shot as this screen flies it
    get state() { return { open: S.open, day: S.day, moment: S.moment, playing: !!S.playing, opts: { ...S.opts }, shown: stage.shown() }; },
    clockWords: (m) => clockWords(m ?? api.time.get()),
  };
}
