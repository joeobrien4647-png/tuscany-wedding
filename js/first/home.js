// The home screen: the one calm screen a guest lives on after saying yes. A big countdown to the wedding, a small one to
// the next envelope, the six envelopes (all sealed in phase 1) and the dock of five, with Questions, the sound toggle
// and a way to watch the invitation again. Ported from the first-minute prototype; every word is set with textContent.
// show({ root, ctx }) draws it and ticks once a second; refresh() reads the household again (also when the page is
// visible again) and leaves for the can't-come screen if the answer is now no. Cards open through cards.open when it exists;
// repaint() paints the dock again after a card has saved, without a read.
(function (root) {
  'use strict';
  const TOAST_MS = 2300, COUNT_UP_MS = 1300;
  const DOCK_KEYS = ['reply', 'stay', 'travel', 'wear', 'weekend'];
  const DOCK_ICONS = ['reply', 'stay', 'drive', 'wear', 'weekend'];

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.LOCKS ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};

  const pad = n => String(n).padStart(2, '0');
  const clockText = (c, u) => c.hours + ' ' + u.h + ' ' + pad(c.minutes) + ' ' + u.m + ' ' + pad(c.seconds) + ' ' + u.s;

  // The six envelopes as the screen shows them. In phase 1 none has content, so every one is sealed.
  function envelopes(nowMs, w) {
    return core.LOCKS.map(lock => {
      const name = w.home.envelopes[lock.key].name;
      const stamp = lock.opensMs === null ? w.home.photosStamp : core.ukDate(lock.opensMs);
      // Past its date with nothing inside yet: it is nearly ready, never "opens" on a date gone by.
      const due = lock.opensMs !== null && nowMs >= lock.opensMs;
      return {
        key: lock.key, name, stamp,
        state: core.lockState(lock, nowMs, false),
        label: name + ', ' + (due ? w.home.soon : core.fill(w.home.sealed, { date: stamp })),
        toast: due ? w.home.soon : core.fill(w.home.opens, { date: stamp })
      };
    });
  }

  // The five dock items: plain, glowing (something to do) or done. Only the reply and the stay choice change them.
  function dockItems(household, w, travelStamped) {
    const states = core.dockStates(household, travelStamped);
    return DOCK_KEYS.map((key, i) => {
      const label = key === 'stay' ? core.stayLabel(household, w.dock.stay) : w.dock.labels[i];
      const state = states[key];
      return { key, label, state, aria: label + ', ' + w.dock.states[state] };
    });
  }

  // Whether this phone holds a stamped Getting there ticket for this invitation.
  function travelStamped(ctx) {
    const store = (root.sjFirst || {}).store, token = ctx && ctx.invite && ctx.invite.token;
    return !!(store && store.travelCopy && token) && store.travelCopy.read(token).tickets.some(Boolean);
  }

  function bigCount(nowMs, w) {
    const c = core.countdown(core.WEDDING_MS, nowMs);
    return { days: c.days, label: c.days === 1 ? w.home.countdownOne : w.home.countdown, clock: clockText(c, w.home.units) };
  }

  // The next envelope by name and how long until it opens, or null after the last dated one.
  function nextLine(nowMs, w) {
    const lock = core.nextLock(nowMs);
    if (!lock) return null;
    const c = core.countdown(lock.opensMs, nowMs);
    const when = c.days >= 2 ? core.fill(w.home.nextIn, { n: c.days })
      : c.days === 1 ? w.home.nextDay : core.fill(w.home.nextSoon, { n: clockText(c, w.home.units) });
    return w.home.envelopes[lock.key].name + ' ' + when;
  }

  // What a fresh read of the household does: no clear answer keeps the screen, a no leaves for can't come, and no
  // reply at all (cleared or deleted) goes back to the question while replies are open, to the closed screen after.
  function afterRefresh(household, nowMs) {
    if (household === undefined || (household !== null && typeof household !== 'object')) return 'keep';
    const reply = household && household.reply;
    if (!reply) return core.repliesOpen(nowMs) ? 'ask' : 'closed';
    return reply.answer === 'no' ? 'cantcome' : 'render';
  }

  // Whether a fresh read brings a different stay choice (a partner chose on their own phone).
  const choiceOf = h => (h && h.stay && h.stay.choice) || null;
  const stayChanged = (before, after) => choiceOf(before) !== choiceOf(after);

  const svg = (inner, size) => '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const ICON = {
    reply: svg('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/>'),
    stay: svg('<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>'),
    drive: svg('<path d="M12 21s-6-5.4-6-10.6a6 6 0 0 1 12 0C18 15.6 12 21 12 21z"/><circle cx="12" cy="10.4" r="2.2"/>'),
    wear: svg('<path d="M12 8.5a2 2 0 1 0-2-2"/><path d="M12 8.5v1.6l8.2 5.6a1.2 1.2 0 0 1-.7 2.2H4.5a1.2 1.2 0 0 1-.7-2.2L12 10.1"/>'),
    weekend: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 16),
    soundOn: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a7.8 7.8 0 0 1 0 11.2"/>'),
    soundOff: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>')
  };
  // The envelope's flap and its wax seal (the minute's seal art, drawn small).
  const FLAP = '<svg class="fh-flap" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0 L50 46 L100 0" fill="rgba(245, 236, 220, .04)" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
  const WAX = '<svg class="fh-wax" viewBox="-20 -20 240 240" aria-hidden="true" focusable="false"><use href="#fm-seal-art"/></svg>';

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };
  const nameSize = text => (text.length > 28 ? 'longer' : text.length > 16 ? 'long' : '');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  let current = null, listening = false;

  // The minute's own sound button sits over every screen; the home screen has its own in its place.
  function minuteSound(host, hide) {
    const b = host && host.querySelector('.fm .fm-sound');
    if (b) b.hidden = hide;
  }

  // Takes the home screen away: any open card closes, its clock and toast stop, and the minute's sound button comes back.
  function clear() {
    const cards = root.sjFirst && root.sjFirst.cards;
    if (cards && typeof cards.close === 'function') cards.close({ quiet: true });
    const r = current;
    current = null;
    if (!r) return;
    root.clearInterval(r.clock);
    root.clearTimeout(r.toastTimer);
    r.anims.forEach(a => { try { a.cancel(); } catch (e) { /* already gone */ } });
    if (r.box.parentNode) r.box.parentNode.removeChild(r.box);
    minuteSound(r.host, false);
  }

  function show(opts) {
    const o = opts || {}, first = root.sjFirst || {}, w = first.words, S = first.sound;
    const ctx = o.ctx || {};
    if (typeof ctx.now !== 'function') ctx.now = Date.now;
    clear();
    if (first.reply && typeof first.reply.clear === 'function') first.reply.clear();
    const host = o.root;
    const box = el('div', 'fh');
    host.appendChild(box);
    host.hidden = false;
    minuteSound(host, true);
    const r = { box, host, ctx, clock: 0, toastTimer: 0, toastGen: 0, anims: [], counting: false, seq: 0 };
    current = r;
    const live = () => current === r;
    const REDUCE = reduced();

    function anim(e, frames, a) {
      if (!e || !e.animate) return null;
      const made = e.animate(frames, Object.assign({ duration: 700, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }, a));
      r.anims.push(made);
      made.addEventListener('finish', () => { const i = r.anims.indexOf(made); if (i >= 0) r.anims.splice(i, 1); });
      return made;
    }
    const rise = (e, delay, d) => anim(e, REDUCE ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: d || 700, delay: delay || 0 });

    const s = el('section', 'fm-screen fh-trip');
    s.setAttribute('aria-labelledby', 'fh-h');
    box.appendChild(s);
    const inner = el('div', 'fh-inner');
    s.appendChild(inner);

    // Hello: the kicker and the household's name.
    const hello = el('header', 'fh-hello');
    const name = first.coverLine ? first.coverLine(ctx.invite) : '';
    const kicker = el('p', 'fm-kicker', w.home.kicker);
    const h = el('h2', 'fh-name', name || w.home.kicker);
    h.id = 'fh-h';
    h.tabIndex = -1;
    const size = nameSize(h.textContent);
    if (size) h.setAttribute('data-size', size);
    kicker.hidden = !name;
    hello.appendChild(kicker);
    hello.appendChild(h);
    inner.appendChild(hello);

    // The big countdown and the small one.
    const count = el('div', 'fh-count');
    const days = el('span', 'fh-count-n', '0');
    const side = el('span', 'fh-count-side');
    const daysLabel = el('span', 'fh-count-l');
    const clockEl = el('span', 'fh-clock');
    side.appendChild(daysLabel);
    side.appendChild(clockEl);
    const todayEl = el('span', 'fh-today', w.home.today);
    todayEl.hidden = true;
    count.appendChild(days);
    count.appendChild(side);
    count.appendChild(todayEl);
    inner.appendChild(count);
    const next = el('p', 'fh-next');
    const nextIcon = el('span', 'fh-next-i');
    nextIcon.innerHTML = ICON.lock;
    const nextText = el('span', 'fh-next-t');
    next.appendChild(nextIcon);
    next.appendChild(nextText);
    inner.appendChild(next);

    // The envelopes: each sealed one says when it opens.
    const grid = el('div', 'fh-envs');
    const envButtons = envelopes(ctx.now(), w).map(env => {
      const b = button('fh-env fh-' + env.state, null, () => tapEnvelope(b, env));
      b.setAttribute('aria-label', env.label);
      b.innerHTML = FLAP + WAX;
      b.appendChild(el('span', 'fh-env-t', env.name));
      b.appendChild(el('span', 'fh-env-d', env.stamp));
      grid.appendChild(b);
      return b;
    });
    inner.appendChild(grid);

    // The dock.
    const dock = el('nav', 'fh-dock');
    dock.setAttribute('aria-label', w.dock.label);
    const dockButtons = DOCK_KEYS.map((key, i) => {
      const b = button('fh-dk', null, () => openCard(key, b));
      const ico = el('span', 'fh-ico');
      ico.innerHTML = ICON[DOCK_ICONS[i]];
      b.appendChild(ico);
      b.appendChild(el('span', 'fh-dk-t'));
      dock.appendChild(b);
      return b;
    });
    inner.appendChild(dock);

    // The foot: Questions and watch again.
    const foot = el('div', 'fh-foot');
    const questions = button('fh-link', w.home.questions, () => openCard('questions', questions));
    foot.appendChild(questions);
    foot.appendChild(button('fh-link', w.home.watch, watchAgain));
    inner.appendChild(foot);

    const soundBtn = button('fm-round fh-sound', null, () => { if (!S) return; S.unlock(); S.toggle(); soundIcon(); });
    box.appendChild(soundBtn);
    function soundIcon() {
      const on = !!(S && S.on());
      soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', on ? w.minute.soundOn : w.minute.soundOff);
    }
    soundIcon();

    const toastEl = el('p', 'fh-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.hidden = true;
    box.appendChild(toastEl);

    // from: the control that opened the card, so focus goes back to it when the card closes.
    function openCard(key, from) {
      const cards = first.cards;
      if (cards && typeof cards.open === 'function') cards.open(key, ctx, { root: host, from });
    }
    function tapEnvelope(b, env) {
      if (!REDUCE) anim(b, [{ transform: 'none' }, { transform: 'translateX(-6px) rotate(-1deg)' }, { transform: 'translateX(5px) rotate(1deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 500, easing: 'ease', fill: 'none' });
      if (S) S.pop(0.4);
      haptic([8, 40, 8]);
      toast(env.toast);
    }
    function toast(text) {
      const gen = ++r.toastGen;
      toastEl.textContent = text;
      toastEl.hidden = false;
      anim(toastEl, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 300 });
      root.clearTimeout(r.toastTimer);
      r.toastTimer = root.setTimeout(() => {
        if (!live() || gen !== r.toastGen) return;
        const a = anim(toastEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        if (a) a.onfinish = () => { if (gen === r.toastGen) toastEl.hidden = true; }; else toastEl.hidden = true;
      }, TOAST_MS);
    }
    function watchAgain() {
      if (!first.minute) return;
      clear();
      first.minute.play({ root: host, invite: ctx.invite, onDone: () => land(host, ctx) });
    }

    function paintDock() {
      dockItems(ctx.household, w, travelStamped(ctx)).forEach((item, i) => {
        const b = dockButtons[i];
        b.className = 'fh-dk fh-' + item.state;
        b.setAttribute('aria-label', item.aria);
        b.lastChild.textContent = item.label;
      });
    }
    function tick() {
      const now = ctx.now(), c = bigCount(now, w), line = nextLine(now, w);
      // On the wedding day the countdown says so; after it, the countdown goes.
      const day = core.weddingDay(now);
      count.hidden = day === 'after';
      days.hidden = side.hidden = day !== 'before';
      todayEl.hidden = day !== 'today';
      if (!r.counting) days.textContent = String(c.days);
      daysLabel.textContent = c.label;
      clockEl.textContent = c.clock;
      next.hidden = line === null;
      if (line !== null) nextText.textContent = line;
      return c.days;
    }
    function countUp(to) {
      if (REDUCE || !root.requestAnimationFrame || !to) return;
      r.counting = true;
      const t0 = root.performance.now();
      const step = t => {
        if (!live()) return;
        const k = Math.min(1, (t - t0) / COUNT_UP_MS);
        days.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) root.requestAnimationFrame(step); else r.counting = false;
      };
      days.textContent = '0';
      root.requestAnimationFrame(step);
    }

    r.paint = paintDock;
    r.toast = toast;
    paintDock();
    countUp(tick());
    r.clock = root.setInterval(() => { if (live()) tick(); }, 1000);
    [hello, count, next].forEach((e, i) => rise(e, 80 + i * 90));
    envButtons.forEach((e, i) => rise(e, 300 + i * 70, 650));
    [dock, foot].forEach((e, i) => rise(e, 380 + i * 90));
    root.setTimeout(() => { if (live()) { try { h.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ } } }, 350);
    listen();
  }

  // Reads the household, then lands: home with the fresh answer, the can't-come screen for a no.
  // A save that lands while the read is out wins: the read is dropped and the household as it is now decides.
  function land(host, ctx) {
    const first = root.sjFirst || {}, token = ctx.invite && ctx.invite.token;
    const done = household => {
      const next = afterRefresh(household, ctx.now());
      if (next !== 'keep') ctx.household = household;
      if (next === 'render' || next === 'keep') show({ root: host, ctx });
      else first.reply.show({ root: host, ctx, mode: next });
    };
    if (!token || !first.store) { done(undefined); return; }
    readFresh({ seq: 0, ctx }, first.store.load, done, () => done(ctx.household));
  }

  // Applies a read only if it is the newest one and the household was not replaced meanwhile; otherwise stale() if given.
  function readFresh(r, load, apply, stale) {
    const seq = ++r.seq, householdAtStart = r.ctx.household;
    return load(r.ctx.invite.token).then(function (household) {
      if (seq !== r.seq || r.ctx.household !== householdAtStart) { if (typeof stale === 'function') stale(); return; }
      apply(household);
    });
  }

  // A short message on the home screen (a card's save that failed after the card was closed).
  function toastHome(text) {
    if (current && typeof current.toast === 'function') current.toast(text);
  }

  // Paints the dock again from ctx.household, without a read (after a card has saved).
  function repaint() {
    if (current && typeof current.paint === 'function') current.paint();
  }

  function refresh() {
    const r = current, first = root.sjFirst || {};
    const token = r && r.ctx.invite && r.ctx.invite.token;
    if (!token || !first.store) return Promise.resolve();
    return readFresh(r, first.store.load, function (household) {
      if (current !== r) return;
      const next = afterRefresh(household, r.ctx.now());
      if (next === 'keep') return;
      const changed = stayChanged(r.ctx.household, household);
      r.ctx.household = household;
      // cantcome, ask or closed: the home screen (and any card) goes.
      if (next !== 'render') { clear(); first.reply.show({ root: r.host, ctx: r.ctx, mode: next }); return; }
      // A partner's different stay choice: an open Stay card would overwrite it, so it closes.
      const cards = first.cards;
      if (changed && cards && typeof cards.openKey === 'function' && cards.openKey() === 'stay') cards.close();
      r.paint();
    });
  }

  // Registered once, however many times the home screen is shown.
  function listen() {
    if (listening) return;
    listening = true;
    document.addEventListener('visibilitychange', () => { if (current && document.visibilityState === 'visible') refresh(); });
  }

  const api = { envelopes, dockItems, bigCount, nextLine, afterRefresh, stayChanged, readFresh, home: { show, refresh, repaint, toast: toastHome, clear } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
