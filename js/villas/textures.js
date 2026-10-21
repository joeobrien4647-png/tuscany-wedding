// Procedural textures, after mill-lane-home's painters: every surface is drawn on a canvas, no images.
// Each painter returns a CanvasTexture that repeats; `tile` is how many metres one repeat covers.
import * as THREE from './vendor/three-core.js';
import { seeded } from './util.js';
import { rubble, coppi, crazy, setPainterSize } from './realism/painters.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

export function toTexture(c, { srgb = true, repeat = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

function speckle(x, size, rnd, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    x.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    x.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Rubble stone walls, as in La Conca's photographs: Santarsa's warm grey-beige with honey and rust stones in loose
// courses and lime mortar (realism/painters.js; the colours are villa-detail.md's, by eye). One repeat is 2.2 m.
export function stone({ size = 512 } = {}) {
  setPainterSize(size);
  const out = rubble({ palette: ['#a69a86', '#b8955f', '#9c6b45', '#8e8b83', '#a89c88', '#b3a58e', '#a69a86'], mortar: '#d4cab6', tile: 2.2, seed: 31 });
  return toTexture(out.c);
}

// Coppi: half-round terracotta tiles running down the roof, mottled tile by tile (orange, brick red, weathered
// brown, a little lichen). One repeat is 2 m each way on v1's roofs.
export function roofTiles({ size = 256 } = {}) {
  setPainterSize(size);
  return toTexture(coppi({ palette: ['#b85e3c', '#9f4a33', '#c87a4a', '#7d6352', '#b06a45'], cols: 10, rows: 5 }).c);
}

// Cotto floor tiles, square and slightly uneven.
export function cotto({ size = 256, base = '#b8704c' } = {}) {
  const [c, x] = canvas(size);
  const rnd = seeded(9);
  const n = 8, w = size / n;
  x.fillStyle = '#8a6a55';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = shade(base, (rnd() - 0.5) * 0.1);
    x.fillRect(i * w + 1, j * w + 1, w - 2, w - 2);
  }
  speckle(x, size, rnd, 3000, 0.08);
  return toTexture(c);
}

// Irregular flagstones round the pools, as at Santarsa (pale grey-beige slabs, grey joints). One repeat is 3 m.
export function paving({ size = 256 } = {}) {
  setPainterSize(size);
  return toTexture(crazy({ palette: ['#cfc7b6', '#c8bfae', '#bdb4a3', '#d4ccbb'], joint: '#8e877b', tile: 3, cells: 6 }).c);
}

// Fine grain multiplied over the ground close up (grass blades, gravel).
export function groundDetail({ size = 256 } = {}) {
  const [c, x] = canvas(size);
  const rnd = seeded(17);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) {
    const v = 90 + rnd() * 90;
    x.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    x.lineWidth = 1;
    const px = rnd() * size, py = rnd() * size;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + (rnd() - 0.5) * 3, py - 2 - rnd() * 4);
    x.stroke();
  }
  return toTexture(c, { srgb: false });
}

// Crowns seen from above, for the woodland canopy: overlapping round crowns, lit from one side.
export function canopy({ size = 256 } = {}) {
  const [c, x] = canvas(size);
  const rnd = seeded(23);
  x.fillStyle = '#5a5a5a';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const px = rnd() * size, py = rnd() * size, r = size * (0.05 + rnd() * 0.06);
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const g = x.createRadialGradient(px + ox - r * 0.3, py + oy - r * 0.3, r * 0.1, px + ox, py + oy, r);
      const v = 150 + rnd() * 60;
      g.addColorStop(0, `rgb(${v},${v},${v})`);
      g.addColorStop(0.7, `rgb(${v * 0.62},${v * 0.62},${v * 0.62})`);
      g.addColorStop(1, 'rgba(40,40,40,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(px + ox, py + oy, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  return toTexture(c, { srgb: false });
}

// Board shutters in dark walnut, as the photos show (no green louvred persiane anywhere): three or four vertical
// boards held by two battens, on one leaf of the shutter.
export function shutter({ size = 64 } = {}) {
  const [c, x] = canvas(size);
  const rnd = seeded(19);
  const boards = 4, w = size / boards;
  for (let i = 0; i < boards; i++) {
    x.fillStyle = shade('#4a3423', (rnd() - 0.5) * 0.06);
    x.fillRect(i * w, 0, w, size);
    for (let g = 0; g < 5; g++) {
      x.strokeStyle = `rgba(${rnd() < 0.5 ? '20,10,4' : '120,90,60'},${0.12 + 0.12 * rnd()})`;
      x.lineWidth = 0.8;
      const gx = i * w + rnd() * w;
      x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx + (rnd() - 0.5) * 2, size); x.stroke();
    }
    x.fillStyle = 'rgba(12,6,2,0.6)';
    x.fillRect(i * w, 0, 1, size);
  }
  for (const y of [0.18, 0.76]) {
    x.fillStyle = shade('#5a3e28', -0.02);
    x.fillRect(0, size * y, size, size * 0.08);
    x.fillStyle = 'rgba(12,6,2,0.45)';
    x.fillRect(0, size * (y + 0.08), size, 1);
  }
  x.strokeStyle = 'rgba(12,6,2,0.6)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, size - 2, size - 2);
  return toTexture(c, { repeat: false });
}

// Leaf clusters seen from above, for the woodland canopy's close-up detail: overlapping soft clumps, lit from above,
// as a grey height (r) that the canopy shader uses for both its shading and, through foliageNormal, its relief.
export function foliage({ size = 256 } = {}) {
  const [c, x] = canvas(size);
  const rnd = seeded(61);
  x.fillStyle = '#3a3a3a';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const px = rnd() * size, py = rnd() * size, r = size * (0.018 + rnd() * 0.035);
    const v = 110 + rnd() * 120;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const cx = px + ox, cy = py + oy;
      if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
      const g = x.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      g.addColorStop(0, `rgb(${v},${v},${v})`);
      g.addColorStop(0.75, `rgba(${v * 0.6},${v * 0.6},${v * 0.6},0.9)`);
      g.addColorStop(1, 'rgba(40,40,40,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  return c;
}

// Height canvas -> tangent-space normal map (Sobel, wrapping), after mill-lane-home's normalFromHeight.
export function normalFromHeight(hc, strength = 2, size = hc.width) {
  const [c, x] = canvas(size);
  x.drawImage(hc, 0, 0, size, size);
  const img = x.getImageData(0, 0, size, size);
  const d = img.data;
  const H = new Float32Array(size * size);
  for (let i = 0; i < H.length; i++) H[i] = d[i * 4] / 255;
  const at = (px, py) => H[((py + size) % size) * size + ((px + size) % size)];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = at(px + 1, py - 1) + 2 * at(px + 1, py) + at(px + 1, py + 1) - at(px - 1, py - 1) - 2 * at(px - 1, py) - at(px - 1, py + 1);
      const dy = at(px - 1, py + 1) + 2 * at(px, py + 1) + at(px + 1, py + 1) - at(px - 1, py - 1) - 2 * at(px, py - 1) - at(px + 1, py - 1);
      const nx = -dx * strength, ny = dy * strength;
      const l = 1 / Math.hypot(nx, ny, 1);
      const i = (py * size + px) * 4;
      d[i] = (nx * l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * l * 0.5 + 0.5) * 255;
      d[i + 2] = (l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
