(function (root) {
  'use strict';
  // The book shows only when switched on in index.html, or forced with ?book=1 (?book=0 forces it off).
  function shouldShowBook({ search, enabled }) {
    const forced = new URLSearchParams(search || '').get('book');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return !!enabled;
  }
  // Joe's copy rules for every line the book shows.
  const SENTIMENTAL = /\bour story\b|\blove story\b|\bshe said yes\b|\bhappily ever after\b|\bsoul ?mates?\b|\bfairy ?tale\b|\bmeant to be\b|\btrue love\b/i;
  function copyProblems(text) {
    const s = String(text || ''), problems = [];
    if (s.includes(String.fromCharCode(0x2014))) problems.push('em dash');
    if (s.includes(String.fromCharCode(0xb7))) problems.push('middle dot');
    if (/\.\s*$/.test(s)) problems.push('trailing full stop');
    if (SENTIMENTAL.test(s)) problems.push('sentimental');
    return problems;
  }
  // One page turn at a time, never past either end.
  function nextIndex(current, dir, count, busy) {
    if (busy) return null;
    const n = current + dir;
    return n < 0 || n >= count ? null : n;
  }
  // Tilt target from the phone (gamma, beta in degrees) or the mouse (x, y from -1 to 1). No data means flat.
  const clamp = v => Math.max(-1, Math.min(1, v)) || 0;
  function tiltFrom(input) {
    if (!input) return { x: 0, y: 0 };
    if ('gamma' in input || 'beta' in input) {
      if (input.gamma == null) return { x: 0, y: 0 };
      return { x: clamp(input.gamma / 25), y: input.beta == null ? 0 : clamp((input.beta - 45) / 25) };
    }
    return { x: clamp(input.x == null ? 0 : input.x), y: clamp(input.y == null ? 0 : input.y) };
  }
  function motionAllowed(win) {
    return !(win && typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Placeholder words the book shows outside the scenes. Joe writes the final lines.
  const WORDS = {
    names: 'Sophie & Joe', year: 'Tuscany 2027', seal: 'S J', tapToOpen: 'Tap to open', openLabel: 'Open the invitation',
    hint: 'Tap things in the scene', skip: 'Skip the book', prev: 'Previous page', next: 'Next page', announce: 'Page {n} of {total}',
    acts: { drive: 'Drive the car', fire: 'Light the oven', lights: 'Twinkle the lights', petals: 'Throw the petals', splash: 'Splash the pool' }
  };
  const NO_SOUND = { start() {}, stop() {}, toggle() { return false; }, isOn() { return false; }, pop() {}, whoosh() {}, chime() {}, boom() {} };
  const FLOOR_LEFT = -30, FLOOR_W = 160;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const isLight = hex => { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };

  function markup() {
    return `<div class="sb-book">
  <a class="sb-skip" href="#card">${esc(WORDS.skip)}</a>
  <section class="sb-page sb-sr" aria-labelledby="sb-heading"><h2 id="sb-heading" tabindex="-1"></h2><p class="sb-live" aria-live="polite"></p></section>
  <div class="sb-card"><div class="sb-world"><div class="sb-wall"><div class="sb-face sb-front sb-paper"></div><div class="sb-face sb-back sb-paper"></div></div><div class="sb-floor"><div class="sb-ground sb-paper" aria-hidden="true"></div></div></div></div>
  <div class="sb-fore l hide" aria-hidden="true"></div><div class="sb-fore r hide" aria-hidden="true"></div>
  <div class="sb-caption hide" aria-hidden="true"><div class="sb-kicker"></div><div class="sb-title"></div></div>
  <div class="sb-hinttext" aria-hidden="true">${esc(WORDS.hint)}</div>
  <div class="sb-nav"><button type="button" class="sb-prev" aria-label="${esc(WORDS.prev)}">&#8249;</button><span class="sb-label" aria-hidden="true"></span><button type="button" class="sb-next" aria-label="${esc(WORDS.next)}">&#8250;</button></div>
  <div class="sb-fx" aria-hidden="true"></div>
  <div class="sb-spill" aria-hidden="true"></div>
  <div class="sb-cover" role="button" tabindex="0" aria-label="${esc(WORDS.openLabel)}">
    <div class="sb-cf" aria-hidden="true">
      <div class="sb-cover-for"></div>
      <svg class="sb-flourish" viewBox="0 0 150 26"><path d="M2 13 C30 13 40 2 58 8 C66 11 66 18 60 18 C54 18 56 10 64 9 L75 9 L86 9 C94 10 96 18 90 18 C84 18 84 11 92 8 C110 2 120 13 148 13" stroke="#e3b660" stroke-width="1.4" fill="none"/><circle cx="75" cy="9" r="2.4" fill="#e3b660"/></svg>
      <div class="sb-cover-names sb-foil">${esc(WORDS.names)}</div>
      <div class="sb-cover-small sb-foil">${esc(WORDS.year)}</div>
      <div class="sb-seal">${esc(WORDS.seal)}</div>
      <div class="sb-tapopen">${esc(WORDS.tapToOpen)}</div>
    </div>
    <div class="sb-ci"></div>
  </div>
</div>
<canvas class="sb-dust" aria-hidden="true"></canvas>`;
  }

  function createBook(doc, { scenes, art, walls, grounds, stars = () => '', sound, win }) {
    const W = win || doc.defaultView, root = doc.getElementById('storybook'), sfx = sound || NO_SOUND;
    root.insertAdjacentHTML('afterbegin', markup());
    const q = sel => root.querySelector(sel);
    const el = { book: q('.sb-book'), card: q('.sb-card'), world: q('.sb-world'), wall: q('.sb-wall'), wallFront: q('.sb-front'), floor: q('.sb-floor'), ground: q('.sb-ground'),
      foreL: q('.sb-fore.l'), foreR: q('.sb-fore.r'), caption: q('.sb-caption'), kicker: q('.sb-kicker'), title: q('.sb-title'), heading: q('#sb-heading'), live: q('.sb-live'),
      hint: q('.sb-hinttext'), nav: q('.sb-nav'), prev: q('.sb-prev'), next: q('.sb-next'), label: q('.sb-label'), fx: q('.sb-fx'), spill: q('.sb-spill'), cover: q('.sb-cover'), skip: q('.sb-skip'), dust: q('.sb-dust') };
    // The sound button ships inside #storybook in index.html; it moves into the book and remembers the choice.
    const snd = root.querySelector('.sb-snd');
    if (snd) {
      el.book.appendChild(snd);
      const mark = on => { snd.classList.toggle('off', !on); snd.setAttribute('aria-pressed', String(on)); };
      mark(sfx.isOn());
      snd.addEventListener('click', e => { e.stopPropagation(); mark(sfx.toggle()); });
    }
    let index = 0, busy = false, opened = false;
    const timers = [], behind = [], moving = () => motionAllowed(W);
    const later = (ms, fn) => { timers.push(W.setTimeout(fn, ms)); };
    const clearTimers = () => timers.splice(0).forEach(t => W.clearTimeout(t));
    const raf = fn => W.requestAnimationFrame(fn);
    const pops = () => Array.from(root.querySelectorAll('.sb-pop'));

    function renderScene(i) {
      const s = scenes[i], [sx, sy, sr, sc] = s.sun;
      const sun = sr ? `<div class="sb-sun" style="left:${sx}%;top:${sy}%;width:${sr}px;height:${sr}px;background:${sc};box-shadow:0 0 ${sr}px ${sr / 2}px ${sc}88"></div>` : '';
      el.wallFront.innerHTML = `<div class="sb-sky" style="background:${s.sky}"></div>${s.stars ? stars(s.stars) : ''}${sun}${walls[s.id]()}`;
      el.ground.innerHTML = `<svg viewBox="0 0 300 200" preserveAspectRatio="none">${grounds[s.id]()}</svg>`;
      el.floor.querySelectorAll('.sb-hinge').forEach(h => h.remove());
      s.pieces.forEach((p, k) => {
        const h = doc.createElement('div');
        h.className = 'sb-hinge';
        h.style.left = ((p.x - FLOOR_LEFT) / FLOOR_W * 100) + '%';
        h.style.width = (p.w / FLOOR_W * 100) + '%';
        h.style.top = p.depth + '%';
        const cls = ['sb-pop', p.act && 'tap', p.cls, p.flat && 'flat', p.depth <= 6 && !p.flat && 'far'].filter(Boolean).join(' ');
        h.innerHTML = `${p.flat ? '' : `<div class="sb-cshadow" style="transition-delay:${k * 70}ms"></div>`}<div class="${cls}"${p.act ? ` data-act="${p.act}"` : ''} style="transition-delay:${k * 70}ms">${art[p.art](p.opts || {})}</div>`;
        el.floor.appendChild(h);
      });
      el.card.querySelectorAll('svg').forEach(v => { if (!v.closest('[data-act]')) v.setAttribute('aria-hidden', 'true'); });
      el.card.querySelectorAll('[data-act]').forEach(t => { t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0'); t.setAttribute('aria-label', WORDS.acts[t.dataset.act]); });
      el.foreL.innerHTML = el.foreR.innerHTML = art.branch({ leaf: s.fore[0], bloom: s.fore[1] });
      el.kicker.textContent = s.kicker;
      el.title.textContent = s.title;
      el.heading.textContent = s.kicker + ', ' + s.title;
      el.caption.style.color = s.ink;
      el.caption.style.textShadow = isLight(s.ink) ? '0 2px 14px rgba(0,0,0,.6)' : '0 1px 12px rgba(255,245,225,.8)';
      el.label.textContent = s.label;
      const active = doc.activeElement;
      el.prev.disabled = i === 0;
      el.next.disabled = i === scenes.length - 1;
      if (active && active.disabled) (active === el.prev ? el.next : el.prev).focus();
    }
    function announce() {
      const s = scenes[index];
      el.live.textContent = WORDS.announce.replace('{n}', index + 1).replace('{total}', scenes.length) + ', ' + s.kicker + ', ' + s.title;
    }
    function popUp() {
      pops().forEach((p, k) => { p.classList.remove('fold'); p.classList.add('up'); p.parentNode.classList.add('on'); later(k * 70 + 120, () => sfx.pop(k)); });
      later(900, () => root.querySelectorAll('.sb-pop.tap').forEach(p => p.classList.add('hint')));
      el.foreL.classList.remove('hide'); el.foreR.classList.remove('hide');
      if (scenes[index].auto === 'drive') later(1700, () => { const c = root.querySelector('[data-act="drive"] .car'); if (c) restart(c, 'driving'); });
    }
    function popDown() {
      const ps = pops();
      ps.forEach((p, k) => { p.classList.add('fold'); p.style.transitionDelay = ((ps.length - k) * 30) + 'ms'; p.classList.remove('up'); p.parentNode.classList.remove('on'); });
      el.foreL.classList.add('hide'); el.foreR.classList.add('hide');
      sfx.whoosh();
    }
    function showCaption(on) { el.caption.classList.toggle('hide', !on); }
    function restart(node, cls) { node.classList.remove(cls); void node.getBoundingClientRect(); node.classList.add(cls); }
    // The still version for reduced motion: everything already standing, nothing pops or folds.
    function settle() {
      el.wall.classList.add('up');
      pops().forEach(p => { p.classList.add('up'); p.parentNode.classList.add('on'); });
      el.foreL.classList.remove('hide'); el.foreR.classList.remove('hide');
      showCaption(true);
    }

    function turn(n) {
      // Sounds, hints and the auto drive still queued for the old page must not fire on the new one.
      clearTimers();
      if (!moving()){ index = n; renderScene(index); settle(); announce(); return; }
      busy = true;
      el.hint.classList.remove('show');
      showCaption(false);
      popDown();
      later(260, () => el.wall.classList.remove('up'));
      later(1050, () => { index = n; renderScene(index); raf(() => raf(() => el.wall.classList.add('up'))); });
      later(1550, popUp);
      later(2000, () => { showCaption(true); busy = false; announce(); });
    }
    function go(dir) {
      const n = nextIndex(index, dir, scenes.length, busy || !opened);
      if (n === null) return false;
      turn(n);
      return true;
    }
    function goTo(id) {
      const n = scenes.findIndex(s => s.id === id);
      if (busy || !opened || n < 0 || n === index) return false;
      turn(n);
      return true;
    }
    function open() {
      if (opened) return;
      opened = true;
      el.card.inert = false;
      sfx.start(); sfx.chime();
      const ready = () => {
        el.cover.classList.add('gone'); el.nav.classList.add('show'); el.hint.classList.add('show');
        if (snd) snd.classList.add('show');
        busy = false;
        el.heading.focus({ preventScroll: true });
        announce();
      };
      if (!moving()) { el.cover.classList.add('open'); settle(); ready(); return; }
      busy = true;
      askForTilt();
      const r = el.book.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 90);
      el.cover.classList.add('open');
      el.spill.classList.add('go');
      later(650, () => el.wall.classList.add('up'));
      later(1250, popUp);
      later(1500, () => showCaption(true));
      later(2200, ready);
    }

    /* tap delights */
    function petals(n, colours) {
      const Wd = el.fx.clientWidth, H = el.fx.clientHeight;
      for (let i = 0; i < n; i++) {
        const p = doc.createElement('div');
        p.className = 'sb-petal';
        p.style.background = colours[i % colours.length];
        p.style.left = (Wd * (.15 + Math.random() * .7)) + 'px';
        p.style.top = (H * (.18 + Math.random() * .12)) + 'px';
        el.fx.appendChild(p);
        const dx = (Math.random() - .5) * 160, dur = 2200 + Math.random() * 1800;
        p.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${H * .65}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.3,.1,.6,1)', delay: Math.random() * 400 }).onfinish = () => p.remove();
      }
    }
    function act(t) {
      const a = t.dataset.act;
      t.classList.remove('hint');
      if (a === 'drive') { const c = t.querySelector('.car'); if (c) restart(c, 'driving'); }
      if (a === 'fire') t.classList.toggle('lit');
      if (a === 'lights') restart(t, 'chase');
      if (a === 'petals' && moving()) petals(46,['#fffaf2', '#f7cdc6', '#e8949b', '#f3dcae']);
      if (a === 'splash') restart(t, 'splash');
    }

    /* gold dust and fireworks */
    const cx = el.dust.getContext('2d');
    let motes = [], sparks = [], dustFrame = 0;
    function size() { const d = W.devicePixelRatio || 1; el.dust.width = W.innerWidth * d; el.dust.height = W.innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    for (let i = 0; i < 46; i++) motes.push({ x: Math.random() * W.innerWidth, y: Math.random() * W.innerHeight, r: .6 + Math.random() * 1.6, v: .12 + Math.random() * .3, p: Math.random() * 6.28 });
    function burst(x, y, n, c = '#ffe7a8', sp0 = 5) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * sp0; sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, r: 1 + Math.random() * 2.2, c }); } }
    function fireworks() {
      if (!moving()) return;
      const r =el.book.getBoundingClientRect(), cols = ['#ffd77e', '#ff9fb0', '#9fe3ff', '#fff4dc', '#c6f29a'];
      for (let i = 0; i < 9; i++) later(300 + i * 420, () => { burst(r.left + r.width * (.15 + Math.random() * .7), r.top + r.height * (.08 + Math.random() * .25), 70, cols[i % cols.length], 3.2); sfx.boom(); });
    }
    /* tilt with the phone or the mouse; the layers show their depth */
    let tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    const onPointerMove = e => { if (e.pointerType === 'mouse') tgt = tiltFrom({ x: (e.clientX / W.innerWidth - .5) * 2, y: (e.clientY / W.innerHeight - .5) * 2 }); };
    const onOrientation = e => { tgt = tiltFrom({ gamma: e.gamma, beta: e.beta }); };
    function askForTilt() {
      const D = W.DeviceOrientationEvent;
      if (!D || typeof D.requestPermission !== 'function') return;
      try { D.requestPermission().catch(() => {}); } catch (e) { /* refused or not in a tap: the book stays flat */ }
    }
    function tilt() {
      cur.x += (tgt.x - cur.x) * .06; cur.y += (tgt.y - cur.y) * .06;
      el.world.style.transform = `rotateY(${cur.x * 7}deg) rotateX(${-cur.y * 4}deg)`;
      el.foreL.style.translate = el.foreR.style.translate = `${-cur.x * 16}px ${-cur.y * 6}px`;
    }
    function tick() {
      tilt();
      const w = W.innerWidth, h = W.innerHeight;
      cx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v; m.x += Math.sin(m.p += .01) * .25; if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w; }
        cx.globalAlpha = .35 + .35 * Math.sin(m.p * 2); cx.fillStyle = '#f3d48a'; cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 6.28); cx.fill();
      }
      sparks = sparks.filter(s => s.life > 0);
      for (const s of sparks) { s.x += s.vx; s.y += s.vy; s.vy += .05; s.vx *= .985; s.life -= .012; cx.globalAlpha = Math.max(0, s.life); cx.fillStyle = s.c || '#ffe7a8'; cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.28); cx.fill(); }
      cx.globalAlpha = 1;
      dustFrame = raf(tick);
    }

    /* input */
    function onKey(e) {
      const t = e.target;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        const tapped = t && t.closest && t.closest('.sb-card [data-act]');
        if (!opened && t !== el.skip && !(t && t.closest && t.closest('button'))) { e.preventDefault(); open(); }
        else if (opened && tapped) { e.preventDefault(); act(tapped); }
      }
    }
    let sx0 = null;
    root.addEventListener('pointerdown', e => { sx0 = e.clientX; });
    root.addEventListener('pointercancel', () => { sx0 = null; });
    root.addEventListener('pointerup', e => { if (sx0 === null) return; const dx = e.clientX - sx0; sx0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
    root.addEventListener('click', e => {
      const t = opened && e.target.closest('.sb-card [data-act]');
      if (t) act(t);
    });
    el.cover.addEventListener('click', open);
    el.next.addEventListener('click', () => go(1));
    el.prev.addEventListener('click', () => go(-1));
    el.skip.addEventListener('click', e => { e.preventDefault(); close(); });

    /* showing and hiding the layer */
    function show() {
      root.hidden = false;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      for (const n of Array.from(doc.body.children)) {
        if (n === root || /^(SCRIPT|NOSCRIPT|STYLE)$/.test(n.tagName)) continue;
        behind.push([n, n.getAttribute('aria-hidden'), n.inert]);
        n.setAttribute('aria-hidden', 'true');
        n.inert = true;
      }
      doc.documentElement.classList.add('sb-open');
      el.card.inert = !opened;
      doc.addEventListener('keydown', onKey);
      if (!moving()) return;
      W.addEventListener('resize', size);
      W.addEventListener('pointermove', onPointerMove);
      W.addEventListener('deviceorientation', onOrientation);
      size();
      dustFrame = raf(tick);
    }
    function close() {
      sfx.stop();
      clearTimers();
      W.cancelAnimationFrame(dustFrame);
      doc.removeEventListener('keydown', onKey);
      W.removeEventListener('resize', size);
      W.removeEventListener('pointermove', onPointerMove);
      W.removeEventListener('deviceorientation', onOrientation);
      for (const [n, hidden, inert] of behind.splice(0)) {
        if (hidden === null) n.removeAttribute('aria-hidden'); else n.setAttribute('aria-hidden', hidden);
        n.inert = inert;
      }
      doc.documentElement.classList.remove('sb-open');
      root.hidden = true;
      const card = doc.getElementById('card');
      if (card) card.focus();
    }

    renderScene(0);
    show();
    return { open, go, goTo, close, fireworks, current: () => scenes[index].id };
  }

  function boot(win) {
    const doc = win.document;
    const script = doc.currentScript || doc.querySelector('script[src$="js/storybook.js"]');
    const enabled = !!script && script.getAttribute('data-enabled') === 'true';
    if (!shouldShowBook({ search: win.location.search, enabled })) return null;
    const A = win.StorybookArt, scenes = win.StorybookScenes;
    if (!A || !scenes || !doc.getElementById('storybook')) return null;
    const sound = win.StorybookSound ? win.StorybookSound.createSound(win) : null;
    return createBook(doc, { scenes, art: A.ART, walls: A.WALLS, grounds: A.GROUNDS, stars: A.STARS, sound, win });
  }

  const api = { shouldShowBook, copyProblems, nextIndex, tiltFrom, motionAllowed, createBook, WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Storybook = api; api.book = boot(root); }
})(typeof window !== 'undefined' ? window : globalThis);
