const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../js/first/songs-core.js');

// Invented songs, codes and households only.
const A = { id: '9100000001', title: 'Alpha', artist: 'Band One' };
const B = { id: '9100000002', title: 'beta', artist: 'Band Two' };
const C = { id: '9100000003', title: 'Gamma', artist: 'Band Three' };
const D = { id: '9100000004', title: 'Delta', artist: 'Band Four' };
const E = { id: '9100000000', title: 'ALPHA', artist: 'Band Five' };
const CODE1 = 'testcode000000000001', CODE2 = 'testcode000000000002', CODE3 = 'testcode000000000003', CODE4 = 'testcode000000000004';
const OPEN = Date.UTC(2026, 10, 10, 12), CLOSE = 1810422000000;
const yes = songs => ({ reply: { answer: 'yes', coming: [true], at: 1 }, songs });
const no = songs => ({ reply: { answer: 'no', coming: [false], at: 1 }, songs });
const found = song => ({ ...song, art: 'https://art.example/' + song.id + '.jpg', preview: 'https://audio.example/' + song.id + '.m4a', link: 'https://music.example/' + song.id });
const KNOWN = { [A.id]: found(A), [B.id]: found(B), [C.id]: found(C), [D.id]: found(D), [E.id]: found(E) };
// One Apple search result as the iTunes Search API sends it.
const APPLE = {
  wrapperType: 'track', kind: 'song', artistId: 9100000101, collectionId: 9100000201, trackId: 9100000001, artistName: 'Band One',
  collectionName: 'First Album', trackName: 'Alpha', collectionCensoredName: 'First Album', trackCensoredName: 'Alpha',
  artistViewUrl: 'https://music.apple.com/gb/artist/band-one/9100000101', collectionViewUrl: 'https://music.apple.com/gb/album/first-album/9100000201?i=9100000001&uo=4',
  trackViewUrl: 'https://music.apple.com/gb/album/alpha/9100000201?i=9100000001&uo=4', previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/x/alpha.m4a',
  artworkUrl30: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/30x30bb.jpg', artworkUrl60: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/60x60bb.jpg',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/100x100bb.jpg', collectionPrice: 7.99, trackPrice: 0.99,
  releaseDate: '2004-06-07T07:00:00Z', collectionExplicitness: 'notExplicit', trackExplicitness: 'notExplicit', discCount: 1, discNumber: 1,
  trackCount: 11, trackNumber: 2, trackTimeMillis: 222000, country: 'GBR', currency: 'GBP', primaryGenreName: 'Alternative', isStreamable: true
};
const FOUND_A = {
  id: '9100000001', title: 'Alpha', artist: 'Band One', art: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x/source/200x200bb.jpg',
  preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/x/alpha.m4a', link: 'https://music.apple.com/gb/album/alpha/9100000201?i=9100000001&uo=4'
};

test('cleanSongs keeps 1 to 3 songs in order, from an array or an object keyed 0 to 2', () => {
  assert.deepEqual(s.cleanSongs({ at: 5, list: { 0: A, 1: B } }), { at: 5, list: [A, B] });
  assert.deepEqual(s.cleanSongs({ at: 5, list: { 1: B, 0: A } }), { at: 5, list: [A, B] });
  assert.deepEqual(s.cleanSongs({ at: 5, list: [A, B, C] }), { at: 5, list: [A, B, C] });
  assert.deepEqual(s.cleanSongs({ at: 5, list: [A, B, C, D] }), { at: 5, list: [A, B, C] });
  for (const bad of [null, undefined, 'x', [], {}, { list: [A] }, { at: 'now', list: [A] }, { at: 5 }, { at: 5, list: [] }, { at: 5, list: {} },
    { at: 5, list: 'x' }, { at: 5, list: { x: A } }, { at: 5, list: [null, 'x'] }])
    assert.equal(s.cleanSongs(bad), null, JSON.stringify(bad));
});
test('cleanSong refuses bad ids and text, and drops extra fields', () => {
  assert.deepEqual(s.cleanSong({ ...A, x: 1 }), A);
  for (const bad of [null, 'x', [A], { ...A, id: '12a' }, { ...A, id: '1234567890123' }, { ...A, id: 9100000001 }, { ...A, id: '' },
    { ...A, title: '' }, { ...A, artist: '' }, { ...A, title: 'x'.repeat(201) }, { ...A, artist: 'x'.repeat(201) }, { ...A, title: 5 }, { ...A, title: ' \n ' }])
    assert.equal(s.cleanSong(bad), null, JSON.stringify(bad));
  assert.equal(s.cleanSong({ ...A, title: 'x'.repeat(200) }).title, 'x'.repeat(200));
  assert.equal(s.cleanSong({ ...A, title: 'Two\nlines' }).title, 'Two lines');
});
test('cleanSongs drops a repeated id', () => {
  assert.deepEqual(s.cleanSongs({ at: 5, list: [A, { ...A, title: 'Other' }, B] }), { at: 5, list: [A, B] });
});
test('cleanPub accepts only 20 code characters', () => {
  assert.equal(s.cleanPub(CODE1), CODE1);
  assert.equal(s.cleanPub('Ab-_' + 'z'.repeat(16)), 'Ab-_' + 'z'.repeat(16));
  for (const bad of [CODE1.slice(1), CODE1 + 'x', 'testcode00000000000 ', 'testcode0000000000.1', 12345678901234567890, null, undefined, {}])
    assert.equal(s.cleanPub(bad), null, String(bad));
});
test('cleanBoard keeps only coded entries of song ids and true hidden flags', () => {
  const raw = {
    picks: { [CODE1]: [A.id, B.id], [CODE2]: { 0: C.id, 1: A.id }, short: [D.id], [CODE3]: ['nope'], [CODE4]: [D.id, 'x'] },
    hidden: { 9100000009: true, 123: 'yes', abc: true },
    extra: { x: 1 }
  };
  assert.deepEqual(s.cleanBoard(raw), {
    picks: { [CODE1]: [A.id, B.id], [CODE2]: [C.id, A.id], [CODE4]: [D.id] },
    hidden: { 9100000009: true }
  });
  for (const junk of [null, undefined, 'x', [], 5, { picks: 'x', hidden: [] }])
    assert.deepEqual(s.cleanBoard(junk), { picks: {}, hidden: {} }, JSON.stringify(junk));
});
test('addSong appends, and refuses a repeat or a fourth', () => {
  assert.deepEqual(s.addSong([], found(A)), [A]);
  assert.deepEqual(s.addSong([A], B), [A, B]);
  assert.equal(s.addSong([A, B], { ...A }), null);
  assert.equal(s.addSong([A, B, C], D), null);
  assert.equal(s.addSong([A], { ...B, id: 'x' }), null);
  const list = [A, B];
  s.addSong(list, C);
  assert.deepEqual(list, [A, B], 'the list it was given is left as it was');
});
test('removeSong removes by id and keeps the order', () => {
  assert.deepEqual(s.removeSong([A, B, C], B.id), [A, C]);
  assert.deepEqual(s.removeSong([A, B], D.id), [A, B]);
  assert.deepEqual(s.removeSong(null, A.id), []);
  assert.deepEqual(s.idsOf([A, B]), [A.id, B.id]);
});
test('boardRows counts households per song, most wanted first, ties by title then id', () => {
  const board = { picks: { [CODE1]: [C.id, A.id], [CODE2]: [C.id, B.id, E.id], [CODE3]: [A.id, D.id, E.id] }, hidden: {} };
  const rows = s.boardRows(board, CODE4, [], KNOWN);
  // Alpha and ALPHA are the same title without case, so the lower id comes first.
  assert.deepEqual(rows.map(r => [r.id, r.n]), [[E.id, 2], [A.id, 2], [C.id, 2], [B.id, 1], [D.id, 1]]);
  assert.deepEqual(rows[1], { id: A.id, n: 2, mine: false, title: 'Alpha', artist: 'Band One', art: 'https://art.example/9100000001.jpg',
    preview: 'https://audio.example/9100000001.m4a', link: 'https://music.example/9100000001' });
  assert.deepEqual(s.boardRows(null, null, [], KNOWN), []);
});
test('boardRows leaves out hidden songs and songs Apple did not return, except your own, which use your list', () => {
  const board = { picks: { [CODE1]: [A.id, B.id], [CODE2]: [C.id] }, hidden: { [B.id]: true } };
  const rows = s.boardRows(board, CODE3, [D, B], { [A.id]: found(A) });
  assert.deepEqual(rows, [
    { id: A.id, n: 1, mine: false, title: 'Alpha', artist: 'Band One', art: 'https://art.example/9100000001.jpg',
      preview: 'https://audio.example/9100000001.m4a', link: 'https://music.example/9100000001' },
    { id: D.id, n: 1, mine: true, title: 'Delta', artist: 'Band Four', art: null, preview: null, link: null }
  ]);
});
test('boardRows counts your songs from your list, not your board entry', () => {
  const board = { picks: { [CODE1]: [A.id], [CODE2]: [A.id] }, hidden: {} };
  const rows = s.boardRows(board, CODE1, [B], KNOWN);
  assert.deepEqual(rows.map(r => [r.id, r.n, r.mine]), [[A.id, 1, false], [B.id, 1, true]]);
});
test('boardRepair gives the ids the board entry should hold, or null when it is right', () => {
  const board = { picks: { [CODE1]: [A.id, B.id] }, hidden: {} };
  assert.equal(s.boardRepair(board, CODE1, [A, B]), null);
  assert.deepEqual(s.boardRepair(board, CODE1, [B, A]), { ids: [B.id, A.id] });
  assert.deepEqual(s.boardRepair(board, CODE1, [A]), { ids: [A.id] });
  assert.deepEqual(s.boardRepair(board, CODE2, [C]), { ids: [C.id] });
  assert.deepEqual(s.boardRepair(board, CODE1, []), { ids: [] });
  assert.equal(s.boardRepair(board, CODE2, []), null);
  assert.equal(s.boardRepair(board, null, [A]), null);
  assert.equal(s.boardRepair(board, 'short', [A]), null);
});
test('searchUrl asks for songs in the UK store, from 2 characters', () => {
  assert.equal(s.searchUrl('  ab '), 'https://itunes.apple.com/search?term=ab&country=GB&media=music&entity=song&limit=8');
  assert.equal(s.searchUrl('Rock  &  Roll'), 'https://itunes.apple.com/search?term=rock%20%26%20roll&country=GB&media=music&entity=song&limit=8');
  assert.equal(s.searchUrl('a?b#c'), 'https://itunes.apple.com/search?term=a%3Fb%23c&country=GB&media=music&entity=song&limit=8');
  for (const short of ['a', '  a  ', '', null, undefined, 5]) assert.equal(s.searchUrl(short), null, String(short));
});
test('searchKey lowercases, trims and collapses spaces', () => {
  assert.equal(s.searchKey('  Mr  Bright\tSide '), 'mr bright side');
  assert.equal(s.searchKey(null), '');
});
test('lookupUrls splits 120 ids into 3 chunks of up to 50 and drops bad ids', () => {
  const ids = Array.from({ length: 120 }, (_, i) => String(9100000001 + i));
  const urls = s.lookupUrls(ids.concat(['x', '12a', ids[0]]));
  assert.deepEqual(urls, [
    'https://itunes.apple.com/lookup?id=' + ids.slice(0, 50).join(',') + '&country=GB',
    'https://itunes.apple.com/lookup?id=' + ids.slice(50, 100).join(',') + '&country=GB',
    'https://itunes.apple.com/lookup?id=' + ids.slice(100).join(',') + '&country=GB'
  ]);
  assert.deepEqual(s.lookupUrls([]), []);
  assert.deepEqual(s.lookupUrls(null), []);
});
test('fromApple maps a song', () => {
  assert.deepEqual(s.fromApple(APPLE), FOUND_A);
  assert.equal(s.fromApple({ ...APPLE, trackId: '9100000001' }).id, '9100000001');
});
test('fromApple drops what is not a song, keeps one with no preview or artwork, and cuts text to 200 whole characters on one line', () => {
  assert.equal(s.fromApple({ ...APPLE, kind: 'music-video' }), null);
  assert.equal(s.fromApple({ ...APPLE, wrapperType: 'collection' }), null);
  const { trackName, ...noName } = APPLE;
  assert.equal(s.fromApple(noName), null);
  assert.equal(s.fromApple({ ...APPLE, artistName: '  ' }), null);
  for (const id of ['x', 1.5, -5, 12345678901234, null]) assert.equal(s.fromApple({ ...APPLE, trackId: id }), null, String(id));
  assert.equal(s.fromApple(null), null);
  const { previewUrl, artworkUrl100, trackViewUrl, ...bare } = APPLE;
  assert.deepEqual(s.fromApple(bare), { id: '9100000001', title: 'Alpha', artist: 'Band One', art: null, preview: null, link: null });
  assert.equal(s.fromApple({ ...APPLE, previewUrl: 'javascript:alert(1)' }).preview, null);
  assert.equal(s.fromApple({ ...APPLE, trackViewUrl: 'http://music.apple.com/x' }).link, null);
  const long = s.fromApple({ ...APPLE, trackName: 'x'.repeat(199) + '\u{1F600}' + 'y'.repeat(50) }).title;
  assert.equal(long, 'x'.repeat(199), 'the emoji across the cut goes whole');
  assert.equal(s.fromApple({ ...APPLE, trackName: 'y'.repeat(250) }).title, 'y'.repeat(200));
  assert.equal(s.fromApple({ ...APPLE, trackName: 'A\nB' }).title, 'A B');
  assert.equal(s.fromApple({ ...APPLE, artistName: 'C\u0000\tD\u2028' }).artist, 'C D');
});
test('fromAppleBody drops repeats and junk', () => {
  assert.deepEqual(s.fromAppleBody({ resultCount: 3, results: [APPLE, APPLE, { wrapperType: 'artist', artistName: 'Band One' }] }), [FOUND_A]);
  for (const junk of [null, undefined, 'x', { results: 'x' }, { resultCount: 0, results: [] }]) assert.deepEqual(s.fromAppleBody(junk), [], JSON.stringify(junk));
});
test('songsView: open for a yes, reply first otherwise, closed from the close time, full at 3', () => {
  assert.deepEqual(s.songsView(yes(undefined), OPEN), { state: 'open', mine: [], full: false });
  assert.deepEqual(s.songsView(yes({ at: 5, list: [A] }), OPEN), { state: 'open', mine: [A], full: false });
  assert.deepEqual(s.songsView(yes({ at: 5, list: [A, B, C] }), OPEN), { state: 'open', mine: [A, B, C], full: true });
  for (const h of [null, undefined, {}, no(undefined)]) assert.equal(s.songsView(h, OPEN).state, 'replyFirst', JSON.stringify(h));
  assert.equal(s.songsView(yes(undefined), CLOSE - 1).state, 'open');
  assert.deepEqual(s.songsView(yes(undefined), CLOSE), { state: 'closed', mine: [], full: false });
  assert.deepEqual(s.songsView(yes({ at: 5, list: [A] }), CLOSE), { state: 'closed', mine: [A], full: false });
});
test('songRows counts yes households only, leaves out hidden songs, names households by display, most wanted first', () => {
  const welcome = {
    tokAAAAAAAAAAAAAAAA: { display: 'House One', people: ['Guest One'] }, tokBBBBBBBBBBBBBBBB: { display: 'house two', people: ['Guest Two'] },
    tokCCCCCCCCCCCCCCCC: { display: 'House Three', people: ['Guest Three'] }
  };
  const household = {
    tokAAAAAAAAAAAAAAAA: yes({ at: 1, list: [A, B] }), tokBBBBBBBBBBBBBBBB: yes({ at: 1, list: [B, C] }),
    tokCCCCCCCCCCCCCCCC: no({ at: 1, list: [A] }), tokDDDDDDDDDDDDDDDD: yes({ at: 1, list: [D] })
  };
  assert.deepEqual(s.songRows(welcome, household, { picks: {}, hidden: { [C.id]: true } }), [
    { id: B.id, title: 'beta', artist: 'Band Two', n: 2, households: ['House One', 'house two'] },
    { id: A.id, title: 'Alpha', artist: 'Band One', n: 1, households: ['House One'] }
  ]);
  assert.deepEqual(s.songRows(welcome, household, null).map(r => r.id), [B.id, A.id, C.id]);
  assert.deepEqual(s.songRows(null, household, null), []);
  assert.deepEqual(s.songRows(welcome, null, null), []);
});
test('djText gives one line per song for the DJ', () => {
  const rows = [{ id: B.id, title: 'beta', artist: 'Band Two', n: 2, households: ['x'] }, { id: A.id, title: 'Alpha', artist: 'Band One', n: 1, households: ['y'] }];
  assert.equal(s.djText(rows), 'Song requests\nbeta, Band Two (2)\nAlpha, Band One (1)');
  assert.equal(s.djText([]), 'Song requests\nNo requests yet');
  assert.equal(s.djText(null), 'Song requests\nNo requests yet');
});
test('removeSteps takes the song down before touching any list', () => {
  const household = {
    tokAAAAAAAAAAAAAAAA: { ...yes({ at: 1, list: [A, B] }), pub: CODE1 },
    tokBBBBBBBBBBBBBBBB: { ...yes({ at: 1, list: [A] }), pub: CODE2 },
    tokCCCCCCCCCCCCCCCC: { ...yes({ at: 1, list: [C] }), pub: CODE3 },
    tokDDDDDDDDDDDDDDDD: { ...yes({ at: 1, list: [A, C] }), pub: 'not-a-code' }
  };
  assert.deepEqual(s.removeSteps(household, A.id), [
    { ref: 'board/hidden/9100000001', value: true },
    { ref: 'household/tokAAAAAAAAAAAAAAAA/songs', value: { list: [B], at: { '.sv': 'timestamp' } } },
    { ref: 'board/picks/testcode000000000001', value: ['9100000002'] },
    { ref: 'household/tokBBBBBBBBBBBBBBBB/songs', value: null },
    { ref: 'board/picks/testcode000000000002', value: null },
    { ref: 'household/tokDDDDDDDDDDDDDDDD/songs', value: { list: [C], at: { '.sv': 'timestamp' } } }
  ]);
  assert.deepEqual(s.removeSteps(null, A.id), [{ ref: 'board/hidden/9100000001', value: true }]);
  assert.deepEqual(s.removeSteps(household, 'x'), []);
});
test('allowSteps lets a song back in, and hiddenIds lists the songs taken down, sorted', () => {
  assert.deepEqual(s.allowSteps(A.id), [{ ref: 'board/hidden/9100000001', value: null }]);
  assert.deepEqual(s.allowSteps('../x'), []);
  assert.deepEqual(s.hiddenIds({ picks: {}, hidden: { 9100000003: true, 9100000001: true, x: true, 9100000002: false } }), ['9100000001', '9100000003']);
  assert.deepEqual(s.hiddenIds(null), []);
});
