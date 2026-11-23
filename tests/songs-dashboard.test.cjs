// What Joe and Sophie see of the song board: every request with its households, take down, allow again, copy for
// the DJ. The rows and steps themselves are tested in songs-core.test.cjs; these check the page wires them in.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('dashboard.html');
const panel = html.slice(html.indexOf('function InvitationsPanel'), html.indexOf('function SiteTab'));

test('songs-core.js loads right after food-core.js', () => {
  assert.match(html, /<script src="js\/first\/food-core\.js"><\/script>\r?\n {2}<script src="js\/first\/songs-core\.js"><\/script>/);
});
test('the board is read without a cache and reaches the invitations panel', () => {
  assert.match(html, /const \[board\] = useStorage\("board", EMPTY_MAP, asMap, \{ noCache: true \}\);/);
  assert.ok(html.match(/const NO_CACHE_KEYS = \[([^\]]*)\]/)[1].includes('"board"'), 'an old cached copy is removed');
  assert.match(html, /function SiteTab\(\{[^}]*\btravel, board, invitesStatus \}\)/);
  assert.match(html, /<SiteTab [^\n]*travel=\{travel\} board=\{board\} invitesStatus=\{invitesStatus\}/);
  assert.match(html, /<InvitationsPanel [^\n]*travel=\{travel\} board=\{board\} status=\{invitesStatus\}/);
  assert.match(panel, /^function InvitationsPanel\(\{ welcome, seen, household, travel, board, status \}\)/);
});
test('the runner writes a step to its own ref, or to the household, and passes the household\'s board code', () => {
  assert.ok(panel.includes('db.ref(st.ref || ("household/" + r.token + "/" + st.path))'), 'st.ref ||');
  assert.ok(panel.includes('pub: sjFirst.songs.cleanPub((household[r.token] || {}).pub)'));
});
test('the Clear confirm mentions the songs', () => {
  const clear = panel.slice(panel.indexOf('const clearReply'), panel.indexOf('const clearReply') + 300);
  assert.match(clear, /window\.confirm\("Clear the reply, the stay choice, the food needs and the songs for "/);
});
test('the song list: rows from songRows, Copy as text for the DJ, Remove after a confirm, Allow again', () => {
  assert.ok(panel.includes('sjFirst.songs.songRows(welcome, household, board)'));
  assert.ok(panel.includes('sjFirst.songs.djText(songList)'));
  assert.ok(panel.includes('sjFirst.songs.hiddenIds(board)'));
  assert.ok(panel.includes('sjFirst.songs.allowSteps(id)'));
  assert.match(panel, /data-song-list/);
  const remove = panel.slice(panel.indexOf('const removeSong'), panel.indexOf('const removeSong') + 400);
  assert.match(remove, /if \(!window\.confirm\('Take "' \+ s\.title \+ '" off the board for good\? It comes off every list and nobody can add it again\.'\)\) return;/);
  assert.ok(remove.indexOf('window.confirm') < remove.indexOf('sjFirst.songs.removeSteps(household, s.id)'), 'confirmed before anything is written');
});
test('song steps are written in order, one at a time, and a failure says how far it got', () => {
  const runner = panel.slice(panel.indexOf('const runSongSteps'), panel.indexOf('const runSongSteps') + 700);
  assert.match(runner, /steps\.reduce\(\(chain, st\) => chain\.then\(/);
  assert.match(runner, /db\.ref\(st\.ref\)/);
  assert.match(runner, /st\.value === null \? ref\.remove\(\) : ref\.set\(st\.value\)/);
  assert.match(runner, /window\.alert\(/);
  assert.match(runner, /done \+ " of " \+ steps\.length/);
});
test('names of songs taken down come from one Apple lookup with no credentials or referrer, else the id', () => {
  assert.ok(panel.includes('sjFirst.songs.lookupUrls(hiddenList)'));
  assert.ok(panel.includes('sjFirst.songs.fromAppleBody('));
  assert.match(panel, /credentials: "omit", referrerPolicy: "no-referrer"/);
  assert.ok(panel.includes('hiddenNames[id] || id'));
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
});
