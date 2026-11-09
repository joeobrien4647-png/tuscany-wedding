const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pending = new Set();

test('every page opts out of Android forced dark, so the gold, the names and the map labels keep their colours', () => {
  const pages = fs.readdirSync(root).filter(file => file.endsWith('.html') && !pending.has(file));
  assert.ok(pages.length > 40);
  for (const page of pages) {
    const html = read(page);
    const head = html.slice(0, html.search(/<\/head>/i));
    assert.match(head, /<meta name="color-scheme" content="only light">/, page);
  }
});
