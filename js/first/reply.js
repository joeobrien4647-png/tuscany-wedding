// The reply: "Are you coming?", its answers, and the quiet screens around it (can't come, already replied, replies
// closed, no link, one moment). One screen shows at a time, over the minute's stage; every word is set with textContent.
// show({ root, ctx, mode, onSaved }) with mode 'ask' | 'closed' | 'nolink' | 'cantcome' | 'already', plus 'wait'
// (with onRetry and failed) for app.js. ask also takes onWatch, a way to watch the invitation again.
(function (root) {
  'use strict';
  const HOME_AFTER_MS = 3200, HOME_AFTER_REDUCED_MS = 900, ALREADY_MS = 2400, WAIT_MS = 15000;

  // who: 'all', 'none', or the index of the one person coming. Never an empty coming, never a yes with nobody coming.
  function replyFor(people, who) {
    const count = Array.isArray(people) ? people.length : 0;
    const everyone = value => Array.from({ length: Math.max(1, count) }, () => value);
    if (who === 'all') return { answer: 'yes', coming: everyone(true) };
    if (who === 'none') return { answer: 'no', coming: everyone(false) };
    if (Number.isInteger(who) && who >= 0 && who < count) {
      const coming = everyone(false);
      coming[who] = true;
      return { answer: 'yes', coming };
    }
    return null;
  }

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };

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
  function heading(cls, text) {
    const h = el('h2', cls, text);
    h.tabIndex = -1;
    return h;
  }

  let current = null;

  // Takes the current screen away and stops its timers and any fireworks still running.
  function clear() {
    const fx = root.sjFirst && root.sjFirst.fx;
    if (fx && typeof fx.stop === 'function') fx.stop();
    const r = current;
    current = null;
    if (!r) return;
    r.timers.forEach(t => root.clearTimeout(t));
    if (r.box.parentNode) r.box.parentNode.removeChild(r.box);
  }

  function celebrate(first) {
    if (first.sound) first.sound.chime();
    haptic([12, 50, 18]);
    if (first.fx) first.fx.show();
  }

  function show(opts) {
    const o = opts || {}, first = root.sjFirst || {}, w = first.words;
    const ctx = o.ctx || {};
    if (typeof ctx.now !== 'function') ctx.now = Date.now;
    const invite = ctx.invite || null, people = invite && Array.isArray(invite.people) ? invite.people : [];
    clear();
    const box = el('div', 'fr');
    o.root.appendChild(box);
    o.root.hidden = false;
    const r = { box, timers: [] };
    current = r;
    const live = () => current === r;
    const after = (ms, fn) => { r.timers.push(root.setTimeout(() => { if (live()) fn(); }, ms)); };
    const again = mode => show(Object.assign({}, o, { mode }));
    const open = () => first.repliesOpen(ctx.now());
    function goHome() {
      const home = first.home;
      if (home && typeof home.show === 'function') { clear(); home.show({ root: o.root, ctx }); }
    }
    function screen(cls) {
      const s = el('section', 'fm-screen ' + cls);
      box.appendChild(s);
      return s;
    }
    function focus(h) { try { h.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ } }

    function centre(kicker, title, line) {
      const s = screen('fr-center');
      if (kicker) s.appendChild(el('p', 'fm-kicker', kicker));
      const h = heading('fr-title', title);
      s.appendChild(h);
      if (line) s.appendChild(el('p', 'fm-sub fr-line', line));
      after(30, () => focus(h));
      return s;
    }
    // The change control on the can't-come and already-replied screens: only while replies are open.
    function changeControl(s, label, cls) {
      if (open()) s.appendChild(button(cls, label, () => again('ask')));
    }

    const mode = o.mode;
    if (mode === 'ask') return ask();
    if (mode === 'yes') {
      centre(null, w.yes.title, w.yes.line).classList.add('fr-yes');
      after(reduced() ? HOME_AFTER_REDUCED_MS : HOME_AFTER_MS, goHome);
      return;
    }
    if (mode === 'cantcome') {
      const s = centre(null, w.no.title, open() ? w.no.line : w.closed.message);
      changeControl(s, w.no.again, 'fr-btn fr-gold fr-wide');
      return;
    }
    if (mode === 'already') {
      const yes = !!(ctx.household && ctx.household.reply && ctx.household.reply.answer === 'yes');
      const s = centre(w.ask.replied, yes ? w.yes.title : w.no.title, open() ? null : w.closed.message);
      changeControl(s, w.ask.change, 'fr-btn fr-ghost fr-wide');
      if (yes) after(ALREADY_MS, goHome);
      return;
    }
    if (mode === 'closed') { centre(null, w.closed.line, w.closed.message); return; }
    if (mode === 'nolink') { centre(w.cover.kicker, w.nolink.line, null).classList.add('fr-nolink'); return; }
    if (mode === 'wait') {
      const s = screen('fr-center fr-wait');
      s.appendChild(el('p', 'fm-sub fr-line', w.wait.line));
      const failedNote = el('p', 'fr-err', w.errors.load);
      failedNote.setAttribute('role', 'alert');
      const retry = button('fr-btn fr-ghost fr-wide', w.errors.retry, () => { if (typeof o.onRetry === 'function') o.onRetry(); });
      const offerRetry = () => { s.appendChild(failedNote); s.appendChild(retry); };
      if (o.failed) offerRetry(); else after(WAIT_MS, offerRetry);
      return;
    }

    function ask() {
      const reply = ctx.household && ctx.household.reply;
      let busy = false, last = null;
      const s = screen('fr-ask');
      const panel = el('div', 'fr-panel');
      panel.setAttribute('role', 'group');
      s.appendChild(panel);
      const by = el('p', 'fr-by', first.fill(w.ask.closesNote, { date: first.ukDate(first.REPLIES_CLOSE_MS - 1) }));
      const q = heading('fr-q', w.ask.question);
      q.id = 'fr-q';
      panel.setAttribute('aria-labelledby', 'fr-q');
      panel.appendChild(by);
      panel.appendChild(q);

      const choices = el('div', 'fr-choices');
      const yes = button('fr-btn fr-gold', w.ask.yes, () => send(replyFor(people, 'all'), [yes]));
      const row = el('div', 'fr-row');
      let onlyOne = null;
      if (people.length > 1) {
        onlyOne = button('fr-btn fr-ghost', w.ask.onlyOne, pickWho);
        row.appendChild(onlyOne);
      }
      const no = button('fr-btn fr-ghost', w.ask.no, () => send(replyFor(people, 'none'), [no]));
      row.appendChild(no);
      choices.appendChild(yes);
      choices.appendChild(row);
      panel.appendChild(choices);

      // The "only one of us" route: the household's people by name, each one a reply with just them coming.
      const who = el('div', 'fr-who');
      who.hidden = true;
      const list = el('div', 'fr-people');
      if (people.length > 3) list.classList.add('fr-many');
      const personButtons = people.map((name, i) => {
        const b = button('fr-btn fr-ghost fr-person', name, () => send(replyFor(people, i), [onlyOne, b]));
        list.appendChild(b);
        return b;
      });
      who.appendChild(list);
      who.appendChild(button('fr-link', w.ask.back, () => { if (!busy) showChoices(); }));
      panel.appendChild(who);

      const note = el('p', 'fr-err');
      note.setAttribute('role', 'alert');
      note.hidden = true;
      const retry = button('fr-link', w.errors.retry, () => { if (last) send(last.reply, last.chosen); });
      retry.hidden = true;
      panel.appendChild(note);
      panel.appendChild(retry);
      if (typeof o.onWatch === 'function') panel.appendChild(button('fr-link fr-watch', w.ask.watchAgain, () => { if (!busy) o.onWatch(); }));

      const all = [yes, no].concat(onlyOne ? [onlyOne] : [], personButtons);
      function mark(chosen) {
        all.forEach(b => { b.classList.remove('fr-on'); b.removeAttribute('aria-pressed'); });
        chosen.filter(Boolean).forEach(b => { b.classList.add('fr-on'); b.setAttribute('aria-pressed', 'true'); });
      }
      function pickWho() {
        if (busy) return;
        choices.hidden = true; who.hidden = false;
        q.textContent = w.ask.who;
        focus(q);
      }
      function showChoices() {
        who.hidden = true; choices.hidden = false;
        q.textContent = w.ask.question;
        focus(q);
      }

      // The answer already given, when they come back to change it.
      if (reply) {
        const someone = Array.isArray(reply.coming) ? reply.coming.indexOf(true) : -1;
        const partly = reply.answer === 'yes' && onlyOne && reply.coming.some(c => !c);
        if (reply.answer === 'no') mark([no]);
        else if (partly) mark([onlyOne, personButtons[someone]]);
        else mark([yes]);
      }

      function send(choice, chosen) {
        if (busy || !choice) return;
        if (!open()) { again('closed'); return; }
        busy = true;
        last = { reply: choice, chosen };
        mark(chosen);
        note.hidden = true; retry.hidden = true;
        all.forEach(b => { b.disabled = true; });
        panel.setAttribute('aria-busy', 'true');
        const token = invite ? invite.token : '';
        first.store.saveReply(token, choice).then(function (ok) {
          if (!live()) return;
          busy = false;
          panel.removeAttribute('aria-busy');
          all.forEach(b => { b.disabled = false; });
          if (!ok) {
            note.textContent = w.errors.save;
            note.hidden = false;
            retry.hidden = false;
            return;
          }
          saved(choice);
        });
      }
      function saved(choice) {
        ctx.household = Object.assign({}, ctx.household, { reply: { answer: choice.answer, coming: choice.coming, at: ctx.now() } });
        if (typeof o.onSaved === 'function') o.onSaved(ctx.household.reply);
        if (choice.answer !== 'yes') {
          if (first.sound) first.sound.pop(0.7);
          again('cantcome');
          return;
        }
        again('yes');
        celebrate(first);
      }
      after(30, () => focus(q));
    }
  }

  const api = { replyFor, reply: { show, clear } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
