const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// The clearing itself (the list, then the board entry; no request for a household with neither) is tested in
// songs-store.test.cjs. These check the two places that call it, which need a page to run.
function block(js, head) {
  const at = js.indexOf(head);
  assert.ok(at >= 0, 'missing: ' + head);
  let depth = 0, i = js.indexOf('{', at);
  const start = i;
  for (; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) break;
  }
  return js.slice(start, i + 1);
}

test('saving a no clears the household\'s songs, and the household it leaves has none', () => {
  const saved = block(read('js/first/reply.js'), 'function saved(choice)');
  assert.match(saved, /const was = ctx\.household/);
  const notYes = block(saved, "if (choice.answer !== 'yes')");
  assert.match(notYes, /clearSongsIfAny\(token, was\)/, 'cleared from the household as it was before the save');
  assert.match(notYes, /delete next\.songs/);
  assert.doesNotMatch(notYes, /delete next\.pub/, 'the board code stays with the household');
  assert.ok(saved.indexOf('delete next.songs') < saved.indexOf('ctx.household = next'), 'gone before the new household is used');
});
test('landing on can\'t come clears songs left behind, and this visit shows none', () => {
  const route = block(read('js/first/app.js'), 'function route(');
  const cantcome = block(route, "if (where === 'cantcome')");
  assert.match(cantcome, /const was = ctx\.household/);
  assert.match(cantcome, /clearSongsIfAny\(ctx\.invite\.token, was\)/);
  assert.match(cantcome, /delete ctx\.household\.songs/);
  assert.match(cantcome, /return show\(justWatched \? 'already' : 'cantcome'\)/);
});
