// The Weekend card: four day tiles, and a day that opens full screen over them with its picture, intro, parts of the
// day and lines (Wear, Food and drink, Where). Swipe, the marks at the foot or the arrow keys move between days; the
// card's close control and Escape step back to the tiles. While a day is open its picture drifts and small lights hang
// in the air; reduced motion turns all of that off. Every word comes from weekendView() and is set with textContent.
// Loads after core.js and words.js; cards.js hands the card frame's `card` to build().
(function (root) {
  'use strict';
  const KEYS = ['fri', 'sat', 'sun', 'mon'];
  const ROW_KINDS = ['wear', 'food', 'where'];
  const MAX_PARTS = 3;

  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = v => (typeof v === 'string' ? v.trim() : '');
  const textList = v => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

  // ---------- the rules: what each of the four days shows ----------
  // A day's picture is named by its position (fri, sat, sun, mon). A line that is missing, empty or not text is left
  // out, never shown empty. A part of the day may have no part-of-day tag; it is kept, without one.
  function partsOf(day) {
    return (Array.isArray(day.parts) ? day.parts : [])
      .filter(isObject)
      .map(p => ({ when: text(p.when), what: text(p.what) }))
      .filter(p => p.what)
      .slice(0, MAX_PARTS);
  }

  function rowsOf(day, labels) {
    return ROW_KINDS
      .map(kind => ({ kind, label: text(labels[kind]), text: text(day[kind]), tags: kind === 'wear' ? textList(day.bring) : [] }))
      .filter(r => r.text);
  }

  function weekendView(w) {
    const wk = isObject(w) && isObject(w.weekend) ? w.weekend : {};
    const labels = isObject(wk.labels) ? wk.labels : {};
    const days = Array.isArray(wk.days) ? wk.days : [];
    return {
      title: text(wk.title), vibe: text(wk.vibe), hint: text(wk.hint), swipe: text(wk.swipe), back: text(wk.back), open: text(wk.open),
      days: KEYS.map((key, i) => {
        const d = isObject(days[i]) ? days[i] : {};
        return { key, img: key, date: text(d.date), name: text(d.name), intro: text(d.intro), parts: partsOf(d), rows: rowsOf(d, labels) };
      })
    };
  }

  // ---------- the pictures ----------
  // A tile uses the 720 picture alone. The open day offers both: its layer is the day's width plus 8% off each side
  // (116%), so on a wide, dense screen the browser picks the 1024 one.
  function pictureFiles(key) {
    const small = 'images/first/' + key + '.webp', large = 'images/first/' + key + '-lg.webp';
    return { src: small, srcset: small + ' 720w, ' + large + ' 1024w', sizes: '116vw' };
  }

  // The days whose pictures to fetch with day `idx` in view: that day first, then the ones either side.
  function wanted(idx, count) {
    const at = clamp(idx, 0, count - 1);
    return [at, at - 1, at + 1].filter(i => i >= 0 && i < count);
  }

  // ---------- the swipe ----------
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const FAR = 0.22, FAST = 0.45, PAST_END = 1 / 3;

  // The day a swipe lands on: one step when it went past 22% of the width or faster than 0.45 px per ms.
  function settle(idx, dx, width, msHeld, count) {
    const far = Math.abs(dx) > width * FAR, fast = Math.abs(dx) / Math.max(1, msHeld) > FAST;
    const step = width > 0 && dx && (far || fast) ? (dx < 0 ? 1 : -1) : 0;
    return clamp(idx + step, 0, count - 1);
  }

  // Where the days sit mid-drag (1.5 is halfway from the second day to the third); past either end the pull is weaker.
  function along(idx, dx, width, count) {
    const p = idx - (width > 0 ? dx / width : 0), end = count - 1;
    if (p < 0) return p * PAST_END;
    if (p > end) return end + (p - end) * PAST_END;
    return p;
  }

  // ---------- the screen ----------
  const OPEN_MS = 620, BAND_MS = 1200, SETTLE_MS = 1000;
  const svg = inner => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const ICON = {
    wear: svg('<path d="M8 4l4 3 4-3 4 3-2 4-2-1v10H8V10l-2 1-2-4z"/>'),
    food: svg('<path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-2 2-2 7 0 9v9"/>'),
    where: svg('<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'),
    go: svg('<path d="M9 6l6 6-6 6"/>')
  };
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };
  function focus(e) { try { e.focus({ preventScroll: true }); } catch (err) { /* not focusable */ } }
  function prefersStill() {
    try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // Lights in the air over the picture: warm points at dusk and night, pale specks by day. One small canvas.
  const MAX_LIGHTS = 34;
  const LOOKS = {
    fri: { n: 26, hue: [38, 46], size: [1.2, 3.2], rise: -6, glow: 14 },
    sat: { n: 34, hue: [36, 48], size: [1.2, 3.6], rise: -4, glow: 16 },
    sun: { n: 18, hue: [48, 56], size: [0.8, 2], rise: -10, glow: 8 },
    mon: { n: 16, hue: [44, 52], size: [0.8, 2.2], rise: -8, glow: 9 }
  };
  function makeLights(canvas) {
    const g = canvas.getContext ? canvas.getContext('2d') : null;
    let look = null, pts = [], raf = 0, w = 0, h = 0, last = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function fit() {
      const r = canvas.getBoundingClientRect(), k = Math.min(2, root.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
      g.setTransform(k, 0, 0, k, 0, 0);
    }
    function seed() {
      pts = [];
      for (let i = 0; i < Math.min(MAX_LIGHTS, look.n); i++) {
        pts.push({ x: rnd(0, w), y: rnd(0, h * 0.7), r: rnd(look.size[0], look.size[1]), hue: rnd(look.hue[0], look.hue[1]),
          t: rnd(0, 6.28), s: rnd(0.5, 1.6), dx: rnd(-4, 4), dy: look.rise * rnd(0.3, 1) });
      }
    }
    function frame(now) {
      if (!look) return;
      raf = root.requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      g.clearRect(0, 0, w, h);
      g.shadowBlur = look.glow;
      pts.forEach(p => {
        p.t += dt * p.s; p.x += p.dx * dt; p.y += p.dy * dt;
        if (p.y < -10) { p.y = h * 0.72; p.x = rnd(0, w); }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(p.t));
        g.shadowColor = 'hsla(' + p.hue + ', 90%, 70%, ' + a + ')';
        g.fillStyle = 'hsla(' + p.hue + ', 90%, 78%, ' + a + ')';
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, 6.283);
        g.fill();
      });
    }
    function stop() {
      look = null;
      if (raf) root.cancelAnimationFrame(raf);
      raf = 0;
      if (g) g.clearRect(0, 0, w, h);
    }
    function start(key) {
      if (!g || !LOOKS[key]) return stop();
      if (look === LOOKS[key] && raf) return;
      stop();
      look = LOOKS[key];
      fit();
      seed();
      last = root.performance.now();
      raf = root.requestAnimationFrame(frame);
    }
    return { start, stop };
  }

  function build(card) {
    const el = card.el, button = card.button, S = card.first.sound;
    const v = weekendView(card.w), count = v.days.length, still = prefersStill();
    card.heading(v.title);

    // The four tiles, with the weekend's one line above them and the hint below.
    const dayFiles = new Map();
    const tilesView = el('div', 'wk-tiles');
    if (v.vibe) tilesView.appendChild(card.rise(el('p', 'wk-vibe', v.vibe)));
    const grid = el('div', 'fc-days');
    const tiles = v.days.map((d, i) => {
      const t = card.rise(button('fc-day', null, () => openDay(i)));
      t.setAttribute('aria-label', d.date + ', ' + d.name + ', ' + v.open);
      t.setAttribute('aria-haspopup', 'dialog');
      t.appendChild(picture('fc-day-img', d.img));
      t.appendChild(icon('wk-go', 'go'));
      const cap = el('span', 'fc-day-cap');
      cap.appendChild(el('span', 'fc-grp-k', d.date));
      cap.appendChild(el('span', 'fc-day-t', d.name));
      t.appendChild(cap);
      grid.appendChild(t);
      return t;
    });
    tilesView.appendChild(grid);
    if (v.hint) tilesView.appendChild(card.rise(el('p', 'wk-hint', v.hint)));

    // One day, full screen: the pictures, the lights, the band of light, the days side by side and the marks.
    const day = el('section', 'wk-day');
    day.hidden = true;
    day.setAttribute('role', 'dialog');
    const pics = v.days.map(d => {
      const p = el('div', 'wk-pic');
      p.appendChild(picture('wk-pic-img', d.img, true));
      day.appendChild(p);
      return p;
    });
    const air = still ? null : el('canvas', 'wk-air');
    if (air) { air.setAttribute('aria-hidden', 'true'); day.appendChild(air); }
    const band = el('div', 'wk-band');
    day.appendChild(band);
    day.appendChild(el('div', 'wk-shade'));
    const swipe = el('p', 'wk-swipe', v.swipe);
    swipe.setAttribute('aria-hidden', 'true');
    day.appendChild(swipe);
    const track = el('div', 'wk-track');
    const pages = v.days.map(d => {
      const page = dayPage(d);
      track.appendChild(page.box);
      return page;
    });
    day.appendChild(track);
    const marks = el('div', 'wk-marks');
    const dots = v.days.map((d, i) => {
      const m = button('wk-mark', null, () => go(i));
      m.setAttribute('aria-label', d.date + ', ' + d.name);
      m.appendChild(el('i'));
      marks.appendChild(m);
      return m;
    });
    day.appendChild(marks);
    [tilesView, day].forEach(e => card.body.appendChild(e));

    const lights = air ? makeLights(air) : null;
    const timers = new Set();
    let idx = 0, open = false, moved = false, drag = null, moving = null, following = null, bandT = null;
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    // One grow or shrink at a time: a new one cancels the end of the last.
    const afterMove = fn => { clearTimeout(moving); timers.delete(moving); moving = later(fn, OPEN_MS); };

    // A tile's picture loads lazily. A day's picture is asked for only by want(): it holds its addresses until then.
    function picture(cls, key, forDay) {
      const img = el('img', cls);
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.hidden = true; });
      if (!forDay) {
        img.loading = 'lazy';
        img.src = pictureFiles(key).src;
        return img;
      }
      const set = pictureFiles(key);
      img.sizes = set.sizes;
      dayFiles.set(img, set);
      return img;
    }
    // Ask for day i's picture, once.
    function fetchDay(i) {
      const img = pics[i].firstChild, set = dayFiles.get(img);
      if (!set) return;
      dayFiles.delete(img);
      img.srcset = set.srcset;
      img.src = set.src;
    }
    // The day in view and the days either side, so a swipe or a mark finds the next picture ready.
    function want(i) { wanted(i, count).forEach(fetchDay); }
    function icon(cls, name) {
      const s = el('span', cls);
      s.setAttribute('aria-hidden', 'true');
      s.innerHTML = ICON[name];
      return s;
    }
    function dayPage(d) {
      const box = el('article', 'wk-page');
      const items = [];
      const add = e => { e.classList.add('wk-rise'); e.style.setProperty('--i', String(items.length)); items.push(e); box.appendChild(e); return e; };
      add(el('p', 'wk-date', d.date));
      const head = add(el('h3', 'wk-name', d.name));
      head.id = 'wk-h-' + d.key;
      head.tabIndex = -1;
      if (d.intro) add(el('p', 'wk-intro', d.intro));
      if (d.parts.length) {
        const list = add(el('ul', 'wk-parts'));
        d.parts.forEach((p, j) => {
          const li = el('li', 'wk-part');
          li.style.setProperty('--j', String(j));
          if (p.when) li.appendChild(el('span', 'wk-when', p.when));
          li.appendChild(el('span', 'wk-what', p.what));
          list.appendChild(li);
        });
      }
      if (d.rows.length) {
        const rows = add(el('div', 'wk-rows'));
        d.rows.forEach(r => {
          const row = el('div', 'wk-row');
          row.appendChild(icon('wk-ico', r.kind));
          const txt = el('div', 'wk-row-t');
          txt.appendChild(el('span', 'wk-k', r.label));
          txt.appendChild(el('span', 'wk-v', r.text));
          if (r.tags.length) {
            const tags = el('span', 'wk-tags');
            r.tags.forEach(tag => tags.appendChild(el('span', 'wk-tag', tag)));
            txt.appendChild(tags);
          }
          row.appendChild(txt);
          rows.appendChild(row);
        });
      }
      return { box, head };
    }

    // p is the day in view as a number: 1.5 is halfway between Saturday and Sunday.
    function place(p) {
      track.style.transform = 'translate3d(' + (-p * 100) + '%, 0, 0)';
      pics.forEach((pic, i) => {
        const off = i - p;
        pic.style.opacity = String(Math.max(0, 1 - Math.abs(off)));
        pic.style.transform = 'translate3d(' + (off * 5) + '%, 0, 0)';
      });
    }
    function mark() {
      pages.forEach((pg, i) => {
        const on = open && i === idx;
        pg.box.classList.toggle('wk-live', on);
        pg.box.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        pg.box.inert = i !== idx;
      });
      pics.forEach((pic, i) => pic.classList.toggle('wk-on', open && i === idx));
      dots.forEach((m, i) => m.setAttribute('aria-current', i === idx ? 'true' : 'false'));
      day.setAttribute('aria-labelledby', pages[idx].head.id);
      lightsOn();
    }
    function lightsOn() {
      if (!lights) return;
      if (open && card.live() && !document.hidden) lights.start(v.days[idx].key); else lights.stop();
    }
    // fromDrag: the words already followed the finger, so they stay shown until the days settle; a mark or key
    // brings back the staggered rise. The old page goes inert, so focus that was on it (or nowhere) moves to the new
    // day's heading.
    function go(i, fromDrag) {
      if (!fromDrag) stopFollow();
      const next = clamp(i, 0, count - 1), a = document.activeElement;
      const refocus = open && next !== idx && (!a || a === document.body || pages[idx].box.contains(a));
      if (next !== idx) {
        moved = true;
        swipe.classList.add('wk-gone');
        if (!still) {
          band.classList.remove('wk-band-on');
          void band.offsetWidth;
          band.classList.add('wk-band-on');
          clearTimeout(bandT);
          timers.delete(bandT);
          bandT = later(() => band.classList.remove('wk-band-on'), BAND_MS);
        }
        if (S) S.pop(0.3);
        haptic(6);
      }
      idx = next;
      day.classList.add('wk-snap');
      place(idx);
      want(idx);
      mark();
      if (refocus) focus(pages[idx].head);
    }

    // The day grows out of its tile and shrinks back into it: a clip from the tile's box to the whole card.
    function clipTo(tile) {
      const a = day.getBoundingClientRect(), r = tile.getBoundingClientRect();
      const set = (k, n) => day.style.setProperty(k, Math.max(0, n) + 'px');
      set('--wk-t', r.top - a.top);
      set('--wk-r', a.right - r.right);
      set('--wk-b', a.bottom - r.bottom);
      set('--wk-l', r.left - a.left);
      set('--wk-rad', 20);
    }
    function clipFull() { ['--wk-t', '--wk-r', '--wk-b', '--wk-l', '--wk-rad'].forEach(k => day.style.setProperty(k, '0px')); }
    function stopFollow() {
      clearTimeout(following);
      timers.delete(following);
      day.classList.remove('wk-follow');
    }
    function quietTiles(on) {
      tilesView.inert = on;
      if (on) tilesView.setAttribute('aria-hidden', 'true'); else tilesView.removeAttribute('aria-hidden');
      tiles.forEach(t => { t.disabled = on; });
    }

    function openDay(i) {
      if (open) return;
      idx = clamp(i, 0, count - 1);
      open = true;
      day.classList.remove('wk-snap', 'wk-moving');
      stopFollow();
      day.hidden = false;
      swipe.classList.toggle('wk-gone', moved || idx === count - 1);
      place(idx);
      want(idx);
      if (!still) {
        clipTo(tiles[idx]);
        void day.offsetWidth;
        day.classList.add('wk-moving');
        afterMove(() => day.classList.remove('wk-moving'));
      }
      clipFull();
      quietTiles(true);
      card.closeLabel(v.back);
      mark();
      if (S) S.pop(0.4);
      haptic(8);
      focus(pages[idx].head);
    }
    function closeDay() {
      if (!open) return;
      open = false;
      drag = null;
      mark();
      quietTiles(false);
      card.closeLabel();
      const tile = tiles[idx];
      const done = () => { day.hidden = true; day.classList.remove('wk-moving', 'wk-snap'); };
      if (still) done();
      else {
        day.classList.add('wk-moving');
        clipTo(tile);
        afterMove(done);
      }
      focus(tile);
    }

    // The close control and Escape step back to the tiles while a day is open.
    card.beforeClose(() => {
      if (!open) return false;
      closeDay();
      return true;
    });
    function onKey(e) {
      if (!open || !card.live() || e.defaultPrevented) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    }
    const onVisible = () => lightsOn();
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    card.onClose(() => {
      open = false;
      if (lights) lights.stop();
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisible);
    });

    // Swipe between days: the words and the picture follow the finger. One pointer drives a drag: only the primary
    // one starts it, and another finger or a stray pointer can neither start a second nor take it over.
    day.addEventListener('pointerdown', e => {
      if (!open || !e.isPrimary || (drag && drag.on) || (e.target.closest && e.target.closest('button'))) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: root.performance.now(), w: day.clientWidth || 1, on: false };
    });
    day.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        drag.on = true;
        stopFollow();
        day.classList.add('wk-follow');
        day.classList.remove('wk-snap');
        try { day.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
      }
      place(along(idx, dx, drag.w, count));
    });
    // A cancel (the browser took the gesture) always ends the drag and puts the day back where it was.
    function drop(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.on || !open) return;
      go(e.type === 'pointercancel' ? idx : settle(idx, e.clientX - d.x, d.w, root.performance.now() - d.t, count), true);
      following = later(() => day.classList.remove('wk-follow'), SETTLE_MS);
    }
    day.addEventListener('pointerup', drop);
    day.addEventListener('pointercancel', drop);
  }

  const api = { weekendView, settle, along, pictureFiles, wanted, build };
  root.sjFirst = Object.assign(root.sjFirst || {}, { weekendCard: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
