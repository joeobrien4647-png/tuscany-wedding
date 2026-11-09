// Loads the villa explorer after the page shell: fills in each villa's bedroom, bathroom and sleeping counts from
// the model data (no 3D needed), and fetches three.js and the scene alongside the model, only if WebGL is there.
const MESSAGES = ['Loading the estate', 'Raising the hills', 'Planting the woods', 'Filling the pools'];

const $ = (id) => document.getElementById(id);

// three.js r170 needs WebGL 2 (iPhones from iOS 15)
function webgl() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch { return false; }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// La Conca's own counts per villa. No per-room list: the beds in each room and the room numbers are not public.
function villaCounts(model, onLook) {
  const box = $('vx-roomlist');
  box.innerHTML = model.villas.map((v) => `
    <div class="vx-roomcol">
      <h3>Villa <em>${esc(v.name.replace('Villa ', ''))}</em></h3>
      <dl class="vx-counts">
        <div><dt>Bedrooms</dt><dd>${v.bedrooms}</dd></div>
        <div><dt>Bathrooms</dt><dd>${v.bathrooms}</dd></div>
        <div><dt>Sleeps</dt><dd>${v.sleeps}</dd></div>
      </dl>
      <button type="button" class="btn btn-outline vx-look" data-villa="${esc(v.id)}" hidden>Look inside in 3D</button>
    </div>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.vx-look');
    if (b) onLook(b.dataset.villa);
  });
}

function fail(message) {
  $('vx-loading').innerHTML = `<span class="vx-loading-text">${esc(message)}</span>`;
  $('vx-loading').classList.add('is-failed');
}

// The explorer's first screen sits between the site header and, on phones, the nav pinned to the bottom. Their real
// heights (the header is 88 px on most phones, and either can wrap) set it, so the stage's foot and its map credit
// stay clear of the nav.
function fitHero() {
  const hero = document.querySelector('.vx-hero'), head = document.querySelector('.guest-header'), nav = document.querySelector('.guest-nav');
  if (!hero || !head || !nav || !window.ResizeObserver) return;
  const fit = () => {
    hero.style.setProperty('--vx-top', `${Math.ceil(head.getBoundingClientRect().height)}px`);
    hero.style.setProperty('--vx-bottom', getComputedStyle(nav).position === 'fixed' ? `${Math.ceil(nav.getBoundingClientRect().height)}px` : '0px');
  };
  const watch = new ResizeObserver(fit);
  watch.observe(head);
  watch.observe(nav);
}

async function main() {
  if (!$('vx-stage')) return;
  fitHero();
  // the scene's code loads alongside the model, not after it (villas.html preloads both)
  const modelLoad = fetch('data/villas-model.json').then((res) => res.json());
  const has3d = webgl();
  const appLoad = has3d ? import('./app.js') : null;
  appLoad?.catch(() => {});   // a failed load is reported below, once the counts are in
  let model;
  try {
    model = await modelLoad;
  } catch {
    fail('The model could not load. Try again in a moment');
    return;
  }
  let app = null;
  villaCounts(model, (id) => {
    if (!app) return;
    $('explorer').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    app.openVilla(id, { floor: 0 });
  });
  if (!has3d) {
    fail('This browser cannot show the 3D model, but each villa’s rooms are counted below');
    return;
  }
  let i = 0;
  const text = $('vx-loading-text');
  const timer = setInterval(() => { i = (i + 1) % MESSAGES.length; text.textContent = MESSAGES[i]; }, 1400);
  try {
    const { start } = await appLoad;
    app = await start({
      root: $('explorer'), stage: $('vx-stage'), labelsLayer: $('vx-labels'), model,
      onProgress: (m) => { text.textContent = m; },
    });
  } catch (err) {
    clearInterval(timer);
    console.warn('[villas]', err);
    fail('The 3D model could not start on this device, but each villa’s rooms are counted below');
    return;
  }
  clearInterval(timer);
  document.querySelectorAll('.vx-look').forEach((b) => { b.hidden = false; });
  ['vx-search', 'vx-side', 'vx-dock'].forEach((id) => { $(id).hidden = false; });
  $('explorer').classList.add('is-ready');
  window.dispatchEvent(new CustomEvent('villas:ready'));
}

main();
