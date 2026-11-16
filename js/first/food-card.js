// The food step inside the Reply card: one screen per person coming, each with ten picks that toggle, a short note and
// Back, Next or Done. Edit mode reads the household again first (a partner may have saved theirs meanwhile), then
// saves the whole entry at once. Read mode (after the cut-off) shows what was given, with nothing to change. While the
// step is open the card's close control and Escape step back to the Reply card, saving nothing. Every word is set with
// textContent; the note lives only in the input's value and the save. Loads after food-core.js, words.js and store.js;
// cards.js hands its `card` to show(card, { mode: 'edit' | 'read', onExit: saved => ... }).
(function (root) {
  'use strict';
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
  function focus(e) { try { if (e) e.focus({ preventScroll: true }); } catch (err) { /* not focusable */ } }

  function show(card, opts) {
    const o = opts || {}, first = card.first || root.sjFirst || {}, w = card.w, ctx = card.ctx;
    const food = first.food, store = first.store, S = first.sound;
    const people = ctx.invite && Array.isArray(ctx.invite.people) ? ctx.invite.people : [];
    const token = (ctx.invite && ctx.invite.token) || '';
    const edit = o.mode !== 'read';
    let draft = [], busy = false, failed = false, exited = false, view = null;
    const live = () => !exited && card.live();

    // The close control and Escape step back to the card; a tap while saving is ignored.
    card.beforeClose(() => { if (!busy) exit(false); return true; });
    card.closeLabel(w.food.leave);

    function exit(saved) {
      if (exited) return;
      exited = true;
      card.beforeClose(() => false);
      card.closeLabel();
      if (typeof o.onExit === 'function') o.onExit(saved);
    }
    function empty() { while (card.body.firstChild) card.body.removeChild(card.body.firstChild); }
    const heading = () => root.document.getElementById('fc-h');

    // Edit mode: one screen per person coming, filled from the food as saved. Read mode: one per entry given.
    function begin() {
      if (edit) {
        const h = ctx.household, reply = h && h.reply;
        const coming = reply && reply.answer === 'yes' && Array.isArray(reply.coming) ? reply.coming : [];
        draft = food.startDraft(h && h.food, food.foodScreens(people, coming));
      } else {
        draft = food.foodStatus(ctx.household, people).entries.map(e => ({ i: e.i, name: e.name, picks: e.picks.slice(), note: e.note }));
      }
      if (!draft.length) { exit(false); return; }
      paint(0);
      focus(heading());
    }

    function paint(k) {
      const d = draft[k], last = k === draft.length - 1;
      empty();
      if (food.namesShown(people)) card.heading(d.name, w.food.title); else card.heading(w.food.title);
      const box = card.rise(el('div', 'ff'));
      // The hint and the step line share one row.
      const top = el('div', 'ff-top');
      if (edit) top.appendChild(el('p', 'ff-hint', w.food.hint));
      if (draft.length > 1) top.appendChild(el('p', 'ff-step', first.fill(w.food.step, { n: k + 1, total: draft.length })));
      if (top.firstChild) box.appendChild(top);

      const picks = el('div', 'ff-picks');
      picks.setAttribute('role', 'group');
      picks.setAttribute('aria-labelledby', 'fc-h');
      const pickButtons = food.PICKS.map(key => {
        const b = button('fr-btn fr-ghost ff-pick', w.food.picks[key], () => toggle(key));
        b.disabled = !edit;
        picks.appendChild(b);
        return { key, b };
      });
      box.appendChild(picks);
      function mark() {
        pickButtons.forEach(p => {
          const on = d.picks.indexOf(p.key) >= 0;
          p.b.setAttribute('aria-pressed', on ? 'true' : 'false');
          p.b.classList.toggle('ff-on', on);
        });
      }
      function toggle(key) {
        if (busy || !edit) return;
        d.picks = food.togglePick(d.picks, key);
        mark();
        if (S) S.pop(0.4);
        haptic(8);
      }
      mark();

      let input = null;
      if (edit) {
        const note = el('label', 'ff-note');
        note.appendChild(el('span', 'fc-grp-k', w.food.note));
        input = el('input');
        input.type = 'text';
        input.maxLength = food.NOTE_MAX;
        input.autocomplete = 'off';
        input.setAttribute('autocomplete', 'off');
        input.enterKeyHint = 'done';
        input.setAttribute('enterkeyhint', 'done');
        input.placeholder = w.food.notePlaceholder;
        input.value = d.note;
        input.addEventListener('input', () => { d.note = input.value; });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
        note.appendChild(input);
        box.appendChild(note);
      } else if (d.note) {
        const note = el('div', 'ff-note');
        note.appendChild(el('span', 'fc-grp-k', w.food.note));
        note.appendChild(el('p', 'ff-note-t', d.note));
        box.appendChild(note);
      }

      // One line under the screen at a time: closed, saving, or the failed save.
      const closed = el('p', 'fc-note ff-closed', w.food.closed);
      closed.setAttribute('role', 'status');
      closed.hidden = edit || !last;
      const saving = el('p', 'fr-saving ff-saving', w.food.saving);
      saving.setAttribute('role', 'status');
      saving.hidden = true;
      const err = el('p', 'fr-err ff-err', w.errors.save);
      err.setAttribute('role', 'alert');
      err.hidden = !failed;
      [closed, saving, err].forEach(e => box.appendChild(e));

      const nav = el('div', 'ff-nav');
      const controls = [];
      const add = b => { nav.appendChild(b); controls.push(b); return b; };
      if (k > 0) add(button('fr-btn fr-ghost ff-back', w.food.back, () => go(k - 1)));
      let doneBtn = null;
      if (!last) add(button('fr-btn fr-ghost ff-next', w.food.next, () => go(k + 1)));
      else if (edit) doneBtn = add(button('fr-btn fr-gold ff-done', failed ? w.errors.retry : w.food.done, done));
      else add(button('fr-btn fr-ghost ff-leave', w.food.leave, () => exit(false)));
      box.appendChild(nav);
      card.body.appendChild(box);
      view = { box, closed, saving, err, doneBtn, input, controls: controls.concat(edit ? pickButtons.map(p => p.b) : []) };
    }

    function go(k) {
      if (busy || !live()) return;
      failed = false;
      paint(Math.max(0, Math.min(draft.length - 1, k)));
      if (S) S.pop(0.3);
      focus(heading());
    }

    function setBusy(on) {
      busy = on;
      view.controls.forEach(b => { b.disabled = on; });
      if (view.input) view.input.readOnly = on;
      if (view.doneBtn) {
        view.doneBtn.classList.toggle('fr-busy', on);
        if (on) view.doneBtn.setAttribute('aria-busy', 'true'); else view.doneBtn.removeAttribute('aria-busy');
      }
      if (on) view.box.setAttribute('aria-busy', 'true'); else view.box.removeAttribute('aria-busy');
      view.saving.hidden = !on;
    }

    if (!edit) begin();
    else {
      // Read the household again first, so a partner's save is in the draft. An unclear read keeps what we have.
      empty();
      card.heading(w.food.title);
      card.body.appendChild(card.rise(el('p', 'fc-p ff-wait', w.wait.line)));
      focus(heading());
      Promise.resolve(store.load(token)).then(h => h, () => undefined).then(function (household) {
        if (!live()) return;
        if (household === undefined) { begin(); return; }
        ctx.household = household;
        begin();
      });
    }

    // Done: the cut-off is checked when pressed; one save at a time; the household changes only after a true.
    function done() {
      if (busy) return;
      if (!food.canSaveFood(ctx.household, ctx.now())) {
        view.err.hidden = true;
        view.closed.hidden = false;
        return;
      }
      view.err.hidden = true;
      view.closed.hidden = true;
      setBusy(true);
      const saved = draft.map(d => ({ i: d.i, name: d.name, picks: d.picks.slice(), note: d.note }));
      Promise.resolve(store.saveFood(token, saved)).then(ok => ok === true, () => false).then(function (ok) {
        const here = live();
        if (here) setBusy(false); else busy = false;
        if (!ok) {
          if (!here) return;
          failed = true;
          view.err.hidden = false;
          if (view.doneBtn) view.doneBtn.textContent = w.errors.retry;
          return;
        }
        ctx.household = Object.assign({}, ctx.household, { food: food.cleanFood(Object.assign(food.foodToSave(saved), { at: ctx.now() })) });
        if (!here) return;
        if (S) S.pop();
        haptic(14);
        exit(true);
      });
    }
  }

  const api = { show };
  root.sjFirst = Object.assign(root.sjFirst || {}, { foodCard: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
