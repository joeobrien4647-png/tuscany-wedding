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
test('a save that fails says so, reads the household and the board again, and keeps the choice', () => {
  const fail = js.slice(js.indexOf('if (!res.ok)'), js.indexOf('if (!res.ok)') + 500);
  assert.match(fail, /say\(w\.errors\.save\)/);
  assert.match(fail, /home\.refresh\(\)/);
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

// ---- a change to the list (Review Focus 4) ----
function changeRig(answers) {
  const calls = [], a = Object.assign({ claimPub: CODE, saveSongs: true, saveBoard: true }, answers);
  const store = {
    claimPub: tok => { calls.push('claimPub ' + tok); return Promise.resolve(a.claimPub); },
    saveSongs: (tok, list) => { calls.push('saveSongs ' + list.map(s => s.id).join()); return Promise.resolve(a.saveSongs); },
    saveBoard: (code, ids) => { calls.push('saveBoard ' + code + ' ' + ids.join()); return Promise.resolve(a.saveBoard); }
  };
  return { calls, deps: { store } };
}
test('the first song claims a code, then saves the list, then the board entry', async () => {
  const { calls, deps } = changeRig();
  const res = await songsCard.applyChange(deps, { reply: YES }, TOKEN, [A]);
  await settle();
  assert.deepEqual(calls, ['claimPub ' + TOKEN, 'saveSongs ' + A.id, 'saveBoard ' + CODE + ' ' + A.id]);
  assert.equal(res.ok, true);
  assert.deepEqual([res.household.reply, res.household.pub, res.household.songs.list], [YES, CODE, [A]]);
});
test('a household with a code saves straight away, and removing its last song deletes the list, then the entry', async () => {
  const more = changeRig();
  const res = await songsCard.applyChange(more.deps, { reply: YES, songs: { at: 1, list: [A] }, pub: OTHER }, TOKEN, [A, B]);
  await settle();
  assert.deepEqual(more.calls, ['saveSongs ' + A.id + ',' + B.id, 'saveBoard ' + OTHER + ' ' + A.id + ',' + B.id]);
  assert.deepEqual(res.household.songs.list, [A, B]);
  const last = changeRig();
  const gone = await songsCard.applyChange(last.deps, { reply: YES, songs: { at: 1, list: [A] }, pub: OTHER }, TOKEN, []);
  await settle();
  assert.deepEqual(last.calls, ['saveSongs ', 'saveBoard ' + OTHER + ' ']);
  assert.equal(gone.household.songs, undefined);
  assert.equal(gone.household.pub, OTHER);
});
test('a change that cannot get a code or save the list changes nothing', async () => {
  const noCode = changeRig({ claimPub: null });
  assert.deepEqual(await songsCard.applyChange(noCode.deps, { reply: YES }, TOKEN, [A]), { ok: false });
  assert.deepEqual(noCode.calls, ['claimPub ' + TOKEN]);
  const refused = changeRig({ saveSongs: false });
  assert.deepEqual(await songsCard.applyChange(refused.deps, { reply: YES, pub: CODE }, TOKEN, [A]), { ok: false });
  await settle();
  assert.deepEqual(refused.calls, ['saveSongs ' + A.id], 'no board entry without the list');
  const thrown = { store: { saveSongs: () => { throw new Error('x'); } } };
  assert.deepEqual(await songsCard.applyChange(thrown, { reply: YES, pub: CODE }, TOKEN, [A]), { ok: false });
});
