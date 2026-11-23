(function (root) {
  'use strict';
  // The song board rules, with no screen in them: how a household's songs and the public board are cleaned, how the
  // board is counted, what Apple's answers become, and the dashboard's rows and writes. The same limits are enforced
  // by the database rules (firebase.rules.json).
  //   Song  { id, title, artist }                      id is Apple's trackId as 1 to 12 digits
  //   Songs { at, list: Song[] }                       1 to 3 songs, no id twice
  //   Board { picks: { <code>: id[] }, hidden: { <id>: true } }
  //   Found { id, title, artist, art, preview, link }  from Apple; art, preview and link may be null
  //   Step  { ref, value }                             one dashboard write, value null means remove
  const MAX_SONGS = 3, TEXT_MAX = 200, SEARCH_MIN = 2, SEARCH_LIMIT = 8, LOOKUP_CHUNK = 50;
  const ID = /^[0-9]{1,12}$/, CODE = /^[A-Za-z0-9_-]{20}$/;
  const APPLE = 'https://itunes.apple.com/';

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.songsOpen ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isId = v => typeof v === 'string' && ID.test(v);
  const saidYes = h => isObject(h) && isObject(h.reply) && h.reply.answer === 'yes';
  // A line break or other control character becomes one space, so a song stays on one line.
  const oneLine = s => String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();
  // Cut by whole characters (never half an emoji), at most max UTF-16 units, as the database counts.
  function cut(s, max) {
    let out = '';
    for (const ch of s) { if (out.length + ch.length > max) break; out += ch; }
    return out;
  }
  // Apple's links go into src and href, so only plain https addresses are kept.
  const httpsUrl = v => (typeof v === 'string' && /^https:\/\/[^\s"'<>\\]+$/.test(v) ? v : null);
  const byName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
  const byCount = (a, b) => b.n - a.n || a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // A saved list may come back as an array (with null holes) or as an object keyed by slot; anything else is junk.
  function entriesOf(raw) {
    if (Array.isArray(raw)) return raw;
    if (!isObject(raw)) return null;
    const keys = Object.keys(raw);
    return keys.every(k => /^[0-9]+$/.test(k)) ? keys.map(Number).sort((a, b) => a - b).map(k => raw[k]) : null;
  }
  function cleanText(v) {
    if (typeof v !== 'string' || !v.length || v.length > TEXT_MAX) return null;
    return oneLine(v) || null;
  }
  function cleanSong(raw) {
    if (!isObject(raw) || !isId(raw.id)) return null;
    const title = cleanText(raw.title), artist = cleanText(raw.artist);
    return title && artist ? { id: raw.id, title, artist } : null;
  }
  function cleanList(raw) {
    const out = [];
    (entriesOf(raw) || []).forEach(entry => {
      const song = cleanSong(entry);
      if (song && out.length < MAX_SONGS && !out.some(s => s.id === song.id)) out.push(song);
    });
    return out;
  }
  function cleanSongs(raw) {
    if (!isObject(raw) || typeof raw.at !== 'number') return null;
    const list = cleanList(raw.list);
    return list.length ? { at: raw.at, list } : null;
  }
  const cleanPub = raw => (typeof raw === 'string' && CODE.test(raw) ? raw : null);
  function cleanIds(raw) {
    const out = [];
    (entriesOf(raw) || []).forEach(id => { if (isId(id) && out.length < MAX_SONGS && out.indexOf(id) < 0) out.push(id); });
    return out;
  }
  function cleanBoard(raw) {
    const picks = {}, hidden = {}, b = isObject(raw) ? raw : {};
    if (isObject(b.picks)) Object.keys(b.picks).forEach(code => {
      const ids = CODE.test(code) ? cleanIds(b.picks[code]) : [];
      if (ids.length) picks[code] = ids;
    });
    if (isObject(b.hidden)) Object.keys(b.hidden).forEach(id => { if (ID.test(id) && b.hidden[id] === true) hidden[id] = true; });
    return { picks, hidden };
  }

  function addSong(list, song) {
    const l = Array.isArray(list) ? list : [], s = cleanSong(song);
    if (!s || l.length >= MAX_SONGS || l.some(x => x.id === s.id)) return null;
    return l.concat([s]);
  }
  const removeSong = (list, id) => (Array.isArray(list) ? list : []).filter(s => s.id !== id);
  const idsOf = list => (Array.isArray(list) ? list : []).map(s => s.id);

  // Every requested song that is not taken down, with how many households want it. This household is counted from
  // its own list (the board entry may be behind it), and its songs show even when Apple did not return them.
  function boardRows(board, ownCode, ownList, known) {
    const b = cleanBoard(board), mine = cleanList(ownList), k = isObject(known) ? known : {}, counts = {};
    const count = id => { counts[id] = (counts[id] || 0) + 1; };
    Object.keys(b.picks).forEach(code => { if (code !== ownCode) b.picks[code].forEach(count); });
    mine.forEach(s => count(s.id));
    return Object.keys(counts).filter(id => !b.hidden[id]).map(id => {
      const own = mine.find(s => s.id === id), f = has(k, id) && isObject(k[id]) ? k[id] : null;
      if (!f && !own) return null;
      const from = f || own;
      return { id, n: counts[id], mine: !!own, title: from.title, artist: from.artist, art: from.art || null, preview: from.preview || null, link: from.link || null };
    }).filter(Boolean).sort(byCount);
  }

  // The ids this household's board entry should hold when it is out of line with the list (empty ids: delete it).
  function boardRepair(board, ownCode, ownList) {
    if (!cleanPub(ownCode)) return null;
    const entry = cleanBoard(board).picks[ownCode] || [], ids = idsOf(cleanList(ownList));
    return entry.length === ids.length && entry.every((id, i) => id === ids[i]) ? null : { ids };
  }

  const searchKey = term => (typeof term === 'string' ? term : '').replace(/\s+/g, ' ').trim().toLowerCase();
  function searchUrl(term) {
    const key = searchKey(term);
    if (Array.from(key).length < SEARCH_MIN) return null;
    return APPLE + 'search?term=' + encodeURIComponent(key) + '&country=GB&media=music&entity=song&limit=' + SEARCH_LIMIT;
  }
  function lookupUrls(ids) {
    const list = [], urls = [];
    (Array.isArray(ids) ? ids : []).forEach(id => { if (isId(id) && list.indexOf(id) < 0) list.push(id); });
    for (let i = 0; i < list.length; i += LOOKUP_CHUNK) urls.push(APPLE + 'lookup?id=' + list.slice(i, i + LOOKUP_CHUNK).join(',') + '&country=GB');
    return urls;
  }
  const appleText = v => (typeof v === 'string' ? cut(oneLine(v), TEXT_MAX).trim() : '');
  function fromApple(r) {
    if (!isObject(r) || r.wrapperType !== 'track' || r.kind !== 'song') return null;
    const id = Number.isSafeInteger(r.trackId) ? String(r.trackId) : r.trackId;
    const title = appleText(r.trackName), artist = appleText(r.artistName);
    if (!isId(id) || !title || !artist) return null;
    const art = httpsUrl(r.artworkUrl100);
    return { id, title, artist, art: art ? art.replace(/100x100bb(?=\.[a-z]+$)/, '200x200bb') : null, preview: httpsUrl(r.previewUrl), link: httpsUrl(r.trackViewUrl) };
  }
  function fromAppleBody(body) {
    const out = [];
    (isObject(body) && Array.isArray(body.results) ? body.results : []).forEach(r => {
      const f = fromApple(r);
      if (f && !out.some(x => x.id === f.id)) out.push(f);
    });
    return out;
  }

  // What the Songs card shows: closed from the close time; before it, open for a yes and reply first otherwise.
  function songsView(household, nowMs) {
    const songs = cleanSongs(isObject(household) ? household.songs : null), mine = songs ? songs.list : [];
    const state = !core.songsOpen(nowMs) ? 'closed' : saidYes(household) ? 'open' : 'replyFirst';
    return { state, mine, full: mine.length >= MAX_SONGS };
  }

  // ---- the dashboard: every household's private list, so it works without Apple ----
  function songRows(welcome, household, board) {
    if (!isObject(welcome) || !isObject(household)) return [];
    const hidden = cleanBoard(board).hidden, byId = {};
    Object.keys(welcome).filter(token => isObject(welcome[token]) && saidYes(household[token])).forEach(token => {
      const songs = cleanSongs(household[token].songs), display = typeof welcome[token].display === 'string' ? welcome[token].display : '';
      (songs ? songs.list : []).filter(s => !hidden[s.id]).forEach(s => {
        const row = byId[s.id] = byId[s.id] || { id: s.id, title: s.title, artist: s.artist, n: 0, households: [] };
        row.n += 1;
        row.households.push(display);
      });
    });
    return Object.keys(byId).map(id => Object.assign(byId[id], { households: byId[id].households.sort(byName) })).sort(byCount);
  }
  function djText(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return ['Song requests'].concat(list.length ? list.map(r => r.title + ', ' + r.artist + ' (' + r.n + ')') : ['No requests yet']).join('\n');
  }
  // Taking a song down: hidden first, so no phone can add it again meanwhile; then each list that has it, each
  // followed by its board entry (the rules check an entry against the list already saved).
  function removeSteps(household, id) {
    if (!isId(id)) return [];
    const steps = [{ ref: 'board/hidden/' + id, value: true }];
    Object.keys(isObject(household) ? household : {}).forEach(token => {
      const h = household[token], songs = isObject(h) ? cleanSongs(h.songs) : null;
      if (!songs || !songs.list.some(s => s.id === id)) return;
      const list = removeSong(songs.list, id), code = cleanPub(h.pub);
      steps.push({ ref: 'household/' + token + '/songs', value: list.length ? { list, at: { '.sv': 'timestamp' } } : null });
      if (code) steps.push({ ref: 'board/picks/' + code, value: list.length ? idsOf(list) : null });
    });
    return steps;
  }
  const allowSteps = id => (isId(id) ? [{ ref: 'board/hidden/' + id, value: null }] : []);
  const hiddenIds = board => Object.keys(cleanBoard(board).hidden).sort();

  const api = { MAX_SONGS, TEXT_MAX, SEARCH_MIN, SEARCH_LIMIT, LOOKUP_CHUNK, ID, CODE, cleanSong, cleanSongs, cleanPub, cleanBoard,
    addSong, removeSong, idsOf, boardRows, boardRepair, searchUrl, searchKey, lookupUrls, fromApple, fromAppleBody, songsView,
    songRows, djText, removeSteps, allowSteps, hiddenIds };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.songs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
