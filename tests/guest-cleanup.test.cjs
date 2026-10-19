const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routes = JSON.parse(read('data/retired-routes.json'));

test('retired guest URLs lead to real pages and cannot run demo forms or old profile access', () => {
  assert.equal(Object.keys(routes).length, 36);
  for (const [file, target] of Object.entries(routes)) {
    const html = read(file);
    assert.match(html, /name="robots" content="noindex"/);
    assert.ok(html.includes(`content="0;url=${target}"`), file);
    assert.ok(html.includes(`href="${target}"`), `${file}: no accessible fallback`);
    assert.doesNotMatch(html, /<script|<form|<iframe|firebase|reveal\.js|YOUR_FORMSPREE_ID|PLAYLIST_ID|public\/profiles/i, file);
    const [destination, fragment] = target.split('#');
    const content = read(destination);
    assert.ok(!routes[destination], `${file}: redirect chain`);
    if (fragment) assert.ok(content.includes(`id="${fragment}"`), `${file}: missing anchor`);
  }
  assert.ok(!routes['dashboard.html'] && !routes['guest-inbox.html']);
});

test('guest navigation prioritises essentials and links to real help', () => {
  for (const file of ['index.html', 'getting-here.html', 'weekend-guide.html', 'arrival-essentials.html', 'our-story.html', 'join-in.html']) {
    const nav = read(file).match(/<nav class="guest-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, file);
    const home = file === 'index.html' ? '' : 'index.html';
    for (const href of [home + '#card', 'getting-here.html', 'weekend-guide.html', home + '#help']) assert.ok(nav.includes(`href="${href}"`), `${file}: ${href}`);
    assert.equal((nav.match(/<a /g) || []).length, 4, file);
  }
  const home = read('index.html');
  assert.doesNotMatch(home, /public\/profiles|public\/config|binder\.html|guest-card-preview\.js|setInterval\(tick/);
  assert.match(home, /id="help"/);
});

test('personal page preserves real photos and selected art without quiz or disclosure busywork', () => {
  const html = read('our-story.html');
  for (const image of ['proposal', 'walk', 'laugh', 'carry']) assert.ok(html.includes(`images/postcards/${image}-`));
  for (const art of ['the-host', 'cat-detour']) {
    assert.ok(html.includes(`href="images/our-world/${art}-720.webp"`));
    assert.ok(html.includes(`src="images/our-world/${art}-240.webp"`));
  }
  assert.doesNotMatch(html, /<details|data-quiz|data-place|our-world\.js|reveal\.js|firebase|<audio/);
  assert.doesNotMatch(read('join-in.html'), /Photos · later|uploads are not available|id="photos-heading"/i);
});
