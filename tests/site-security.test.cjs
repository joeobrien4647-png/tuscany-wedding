const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('every page asks search engines not to index it', () => {
  const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  assert.ok(pages.length > 10);
  for (const page of pages) assert.match(read(page), /<meta name="robots" content="[^"]*noindex/, page);
});

test('robots.txt exists and never blocks the pages, so crawlers can read their noindex', () => {
  const lines = read('robots.txt').split(/\r?\n/).map(line => line.trim());
  assert.ok(lines.includes('User-agent: *'));
  assert.ok(!lines.includes('Disallow: /'));
  assert.ok(lines.filter(line => line.startsWith('Disallow:')).every(line => /^Disallow: \/[a-z]+\/$/.test(line)));
});

test('the homepage Firebase config names the auth domain Google sign-in needs', () => {
  const config = read('index.html').match(/firebase\.initializeApp\(\{([\s\S]*?)\}\);/)[1];
  assert.match(config, /authDomain: "tuscany-wedding\.firebaseapp\.com"/);
});

test('every script loaded from another host is pinned to an exact version and hash-checked', () => {
  const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  let found = 0;
  for (const page of pages) {
    for (const tag of read(page).match(/<script\b[^>]*\bsrc="(?:https?:)?\/\/[^"]+"[^>]*>/g) || []) {
      found += 1;
      assert.match(tag, /src="https:\/\/[^"]*\d+\.\d+\.\d+\/[^"]+"/, `${page}: ${tag}`);
      assert.match(tag, /integrity="sha384-[A-Za-z0-9+/]{64}"/, `${page}: ${tag}`);
      assert.match(tag, /crossorigin="anonymous"/, `${page}: ${tag}`);
    }
  }
  assert.ok(found >= 6);
});
