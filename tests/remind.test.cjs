const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const { words } = require('../js/first/words.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const home = () => require('../js/first/home.js');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const NOV = Date.UTC(2026, 10, 22, 12);

test('Remind me points at the dates file, or on Android at Google Calendar for the next envelope', () => {
  assert.equal(home().remindHref(NOV, IPHONE, words), 'tuscany-2027-dates.ics');
  assert.equal(home().remindHref(NOV, undefined, words), 'tuscany-2027-dates.ics');
  const g = new URL(home().remindHref(NOV, ANDROID, words));
  assert.equal(g.origin + g.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(g.searchParams.get('action'), 'TEMPLATE');
  assert.equal(g.searchParams.get('dates'), '20270201/20270202', 'the estate, all day on its UK date');
  assert.equal(g.searchParams.get('text'), core.fill(words.home.remindEvent, { name: words.home.envelopes.estate.name }));
  assert.ok(!/[?&]w=/.test(g.searchParams.get('details')), 'no personal link handed to Google');
  const april = new URL(home().remindHref(Date.UTC(2027, 1, 2), ANDROID, words));
  assert.equal(april.searchParams.get('dates'), '20270401/20270402', 'after the estate opens, the room is next (BST)');
  assert.equal(home().remindHref(Date.UTC(2027, 4, 2), IPHONE, words), null, 'no envelope left to open: no link');
  // With an envelope named: that envelope's own day, or nothing when it has no date or its date has passed.
  assert.ok(new URL(home().remindHref(NOV, ANDROID, words, 'menu')).searchParams.get('dates') === '20270501/20270502');
  assert.equal(home().remindHref(NOV, IPHONE, words, 'menu'), 'tuscany-2027-dates.ics');
  assert.equal(home().remindHref(NOV, ANDROID, words, 'photos'), null);
  assert.equal(home().remindHref(Date.UTC(2027, 1, 2, 9), ANDROID, words, 'estate'), null);
});

test('the dates file holds the weekend and each opening day, and no personal link', () => {
  const ics = read('tuscany-2027-dates.ics');
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics.trim(), /END:VCALENDAR$/);
  const events = ics.split('BEGIN:VEVENT').slice(1);
  const starts = events.map(e => (e.match(/DTSTART;VALUE=DATE:(\d{8})/) || [])[1]).sort();
  const opening = [...new Set(core.LOCKS.filter(l => l.opensMs !== null).map(l => new Date(l.opensMs).toISOString().slice(0, 10).replace(/-/g, '')))];
  assert.deepEqual(starts, [...opening, '20270528'].sort(), 'one event per opening day, plus the weekend');
  const uids = events.map(e => e.match(/UID:(\S+)/)[1]);
  assert.equal(new Set(uids).size, uids.length);
  assert.ok(uids.includes('wedding-weekend-2027@sophieandjoe2027.com'), 'the weekend keeps the old file\'s id');
  assert.ok(!/[?&]w=/.test(ics), 'no personal link in a public file');
  assert.ok(!/[—·]/.test(ics), 'no long dash or dot separator');
});

test('the home screen shows Remind me in the next-envelope line, and hides it with the line', () => {
  const js = read('js/first/home.js');
  assert.match(js, /el\('a', 'fh-remind', w\.home\.remind\)/);
  assert.match(js, /remind\.setAttribute\('aria-label', w\.home\.remindLabel\)/);
  assert.match(js, /next\.appendChild\(remind\)/);
  assert.match(js, /remind\.hidden = !href;/);
  for (const k of ['remind', 'remindLabel', 'remindEvent']) assert.equal(typeof words.home[k], 'string', k);
  const css = read('css/first.css');
  assert.match(css, /#first \.fh-remind \{[^}]*margin-left: auto/);
});
