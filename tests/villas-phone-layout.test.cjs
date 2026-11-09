const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// every @media block in a stylesheet, as [query, body] (rules nest one level inside)
const mediaBlocks = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@media ([^{]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)]
  .map(([, query, body]) => [query.trim(), body]);

// The browser sweep (elementFromPoint over every control from 600 to 900 px tall at 360 to 430 px wide) lives outside
// the repo, as the suite does not drive a browser; this holds the layout rule it checked.
test('phones of every height keep the side buttons in a row under the search, clear of the dock (V7)', () => {
  const rows = mediaBlocks(read('css/villas.css'))
    .filter(([query, body]) => /max-width/.test(query) && /\.vx-side\s*\{[^}]*flex-direction:\s*row/.test(body));
  assert.equal(rows.length, 1, 'one phone rule lays the side buttons in a row');
  assert.equal(rows[0][0], '(max-width: 639px)', 'it has no height condition, so tall phones get it too');
  assert.match(rows[0][1], /\.vx-gfx-menu\s*\{[^}]*top:\s*calc\(100% \+ 8px\)/, 'More opens downwards, under its button');
});
