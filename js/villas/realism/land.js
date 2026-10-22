// The painted ground round the villas (1.2 km square): late-May hay meadows, mown lawns that follow the houses and
// pool decks, rough open ground with broom, pale gravel, lanes and tracks, and soft contact shade under every tree
// and building (the Fast tier's only ambient occlusion). Drifts of greener and drier grass come from noise and from
// the shape of the ground (drier on the crests, greener in the hollows), not from one tone per zone.
// Clearings, lanes and water are OpenStreetMap's; the lawns and the garden edges are illustrative.
import { seeded, clamp, lerp, smoothstep } from '../util.js';

export const HALF = 600;

export const LAND = {
  floor: '#4a4a2e',     // woodland floor, under the canopy: last year's oak and chestnut leaves, moss, a little green
  meadow: '#7f9548',    // hay meadow, uncut at the end of May: grass going to seed, not lawn green
  grass: '#84974a',     // the garden's rougher grass, longer than the lawn
  fell: '#829349',      // rough open ground
  lawn: '#6c8f3d',      // mown
  water: '#4f7378',
  road: '#cfc5ae', service: '#c9bea4', track: '#b7aa8a', path: '#a99c7c',
  gravel: '#d3cab6',    // pale, almost white, as the photos show
  flagstone: '#b9b2a2', yard: '#a99f8a', woodfloor: '#45502c', rough: '#889c50',
};

// a polyline moved sideways by `off` metres (positive to its left)
function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / n) * off, p[1] + (dx / n) * off];
  });
}

function valueNoise(seed) {
  const hash = (i, j) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), tx = x - i, tz = z - j;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    return lerp(lerp(hash(i, j), hash(i + 1, j), sx), lerp(hash(i, j + 1), hash(i + 1, j + 1), sx), sz);
  };
}

// A villa garden's edge: a circle pushed in and out by noise, so the woods meet it raggedly rather than on a line.
export function gardenOutline(z, { grow = 0, steps = 40 } = {}) {
  const n = valueNoise(z.id.length * 13);
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = z.r + grow + (n(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 5) - 0.5) * 22;
    pts.push([z.c[0] + Math.sin(a) * r, z.c[1] - Math.cos(a) * r]);
  }
  return pts;
}

// Both villas look west over the valley (La Conca): keep that foreground open rather than guess at trees in it.
// A ragged fan from the garden, rough meadow fading into the woods.
export function viewFan(z) {
  const rnd = seeded(z.id.length * 31);
  const n = valueNoise(z.id.length * 7);
  const pts = [[z.c[0], z.c[1]]];
  for (let b = 220; b <= 320; b += 4) {
    const r = z.r + 50 + rnd() * 30 + (n(b / 9, 3) - 0.5) * 50 - Math.abs(b - 270) * 0.55;
    const a = (b * Math.PI) / 180;
    pts.push([z.c[0] + Math.sin(a) * r, z.c[1] - Math.cos(a) * r]);
  }
  return pts;
}

// The lawn round one building or deck: a rounded rectangle `pad` metres out, its edge wobbling a little.
function lawnAround(c, rot, length, width, pad, seed) {
  const n = valueNoise(seed);
  const pts = [];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const hl = length / 2, hw = width / 2;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    // superellipse round the rectangle
    const ex = Math.sign(dx) * Math.pow(Math.abs(dx), 0.45) * (hl + pad), ez = Math.sign(dz) * Math.pow(Math.abs(dz), 0.45) * (hw + pad);
    const k = 1 + (n(dx * 2 + 9, dz * 2 + 9) - 0.5) * 0.28;
    const lx = ex * k, lz = ez * k;
    pts.push([c[0] + lx * cs + lz * sn, c[1] - lx * sn + lz * cs]);
  }
  return pts;
}

let blobSprite = null;
function blob() {
  if (blobSprite) return blobSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(18,26,8,0.55)');
  g.addColorStop(0.55, 'rgba(18,26,8,0.3)');
  g.addColorStop(1, 'rgba(18,26,8,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  blobSprite = c;
  return c;
}

export function paintLand(model, size, { zones, trees = [], heightAt, surfaces = [] }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const k = size / (2 * HALF);
  const P = ([px, pz]) => [(px + HALF) * k, (pz + HALF) * k];
  const path = (pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p)))); x.closePath(); };
  const rnd = seeded(41);
  const line0 = (pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p)))); x.stroke(); };

  // woodland floor
  x.fillStyle = LAND.floor;
  x.fillRect(0, 0, size, size);

  // open land: OSM's clearings, the gardens and the view to the west
  const open = [];
  model.clearings.forEach((cl) => open.push({ pts: cl.polygon, colour: LAND[cl.kind] || LAND.meadow }));
  zones.forEach((z) => { open.push({ pts: viewFan(z), colour: LAND.meadow, soft: true }); open.push({ pts: gardenOutline(z), colour: LAND.grass }); });
  // the view west from each garden is kept open (no trees), but its two long sides would be straight lines out from
  // the villa: it is painted small and drawn up, so its edges fade over twenty-odd metres
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sx = sc.getContext('2d');
  const sk = 128 / (2 * HALF);
  open.filter((o) => o.soft).forEach((o) => {
    sx.fillStyle = o.colour;
    sx.beginPath();
    o.pts.forEach(([px, pz], i) => (i ? sx.lineTo((px + HALF) * sk, (pz + HALF) * sk) : sx.moveTo((px + HALF) * sk, (pz + HALF) * sk)));
    sx.closePath();
    sx.fill();
  });
  x.imageSmoothingEnabled = true;
  x.drawImage(sc, 0, 0, size, size);
  open.filter((o) => !o.soft).forEach((o) => { x.fillStyle = o.colour; path(o.pts); x.fill(); });

  // drifts of greener and drier grass, from noise and from the shape of the ground, laid over the open land only
  const CV = 96, cstep = (2 * HALF) / CV, d = 14;
  const curv = new Float32Array((CV + 1) * (CV + 1));
  if (heightAt) {
    for (let j = 0; j <= CV; j++) for (let i = 0; i <= CV; i++) {
      const wx = -HALF + i * cstep, wz = -HALF + j * cstep;
      curv[j * (CV + 1) + i] = heightAt(wx, wz) - (heightAt(wx + d, wz) + heightAt(wx - d, wz) + heightAt(wx, wz + d) + heightAt(wx, wz - d)) / 4;
    }
  }
  const curvAt = (wx, wz) => {
    const fx = clamp((wx + HALF) / cstep, 0, CV - 0.001), fz = clamp((wz + HALF) / cstep, 0, CV - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, W = CV + 1;
    return lerp(lerp(curv[j * W + i], curv[j * W + i + 1], tx), lerp(curv[(j + 1) * W + i], curv[(j + 1) * W + i + 1], tx), tz);
  };
  const V = 384;
  const vc = document.createElement('canvas');
  vc.width = vc.height = V;
  const vx = vc.getContext('2d');
  const img = vx.createImageData(V, V);
  const n1 = valueNoise(3), n2 = valueNoise(8), n3 = valueNoise(21), n4 = valueNoise(34);
  const step = (2 * HALF) / V;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const wx = -HALF + (i + 0.5) * step, wz = -HALF + (j + 0.5) * step;
      const dry = clamp(0.5 + curvAt(wx, wz) * 0.35 + (n1(wx / 70, wz / 70) - 0.5) * 0.55 + (n2(wx / 23, wz / 23) - 0.5) * 0.35, 0, 1);
      const lush = n3(wx / 45, wz / 45) * 0.6 + n4(wx / 7, wz / 7) * 0.4;
      const clump = n4(wx / 2.6 + 50, wz / 2.6) - 0.5;
      // soft-light: 128 is neutral; drier is lighter and yellower, lusher is darker and greener
      const o = (j * V + i) * 4;
      img.data[o] = clamp(128 + (dry - 0.5) * 190 - (lush - 0.5) * 70 + clump * 40, 0, 255);
      img.data[o + 1] = clamp(128 + (dry - 0.5) * 120 + (lush - 0.5) * 30 + clump * 50, 0, 255);
      img.data[o + 2] = clamp(128 + (dry - 0.5) * 40 - (lush - 0.5) * 90 + clump * 20, 0, 255);
      img.data[o + 3] = 255;
    }
  }
  vx.putImageData(img, 0, 0);
  // laid over the open land only: the union of the open shapes as a mask, then soft-light
  const mc = document.createElement('canvas');
  mc.width = mc.height = size;
  const mx = mc.getContext('2d');
  mx.imageSmoothingEnabled = true;
  // destination-in with each shape would keep only the last one, so the union is built first and applied once
  const uc = document.createElement('canvas');
  uc.width = uc.height = size;
  const ux = uc.getContext('2d');
  ux.fillStyle = '#fff';
  open.forEach((o) => { ux.beginPath(); o.pts.forEach((p, i) => (i ? ux.lineTo(...P(p)) : ux.moveTo(...P(p)))); ux.closePath(); ux.fill(); });
  mx.drawImage(vc, 0, 0, size, size);
  mx.globalCompositeOperation = 'destination-in';
  mx.drawImage(uc, 0, 0);
  x.globalCompositeOperation = 'soft-light';
  x.drawImage(mc, 0, 0);
  x.globalCompositeOperation = 'source-over';
  // late-May meadow flowers and broom on the rough ground: specks that give the grass sparkle close up (under the
  // canopy they are never seen; the lanes are painted over them)
  const specks = size * size * 0.012;
  const flowers = ['rgba(246,242,226,A)', 'rgba(236,206,74,A)', 'rgba(205,60,44,A)', 'rgba(196,170,214,A)', 'rgba(110,135,55,A)'];
  for (let i = 0; i < specks; i++) {
    const f = flowers[Math.floor(rnd() * flowers.length)];
    x.fillStyle = f.replace('A', (0.18 + rnd() * 0.3).toFixed(2));
    const s = 0.6 + rnd() * 1.1;
    x.fillRect(rnd() * size, rnd() * size, s, s);
  }

  // mown lawns that follow the houses and the pool decks (illustrative)
  const lawn = [];
  model.villas.forEach((v) => v.blocks.forEach((b) => lawn.push(lawnAround(b.c, b.rot, b.length, b.width, 11, b.id.length * 5 + 1))));
  model.pools.forEach((p) => lawn.push(lawnAround(p.c, p.rot, p.length + 6, p.width + 6, 8, p.id.length * 3 + 2)));
  x.globalAlpha = 0.85;
  x.fillStyle = LAND.lawn;
  lawn.forEach((pts) => { path(pts); x.fill(); });
  x.globalAlpha = 1;
  // mower stripes, very faint
  x.save();
  x.beginPath();
  lawn.forEach((pts) => pts.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p)))));
  x.clip('nonzero');
  for (let i = -size; i < size * 2; i += Math.max(2, 4 * k)) {
    x.strokeStyle = (Math.floor(i / Math.max(2, 4 * k)) % 2) ? 'rgba(255,250,210,0.09)' : 'rgba(40,62,20,0.09)';
    x.lineWidth = Math.max(1, 2 * k);
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + size * 0.4, size);
    x.stroke();
  }
  x.restore();

  // where feet go: paler, thinner grass on the short ways between each villa's buildings and its pool (illustrative)
  x.save();
  x.lineCap = 'round';
  x.lineJoin = 'round';
  model.villas.forEach((v) => {
    const spots = [...v.blocks.map((b) => b.c), ...model.pools.filter((pl) => pl.villa === v.id).map((pl) => pl.c), ...model.outbuildings.filter((o) => o.villa === v.id).map((o) => o.c)];
    // a minimum spanning tree over the spots: each joined to its nearest already-joined neighbour
    const done = [spots[0]];
    const left = spots.slice(1);
    while (left.length) {
      let best = null;
      left.forEach((a, i) => done.forEach((b) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (!best || d < best.d) best = { d, i, a, b }; }));
      left.splice(best.i, 1);
      done.push(best.a);
      if (best.d > 70) continue;
      const wob = (t) => (rnd() - 0.5) * 2.4 * Math.sin(t * Math.PI);
      const pts = [];
      for (let t = 0; t <= 1.001; t += 0.125) pts.push([best.b[0] + (best.a[0] - best.b[0]) * t + wob(t), best.b[1] + (best.a[1] - best.b[1]) * t + wob(t)]);
      x.strokeStyle = 'rgba(176,160,108,0.22)';
      x.lineWidth = Math.max(1, 2.2 * k);
      line0(pts);
      x.strokeStyle = 'rgba(184,166,112,0.26)';
      x.lineWidth = Math.max(1, 0.9 * k);
      line0(pts);
    }
  });
  x.restore();

  // content's surfaces (site entries): { material: one of SURFACES, polygon, or line with width }
  surfaces.forEach((e) => {
    const colour = LAND[e.material] || LAND.meadow;
    if (e.polygon) { x.fillStyle = colour; path(e.polygon); x.fill(); }
    else if (e.line) {
      x.strokeStyle = colour;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.lineWidth = Math.max(1, (e.width ?? 2) * k);
      x.beginPath();
      e.line.forEach((q, i) => (i ? x.lineTo(...P(q)) : x.moveTo(...P(q))));
      x.stroke();
    }
  });

  model.water.forEach((w) => { if (w.polygon) { x.fillStyle = LAND.water; path(w.polygon); x.fill(); } });

  // lanes and tracks: pale gravel with softer verges
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const line = (pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p)))); x.stroke(); };
  model.roads.forEach((r) => {
    x.strokeStyle = 'rgba(120,120,70,0.35)';
    x.lineWidth = Math.max(1, (r.width + 1.6) * k);
    line(r.points);
  });
  model.roads.forEach((r) => {
    x.strokeStyle = LAND[r.kind] || LAND.path;
    x.lineWidth = Math.max(1, r.width * k);
    line(r.points);
    if (r.kind === 'track' && r.width * k >= 3) {
      // grass down the middle of the tracks
      x.strokeStyle = 'rgba(110,135,60,0.45)';
      x.lineWidth = Math.max(1, r.width * 0.28 * k);
      line(r.points);
    }
    // two wheel ruts, a little darker and browner, either side of the middle
    if (r.width >= 2.6) {
      x.strokeStyle = 'rgba(120,104,72,0.28)';
      x.lineWidth = Math.max(1, 0.45 * k);
      for (const off of [-0.72, 0.72]) line(offsetLine(r.points, off));
    }
  });
  // the verges break into the gravel: tufts of grass along both edges of every lane
  model.roads.forEach((r) => {
    const pts = r.points;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (!len) continue;
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let t = 0; t < len; t += 1.4) {
        if (rnd() < 0.45) continue;
        const side = rnd() < 0.5 ? -1 : 1;
        const off = side * (r.width / 2 - 0.1 - rnd() * 0.5);
        const cx0 = ax + (bx - ax) * (t / len) + nx * off, cz0 = az + (bz - az) * (t / len) + nz * off;
        x.fillStyle = `rgba(${96 + rnd() * 30},${118 + rnd() * 26},${52 + rnd() * 16},${0.35 + rnd() * 0.35})`;
        x.beginPath();
        x.arc(...P([cx0, cz0]), Math.max(0.6, (0.25 + rnd() * 0.5) * k), 0, Math.PI * 2);
        x.fill();
      }
    }
  });

  // pale gravel round the buildings: a narrow band at the wall, and beyond it a ragged edge where the grass grows
  // into it, in drifts rather than a neat outline
  x.save();
  [...model.villas.flatMap((v) => v.blocks), ...model.outbuildings].forEach((b) => {
    x.save();
    x.translate(...P(b.c));
    x.rotate(-b.rot);
    x.fillStyle = LAND.gravel;
    x.beginPath();
    x.roundRect((-b.length / 2 - 1.3) * k, (-b.width / 2 - 1.3) * k, (b.length + 2.6) * k, (b.width + 2.6) * k, 0.8 * k);
    x.fill();
    const per = 2 * (b.length + b.width);
    for (let t = 0; t < per; t += 0.9) {
      if (rnd() < 0.3) continue;
      // a point on the rectangle's outline, pushed out by a random margin
      let px, pz;
      const L2 = b.length, W2 = b.width;
      if (t < L2) { px = -L2 / 2 + t; pz = -W2 / 2; } else if (t < L2 + W2) { px = L2 / 2; pz = -W2 / 2 + (t - L2); } else if (t < 2 * L2 + W2) { px = L2 / 2 - (t - L2 - W2); pz = W2 / 2; } else { px = -L2 / 2; pz = W2 / 2 - (t - 2 * L2 - W2); }
      const out = 1.6 + rnd() * 1.4;
      const ox = Math.sign(px) * (Math.abs(px) >= L2 / 2 - 0.01 ? out : 0), oz = Math.sign(pz) * (Math.abs(pz) >= W2 / 2 - 0.01 ? out : 0);
      x.fillStyle = `rgba(${200 + rnd() * 14},${190 + rnd() * 12},${168 + rnd() * 12},${0.55 + rnd() * 0.4})`;
      x.beginPath();
      x.arc((px + ox) * k, (pz + oz) * k, (0.7 + rnd() * 0.9) * k, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  });
  x.restore();

  // contact shade: soft and dark under each tree in the open, and hugging each building's foot
  const sprite = blob();
  trees.forEach((t) => {
    if (t.shade >= 0.88) return;
    const r = t.h * 0.3 * t.w * k;
    x.globalAlpha = 0.75;
    x.drawImage(sprite, (t.x + HALF) * k - r, (t.z + HALF) * k - r, 2 * r, 2 * r);
  });
  x.globalAlpha = 1;
  x.save();
  x.shadowColor = 'rgba(20,24,10,0.5)';
  x.shadowBlur = Math.max(2, 2.2 * k);
  x.fillStyle = 'rgba(20,24,10,0.25)';
  [...model.villas.flatMap((v) => v.blocks), ...model.outbuildings].forEach((b) => {
    x.save();
    x.translate(...P(b.c));
    x.rotate(-b.rot);
    x.fillRect((-b.length / 2 - 0.4) * k, (-b.width / 2 - 0.4) * k, (b.length + 0.8) * k, (b.width + 0.8) * k);
    x.restore();
  });
  x.restore();
  return c;
}

// Where the woods are, 0 to 1, on a 2 m grid: everything that is not a clearing, a lane, water, a garden or the view.
export function forestMask(model, zones, n = 600) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  const k = n / (2 * HALF);
  const P = ([px, pz]) => [(px + HALF) * k, (pz + HALF) * k];
  x.fillStyle = '#fff';
  x.fillRect(0, 0, n, n);
  x.fillStyle = '#000';
  x.strokeStyle = '#000';
  const poly = (pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p)))); x.closePath(); x.fill(); };
  model.clearings.forEach((cl) => poly(cl.polygon));
  model.water.forEach((w) => w.polygon && poly(w.polygon));
  x.lineCap = 'round';
  model.roads.forEach((r) => {
    x.lineWidth = (r.width + 5) * k;
    x.beginPath();
    r.points.forEach((p, i) => (i ? x.lineTo(...P(p)) : x.moveTo(...P(p))));
    x.stroke();
  });
  zones.forEach((z) => { poly(gardenOutline(z)); poly(viewFan(z)); });
  const data = x.getImageData(0, 0, n, n).data;
  let m = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) m[i] = data[i * 4] / 255;
  m = blur(blur(m, n, 5), n, 4);
  const at = (px, pz) => {
    const fx = clamp((px + HALF) * k - 0.5, 0, n - 1.001), fz = clamp((pz + HALF) * k - 0.5, 0, n - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = m[j * n + i], b = m[j * n + i + 1], cc = m[(j + 1) * n + i], dd = m[(j + 1) * n + i + 1];
    return lerp(lerp(a, b, tx), lerp(cc, dd, tx), tz);
  };
  return (px, pz) => (Math.abs(px) > HALF - 2 || Math.abs(pz) > HALF - 2 ? 1 : at(px, pz));
}

function blur(src, n, r) {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n), w = 2 * r + 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += src[j * n + clamp(i + q, 0, n - 1)];
    tmp[j * n + i] = s / w;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += tmp[clamp(j + q, 0, n - 1) * n + i];
    out[j * n + i] = s / w;
  }
  return out;
}

export { smoothstep };
