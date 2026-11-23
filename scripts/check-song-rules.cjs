'use strict';
// Proves the song board's database rules (firebase.rules.json) on the local Firebase database emulator, never the
// live database: who may write household songs and pub, songOwner and the board, the attacks the board must refuse
// (stranger writes, shorter or reordered copies, double votes, hidden ids, write-once codes, reading songOwner), and
// the dashboard's admin removal in the order js/first/songs-core.js removeSteps gives. Invented tokens, codes and
// songs only. Not part of `node --test`: it needs Java 21 and the emulator jar, which live in C:\dev-scratch.
// From the repo in Git Bash:
//   cp firebase.rules.json /c/dev-scratch/song-board/rules-test/firebase.rules.json
//   cd /c/dev-scratch/song-board/rules-test && JAVA_HOME='C:\dev-scratch\java-21\jdk-21.0.13.1+2-jre' \
//     PATH="/c/dev-scratch/java-21/jdk-21.0.13.1+2-jre/bin:$PATH" FIREBASE_EMULATORS_PATH='C:\dev-scratch\firebase-emulators' \
//     firebase emulators:exec --only database --project demo-tuscany "node <this repo>/scripts/check-song-rules.cjs"
// Prints PASS or FAIL per case and exits 1 on any failure.
const path = require('node:path');
const songsCore = require(path.join(__dirname, '..', 'js', 'first', 'songs-core.js'));

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'demo-tuscany-default-rtdb';
const ADMIN_UID = 'test-admin-uid';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const nowS = Math.floor(Date.now() / 1000);
// An unsigned test token for a uid under admins, sent as ?auth=: the emulator trusts it as that sign-in, so .validate
// still runs. (This emulator treats any Authorization: Bearer token like the owner key, which skips every rule.)
const signIn = uid => b64({ alg: 'none', kid: 'fakekid', typ: 'JWT' }) + '.' + b64({
  iss: 'https://securetoken.google.com/demo-tuscany', aud: 'demo-tuscany', iat: nowS, exp: nowS + 3600, auth_time: nowS,
  sub: uid, user_id: uid, firebase: { sign_in_provider: 'custom', identities: {} }
}) + '.';
const ADMIN = signIn(ADMIN_UID), NOT_ADMIN = signIn('test-other-uid');

const T = { yes: 'testtokenyes0000001', yes2: 'testtokenyes0000002', no: 'testtokenno00000003', none: 'testtokennone000004', unknown: 'testtokenunknown005' };
const code = s => ('testcode' + s + '0'.repeat(20)).slice(0, 20);
const C = { yes: code('yes'), yes2: code('yestwo'), second: code('second'), stray: code('stray'), none: code('none') };
const S = n => ({ id: String(9100000000 + n), title: 'Test song ' + n, artist: 'Test band ' + n });
const SV = { '.sv': 'timestamp' };
const list = (...songs) => ({ list: songs, at: SV });
const H = (token, rest) => 'household/' + token + (rest ? '/' + rest : '');

async function call(method, at, body, who) {
  const headers = who === 'owner' ? { Authorization: 'Bearer owner' } : {};
  const auth = who === 'admin' ? '&auth=' + ADMIN : who === 'signedIn' ? '&auth=' + NOT_ADMIN : '';
  const r = await fetch('http://' + HOST + '/' + at + '.json?ns=' + NS + auth, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { ok: r.ok, status: r.status, text: await r.text() };
}
async function seed(at, value) {
  const r = await call(value === null ? 'DELETE' : 'PUT', at, value === null ? undefined : value, 'owner');
  if (!r.ok) throw new Error('seed ' + at + ': ' + r.status + ' ' + r.text);
}
const valueAt = async at => JSON.parse((await call('GET', at, undefined, 'owner')).text);

let passed = 0, failed = 0;
function report(pass, name, detail) {
  if (pass) passed++; else failed++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : ' (' + detail + ')'));
}
// who: undefined for a guest or a stranger (no sign-in either way), 'admin' for Joe's dashboard, 'signedIn' for a
// sign-in that is not an admin.
async function expect(name, allowed, method, at, body, who) {
  const r = await call(method, at, body, who);
  report(r.ok === allowed, name, (allowed ? 'expected allowed' : 'expected refused') + ', got ' + r.status + ' ' + r.text.slice(0, 80));
}
const write = (name, allowed, at, value, who) => expect(name, allowed, value === null ? 'DELETE' : 'PUT', at, value === null ? undefined : value, who);
const read = (name, allowed, at, who) => expect(name, allowed, 'GET', at, undefined, who);
// The database sends keys in its own order, so values are compared with their keys sorted.
const canon = v => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v);
async function holds(name, at, want) {
  const got = await valueAt(at);
  report(JSON.stringify(canon(got)) === JSON.stringify(canon(want)), name, 'holds ' + JSON.stringify(got));
}

async function reset() {
  await seed('', null);
  await seed('admins/' + ADMIN_UID, true);
  for (const t of [T.yes, T.yes2, T.no, T.none]) await seed('welcome/' + t, { display: 'Test household', lines: ['Test line'], people: ['Test guest'] });
  await seed(H(T.yes, 'reply'), { answer: 'yes', coming: [true], at: 1 });
  await seed(H(T.yes2, 'reply'), { answer: 'yes', coming: [true], at: 1 });
  await seed(H(T.no, 'reply'), { answer: 'no', coming: [false], at: 1 });
}
// A yes household with songs, its code and its board entry, as the phone leaves them.
async function withSongs(token, pub, songs) {
  await seed(H(token, 'songs'), { list: songs, at: 1 });
  await seed('songOwner/' + pub, token);
  await seed(H(token, 'pub'), pub);
  await seed('board/picks/' + pub, songs.map(s => s.id));
}

async function main() {
  await reset();
  console.log('0. The test admin is a real sign-in, not the owner key');
  await write('0a a sign-in that is not an admin cannot write the board', false, 'board/hidden/' + S(8).id, true, 'signedIn');
  await write('0b the admin can', true, 'board/hidden/' + S(8).id, true, 'admin');
  await write('0c and its writes are still validated', false, 'welcome/' + T.unknown, { display: 'Test household' }, 'admin');
  await seed('board/hidden/' + S(8).id, null);

  console.log('1. A yes household saves, replaces and removes its songs');
  await write('1a saves 1 song', true, H(T.yes, 'songs'), list(S(1)));
  await write('1b saves 2 songs', true, H(T.yes, 'songs'), list(S(1), S(2)));
  await write('1c saves 3 songs', true, H(T.yes, 'songs'), list(S(1), S(2), S(3)));
  await write('1d replaces its list', true, H(T.yes, 'songs'), list(S(4)));
  await write('1e removes its list', true, H(T.yes, 'songs'), null);
  await write('1f a 200-character title and artist are fine', true, H(T.yes, 'songs'), list({ ...S(1), title: 'x'.repeat(200), artist: 'y'.repeat(200) }));

  console.log('2. Only a yes adds songs; a no can remove them');
  await write('2a no reply cannot add', false, H(T.none, 'songs'), list(S(1)));
  await write('2b a no cannot add', false, H(T.no, 'songs'), list(S(1)));
  await seed(H(T.no, 'songs'), { list: [S(1)], at: 1 });
  await write('2c a no can remove', true, H(T.no, 'songs'), null);
  await write('2d a token with no invitation cannot add', false, H(T.unknown, 'songs'), list(S(1)));

  console.log('3. Lists the rules refuse');
  await seed('board/hidden/' + S(9).id, true);
  const refused = {
    'a gap (slots 0 and 2)': { list: { 0: S(1), 2: S(3) }, at: SV },
    'slot 1 without slot 0': { list: { 1: S(1) }, at: SV },
    'a fourth slot': list(S(1), S(2), S(3), S(4)),
    'an id twice (slots 0 and 1)': list(S(1), { ...S(2), id: S(1).id }),
    'an id twice (slots 0 and 2)': list(S(1), S(2), { ...S(3), id: S(1).id }),
    'an id twice (slots 1 and 2)': list(S(1), S(2), { ...S(3), id: S(2).id }),
    'letters in an id': list({ ...S(1), id: '91000a0001' }),
    '13 digits in an id': list({ ...S(1), id: '1234567890123' }),
    'an id that is a number': list({ ...S(1), id: 9100000001 }),
    'an empty title': list({ ...S(1), title: '' }),
    'a 201-character title': list({ ...S(1), title: 'x'.repeat(201) }),
    'an empty artist': list({ ...S(1), artist: '' }),
    'a 201-character artist': list({ ...S(1), artist: 'x'.repeat(201) }),
    'an extra field in a song': list({ ...S(1), note: 'x' }),
    'an extra field beside the list': { list: [S(1)], at: SV, note: 'x' },
    'a song with no artist': list({ id: S(1).id, title: 'Test song 1' }),
    'at not server time': { list: [S(1)], at: 5 },
    'no at': { list: [S(1)] },
    'an empty list': { list: [], at: SV },
    'a hidden id': list(S(1), S(9))
  };
  for (const name of Object.keys(refused)) await write('3 refuses ' + name, false, H(T.yes, 'songs'), refused[name]);

  await reset();
  console.log('4. songOwner: written once, for a real invitation, never read by guests');
  await write('4a written for a known token', true, 'songOwner/' + C.yes, T.yes);
  await write('4b written once', false, 'songOwner/' + C.yes, T.yes2);
  await write('4c never deleted by a guest', false, 'songOwner/' + C.yes, null);
  await write('4d refused for an unknown token', false, 'songOwner/' + C.none, T.unknown);
  await write('4e refused for a 19-character code', false, 'songOwner/' + C.none.slice(1), T.yes);
  await write('4f refused for a 21-character code', false, 'songOwner/' + C.none + 'x', T.yes);
  await write('4g refused for a path inside an invitation', false, 'songOwner/' + C.stray, T.yes + '/people');
  await write('4h refused for a value that is not a token', false, 'songOwner/' + C.stray, 12345);
  await read('4i a guest cannot read songOwner/<code>', false, 'songOwner/' + C.yes);
  await read('4j a guest cannot read songOwner', false, 'songOwner');
  await read('4k the admin can read songOwner', true, 'songOwner', 'admin');

  console.log('5. pub: written once, only to a code whose songOwner is this token');
  await write('5a refused for a code whose songOwner is another token', false, H(T.yes2, 'pub'), C.yes);
  await write('5b refused for a code with no songOwner', false, H(T.yes, 'pub'), C.none);
  await write('5c refused when it is not a code', false, H(T.yes, 'pub'), 'short');
  await write('5d written to its own code', true, H(T.yes, 'pub'), C.yes);
  await seed('songOwner/' + C.second, T.yes);
  await write('5e written once (a second phone keeps the first code)', false, H(T.yes, 'pub'), C.second);
  await write('5f never deleted by a guest', false, H(T.yes, 'pub'), null);

  await reset();
  console.log('6. board/picks: only an exact copy of the list');
  await withSongs(T.yes, C.yes, [S(1), S(2)]);
  await seed('songOwner/' + C.stray, T.yes);
  await write('6a equal to the list, slot for slot', true, 'board/picks/' + C.yes, [S(1).id, S(2).id]);
  await write('6b shorter', false, 'board/picks/' + C.yes, [S(1).id]);
  await write('6c reordered', false, 'board/picks/' + C.yes, [S(2).id, S(1).id]);
  await write('6d longer', false, 'board/picks/' + C.yes, [S(1).id, S(2).id, S(3).id]);
  await write('6e different', false, 'board/picks/' + C.yes, [S(1).id, S(3).id]);
  await write('6f an extra key', false, 'board/picks/' + C.yes, { 0: S(1).id, 1: S(2).id, x: S(3).id });
  await write('6g one slot changed inside the entry', false, 'board/picks/' + C.yes + '/1', S(3).id);
  await write('6h a code with no songOwner', false, 'board/picks/' + C.none, [S(1).id, S(2).id]);
  await write('6i a stray code whose household pub is another code', false, 'board/picks/' + C.stray, [S(1).id, S(2).id]);
  await withSongs(T.yes2, C.yes2, [S(5)]);
  await write('6j its songs copied into the entry of another household (a double vote)', false, 'board/picks/' + C.yes2, [S(1).id, S(2).id]);

  console.log('7. Deleting a board entry');
  await write('7a refused while the list has songs', false, 'board/picks/' + C.yes, null);
  await write('7b a plain value is refused while the list has songs', false, 'board/picks/' + C.yes, 'junk');
  await seed(H(T.yes, 'songs'), null);
  // With the list gone every slot reads null on both sides: a value with no slots must still be refused.
  for (const [n, value] of [['c', 'junk'], ['d', 12345], ['e', true]])
    await write('7' + n + ' a plain value (' + JSON.stringify(value) + ') at a code whose list is gone is refused', false, 'board/picks/' + C.yes, value);
  await write('7f deleting is allowed once the list is removed', true, 'board/picks/' + C.yes, null);

  await reset();
  console.log('8. A stranger can sync an entry only to its true value');
  await withSongs(T.yes, C.yes, [S(1), S(2)]);
  await seed(H(T.yes, 'songs'), { list: [S(3)], at: 1 });
  await write('8a refused: an old value', false, 'board/picks/' + C.yes, [S(1).id, S(2).id]);
  await write('8b refused: someone else\'s songs', false, 'board/picks/' + C.yes, [S(5).id]);
  await write('8c allowed: the list as it is', true, 'board/picks/' + C.yes, [S(3).id]);
  await holds('8d the entry holds the list', 'board/picks/' + C.yes, [S(3).id]);

  console.log('9. Reading the board and taking songs down');
  await read('9a anyone can read board.json', true, 'board');
  await write('9b a guest cannot write board/hidden', false, 'board/hidden/' + S(5).id, true);
  await seed('board/hidden/' + S(6).id, true);
  await write('9c a guest cannot delete board/hidden', false, 'board/hidden/' + S(6).id, null);
  await write('9d a guest cannot write the board itself', false, 'board', { picks: {}, hidden: {} });
  await write('9e a guest cannot delete the board', false, 'board', null);

  await reset();
  console.log('10. The dashboard takes a song down (admin)');
  await withSongs(T.yes, C.yes, [S(1), S(2)]);
  await withSongs(T.yes2, C.yes2, [S(1)]);
  const household = await valueAt('household');
  const steps = songsCore.removeSteps(household, S(1).id);
  for (const [i, st] of steps.entries()) await write('10' + 'abcdefgh'[i] + ' step ' + (i + 1) + ' of ' + steps.length + ': ' + st.ref, true, st.ref, st.value, 'admin');
  await holds('10x the song is hidden', 'board/hidden/' + S(1).id, true);
  await holds('10x the first list keeps the other song', H(T.yes, 'songs/list'), [S(2)]);
  await holds('10x its board entry matches', 'board/picks/' + C.yes, [S(2).id]);
  await holds('10x the emptied list is gone', H(T.yes2, 'songs'), null);
  await holds('10x its board entry is gone', 'board/picks/' + C.yes2, null);
  await write('10y a yes household cannot add it back', false, H(T.yes, 'songs'), list(S(2), S(1)));
  await write('10z a hidden value that is not true is refused', false, 'board/hidden/' + S(7).id, 'yes', 'admin');
  for (const st of songsCore.allowSteps(S(1).id)) await write('10z allow again: ' + st.ref, true, st.ref, st.value, 'admin');
  await write('10z the song can be added again', true, H(T.yes, 'songs'), list(S(2), S(1)));

  await reset();
  console.log('11. Existing paths still work for a yes household');
  await write('11a reply', true, H(T.yes2, 'reply'), { answer: 'yes', coming: [true, false], at: SV });
  await write('11b stay', true, H(T.yes2, 'stay'), { choice: 'later', at: SV });
  await write('11c food', true, H(T.yes2, 'food'), { at: SV, people: { 0: { name: 'Test guest', picks: { none: true } } } });
  await write('11d anything else under household is still refused', false, H(T.yes2, 'notes'), 'x');

  console.log((failed ? 'FAILED: ' : 'ALL PASS: ') + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
