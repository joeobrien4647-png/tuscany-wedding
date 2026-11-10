// The dock's cards: one full-screen card at a time over the home screen, in the look of the prototype's letters, with a
// close control. The frame is shared: it opens a card as a dialog, moves focus into it, makes the screen behind inert,
// closes on Escape or the close control and gives focus back to the control that opened it. Each card's content is its
// own entry in CARDS (Reply and Stay here; Travel, Wear, Weekend and Questions are added the same way). Every word and
// name is set with textContent. open(key, ctx, { root, from }) opens a built card, anything else does nothing; close().
(function (root) {
  'use strict';
  const CARD_KEYS = ['reply', 'stay', 'travel', 'wear', 'weekend', 'questions'];
  const STAY_KEYS = ['villa', 'own', 'later'];

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.LOCKS ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};

  // ---------- Stay: what the card shows ----------
  const confirmLabel = (key, w) => w.stay.confirm[key];

  // The three options, the pick (the saved choice, or villa) and whether the choice is fixed now.
  // The share line, spring and the quiet word live only inside the villa option.
  function stayView(household, nowMs, w) {
    const choice = household && household.stay && household.stay.choice;
    const picked = STAY_KEYS.indexOf(choice) >= 0 ? choice : 'villa';
    const locked = !core.canChangeStay(household, nowMs);
    const options = STAY_KEYS.map(key => {
      const s = w.stay[key], villa = key === 'villa';
      return {
        key, title: s.title, sub: s.sub, get: s.get.slice(), need: s.need.slice(),
        tag: villa ? w.stay.recommended : null,
        share: villa ? core.shareLine(w.stay.share, core.comingCount(household)) : null,
        word: villa ? w.stay.word : null
      };
    });
    return { options, picked, locked, note: locked ? w.stay.fixed : null, confirm: confirmLabel(picked, w) };
  }

  // Saves the choice. On success ctx.household becomes a new object (the home screen's stale-read guard compares by
  // identity); on failure it is left exactly as it was. Resolves true or false.
  function saveStayChoice(store, ctx, choice) {
    const token = (ctx.invite && ctx.invite.token) || '';
    return Promise.resolve(store.saveStay(token, choice)).then(function (ok) {
      if (!ok) return false;
      ctx.household = Object.assign({}, ctx.household, { stay: { choice, at: ctx.now() } });
      return true;
    }, () => false);
  }

  // ---------- Reply: what the card shows ----------
  // Who is coming by name, only when the invitation has more than one person; change only while replies are open.
  function replyView(invite, household, nowMs, w) {
    const reply = (household && household.reply) || null;
    const people = invite && Array.isArray(invite.people) ? invite.people : [];
    const coming = reply && people.length > 1 && Array.isArray(reply.coming) ? people.filter((n, i) => reply.coming[i] === true) : [];
    const open = core.repliesOpen(nowMs);
    return {
      kicker: w.ask.replied,
      title: reply && reply.answer === 'no' ? w.no.title : w.yes.title,
      comingLabel: w.replyCard.coming, coming,
      canChange: open,
      until: open ? core.fill(w.no.until, { date: core.ukDate(core.REPLIES_CLOSE_MS - 1) }) : null,
      closed: open ? null : w.replyCard.closed
    };
  }

  // "Not you?": forget the invitation on this phone and load the page again, never with the token.
  function notYou(invite, loc) {
    if (invite && typeof invite.forget === 'function') invite.forget();
    const args = new URLSearchParams(loc.search || '');
    args.delete('w');
    const rest = args.toString();
    loc.replace(loc.pathname + (rest ? '?' + rest : ''));
  }

  // ---------- the frame ----------
  const svg = (inner, size) => '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const ICON = {
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    tick: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'
  };
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };
  const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  function focus(e) { try { e.focus({ preventScroll: true }); } catch (err) { /* not focusable */ } }

  // Each built card: CARDS[key] = { build(card) }. card is what the frame hands a builder:
  //   card.body        the element to fill          card.heading(title, kicker)  sets the title (and an optional kicker)
  //   card.ctx, card.w, card.first                  card.el(tag, cls, text), card.button(cls, text, onClick)
  //   card.rise(e)     marks e to rise in, in order card.close(opts)  closes it ({ quiet: true }: no sound, no focus back)
  //   card.live()      false once the card is gone  card.saved()  closes it and repaints the home screen's dock
  //   card.host        the #first element
  // The card's background and anything else it needs is styled under #first .fc-<key>.
  const CARDS = {};
  let current = null, listening = false;

  function open(key, ctx, opts) {
    const spec = CARD_KEYS.indexOf(key) >= 0 ? CARDS[key] : null;
    if (!spec || typeof document === 'undefined' || !ctx) return false;
    const o = opts || {}, first = root.sjFirst || {}, w = first.words;
    const host = o.root || document.getElementById('first');
    if (!host || !w) return false;
    if (typeof ctx.now !== 'function') ctx.now = Date.now;
    close({ quiet: true });

    const box = el('div', 'fc');
    const card = el('section', 'fm-screen fc-card fc-' + key);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'fc-h');
    box.appendChild(card);
    card.appendChild(el('div', 'fc-bg'));
    const inner = el('div', 'fc-inner');
    const kicker = el('p', 'fm-kicker fc-rise');
    kicker.hidden = true;
    const h = el('h2', 'fc-t fc-rise');
    h.id = 'fc-h';
    h.tabIndex = -1;
    const body = el('div', 'fc-body');
    inner.appendChild(kicker);
    inner.appendChild(h);
    inner.appendChild(body);
    card.appendChild(inner);
    const shut = button('fm-round fc-close', null, () => close());
    shut.innerHTML = ICON.close;
    shut.setAttribute('aria-label', w.home.close);
    card.appendChild(shut);

    const r = { key, box, host, opener: o.from || document.activeElement, behind: [] };
    const api = {
      body, ctx, w, first, host, el, button,
      heading(title, kick) { h.textContent = title; kicker.textContent = kick || ''; kicker.hidden = !kick; },
      rise(e) { e.classList.add('fc-rise'); return e; },
      live: () => current === r,
      close: opts2 => { if (current === r) close(opts2); },
      saved() {
        if (current === r) close();
        if (first.home && typeof first.home.repaint === 'function') first.home.repaint();
      }
    };
    spec.build(api);

    host.appendChild(box);
    // The screen behind cannot be reached by tab or a screen reader while the card is open.
    Array.from(host.children).forEach(e => {
      if (e === box || e.inert) return;
      r.behind.push({ e, hidden: e.getAttribute('aria-hidden') });
      e.inert = true;
      e.setAttribute('aria-hidden', 'true');
    });
    Array.from(box.querySelectorAll('.fc-rise')).forEach((e, i) => e.style.setProperty('--i', String(i)));
    current = r;
    listen();
    focus(h);
    return true;
  }

  function close(opts) {
    const r = current, o = opts || {}, first = root.sjFirst || {};
    current = null;
    if (!r) return;
    r.behind.forEach(b => {
      b.e.inert = false;
      if (b.hidden === null) b.e.removeAttribute('aria-hidden'); else b.e.setAttribute('aria-hidden', b.hidden);
    });
    if (r.box.parentNode) r.box.parentNode.removeChild(r.box);
    if (o.quiet) return;
    if (first.sound) first.sound.pop(0.4);
    if (r.opener && r.opener.isConnected) focus(r.opener);
  }

  // Escape closes; Tab stays inside the card (for browsers without inert).
  function onKey(e) {
    const r = current;
    if (!r) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = Array.from(r.box.querySelectorAll(FOCUSABLE)).filter(x => x.getClientRects().length);
    if (!list.length) return;
    const a = document.activeElement, head = list[0], tail = list[list.length - 1], inside = r.box.contains(a);
    if (e.shiftKey && (a === head || !inside)) { e.preventDefault(); focus(tail); }
    else if (!e.shiftKey && (a === tail || !inside)) { e.preventDefault(); focus(head); }
  }
  function listen() {
    if (listening) return;
    listening = true;
    document.addEventListener('keydown', onKey);
  }

  // ---------- the Reply card ----------
  CARDS.reply = {
    build(card) {
      const { ctx, w, first } = card;
      const v = replyView(ctx.invite, ctx.household, ctx.now(), w);
      card.heading(v.title, v.kicker);
      if (v.coming.length) {
        const grp = card.rise(card.el('div', 'fc-grp'));
        grp.appendChild(card.el('span', 'fc-grp-k', v.comingLabel));
        const list = card.el('ul', 'fc-names');
        v.coming.forEach(name => {
          const li = card.el('li');
          li.innerHTML = ICON.tick;
          li.appendChild(card.el('span', null, name));
          list.appendChild(li);
        });
        grp.appendChild(list);
        card.body.appendChild(grp);
      }
      if (v.canChange) {
        card.body.appendChild(card.rise(card.el('p', 'fc-p', v.until)));
        card.body.appendChild(card.rise(card.button('fr-btn fr-ghost fc-change', w.ask.change, change)));
      } else {
        card.body.appendChild(card.rise(card.el('p', 'fc-p', v.closed)));
      }
      card.body.appendChild(card.rise(card.button('fr-link fc-notyou', w.home.notYou, () => notYou(root.sjInvite, root.location))));

      // Through the reply's own change flow: it reads the household again, then asks; a yes lands home, a no can't-come.
      function change() {
        const host = card.host;
        card.close({ quiet: true });
        if (first.home && typeof first.home.clear === 'function') first.home.clear();
        first.reply.show({ root: host, ctx, mode: 'change' });
      }
    }
  };

  // ---------- the Stay card ----------
  // Ported from the prototype's stay screen: options that open to show "You get" and "You need to", one confirm
  // button whose label follows the pick. A choice, not a request: confirming ticks the dock straight away.
  CARDS.stay = {
    build(card) {
      const { ctx, w, first } = card, S = first.sound;
      const view = stayView(ctx.household, ctx.now(), w);
      let picked = view.picked, busy = false, failed = false;
      card.heading(w.stay.title);

      const opts = card.el('div', 'fc-opts');
      opts.setAttribute('role', 'group');
      opts.setAttribute('aria-labelledby', 'fc-h');
      const items = view.options.map(o => {
        const box = card.rise(card.el('div', 'fc-opt'));
        const head = card.button('fc-opt-head', null, () => pick(o.key));
        head.setAttribute('aria-pressed', 'false');
        head.setAttribute('aria-expanded', 'false');
        head.disabled = view.locked;
        head.appendChild(card.el('span', 'fc-radio'));
        head.lastChild.setAttribute('aria-hidden', 'true');
        const t = card.el('span', 'fc-opt-t');
        t.appendChild(card.el('span', 'fc-opt-title', o.title));
        t.appendChild(card.el('span', 'fc-opt-sub', o.sub));
        head.appendChild(t);
        if (o.tag) head.appendChild(card.el('span', 'fc-opt-tag', o.tag));
        box.appendChild(head);

        const more = card.el('div', 'fc-opt-more');
        const moreIn = card.el('div', 'fc-opt-more-in');
        const optBody = card.el('div', 'fc-opt-body');
        const get = card.el('div', 'fc-grp');
        get.appendChild(card.el('span', 'fc-grp-k', w.stay.get));
        const getList = card.el('ul', 'fc-get');
        o.get.forEach(line => {
          const li = card.el('li');
          li.innerHTML = ICON.tick;
          li.appendChild(card.el('span', null, line));
          getList.appendChild(li);
        });
        get.appendChild(getList);
        if (o.share) get.appendChild(card.el('p', 'fc-share', o.share));
        optBody.appendChild(get);
        const need = card.el('div', 'fc-grp');
        need.appendChild(card.el('span', 'fc-grp-k', w.stay.need));
        const needList = card.el('ol', 'fc-todo');
        o.need.forEach(line => needList.appendChild(card.el('li', null, line)));
        need.appendChild(needList);
        optBody.appendChild(need);
        if (o.word) optBody.appendChild(card.el('p', 'fc-word', o.word));
        moreIn.appendChild(optBody);
        more.appendChild(moreIn);
        box.appendChild(more);
        opts.appendChild(box);
        return { key: o.key, box, head };
      });
      card.body.appendChild(opts);

      // One line under the options: the choice is fixed, the save is under way, or it failed. Never more than one.
      const fixed = card.el('p', 'fc-note', view.note);
      fixed.hidden = !view.note;
      const saving = card.el('p', 'fc-note fc-saving', w.stay.saving);
      saving.setAttribute('role', 'status');
      saving.hidden = true;
      const note = card.el('p', 'fc-note');
      note.setAttribute('role', 'alert');
      note.hidden = true;
      // The wrapper rises in, so the button's own saving pulse never restarts that animation.
      const goWrap = card.rise(card.el('div', 'fc-go-wrap'));
      const go = card.button('fr-btn fr-gold fc-go', view.confirm, confirm);
      go.disabled = view.locked;
      goWrap.appendChild(go);
      [fixed, saving, note, goWrap].forEach(e => card.body.appendChild(e));

      function paint(key) {
        items.forEach(i => {
          const on = i.key === key;
          i.box.classList.toggle('fc-on', on);
          i.head.setAttribute('aria-pressed', on ? 'true' : 'false');
          i.head.setAttribute('aria-expanded', on ? 'true' : 'false');
        });
        go.textContent = confirmLabel(key, w);
      }
      function pick(key) {
        if (busy || view.locked || key === picked && !failed) return;
        picked = key;
        failed = false;
        note.hidden = true;
        paint(key);
        if (S) S.pop(0.5);
        haptic(8);
      }
      function setBusy(on) {
        busy = on;
        items.forEach(i => { i.head.disabled = on; });
        go.disabled = on;
        go.classList.toggle('fr-busy', on);
        if (on) go.setAttribute('aria-busy', 'true'); else go.removeAttribute('aria-busy');
        saving.hidden = !on;
      }
      function confirm() {
        if (busy) return;
        if (view.locked) return;
        const choice = picked;
        note.hidden = true;
        setBusy(true);
        saveStayChoice(first.store, ctx, choice).then(function (ok) {
          if (!card.live()) { busy = false; if (ok) card.saved(); return; }
          setBusy(false);
          if (!ok) {
            failed = true;
            note.textContent = w.errors.save;
            note.hidden = false;
            go.textContent = w.errors.retry;
            return;
          }
          if (S) S.pop();
          haptic(14);
          card.saved();
        });
      }
      paint(picked);
    }
  };

  const api = { CARD_KEYS, stayView, confirmLabel, saveStayChoice, replyView, notYou,
    cards: { open, close, built: () => Object.keys(CARDS) } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
