const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function run(search, bookEnabled = false, introEnabled = false) {
  const head = html.match(/<script id="optional-head"[^>]*>([\s\S]*?)<\/script>/);
  const body = html.match(/<script id="optional-body"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(head && body, 'optional-asset gates exist');
  const writes = [], historyCalls = [];
  const location = { pathname: '/', search, hash: '#card' };
  const config = { getAttribute: n => ({'data-book-enabled': String(bookEnabled), 'data-intro-enabled': String(introEnabled)})[n] };
  const ctx = { URLSearchParams, location, window: {}, document: { currentScript: config, write: s => writes.push(s) },
    history: { state: { sample: true }, replaceState: (state, _, url) => { historyCalls.push({ state, url }); location.search = new URL(url, 'https://example.test').search; } } };
  vm.runInNewContext(head[1], ctx); vm.runInNewContext(body[1], ctx);
  return { text: writes.join(''), historyCalls };
}

test('ordinary visits fetch no optional film or book assets', () => {
  const r = run('');
  assert.doesNotMatch(r.text, /storybook|intro\.js|Cormorant|Pinyon/);
});
test('book and film previews load only their own assets in source order', () => {
  const book = run('?book=1').text;
  for (const x of ['storybook.css', 'storybook-scenes.js', 'storybook-art.js', 'storybook-sound.js', 'storybook.js']) assert.ok(book.includes(x), x);
  assert.ok(book.indexOf('storybook-scenes.js') < book.indexOf('storybook-art.js'));
  assert.ok(book.indexOf('storybook-art.js') < book.indexOf('storybook-sound.js'));
  assert.ok(book.indexOf('storybook-sound.js') < book.indexOf('storybook.js'));
  assert.doesNotMatch(book, /intro\.js/);
  const film = run('?intro=1').text;
  assert.match(film, /intro\.js/); assert.doesNotMatch(film, /storybook/);
  const both = run('?book=1&intro=1').text;
  assert.match(both, /storybook\.js/); assert.match(both, /intro\.js/);
});
test('feature flags preserve book=0 and existing film override rules', () => {
  assert.doesNotMatch(run('?book=0', true).text, /storybook/);
  assert.match(run('', true).text, /storybook\.js/);
  assert.match(run('?intro=0', false, true).text, /intro\.js/);
});
test('private preview names are removed when film is off and never inserted into markup', () => {
  const r = run('?to=Example&book=1&preview=done');
  assert.equal(r.historyCalls.length, 1);
  assert.equal(r.historyCalls[0].url, '/?book=1&preview=done#card');
  assert.equal(r.historyCalls[0].state.sample, true);
  assert.doesNotMatch(r.text, /Example/);
  const film = run('?intro=1&to=Example');
  assert.equal(film.historyCalls.length, 0);
  assert.doesNotMatch(film.text, /Example/);
});
