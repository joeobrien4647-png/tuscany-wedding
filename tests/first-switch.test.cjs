const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { shouldShowFirst } = require('../js/first/core.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('the switch', () => {
  assert.equal(shouldShowFirst({ search: '', enabled: false }), false);
  assert.equal(shouldShowFirst({ search: '?first=1', enabled: false }), true);
  assert.equal(shouldShowFirst({ search: '?first=0', enabled: true }), false);
  assert.equal(shouldShowFirst({ search: '', enabled: true }), true);
  assert.equal(shouldShowFirst({ search: '?first=1', enabled: true, signingIn: true }), false);
});

test('index.html ships with the switch off and loads nothing of the layer by default', () => {
  const html = read('index.html');
  assert.match(html, /id="optional-head"[^>]*data-first-enabled="false"/);
  const start = html.indexOf('<script id="optional-head"');
  const end = html.indexOf('</script>', start);
  let at = html.indexOf('js/first/');
  assert.ok(at > start, 'the layer is referenced');
  while (at !== -1) {
    assert.ok(at > start && at < end, 'js/first/ appears outside the optional-head script');
    at = html.indexOf('js/first/', at + 1);
  }
  assert.match(html, /<div id="first" hidden/);
});

test('when the layer is on, the book and the film do not load', () => {
  assert.match(read('index.html'), /if \(first\) \{[\s\S]*?return;/);
});
