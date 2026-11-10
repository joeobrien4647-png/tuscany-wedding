(function (root) {
  'use strict';
  // Where a household's reply and stay choice are kept and read: household/<token> over the database's REST API,
  // no sign-in. The token is the personal link's own token (see js/invite.js) and only ever goes in the request path.
  // load resolves: a cleaned object, null (the database answered: no record) or undefined (no clear answer).
  // Testing only: ?wtest=1 on a local or home-network server reads .local-test/household/<token>.json and keeps
  // saves in memory for the page's life (same check as js/invite.js).
  const DB = 'https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app';
  const TOKEN = /^[A-Za-z0-9_-]{16,64}$/, WAIT_MS = 15000, SEEN_KEY = 'sj-first-seen';
  const OPTS = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
  const CHOICES = ['villa', 'own', 'later'], MAX_COMING = 8;
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

  function seenMinute() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} }

  const api = { load, saveReply, saveStay, seenMinute, markSeen, clean };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
