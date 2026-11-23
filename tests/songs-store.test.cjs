const { test } = require('node:test');
const assert = require('node:assert/strict');
const store = require('../js/first/store.js');
const apple = require('../js/first/apple.js');

// Invented household, codes and songs only.
const TOKEN = 'tok_SONGSTOREABCDEFG';
const CODE = 'testcode000000000001', OTHER = 'testcode000000000002';
const CODE_RE = /^[A-Za-z0-9_-]{20}$/;
const A = { id: '9100000001', title: 'Alpha', artist: 'Band One' };
const B = { id: '9100000002', title: 'beta', artist: 'Band Two' };
const C = { id: '9100000003', title: 'Gamma', artist: 'Band Three' };
const D = { id: '9100000004', title: 'Delta', artist: 'Band Four' };
const YES = { answer: 'yes', coming: [true], at: 1 };
const LOCAL = { hostname: 'localhost', search: '?wtest=1' };
// One Apple search result as the iTunes Search API sends it, and what it becomes.
const appleSong = (id, name) => ({
  wrapperType: 'track', kind: 'song', artistId: 9100000101, collectionId: 9100000201, trackId: Number(id), artistName: 'Band One',
  collectionName: 'First Album', trackName: name, collectionCensoredName: 'First Album', trackCensoredName: name,
  artistViewUrl: 'https://music.apple.com/gb/artist/band-one/9100000101', collectionViewUrl: 'https://music.apple.com/gb/album/first-album/9100000201?i=' + id + '&uo=4',
  trackViewUrl: 'https://music.apple.com/gb/album/x/9100000201?i=' + id + '&uo=4', previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/x/' + id + '.m4a',
  artworkUrl30: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/30x30bb.jpg', artworkUrl60: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/60x60bb.jpg',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/100x100bb.jpg', collectionPrice: 7.99, trackPrice: 0.99,
  releaseDate: '2004-06-07T07:00:00Z', collectionExplicitness: 'notExplicit', trackExplicitness: 'notExplicit', discCount: 1, discNumber: 1,
  trackCount: 11, trackNumber: 2, trackTimeMillis: 222000, country: 'GBR', currency: 'GBP', primaryGenreName: 'Alternative', isStreamable: true
});
const foundSong = (id, name) => ({
  id, title: name, artist: 'Band One', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/200x200bb.jpg',
  preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/x/' + id + '.m4a', link: 'https://music.apple.com/gb/album/x/9100000201?i=' + id + '&uo=4'
});

function withGlobals(over, fn) {
  const saved = {};
  for (const k of Object.keys(over)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: over[k], configurable: true, writable: true });
  }
  const restore = () => {
    for (const k of Object.keys(over)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; }
  };
  return Promise.resolve().then(fn).then(r => { restore(); return r; }, e => { restore(); throw e; });
}
const res = (body, ok = true, status = ok ? 200 : 401) => ({ ok, status, json: () => Promise.resolve(body) });
const offline = () => Promise.reject(new Error('offline'));
// A fetch that records each call and gives the answers in order (the last one repeats).
function recorder(answers) {
  const calls = [];
  const fetch = (url, opts) => {
    calls.push({ url, opts: opts || {} });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    return typeof a === 'function' ? a() : Promise.resolve(a);
  };
  return { calls, fetch };
}
const path = url => url.replace(/^https:\/\/[^/]+\//, '');

test('clean keeps songs and pub', () => {
  const raw = { reply: YES, songs: { at: 5, list: [A, B] }, pub: CODE };
  assert.deepEqual(store.clean(raw), raw);
});
test('clean keeps a record with only songs or only a pub', () => {
  assert.deepEqual(store.clean({ songs: { at: 5, list: [A] } }), { songs: { at: 5, list: [A] } });
  assert.deepEqual(store.clean({ pub: CODE }), { pub: CODE });
});
test('clean drops bad songs and codes', () => {
  assert.equal(store.clean({ songs: { at: 5, list: [{ ...A, id: 'x' }] }, pub: 'short' }), null);
  assert.deepEqual(store.clean({ reply: YES, songs: 'x', pub: 5 }), { reply: YES });
});

test('saveSongs PUTs the whole list with server time', async () => {
  const r = recorder([res({})]);
  assert.equal(await withGlobals({ fetch: r.fetch }, () => store.saveSongs(TOKEN, [A, { ...B, art: 'https://x.example/b.jpg' }])), true);
  assert.equal(r.calls.length, 1);
  assert.equal(path(r.calls[0].url), 'household/tok_SONGSTOREABCDEFG/songs.json');
  assert.equal(r.calls[0].opts.method, 'PUT');
  assert.deepEqual(JSON.parse(r.calls[0].opts.body), { list: [A, B], at: { '.sv': 'timestamp' } });
  assert.equal(await withGlobals({ fetch: recorder([res(null, false)]).fetch }, () => store.saveSongs(TOKEN, [A])), false);
  assert.equal(await withGlobals({ fetch: offline }, () => store.saveSongs(TOKEN, [A])), false);
});
test('saveSongs DELETEs for an empty list', async () => {
  const r = recorder([res(null)]);
  assert.equal(await withGlobals({ fetch: r.fetch }, () => store.saveSongs(TOKEN, [])), true);
  assert.equal(path(r.calls[0].url), 'household/tok_SONGSTOREABCDEFG/songs.json');
  assert.equal(r.calls[0].opts.method, 'DELETE');
  assert.equal(r.calls[0].opts.body, undefined);
});
test('saveSongs refuses 4 songs or a bad song without a request', async () => {
  const r = recorder([res({})]);
  await withGlobals({ fetch: r.fetch }, async () => {
    for (const bad of [[A, B, C, D], [{ ...A, id: 'x' }], [A, { ...A }], [null], 'x', undefined])
      assert.equal(await store.saveSongs(TOKEN, bad), false, JSON.stringify(bad));
    assert.equal(await store.saveSongs('bad', [A]), false);
  });
  assert.equal(r.calls.length, 0);
});

test('claimPub writes songOwner, then pub', async () => {
  const r = recorder([res(TOKEN), res('x')]);
  const code = await withGlobals({ fetch: r.fetch }, () => store.claimPub(TOKEN));
  assert.match(code, CODE_RE);
  assert.deepEqual(r.calls.map(c => [c.opts.method, path(c.url), JSON.parse(c.opts.body)]), [
    ['PUT', 'songOwner/' + code + '.json', TOKEN],
    ['PUT', 'household/tok_SONGSTOREABCDEFG/pub.json', code]
  ]);
});
test('claimPub makes its code from crypto.getRandomValues alone', async () => {
  const fill = n => ({ getRandomValues: a => a.fill(n) });
  assert.equal(await withGlobals({ crypto: fill(0), fetch: recorder([res({})]).fetch }, () => store.claimPub(TOKEN)), '-'.repeat(20));
  assert.equal(await withGlobals({ crypto: fill(63), fetch: recorder([res({})]).fetch }, () => store.claimPub(TOKEN)), 'z'.repeat(20));
  const broken = { getRandomValues: () => { throw new Error('no crypto'); } };
  const r = recorder([res({})]);
  assert.equal(await withGlobals({ crypto: broken, fetch: r.fetch }, () => store.claimPub(TOKEN)), null);
  assert.equal(r.calls.length, 0);
});
test('claimPub falls back to the pub already saved when its own is refused', async () => {
  const r = recorder([res(TOKEN), res({ error: 'Permission denied' }, false), res(OTHER)]);
  assert.equal(await withGlobals({ fetch: r.fetch }, () => store.claimPub(TOKEN)), OTHER);
  assert.equal(r.calls.length, 3);
  assert.equal(path(r.calls[2].url), 'household/tok_SONGSTOREABCDEFG/pub.json');
  assert.equal(r.calls[2].opts.method, undefined, 'a read');
});
test('claimPub gives null when nothing works', async () => {
  assert.equal(await withGlobals({ fetch: offline }, () => store.claimPub(TOKEN)), null);
  assert.equal(await withGlobals({ fetch: recorder([res(TOKEN), res(null, false), res('short')]).fetch }, () => store.claimPub(TOKEN)), null);
  assert.equal(await withGlobals({ fetch: recorder([res(TOKEN), res(null, false), res(null)]).fetch }, () => store.claimPub(TOKEN)), null);
  assert.equal(await store.claimPub('bad'), null);
});

test('saveBoard PUTs the ids or DELETEs', async () => {
  const r = recorder([res({}), res(null)]);
  await withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.saveBoard(CODE, [A.id, B.id]), true);
    assert.equal(await store.saveBoard(CODE, []), true);
    for (const [code, ids] of [['short', [A.id]], [CODE, ['x']], [CODE, [9100000001]], [CODE, [A.id, B.id, C.id, D.id]], [CODE, 'x']])
      assert.equal(await store.saveBoard(code, ids), false, JSON.stringify([code, ids]));
  });
  assert.deepEqual(r.calls.map(c => [c.opts.method, path(c.url), c.opts.body && JSON.parse(c.opts.body)]), [
    ['PUT', 'board/picks/testcode000000000001.json', [A.id, B.id]],
    ['DELETE', 'board/picks/testcode000000000001.json', undefined]
  ]);
  assert.equal(await withGlobals({ fetch: recorder([res(null, false)]).fetch }, () => store.saveBoard(CODE, [A.id])), false);
});
test('loadBoard cleans board.json and gives undefined with no answer', async () => {
  const r = recorder([res({ picks: { [CODE]: [A.id], bad: [B.id] }, hidden: { [C.id]: true, [D.id]: 'yes' } })]);
  assert.deepEqual(await withGlobals({ fetch: r.fetch }, () => store.loadBoard(TOKEN)), { picks: { [CODE]: [A.id] }, hidden: { [C.id]: true } });
  assert.equal(path(r.calls[0].url), 'board.json');
  assert.equal(r.calls[0].opts.credentials, 'omit');
  assert.deepEqual(await withGlobals({ fetch: recorder([res(null)]).fetch }, () => store.loadBoard(TOKEN)), { picks: {}, hidden: {} }, 'no board yet');
  assert.equal(await withGlobals({ fetch: offline }, () => store.loadBoard(TOKEN)), undefined);
  assert.equal(await withGlobals({ fetch: recorder([res(null, false)]).fetch }, () => store.loadBoard(TOKEN)), undefined);
  const badJson = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) });
  assert.equal(await withGlobals({ fetch: badJson }, () => store.loadBoard(TOKEN)), undefined);
});

test('clearSongs removes the list before the board entry', async () => {
  const r = recorder([res(null), res(null)]);
  assert.equal(await withGlobals({ fetch: r.fetch }, () => store.clearSongs(TOKEN, CODE)), true);
  assert.deepEqual(r.calls.map(c => [c.opts.method, path(c.url)]), [
    ['DELETE', 'household/tok_SONGSTOREABCDEFG/songs.json'], ['DELETE', 'board/picks/testcode000000000001.json']]);
  const refused = recorder([res(null, false)]);
  assert.equal(await withGlobals({ fetch: refused.fetch }, () => store.clearSongs(TOKEN, CODE)), false);
  assert.equal(refused.calls.length, 1, 'the board entry waits for the list (the rules would refuse it)');
  const noCode = recorder([res(null)]);
  assert.equal(await withGlobals({ fetch: noCode.fetch }, () => store.clearSongs(TOKEN, null)), true);
  assert.equal(noCode.calls.length, 1);
});
test('clearSongsIfAny makes no request for a household with neither', async () => {
  const r = recorder([res(null)]);
  await withGlobals({ fetch: r.fetch }, async () => {
    assert.equal(await store.clearSongsIfAny(TOKEN, { reply: YES }), true);
    assert.equal(await store.clearSongsIfAny(TOKEN, null), true);
  });
  assert.equal(r.calls.length, 0);
  const both = recorder([res(null), res(null)]);
  assert.equal(await withGlobals({ fetch: both.fetch }, () => store.clearSongsIfAny(TOKEN, { songs: { at: 1, list: [A] }, pub: CODE })), true);
  assert.equal(both.calls.length, 2);
  // A code alone still clears: it mends a board entry an earlier clear left behind.
  const pubOnly = recorder([res(null), res(null)]);
  assert.equal(await withGlobals({ fetch: pubOnly.fetch }, () => store.clearSongsIfAny(TOKEN, { pub: CODE })), true);
  assert.deepEqual(pubOnly.calls.map(c => path(c.url)), ['household/tok_SONGSTOREABCDEFG/songs.json', 'board/picks/testcode000000000001.json']);
});

test('local-test mode keeps song saves in memory and lays saved board entries over the test board', async () => {
  const tok = 'tok_LOCALSONGS00001', urls = [];
  const fetch = u => {
    urls.push(u);
    if (u.startsWith('.local-test/household/')) return Promise.resolve(res({ reply: YES, songs: { at: 1, list: [A] } }));
    return Promise.resolve(res({ picks: { [OTHER]: [B.id] }, hidden: {} }));
  };
  await withGlobals({ location: LOCAL, fetch }, async () => {
    assert.deepEqual((await store.load(tok)).songs, { at: 1, list: [A] });
    assert.equal(await store.saveSongs(tok, []), true);
    assert.equal((await store.load(tok)).songs, undefined, 'a removed list stays removed over the fixture');
    assert.equal(await store.saveSongs(tok, [B]), true);
    assert.deepEqual((await store.load(tok)).songs.list, [B]);
    const code = await store.claimPub(tok);
    assert.match(code, CODE_RE);
    assert.equal((await store.load(tok)).pub, code);
    assert.equal(await store.saveBoard(code, [B.id]), true);
    assert.deepEqual(await store.loadBoard(tok), { picks: { [OTHER]: [B.id], [code]: [B.id] }, hidden: {} });
    assert.equal(await store.saveBoard(code, []), true);
    assert.deepEqual(await store.loadBoard(tok), { picks: { [OTHER]: [B.id] }, hidden: {} });
  });
  assert.ok(urls.every(u => u.startsWith('.local-test/')), 'nothing leaves the page: ' + urls.join(' '));
  assert.ok(urls.includes('.local-test/board/' + tok + '.json'));
  const missing = recorder([res(null, false, 404)]);
  assert.deepEqual(await withGlobals({ location: LOCAL, fetch: missing.fetch }, () => store.loadBoard('tok_LOCALSONGS00002')), { picks: {}, hidden: {} }, 'a missing file is an empty board');
});

test('search asks Apple once per term and answers a repeat from memory', async () => {
  const r = recorder([res({ resultCount: 1, results: [appleSong('9100000301', 'Alpha Search')] })]);
  await withGlobals({ fetch: r.fetch }, async () => {
    assert.deepEqual(await apple.search('Alpha  Search'), [foundSong('9100000301', 'Alpha Search')]);
    assert.deepEqual(await apple.search('  alpha search '), [foundSong('9100000301', 'Alpha Search')]);
    assert.deepEqual(await apple.search('a'), [], 'too short to ask');
  });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, 'https://itunes.apple.com/search?term=alpha%20search&country=GB&media=music&entity=song&limit=8');
});
test('search gives undefined on 403, 429, 503, a network failure or bad JSON, and asks again next time', async () => {
  const status = n => () => Promise.resolve({ ok: false, status: n, json: () => Promise.resolve({ errorMessage: 'x' }) });
  const failures = { 403: status(403), 429: status(429), 503: status(503), offline, badJson: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) }) };
  for (const name of Object.keys(failures))
    assert.equal(await withGlobals({ fetch: failures[name] }, () => apple.search('failing term')), undefined, name);
  const r = recorder([res({ results: [appleSong('9100000302', 'Back Again')] })]);
  assert.deepEqual(await withGlobals({ fetch: r.fetch }, () => apple.search('failing term')), [foundSong('9100000302', 'Back Again')]);
  assert.equal(r.calls.length, 1);
});
test('search sends no credentials and no referrer, and its URL holds only the term', async () => {
  const r = recorder([res({ resultCount: 0, results: [] })]);
  const page = { href: 'https://example.test/?i=' + TOKEN, hostname: 'example.test', search: '?i=' + TOKEN };
  assert.deepEqual(await withGlobals({ fetch: r.fetch, location: page }, () => apple.search('privacy check')), []);
  assert.equal(r.calls[0].opts.credentials, 'omit');
  assert.equal(r.calls[0].opts.referrerPolicy, 'no-referrer');
  assert.equal(r.calls[0].url, 'https://itunes.apple.com/search?term=privacy%20check&country=GB&media=music&entity=song&limit=8');
  assert.ok(!r.calls[0].url.includes(TOKEN));
});
test('lookup splits into chunks and keeps what came back when one chunk fails', async () => {
  const ids = Array.from({ length: 60 }, (_, i) => String(9200000001 + i));
  const r = recorder([res({ resultCount: 50, results: ids.slice(0, 50).map(id => appleSong(id, 'Song ' + id)) }), res(null, false, 503)]);
  const got = await withGlobals({ fetch: r.fetch }, () => apple.lookup(ids));
  assert.deepEqual(r.calls.map(c => c.url), [
    'https://itunes.apple.com/lookup?id=' + ids.slice(0, 50).join(',') + '&country=GB',
    'https://itunes.apple.com/lookup?id=' + ids.slice(50).join(',') + '&country=GB'
  ]);
  for (const c of r.calls) { assert.equal(c.opts.credentials, 'omit'); assert.equal(c.opts.referrerPolicy, 'no-referrer'); }
  assert.equal(Object.keys(got).length, 50);
  assert.deepEqual(got[ids[0]], foundSong(ids[0], 'Song ' + ids[0]));
  assert.equal(got[ids[59]], undefined);
  // Songs already known come from memory: asking again sends only the chunk that failed.
  const again = recorder([res({ resultCount: 0, results: [] })]);
  assert.equal(Object.keys(await withGlobals({ fetch: again.fetch }, () => apple.lookup(ids))).length, 50);
  assert.deepEqual(again.calls.map(c => c.url), ['https://itunes.apple.com/lookup?id=' + ids.slice(50).join(',') + '&country=GB']);
});
test('lookup answers a song a search found from memory', async () => {
  await withGlobals({ fetch: recorder([res({ results: [appleSong('9100000303', 'Found Before')] })]).fetch }, () => apple.search('found before'));
  const r = recorder([res({ results: [] })]);
  assert.deepEqual(await withGlobals({ fetch: r.fetch }, () => apple.lookup(['9100000303', 'x'])), { 9100000303: foundSong('9100000303', 'Found Before') });
  assert.equal(r.calls.length, 0);
});
