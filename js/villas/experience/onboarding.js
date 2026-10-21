// First visit: three short hints in turn (turn the model, zoom, try the time bar), each gone as soon as it is done or
// on any tap. Remembered in localStorage when it can be (the page works without it). With reduced motion, one line.
// The hints never take a tap themselves: they sit over the model with pointer-events off.
const KEY = 'sj-villas-hints';

export function installOnboarding(ctx) {
  const { api, $, root } = ctx;
  const rig = api.use('rig');
  const el = $('vx-hint');
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  const seen = () => { try { return localStorage.getItem(KEY) === 'done'; } catch { return false; } };
  const remember = () => { try { localStorage.setItem(KEY, 'done'); } catch { /* private mode, or storage blocked */ } };

  const touch = api.coarse;
  const zoomKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
  const HINTS = reduced
    ? [{ id: 'all', text: touch ? 'Swipe sideways to turn, pinch to zoom, and try the time bar' : `Drag to turn, hold ${zoomKey} and scroll to zoom, and try the time bar` }]
    : [
      { id: 'turn', icon: 'turn', text: touch ? 'Swipe sideways to look round' : 'Drag to look round' },
      { id: 'zoom', icon: 'zoom', text: touch ? 'Pinch to zoom in' : `Hold ${zoomKey} and scroll to zoom` },
      { id: 'time', icon: 'time', text: 'Drag the sun along the time bar', where: 'time' },
    ];
  const ICON = {
    turn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M18.5 3.5v3.6h-3.6M5.5 20.5v-3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 15 4 20M4 15.5V20h4.5M15 9l5-5M20 8.5V4h-4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    time: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="4" fill="currentColor"/><path d="M3 20h18M12 4v2.4M5.3 7.3l1.6 1.6M18.7 7.3l-1.6 1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  let i = -1, timer = 0, done = false;
  function show(k) {
    i = k;
    const h = HINTS[k];
    if (!h) { finish(); return; }
    el.innerHTML = `${h.icon ? ICON[h.icon] : ''}<span>${h.text}</span>`;
    el.dataset.hint = h.id;
    el.classList.toggle('is-time', h.where === 'time');
    // the time bar's hint rides in the dock, just above the bar; the others float over the model
    const bar = $('vx-time');
    if (h.where === 'time') bar.before(el);
    else if (el.parentElement !== root) root.append(el);
    el.hidden = false;
    if (k === 0) remember();
  }
  function next(delay = 450) {
    if (done) return;
    el.hidden = true;
    clearTimeout(timer);
    timer = setTimeout(() => show(i + 1), delay);
  }
  function finish() {
    done = true;
    clearTimeout(timer);
    el.hidden = true;
    remember();
  }
  const current = () => (done || el.hidden ? null : HINTS[i]?.id);

  // doing it counts
  rig.onEvent((e) => { if (e === 'user' && current() === 'turn') next(); });
  let d0 = null;
  api.loop.onFrame(() => {
    const d = rig.camera.position.distanceTo(rig.controls.target);
    if (current() === 'zoom') { if (d0 == null) d0 = d; else if (Math.abs(d - d0) / d0 > 0.12) next(); } else d0 = null;
  }, { phase: 'post' });
  const prev = ctx.onTimeInput;
  ctx.onTimeInput = (v) => { prev?.(v); if (current() === 'time' || current() === 'all') next(); };
  // and so does any tap (its click: the dock's hint must not shift the chips mid-tap), after the hint has been up a moment
  root.addEventListener('click', () => { if (current() && performance.now() - shownAt > 600) next(900); }, { capture: true });
  let shownAt = 0;
  new MutationObserver(() => { if (!el.hidden) shownAt = performance.now(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });

  function start({ delay = 1400 } = {}) {
    if (seen() || done) return;
    timer = setTimeout(() => { if (!ctx.tour?.touring) show(0); }, delay);
  }
  return { start, finish, get current() { return current(); }, hints: HINTS };
}
