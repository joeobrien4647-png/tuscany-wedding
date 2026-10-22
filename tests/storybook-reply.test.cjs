const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chooseReply, replyState, copyProblems } = require('../js/storybook.js');
const { SCENES } = require('../js/storybook-scenes.js');
const { createSound } = require('../js/storybook-sound.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function stubDoc() {
  const els = {};
  const doc = { activeElement: null, defaultView: { Event: class { constructor(type, options) { this.type = type; this.bubbles = !!(options && options.bubbles); } } } };
  const el = id => els[id] ||= { id, hidden: false, textContent: '', focus() { doc.activeElement = this; }, scrollIntoView() {} };
  const radios = ['yes', 'maybe', 'no'].map(value => ({ name: 'intent', value, checked: false, changes: 0, dispatchEvent(e) { if (e.type === 'change') this.changes++; return true; } }));
  doc.getElementById = el;
  doc.querySelector = q => { const m = /^input\[name="intent"\]\[value="(\w+)"\]$/.exec(q); return m ? radios.find(r => r.value === m[1]) || null : null; };
  return { doc, radios, el };
}

test('choosing Yes in the book picks the real Yes radio and opens the reply form', () => {
  const { doc, radios, el } = stubDoc();
  assert.equal(chooseReply(doc, 'yes'), true);
  const yes = radios[0];
  assert.equal(yes.checked, true);
  assert.equal(yes.changes, 1);
  assert.equal(radios[1].checked || radios[2].checked, false);
  assert.equal(el('storybook').hidden, true);
  assert.equal(doc.activeElement, el('card'));
  assert.equal(chooseReply(doc, 'perhaps'), false);
});

test('choosing in the book uses the book\'s own close when it has one', () => {
  const { doc, el } = stubDoc();
  let closed = 0;
  chooseReply(doc, 'no', () => { closed++; });
  assert.equal(closed, 1);
  assert.equal(el('storybook').hidden, false);
});

test('a saved reply is read back for returning guests', () => {
  const { doc, el } = stubDoc();
  el('loading').hidden = true;
  el('done').hidden = false; el('d-intent').textContent = 'Not sure yet';
  assert.deepEqual(replyState(doc), { saved: true, intent: 'maybe', pending: false });
  el('d-intent').textContent = 'Can’t make it';
  assert.deepEqual(replyState(doc), { saved: true, intent: 'no', pending: false });
  el('d-intent').textContent = 'Yes, coming';
  assert.deepEqual(replyState(doc), { saved: true, intent: 'yes', pending: false });
  el('done').hidden = true;
  assert.deepEqual(replyState(doc), { saved: false, intent: null, pending: false });
});

test('a returning guest never sees the three answers while the page is still checking their reply', () => {
  const { doc, el } = stubDoc();
  el('loading').hidden = false; el('done').hidden = true;
  assert.deepEqual(replyState(doc), { saved: false, intent: null, pending: true });
});

test('the inline reply script announces a saved reply', () => {
  assert.match(html, /new CustomEvent\('sj:reply-saved'/);
});

test('the Reply page shows the cost before anyone says yes', () => {
  const reply = SCENES.find(s => s.reply);
  assert.deepEqual(reply.notes, ['We kindly ask £150 each for your room', 'Once you’re here, nothing else to pay', 'No presents, please']);
  for (const note of reply.notes) assert.deepEqual(copyProblems(note), [], note);
});

test('the music comes back when the book is shown again after closing', () => {
  const made = [];
  class FakeAudio { constructor() { made.push(this); } play() { this.playing = true; return Promise.resolve(); } pause() { this.playing = false; } }
  const s = createSound({ Audio: FakeAudio, localStorage: { getItem: () => null, setItem() {} } });
  s.start(); s.stop();
  assert.equal(made[0].playing, false);
  s.start();
  assert.equal(made[0].playing, true);
});

test('the pocket holds the practical pages, and every one exists', () => {
  const pocket = SCENES.find(s => s.pocket);
  assert.deepEqual(pocket.links.map(l => l.label + ' -> ' + l.href), [
    'Travel & stay -> getting-here.html', 'Plan the drive -> getting-there.html', 'The villas -> villas.html',
    'Our wedding -> weekend-guide.html', 'Arrival essentials -> arrival-essentials.html', 'Need a hand? -> index.html#help'
  ]);
  for (const link of pocket.links) {
    assert.deepEqual(copyProblems(link.label), [], link.label);
    if (link.href === 'index.html#help') assert.match(html, /id="help"/);
    else assert.ok(fs.existsSync(path.join(__dirname, '..', link.href)), link.href);
  }
});

test('the menu offers Reply and Pocket on every page', () => {
  const { WORDS } = require('../js/storybook.js');
  assert.equal(WORDS.menu.reply, 'Reply'); assert.equal(WORDS.menu.pocket, 'Pocket');
  for (const id of ['reply', 'pocket']) assert.ok(SCENES.some(s => s.id === id), id);
});

// A window with the welcome film up or not, its listeners and timers driven by hand.
function filmWindow(up) {
  const listeners = {}, timers = new Map(), classes = new Set(up ? ['sj-intro-open'] : []);
  let id = 0;
  const win = {
    document: { documentElement: { classList: { contains: c => classes.has(c) } } },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    setTimeout(fn) { timers.set(++id, fn); return id; },
    clearTimeout(t) { timers.delete(t); }
  };
  return {
    win, timers,
    // as js/intro.js closes: the class goes first, then the event
    close(withEvent = true) { classes.delete('sj-intro-open'); if (withEvent) (listeners['sj:intro-done'] || []).slice().forEach(fn => fn({ type: 'sj:intro-done' })); },
    tick() { const due = [...timers.values()]; timers.clear(); due.forEach(fn => fn()); },
    listening: () => (listeners['sj:intro-done'] || []).length
  };
}

test('the welcome film says when it closes, for any reason', () => {
  const intro = fs.readFileSync(path.join(__dirname, '..', 'js', 'intro.js'), 'utf8');
  assert.match(intro, /new CustomEvent\(["']sj:intro-done["']/);
  const close = intro.slice(intro.indexOf('function close('), intro.indexOf('function giveUp('));
  assert.match(close, /dispatchEvent\(new CustomEvent\(["']sj:intro-done["']/);
});

test('with no film playing the book shows its cover straight away', () => {
  const { afterFilm } = require('../js/storybook.js');
  const f = filmWindow(false);
  let shown = 0;
  afterFilm(f.win, () => shown++);
  assert.equal(shown, 1);
  assert.equal(f.listening(), 0);
  assert.equal(f.timers.size, 0);
});

test('on a first visit the book waits for the film to close, then shows once', () => {
  const { afterFilm } = require('../js/storybook.js');
  const f = filmWindow(true);
  let shown = 0;
  afterFilm(f.win, () => shown++);
  for (let i = 0; i < 60; i++) f.tick();
  assert.equal(shown, 0);
  f.close();
  assert.equal(shown, 1);
  assert.equal(f.listening(), 0);
  assert.equal(f.timers.size, 0);
  f.tick();
  assert.equal(shown, 1);
});

test('the book never hangs if the film closes without saying so', () => {
  const { afterFilm } = require('../js/storybook.js');
  const f = filmWindow(true);
  let shown = 0;
  afterFilm(f.win, () => shown++);
  f.close(false);
  f.tick();
  assert.equal(shown, 1);
  assert.equal(f.listening(), 0);
  f.tick();
  assert.equal(shown, 1);
});

test('the cinema screen on the Reply page plays the film again', () => {
  const { WORDS } = require('../js/storybook.js');
  const intro = fs.readFileSync(path.join(__dirname, '..', 'js', 'intro.js'), 'utf8');
  const screen = SCENES.find(s => s.reply).pieces.find(p => p.art === 'screen');
  assert.equal(screen.act, 'film');
  assert.ok(WORDS.acts.film);
  assert.deepEqual(copyProblems(WORDS.acts.film), []);
  assert.match(intro, /window\.sjIntro = \{ play: /);
  // a film still fading out does not stop a new one, and play says whether one started
  const play = intro.slice(intro.indexOf('window.sjIntro = {'), intro.indexOf('};', intro.indexOf('window.sjIntro = {')));
  assert.match(play, /\.sj-intro:not\(\.sj-out\)/);
  assert.match(play, /return false;/);
  assert.match(play, /return true;/);
});
