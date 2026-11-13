// The Getting there card: one screen in three parts. The map (top) redraws for every choice; the ticket (middle) has
// four boxes, From, To, Last stretch and Days, that fill in and reopen their choice when tapped; the tray (bottom) holds
// the choices for the box in hand. When every box is filled the guest stamps the ticket: that saves it where only Joe
// and Sophie can read it, and this phone keeps its own copy so the ticket shows again here.
// The rules live in travel-core.js and the drawing in travel-map.js; this file is the screen. Every word is set with
// textContent. Nothing can be reached only through the map. cards.js hands the card frame's `card` to build().
(function (root) {
  'use strict';
  const FILES = { data: 'data/getting-there.json', outline: 'data/getting-there-wide.json', prices: 'data/flight-prices.json' };
  const WAIT_MS = 15000, MAX_TICKETS = 8;
  const STEPS = ['from', 'route', 'last', 'days', 'done'];

  // The files before this one on the page set these; under Node tests they are required here.
  const lib = (name, file) => (root.sjFirst && root.sjFirst[name]) || (typeof require === 'function' ? require(file) : null);
  const travel = lib('travel', './travel-core.js');
  const core = root.sjFirst && root.sjFirst.fill ? root.sjFirst : typeof require === 'function' ? require('./core.js') : {};
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const isNum = v => typeof v === 'number' && isFinite(v);

  // ---------- the data ----------
  // One JSON file, or undefined when it is missing, unreadable or too slow.
  function getJson(fetchImpl, url) {
    return new Promise(function (resolve) {
      let ctl = null;
      try { ctl = typeof AbortController === 'function' ? new AbortController() : null; } catch (e) { /* no abort */ }
      const timer = setTimeout(function () { resolve(undefined); if (ctl) ctl.abort(); }, WAIT_MS);
      const done = v => { clearTimeout(timer); resolve(v); };
      try {
        Promise.resolve(fetchImpl(url, { credentials: 'omit', signal: ctl ? ctl.signal : undefined }))
          .then(r => (r && r.ok ? r.json() : undefined)).then(done, () => done(undefined));
      } catch (e) { done(undefined); }
    });
  }
  const okData = d => isObject(d) && Array.isArray(d.airports) && d.airports.length > 0 && isObject(d.ukAirports)
    && isObject(d.venue) && isObject(d.venue.satnav) && isNum(d.venue.satnav.lat) && isNum(d.venue.satnav.lon);
  const okOutline = o => isObject(o) && Array.isArray(o.features);
  const okPrices = p => isObject(p) && isObject(p.routes);

  // Fetched once and kept: { data, outline, prices }. prices is null when its file is missing or unreadable (the card
  // then shows no prices). Resolves null when the data or the outline could not be read; the next call tries again.
  let loading = null;
  function loadData(fetchImpl) {
    if (loading) return loading;
    if (typeof fetchImpl !== 'function') return Promise.resolve(null);
    const mine = Promise.all([FILES.data, FILES.outline, FILES.prices].map(url => getJson(fetchImpl, url))).then(function (got) {
      if (okData(got[0]) && okOutline(got[1])) return { data: got[0], outline: got[1], prices: okPrices(got[2]) ? got[2] : null };
      if (loading === mine) loading = null;
      return null;
    });
    loading = mine;
    return mine;
  }
  function forgetData() { loading = null; }

  // ---------- stamping ----------
  // The step the tray shows after a choice. Picking airports stays put (several can be picked) until Compare is pressed.
  function stepAfter(plan, change) {
    return isObject(change) && Array.isArray(change.froms) ? 'from' : travel.nextStep(plan);
  }

  // Saves ticket n; on success the phone's copy gets the ticket and loses its draft. Resolves true or false.
  function stamp(ctx, n, ticket, deps) {
    const store = deps.store, token = (ctx.invite && ctx.invite.token) || '';
    if (!ticket || travel.canStamp(ctx.household) !== 'yes') return Promise.resolve(false);
    return Promise.resolve().then(() => store.saveTicket(token, n, ticket)).then(function (ok) {
      if (!ok) return false;
      const tickets = store.travelCopy.read(token).tickets.slice();
      while (tickets.length <= n) tickets.push(null);
      tickets[n] = ticket;
      store.travelCopy.write(token, { draft: null, tickets });
      return true;
    }, () => false);
  }
  // Removes a separate ticket (never the household's own, ticket 0). Resolves true or false.
  function unstamp(ctx, n, deps) {
    const store = deps.store, token = (ctx.invite && ctx.invite.token) || '';
    if (!(n >= 1)) return Promise.resolve(false);
    return Promise.resolve().then(() => store.removeTicket(token, n)).then(function (ok) {
      if (!ok) return false;
      const copy = store.travelCopy.read(token), tickets = copy.tickets.slice();
      if (n < tickets.length) tickets[n] = null;
      store.travelCopy.write(token, { draft: copy.draft, tickets });
      return true;
    }, () => false);
  }

  // ---------- the screen ----------
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };
  function focus(e) { try { e.focus({ preventScroll: true }); } catch (err) { /* not focusable */ } }

  function build(card) {
    const ctx = card.ctx, w = card.w, first = card.first, T = w.travel, S = first.sound, store = first.store;
    const el = card.el, button = card.button;
    const token = (ctx.invite && ctx.invite.token) || '';
    card.heading(T.title);

    // The three parts. They never change size, so the map is not redrawn by what the ticket or tray say.
    const mapBox = el('div', 'tc-map');
    const viewBtn = button('tc-view', T.view.whole, toggleView);
    viewBtn.hidden = true;
    mapBox.appendChild(viewBtn);
    const ticket = el('div', 'tc-ticket');
    const top = el('div', 'tc-top');
    top.appendChild(el('span', 'tc-script', w.cover.kicker));
    const meta = el('span', 'tc-meta', w.cover.foot);
    top.appendChild(meta);
    const grid = el('div', 'tc-grid');
    const boxes = ['from', 'to', 'last', 'days'].map(function (key) {
      const b = button('tc-f tc-empty', null, () => openBox(key));
      b.appendChild(el('span', 'tc-f-l', T.fields[key]));
      const row = el('span', 'tc-f-row'), v = el('span', 'tc-f-v', T.fields.choose), s = el('span', 'tc-f-s');
      row.appendChild(v);
      row.appendChild(s);
      b.appendChild(row);
      b.disabled = true;
      grid.appendChild(b);
      return { key, b, v, s };
    });
    const sum = el('span', 'tc-sum', T.summary.empty);
    const foot = el('div', 'tc-foot');
    foot.appendChild(sum);
    const mark = el('div', 'tc-stamp', T.stampMark);
    mark.setAttribute('aria-hidden', 'true');
    [top, grid, el('div', 'tc-perf'), foot, mark].forEach(e => ticket.appendChild(e));
    const ticketWrap = el('div', 'tc-ticket-wrap');
    ticketWrap.appendChild(ticket);
    const tray = el('section', 'tc-tray');
    [mapBox, ticketWrap, tray].forEach(e => card.body.appendChild(e));

    let map = null, gone = false, data = null, prices = null;
    card.onClose(function () { gone = true; if (map) map.destroy(); });

    // What the guest is building: ticket n (0 is the household's; later ones name who they are for).
    let tickets = [], n = 0, who = null, plan = travel.newPlan(), step = 'from';
    let sort = 'drive', mode = 'list', leaving = null, otherText = '', whoPick = [], wide = false;
    let busy = false, failed = false, slam = false, shown = '';

    // ---- loading ----
    function note(text, role) {
      const p = el('p', 'tc-note', text);
      if (role) p.setAttribute('role', role);
      return p;
    }
    function load() {
      tray.textContent = '';
      tray.appendChild(note(T.load.wait, 'status'));
      tray.appendChild(el('div', 'tc-opts'));
      loadData(typeof root.fetch === 'function' ? root.fetch.bind(root) : null).then(function (res) {
        if (gone) return;
        if (res) { start(res); return; }
        tray.textContent = '';
        tray.appendChild(note(T.load.failed, 'alert'));
        tray.appendChild(el('div', 'tc-opts'));
        const again = button('tc-cta', T.load.retry, load);
        tray.appendChild(again);
        focus(again);
      });
    }
    function start(res) {
      data = res.data; prices = res.prices;
      const copy = store.travelCopy.read(token);
      tickets = copy.tickets.slice();
      const stamped = tickets.findIndex(Boolean);
      if (stamped >= 0) view(stamped);
      else if (copy.draft) { plan = copy.draft; step = travel.nextStep(plan); }
      let reduced = false;
      try { reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* no media queries */ }
      map = first.travelMap.create({ host: mapBox, data, outline: res.outline, reduced, label: T.mapLabel, villaLabel: w.minute.estate });
      map.onPick(onMapPick);
      render();
    }

    // ---- choices ----
    function pop(level) { if (S) S.pop(level || 0.4); haptic(8); }
    function keepDraft() {
      // Only the household ticket's half-built plan is kept; a stamped ticket stays as stamped until stamped again.
      if (n === 0 && !tickets[0]) store.travelCopy.write(token, { draft: plan, tickets });
    }
    function set(change) {
      if (busy) return;
      plan = travel.choose(plan, change);
      step = stepAfter(plan, change);
      mode = 'list'; failed = false; wide = false;
      keepDraft();
      pop();
      render();
    }
    function go(next, nextMode) {
      if (busy) return;
      step = next; mode = nextMode || 'list'; failed = false;
      pop(0.3);
      render();
    }
    // A box on the ticket reopens its choice, but never one further on than the next empty box.
    function openBox(key) {
      const overland = plan.from === 'ROAD' || plan.from === 'TRAIN';
      const asked = key === 'to' ? (overland ? 'from' : 'route') : key === 'last' && plan.from === 'ROAD' ? 'from' : key;
      const next = travel.nextStep(plan);
      go(STEPS.indexOf(asked) <= STEPS.indexOf(next) ? asked : next);
    }
    const ukCodes = () => Object.keys(data.ukAirports).filter(c => isObject(data.ukAirports[c]));
    const ukName = code => (isObject(data.ukAirports[code]) && typeof data.ukAirports[code].name === 'string' ? data.ukAirports[code].name : code);
    function toggleFrom(code) {
      set({ froms: plan.froms.indexOf(code) >= 0 ? plan.froms.filter(c => c !== code) : plan.froms.concat([code]) });
    }
    function toggleGroup(codes) {
      const all = codes.every(c => plan.froms.indexOf(c) >= 0);
      set({ froms: all ? plan.froms.filter(c => codes.indexOf(c) < 0) : plan.froms.concat(codes.filter(c => plan.froms.indexOf(c) < 0)) });
    }
    // The UK airport a change or a somewhere-else landing leaves from.
    function leavingFrom() {
      if (plan.froms.indexOf(leaving) >= 0) return leaving;
      return plan.froms.indexOf(plan.from) >= 0 ? plan.from : plan.froms[0];
    }
    function landOther() {
      const text = otherText.trim();
      if (!text || busy) return;
      const routed = travel.choose(plan, { route: plan.froms.length ? { from: leavingFrom(), to: 'OTHER' } : { to: 'OTHER' } });
      plan = travel.choose(routed, { toText: text });
      step = travel.nextStep(plan);
      mode = 'list'; wide = false;
      keepDraft();
      pop();
      render();
    }
    // Taps on the map do what the tray's own buttons do, and only for the step in hand.
    function onMapPick(hit) {
      if (busy || !hit) return;
      if (hit.uk && step === 'from') { toggleFrom(hit.uk); return; }
      if (!hit.airport || (step !== 'route' && !(step === 'from' && plan.froms.length))) return;
      if (!plan.froms.length) { if (plan.from === 'ABROAD' || plan.from === 'ITALY') set({ route: { to: hit.airport } }); return; }
      const direct = travel.routes(data, plan.froms, 'drive').filter(r => r.to === hit.airport);
      const pick = direct.find(r => r.from === plan.from) || direct[0];
      if (pick) set({ route: { from: pick.from, to: pick.to, via: 'direct' } });
    }
    function toggleView() {
      wide = !wide;
      render();
    }

    // ---- tickets ----
    function view(i) {
      n = i;
      plan = travel.planOf(tickets[i]) || travel.newPlan();
      who = tickets[i].who || null;
      step = 'stamped';
    }
    const coming = () => travel.comingPeople(ctx.invite, ctx.household);
    const freeSlot = () => { for (let i = 1; i < MAX_TICKETS; i++) if (!tickets[i]) return i; return -1; };
    function canAddAnother() {
      const extra = tickets.filter((t, i) => i > 0 && t).length;
      return !!tickets[0] && coming().length > 1 && extra < coming().length - 1 && freeSlot() > 0;
    }
    function beginAnother() {
      const people = ctx.invite && Array.isArray(ctx.invite.people) ? ctx.invite.people.length : 0;
      n = freeSlot();
      who = travel.whoList(people, whoPick);
      plan = travel.newPlan();
      whoPick = [];
      go('from');
    }
    function backToStamped() {
      const i = tickets[n] ? n : tickets.findIndex(Boolean);
      if (i < 0) return;
      view(i);
      go('stamped');
    }
    function doStamp() {
      const made = travel.ticketOf(plan, n > 0 && who ? who : undefined);
      if (busy || !made) return;
      busy = true; failed = false;
      render();
      stamp(ctx, n, made, { store }).then(function (ok) {
        busy = false;
        if (ok) { while (tickets.length <= n) tickets.push(null); tickets[n] = made; }
        const home = first.home || {};
        if (gone) {
          if (ok && typeof home.repaint === 'function') home.repaint();
          if (!ok && typeof home.toast === 'function') home.toast(T.done.failed);
          return;
        }
        if (!ok) {
          failed = true;
          render();
          // Someone in the household may have said no meanwhile: a fresh read then leaves for the can't-come screen.
          if (typeof home.refresh === 'function') home.refresh();
          return;
        }
        step = 'stamped'; slam = true;
        if (S) S.pop();
        haptic(14);
        render();
        if (typeof home.repaint === 'function') home.repaint();
      });
    }
    function doRemove() {
      if (busy || n < 1) return;
      busy = true; failed = false;
      render();
      unstamp(ctx, n, { store }).then(function (ok) {
        busy = false;
        if (ok) tickets[n] = null;
        if (gone) return;
        if (!ok) { failed = true; render(); return; }
        backToStamped();
      });
    }
    // No reply yet: leave the card for the reply's own screen, as the Reply card's change does.
    function goReply() {
      const host = card.host;
      card.close({ quiet: true });
      if (first.home && typeof first.home.clear === 'function') first.home.clear();
      if (first.reply && typeof first.reply.show === 'function') first.reply.show({ root: host, ctx, mode: 'change' });
    }

    // ---- drawing the ticket ----
    function paintTicket() {
      const f = travel.fields(plan, data, w), inHand = step === 'route' ? 'to' : step;
      boxes.forEach(function (bx) {
        const val = f[bx.key];
        bx.v.textContent = val ? val.v : T.fields.choose;
        bx.s.textContent = val ? val.s : '';
        bx.b.className = 'tc-f' + (val ? '' : ' tc-empty') + (bx.key === inHand ? ' tc-on' : '') + (val && val.v.length > 7 ? ' tc-long' : '');
        bx.b.setAttribute('aria-label', T.fields[bx.key] + ', ' + (val ? val.v + (val.s ? ', ' + val.s : '') : T.fields.choose));
        bx.b.disabled = busy;
      });
      sum.textContent = travel.summary(plan, data, w);
      meta.textContent = n > 0 ? core.fill(T.stamped.ticket, { n: n + 1 }) : w.cover.foot;
      ticket.className = 'tc-ticket' + (step === 'stamped' ? ' tc-stamped' : '') + (step === 'stamped' && slam ? ' tc-slam' : '');
      slam = false;
    }

    // ---- drawing the tray ----
    // Every control carries a key, so focus and the list's scroll survive a redraw of the same step.
    function keyed(e, key) { e.dataset.k = key; return e; }
    function chip(key, label, small, on, fn) {
      const b = keyed(button('tc-chip' + (on ? ' tc-on' : ''), label, fn), key);
      if (small) b.appendChild(el('small', null, small));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      return b;
    }
    function chips(list) {
      const box = el('div', 'tc-chips');
      list.forEach(c => box.appendChild(c));
      return box;
    }
    const label = text => el('p', 'tc-lab', text);
    // A row of the route list: a title, the drive on the right, a quieter line under it and, when known, a price.
    function tripRow(key, title, right, under, price, on, fn) {
      const b = keyed(button('tc-row' + (on ? ' tc-on' : ''), null, fn), key);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.appendChild(el('b', null, title));
      b.appendChild(el('i', null, right || ''));
      if (under) b.appendChild(el('span', null, under));
      if (price) b.appendChild(el('em', null, price));
      return b;
    }
    const textButton = (key, text, fn) => keyed(button('tc-text', text, fn), key);
    function liveLink() {
      const href = travel.flightsLink(plan.from, plan.to, plan.arrive, plan.leave);
      if (!href) return null;
      const a = keyed(el('a', 'tc-live', T.price.live), 'live');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      return a;
    }
    const airports = () => travel.airportsByDrive(data);
    const shortName = a => (typeof a.shortName === 'string' ? a.shortName : a.code);
    const driveLabel = a => (isObject(a.drive) && typeof a.drive.label === 'string' ? a.drive.label : '');
    function priceText(p) {
      return p ? core.fill(T.price.from, { price: '£' + Math.round(p.gbp) }) + ', ' + core.fill(T.price.checked, { date: core.ukDate(p.at) }) : '';
    }
    function leavingChips(opts) {
      if (plan.froms.length < 2) return;
      opts.appendChild(label(T.route.changeFrom));
      opts.appendChild(chips(plan.froms.map(c => chip('lv-' + c, ukName(c), c, c === leavingFrom(), function () { leaving = c; pop(0.3); render(); }))));
    }

    const TRAYS = {
      from(t) {
        t.title = T.from.title;
        if (n > 0 && !tickets[n]) t.back = backToStamped;
        const have = ukCodes();
        t.opts.appendChild(label(T.from.airports));
        t.opts.appendChild(el('p', 'tc-note', T.from.hint));
        t.opts.appendChild(chips(travel.GROUPS.map(g => ({ key: g.key, codes: g.codes.filter(c => have.indexOf(c) >= 0) })).filter(g => g.codes.length)
          .map(g => chip('g-' + g.key, T.from.groups[g.key], g.codes.length > 1 ? String(g.codes.length) : '', g.codes.every(c => plan.froms.indexOf(c) >= 0), () => toggleGroup(g.codes)))));
        t.opts.appendChild(chips(have.slice().sort((a, b) => (ukName(a) < ukName(b) ? -1 : 1))
          .map(c => chip('a-' + c, ukName(c), c, plan.froms.indexOf(c) >= 0, () => toggleFrom(c)))));
        t.opts.appendChild(label(T.from.or));
        t.opts.appendChild(chips(travel.KINDS.map(k => chip('k-' + k, T.from.kinds[k], '', plan.from === k, () => set({ kind: k })))));
        if (plan.froms.length) {
          t.quiet = true;   // the compare button takes the heading's room; the heading stays for screen readers
          const count = travel.routes(data, plan.froms, 'drive').length;
          t.cta = { key: 'compare', text: count === 1 ? T.from.compareOne : count ? core.fill(T.from.compare, { n: count }) : T.route.title, fn: () => go('route') };
        }
      },
      route(t) {
        if (mode === 'other') { TRAYS.other(t); return; }
        if (!plan.froms.length) { TRAYS.landing(t); return; }
        if (mode === 'change') { TRAYS.change(t); return; }
        t.title = T.route.title;
        const rows = travel.routes(data, plan.froms, sort, prices, ctx.now());
        const sorts = ['drive', 'airport'].concat(rows.some(r => r.price) ? ['price'] : []);
        if (sorts.indexOf(sort) < 0) sort = 'drive';
        if (rows.length > 1) t.opts.appendChild(chips(sorts.map(k => chip('s-' + k, T.route.sorts[k], '', sort === k, function () { sort = k; pop(0.3); render(); }))));
        rows.forEach(function (r) {
          const a = airports().find(x => x.code === r.to);
          const on = plan.from === r.from && plan.to === r.to && plan.via !== 'change';
          t.opts.appendChild(tripRow('r-' + r.from + r.to, core.fill(T.summary.trip, { from: ukName(r.from), to: shortName(a) }), driveLabel(a),
            r.airlines.length ? core.fill(T.route.usually, { names: r.airlines.join(', ') }) : '', priceText(r.price), on,
            () => set({ route: { from: r.from, to: r.to, via: 'direct' } })));
        });
        t.opts.appendChild(el('p', 'tc-note', rows.length ? T.route.check : T.route.noDirect));
        const live = liveLink();
        if (live) t.opts.appendChild(live);
        t.opts.appendChild(textButton('change', T.route.change, () => go('route', 'change')));
        t.opts.appendChild(textButton('other', T.route.other, () => go('route', 'other')));
      },
      // Flying with a change: any of the six airports, leaving from one of the airports being compared.
      change(t) {
        t.title = T.route.landing;
        t.back = () => go('route');
        leavingChips(t.opts);
        airports().forEach(function (a) {
          const on = plan.to === a.code && plan.via === 'change' && plan.from === leavingFrom();
          t.opts.appendChild(tripRow('c-' + a.code, shortName(a), driveLabel(a), typeof a.englishName === 'string' ? a.englishName : '', '', on,
            () => set({ route: { from: leavingFrom(), to: a.code, via: 'change' } })));
        });
      },
      // Flying in from outside the UK, or already in Italy: the six airports with their drives.
      landing(t) {
        t.title = T.route.landing;
        if (plan.from === 'ITALY') t.opts.appendChild(tripRow('none', T.route.notFlying, '', '', '', plan.to === 'NONE', () => set({ route: { to: 'NONE' } })));
        airports().forEach(function (a) {
          t.opts.appendChild(tripRow('l-' + a.code, shortName(a), driveLabel(a), typeof a.englishName === 'string' ? a.englishName : '', '', plan.to === a.code,
            () => set({ route: { to: a.code } })));
        });
        t.opts.appendChild(textButton('other', T.route.other, () => go('route', 'other')));
      },
      // Landing somewhere else: the guest says where, and nothing is claimed about the drive.
      other(t) {
        t.title = T.route.other;
        t.back = () => go('route');
        leavingChips(t.opts);
        const input = keyed(el('input', 'tc-input'), 'other-text');
        input.type = 'text';
        input.maxLength = 60;
        input.autocomplete = 'off';
        input.setAttribute('autocapitalize', 'words');
        input.setAttribute('enterkeyhint', 'done');
        input.placeholder = T.route.otherHint;
        input.setAttribute('aria-label', T.route.otherHint);
        if (!otherText && plan.to === 'OTHER') otherText = plan.toText;
        input.value = otherText;
        t.opts.appendChild(input);
        t.cta = { key: 'other-done', text: T.route.otherDone, fn: landOther, off: !otherText.trim() };
        input.addEventListener('input', function () {
          otherText = input.value;
          const go2 = tray.querySelector('[data-k="other-done"]');
          if (go2) go2.disabled = !otherText.trim();
        });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); landOther(); } });
      },
      last(t) {
        t.title = T.last.title;
        const options = travel.lastOptions(plan);
        t.opts.appendChild(chips(options.map(k => chip('last-' + k, T.last.options[k], '', plan.last === k, () => set({ last: k })))));
        const facts = travel.lastFacts(plan, data, w);
        if (facts.length) {
          const box = el('div', 'tc-fact');
          facts.forEach(line => box.appendChild(el('p', null, line)));
          t.opts.appendChild(box);
        }
        if (options.indexOf('lift') >= 0) t.opts.appendChild(el('p', 'tc-note', T.last.liftNote));
      },
      days(t) {
        t.title = T.days.title;
        t.opts.appendChild(label(T.days.arriving));
        t.opts.appendChild(chips(travel.ARRIVE.map(k => chip('arr-' + k, T.days.arrive[k], '', plan.arrive === k, () => set({ arrive: k })))));
        t.opts.appendChild(label(T.days.leaving));
        t.opts.appendChild(chips(travel.LEAVE.map(k => chip('lea-' + k, T.days.leave[k], '', plan.leave === k, () => set({ leave: k })))));
      },
      done(t) {
        t.title = T.done.title;
        if (n > 0 && !tickets[n]) t.back = backToStamped;
        t.opts.appendChild(el('p', 'tc-note', T.done.hint));
        const live = liveLink();
        if (live) t.opts.appendChild(live);
        if (busy) t.opts.appendChild(note(T.done.saving, 'status'));
        if (failed) t.opts.appendChild(note(T.done.failed, 'alert'));
        const may = travel.canStamp(ctx.household);
        if (may === 'yes') t.cta = { key: 'stamp', text: failed ? T.done.retry : T.done.stamp, fn: doStamp, busy };
        else if (may === 'reply') t.cta = { key: 'reply', text: T.done.needReply, fn: goReply };
      },
      stamped(t) {
        t.title = T.stamped.title;
        t.opts.appendChild(el('p', 'tc-note', T.stamped.hint));
        const have = tickets.map((tk, i) => (tk ? i : -1)).filter(i => i >= 0);
        if (have.length > 1) {
          t.opts.appendChild(chips(have.map(i => chip('t-' + i, core.fill(T.stamped.ticket, { n: i + 1 }), '', i === n, function () { view(i); go('stamped'); }))));
        }
        if (failed) t.opts.appendChild(note(w.errors.save, 'alert'));
        t.opts.appendChild(keyed(button('tc-ghost', T.stamped.change, () => go('done')), 'change'));
        if (canAddAnother()) t.opts.appendChild(keyed(button('tc-ghost', T.stamped.another, function () { whoPick = []; go('who'); }), 'another'));
        const live = liveLink();
        if (live) t.opts.appendChild(live);
        if (n > 0) t.opts.appendChild(textButton('remove', T.stamped.remove, doRemove));
      },
      // A separate ticket: who is it for? Some of the people coming, never all of them (the first ticket covers the rest).
      who(t) {
        t.title = T.stamped.who;
        t.back = backToStamped;
        const people = coming();
        t.opts.appendChild(chips(people.map(p => chip('p-' + p.i, p.name, '', whoPick.indexOf(p.i) >= 0, function () {
          whoPick = whoPick.indexOf(p.i) >= 0 ? whoPick.filter(i => i !== p.i) : whoPick.concat([p.i]);
          pop(0.3);
          render();
        }))));
        t.cta = { key: 'who-next', text: T.stamped.next, fn: beginAnother, off: !whoPick.length || whoPick.length >= people.length };
      }
    };

    function paintTray() {
      const now = step + '/' + mode, same = now === shown;
      const active = document.activeElement, inTray = !!active && tray.contains(active);
      const hadKey = inTray && active.dataset ? active.dataset.k : null;
      const oldOpts = tray.querySelector('.tc-opts'), scroll = same && oldOpts ? oldOpts.scrollTop : 0;
      const hadFocus = inTray || (!!active && ticket.contains(active));

      const t = { title: '', back: null, cta: null, quiet: false, opts: el('div', 'tc-opts') };
      (TRAYS[step] || TRAYS.from)(t);
      tray.textContent = '';
      const head = el('div', 'tc-head' + (t.back ? ' tc-has-back' : '') + (t.quiet && !t.back ? ' tc-sr' : ''));
      if (t.back) head.appendChild(keyed(button('tc-back', T.back, t.back), 'back'));
      const h = el('h3', 'tc-h', t.title);
      h.tabIndex = -1;
      head.appendChild(h);
      tray.appendChild(head);
      tray.appendChild(t.opts);
      if (t.cta) {
        const b = keyed(button('tc-cta' + (t.cta.busy ? ' tc-busy' : ''), t.cta.text, t.cta.fn), t.cta.key);
        b.disabled = !!t.cta.off || !!t.cta.busy;
        if (t.cta.busy) b.setAttribute('aria-busy', 'true');
        tray.appendChild(b);
      }
      Array.from(tray.querySelectorAll('button, input')).forEach(function (e) { if (busy) e.disabled = true; });
      t.opts.scrollTop = scroll;
      shown = now;
      if (!hadFocus) return;
      const again = same && hadKey ? tray.querySelector('[data-k="' + hadKey + '"]') : null;
      focus(again && !again.disabled ? again : h);
    }

    function render() {
      paintTicket();
      paintTray();
      const trip = !!plan.to && airports().some(a => a.code === plan.to);
      viewBtn.hidden = !trip;
      viewBtn.textContent = wide ? T.view.close : T.view.whole;
      if (map) map.show({ froms: plan.froms, from: plan.from, to: plan.to, wide: trip && wide });
    }

    load();
  }

  const api = { build, loadData, forgetData, stepAfter, stamp, unstamp };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.travelCard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
