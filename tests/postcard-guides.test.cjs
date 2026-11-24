const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['arrival-essentials.html'];

test('the stay price and inclusions on the arrival sheet agree with the data', () => {
  const data = JSON.parse(read('data/guest-weekend.json'));
  assert.equal(data.stay.pricePerPersonGBP, 150);
  assert.equal(data.stay.nights, 3);
  assert.equal(data.stay.meals, 'Friday night to Monday morning');
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /£150 per person for three nights, Friday to Monday/);
    assert.match(html, /every meal from Friday night to Monday morning, every drink, and use of the pools and grounds/);
  }
});

test('practical pages use bounded responsive photos and no additional runtime', () => {
  for (const page of pages) {
    const html = read(page);
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
    assert.ok(main, page);
    const images = Array.from(main[1].matchAll(/<img\b[^>]*>/g));
    assert.equal(images.length, { 'arrival-essentials.html': 0 }[page]);
    for (const [tag] of images) {
      assert.match(tag, /width="\d+" height="\d+"/);
      assert.match(tag, /srcset=/);
      assert.match(tag, /decoding="async"/);
      for (const [, asset] of tag.matchAll(/(images\/postcards\/[^\s",]+\.webp)/g)) assert.ok(fs.existsSync(path.join(root, asset)));
    }
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g), match => match[1]);
    assert.deepEqual(scripts, page === 'arrival-essentials.html' ? ['js/guest-navigation.js', 'js/guest-journey.js'] : ['js/guest-navigation.js']);
  }
  assert.equal(fs.existsSync(path.join(root, 'js/postcard-guides.js')), false);
  const css = read('css/postcard-guides.css');
  assert.ok(Buffer.byteLength(css) < 5000);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /animation|transition|weekend-tabs|route-planner/);
});
