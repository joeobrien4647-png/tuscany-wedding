const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['getting-here.html', 'weekend-guide.html', 'arrival-essentials.html'];

test('public practical guides exist and load without an account or heavy runtime', () => {
  for (const page of pages) {
    assert.ok(fs.existsSync(path.join(root, page)), `${page} must exist`);
    const html = read(page);
    assert.match(html, /28–31 May 2027/);
    assert.match(html, /29 May 2027/);
    assert.match(html, /css\/guest-journey\.css/);
    assert.doesNotMatch(html, /firebase|webgl|<iframe|<video|reveal\.js|auth\.js/i);
    assert.match(html, /href="tuscany-2027\.ics"[^>]*download/);
    for (const link of ['index.html#card', 'getting-here.html', 'weekend-guide.html', 'index.html#help']) {
      assert.ok(html.includes(`href="${link}"`), `${page}: missing ${link}`);
    }
  }
});

test('dates and pending details remain consistent with approved source and calendar', () => {
  const data = JSON.parse(read('data/guest-weekend.json'));
  assert.equal(data.weekend.startDate, '2027-05-28');
  assert.equal(data.weekend.endDate, '2027-05-31');
  assert.equal(data.weekend.weddingDate, '2027-05-29');
  assert.equal(data.updated, '2026-10-19');
  assert.ok(data.pending.includes('final villa entrance'));
  assert.match(read('tuscany-2027.ics'), /DTSTART;VALUE=DATE:20270528/);
  assert.match(read('tuscany-2027.ics'), /DTEND;VALUE=DATE:20270601/);
  const programme = read('weekend-guide.html');
  for (const day of ['Friday 28', 'Saturday 29', 'Sunday 30', 'Monday 31']) assert.ok(programme.includes(day));
  assert.match(programme, /final programme[^<]*still to be confirmed/i);
  for (const page of pages) assert.doesNotMatch(read(page), /\b\d{1,2}:\d{2}\b|\b(?:a\.m\.|p\.m\.)/);
});

test('arrival caveats and named villa planning links do not promise an exact entrance', () => {
  for (const page of ['getting-here.html', 'arrival-essentials.html']) {
    const html = read(page);
    assert.match(html, /not a verified (?:villa )?(?:arrival )?entrance/);
    assert.match(html, /final (?:villa )?arrival instructions/i);
    assert.match(html, /Villa%20Santarsa%20La%20Conca%20Sansepolcro/);
    assert.match(html, /Villa%20Vallorsaia%20La%20Conca%20Sansepolcro/);
    assert.match(html, /check-in[^<]*check-out[^<]*still to be confirmed/i);
    assert.equal((html.match(/still to be confirmed/g) || []).length, 1);
    assert.match(html, /step-free routes[^<]*suitable bathrooms[^<]*need to be checked/i);
    assert.doesNotMatch(html, /maps[^"<>]*\d{2}\.\d/);
  }
});

test('new public routes keep unreleased legacy experiences out of navigation', () => {
  const excluded = ['itinerary.html', 'schedule.html', 'seating.html', 'binder.html', 'gallery.html', 'guests.html', 'accommodation.html', 'bingo.html', 'our-world.html', 'quiz.html'];
  for (const page of pages) {
    for (const excludedPage of excluded) assert.ok(!read(page).includes(`href="${excludedPage}`), `${page} reveals ${excludedPage}`);
  }
});

test('every local asset and link target exists and practical payload stays small', () => {
  for (const page of pages) {
    const html = read(page);
    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const link = match[1].split('#')[0].split('?')[0];
      if (/^(?:https?:|mailto:|tel:|data:)/.test(link)) continue;
      assert.ok(fs.existsSync(path.join(root, link)), `${page}: missing ${link}`);
    }
    assert.ok(Buffer.byteLength(html) < 22000);
  }
  assert.ok(fs.statSync(path.join(root, 'css/guest-journey.css')).size < 14000);
  assert.ok(fs.statSync(path.join(root, 'js/guest-journey.js')).size < 2500);
});

test('print action invokes browser print only after user clicks', () => {
  let printCalls = 0;
  const handlers = {};
  const button = { hidden: true, addEventListener: (event, handler) => { handlers[event] = handler; } };
  vm.runInNewContext(read('js/guest-journey.js'), { document: { querySelectorAll: () => [button] }, window: { print: () => { printCalls++; } } });
  assert.equal(printCalls, 0);
  assert.equal(button.hidden, false);
  handlers.click();
  assert.equal(printCalls, 1);
  assert.match(read('css/guest-journey.css'), /@media print/);
  assert.match(read('css/guest-journey.css'), /prefers-reduced-motion/);
  assert.match(read('css/guest-journey.css'), /:focus-visible/);
});
