const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const songsCard = require('../js/first/songs-card.js');
const { words } = require('../js/first/words.js');
const cards = require('../js/first/cards.js');
const js = read('js/first/songs-card.js');

// Invented household, codes and songs only.
const TOKEN = 'tok_SONGSCARDABCDEFG';
const CODE = 'testcode000000000001', OTHER = 'testcode000000000002';
const A = { id: '9100000001', title: 'Alpha', artist: 'Band One' };
const B = { id: '9100000002', title: 'beta', artist: 'Band Two' };
const C = { id: '9100000003', title: 'Gamma', artist: 'Band Three' };
const D = { id: '9100000004', title: 'Delta', artist: 'Band Four' };
const YES = { answer: 'yes', coming: [true], at: 1 };
const OPEN = Date.UTC(2026, 10, 10, 12), CLOSED = 1810422000000;
const found = s => ({ ...s, art: 'https://art.example/' + s.id + '.jpg', preview: 'https://audio.example/' + s.id + '.m4a', link: 'https://music.example/' + s.id });
const settle = () => new Promise(r => setTimeout(r, 0));

// A stand-in for an Audio element: records play, pause and src, and can fire its events.
function fakeAudio(log, name, playResult) {
  const handlers = {};
  return {
    src: '',
    play() { log.push(name + ':play ' + this.src); return playResult ? playResult() : Promise.resolve(); },
    pause() { log.push(name + ':pause'); },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    fire(type) { (handlers[type] || []).forEach(fn => fn()); }
  };
}
function previewRig(playResult) {
  const log = [], made = [], changes = [];
  const sound = { duck: on => log.push('duck:' + on) };
  const p = songsCard.previewer({
    makeAudio: () => { const a = fakeAudio(log, 'audio' + made.length, playResult); made.push(a); return a; },
    sound, onChange: id => changes.push(id)
  });
  return { log, made, changes, p };
}

test('previewer plays one at a time and ducks the music', () => {
  const { log, made, changes, p } = previewRig();
  assert.equal(p.toggle('a', 'https://audio.example/a.m4a'), true);
  assert.deepEqual(log, ['audio0:play https://audio.example/a.m4a', 'duck:true']);
  assert.equal(p.playing(), 'a');
  log.length = 0;
  assert.equal(p.toggle('b', 'https://audio.example/b.m4a'), true);
  assert.deepEqual(log, ['audio0:pause', 'audio1:play https://audio.example/b.m4a'], 'no duck(false) between two previews');
  assert.equal(p.playing(), 'b');
  log.length = 0;
  assert.equal(p.toggle('b', 'https://audio.example/b.m4a'), false);
  assert.deepEqual(log, ['audio1:pause', 'duck:false']);
  assert.equal(p.playing(), null);
  log.length = 0;
  p.toggle('a', 'https://audio.example/a.m4a');
  made[2].fire('ended');
  assert.deepEqual(log, ['audio2:play https://audio.example/a.m4a', 'duck:true', 'audio2:pause', 'duck:false']);
  log.length = 0;
  p.stop();
  assert.deepEqual(log, [], 'stop with nothing playing does not touch the music');
  assert.deepEqual(changes, ['a', 'b', null, 'a', null]);
});
test('previewer: an old preview ending never stops the new one; an error or a missing preview stops cleanly', () => {
  const { log, made, p } = previewRig();
  p.toggle('a', 'https://audio.example/a.m4a');
  p.toggle('b', 'https://audio.example/b.m4a');
  made[0].fire('ended');
  assert.equal(p.playing(), 'b');
  made[1].fire('error');
  assert.equal(p.playing(), null);
  assert.equal(log[log.length - 1], 'duck:false');
  log.length = 0;
  assert.equal(p.toggle('c', null), false);
  assert.deepEqual(log, []);
  assert.equal(made.length, 2);
});
test('previewer: a preview the browser will not play stops and brings the music back', async () => {
  const { log, p } = previewRig(() => Promise.reject(new Error('NotAllowedError')));
  assert.equal(p.toggle('a', 'https://audio.example/a.m4a'), true);
  await settle();
  assert.equal(p.playing(), null);
  assert.deepEqual(log, ['audio0:play https://audio.example/a.m4a', 'duck:true', 'audio0:pause', 'duck:false']);
});

test('sound.duck exists and is safe without a page', () => {
  const { sound } = require('../js/first/sound.js');
  assert.equal(typeof sound.duck, 'function');
  assert.doesNotThrow(() => { sound.duck(true); sound.duck(false); });
});
test('sound.duck pauses the music and plays it on from where it was, only while the music is wanted', () => {
  const log = [], handlers = {};
  class FakeAudio {
    constructor() { this.currentTime = 0; FakeAudio.last = this; }
    play() { log.push('play@' + this.currentTime); return Promise.resolve(); }
    pause() { log.push('pause'); }
  }
  const saved = { document: Object.getOwnPropertyDescriptor(globalThis, 'document'), Audio: Object.getOwnPropertyDescriptor(globalThis, 'Audio') };
  globalThis.document = { hidden: false, visibilityState: 'visible', addEventListener: (type, fn) => { handlers[type] = fn; } };
  globalThis.Audio = FakeAudio;
  const file = require.resolve('../js/first/sound.js');
  delete require.cache[file];
  try {
    const { sound } = require(file);
    sound.music();
    FakeAudio.last.currentTime = 12;
    sound.duck(true);
    handlers.visibilitychange();
    sound.duck(false);
    assert.deepEqual(log, ['play@0', 'pause', 'play@12'], 'paused while ducked, even on coming back to the page, then on from 12 s');
    log.length = 0;
    sound.duck(true);
    sound.music();
    sound.duck(false);
    assert.deepEqual(log, ['pause', 'play@0'], 'music() starts again and clears the duck');
    log.length = 0;
    sound.duck(true);
    sound.quiet();
    sound.duck(false);
    assert.deepEqual(log, ['pause'], 'after quiet() the music is not wanted, so it stays off');
    log.length = 0;
    sound.music();
    sound.duck(true);
    globalThis.document.hidden = true;
    sound.duck(false);
    assert.deepEqual(log, ['play@0', 'pause'], 'a preview that ends while the page is hidden leaves the music paused');
    globalThis.document.hidden = false;
    handlers.visibilitychange();
    assert.deepEqual(log, ['play@0', 'pause', 'play@0'], 'and it plays on when the guest comes back');
  } finally {
    for (const k of Object.keys(saved)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; }
    delete require.cache[file];
  }
});

test('words.songs has every key the card uses', () => {
  const used = [...new Set([...js.matchAll(/\bW\.(\w+)/g)].map(m => m[1]))];
  assert.ok(used.length > 15, used.join());
  for (const k of used) assert.equal(typeof words.songs[k], 'string', 'words.songs.' + k);
  assert.ok(words.songs.play.includes('{title}'));
  assert.ok(words.songs.count.includes('{n}'));
  assert.equal(words.songs.promise, "No guarantees they'll get played on the weekend");
});
test('CARD_KEYS has songs before questions', () => {
  assert.deepEqual(cards.CARD_KEYS, ['reply', 'stay', 'travel', 'weekend', 'songs', 'questions', 'envelope']);
  assert.match(read('js/first/cards.js'), /CARDS\.songs = \{ build: card => root\.sjFirst\.songsCard\.build\(card\) \};/);
});
test('index.html loads songs-core, apple and songs-card before cards', () => {
  assert.match(read('index.html'), /\["core", "food-core", "words", "store", "sound", "fx", "minute", "reply", "home", "travel-core", "travel-map", "travel-card", "weekend-card", "food-card", "songs-core", "apple", "songs-card", "cards", "app"\]/);
});
test('covers send no referrer and Apple text never goes through innerHTML', () => {
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|outerHTML|document\.write|console\./);
  const art = js.slice(js.indexOf('function artImg'), js.indexOf('function artImg') + 700);
  assert.match(art, /referrerPolicy = 'no-referrer'[\s\S]*\.src = /, 'the referrer policy is set before the address');
  assert.match(art, /\.alt = ''/);
  assert.match(art, /loading = 'lazy'/);
  assert.match(js, /rel = 'noopener noreferrer'/, 'the Apple Music link sends no referrer');
});
test('a save that fails on the open card says so, reads the board again, and keeps the choice', () => {
  const fail = js.slice(js.indexOf("if (next !== 'failed') return;"), js.indexOf("if (next !== 'failed') return;") + 400);
  assert.match(fail, /say\(w\.errors\.save\)/);
  assert.match(fail, /loadBoard\(\)/);
  assert.doesNotMatch(fail, /input\.value = ''|results = null/);
});

// ---- the open sequence (Review Focus 3) ----
function boardRig(board, known) {
  const calls = [];
  const store = {
    loadBoard: tok => { calls.push('loadBoard ' + tok); return Promise.resolve(board); },
    saveBoard: (code, ids) => { calls.push('saveBoard ' + code + ' ' + ids.join()); return Promise.resolve(true); }
  };
  const apple = { lookup: ids => { calls.push('lookup ' + ids.join()); return Promise.resolve(known); } };
  return { calls, deps: { store, apple } };
}
test('opening reads the board, puts this household\'s entry right, then asks Apple for every song on it', async () => {
  const board = { picks: { [CODE]: [A.id], [OTHER]: [B.id, A.id, C.id] }, hidden: { [C.id]: true } };
  const { calls, deps } = boardRig(board, { [A.id]: found(A), [B.id]: found(B), [D.id]: found(D) });
  const got = await songsCard.readBoard(deps, { reply: YES, songs: { at: 1, list: [D] }, pub: CODE }, TOKEN, OPEN);
  await settle();
  assert.deepEqual(calls, ['loadBoard ' + TOKEN, 'saveBoard ' + CODE + ' ' + D.id, 'lookup ' + [A.id, B.id, D.id].join()]);
  assert.equal(got.failed, false);
  assert.deepEqual(got.rows.map(r => [r.id, r.n, r.mine]), [[A.id, 1, false], [B.id, 1, false], [D.id, 1, true]]);
});
test('opening deletes the entry of a household whose list is empty, and mends nothing once requests close', async () => {
  const board = { picks: { [CODE]: [A.id] }, hidden: {} };
  const emptied = boardRig(board, { [A.id]: found(A) });
  await songsCard.readBoard(emptied.deps, { reply: YES, pub: CODE }, TOKEN, OPEN);
  await settle();
  assert.deepEqual(emptied.calls.slice(0, 2), ['loadBoard ' + TOKEN, 'saveBoard ' + CODE + ' ']);
  const closed = boardRig(board, { [A.id]: found(A), [D.id]: found(D) });
  const got = await songsCard.readBoard(closed.deps, { reply: YES, songs: { at: 1, list: [D] }, pub: CODE }, TOKEN, CLOSED);
  await settle();
  assert.ok(!closed.calls.some(c => c.startsWith('saveBoard')), closed.calls.join(' | '));
  assert.equal(got.failed, false);
});
test('opening shows the try-again line when the board or Apple gives nothing, and an empty board needs no Apple', async () => {
  const noBoard = boardRig(undefined, {});
  assert.equal((await songsCard.readBoard(noBoard.deps, { reply: YES }, TOKEN, OPEN)).failed, true);
  assert.deepEqual(noBoard.calls, ['loadBoard ' + TOKEN]);
  const appleDown = boardRig({ picks: { [OTHER]: [B.id] }, hidden: {} }, {});
  assert.equal((await songsCard.readBoard(appleDown.deps, { reply: YES }, TOKEN, OPEN)).failed, true);
  const empty = boardRig({ picks: {}, hidden: {} }, {});
  const got = await songsCard.readBoard(empty.deps, { reply: YES }, TOKEN, OPEN);
  assert.deepEqual([got.failed, got.rows], [false, []]);
  assert.deepEqual(empty.calls, ['loadBoard ' + TOKEN]);
  const thrown = { store: { loadBoard: () => { throw new Error('x'); } }, apple: {} };
  assert.equal((await songsCard.readBoard(thrown, { reply: YES }, TOKEN, OPEN)).failed, true);
});

// ---- a change to the list: made on the household as the database has it now (Review Focus 4; a partner's phone) ----
function changeRig(answers) {
  const calls = [], a = Object.assign({ load: { reply: YES }, claimPub: CODE, saveSongs: true, saveBoard: true }, answers);
  const store = {
    load: tok => { calls.push('load ' + tok); return a.load instanceof Error ? Promise.reject(a.load) : Promise.resolve(a.load); },
    claimPub: tok => { calls.push('claimPub ' + tok); return Promise.resolve(a.claimPub); },
    saveSongs: (tok, list) => { calls.push('saveSongs ' + list.map(s => s.id).join()); return Promise.resolve(a.saveSongs); },
    saveBoard: (code, ids) => { calls.push('saveBoard ' + code + ' ' + ids.join()); return Promise.resolve(a.saveBoard); }
  };
  return { calls, deps: { store } };
}
const NO = { answer: 'no', coming: [false], at: 1 };
test('the first song reads the household, claims a code, then saves the list, then the board entry', async () => {
  const { calls, deps } = changeRig();
  const res = await songsCard.applyChange(deps, { reply: YES }, TOKEN, { add: found(A) });
  await settle();
  assert.deepEqual(calls, ['load ' + TOKEN, 'claimPub ' + TOKEN, 'saveSongs ' + A.id, 'saveBoard ' + CODE + ' ' + A.id]);
  assert.equal(res.ok, true);
  assert.deepEqual([res.household.reply, res.household.pub, res.household.songs.list], [YES, CODE, [A]]);
});
test('a change is made on the household as the database has it now, so a partner\'s songs stay', async () => {
  const fresh = { reply: YES, songs: { at: 2, list: [A, B] }, pub: OTHER };
  const { calls, deps } = changeRig({ load: fresh });
  const res = await songsCard.applyChange(deps, { reply: YES }, TOKEN, { add: found(C) });
  await settle();
  assert.deepEqual(calls, ['load ' + TOKEN, 'saveSongs ' + [A.id, B.id, C.id].join(), 'saveBoard ' + OTHER + ' ' + [A.id, B.id, C.id].join()]);
  assert.deepEqual([res.ok, res.household.pub, res.household.songs.list], [true, OTHER, [A, B, C]]);
});
test('removing works on the fresh list too, and removing the last song deletes the list, then the entry', async () => {
  const { calls, deps } = changeRig({ load: { reply: YES, songs: { at: 2, list: [A] }, pub: OTHER } });
  const res = await songsCard.applyChange(deps, { reply: YES, songs: { at: 1, list: [A, B] }, pub: OTHER }, TOKEN, { remove: A.id });
  await settle();
  assert.deepEqual(calls, ['load ' + TOKEN, 'saveSongs ', 'saveBoard ' + OTHER + ' ']);
  assert.deepEqual([res.ok, res.household.songs, res.household.pub], [true, undefined, OTHER]);
});
test('a song a partner already added, or already removed, is not saved again', async () => {
  const fresh = { reply: YES, songs: { at: 2, list: [A] }, pub: OTHER };
  const added = changeRig({ load: fresh });
  assert.deepEqual(await songsCard.applyChange(added.deps, { reply: YES }, TOKEN, { add: found(A) }), { ok: true, household: fresh });
  assert.deepEqual(added.calls, ['load ' + TOKEN]);
  const removed = changeRig({ load: fresh });
  assert.deepEqual(await songsCard.applyChange(removed.deps, { reply: YES, songs: { at: 1, list: [D] } }, TOKEN, { remove: D.id }), { ok: true, household: fresh });
  assert.deepEqual(removed.calls, ['load ' + TOKEN]);
});
test('full meanwhile: nothing is saved and the household as it is comes back', async () => {
  const fresh = { reply: YES, songs: { at: 2, list: [A, B, C] }, pub: OTHER };
  const { calls, deps } = changeRig({ load: fresh });
  assert.deepEqual(await songsCard.applyChange(deps, { reply: YES }, TOKEN, { add: found(D) }), { ok: false, household: fresh });
  assert.deepEqual(calls, ['load ' + TOKEN]);
});
test('a household that no longer says yes makes no change', async () => {
  for (const load of [{ reply: NO }, null, {}]) {
    const { calls, deps } = changeRig({ load });
    assert.deepEqual(await songsCard.applyChange(deps, { reply: YES }, TOKEN, { add: found(A) }), { ok: false, left: true }, JSON.stringify(load));
    assert.deepEqual(calls, ['load ' + TOKEN]);
  }
});
test('with no clear answer from the read, the change is made on this page\'s household', async () => {
  for (const load of [undefined, new Error('offline')]) {
    const { calls, deps } = changeRig({ load });
    const res = await songsCard.applyChange(deps, { reply: YES, songs: { at: 1, list: [A] }, pub: CODE }, TOKEN, { add: found(B) });
    await settle();
    assert.deepEqual(calls, ['load ' + TOKEN, 'saveSongs ' + A.id + ',' + B.id, 'saveBoard ' + CODE + ' ' + A.id + ',' + B.id], String(load));
    assert.deepEqual(res.household.songs.list, [A, B]);
  }
});
test('a change that cannot get a code or save the list changes nothing, and says what the household is', async () => {
  const noCode = changeRig({ claimPub: null });
  assert.deepEqual(await songsCard.applyChange(noCode.deps, { reply: YES }, TOKEN, { add: found(A) }), { ok: false, household: { reply: YES } });
  assert.deepEqual(noCode.calls, ['load ' + TOKEN, 'claimPub ' + TOKEN]);
  const refused = changeRig({ load: { reply: YES, pub: CODE }, saveSongs: false });
  assert.deepEqual(await songsCard.applyChange(refused.deps, { reply: YES }, TOKEN, { add: found(A) }), { ok: false, household: { reply: YES, pub: CODE } });
  await settle();
  assert.deepEqual(refused.calls, ['load ' + TOKEN, 'saveSongs ' + A.id], 'no board entry without the list');
  const thrown = { store: { load: () => Promise.resolve({ reply: YES, pub: CODE }), saveSongs: () => { throw new Error('x'); } } };
  assert.deepEqual(await songsCard.applyChange(thrown, { reply: YES }, TOKEN, { add: found(A) }), { ok: false });
});

// ---- a change that has finished, perhaps after its card closed ----
function homeRig() {
  const calls = [];
  const home = { repaint: () => calls.push('repaint'), refresh: () => calls.push('refresh'), toast: text => calls.push('toast ' + text) };
  return { calls, first: { home } };
}
const W = { errors: { save: 'Could not save, please try again' } };
test('a saved change always reaches the household and the dock, and paints the card only while it is open', () => {
  const saved = { reply: YES, songs: { at: 1, list: [A] }, pub: CODE };
  const open = homeRig(), ctx = { household: { reply: YES } };
  assert.equal(songsCard.settleChange({ ok: true, household: saved }, ctx, open.first, W, true), 'paint');
  assert.deepEqual([ctx.household, open.calls], [saved, ['repaint']]);
  const closed = homeRig(), ctx2 = { household: { reply: YES } };
  assert.equal(songsCard.settleChange({ ok: true, household: saved }, ctx2, closed.first, W, false), null);
  assert.deepEqual([ctx2.household, closed.calls], [saved, ['repaint']], 'saved after the card closed: the phone still knows');
});
test('a failed change: the open card says so and the household is read again; once closed, the home screen says so', () => {
  const fresh = { reply: YES, songs: { at: 2, list: [A, B, C] } };
  const open = homeRig(), ctx = { household: { reply: YES } };
  assert.equal(songsCard.settleChange({ ok: false, household: fresh }, ctx, open.first, W, true), 'failed');
  assert.deepEqual([ctx.household, open.calls], [fresh, ['repaint', 'refresh']]);
  const closed = homeRig(), ctx2 = { household: { reply: YES } };
  assert.equal(songsCard.settleChange({ ok: false }, ctx2, closed.first, W, false), null);
  assert.deepEqual([ctx2.household, closed.calls], [{ reply: YES }, ['toast Could not save, please try again']]);
  const left = homeRig();
  assert.equal(songsCard.settleChange({ ok: false, left: true }, { household: { reply: YES } }, left.first, W, false), null);
  assert.deepEqual(left.calls, ['refresh'], 'a household that no longer says yes leaves for its own screen');
});
test('changes run one after another, even when the first outlives its card', async () => {
  const log = [];
  let release;
  const first = songsCard.queueChange(() => { log.push('a start'); return new Promise(r => { release = () => { log.push('a end'); r('a'); }; }); });
  const second = songsCard.queueChange(() => { log.push('b start'); return 'b'; });
  await settle();
  assert.deepEqual(log, ['a start']);
  release();
  assert.deepEqual(await Promise.all([first, second]), ['a', 'b']);
  assert.deepEqual(log, ['a start', 'a end', 'b start']);
  await songsCard.queueChange(() => Promise.reject(new Error('x'))).catch(() => null);
  assert.equal(await songsCard.queueChange(() => 'c'), 'c', 'a change that failed does not stop the next');
});
test('the card asks for changes as add or remove, queued, and settles them whether or not it is open', () => {
  assert.ok(js.includes('change({ remove: s.id }, b)'));
  assert.ok(js.includes('change({ add: f }, b)'));
  assert.ok(js.includes('change({ add: r }, b)'));
  const body = js.slice(js.indexOf('function change(intent, btn)'), js.indexOf('function change(intent, btn)') + 1200);
  assert.ok(body.includes('queueChange(() => applyChange(deps, ctx.household, token, intent))'), 'the household is read when the change runs');
  assert.ok(body.includes('settleChange(res, ctx, first, w, !gone && card.live())'));
});
test('a preview stops when the guest leaves the page', () => {
  assert.ok(js.includes('const onHidden = () => { if (document.hidden) preview.stop(); };'));
  assert.ok(js.includes("document.addEventListener('visibilitychange', onHidden)"));
  assert.ok(js.includes("document.removeEventListener('visibilitychange', onHidden)"));
});

// ---------- Apple's badge ----------
// Apple's own "Listen on Apple Music" PNG from the Download link in section 1.1 of Apple's Apple Music identity
// guidelines (Apple_Music_Listen_on_Badge_RGB_USGB-EN_CI_122225.png), unchanged, once at the foot of the board.
const BADGE_FILE = 'images/first/apple-music-badge.png';
const fakeEl = (tag, cls, text) => ({ tag, className: cls, textContent: text, children: [], appendChild(c) { this.children.push(c); return c; } });
test('the badge is one link to Apple Music, in a new tab with no referrer, holding Apple\'s picture with its alt text', () => {
  assert.equal(typeof songsCard.badge, 'function');
  const a = songsCard.badge(fakeEl, 'Listen on Apple Music');
  assert.equal(a.tag, 'a');
  assert.equal(a.className, 'sg-badge');
  assert.equal(a.href, 'https://music.apple.com/');
  assert.equal(a.target, '_blank');
  assert.equal(a.rel, 'noopener noreferrer');
  assert.equal(a.children.length, 1);
  const img = a.children[0];
  assert.equal(img.tag, 'img');
  assert.equal(img.className, 'sg-badge-i');
  assert.equal(img.src, BADGE_FILE);
  assert.equal(img.alt, 'Listen on Apple Music');
  assert.equal(img.width, 1200, 'the picture\'s own size, so its space is kept before it loads');
  assert.equal(img.height, 463);
});
test('the board ends with the badge once, before the iTunes credit line', () => {
  assert.ok(js.includes("[mineWrap, findWrap, boardWrap, badge(el, W.badge), el('p', 'sg-credit', W.credit)].forEach(e => scroll.appendChild(e));"));
  assert.equal(js.split('badge(el, W.badge)').length, 2, 'one badge');
  assert.equal(words.songs.badge, 'Listen on Apple Music', 'the alt text says what the badge says');
});
test('the badge file is Apple\'s PNG, unchanged', () => {
  const png = fs.readFileSync(path.join(__dirname, '..', BADGE_FILE));
  assert.equal(png.length, 82695);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 463);
  assert.equal(require('node:crypto').createHash('sha256').update(png).digest('hex'), 'c45fe1a2b780da1f6a56a929f60c37ac549238f0480cf22ff2819454bd5d8438');
});
test('the badge shows at least 30 px tall with clear space of a tenth of its height, and nothing changes its look', () => {
  const css = read('css/first.css');
  const rule = sel => {
    const at = css.indexOf('#first ' + sel + ' {');
    assert.ok(at >= 0, 'no rule for ' + sel);
    return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  };
  const img = rule('.sg-badge-i'), link = rule('.sg-badge');
  const h = Number((img.match(/(?:^|;)\s*height: (\d+)px/) || [])[1]);
  assert.ok(h >= 30, 'height ' + h);
  assert.match(img, /width: auto/);
  const clear = Number((link.match(/(?:^|;)\s*margin: (\d+)px;/) || [])[1]);
  assert.ok(clear >= h / 10, 'clear space ' + clear);
  for (const r of [img, link]) assert.doesNotMatch(r, /filter|opacity|transform|shadow|radius|animation|blend|border/);
});
