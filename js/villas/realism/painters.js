// Canvas painters for the estate's surfaces, after mill-lane-home's materials.js: no images, every surface drawn.
// Each returns { c, h, tile }: a colour canvas, a height canvas over the same shapes (0 deep joint, 1 proud face;
// it becomes a normal map, so stone has relief) and the metres one repeat covers. Height variation uses its own
// random stream. Colours are the eyeballed ones in villa-detail.md's colour notes (approximate, by eye; nothing is
// sampled from a photograph).
import * as THREE from '../vendor/three-core.js';
import { seeded } from '../util.js';

let SIZE = 256;
export const setPainterSize = (s) => { SIZE = s; };

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
const grey = (v) => { const g = Math.round(Math.min(1, Math.max(0, v)) * 255); return `rgb(${g},${g},${g})`; };
export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
}
function mixHex(a, b, t) { return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`; }
function specks(x, size, rnd, count, alpha, light = 0.5) {
  for (let i = 0; i < count; i++) {
    const v = rnd() < light ? 255 : 0;
    x.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    const s = 0.6 + rnd() * 1.6 * (size / 256);
    x.fillRect(rnd() * size, rnd() * size, s, s);
  }
}
// draw at every wrap offset that reaches the canvas, so the pattern tiles
function wrapped(size, cx, cy, r, fn) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const ox = cx + dx, oy = cy + dy;
    if (ox + r < 0 || ox - r > size || oy + r < 0 || oy - r > size) continue;
    fn(ox, oy);
  }
}
function stoneShape(rx, ry, rnd, round) {
  const n = 8 + Math.floor(rnd() * 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.45;
    const ca = Math.cos(a), sa = Math.sin(a);
    const k = 0.88 + rnd() * 0.18;
    const ex = round ? 0.9 : 0.55, ey = round ? 0.9 : 0.72;   // squarish beds, or rounder field stones
    pts.push([Math.sign(ca) * Math.pow(Math.abs(ca), ex) * rx * k, Math.sign(sa) * Math.pow(Math.abs(sa), ey) * ry * k]);
  }
  return pts;
}
function fillShape(x, ox, oy, pts) {
  x.beginPath();
  pts.forEach(([px, py], i) => (i ? x.lineTo(ox + px, oy + py) : x.moveTo(ox + px, oy + py)));
  x.closePath();
  x.fill();
}

// The face of one stone, weathered: soft lighter and darker patches inside its outline, so no stone is one flat
// colour (clipped to the stone).
function mottle(x, ox, oy, pts, rx, ry, rnd, strength = 1) {
  x.save();
  x.beginPath();
  pts.forEach(([px, py], i) => (i ? x.lineTo(ox + px, oy + py) : x.moveTo(ox + px, oy + py)));
  x.closePath();
  x.clip();
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const cx = ox + (rnd() - 0.5) * rx * 1.6, cy = oy + (rnd() - 0.5) * ry * 1.6, r = Math.max(rx, ry) * (0.35 + rnd() * 0.6);
    const dark = rnd() < 0.55;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = (0.05 + rnd() * 0.1) * strength;
    g.addColorStop(0, dark ? `rgba(48,38,26,${a})` : `rgba(255,248,232,${a})`);
    g.addColorStop(1, dark ? 'rgba(48,38,26,0)' : 'rgba(255,248,232,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  x.restore();
}

// Weather over a whole surface: rain streaks running down from the top of a wall (vertical), or damp patches and a
// little moss on paving, all soft and tiling.
function weather(x, size, rnd, { streaks = 0, damp = 0, moss = 0 } = {}) {
  for (let i = 0; i < streaks; i++) {
    const px = rnd() * size, w = size * (0.01 + rnd() * 0.03), len = size * (0.15 + rnd() * 0.5), py = rnd() * size;
    const g = x.createLinearGradient(0, py, 0, py + len);
    g.addColorStop(0, `rgba(52,44,34,${0.06 + rnd() * 0.08})`);
    g.addColorStop(1, 'rgba(52,44,34,0)');
    x.fillStyle = g;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0]) x.fillRect(px + dx - w / 2, py + dy, w, len);
  }
  for (let i = 0; i < damp + moss; i++) {
    const isMoss = i >= damp;
    const cx = rnd() * size, cy = rnd() * size, r = size * (isMoss ? 0.02 + rnd() * 0.05 : 0.06 + rnd() * 0.16);
    wrapped(size, cx, cy, r, (ox, oy) => {
      const g = x.createRadialGradient(ox, oy, 0, ox, oy, r);
      g.addColorStop(0, isMoss ? `rgba(78,92,46,${0.18 + rnd() * 0.18})` : `rgba(60,52,40,${0.06 + rnd() * 0.08})`);
      g.addColorStop(1, isMoss ? 'rgba(78,92,46,0)' : 'rgba(60,52,40,0)');
      x.fillStyle = g;
      x.fillRect(ox - r, oy - r, 2 * r, 2 * r);
    });
  }
}

// Rubble walls in loose courses: mixed sizes, squared beds or rounder stones, optional small pinning stones and
// patches of brick (Vallorsaia), in lime mortar.
export function rubble({ palette, mortar, tile = 2.4, round = false, pinning = 0, brick = 0, courses = 9, seed = 31, dry = false } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = mortar;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(dry ? 0.05 : 0.22);
  hx.fillRect(0, 0, size, size);
  const ch = size / courses;
  let y = 0;
  while (y < size) {
    const h = ch * (0.75 + rnd() * 0.5);
    let px = rnd() * size * 0.05;
    while (px < size) {
      const w = h * (round ? 0.9 + rnd() * 0.7 : 1.1 + rnd() * 1.6) * (rnd() < 0.1 ? 1.5 : 1);
      const rx = w / 2 - size * 0.006 * (dry ? 0.4 : 1), ry = (h * (0.78 + rnd() * 0.3)) / 2 - size * 0.006 * (dry ? 0.4 : 1);
      const cx = px + w / 2, cy = y + h / 2 + (rnd() - 0.5) * h * 0.25;
      const isBrick = brick && rnd() < brick;
      const colour = isBrick ? shade('#a5583a', (rnd() - 0.5) * 0.1) : shade(palette[Math.floor(rnd() * palette.length)], (rnd() - 0.5) * 0.14);
      const pts = isBrick ? [[-rx, -ry * 0.5], [rx, -ry * 0.5], [rx, ry * 0.5], [-rx, ry * 0.5]] : stoneShape(rx, ry, rnd, round);
      const lift = 0.72 + (r2() - 0.5) * 0.3;
      wrapped(size, cx, cy, Math.max(rx, ry), (ox, oy) => {
        x.fillStyle = colour;
        fillShape(x, ox, oy, pts);
        // a lighter top edge and a shadowed bottom: the stone's own relief in the colour
        x.fillStyle = 'rgba(255,246,228,0.10)';
        x.fillRect(ox - rx * 0.6, oy - ry * 0.8, rx * 1.2, Math.max(1, ry * 0.2));
        x.fillStyle = 'rgba(40,28,16,0.14)';
        x.fillRect(ox - rx * 0.7, oy + ry * 0.55, rx * 1.4, Math.max(1, ry * 0.25));
        mottle(x, ox, oy, pts, rx, ry, rnd);
        const g = hx.createRadialGradient(ox - rx * 0.2, oy - ry * 0.2, 0, ox, oy, Math.max(rx, ry));
        g.addColorStop(0, grey(lift + 0.18));
        g.addColorStop(0.75, grey(lift));
        g.addColorStop(1, grey(lift - 0.25));
        hx.fillStyle = g;
        fillShape(hx, ox, oy, pts);
      });
      if (pinning && rnd() < pinning) {
        const pr = h * (0.1 + rnd() * 0.1), pxx = px + w + pr * 0.2, pyy = y + h * (0.3 + rnd() * 0.5);
        const pc = shade(palette[Math.floor(rnd() * palette.length)], -0.05 + (rnd() - 0.5) * 0.1);
        const pp = stoneShape(pr * 1.3, pr, rnd, true);
        wrapped(size, pxx, pyy, pr * 1.3, (ox, oy) => { x.fillStyle = pc; fillShape(x, ox, oy, pp); hx.fillStyle = grey(0.62); fillShape(hx, ox, oy, pp); });
      }
      px += w * (0.97 + rnd() * 0.08) + (pinning ? h * 0.12 : 0);
    }
    y += h * (0.95 + rnd() * 0.08);
  }
  specks(x, size, rnd, size * 26, 0.1);
  specks(hx, size, r2, size * 16, 0.12);
  weather(x, size, rnd, { streaks: dry ? 4 : 10, damp: 3, moss: dry ? 10 : 3 });
  return { c, h: hc, tile, relief: dry ? 1.6 : 1.1 };
}

// Neat dressed courses (the honey-ochre stone of the outbuildings and the chapel).
export function coursed({ palette, mortar, tile = 2.2, courses = 6, seed = 41 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = mortar;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.3);
  hx.fillRect(0, 0, size, size);
  // courses of uneven height, as dressed stone is laid, scaled so they fill the tile exactly
  const hs = [];
  for (let r = 0; r < courses; r++) hs.push(0.7 + rnd() * 0.6);
  const sum = hs.reduce((a, b) => a + b, 0);
  const j = Math.max(1, size * 0.004);
  let y = 0;
  hs.forEach((hh) => {
    const ch = (hh / sum) * size;
    let px = -rnd() * ch * 2;
    while (px < size) {
      const w = ch * (1.3 + rnd() * 1.5);
      const colour = shade(palette[Math.floor(rnd() * palette.length)], (rnd() - 0.5) * 0.1);
      const lift = 0.75 + (r2() - 0.5) * 0.2;
      const pts = [[-w / 2 + j, -ch / 2 + j], [w / 2 - j, -ch / 2 + j], [w / 2 - j, ch / 2 - j], [-w / 2 + j, ch / 2 - j]];
      for (const dx of [-size, 0, size]) {
        const ox = px + dx + w / 2, oy = y + ch / 2;
        x.fillStyle = colour;
        fillShape(x, ox, oy, pts);
        // tooled face: a faint lighter top arris and a weathered lower edge
        x.fillStyle = 'rgba(255,246,228,0.07)';
        x.fillRect(ox - w / 2 + j, oy - ch / 2 + j, w - 2 * j, Math.max(1, ch * 0.08));
        x.fillStyle = 'rgba(52,40,26,0.1)';
        x.fillRect(ox - w / 2 + j, oy + ch * 0.32, w - 2 * j, ch * 0.18 - j);
        mottle(x, ox, oy, pts, w / 2, ch / 2, rnd, 0.9);
        hx.fillStyle = grey(lift);
        fillShape(hx, ox, oy, pts);
      }
      px += w;
    }
    y += ch;
  });
  specks(x, size, rnd, size * 40, 0.08);
  specks(hx, size, r2, size * 24, 0.12);
  weather(x, size, rnd, { streaks: 12, damp: 2, moss: 2 });
  return { c, h: hc, tile, relief: 0.9 };
}

// Irregular flagstones: the Voronoi cells of jittered points, each clipped from its neighbours' half-planes (with
// the wrapped copies, so it tiles), shrunk towards its centre to leave a joint, drawn as a smooth polygon.
function clipHalf(poly, px, py, nx, ny, d) {
  // keep the side where (x, y) . n <= d
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
export function crazy({ palette, joint, tile = 3.2, cells = 6, seed = 51 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = joint;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.2);
  hx.fillRect(0, 0, size, size);
  const cs = size / cells;
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.1 + rnd() * 0.8) * cs, (j + 0.1 + rnd() * 0.8) * cs]);
  const others = [];
  pts.forEach((q) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) others.push([q[0] + dx, q[1] + dy]); });
  const gap = size * 0.006;
  pts.forEach(([px, py]) => {
    let poly = [[px - cs * 2, py - cs * 2], [px + cs * 2, py - cs * 2], [px + cs * 2, py + cs * 2], [px - cs * 2, py + cs * 2]];
    for (const [ox, oy] of others) {
      const dx = ox - px, dy = oy - py, l = Math.hypot(dx, dy);
      if (l < 1e-6 || l > cs * 3) continue;
      const nx = dx / l, ny = dy / l;
      poly = clipHalf(poly, px, py, nx, ny, (px * nx + py * ny) + l / 2 - gap);
      if (!poly.length) break;
    }
    if (poly.length < 3) return;
    // round the corners a little: each corner cut back towards its neighbours
    const soft = [];
    poly.forEach((v, i) => {
      const a = poly[(i + poly.length - 1) % poly.length], b = poly[(i + 1) % poly.length];
      soft.push([v[0] + (a[0] - v[0]) * 0.12, v[1] + (a[1] - v[1]) * 0.12], [v[0] + (b[0] - v[0]) * 0.12, v[1] + (b[1] - v[1]) * 0.12]);
    });
    const colour = shade(palette[Math.floor(rnd() * palette.length)], (rnd() - 0.5) * 0.1);
    const lift = 0.7 + (r2() - 0.5) * 0.25;
    const ext = soft.reduce((m, [vx, vy]) => Math.max(m, Math.abs(vx - px), Math.abs(vy - py)), 1);
    const sh = soft.map(([vx, vy]) => [vx - px, vy - py]);
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      if (px + dx + ext < 0 || px + dx - ext > size || py + dy + ext < 0 || py + dy - ext > size) continue;
      x.fillStyle = colour;
      fillShape(x, px + dx, py + dy, sh);
      mottle(x, px + dx, py + dy, sh, ext, ext, rnd, 1.2);
      hx.fillStyle = grey(lift);
      fillShape(hx, px + dx, py + dy, sh);
    }
  });
  specks(x, size, rnd, size * 30, 0.1);
  specks(hx, size, r2, size * 20, 0.1);
  // moss and dirt in the joints, damp patches and the odd stain
  weather(x, size, rnd, { damp: 6, moss: 26 });
  return { c, h: hc, tile, relief: 0.8 };
}

// Rectangular slabs in a running bond (sawn grey slabs; blue-grey flagstones indoors).
export function slabs({ base, joint, tile = 2.4, rows = 4, cols = 3, jitter = 0.08, seed = 61 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = joint;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.25);
  hx.fillRect(0, 0, size, size);
  const rh = size / rows, j = Math.max(1, size * 0.006);
  for (let r = 0; r < rows; r++) {
    let px = (r % 2) * (size / cols) * 0.5;
    while (px < size + size / cols) {
      const w = (size / cols) * (1 + (rnd() - 0.5) * 0.4);
      const colour = shade(base, (rnd() - 0.5) * jitter * 2);
      for (const dx of [-size, 0]) {
        x.fillStyle = colour;
        x.fillRect(px + dx + j, r * rh + j, w - 2 * j, rh - 2 * j);
        hx.fillStyle = grey(0.75 + (r2() - 0.5) * 0.1);
        hx.fillRect(px + dx + j, r * rh + j, w - 2 * j, rh - 2 * j);
      }
      px += w;
    }
  }
  specks(x, size, rnd, size * 26, 0.09);
  specks(hx, size, r2, size * 14, 0.1);
  return { c, h: hc, tile, relief: 0.6 };
}

// Coppi: rows of half-round terracotta tiles running down the roof, each mottled its own way, some with lichen.
export function coppi({ palette, lichen = '#9b9a7c', tile = 1.6, cols = 8, rows = 4, seed = 5 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = '#5a2e1c';
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.1);
  hx.fillRect(0, 0, size, size);
  const w = size / cols, h = size / rows;
  for (let k = 0; k < cols; k++) {
    const capRow = k % 2 === 0;   // alternate columns: the convex caps and the channels under them
    for (let r = 0; r < rows; r++) {
      const base = palette[Math.floor(rnd() * palette.length)];
      const t = (rnd() - 0.5) * 0.18;
      const y0 = r * h + (k % 2) * h * 0.5;
      for (const dy of [-size, 0, size]) {
        const g = x.createLinearGradient(k * w, 0, (k + 1) * w, 0);
        g.addColorStop(0, shade(base, t - (capRow ? 0.14 : 0.2)));
        g.addColorStop(0.42, shade(base, t + (capRow ? 0.08 : -0.02)));
        g.addColorStop(1, shade(base, t - (capRow ? 0.2 : 0.24)));
        x.fillStyle = g;
        x.fillRect(k * w + 0.5, y0 + dy, w - 1, h - 1);
        // each tile overlaps the one below: a darker lip at its lower end
        x.fillStyle = 'rgba(30,14,6,0.35)';
        x.fillRect(k * w + 0.5, y0 + dy + h - Math.max(1.5, h * 0.06), w - 1, Math.max(1.5, h * 0.06));
        const hg = hx.createLinearGradient(k * w, 0, (k + 1) * w, 0);
        const top = capRow ? 0.95 : 0.55;
        hg.addColorStop(0, grey(top - 0.45));
        hg.addColorStop(0.5, grey(top));
        hg.addColorStop(1, grey(top - 0.45));
        hx.fillStyle = hg;
        hx.fillRect(k * w + 0.5, y0 + dy, w - 1, h - 1);
      }
      if (rnd() < 0.3) {
        x.fillStyle = `${lichen}66`;
        x.beginPath();
        x.ellipse(k * w + w * (0.3 + rnd() * 0.4), y0 + h * rnd(), w * (0.15 + rnd() * 0.2), h * (0.1 + rnd() * 0.15), 0, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  specks(x, size, rnd, size * 24, 0.1);
  return { c, h: hc, tile, relief: 1.3 };
}

export function brick({ base = '#a5583a', mortar = '#cfc6b8', tile = 1.2, seed = 21 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  const rows = 16, h = size / rows, w = h * 3.05;
  x.fillStyle = mortar;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.22);
  hx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0;
    for (let b = -1; b < size / w + 1; b++) {
      x.fillStyle = shade(base, (rnd() - 0.5) * 0.14);
      x.fillRect(b * w + off + 1.2, r * h + 1.2, w - 2.4, h - 2.4);
      hx.fillStyle = grey(0.78 + (r2() - 0.5) * 0.12);
      hx.fillRect(b * w + off + 1.2, r * h + 1.2, w - 2.4, h - 2.4);
    }
  }
  specks(x, size, rnd, size * 20, 0.08);
  return { c, h: hc, tile, relief: 0.55 };
}

// Square floor tiles (cotto), slightly uneven.
export function squares({ base, joint, tile = 1.2, n = 4, jitter = 0.1, seed = 9 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  const w = size / n, j = Math.max(1, size * 0.006);
  x.fillStyle = joint;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.3);
  hx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    x.fillStyle = shade(base, (rnd() - 0.5) * jitter * 2);
    x.fillRect(i * w + j, k * w + j, w - 2 * j, w - 2 * j);
    hx.fillStyle = grey(0.75 + (r2() - 0.5) * 0.12);
    hx.fillRect(i * w + j, k * w + j, w - 2 * j, w - 2 * j);
  }
  specks(x, size, rnd, size * 24, 0.08);
  return { c, h: hc, tile, relief: 0.5 };
}

// Boards with grain (timber, floorboards, shutters, doors).
// joints: false for furniture whose slats are real geometry (a board pattern on each slat read as a grid)
export function planks({ base, boardW = 0.16, tile = 1.6, grain = 0.5, seed = 7, joints = true } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  const n = Math.max(2, Math.round(tile / boardW)), bw = size / n;
  hx.fillStyle = grey(0.2);
  hx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const colour = shade(base, (rnd() - 0.5) * 0.1);
    x.fillStyle = colour;
    x.fillRect(i * bw, 0, bw, size);
    for (let g = 0; g < 14; g++) {
      x.strokeStyle = `rgba(${rnd() < 0.5 ? '20,10,4' : '255,240,220'},${0.05 + 0.08 * rnd() * grain})`;
      x.lineWidth = 0.6 + rnd() * 1.2;
      const gx = i * bw + rnd() * bw;
      x.beginPath();
      x.moveTo(gx, 0);
      x.bezierCurveTo(gx + (rnd() - 0.5) * bw * 0.4, size * 0.33, gx + (rnd() - 0.5) * bw * 0.4, size * 0.66, gx, size);
      x.stroke();
    }
    if (joints) {
      x.fillStyle = 'rgba(15,8,3,0.5)';
      x.fillRect(i * bw, 0, Math.max(1, size * 0.004), size);
    }
    hx.fillStyle = grey(0.75 + (r2() - 0.5) * 0.1);
    hx.fillRect(i * bw + Math.max(1, size * 0.004), 0, bw - Math.max(1, size * 0.004), size);
  }
  specks(x, size, rnd, size * 10, 0.06);
  return { c, h: hc, tile, relief: 0.5 };
}

// A plain surface with grain: plaster, sandstone, pietra serena, iron, steel, soot, firebrick.
export function grain({ base, tile = 1.5, amount = 30, alpha = 0.12, light = 0.5, mottle = 0.05, seed = 71 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed), r2 = seeded(seed + 100);
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const r = size * (0.05 + rnd() * 0.15);
    const px = rnd() * size, py = rnd() * size;
    wrapped(size, px, py, r, (ox, oy) => {
      const g = x.createRadialGradient(ox, oy, 0, ox, oy, r);
      const v = rnd() < 0.5 ? '255,250,240' : '40,30,20';
      g.addColorStop(0, `rgba(${v},${mottle})`);
      g.addColorStop(1, `rgba(${v},0)`);
      x.fillStyle = g;
      x.fillRect(ox - r, oy - r, 2 * r, 2 * r);
    });
  }
  specks(x, size, rnd, size * amount, alpha, light);
  hx.fillStyle = grey(0.5);
  hx.fillRect(0, 0, size, size);
  specks(hx, size, r2, size * amount, 0.3);
  return { c, h: hc, tile, relief: 0.35 };
}

// Woven cloth: sling mesh, canvas, linen, rush seats.
export function weave({ base, tile = 0.3, threads = 24, contrast = 0.12, seed = 81 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed);
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  hx.fillStyle = grey(0.5);
  hx.fillRect(0, 0, size, size);
  const t = size / threads;
  for (let i = 0; i < threads; i++) for (let j = 0; j < threads; j++) {
    const over = (i + j) % 2 === 0;
    x.fillStyle = shade(base, (over ? contrast : -contrast) * (0.7 + 0.6 * rnd()));
    x.fillRect(i * t + 0.5, j * t + 0.5, t - 1, t - 1);
    hx.fillStyle = grey(over ? 0.8 : 0.35);
    hx.fillRect(i * t + 0.5, j * t + 0.5, t - 1, t - 1);
  }
  return { c, h: hc, tile, relief: 0.6 };
}

// Bedspread patterns: Santarsa's quilted stripes and Vallorsaia's checks.
export function stripes({ colours, tile = 1.2, seed = 91 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const [hc, hx] = canvas();
  const rnd = seeded(seed);
  let y = 0;
  while (y < size) {
    const h = size * (0.04 + rnd() * 0.08);
    x.fillStyle = colours[Math.floor(rnd() * colours.length)];
    x.fillRect(0, y, size, h + 1);
    y += h;
  }
  // quilting: soft diamond stitching
  hx.fillStyle = grey(0.7);
  hx.fillRect(0, 0, size, size);
  hx.strokeStyle = grey(0.35);
  hx.lineWidth = Math.max(1, size / 200);
  for (let i = -size; i < size * 2; i += size / 8) {
    hx.beginPath(); hx.moveTo(i, 0); hx.lineTo(i + size, size); hx.stroke();
    hx.beginPath(); hx.moveTo(i, size); hx.lineTo(i + size, 0); hx.stroke();
  }
  specks(x, size, rnd, size * 10, 0.05);
  return { c, h: hc, tile, relief: 0.6 };
}

export function check({ colours, tile = 0.6, n = 6, seed = 93 } = {}) {
  const size = SIZE;
  const [c, x] = canvas();
  const rnd = seeded(seed);
  const w = size / n;
  x.fillStyle = colours[2] || '#ece4d2';
  x.fillRect(0, 0, size, size);
  x.globalAlpha = 0.65;
  for (let i = 0; i < n; i += 2) { x.fillStyle = colours[0]; x.fillRect(i * w, 0, w, size); }
  for (let j = 0; j < n; j += 2) { x.fillStyle = colours[1]; x.fillRect(0, j * w, size, w); }
  x.globalAlpha = 1;
  specks(x, size, rnd, size * 10, 0.05);
  return { c, h: null, tile, relief: 0 };
}
