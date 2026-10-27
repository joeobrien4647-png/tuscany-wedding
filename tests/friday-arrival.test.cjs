const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'getting-there.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/getting-there.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/getting-there.json'), 'utf8'));
const calcSource = js.slice(js.indexOf('  function calc() {'), js.indexOf('  function darkTips('));

function result(landing, day) {
  let verdict = '';
  const out = { innerHTML: '', querySelector: () => null, setAttribute: (_, value) => { verdict = value; } };
  const nodes = { 'gt-result': out, 'gt-land': { value: landing }, 'gt-day': { value: day }, 'gt-allow': { value: '45' } };
  const ctx = {
    DATA: data, CURRENT: 'PEG', BY: { PEG: { drive: { aboutMinutes: 30, rangeMinutes: [25, 120], label: 'about 30 min' } } },
    $: id => nodes[id], esc: s => String(s), strip: () => '', darkTips: () => '<p>Check the route before setting off</p>',
    weekDay: iso => data.friday.weekSun.days.find(d => d.date === iso),
    toMin: s => { const [h, m] = s.split(':').map(Number); return 60 * h + m; },
    round5: n => Math.round(n / 5) * 5,
    clock: n => `${String(Math.floor((n % 1440) / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`,
    dur: n => `${n} min`
  };
  vm.runInNewContext(calcSource + '\ncalc();', ctx);
  return { html: out.innerHTML, verdict };
}

test('the Friday arrival page and metadata avoid an unconfirmed meal or event time', () => {
  assert.doesNotMatch(html, /pizza|drinks as the sun goes down|light you(?:&rsquo;|’)re racing/i);
  assert.doesNotMatch(data.friday.plan, /pizza|drinks|sunset/i);
  assert.match(html, /Friday arrival/i);
});

test('arrival results stay neutral for Friday, Thursday and other-day journeys', () => {
  for (const [landing, day] of [['12:00','fri'],['19:20','fri'],['20:00','fri'],['22:00','fri'],['23:00','fri'],['09:00','thu'],['19:30','thu'],['20:00','other']]) {
    const r = result(landing, day);
    assert.ok(r.verdict, `${day} ${landing} has a result`);
    assert.doesNotMatch(r.html, /pizza|dawdle|car hire chat short|in time for|just in time/i, `${day} ${landing}`);
  }
});

test('the daylight section describes the solar figures as estimates with a hills caveat', () => {
  assert.match(data.friday.sun.note, /estimat/i);
  assert.match(data.friday.sun.note, /hills/i);
  assert.match(data.friday.sun.sunset, /^\d\d:\d\d$/);
});
