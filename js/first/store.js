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

  function isLocalTest() {
    try {
      return /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/
        .test(location.hostname) && new URLSearchParams(location.search).get('wtest') === '1';
    } catch (e) { return false; }
  }
  const base = () => (isLocalTest() ? '.local-test/' : DB + '/');
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

  function cleanComing(raw) {
    let list = raw;
    if (isObject(raw)) {
      list = [];
      Object.keys(raw).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).forEach(k => list.push(raw[k]));
    }
    if (!Array.isArray(list) || list.length > MAX_COMING || !list.every(v => typeof v === 'boolean')) return null;
    return list.slice();
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

  function load(token) {
    if (!TOKEN.test(token || '')) return Promise.resolve(undefined);
    return request(base() + 'household/' + token + '.json').then(function (r) {
      if (!r || !r.ok) return undefined;
      return r.json().then(function (body) {
        const fromDb = body === null ? null : clean(body);
        const kept = memory[token];
        if (!kept) return fromDb;
        return clean(Object.assign({}, fromDb || {}, kept));
      }, () => undefined);
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
    const r = reply || {}, coming = cleanComing(r.coming);
    if ((r.answer !== 'yes' && r.answer !== 'no') || !coming) return Promise.resolve(false);
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
