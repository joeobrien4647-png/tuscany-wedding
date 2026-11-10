// The invitation's light: gold dust when a seal cracks, and the fireworks run. Ported from the first-minute prototype.
// Draws on the canvas the minute hands it with attach(canvas); before that, and with reduced motion, it draws nothing.
(function (root) {
  'use strict';
  let c = null, g = null, W = 0, H = 0, parts = [], raf = 0, last = 0, listening = false, timers = [];
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const boom = () => { const s = root.sjFirst && root.sjFirst.sound; if (s) s.boom(); };

  function size() {
    if (!c) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // Stops everything: rockets still waiting to launch, the frame loop and every spark, and clears the canvas.
  function stop() {
    timers.forEach(t => root.clearTimeout(t)); timers = [];
    if (raf) { root.cancelAnimationFrame(raf); raf = 0; }
    last = 0; parts = [];
    if (g) g.clearRect(0, 0, W, H);
  }
  function attach(canvas) {
    const ok = canvas && canvas.getContext && canvas.getContext('2d');
    stop();
    c = ok ? canvas : null; g = ok || null;
    if (!c) return;
    if (!listening) { root.addEventListener('resize', size); listening = true; }
    size();
  }
  function add(p) { if (!c) return; parts.push(p); if (!raf) raf = root.requestAnimationFrame(loop); }
  function loop(now) {
    const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1; last = now;
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const dr = Math.pow(p.drag, dt);
      p.vx *= dr; p.vy = p.vy * dr + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.rocket) {
        if (p.y <= p.ty || p.vy > -0.6) { parts.splice(i, 1); burst(p.x, p.y, p.h); boom(); continue; }
        if (Math.random() < 0.7) add({ x: p.x, y: p.y + 4, vx: (Math.random() - 0.5) * 0.7, vy: Math.random() * 0.9, drag: 0.92, grav: 0.03, life: 0.7, decay: 0.035, r: 1.3, h: 38, s: 90, l: 72, trail: 1 });
      }
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const a = p.life < 0.35 ? p.life / 0.35 : 1;
      const tw = p.twinkle ? 0.5 + 0.5 * Math.sin(now / 38 + p.seed) : 1;
      g.strokeStyle = 'hsla(' + p.h + ',' + p.s + '%,' + p.l + '%,' + (a * tw).toFixed(3) + ')';
      g.lineWidth = p.r;
      g.beginPath(); g.moveTo(p.x - p.vx * p.trail, p.y - p.vy * p.trail); g.lineTo(p.x + 0.01, p.y + 0.01); g.stroke();
    }
    if (parts.length) raf = root.requestAnimationFrame(loop); else { raf = 0; last = 0; g.clearRect(0, 0, W, H); }
  }
  function dust(x, y) {
    if (reduced()) return;
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.4 + Math.random() * 6;
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, drag: 0.94, grav: 0.07, life: 1, decay: 0.011 + Math.random() * 0.018, r: 1 + Math.random() * 2.3, h: 36 + Math.random() * 14, s: 85, l: 62 + Math.random() * 22, trail: 1.3, twinkle: true, seed: Math.random() * 99 });
    }
  }
  function burst(x, y, hue) {
    if (reduced()) return;
    const n = 110, base = 3.5 + Math.random() * 1.8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.09, sp = base * (0.72 + Math.random() * 0.38);
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.964, grav: 0.045, life: 1, decay: 0.0085 + Math.random() * 0.006, r: 1.5 + Math.random() * 1.3, h: hue + Math.random() * 14 - 7, s: hue > 300 ? 70 : 88, l: 64 + Math.random() * 20, trail: 2.6, twinkle: Math.random() < 0.35, seed: Math.random() * 99 });
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * 1.5;
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.9, grav: 0.01, life: 1, decay: 0.05, r: 3.4, h: 45, s: 100, l: 92, trail: 0.5 });
    }
  }
  function show() {
    stop();
    if (reduced() || !c) return;
    const plan = [[0.3, 0.24, 40], [0.72, 0.18, 28], [0.5, 0.33, 48], [0.2, 0.4, 350], [0.8, 0.38, 42]];
    plan.forEach((p, i) => timers.push(root.setTimeout(() => {
      add({ rocket: true, x: W * p[0], y: H + 8, ty: H * p[1], vx: (Math.random() - 0.5) * 0.6, vy: -(13 + H * 0.012), drag: 0.995, grav: 0.3, life: 9, decay: 0, r: 2.4, h: p[2], s: 90, l: 80, trail: 1.6 });
    }, i * 200)));
  }

  const api = { fx: { attach, dust, burst, show, stop } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
