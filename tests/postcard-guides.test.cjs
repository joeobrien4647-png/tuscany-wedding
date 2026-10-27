const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['getting-here.html', 'weekend-guide.html', 'arrival-essentials.html'];

test('programme exposes all four dates in order without tabs, hidden panels or scripts', () => {
  const html = read('weekend-guide.html');
  const data = JSON.parse(read('data/guest-weekend.json'));
  const list = html.match(/<ol class="weekend-days"[^>]*>([\s\S]*?)<\/ol>/)[1];
  const rows = Array.from(list.matchAll(/<li id="([^"]+)">([\s\S]*?)<\/li>/g));
  assert.deepEqual(rows.map(row => row[1]), ['friday', 'saturday', 'sunday', 'monday']);
  assert.deepEqual(rows.map(row => row[2].match(/datetime="([^"]+)"/)[1]), data.days.map(day => day.date));
  assert.match(rows[1][2], /Our wedding/);
  assert.match(rows[1][2], /ceremony and celebration at La Conca/);
  assert.doesNotMatch(list, /hidden|<details|role="tab|pending|to be confirmed/);
  assert.equal((html.match(/still to be confirmed/g) || []).length, 1);
  assert.doesNotMatch(html, /data-weekend|postcard-guides\.js|guides are now available|Last website update/);
});

test('all four airports and both onward options are available without a form or disclosure', () => {
  const html = read('getting-here.html');
  const list = html.match(/<dl class="airport-list">([\s\S]*?)<\/dl>/)[1];
  const rows = Array.from(list.matchAll(/<dt>(.*?)<\/dt><dd>([\s\S]*?)<\/dd>/g));
  assert.equal(rows.length, 4);
  for (const [index, [name, code, domain]] of [
    ['Perugia', 'PEG', 'www.airport.umbria.it'],
    ['Florence', 'FLR', 'www.aeroporto.firenze.it'],
    ['Bologna', 'BLQ', 'www.bologna-airport.it'],
    ['Pisa', 'PSA', 'www.pisa-airport.com']
  ].entries()) {
    assert.ok(rows[index][1].includes(name));
    assert.ok(rows[index][1].includes(code));
    assert.equal(new URL(rows[index][2].match(/href="([^"]+)"/)[1]).hostname, domain);
    assert.match(rows[index][2], /rel="noopener noreferrer"/);
  }
  assert.doesNotMatch(html, /<form|<select|<details|data-route-|Show my route/);
  for (const phrase of ['With a car', 'Without a car', 'trains to Arezzo', 'final taxi or lift', 'Trenitalia', 'Autolinee Toscane']) assert.ok(html.includes(phrase));
  assert.match(html, /Check current flights and operator timetables for your dates/);
});

test('the stay price and inclusions appear before flight planning and agree with the printable view', () => {
  const data = JSON.parse(read('data/guest-weekend.json'));
  assert.equal(data.stay.pricePerPersonGBP, 150);
  assert.equal(data.stay.nights, 3);
  assert.equal(data.stay.meals, 'Friday night to Monday morning');
  for (const page of ['getting-here.html', 'arrival-essentials.html']) {
    const html = read(page);
    assert.match(html, /£150 per person for three nights, Friday to Monday/);
    assert.match(html, /every meal from Friday night to Monday morning, every drink, and use of the pools and grounds/);
  }
  const travel = read('getting-here.html');
  assert.ok(travel.indexOf('id="stay-title"') < travel.indexOf('id="flights-title"'));
  assert.match(travel, /Payment details appear in <a href="index\.html#card">your saved reply<\/a> once you’ve said you’re coming/);
});

test('practical pages use bounded responsive photos and no additional runtime', () => {
  for (const page of pages) {
    const html = read(page);
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
    assert.ok(main, page);
    const images = Array.from(main[1].matchAll(/<img\b[^>]*>/g));
    assert.equal(images.length, { 'getting-here.html': 1, 'weekend-guide.html': 2, 'arrival-essentials.html': 0 }[page]);
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

test('venue photographs preserve essential actions, reserve space and stay within transfer budgets', () => {
  const html = read('weekend-guide.html');
  const section = html.match(/<section class="guest-section wedding-setting"[\s\S]*?<\/section>/)[0];
  assert.ok(html.indexOf('href="tuscany-2027.ics"') < html.indexOf(section));
  assert.ok(html.indexOf('still to be confirmed') < html.indexOf(section));
  const images = Array.from(section.matchAll(/<img\b[^>]*>/g), match => match[0]);
  const bytes = { 480: 0, 960: 0 };
  for (const tag of images) {
    assert.match(tag, /loading="lazy"/);
    assert.match(tag, /decoding="async"/);
    assert.match(tag, /alt="[^"]+"/);
    assert.match(tag, /sizes="\(max-width: 640px\)/);
    const [width, height] = tag.match(/width="(\d+)" height="(\d+)"/).slice(1).map(Number);
    const sources = [...tag.matchAll(/(images\/postcards\/[^\s",]+\.webp) (480|960)w/g)];
    assert.equal(sources.length, 2);
    for (const [, asset, breakpoint] of sources) {
      const buffer = fs.readFileSync(path.join(root, asset));
      assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
      bytes[breakpoint] += buffer.length;
    }
    assert.ok(width / height > 1.49 && width / height < 1.51);
  }
  assert.ok(bytes[480] < 60000, 'combined small photos must remain below 60 KB');
  assert.ok(bytes[960] < 200000, 'combined large photos must remain below 200 KB');
  assert.doesNotMatch(section, /<script|<iframe|<video|onclick=/);
});
