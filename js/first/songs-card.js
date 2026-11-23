// The Songs card: the household's own songs (up to 3), a search of Apple's catalogue, and everyone's requests with how
// many households want each, most wanted first. The board holds only Apple song ids under random codes: songs-core.js
// has the rules, store.js the saves and apple.js the catalogue, so titles, covers and previews come from Apple by id.
// Every word is set with textContent, Apple's too, and covers, previews and links send no referrer.
// cards.js hands the card frame's `card` to build().
(function (root) {
  'use strict';
  const DEBOUNCE_MS = 400, SEARCH_MAX = 100;
  const SVG = 'http://www.w3.org/2000/svg', PLAY = 'M8 5.5v13l10.5-6.5z', STOP = 'M7 7h10v10H7z';
  const BADGE_SRC = 'images/first/apple-music-badge.png', APPLE_MUSIC = 'https://music.apple.com/';

  // The files before this one on the page set these; under Node tests they are required here.
  const lib = (name, file) => (root.sjFirst && root.sjFirst[name]) || (typeof require === 'function' ? require(file) : null);
  const songs = lib('songs', './songs-core.js');
  const core = root.sjFirst && root.sjFirst.fill ? root.sjFirst : typeof require === 'function' ? require('./core.js') : {};
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const saidYes = h => isObject(h) && isObject(h.reply) && h.reply.answer === 'yes';

  // ---------- previews ----------
  // One 30-second preview at a time; starting one stops another. The invitation's music fades out while a preview
  // plays and comes back after (sound.duck). A preview plays even with the invitation's sound off: tapping play is
  // asking to hear it. onChange(id) hears every start and stop (id null when nothing plays).
  function previewer(opts) {
    const o = opts || {};
    let audio = null, id = null;
    const duck = on => { if (o.sound && typeof o.sound.duck === 'function') o.sound.duck(on); };
    const changed = () => { if (typeof o.onChange === 'function') o.onChange(id); };
    function stop() {
      if (!audio) return;
      const a = audio;
      audio = null;
      id = null;
      try { a.pause(); } catch (e) { /* already stopped */ }
      duck(false);
      changed();
    }
    const ended = a => () => { if (a === audio) stop(); };
    function toggle(songId, url) {
      if (songId === id) { stop(); return false; }
      if (!url || typeof o.makeAudio !== 'function') return false;
      const before = audio;
      if (before) { try { before.pause(); } catch (e) { /* already stopped */ } }
      const a = o.makeAudio();
      audio = a;
      id = songId;
      a.addEventListener('ended', ended(a));
      a.addEventListener('error', ended(a));
      a.src = url;
      let p;
      try { p = a.play(); } catch (e) { p = Promise.reject(e); }
      if (!before) duck(true);
      changed();
      if (p && typeof p.catch === 'function') p.catch(ended(a));
      return true;
    }
    return { toggle, stop, playing: () => id };
  }

  // ---------- reading the board and changing the list ----------
  function idsOnBoard(board, mine) {
    const ids = [];
    const add = id => { if (!board.hidden[id] && ids.indexOf(id) < 0) ids.push(id); };
    Object.keys(board.picks).forEach(code => board.picks[code].forEach(add));
    mine.forEach(s => add(s.id));
    return ids;
  }
  // As the card opens: the board, then this household's entry put right when it is out of line with its list (while
  // requests are open; no word on failure, the next open tries again), then Apple's details for every song on it.
  // Resolves { failed, board, known, rows }: failed when the board, or Apple, gave nothing.
  function readBoard(deps, household, token, nowMs) {
    const view = songs.songsView(household, nowMs), code = songs.cleanPub(isObject(household) ? household.pub : null);
    const failed = board => ({ failed: true, board: board || null, known: {}, rows: [] });
    return Promise.resolve().then(() => deps.store.loadBoard(token)).then(function (board) {
      if (!board) return failed();
      const fix = view.state === 'open' ? songs.boardRepair(board, code, view.mine) : null;
      if (fix) Promise.resolve().then(() => deps.store.saveBoard(code, fix.ids)).catch(() => false);
      const ids = idsOnBoard(board, view.mine);
      if (!ids.length) return { failed: false, board, known: {}, rows: [] };
      return Promise.resolve().then(() => deps.apple.lookup(ids)).then(function (got) {
        const known = isObject(got) ? got : {};
        if (!Object.keys(known).length) return failed(board);
        return { failed: false, board, known, rows: songs.boardRows(board, code, view.mine, known) };
      });
    }).catch(() => failed());
  }
  // One change to the list, intent { add: song } or { remove: id }, made on the household as the database has it now
  // (a partner's phone may have changed it): read it, apply the change, then a board code first (with the household's
  // first song), then the whole list, then the board entry, which the rules check against the list already saved (no
  // word on failure: the next open mends it). With no clear answer from the read, the change is made on this page's
  // household. Resolves { ok: true, household } with the household as it now is, { ok: false, household } when the
  // change could not be made on it (full meanwhile, or a save refused), { ok: false, left: true } when it no longer
  // says yes, or { ok: false }.
  function applyChange(deps, household, token, intent) {
    const store = deps.store, page = isObject(household) ? household : {}, o = intent || {};
    return Promise.resolve().then(() => store.load(token)).catch(() => undefined).then(function (fresh) {
      const h = fresh === undefined ? page : isObject(fresh) ? fresh : {};
      if (!saidYes(h)) return { ok: false, left: true };
      const list = (songs.cleanSongs(h.songs) || { list: [] }).list;
      const id = o.add ? o.add.id : o.remove, there = list.some(s => s.id === id);
      if (o.add ? there : !there) return { ok: true, household: h };   // a partner made this change already
      const next = o.add ? songs.addSong(list, o.add) : songs.removeSong(list, id);
      if (!next) return { ok: false, household: h };                     // full meanwhile
      const had = songs.cleanPub(h.pub);
      return Promise.resolve().then(() => (had || !next.length ? had : store.claimPub(token))).then(function (pub) {
        const code = songs.cleanPub(pub);
        if (next.length && !code) return { ok: false, household: h };
        return Promise.resolve(store.saveSongs(token, next)).then(function (saved) {
          if (!saved) return { ok: false, household: h };
          const out = Object.assign({}, h);
          if (code) out.pub = code;
          if (next.length) out.songs = { at: Date.now(), list: next.slice() };
          else delete out.songs;
          if (code) Promise.resolve().then(() => store.saveBoard(code, songs.idsOf(next))).catch(() => false);
          return { ok: true, household: out };
        });
      });
    }).catch(() => ({ ok: false }));
  }
  // A change has finished, perhaps after its card closed. The household and the dock always follow it; a failure the
  // guest can no longer see on the card is said on the home screen; a household that no longer says yes (or a failure
  // on the open card) has the household read again, which leaves for can't come after a no. Returns what the open
  // card shows: 'paint', 'failed', or null when the card is gone.
  function settleChange(res, ctx, first, w, live) {
    const home = (first && first.home) || {}, r = res || {};
    const call = (name, arg) => { if (typeof home[name] === 'function') home[name](arg); };
    if (r.household) { ctx.household = r.household; call('repaint'); }
    if (r.ok) return live ? 'paint' : null;
    if (live || r.left) call('refresh');
    else call('toast', w.errors.save);
    return live ? 'failed' : null;
  }
  // Changes run one after another, even across cards: a second waits until the first has settled (it may outlive its
  // card), so two never race on the household's list.
  let queue = Promise.resolve();
  function queueChange(fn) {
    const run = queue.then(fn);
    queue = run.then(() => null, () => null);
    return run;
  }

  // ---------- Apple's badge ----------
  // Apple's own Listen on Apple Music picture (a PNG, 1200 by 463, unchanged), once at the foot of the board and linked
  // to Apple Music, as Apple's terms ask of a page that plays its previews. el is the card's el(tag, cls, text).
  function badge(el, alt) {
    const a = el('a', 'sg-badge');
    a.href = APPLE_MUSIC;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const img = el('img', 'sg-badge-i');
    img.alt = alt;
    img.width = 1200;
    img.height = 463;
    img.src = BADGE_SRC;
    a.appendChild(img);
    return a;
  }

  // ---------- the card ----------
  function build(card) {
    const ctx = card.ctx, w = card.w, first = card.first, W = w.songs, S = first.sound;
    const el = card.el, button = card.button, token = (ctx.invite && ctx.invite.token) || '';
    const deps = { store: first.store, apple: first.apple };
    const seen = {};                 // Apple's details by id, from the board's lookup and from searches
    let view = songs.songsView(ctx.household, ctx.now());
    let board = null;                // the last read: { failed, board, known, rows }, null while reading
    let results = null, term = '', timer = null, busy = false, gone = false, loadSeq = 0, searchSeq = 0;
    const preview = previewer({ makeAudio: () => new Audio(), sound: S, onChange: paintPlays });

    card.heading(W.title);
    // A preview stops when the guest leaves the page; the music then stays paused until they come back.
    const onHidden = () => { if (document.hidden) preview.stop(); };
    document.addEventListener('visibilitychange', onHidden);
    card.onClose(function () { gone = true; clearTimeout(timer); preview.stop(); document.removeEventListener('visibilitychange', onHidden); });
    card.body.appendChild(card.rise(el('p', 'fc-p sg-promise', W.promise)));

    if (view.state === 'replyFirst') {
      card.body.classList.add('sg-reply-only');
      card.body.appendChild(card.rise(button('fr-btn fr-gold sg-reply', W.replyFirst, goReply)));
      return;
    }

    const scroll = card.rise(el('div', 'sg-scroll'));
    const mineWrap = el('section', 'sg-part');
    const findWrap = el('div', 'sg-part');
    const boardWrap = el('section', 'sg-part');
    const boardBox = el('div', 'sg-board');
    boardWrap.appendChild(el('h3', 'fc-grp-k sg-head', W.board));
    boardWrap.appendChild(boardBox);
    [mineWrap, findWrap, boardWrap, badge(el, W.badge), el('p', 'sg-credit', W.credit)].forEach(e => scroll.appendChild(e));
    card.body.appendChild(scroll);
    const err = el('p', 'fr-err sg-err');
    err.setAttribute('role', 'status');
    err.hidden = true;
    card.body.appendChild(err);

    const input = el('input', 'sg-search');
    input.type = 'search';
    input.maxLength = SEARCH_MAX;
    input.placeholder = W.search;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('enterkeyhint', 'search');
    input.setAttribute('aria-label', W.search);
    input.addEventListener('input', onType);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runSearch(); input.blur(); } });
    const resultsBox = el('div', 'sg-results');
    const fullLine = el('p', 'fc-p sg-full', W.full), closedLine = el('p', 'fc-p sg-closed', W.closed);

    paint();
    loadBoard();

    // No yes any more (a partner's phone changed it): leave for the reply's own screen, as the Getting there card does.
    function goReply() {
      const host = card.host;
      card.close({ quiet: true });
      if (first.home && typeof first.home.clear === 'function') first.home.clear();
      if (first.reply && typeof first.reply.show === 'function') first.reply.show({ root: host, ctx, mode: 'change' });
    }
    function say(text) { err.textContent = text || ''; err.hidden = !text; }
    const code = () => songs.cleanPub(isObject(ctx.household) ? ctx.household.pub : null);

    // ---- painting ----
    function paint() {
      view = songs.songsView(ctx.household, ctx.now());
      paintMine();
      paintFind();
      paintBoard();
      paintPlays();
    }
    function paintMine() {
      mineWrap.textContent = '';
      mineWrap.hidden = !view.mine.length;
      if (!view.mine.length) return;
      mineWrap.appendChild(el('h3', 'fc-grp-k sg-head', W.yours));
      const list = el('div', 'sg-mine');
      view.mine.forEach(function (s) {
        let action = null;
        if (view.state === 'open') {
          const b = button('sg-btn sg-remove', W.remove, () => change({ remove: s.id }, b));
          action = b;
        }
        list.appendChild(row(seen[s.id] || s, action, 0));
      });
      mineWrap.appendChild(list);
    }
    // The search stays the same element while it shows, so typing never loses its place.
    function paintFind() {
      const searching = view.state === 'open' && !view.full;
      const want = searching ? [input, resultsBox] : [view.state === 'closed' ? closedLine : fullLine];
      const have = Array.from(findWrap.children);
      if (want.length !== have.length || want.some((e, i) => have[i] !== e)) {
        findWrap.textContent = '';
        want.forEach(e => findWrap.appendChild(e));
      }
      if (searching) paintResults();
    }
    function paintResults() {
      resultsBox.textContent = '';
      if (!results) return;
      const hidden = board && board.board ? board.board.hidden : {};
      const shown = results.filter(f => !hidden[f.id]);
      if (!shown.length) { resultsBox.appendChild(el('p', 'fc-p sg-none', W.none)); return; }
      shown.forEach(function (f) {
        const mine = view.mine.some(s => s.id === f.id);
        const b = button('sg-btn sg-add', mine ? W.mine : W.add, () => change({ add: f }, b));
        b.disabled = mine;
        resultsBox.appendChild(row(f, b, 0));
      });
    }
    function paintBoard() {
      boardBox.textContent = '';
      if (!board) { boardBox.appendChild(el('p', 'fc-p sg-loading', w.wait.line)); return; }
      if (board.failed) {
        boardBox.appendChild(el('p', 'fc-p sg-failed', W.failed));
        boardBox.appendChild(button('fr-btn fr-ghost sg-retry', w.errors.retry, loadBoard));
        return;
      }
      const rows = songs.boardRows(board.board, code(), view.mine, seen);
      if (!rows.length) { boardBox.appendChild(el('p', 'fc-p sg-empty', W.empty)); return; }
      rows.forEach(function (r) {
        let action = null;
        if (r.mine) action = el('span', 'sg-yours', W.mine);
        else if (view.state === 'open' && !view.full) {
          const b = button('sg-btn sg-metoo', W.metoo, () => change({ add: r }, b));
          action = b;
        }
        boardBox.appendChild(row(r, action, r.n));
      });
    }
    function paintPlays() {
      const id = preview.playing();
      Array.from(card.body.querySelectorAll('.sg-play')).forEach(b => setPlay(b, b.dataset.id === id));
    }

    // ---- one song ----
    // A grid row: the cover (the play control when Apple has a preview), the title and artist with the count and the
    // Apple Music link, and the action on the right. n is the board's count (0: none shown).
    function row(f, action, n) {
      const r = el('div', 'sg-row');
      r.appendChild(cover(f));
      const text = el('div', 'sg-text');
      text.appendChild(el('p', 'sg-title', f.title));
      text.appendChild(el('p', 'sg-artist', f.artist));
      const meta = el('p', 'sg-meta');
      if (n) meta.appendChild(el('span', 'sg-n', n === 1 ? W.countOne : core.fill(W.count, { n })));
      if (f.link) {
        const a = el('a', 'sg-apple', W.apple);
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        a.href = f.link;
        meta.appendChild(a);
      }
      if (meta.childNodes.length) text.appendChild(meta);
      r.appendChild(text);
      const end = el('div', 'sg-end');
      if (action) end.appendChild(action);
      r.appendChild(end);
      return r;
    }
    function cover(f) {
      const art = f.art ? artImg(f.art) : el('span', 'sg-art sg-art-none');
      if (!f.preview) {
        const box = el('span', 'sg-cover');
        box.setAttribute('aria-hidden', 'true');
        box.appendChild(art);
        return box;
      }
      const b = button('sg-cover sg-play', null, () => preview.toggle(f.id, f.preview));
      b.dataset.id = f.id;
      b.setAttribute('aria-label', core.fill(W.play, { title: f.title }));
      b.appendChild(art);
      const mark = el('span', 'sg-play-i');
      mark.appendChild(playIcon());
      b.appendChild(mark);
      setPlay(b, preview.playing() === f.id);
      return b;
    }
    function artImg(src) {
      const img = el('img', 'sg-art');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { img.removeAttribute('src'); img.classList.add('sg-art-none'); }, { once: true });
      img.src = src;
      return img;
    }
    function playIcon() {
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('fill', 'currentColor');
      svg.appendChild(p);
      return svg;
    }
    // The control keeps its name; pressed means the preview is playing, and the icon swaps play for stop.
    function setPlay(b, on) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('sg-on', on);
      const p = b.querySelector('path');
      if (p) p.setAttribute('d', on ? STOP : PLAY);
    }

    // ---- the board ----
    function loadBoard() {
      const seq = ++loadSeq;
      board = null;
      paintBoard();
      readBoard(deps, ctx.household, token, ctx.now()).then(function (got) {
        if (gone || seq !== loadSeq) return;
        board = got;
        Object.keys(got.known).forEach(id => { seen[id] = got.known[id]; });
        paint();
      });
    }

    // ---- search ----
    function onType() {
      clearTimeout(timer);
      say('');
      const key = songs.searchKey(input.value);
      if (Array.from(key).length < songs.SEARCH_MIN) {
        searchSeq++;
        term = '';
        results = null;
        paintResults();
        return;
      }
      timer = setTimeout(runSearch, DEBOUNCE_MS);
    }
    function runSearch() {
      clearTimeout(timer);
      const key = songs.searchKey(input.value);
      if (Array.from(key).length < songs.SEARCH_MIN || (key === term && results)) return;
      const seq = ++searchSeq;
      term = key;
      Promise.resolve().then(() => deps.apple.search(key)).catch(() => undefined).then(function (found) {
        if (gone || seq !== searchSeq) return;
        results = Array.isArray(found) ? found : null;
        if (!results) say(W.searchFailed);
        (results || []).forEach(f => { seen[f.id] = f; });
        paintResults();
        paintPlays();
      });
    }

    // ---- Add, Me too and Remove: one at a time, queued behind any change still out ----
    function change(intent, btn) {
      if (busy || gone || !intent) return;
      busy = true;
      say('');
      if (btn) { btn.disabled = true; btn.classList.add('sg-wait'); }
      queueChange(() => applyChange(deps, ctx.household, token, intent)).then(function (res) {
        busy = false;
        const next = settleChange(res, ctx, first, w, !gone && card.live());
        if (next === 'paint') {
          if (S) S.pop(0.5);
          paint();
          return;
        }
        if (next !== 'failed') return;
        // The choice stays on screen; a song taken down meanwhile leaves the board and the search when the board is
        // read again.
        if (btn) { btn.disabled = false; btn.classList.remove('sg-wait'); }
        say(w.errors.save);
        loadBoard();
      });
    }
  }

  const api = { build, previewer, readBoard, applyChange, settleChange, queueChange, badge };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.songsCard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
