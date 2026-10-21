const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const pages = ['villas.html', 'getting-there.html'];

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const file = dir + '/' + entry.name;
    return entry.isDirectory() ? walk(file) : [file];
  });
}

test('villa explorer and Plan the drive use the postcard chrome without the old reveal gate', () => {
  for (const file of pages) {
    const html = read(file);
    const nav = html.match(/<nav class="guest-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, file);
    assert.equal((nav.match(/<a /g) || []).length, 4, file);
    assert.ok(nav.includes('<a href="getting-here.html" aria-current="location">'), file);
    assert.match(html, /<body class="guest-page postcard-page feature-page /);
    assert.match(html, /<footer class="guest-footer">/);
    assert.ok(html.includes('href="css/postcard-features.css"'), file);
    assert.doesNotMatch(html, /reveal-gate-style|js\/reveal\.js|js\/main\.js|firebase|accommodation\.html|travel\.html|Cinzel/, file);
  }
});

test('every local file the ported pages and modules load exists', () => {
  for (const file of pages) {
    for (const [, ref] of read(file).matchAll(/(?:src|href|data-src(?:-small)?|poster)="([^"#?:]+\.(?:css|js|json|jpg|png|svg|mp4|html))"/g)) assert.ok(exists(ref), `${file}: ${ref}`);
  }
  for (const file of walk('js/villas').filter(name => name.endsWith('.js'))) {
    const source = read(file);
    for (const [, ref] of source.matchAll(/(?:from |import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) assert.ok(exists(path.posix.join(path.posix.dirname(file), ref)), `${file}: ${ref}`);
    for (const [, ref] of source.matchAll(/['"`]((?:data|images|video)\/[^'"`$]+\.(?:json|jpg|png|webp|mp4))['"`]/g)) assert.ok(exists(ref), `${file}: ${ref}`);
  }
  for (const [, ref] of read('js/getting-there.js').matchAll(/getJSON\("([^"]+)"\)/g)) assert.ok(exists(ref), ref);
});

test('ported guest words have no middle dots or em dashes', () => {
  const files = [...pages, 'css/villas.css', 'css/getting-there.css', 'js/getting-there.js', 'js/intro.js',
    ...walk('js/villas').filter(name => !name.startsWith('js/villas/vendor/'))];
  for (const file of files) assert.doesNotMatch(read(file), /·|&middot;|\\00b7|—|&mdash;/, file);
});

test('the welcome film stays switched off on the homepage', () => {
  const home = read('index.html');
  assert.match(home, /<body class="postcard-home">\n<script src="js\/intro\.js" data-enabled="false"><\/script>/);
  assert.equal((home.match(/js\/intro\.js/g) || []).length, 1);
});

test('Plan the drive pre-picks only the airports it offers', () => {
  const codes = JSON.parse(read('data/getting-there.json')).airports.map(airport => airport.code).sort();
  assert.ok(read('js/getting-there.js').includes('"index.html?into=" + code + "#card"'));
  const picker = read('index.html').match(/var intoPick = \(\/\^\(([A-Z|]+)\)\$\/\.exec\(entryParams\.get\("into"\)/);
  assert.ok(picker, 'index.html reads ?into=');
  assert.deepEqual(picker[1].split('|').sort(), codes);
});
