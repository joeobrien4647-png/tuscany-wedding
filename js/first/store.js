(function (root) {
  'use strict';
  // Where a household's reply and stay choice are kept and read: household/<token> over the database's REST API,
  // no sign-in. The song board's public entries go to board/picks/<code> (see songs-core.js). Stamped Getting there tickets go to travel/<token>/<n>, which a link can write and never read, so the
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
  // food-core.js loads before this file on the page; under Node tests it is required when first needed.
  function foodRules() {
    return (root.sjFirst && root.sjFirst.food) || (typeof require === 'function' ? require('./food-core.js') : null);
  }
  // Keeps only the shared shape: { reply?: { answer, coming, at }, stay?: { choice, at }, food?: Food, songs?: Songs,
  // pub?: code }, or null when none is valid.
  function clean(raw) {
    if (!isObject(raw)) return null;
    const out = {}, reply = cleanReply(raw.reply), stay = cleanStay(raw.stay);
    const rules = raw.food === undefined ? null : foodRules(), food = rules ? rules.cleanFood(raw.food) : null;
    const sr = raw.songs === undefined && raw.pub === undefined ? null : songRules();
    const songs = sr ? sr.cleanSongs(raw.songs) : null, pub = sr ? sr.cleanPub(raw.pub) : null;
    if (reply) out.reply = reply;
    if (stay) out.stay = stay;
    if (food) out.food = food;
    if (songs) out.songs = songs;
    if (pub) out.pub = pub;
    return reply || stay || food || songs || pub ? out : null;
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

  // A whole food entry is saved at once. An empty one (nobody filled in) is a valid save: it clears the household's food.
  function saveFood(token, draft) {
    const rules = foodRules();
    if (!rules || !Array.isArray(draft)) return Promise.resolve(false);
    return put(token, 'food', rules.foodToSave(draft));
  }

  // ---------- The song board ----------
  // songs-core.js loads after this file on the page, so it is looked up when first needed.
  function songRules() {
    return (root.sjFirst && root.sjFirst.songs) || (typeof require === 'function' ? require('./songs-core.js') : null);
  }
  // js/invite.js's code alphabet. A board code is all random, with no time part in it.
  const PUSH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const boardMemory = {};
  const answered = r => !!(r && r.ok);
  function removePart(token, part) {
    if (isLocalTest()) {
      // Kept as null, so a test fixture's part stays removed.
      memory[token] = Object.assign({}, memory[token]);
      memory[token][part] = null;
      return Promise.resolve(true);
    }
    return request(DB + '/household/' + token + '/' + part + '.json', { method: 'DELETE' }).then(answered);
  }
  // A household's whole list (0 to 3 songs) is saved at once; an empty list removes it.
  function saveSongs(token, list) {
    const rules = songRules();
    if (!TOKEN.test(token || '') || !rules || !Array.isArray(list) || list.length > rules.MAX_SONGS) return Promise.resolve(false);
    const songs = list.map(s => rules.cleanSong(s));
    if (songs.some((s, i) => !s || songs.findIndex(x => x && x.id === s.id) !== i)) return Promise.resolve(false);
    return songs.length ? put(token, 'songs', { list: songs }) : removePart(token, 'songs');
  }
  function newCode() {
    const r = new Uint8Array(20);
    crypto.getRandomValues(r);
    let k = '';
    for (let i = 0; i < r.length; i++) k += PUSH.charAt(r[i] % 64);
    return k;
  }
  function savedPub(token) {
    return request(DB + '/household/' + token + '/pub.json')
      .then(r => (answered(r) ? r.json().then(b => songRules().cleanPub(b), () => null) : null));
  }
  // The household's board code, made with its first song: songOwner/<code>, then household/<token>/pub (the rules
  // check one against the other). When another phone of the household got there first, that phone's code is used.
  function claimPub(token) {
    if (!TOKEN.test(token || '') || !songRules()) return Promise.resolve(null);
    let code;
    try { code = newCode(); } catch (e) { return Promise.resolve(null); }
    if (isLocalTest()) {
      memory[token] = Object.assign({}, memory[token], { pub: code });
      return Promise.resolve(code);
    }
    return request(DB + '/songOwner/' + code + '.json', { method: 'PUT', body: JSON.stringify(token) })
      .then(r => (answered(r) ? request(DB + '/household/' + token + '/pub.json', { method: 'PUT', body: JSON.stringify(code) }) : null))
      .then(r => (answered(r) ? code : savedPub(token)));
  }
  // The household's public entry: its song ids in list order, or deleted when it has none.
  function saveBoard(code, ids) {
    const rules = songRules();
    if (!rules || !rules.cleanPub(code) || !Array.isArray(ids) || ids.length > rules.MAX_SONGS
      || !ids.every(id => typeof id === 'string' && rules.ID.test(id))) return Promise.resolve(false);
    if (isLocalTest()) {
      boardMemory[code] = ids.length ? ids.slice() : null;
      return Promise.resolve(true);
    }
    const url = DB + '/board/picks/' + code + '.json';
    return request(url, ids.length ? { method: 'PUT', body: JSON.stringify(ids) } : { method: 'DELETE' }).then(answered);
  }
  function overBoardMemory(board) {
    Object.keys(boardMemory).forEach(code => {
      if (boardMemory[code]) board.picks[code] = boardMemory[code].slice();
      else delete board.picks[code];
    });
    return board;
  }
  // The public board, cleaned, or undefined when there is no clear answer. In local-test mode: the test invitation's
  // own board file (a missing one is an empty board), with this page's saved entries laid over it.
  function loadBoard(token) {
    const rules = songRules();
    if (!rules) return Promise.resolve(undefined);
    if (isLocalTest()) {
      if (!TOKEN.test(token || '')) return Promise.resolve(undefined);
      const empty = () => overBoardMemory(rules.cleanBoard(null));
      return request('.local-test/board/' + token + '.json')
        .then(r => (answered(r) ? r.json().then(b => overBoardMemory(rules.cleanBoard(b)), empty) : empty()));
    }
    return request(DB + '/board.json').then(r => (answered(r) ? r.json().then(b => rules.cleanBoard(b), () => undefined) : undefined));
  }
  // The list goes first: the rules refuse to delete a board entry while its list has songs.
  function clearSongs(token, code) {
    const rules = songRules();
    return saveSongs(token, []).then(done => (done && rules && rules.cleanPub(code) ? saveBoard(code, []) : done));
  }
  // For a household that no longer said yes: nothing to do when it never had songs or a code.
  function clearSongsIfAny(token, household) {
    const h = isObject(household) ? household : {};
    return h.songs || h.pub ? clearSongs(token, h.pub) : Promise.resolve(true);
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

  const api = { load, saveReply, saveStay, saveFood, saveSongs, claimPub, saveBoard, loadBoard, clearSongs, clearSongsIfAny, saveTicket, removeTicket,
    travelCopy, seenMinute, markSeen, clean };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
