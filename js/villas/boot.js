// Loads the villa explorer after the page shell: fills in each villa's bedroom, bathroom and sleeping counts from
// the model data (no 3D needed), then fetches three.js and the scene only if WebGL is there.
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

async function main() {
  if (!$('vx-stage')) return;
  let model;
  try {
    const res = await fetch('data/villas-model.json');
    model = await res.json();
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
  if (!webgl()) {
    fail('This browser cannot show the 3D model, but each villa’s rooms are counted below');
    return;
  }
  let i = 0;
  const text = $('vx-loading-text');
  const timer = setInterval(() => { i = (i + 1) % MESSAGES.length; text.textContent = MESSAGES[i]; }, 1400);
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 120)));
  try {
    const { start } = await import('./app.js');
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
