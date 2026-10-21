// One toggle per registered layer ("How it could look" for the wedding layer), off by default. While a layer is on
// its notice stays on screen ("Ideas from weddings here. Nothing is decided") with a way back to "As it is".
// A layer's code arrives the first time it is switched on (content's load(), by dynamic import).
import { esc, ICONS } from './dom.js';

export function installLayersUI(ctx) {
  const { api, $, root } = ctx;
  const box = $('vx-layer-btns'), notice = $('vx-notice'), text = $('vx-notice-text'), off = $('vx-notice-off');
  const busy = new Set();

  function render() {
    const layers = api.layers.all();
    box.hidden = !layers.length;
    box.innerHTML = layers.map((l) => `<button type="button" class="vx-side-btn vx-layer-btn" data-layer="${esc(l.id)}" aria-pressed="${api.layers.isOn(l.id)}" title="${esc(l.label)}">${ICONS.sparkle}<span>${esc(l.label)}</span></button>`).join('');
    sync();
  }

  function sync() {
    const on = api.layers.all().filter((l) => api.layers.isOn(l.id));
    box.querySelectorAll('[data-layer]').forEach((b) => {
      b.setAttribute('aria-pressed', String(api.layers.isOn(b.dataset.layer)));
      b.toggleAttribute('aria-busy', busy.has(b.dataset.layer));
    });
    notice.hidden = !on.length;
    root.classList.toggle('has-notice', !!on.length);
    if (on.length) {
      text.textContent = on.map((l) => l.notice).filter((n, i, a) => a.indexOf(n) === i).join('. ');
      notice.dataset.layer = on.map((l) => l.id).join(' ');
      off.dataset.layer = on[0].id;
    }
  }

  async function set(id, value) {
    if (!api.layers.get(id)) return;
    busy.add(id);
    // api.layers.set marks the layer on at once and then waits for its code: the toggle and the notice answer the
    // tap straight away, busy until the layer has arrived
    const pending = api.layers.set(id, value);
    sync();
    try {
      await pending;
    } catch (err) {
      console.warn('[villas] layer', id, err);
      ctx.ui.toast('That could not load just now. Try again in a moment');
    } finally {
      busy.delete(id);
      sync();
    }
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-layer]');
    if (b) set(b.dataset.layer, !api.layers.isOn(b.dataset.layer));
  });
  off.addEventListener('click', () => api.layers.all().forEach((l) => { if (api.layers.isOn(l.id)) set(l.id, false); }));
  api.layers.on(render);
  api.layers.state.on(sync);
  render();
  return { set, render };
}
