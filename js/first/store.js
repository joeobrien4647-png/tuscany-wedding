(function (root) {
  'use strict';
  // Where a household's reply and stay choice are kept and read: household/<token> over the database's REST API,
  // no sign-in. Stamped Getting there tickets go to travel/<token>/<n>, which a link can write and never read, so the
  // phone keeps its own copy of what it stamped (travelCopy). The token is the personal link's own token (see js/invite.js) and only ever goes in the request path.
  // load resolves: a cleaned object, null (the database answered: no record) or undefined (no clear answer).
  // Testing only: ?wtest=1 on a local or home-network server reads .local-test/household/<token>.json and keeps
  // saves in memory for the page's life (same check as js/invite.js).
  const DB = 'https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app';
  const TOKEN = /^[A-Za-z0-9_-]{16,64}$/, WAIT_MS = 15000, SEEN_KEY = 'sj-first-seen';
  const OPTS = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
  const CHOICES = ['villa', 'own', 'later'], MAX_COMING = 8;
  const TRAVEL_KEY = 'sj-first-travel', MAX_TICKETS = 8;
  const memory = {};

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.isLocalTest ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};
  function isLocalTest() {
    try { return core.isLocalTest(location); } catch (e) { return false; }
  }
  const base = () => (isLocalTest() ? '.local-test/' : DB + '/');
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

  // Positions matter (each place is a person), so gaps and null holes become false and nothing shifts.
  function cleanComing(raw) {
    let list;
    if (isObject(raw)) {
      const keys = Object.keys(raw).filter(k => /^\d+$/.test(k));
      if (keys.length !== Object.keys(raw).length) return null;
      const highest = keys.reduce((m, k) => Math.max(m, Number(k)), -1);
      if (highest >= MAX_COMING) return null;
      list = [];
      for (let i = 0; i <= highest; i++) list.push(raw[i]);
    } else if (Array.isArray(raw)) {
      list = Array.from(raw);
    } else return null;
    if (list.length > MAX_COMING) return null;
    list = list.map(v => (v === undefined || v === null ? false : v));
    return list.every(v => typeof v === 'boolean') ? list : null;
  }
  function cleanReply(r) {
    if (!isObject(r) || (r.answer !== 'yes' && r.answer !== 'no') || typeof r.at !== 'number') return null;
    const coming = cleanComing(r.coming);
    return coming ? { answer: r.answer, coming, at: r.at } : null;
  }
  function cleanStay(s) {
    if (!isObject(s) || CHOICES.indexOf(s.choice) < 0 || typeof s.at !== 'number') return null;
    return { choice: s.choice, at: s.at };
  }
  // Keeps only the shared shape: { reply?: { answer, coming, at }, stay?: { choice, at } }, or null when neither is valid.
  function clean(raw) {
    if (!isObject(raw)) return null;
    const out = {}, reply = cleanReply(raw.reply), stay = cleanStay(raw.stay);
    if (reply) out.reply = reply;
    if (stay) out.stay = stay;
    return reply || stay ? out : null;
  }

  // fetch with a timeout. Resolves the Response, or undefined when there was no response in time or at all.
  function request(url, init) {
    return new Promise(function (resolve) {
      let ctl = null, timer;
      try { ctl = typeof AbortController === 'function' ? new AbortController() : null; } catch (e) {}
      timer = setTimeout(function () { resolve(undefined); if (ctl) ctl.abort(); }, WAIT_MS);
      const done = r => { clearTimeout(timer); resolve(r); };
      try {
        fetch(url, Object.assign({ signal: ctl ? ctl.signal : undefined }, OPTS, init)).then(done, () => done(undefined));
      } catch (e) { done(undefined); }
    });
  }

  function withMemory(token, fromDb) {
    const kept = memory[token];
    return kept ? clean(Object.assign({}, fromDb || {}, kept)) : fromDb;
  }
  // In local-test mode a missing or unreadable file means "no record yet", so saves kept in memory still show.
  function load(token) {
    if (!TOKEN.test(token || '')) return Promise.resolve(undefined);
    const local = isLocalTest(), noAnswer = local ? withMemory(token, null) : undefined;
    return request(base() + 'household/' + token + '.json').then(function (r) {
      if (!r) return undefined;
      if (!r.ok) return noAnswer;
      return r.json().then(function (body) {
        return withMemory(token, body === null ? null : clean(body));
      }, () => noAnswer);
    });
  }

  function put(token, part, value) {
    if (!TOKEN.test(token || '')) return Promise.resolve(false);
    if (isLocalTest()) {
      memory[token] = Object.assign({}, memory[token]);
      memory[token][part] = Object.assign({}, value, { at: Date.now() });
      return Promise.resolve(true);
    }
    const body = Object.assign({}, value, { at: { '.sv': 'timestamp' } });
    return request(base() + 'household/' + token + '/' + part + '.json', { method: 'PUT', body: JSON.stringify(body) })
      .then(r => !!(r && r.ok));
  }
  function saveReply(token, reply) {
    const r = reply || {};
    if (r.answer !== 'yes' && r.answer !== 'no') return Promise.resolve(false);
    // The database drops an empty array and the rules require coming, so it is never sent empty.
    let coming = r.coming == null ? [] : cleanComing(r.coming);
    if (!coming) return Promise.resolve(false);
    if (!coming.length) coming = [r.answer === 'yes'];
    return put(token, 'reply', { answer: r.answer, coming });
  }
  function saveStay(token, choice) {
    if (CHOICES.indexOf(choice) < 0) return Promise.resolve(false);
    return put(token, 'stay', { choice });
  }

  // ---------- Getting there tickets ----------
  // travel-core.js loads after this file on the page, so it is looked up when first needed.
  function travelRules() {
    return (root.sjFirst && root.sjFirst.travel) || (typeof require === 'function' ? require('./travel-core.js') : null);
  }
  const ticketSlot = n => Number.isInteger(n) && n >= 0 && n < MAX_TICKETS;
  // Ticket 0 covers the household and names nobody; a later ticket says who it is for.
  function saveTicket(token, n, ticket) {
    const rules = travelRules(), clean = rules ? rules.cleanTicket(ticket) : null;
    if (!TOKEN.test(token || '') || !ticketSlot(n) || !clean || (n === 0) !== !clean.who) return Promise.resolve(false);
    if (isLocalTest()) return Promise.resolve(true);
    const body = Object.assign({}, clean, { at: { '.sv': 'timestamp' } });
    return request(DB + '/travel/' + token + '/' + n + '.json', { method: 'PUT', body: JSON.stringify(body) }).then(r => !!(r && r.ok));
  }
  function removeTicket(token, n) {
    if (!TOKEN.test(token || '') || !ticketSlot(n)) return Promise.resolve(false);
    if (isLocalTest()) return Promise.resolve(true);
    return request(DB + '/travel/' + token + '/' + n + '.json', { method: 'DELETE' }).then(r => !!(r && r.ok));
  }

  // The phone's own copy: { draft: plan | null, tickets: [ticket | null, ...] }. It is marked with a fingerprint of
  // the token (never the token), so another invitation opened on this phone reads nothing.
  function fingerprint(token) {
    let a = 0x811c9dc5, b = 0x1b873593;
    for (let i = 0; i < token.length; i++) {
      a = Math.imul(a ^ token.charCodeAt(i), 0x01000193);
      b = Math.imul(b + token.charCodeAt(i), 0x85ebca6b) ^ (b >>> 13);
    }
    return (a >>> 0).toString(16) + (b >>> 0).toString(16);
  }
  const emptyCopy = () => ({ draft: null, tickets: [] });
  const travelCopy = {
    read(token) {
      const rules = travelRules();
      if (!TOKEN.test(token || '') || !rules) return emptyCopy();
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(TRAVEL_KEY)); } catch (e) { return emptyCopy(); }
      if (!isObject(raw) || raw.v !== 1 || raw.id !== fingerprint(token) || !Array.isArray(raw.tickets)) return emptyCopy();
      return { draft: rules.cleanPlan(raw.draft), tickets: raw.tickets.slice(0, MAX_TICKETS).map(t => rules.cleanTicket(t)) };
    },
    write(token, copy) {
      if (!TOKEN.test(token || '') || !isObject(copy)) return;
      const kept = { v: 1, id: fingerprint(token), draft: copy.draft || null, tickets: Array.isArray(copy.tickets) ? copy.tickets : [] };
      try { localStorage.setItem(TRAVEL_KEY, JSON.stringify(kept)); } catch (e) { /* storage blocked: the card still works */ }
    },
    clear() { try { localStorage.removeItem(TRAVEL_KEY); } catch (e) { /* nothing kept */ } }
  };

  function seenMinute() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} }

  const api = { load, saveReply, saveStay, saveTicket, removeTicket, travelCopy, seenMinute, markSeen, clean };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
