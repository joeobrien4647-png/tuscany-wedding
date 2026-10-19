const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('responsive postcard photos stay substantially below the original hero payload', () => {
  const bytes = name => fs.statSync(path.join(root, name)).size;
  assert.ok(bytes('images/postcards/hero-drone-480.webp') < 40000);
  assert.ok(bytes('images/postcards/hero-drone-960.webp') < 150000);
  assert.ok(bytes('images/postcards/hero-drone-1440.webp') < bytes('images/venue/hero-drone.jpg') / 2);
  for (const name of fs.readdirSync(path.join(root, 'images/postcards'))) {
    if (name.endsWith('-480.webp')) assert.ok(bytes('images/postcards/' + name) < 45000, name);
  }
});

test('guest presentation has a small aggregate script budget without a new rendering runtime', () => {
  const names = ['js/guest-navigation.js', 'js/guest-card-preview.js', 'js/postcard-guides.js', 'js/guest-welcome.js', 'js/our-world.js'];
  let total = 0;
  for (const name of names) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    total += Buffer.byteLength(source);
    assert.doesNotMatch(source, /requestAnimationFrame|setInterval|WebGL|IntersectionObserver|firebase\./, name);
  }
  assert.ok(total < 18000, `added interaction scripts total ${total} bytes`);
});

test('personal card art stays isolated from the homepage and within delivery budgets', () => {
  for (const page of ['index.html', 'our-story.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, page), 'utf8'), /images\/our-world|js\/our-world/);
  }
  for (const name of fs.readdirSync(path.join(root, 'images/our-world'))) {
    assert.ok(name.endsWith('.webp'), name);
    const cap = name.endsWith('-240.webp') ? 22000 : 120000;
    assert.ok(fs.statSync(path.join(root, 'images/our-world', name)).size < cap, name);
  }
});
