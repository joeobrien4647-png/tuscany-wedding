(function (root) {
  'use strict';
  // The Getting there card's rules, with no screen in them: what a guest can choose, which step comes next, which
  // direct routes are in play, and the shape of a stamped ticket (the same checks as the database rules).
  // A plan is what the guest is building. A ticket is a finished plan, as it is saved.
  //   plan   { froms, from, to, toText, via, last, arrive, leave }
  //          froms: the UK airports being compared. from: the chosen UK airport, or one of KINDS.
  //          to: one of the six airports, 'OTHER' (then toText says where) or 'NONE' (already in Italy, not flying).
  //   ticket { from, to?, toText?, via?, last, arrive, leave, who? }   who: people by position, never by name.
  const LAST = ['hire', 'lift', 'taxi', 'public', 'own'];
  const ARRIVE = ['early', 'thu', 'fri', 'sat'];
  const LEAVE = ['sun', 'mon', 'later'];
  const KINDS = ['ABROAD', 'ITALY', 'ROAD', 'TRAIN'];   // ways of setting off that are not a UK airport
  const GROUPS = [
    { key: 'london', codes: ['LHR', 'LGW', 'LCY', 'LTN', 'STN', 'SEN'] }, { key: 'northwest', codes: ['MAN', 'LPL'] },
    { key: 'yorkshire', codes: ['LBA', 'NCL'] }, { key: 'midlands', codes: ['BHX', 'EMA'] },
    { key: 'scotland', codes: ['EDI', 'GLA', 'PIK'] }, { key: 'southwest', codes: ['BRS', 'CWL'] }, { key: 'ni', codes: ['BFS'] }
  ];
  const PRICE_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
  const ARRIVE_DATE = { thu: '2027-05-27', fri: '2027-05-28', sat: '2027-05-29' };
  const LEAVE_DATE = { sun: '2027-05-30', mon: '2027-05-31' };
  const MAX_TEXT = 60, MAX_PEOPLE = 8, MAX_FROMS = 18;
  const CODE = /^[A-Z]{3}$/;

  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const isCode = v => typeof v === 'string' && CODE.test(v);
  const isKind = v => KINDS.indexOf(v) >= 0;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const newPlan = () => ({ froms: [], from: null, to: null, toText: '', via: null, last: null, arrive: null, leave: null });
  const copy = p => Object.assign({}, p, { froms: p.froms.slice() });

  // Own car makes sense only for someone driving all the way (nothing else does) or already in Italy.
  function lastOptions(plan) {
    if (plan.from === 'ROAD') return ['own'];
    return plan.from === 'ITALY' ? LAST.slice() : LAST.filter(k => k !== 'own');
  }
  // A new way of setting off: the route goes, and a last stretch that no longer fits goes with it.
  function setOff(plan, froms, from) {
    const p = Object.assign(copy(plan), { froms, from, to: null, toText: '', via: null });
    if (from === 'ROAD') p.last = 'own';
    else if (plan.from === 'ROAD' || lastOptions(p).indexOf(p.last) < 0) p.last = null;
    return p;
  }
  function withRoute(plan, r) {
    if (!isObject(r)) return null;
    const uk = plan.froms.length > 0;
    if (uk ? plan.froms.indexOf(r.from) < 0 : (plan.from !== 'ABROAD' && plan.from !== 'ITALY')) return null;
    const flying = isCode(r.to) || r.to === 'OTHER';
    if (!flying && !(r.to === 'NONE' && plan.from === 'ITALY')) return null;
    if (uk && r.via != null && r.via !== 'direct' && r.via !== 'change') return null;
    return Object.assign(copy(plan), {
      from: uk ? r.from : plan.from, to: r.to, via: uk && r.via ? r.via : null,
      toText: r.to === 'OTHER' && plan.to === 'OTHER' ? plan.toText : ''
    });
  }

  // Always a new plan. A change it does not understand gives back an untouched copy.
  function choose(plan, change) {
    const c = isObject(change) ? change : {};
    if (Array.isArray(c.froms)) {
      const froms = c.froms.filter((code, i) => isCode(code) && c.froms.indexOf(code) === i).slice(0, MAX_FROMS);
      return setOff(plan, froms, null);
    }
    if (isKind(c.kind)) return setOff(plan, [], c.kind);
    if (has(c, 'route')) return withRoute(plan, c.route) || copy(plan);
    const p = copy(plan);
    if (typeof c.toText === 'string' && p.to === 'OTHER') p.toText = c.toText.slice(0, MAX_TEXT);
    else if (lastOptions(p).indexOf(c.last) >= 0) p.last = c.last;
    else if (ARRIVE.indexOf(c.arrive) >= 0) p.arrive = c.arrive;
    else if (LEAVE.indexOf(c.leave) >= 0) p.leave = c.leave;
    return p;
  }

  function nextStep(plan) {
    if (!plan.froms.length && !plan.from) return 'from';
    const noRoute = plan.from === 'ROAD' || plan.from === 'TRAIN';
    if (!noRoute && (!plan.to || (plan.to === 'OTHER' && !plan.toText.trim()))) return 'route';
    if (!plan.last) return 'last';
    return plan.arrive && plan.leave ? 'done' : 'days';
  }

  // Each place is a person, so gaps become false and nothing shifts (the same idea as the reply's coming list).
  function cleanWho(raw) {
    let list = raw;
    if (isObject(raw)) {
      const keys = Object.keys(raw);
      if (!keys.length || !keys.every(k => /^[0-7]$/.test(k))) return null;
      list = [];
      for (let i = 0; i <= Math.max.apply(null, keys.map(Number)); i++) list.push(raw[i] == null ? false : raw[i]);
    }
    if (!Array.isArray(list) || !list.length || list.length > MAX_PEOPLE) return null;
    list = Array.from(list, v => (v == null ? false : v));
    return list.every(v => typeof v === 'boolean') && list.some(Boolean) ? list : null;
  }

  const TICKET_KEYS = ['from', 'to', 'toText', 'via', 'last', 'arrive', 'leave', 'who', 'at'];
  // A ticket in the saved shape, or null. `at` (when it was stamped) is kept when the database sends it back.
  function cleanTicket(raw) {
    if (!isObject(raw) || !Object.keys(raw).every(k => TICKET_KEYS.indexOf(k) >= 0)) return null;
    const uk = isCode(raw.from);
    if (!uk && !isKind(raw.from)) return null;
    if (LAST.indexOf(raw.last) < 0 || ARRIVE.indexOf(raw.arrive) < 0 || LEAVE.indexOf(raw.leave) < 0) return null;
    const out = { from: raw.from };
    if (has(raw, 'to')) {
      if (raw.from === 'ROAD' || raw.from === 'TRAIN' || !(isCode(raw.to) || raw.to === 'OTHER')) return null;
      out.to = raw.to;
    } else if (uk || raw.from === 'ABROAD') return null;
    if (out.to === 'OTHER') {
      if (typeof raw.toText !== 'string' || !raw.toText.trim() || raw.toText.length > MAX_TEXT) return null;
      out.toText = raw.toText;
    } else if (has(raw, 'toText')) return null;
    if (has(raw, 'via')) {
      if (!uk || (raw.via !== 'direct' && raw.via !== 'change')) return null;
      out.via = raw.via;
    }
    out.last = raw.last; out.arrive = raw.arrive; out.leave = raw.leave;
    if (has(raw, 'who')) {
      const who = cleanWho(raw.who);
      if (!who) return null;
      out.who = who;
    }
    if (has(raw, 'at')) {
      if (typeof raw.at !== 'number') return null;
      out.at = raw.at;
    }
    return out;
  }

  // The ticket a finished plan saves as, or null while a box is still empty. who: booleans by position, or left out.
  function ticketOf(plan, who) {
    if (nextStep(plan) !== 'done') return null;
    const t = { from: plan.from };
    if (plan.to && plan.to !== 'NONE') t.to = plan.to;
    if (plan.to === 'OTHER') t.toText = plan.toText.trim();
    if (plan.via) t.via = plan.via;
    t.last = plan.last; t.arrive = plan.arrive; t.leave = plan.leave;
    if (who !== undefined) t.who = who;
    return cleanTicket(t);
  }

  const PLAN_KEYS = Object.keys(newPlan());
  // A plan as kept on the phone, or null when it is not one choose could have made.
  function cleanPlan(raw) {
    if (!isObject(raw) || Object.keys(raw).length !== PLAN_KEYS.length || !PLAN_KEYS.every(k => has(raw, k))) return null;
    if (!Array.isArray(raw.froms) || typeof raw.toText !== 'string') return null;
    let p = choose(newPlan(), { froms: raw.froms });
    if (p.froms.length !== raw.froms.length) return null;
    if (raw.from !== null && !p.froms.length) p = choose(p, { kind: raw.from });
    if (raw.to !== null) p = choose(p, { route: { from: raw.from, to: raw.to, via: raw.via } });
    p = choose(p, { toText: raw.toText });
    ['last', 'arrive', 'leave'].forEach(k => { if (raw[k] !== null) p = choose(p, { [k]: raw[k] }); });
    return PLAN_KEYS.every(k => JSON.stringify(p[k]) === JSON.stringify(raw[k])) ? p : null;
  }

  // { gbp, at } for a route with a usable, recent price; otherwise null.
  function priceFor(prices, from, to, nowMs) {
    const e = isObject(prices) && isObject(prices.routes) ? prices.routes[from + '-' + to] : null;
    if (!isObject(e) || typeof e.gbp !== 'number' || !isFinite(e.gbp) || e.gbp <= 0 || typeof e.at !== 'number') return null;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return now - e.at > PRICE_MAX_AGE_MS ? null : { gbp: e.gbp, at: e.at };
  }

  // The six airports, nearest the villa first.
  function airportsByDrive(data) {
    const list = isObject(data) && Array.isArray(data.airports) ? data.airports.filter(a => isObject(a) && isCode(a.code)) : [];
    return list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // One row per direct route from the airports being compared. sort: 'drive' | 'airport' | 'price'.
  function routes(data, froms, sort, prices, nowMs) {
    const ranks = {};
    airportsByDrive(data).forEach((a, i) => { ranks[a.code] = i; });
    const uk = isObject(data) && isObject(data.ukAirports) ? data.ukAirports : {};
    const picked = Array.isArray(froms) ? froms.filter((c, i) => froms.indexOf(c) === i) : [];
    const rows = [];
    picked.forEach(function (from, fromRank) {
      const flies = isObject(uk[from]) && Array.isArray(uk[from].flies) ? uk[from].flies : [];
      const byTo = {};
      flies.forEach(function (f) {
        if (!isObject(f) || !has(ranks, f.to)) return;
        if (!byTo[f.to]) rows.push(byTo[f.to] = { from, to: f.to, airlines: [], driveRank: ranks[f.to], fromRank, price: priceFor(prices, from, f.to, nowMs) });
        if (typeof f.airline === 'string' && byTo[f.to].airlines.indexOf(f.airline) < 0) byTo[f.to].airlines.push(f.airline);
      });
    });
    const byDrive = (a, b) => a.driveRank - b.driveRank || a.fromRank - b.fromRank;
    const byAirport = (a, b) => a.fromRank - b.fromRank || a.driveRank - b.driveRank;
    const byPrice = (a, b) => (a.price && b.price ? a.price.gbp - b.price.gbp : a.price ? -1 : b.price ? 1 : 0) || byDrive(a, b);
    rows.sort(sort === 'airport' ? byAirport : sort === 'price' ? byPrice : byDrive);
    return rows.map(r => ({ from: r.from, to: r.to, airlines: r.airlines, driveRank: r.driveRank, price: r.price }));
  }

  // Google Flights for this route on the guest's days, or Fri 28 to Mon 31 May 2027 until they have chosen.
  function flightsLink(from, to, arrive, leave) {
    if (!isCode(from) || !isCode(to)) return null;
    const out = ARRIVE_DATE[arrive] || ARRIVE_DATE.fri, back = LEAVE_DATE[leave] || LEAVE_DATE.mon;
    return 'https://www.google.com/travel/flights?q=' + encodeURIComponent('Flights from ' + from + ' to ' + to + ' on ' + out + ' through ' + back);
  }

  // 'yes': may stamp. 'reply': has not replied yet. 'no': said they can't come.
  function canStamp(household) {
    const answer = isObject(household) && isObject(household.reply) ? household.reply.answer : null;
    return answer === 'yes' ? 'yes' : answer === 'no' ? 'no' : 'reply';
  }

  const api = { LAST, ARRIVE, LEAVE, KINDS, GROUPS, PRICE_MAX_AGE_MS, newPlan, choose, nextStep, lastOptions, routes, airportsByDrive,
    ticketOf, cleanTicket, cleanPlan, priceFor, flightsLink, canStamp };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.travel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
