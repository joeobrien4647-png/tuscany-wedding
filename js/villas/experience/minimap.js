// The minimap and compass: a top-down map of the estate drawn from the model (relief shaded from the terrain, the
// meadows, the pond and streams, the lanes and paths, both villas, the outbuildings and the pools) with the places'
// pins and the camera as a wedge. Tap it to fly there. A corner inset on computers; on phones a compass button opens
// it as a sheet. The needle says what you face in words ("west, over the lake").
import { esc } from './dom.js';
import { pinName } from './pins.js';

const SIZE = 300;            // the SVG's own units across
const WORDS8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const TOWARDS = {
  'lago-di-montedoglio': 'over the lake', 'la-verna': 'towards La Verna', sansepolcro: 'towards Sansepolcro',
  'monte-dei-frati': 'towards Monte dei Frati', 'monte-altuccia': 'towards the Alpe di Catenaia', anghiari: 'towards Anghiari',
  'pieve-santo-stefano': 'towards Pieve Santo Stefano', 'diga-di-montedoglio': 'towards the dam',
};

export const bearingOf = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
const angleBetween = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// what a compass bearing from a spot looks out at, in words
export function facingWords(model, x, z, bearing) {
  const word = WORDS8[Math.round(bearing / 45) % 8];
  // the lake: is the bearing inside the spread of its shore as seen from here?
  const lake = model.lake?.outline || [];
  if (lake.length) {
    const bs = lake.map(([lx, lz]) => bearingOf(lx - x, lz - z));
    const mid = bearingOf(model.lake.outline.reduce((s, p) => s + p[0], 0) / lake.length - x, model.lake.outline.reduce((s, p) => s + p[1], 0) / lake.length - z);
    const spread = Math.max(...bs.map((b) => angleBetween(b, mid)));
    if (angleBetween(bearing, mid) <= spread) return `${word}, over the lake`;
  }
  let best = null, bestOff = 18;
  (model.landmarks || []).forEach((l) => {
    if (!TOWARDS[l.id] || l.id === 'lago-di-montedoglio') return;
    const off = angleBetween(bearing, bearingOf(l.local[0] - x, l.local[1] - z));
    if (off < bestOff) { bestOff = off; best = l; }
  });
  (model.villas || []).forEach((v) => {
    const [vx, vz] = v.view || v.blocks[0].c;
    if (Math.hypot(vx - x, vz - z) < 120) return;
    const off = angleBetween(bearing, bearingOf(vx - x, vz - z));
    if (off < bestOff) { bestOff = off; best = { id: v.id, words: `towards ${v.name}` }; }
  });
  if (best) return `${word}, ${best.words || TOWARDS[best.id]}`;
  if (angleBetween(bearing, 90) <= 50) return `${word}, up into the woods`;
  return word;
}

export function installMinimap(ctx) {
  const { api, $, root } = ctx;
  const model = api.model, rig = api.use('rig'), ground = api.use('ground');
  const THREE = api.THREE;
  const box = $('vx-map'), holder = $('vx-map-svg'), facing = $('vx-map-facing'), btn = $('vx-compass'), close = $('vx-map-close');

  // the map's extent: both houses with their pools, outbuildings and the lane, and a margin of woods
  const pts = [];
  model.villas.forEach((v) => v.blocks.forEach((b) => pts.push(b.c)));
  model.pools.forEach((p) => pts.push(p.c));
  model.outbuildings.forEach((b) => pts.push(b.c));
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 150;
  const x0 = cx - half, z0 = cz - half, k = SIZE / (2 * half);
  const sx = (x) => ((x - x0) * k).toFixed(1), sz = (z) => ((z - z0) * k).toFixed(1);
  const toWorld = (u, v) => ({ x: x0 + u / k, z: z0 + v / k });

  // relief: the terrain shaded from the north-west, painted once into a small image
  function relief(n = 110) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    const step = (2 * half) / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * step, z = z0 + (j + 0.5) * step;
      const h = ground.heightAt(x, z);
      const dx = (ground.heightAt(x + step, z) - h) / step, dz = (ground.heightAt(x, z + step) - h) / step;
      const shade = Math.max(0, Math.min(1, 0.62 + (-dx * 0.7 - dz * 0.7) * 1.6));
      const p = (j * n + i) * 4;
      img.data[p] = 70 + 80 * shade; img.data[p + 1] = 92 + 82 * shade; img.data[p + 2] = 52 + 50 * shade; img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    try { return c.toDataURL('image/png'); } catch { return ''; }
  }

  const poly = (pl) => pl.map(([x, z]) => `${sx(x)},${sz(z)}`).join(' ');
  const rect = (b, cls) => {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), hl = b.length / 2, hw = b.width / 2;
    const corners = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([lx, lz]) => [b.c[0] + lx * c + lz * s, b.c[1] - lx * s + lz * c]);
    return `<polygon class="${cls}" points="${poly(corners)}"/>`;
  };
  const ROAD_W = { road: 3.2, service: 2.6, track: 1.8, path: 1 };
  const svg = `<svg viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Map of the estate, north up. Tap to fly there">
    <defs><clipPath id="vx-map-clip"><rect width="${SIZE}" height="${SIZE}" rx="14"/></clipPath></defs>
    <g clip-path="url(#vx-map-clip)">
      <rect width="${SIZE}" height="${SIZE}" fill="#556b3e"/>
      <image href="${relief()}" width="${SIZE}" height="${SIZE}" preserveAspectRatio="none" style="image-rendering:auto"/>
      ${(model.clearings || []).map((c) => `<polygon class="vx-m-${c.kind === 'fell' ? 'fell' : 'meadow'}" points="${poly(c.polygon)}"/>`).join('')}
      ${(model.water || []).map((w) => (w.polygon ? `<polygon class="vx-m-water" points="${poly(w.polygon)}"/>` : w.points ? `<polyline class="vx-m-stream" points="${poly(w.points)}"/>` : '')).join('')}
      ${(model.roads || []).map((r) => `<polyline class="vx-m-road vx-m-${r.kind}" stroke-width="${((ROAD_W[r.kind] || 1.5) * k * 1.6).toFixed(2)}" points="${poly(r.points)}"/>`).join('')}
      ${model.pools.map((p) => rect(p, 'vx-m-pool')).join('')}
      ${model.outbuildings.map((b) => rect(b, 'vx-m-out')).join('')}
      ${model.villas.map((v) => v.blocks.map((b) => rect(b, 'vx-m-house')).join('')).join('')}
      <g class="vx-m-pins"></g>
      <g class="vx-m-cam"><path class="vx-m-cone" d=""/><circle class="vx-m-eye" r="3.4"/></g>
      <g class="vx-m-north" transform="translate(${SIZE - 20},20)"><circle r="11"/><path d="M0 -8 L4 2 L0 0 L-4 2Z"/><text y="9.5">N</text></g>
    </g>
  </svg>`;
  holder.innerHTML = svg;
  const svgEl = holder.querySelector('svg');
  const pinsG = holder.querySelector('.vx-m-pins'), cone = holder.querySelector('.vx-m-cone'), eye = holder.querySelector('.vx-m-eye');
  const villaNames = model.villas.map((v) => {
    const b = v.blocks.reduce((a, c) => (c.length > a.length ? c : a));
    return `<text class="vx-m-label" x="${sx(b.c[0])}" y="${(Number(sz(b.c[1])) - 9).toFixed(1)}">${esc(v.name.replace('Villa ', ''))}</text>`;
  }).join('');

  function drawPins() {
    const list = api.places.all((p) => !p.room && (!p.layer || api.layers.isOn(p.layer)));
    pinsG.innerHTML = villaNames + list.map((p) => {
      const a = p.anchor?.();
      if (!a) return '';
      const u = (a.x - x0) * k, v = (a.z - z0) * k;
      if (u < 4 || v < 4 || u > SIZE - 4 || v > SIZE - 4) return '';
      return `<g class="vx-m-pin" data-place="${esc(p.id)}" transform="translate(${u.toFixed(1)},${v.toFixed(1)})"><circle r="4.2"/><title>${esc(pinName(p))}</title></g>`;
    }).join('');
  }
  drawPins();
  api.places.on(drawPins);
  api.layers.state.on(drawPins);

  // the camera: where it stands, and a wedge as wide as the lens looking along the view
  const dir = new THREE.Vector3();
  let lastWords = '';
  function drawCamera() {
    const cam = rig.camera, t = rig.controls.target;
    dir.subVectors(t, cam.position);
    let bearing = bearingOf(dir.x, dir.z);
    if (Math.hypot(dir.x, dir.z) < 1e-3) bearing = 0;
    const u = (cam.position.x - x0) * k, v = (cam.position.z - z0) * k;
    const inside = u > -20 && v > -20 && u < SIZE + 20 && v < SIZE + 20;
    const cu = Math.min(SIZE - 8, Math.max(8, u)), cv = Math.min(SIZE - 8, Math.max(8, v));
    const hf = Math.min(70, (Math.atan(Math.tan(((rig.lens || 40) * Math.PI) / 360) * Math.max(1, cam.aspect)) * 180) / Math.PI);
    const len = 46;
    const a0 = ((bearing - hf) * Math.PI) / 180, a1 = ((bearing + hf) * Math.PI) / 180;
    cone.setAttribute('d', `M${cu.toFixed(1)} ${cv.toFixed(1)} L${(cu + Math.sin(a0) * len).toFixed(1)} ${(cv - Math.cos(a0) * len).toFixed(1)} A${len} ${len} 0 0 1 ${(cu + Math.sin(a1) * len).toFixed(1)} ${(cv - Math.cos(a1) * len).toFixed(1)}Z`);
    eye.setAttribute('cx', cu.toFixed(1));
    eye.setAttribute('cy', cv.toFixed(1));
    eye.classList.toggle('is-off', !inside);
    btn?.style.setProperty('--vx-heading', `${(-bearing).toFixed(1)}deg`);
    const words = facingWords(model, cam.position.x, cam.position.z, bearing);
    if (words !== lastWords) {
      lastWords = words;
      facing.textContent = `Facing ${words}`;
      btn?.setAttribute('aria-label', `Map and compass: facing ${words}`);
    }
    return { bearing, words };
  }
  api.loop.onFrame(({ moved }) => { if (moved) drawCamera(); }, { phase: 'post' });
  drawCamera();

  // tap: a pin opens its place; anywhere else flies there, keeping the way the camera faces
  function flyToPoint(x, z) {
    const cam = rig.camera, t = rig.controls.target;
    const back = bearingOf(cam.position.x - t.x, cam.position.z - t.z);
    const y = ground.groundAt(x, z);
    const r = 34;
    rig.flyTo({ frame: { box: { x1: x - r, x2: x + r, y1: y - 2, y2: y + 6, z1: z - r, z2: z + r }, bearing: back, elevation: 36, margin: 0.04 }, limits: { min: 4, max: 2600 } });
    api.loop.wake();
  }
  svgEl.addEventListener('click', (e) => {
    const pinEl = e.target.closest('.vx-m-pin');
    if (pinEl) { api.use('nav').showPlace(pinEl.dataset.place); if (isSheet()) setOpen(false); return; }
    const r = svgEl.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width) * SIZE, v = ((e.clientY - r.top) / r.height) * SIZE;
    const w = toWorld(u, v);
    ctx.stopTour?.();
    flyToPoint(w.x, w.z);
    if (isSheet()) setOpen(false);
  });

  // phones: the compass button opens the map as a sheet; computers show it as an inset all the time
  const isSheet = () => getComputedStyle(btn).display !== 'none';
  function setOpen(open) {
    box.classList.toggle('is-open', open);
    box.hidden = !open && isSheet();
    btn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('has-map', open);
    if (open) drawCamera();
  }
  btn.addEventListener('click', () => setOpen(!box.classList.contains('is-open')));
  close.addEventListener('click', () => setOpen(false));
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } });
  const fit = () => { if (!isSheet()) box.hidden = false; else if (!box.classList.contains('is-open')) box.hidden = true; };
  new ResizeObserver(fit).observe(root);
  fit();

  return { drawCamera, flyToPoint, setOpen, facingWords: (x, z, b) => facingWords(model, x, z, b), toWorld, x0, z0, k, SIZE };
}
