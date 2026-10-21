// Photo mode, after Mill Lane's ui-photo.js: the page's controls step aside, a frame shows the shot (4:5, 9:16 or the
// screen's own shape), the camera still moves to compose it, and the shutter asks the renderer for a clean still
// (pipeline.photo: many samples at Best quality where the renderer has it), with a ring filling as it works. Then
// save it as a PNG at up to twice the frame's size, or share it. Loaded on the first press of the camera button.
import { toHHMM } from '../api.js';
import { markStill, saveCanvas, inAppBrowser } from './keep.js';

const SHAPES = [
  { id: 'portrait', label: '4:5', ratio: 4 / 5 },
  { id: 'story', label: '9:16', ratio: 9 / 16 },
  { id: 'screen', label: 'Screen', ratio: null },
];
const MAX_SIDE = 2400;

export function createPhoto(ctx) {
  const { api, root, ui } = ctx;
  const pipeline = api.use('pipeline'), rig = api.use('rig');
  const stage = api.stage;
  let shape = 'portrait', open = false, busy = false, shot = null, returnTo = null;

  const el = document.createElement('div');
  el.className = 'vx-photo-mode';
  el.hidden = true;
  el.innerHTML = `
    <div class="vx-pm-frame" aria-hidden="true"><span class="vx-pm-window"></span></div>
    <div class="vx-pm-bar" role="toolbar" aria-label="Photo">
      <button type="button" class="vx-pm-close" data-pm="close" aria-label="Leave photo mode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <div class="vx-pm-shapes" role="radiogroup" aria-label="Shape">${SHAPES.map((s) => `<button type="button" role="radio" data-shape="${s.id}" aria-checked="${s.id === shape}">${s.label}</button>`).join('')}</div>
      <button type="button" class="vx-pm-shutter" data-pm="shoot" aria-label="Take the photo"><svg class="vx-pm-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><circle class="vx-pm-progress" cx="32" cy="32" r="29" pathLength="100"/></svg><span class="vx-pm-dot"></span></button>
    </div>
    <p class="vx-pm-tip" role="status" aria-live="polite">Frame it, then press the shutter</p>
    <div class="vx-pm-result" hidden>
      <figure><img alt=""><figcaption></figcaption></figure>
      <div class="vx-pm-actions">
        <button type="button" class="vx-btn vx-btn--primary" data-pm="save">Save the photo</button>
        <button type="button" class="vx-btn" data-pm="share" hidden>Share</button>
        <button type="button" class="vx-btn" data-pm="again">Another</button>
        <button type="button" class="vx-btn" data-pm="close">Done</button>
      </div>
    </div>`;
  root.append(el);
  const $ = (s) => el.querySelector(s);
  const win = $('.vx-pm-window'), tip = $('.vx-pm-tip'), result = $('.vx-pm-result'), progress = $('.vx-pm-progress');

  const ratioOf = () => SHAPES.find((s) => s.id === shape).ratio ?? stage.clientWidth / Math.max(1, stage.clientHeight);
  // the window: the biggest box of the shape centred on the stage (the still is the middle of the view), clear of
  // the bar at the bottom unless the shape is the screen's own
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const r = ratioOf();
    const room = shape === 'screen' ? H - 24 : H - 2 * 92;
    let w = W - 24, h = w / r;
    if (h > room) { h = room; w = h * r; }
    Object.assign(win.style, { width: `${Math.round(w)}px`, height: `${Math.round(h)}px`, left: `${Math.round((W - w) / 2)}px`, top: `${Math.round((H - h) / 2)}px` });
    return { w, h };
  }

  function setShape(id) {
    shape = id;
    el.querySelectorAll('[data-shape]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.shape === id)));
    layout();
  }

  function enter(trigger) {
    if (open) return;
    open = true;
    returnTo = trigger || document.activeElement;
    ctx.stopTour?.();
    ui.hideCard({ keepSelection: true });
    root.classList.add('is-photo');
    el.hidden = false;
    result.hidden = true;
    tip.textContent = 'Frame it, then press the shutter';
    layout();
    api.loop.request();
    $('.vx-pm-shutter').focus();
  }

  function leave() {
    if (!open) return;
    open = false;
    busy = false;
    el.hidden = true;
    el.classList.remove('has-result');
    root.classList.remove('is-photo', 'is-shooting');
    api.loop.request();
    returnTo?.focus?.();
  }

  async function shoot() {
    if (busy) return;
    busy = true;
    root.classList.add('is-shooting');
    tip.textContent = 'Developing';
    progress.style.strokeDashoffset = '100';
    // the controls have stepped aside: let the lens re-centre on the whole stage before the still
    for (let i = 0; i < 30; i++) {
      const s = rig.insets;
      if (Math.max(s.top, s.right, s.bottom, s.left) < 1) break;
      api.loop.request();
      await new Promise((r) => setTimeout(r, 60));
    }
    const { w, h } = layout();
    const k = Math.min(2, MAX_SIDE / Math.max(w, h));
    try {
      const raw = await pipeline.photo({ width: Math.round(w * k), height: Math.round(h * k), samples: 48, onProgress: (done, total) => { progress.style.strokeDashoffset = String(100 - (100 * done) / Math.max(1, total)); } });
      if (!open) return;
      // the honesty line goes on the picture itself, and "How it could look" with a layer on, a floor cut open or
      // the weekend's sketches out; in the weekend mode the time is the plan's words, never a stand-in minute
      const view = api.view.get?.() || {};
      const wk = ctx.weekend?.mode?.state.open ? ctx.weekend.mode : null;
      const idea = api.layers.all().some((l) => api.layers.isOn(l.id)) || (view.floor != null && view.floor !== 'outside') || !!wk?.state.shown.length;
      const canvas = await markStill(raw, { idea });
      shot = { canvas, time: wk ? wk.clockWords().line1 : toHHMM(api.time.get()) };
      const img = $('.vx-pm-result img');
      img.src = canvas.toDataURL('image/png');
      img.alt = `A still of La Conca in the model${wk ? `, ${shot.time.toLowerCase()}` : ` at ${shot.time}`}`;
      $('.vx-pm-result figcaption').textContent = `${shot.time} in the model, ${canvas.width} × ${canvas.height}`;
      const canShare = !!navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'a.png', { type: 'image/png' })] });
      $('[data-pm="share"]').hidden = !canShare;
      // where a download does nothing, the button opens the picture to press and hold
      $('[data-pm="save"]').textContent = inAppBrowser() ? 'Keep the photo' : 'Save the photo';
      result.hidden = false;
      el.classList.add('has-result');
      tip.textContent = '';
      $('[data-pm="save"]').focus();
    } catch (err) {
      console.warn('[villas] photo', err);
      tip.textContent = 'That one did not come out. Try again';
    } finally {
      busy = false;
      root.classList.remove('is-shooting');
    }
  }

  const fileName = () => `la-conca-${(shot?.time || '').replace(':', '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  const blob = () => new Promise((r) => shot.canvas.toBlob(r, 'image/png'));
  async function save() {
    if (!shot) return;
    await saveCanvas(shot.canvas, fileName(), { ui, root });
  }
  async function share() {
    if (!shot) return;
    try {
      await navigator.share({ files: [new File([await blob()], fileName(), { type: 'image/png' })], title: 'La Conca in 3D' });
    } catch (err) {
      if (err?.name !== 'AbortError') ui.toast('Could not share from this browser');
    }
  }

  el.addEventListener('click', (e) => {
    const s = e.target.closest('[data-shape]');
    if (s) { setShape(s.dataset.shape); return; }
    const a = e.target.closest('[data-pm]')?.dataset.pm;
    if (a === 'close') leave();
    else if (a === 'shoot') shoot();
    else if (a === 'save') save();
    else if (a === 'share') share();
    else if (a === 'again') { result.hidden = true; el.classList.remove('has-result'); tip.textContent = 'Frame it, then press the shutter'; $('.vx-pm-shutter').focus(); }
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); if (!result.hidden) { result.hidden = true; el.classList.remove('has-result'); } else leave(); } });
  new ResizeObserver(() => { if (open) layout(); }).observe(stage);

  return { enter, leave, shoot, save, setShape, get open() { return open; }, get shot() { return shot; } };
}
