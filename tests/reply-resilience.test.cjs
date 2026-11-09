const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

function page() {
  const elements = {};
  const element = id => elements[id] ||= { id, hidden: false, textContent: '' };
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) element(match[1]).hidden = /\bhidden\b/.test(match[0]);
  element('loading').textContent = 'One moment…';
  return { element, document: { getElementById: element } };
}

test('if the Firebase scripts never load, the reply card offers a reload instead of One moment forever', () => {
  const { element, document } = page();
  let reloaded = false;
  vm.runInNewContext(inline.at(-1), { document, window: {}, location: { reload() { reloaded = true; } } });
  assert.equal(element('loading').hidden, true);
  assert.equal(element('registration-recovery').hidden, false);
  element('registration-retry').onclick();
  assert.equal(reloaded, true);
});

test('after 20 s still loading, the waiting line says to check the signal, and stays quiet once the card is up', () => {
  const slow = inline.find(code => code.includes('sjSlowReply'));
  assert.ok(slow && html.indexOf(slow) < html.indexOf('firebase-app-compat.js'), 'the timer must start before the Firebase scripts');
  for (const loaded of [false, true]) {
    const { element, document } = page();
    let fire, delay;
    const window = {};
    vm.runInNewContext(slow, { document, window, setTimeout(fn, ms) { fire = fn; delay = ms; return 1; } });
    assert.equal(delay, 20000);
    element('loading').hidden = loaded;
    fire();
    assert.equal(/check your signal/.test(element('loading').textContent), !loaded);
  }
});
