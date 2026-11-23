const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
// The emulator check (scripts/check-song-rules.cjs) proves what these rules allow; this keeps their shape in the file.
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.rules.json'), 'utf8')).rules;

function readRulesUnder(node, at) {
  const out = [];
  Object.keys(node).forEach(k => {
    if (k === '.read') out.push(at);
    else if (node[k] && typeof node[k] === 'object') out.push(...readRulesUnder(node[k], at + '/' + k));
  });
  return out;
}

test('the rules have the song paths', () => {
  const h = rules.household.$token;
  assert.ok(h.songs && h.songs.list && h.songs.list.$i, 'household/$token/songs');
  assert.ok(h.pub && h.pub['.write'], 'household/$token/pub');
  assert.ok(rules.songOwner && rules.songOwner.$pub && rules.songOwner.$pub['.write'], 'songOwner/$pub');
  assert.ok(rules.board && rules.board.picks && rules.board.picks.$pub, 'board/picks/$pub');
  assert.ok(rules.board.hidden && rules.board.hidden.$id, 'board/hidden/$id');
  assert.equal(rules.board['.read'], true);
  assert.deepEqual(readRulesUnder(rules.songOwner, 'songOwner'), [], 'nobody but an admin reads songOwner');
});
test('the songs close time in the rules is SONGS_CLOSE_MS', () => {
  assert.ok(rules.household.$token.songs['.write'].includes('now < ' + core.SONGS_CLOSE_MS));
});
test('household still refuses anything else', () => {
  assert.equal(rules.household.$token.$other['.validate'], false);
  assert.equal(rules.household.$token.songs.$other['.validate'], false);
  assert.equal(rules.household.$token.songs.list.$i.$other['.validate'], false);
});
