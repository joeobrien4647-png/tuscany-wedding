// The ways into the weekend mode (weekend-mode-spec.md, section 6): "The weekend" from Friday's start, four day chips
// in the home page's words on each day's headline moment, and the reel (also in More). The mode loads on the first tap.
import { esc } from './dom.js';

const DAYS = [
  ['fri', 'Friday', 'arrival', 'fri-arrive'],
  ['sat', 'Saturday', 'the wedding', 'sat-ceremony'],
  ['sun', 'Sunday', 'pool day', 'sun-pools'],
  ['mon', 'Monday', 'home time', 'mon-leave'],
].map(([id, day, what, at]) => ({ id, day, what, at }));

export function installWeekend(ctx) {
  const { $, ui } = ctx;
  const box = $('vx-week');
  const chip = (d) => `<button type="button" class="vx-chip" data-day="${d.id}" aria-label="${esc(`${d.day}: ${d.what}`)}"><b>${d.day.slice(0, 3)}</b><span class="vx-chip-d"> ${esc(d.what)}</span></button>`;
  box.innerHTML = `<button type="button" class="vx-chip" id="vx-weekend-open" data-weekend="open"><b>The weekend</b></button>${DAYS.map(chip).join('')}<button type="button" class="vx-chip" data-weekend="reel" aria-label="The weekend in 60 seconds">In 60 seconds</button>`;
  // centred while they fit, scrolling from the first when not; short days on a phone
  if (!document.getElementById('vx-week-style')) {
    const st = document.createElement('style');
    st.id = 'vx-week-style';
    st.textContent = '.vx .vx-week{justify-content:flex-start}.vx-week>:first-child{margin-left:auto}.vx-week>:last-child{margin-right:auto}@media (max-width:639px){.vx-chip-d{display:none}}';
    document.head.append(st);
  }

  let mode = null, loading = null;
  const load = () => (loading ??= import('./weekend-mode.js').then((m) => (mode = m.createWeekendMode(ctx))).catch((err) => {
    loading = null;
    ui.toast('That could not load just now. Try again in a moment');
    throw err;
  }));
  // target: a moment, a day or nothing (Friday's start); opts.option picks within the moment's options
  const open = async (target = null, opts) => (await load()).open(target, opts);
  const reel = async () => (await load()).reel();
  const choose = (id) => open(DAYS.find((d) => d.id === id)?.at ?? id);

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-day], [data-weekend]');
    if (!b) return;
    if (b.dataset.weekend === 'reel') reel();
    else if (b.dataset.weekend) open();
    else choose(b.dataset.day);
  });
  $('vx-wk-menu-open')?.addEventListener('click', () => { ctx.closeMenu?.(); open(); });
  $('vx-wk-menu-reel')?.addEventListener('click', () => { ctx.closeMenu?.(); reel(); });

  return { choose, open, reel, load, days: DAYS, get mode() { return mode; } };
}
