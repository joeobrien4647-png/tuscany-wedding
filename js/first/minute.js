// The first minute: the cover with the seal and the name, the seal cracking, the drive, the estate from the air and the
// weekend at night. Ported from the first-minute prototype with its timings. It stops where the question begins:
// onDone() fires once, and the night photo stays on the stage behind whatever comes next.
(function (root) {
  'use strict';
  const VIDEO_SRC = 'video/drive-hero-720.mp4';
  const POSTER_SRC = 'video/drive-hero-poster.jpg';
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const NAME_MAX = 60;
  const END_MS = 9500;

  // The name for the cover, as plain text: '' when there is none.
  function coverLine(invite) {
    const display = invite && typeof invite.display === 'string' ? invite.display.replace(/\s+/g, ' ').trim() : '';
    return display.slice(0, NAME_MAX).trim();
  }
  const nameSize = text => (text.length > 26 ? 'longer' : text.length > 13 ? 'long' : '');

  const svg = (inner, w) => '<svg width="' + (w || 20) + '" height="' + (w || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const ICON = {
    soundOn: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a7.8 7.8 0 0 1 0 11.2"/>'),
    soundOff: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>')
  };
  const SEAL_VIEW = 'viewBox="-20 -20 240 240" aria-hidden="true" focusable="false"';
  const CRACK = 'M102 4 L95 30 L106 53 L94 78 L105 99 L95 123 L107 147 L96 171';

  // Fixed markup only: every word is set afterwards with textContent.
  const MARKUP = [
    '<svg class="fm-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>',
    '<radialGradient id="fm-wax" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#c9573f"/><stop offset=".38" stop-color="#9a2c21"/><stop offset=".8" stop-color="#5e1510"/><stop offset="1" stop-color="#3e0b08"/></radialGradient>',
    '<radialGradient id="fm-well" cx="62%" cy="66%" r="72%"><stop offset="0" stop-color="#a8372b"/><stop offset="1" stop-color="#6b1a13"/></radialGradient>',
    '<clipPath id="fm-c-l"><path d="M-30 -30 L102 -30 L' + CRACK.slice(1) + ' L103 230 L-30 230 Z"/></clipPath>',
    '<clipPath id="fm-c-r"><path d="M230 -30 L102 -30 L' + CRACK.slice(1) + ' L103 230 L230 230 Z"/></clipPath>',
    '<g id="fm-seal-art"><path id="fm-seal-blob" fill="url(#fm-wax)" d="M100 6 A94 94 0 1 1 99.9 6 Z"/>',
    '<circle cx="100" cy="100" r="64" fill="url(#fm-well)"/>',
    '<circle cx="101.2" cy="101.6" r="64" fill="none" stroke="#3c0a07" stroke-opacity=".55" stroke-width="2.6"/>',
    '<circle cx="99" cy="98.8" r="64" fill="none" stroke="#ee9479" stroke-opacity=".32" stroke-width="1.4"/>',
    '<circle cx="100" cy="100" r="55" fill="none" stroke="#561209" stroke-opacity=".5" stroke-width="1.1" stroke-dasharray="1.4 3.4"/>',
    '<g font-family="\'Bodoni Moda\', Didot, \'Times New Roman\', serif" font-style="italic" font-weight="500" font-size="48" text-anchor="middle">',
    '<text x="101.5" y="117.6" fill="#330805" fill-opacity=".6">S&amp;J</text><text x="99" y="115" fill="#ef8d70" fill-opacity=".42">S&amp;J</text><text x="100" y="116.2" fill="#8c241b">S&amp;J</text>',
    '</g></g></defs></svg>',
    '<div class="fm-stage" aria-hidden="true">',
    '<div class="fm-layer fm-cover-bg"></div>',
    '<video class="fm-layer fm-media fm-drive" muted playsinline preload="none" disablepictureinpicture></video>',
    '<div class="fm-layer fm-media fm-still fm-estate"></div>',
    '<div class="fm-layer fm-media fm-still fm-night"></div>',
    '<div class="fm-layer fm-shade"></div><div class="fm-layer fm-vignette"></div><div class="fm-layer fm-flash"></div>',
    '<canvas class="fm-layer fm-fx"></canvas><div class="fm-layer fm-grain"></div>',
    '</div>',
    '<section class="fm-screen fm-cover">',
    '<div class="fm-cover-top"><p class="fm-kicker fm-cover-kicker"></p><p class="fm-for"></p><h1 class="fm-name"></h1></div>',
    '<div class="fm-seal-wrap"><button class="fm-seal" type="button"><span class="fm-seal-press">',
    '<svg class="fm-seal-whole" ' + SEAL_VIEW + '><use href="#fm-seal-art"/></svg>',
    '<span class="fm-half fm-half-l"><svg ' + SEAL_VIEW + '><g clip-path="url(#fm-c-l)"><use href="#fm-seal-art"/></g></svg></span>',
    '<span class="fm-half fm-half-r"><svg ' + SEAL_VIEW + '><g clip-path="url(#fm-c-r)"><use href="#fm-seal-art"/></g></svg></span>',
    '<svg class="fm-crack" ' + SEAL_VIEW + '><path class="fm-crack-path" d="' + CRACK + ' L103 196" fill="none" stroke="#ffe0a8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    '</span></button><p class="fm-hint"></p></div>',
    '<p class="fm-foot"></p>',
    '</section>',
    '<section class="fm-screen fm-reveal" hidden>',
    '<div class="fm-scene fm-s1"><p class="fm-kicker"></p><h2 class="fm-big"></h2><p class="fm-sub"></p></div>',
    '<div class="fm-scene fm-s2"><p class="fm-kicker"></p><h2 class="fm-big"></h2></div>',
    '<div class="fm-scene fm-s3"><p class="fm-kicker"></p><ol class="fm-days"></ol></div>',
    '</section>',
    '<button class="fm-round fm-sound" type="button"></button>',
    '<button class="fm-skip" type="button"><span class="fm-skip-t"></span>' + svg('<path d="M9 6l6 6-6 6"/>', 14) + '</button>'
  ].join('');

  // A wax blob with a slightly uneven edge (the same seed every time).
  function blobPath() {
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const n = 40, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bulge = Math.max(0, Math.sin(a * 3 + 0.8)) * 0.035 + Math.max(0, Math.sin(a * 7 + 2.1)) * 0.02;
      const r = 92 * (1 + (rnd() - 0.5) * 0.045 + bulge);
      pts.push([100 + Math.cos(a) * r, 100 + Math.sin(a) * r]);
    }
    const f = v => v.toFixed(1);
    let d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }

  // Film grain: a small noise tile, made once.
  let grainUrl = null;
  function grain() {
    if (grainUrl !== null) return grainUrl;
    grainUrl = '';
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), img = g.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      grainUrl = c.toDataURL();
    } catch (e) { /* no grain, still fine */ }
    return grainUrl;
  }

  const silent = { prepare() {}, unlock() {}, music() {}, quiet() {}, crack() {}, chime() {}, pop() {}, boom() {}, toggle() { return false; }, on() { return false; } };
  const still = { attach() {}, dust() {}, burst() {}, show() {} };
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics in this browser */ } };
  const saveData = () => { try { return !!(root.navigator.connection && root.navigator.connection.saveData); } catch (e) { return false; } };

  let current = null;

  function stop() {
    const r = current;
    if (!r) return;
    current = null;
    r.timers.concat(r.later).forEach(t => root.clearTimeout(t));
    r.anims.forEach(a => { try { a.cancel(); } catch (e) { /* already gone */ } });
    // A detached video keeps downloading while it has a src: take it away and reset the element.
    try { r.drive.pause(); r.drive.removeAttribute('src'); r.drive.load(); } catch (e) { /* nothing playing */ }
    if (r.opened) r.sound.quiet();
    if (r.box.parentNode) r.box.parentNode.removeChild(r.box);
  }

  function play(opts) {
    const o = opts || {};
    const first = root.sjFirst || {};
    const w = first.words;
    const S = first.sound || silent, F = first.fx || still;
    const host = o.root;
    stop();
    if (!o.quick) S.prepare();

    const box = document.createElement('div');
    box.className = 'fm';
    box.innerHTML = MARKUP;
    host.insertBefore(box, host.firstChild);
    host.hidden = false;

    const q = sel => box.querySelector(sel);
    const REDUCE = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const r = { box, timers: [], later: [], anims: [], opened: false, done: false, sound: S, drive: q('.fm-drive') };
    current = r;
    const live = () => current === r;
    const at = (ms, fn) => { r.timers.push(root.setTimeout(() => { if (live()) fn(); }, ms)); };
    const later = (ms, fn) => { r.later.push(root.setTimeout(() => { if (live()) fn(); }, ms)); };
    const clearTimers = () => { r.timers.forEach(t => root.clearTimeout(t)); r.timers = []; };

    function anim(el, frames, a) {
      if (!el || !el.animate) return null;
      const made = el.animate(frames, Object.assign({ duration: 600, easing: EASE, fill: 'both' }, a));
      r.anims.push(made);
      return made;
    }
    const fadeIn = (el, d = 900, delay = 0) => anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: d, delay, easing: 'ease' });
    const fadeTo = (el, to, d = 500, delay = 0) => anim(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: to }], { duration: d, delay, easing: 'ease' });
    const rise = (el, delay = 0, d = 800) => anim(el, REDUCE ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: d, delay });
    const settle = (el, delay = 0) => anim(el, REDUCE ? [{ opacity: 0 }, { opacity: 1 }] : [
      { opacity: 0, filter: 'blur(14px)', letterSpacing: '.2em', transform: 'translateY(10px) scale(1.04)' },
      { opacity: 1, filter: 'blur(0px)', letterSpacing: '-.01em', transform: 'none' }
    ], { duration: 1600, delay });
    const drift = (el, from, to, d) => (REDUCE ? null : anim(el, [{ transform: from }, { transform: to }], { duration: d, easing: 'linear' }));

    const cover = q('.fm-cover'), reveal = q('.fm-reveal'), seal = q('.fm-seal'), skip = q('.fm-skip'), soundBtn = q('.fm-sound');
    const stage = q('.fm-stage'), drive = r.drive, estate = q('.fm-estate'), night = q('.fm-night'), coverBg = q('.fm-cover-bg');
    const s1 = q('.fm-s1'), s2 = q('.fm-s2'), s3 = q('.fm-s3');

    // Words, all as text.
    const name = coverLine(o.invite);
    const nameEl = q('.fm-name'), forEl = q('.fm-for');
    q('.fm-cover-kicker').textContent = w.cover.kicker;
    forEl.textContent = w.cover.for;
    forEl.hidden = !name;
    nameEl.textContent = name || w.cover.forNobody;
    const size = nameSize(nameEl.textContent);
    if (size) nameEl.setAttribute('data-size', size);
    seal.setAttribute('aria-label', w.cover.sealLabel);
    q('.fm-hint').textContent = w.cover.hint;
    q('.fm-foot').textContent = w.cover.foot;
    s1.querySelector('.fm-kicker').textContent = w.cover.kicker;
    s1.querySelector('.fm-big').textContent = w.minute.title;
    s1.querySelector('.fm-sub').textContent = w.minute.dates;
    s2.querySelector('.fm-kicker').textContent = w.minute.estateKicker;
    s2.querySelector('.fm-big').textContent = w.minute.estate;
    s3.querySelector('.fm-kicker').textContent = w.minute.weekendKicker;
    const days = s3.querySelector('.fm-days');
    w.weekend.days.forEach(day => {
      const li = document.createElement('li'), d = document.createElement('span'), t = document.createElement('span');
      d.className = 'fm-d'; d.textContent = day.date;
      t.className = 'fm-t'; t.textContent = day.name;
      li.appendChild(d); li.appendChild(t); days.appendChild(li);
    });
    q('.fm-skip-t').textContent = w.minute.skip;
    skip.setAttribute('aria-label', w.minute.skip);

    function soundIcon() {
      const on = S.on();
      soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', on ? w.minute.soundOn : w.minute.soundOff);
    }
    soundIcon();

    q('#fm-seal-blob').setAttribute('d', blobPath());
    const tile = grain();
    if (tile) q('.fm-grain').style.backgroundImage = 'url(' + tile + ')';
    drive.muted = true;
    F.attach(q('.fm-fx'));

    // The cover paints first; the video and the photos for later scenes are asked for once it has.
    let warmed = false;
    function warm() {
      if (warmed || !live()) return;
      warmed = true;
      stage.classList.add('fm-ready');
      drive.poster = POSTER_SRC;
      if (!REDUCE && !saveData()) { drive.preload = 'auto'; drive.src = VIDEO_SRC; }
    }

    function finish() {
      if (r.done) return;
      r.done = true;
      clearTimers();
      if (!skip.hidden) { fadeTo(skip, 0, 250); later(260, () => { skip.hidden = true; }); }
      if (!reveal.hidden) { fadeTo(s3, 0, 400); later(420, () => { reveal.hidden = true; }); }
      if (typeof o.onDone === 'function') o.onDone();
    }

    function crackSeal() {
      seal.classList.add('fm-open');
      const crack = q('.fm-crack-path');
      let len = 200;
      try { len = crack.getTotalLength(); } catch (e) { /* keep the estimate */ }
      crack.style.strokeDasharray = String(len);
      anim(q('.fm-crack'), [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 560, easing: 'linear' });
      anim(crack, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 200, easing: 'ease-out' });
      const fall = side => REDUCE ? [{ opacity: 1 }, { opacity: 0 }] : [
        { opacity: 1, transform: 'none' },
        { opacity: 1, transform: 'translate(' + side * 7 + 'px, -2px) rotate(' + side * 5 + 'deg)', offset: 0.2 },
        { opacity: 0, transform: 'translate(' + side * 52 + 'px, 130px) rotate(' + side * 40 + 'deg)' }
      ];
      anim(q('.fm-half-l'), fall(-1), { duration: 1050, delay: 120, easing: 'cubic-bezier(.45,0,.7,.25)' });
      anim(q('.fm-half-r'), fall(1), { duration: 1050, delay: 120, easing: 'cubic-bezier(.45,0,.7,.25)' });
    }

    function openInvite() {
      if (r.opened || r.done) return;
      r.opened = true;
      S.unlock(); S.crack(); S.music();
      haptic(18);
      warm();
      crackSeal();
      const b = seal.getBoundingClientRect();
      at(140, () => F.dust(b.left + b.width / 2, b.top + b.height / 2));
      anim(q('.fm-flash'), [{ opacity: 0 }, { opacity: 0.88, offset: 0.22 }, { opacity: 0 }], { duration: 1000, delay: 120, easing: 'ease-out' });
      fadeTo(q('.fm-cover-top'), 0, 450, 60);
      fadeTo(q('.fm-hint'), 0, 300, 0);
      fadeTo(q('.fm-foot'), 0, 450, 60);
      fadeTo(coverBg, 0, 1100, 200);
      at(1250, () => { cover.hidden = true; });
      runReveal();
    }

    function runReveal() {
      reveal.hidden = false;
      at(250, () => {
        if (drive.src) {
          try { drive.currentTime = 0; } catch (e) { /* not loaded yet */ }
          try { const p = drive.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the poster stays */ }
        }
        fadeIn(drive, 1000);
        drift(drive, 'scale(1.12)', 'scale(1)', 4300);
      });
      at(850, () => { rise(s1.querySelector('.fm-kicker'), 0, 900); settle(s1.querySelector('.fm-big'), 120); rise(s1.querySelector('.fm-sub'), 900, 900); });
      at(3500, () => fadeTo(s1, 0, 450));
      at(3650, () => { fadeIn(estate, 1100); drift(estate, 'scale(1.18) translate3d(0, 2%, 0)', 'scale(1.03)', 5400); });
      at(4150, () => { rise(s2.querySelector('.fm-kicker'), 0, 900); settle(s2.querySelector('.fm-big'), 180); });
      at(6000, () => drive.pause());
      at(6500, () => fadeTo(s2, 0, 450));
      at(6650, () => { fadeIn(night, 1100); drift(night, 'scale(1.14)', 'scale(1)', 7500); });
      at(7150, () => { rise(s3.querySelector('.fm-kicker'), 0, 800); Array.from(s3.querySelectorAll('li')).forEach((li, i) => rise(li, 160 + i * 170, 750)); });
      at(END_MS, finish);
    }

    function skipToEnd() {
      if (r.done) return;
      clearTimers();
      stage.classList.add('fm-ready');
      fadeTo(night, 1, 500);
      fadeTo(coverBg, 0, 400);
      later(500, () => drive.pause());
      [cover, reveal].forEach(el => {
        if (el.hidden) return;
        fadeTo(el, 0, 300);
        later(320, () => { el.hidden = true; });
      });
      finish();
    }

    seal.addEventListener('click', openInvite);
    skip.addEventListener('click', skipToEnd);
    soundBtn.addEventListener('click', () => { S.unlock(); S.toggle(); soundIcon(); });

    if (o.quick) {
      warmed = true;
      stage.classList.add('fm-ready');
      cover.hidden = true;
      night.style.opacity = '1';
      coverBg.style.opacity = '0';
      skip.hidden = true;
      finish();
      return;
    }
    fadeIn(skip, 400, 1200);
    root.requestAnimationFrame(() => later(400, warm));
  }

  const api = { coverLine, minute: { play } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
