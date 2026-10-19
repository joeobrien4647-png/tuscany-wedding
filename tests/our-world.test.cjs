const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCards, createPlaces, createQuiz } = require('../js/our-world.js');
const html = fs.readFileSync(path.join(__dirname, '../our-world.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../js/our-world.js'), 'utf8');

class Element {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
    this.id = attributes.id || '';
    this.hidden = false;
    this.open = false;
    this.disabled = false;
    this.textContent = '';
    this.selectors = {};
    this.handlers = {};
    this.children = [];
    this.focusCount = 0;
  }
  querySelectorAll(selector) { return this.selectors[selector] || []; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.handlers[name] = callback; }
  appendChild(child) { this.children.push(child); }
  hasChildNodes() { return this.children.length > 0; }
  focus() { this.focusCount++; }
  set innerHTML(value) { throw new Error('Unsafe HTML rendering'); }
  fire(name, extras = {}) {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras };
    this.handlers[name]?.(event);
    return event;
  }
}

function cardsFixture() {
  const root = new Element();
  const cards = ['the-host', 'cat-detour'].map(id => {
    const card = new Element({ id });
    const art = new Element();
    let clones = 0;
    const template = { content: { cloneNode(deep) { assert.equal(deep, true); clones++; return { src: id + '-720.webp' }; } } };
    card.selectors = { '[data-card-template]': [template], '[data-card-art]': [art] };
    return { card, art, clones: () => clones };
  });
  root.selectors['[data-world-card]'] = cards.map(item => item.card);
  return { root, cards };
}

function placesFixture() {
  const root = new Element();
  const stories = ['nottingham', 'wimbledon', 'sevenoaks', 'tuscany'].map(place => {
    const story = new Element({ id: 'place-' + place });
    story.selectors.summary = [new Element()];
    return story;
  });
  const links = stories.map(story => new Element({ href: '#' + story.id }));
  root.selectors = { '[data-place-story]': stories, '[data-place-link]': links };
  return { root, stories, links };
}

function quizFixture() {
  const root = new Element();
  const questions = Array.from(html.matchAll(/<article data-quiz-question data-answer="(Sophie|Joe)"><h3 tabindex="-1">([^<]+)<\/h3><details data-quiz-explanation><summary>Reveal answer<\/summary><p>([^<]+)<\/p><\/details><\/article>/g), match => {
    const question = new Element({ 'data-answer': match[1] });
    const title = new Element(); title.textContent = match[2];
    const explanation = new Element(); explanation.textContent = match[3];
    question.selectors = { h3: [title], '[data-quiz-explanation]': [explanation] };
    return question;
  });
  const choices = ['Sophie', 'Joe'].map(name => new Element({ 'data-quiz-choice': name }));
  const ui = Object.fromEntries(['progress', 'controls', 'feedback', 'next', 'result', 'score', 'restart'].map(name => [name, new Element()]));
  root.selectors = { '[data-quiz-question]': questions, '[data-quiz-choice]': choices, '.world-quiz-paper': [new Element()] };
  for (const [name, node] of Object.entries(ui)) root.selectors['[data-quiz-' + name + ']'] = [node];
  return { root, questions, choices, ui };
}

test('full card artwork is instantiated only on opening and exactly once', () => {
  const h = cardsFixture();
  const api = createCards(h.root);
  assert.deepEqual(h.cards.map(item => item.clones()), [0, 0]);
  assert.equal(api.open('__proto__'), false);
  assert.equal(api.open('the-host'), true);
  assert.deepEqual(h.cards.map(item => item.clones()), [1, 0]);
  h.cards[0].card.fire('toggle');
  h.cards[0].card.open = false; h.cards[0].card.fire('toggle');
  api.open('the-host');
  assert.equal(h.cards[0].clones(), 1);
  h.cards[1].card.open = true; h.cards[1].card.fire('toggle');
  assert.equal(h.cards[1].clones(), 1);
});

test('restored open card loads once; missing card structures remain harmless', () => {
  const h = cardsFixture();
  h.cards[0].card.open = true;
  delete h.cards[1].card.selectors['[data-card-template]'];
  const api = createCards(h.root);
  assert.equal(h.cards[0].clones(), 1);
  assert.equal(api.open('cat-detour'), true);
  assert.equal(createCards(null).open('the-host'), false);
});

test('place links select one story, expose expanded state and focus its summary', () => {
  const h = placesFixture();
  const api = createPlaces(h.root);
  h.links.forEach((link, i) => {
    assert.equal(link.getAttribute('aria-controls'), h.stories[i].id);
    assert.equal(link.getAttribute('aria-expanded'), 'false');
  });
  assert.equal(h.links[2].fire('click').defaultPrevented, true);
  assert.deepEqual(h.stories.map(item => item.open), [false, false, true, false]);
  assert.equal(h.stories[2].querySelector('summary').focusCount, 1);
  assert.equal(h.links[2].getAttribute('aria-expanded'), 'true');
  api.select('place-tuscany', false);
  assert.equal(h.stories[3].querySelector('summary').focusCount, 0);
  assert.equal(h.links[2].getAttribute('aria-expanded'), 'false');
  assert.equal(h.links[3].getAttribute('aria-expanded'), 'true');
  assert.equal(api.select('<script>', true), false);
  assert.equal(h.stories[3].open, true);
});

test('native place disclosures synchronize map and modified clicks retain browser behavior', () => {
  const h = placesFixture(); createPlaces(h.root);
  h.stories[0].open = true; h.stories[0].fire('toggle');
  assert.equal(h.links[0].getAttribute('aria-expanded'), 'true');
  for (const extras of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    assert.equal(h.links[1].fire('click', extras).defaultPrevented, false);
    assert.equal(h.stories[1].open, false);
  }
  assert.equal(createPlaces(null).select('anything'), false);
});

test('quiz begins with one question, cannot skip or score invalid choices, and never advances automatically', () => {
  const h = quizFixture(); const api = createQuiz(h.root);
  assert.equal(h.questions.length, 5);
  assert.equal(h.ui.progress.textContent, 'Question 1 of 5');
  assert.deepEqual(h.questions.map(item => item.hidden), [false, true, true, true, true]);
  assert.equal(h.ui.next.hidden, true);
  assert.equal(api.next(), false);
  for (const choice of ['__proto__', '<img>', null, 'joe', '']) assert.equal(api.answer(choice), false);
  assert.deepEqual(api.state(), { index: 0, score: 0, answered: false, finished: false });
  h.choices[1].fire('click');
  assert.deepEqual(api.state(), { index: 0, score: 1, answered: true, finished: false });
  assert.equal(h.ui.next.hidden, false);
  assert.equal(h.ui.feedback.textContent, 'You got it — Joe.');
  assert.equal(h.ui.feedback.focusCount, 1);
  assert.equal(h.questions[0].querySelector('[data-quiz-explanation]').open, true);
  assert.ok(h.choices.every(choice => choice.disabled));
  assert.equal(h.choices[1].getAttribute('aria-pressed'), 'true');
  assert.equal(api.answer('Joe'), false);
  assert.equal(api.answer('Sophie'), false);
  assert.equal(api.state().score, 1);
  h.ui.next.fire('click');
  assert.equal(api.state().index, 1);
  assert.equal(h.questions[1].querySelector('h3').focusCount, 1);
  assert.ok(h.choices.every(choice => !choice.disabled));
});

test('every score from zero to five is correct; completion and restart fully reset quiz state', () => {
  for (let wanted = 0; wanted <= 5; wanted++) {
    const h = quizFixture(); const api = createQuiz(h.root);
    h.questions.forEach((question, index) => {
      const answer = question.getAttribute('data-answer');
      api.answer(index < wanted ? answer : answer === 'Sophie' ? 'Joe' : 'Sophie');
      if (index === 4) assert.equal(h.ui.next.textContent, 'See my score');
      api.next();
    });
    assert.equal(h.ui.score.textContent, wanted + ' out of 5');
    assert.equal(h.ui.score.focusCount, 1);
    assert.equal(h.ui.result.hidden, false);
    assert.equal(h.ui.controls.hidden, true);
    assert.equal(api.answer('Sophie'), false);
    assert.equal(api.next(), false);
    h.ui.restart.fire('click');
    assert.deepEqual(api.state(), { index: 0, score: 0, answered: false, finished: false });
    assert.equal(h.ui.result.hidden, true);
    assert.equal(h.ui.feedback.textContent, '');
    assert.equal(h.questions[0].querySelector('h3').focusCount, 1);
    assert.ok(h.questions.every(question => question.querySelector('[data-quiz-explanation]').hidden));
  }
});

test('incomplete quiz markup retains its readable static questions', () => {
  for (const selector of ['[data-quiz-next]', '.world-quiz-paper']) {
    const h = quizFixture(); delete h.root.selectors[selector];
    assert.equal(createQuiz(h.root), null);
    assert.ok(h.questions.every(question => !question.hidden));
    assert.ok(h.questions.every(question => !question.querySelector('[data-quiz-explanation]').hidden));
  }
  assert.equal(createQuiz(null), null);
});

test('browser entry handles known and unknown hashes with no network, storage or background work', () => {
  const cards = cardsFixture(), places = placesFixture(), quiz = quizFixture();
  const document = new Element();
  document.selectors = { '[data-world-cards]': [cards.root], '[data-world-places]': [places.root], '[data-world-quiz]': [quiz.root] };
  const handlers = {};
  const forbidden = () => { throw new Error('Network, storage or background work is forbidden'); };
  const window = { document, location: { hash: '#cat-detour' }, addEventListener(name, handler) { handlers[name] = handler; } };
  for (const name of ['localStorage', 'sessionStorage', 'firebase']) Object.defineProperty(window, name, { get: forbidden });
  vm.runInNewContext(source, { window, fetch: forbidden, XMLHttpRequest: forbidden, setTimeout: forbidden, setInterval: forbidden, requestAnimationFrame: forbidden });
  assert.equal(cards.cards[1].clones(), 1);
  window.location.hash = '#place-nottingham'; handlers.hashchange();
  assert.equal(places.stories[0].open, true);
  assert.equal(places.stories[0].querySelector('summary').focusCount, 0);
  window.location.hash = '#constructor'; handlers.hashchange();
  assert.equal(places.stories[0].open, true);
});

test('static page keeps two small previews, deferred large art and readable places and answers without JS', () => {
  const templates = Array.from(html.matchAll(/<template data-card-template>([\s\S]*?)<\/template>/g));
  assert.equal(templates.length, 2);
  const outsideTemplates = html.replace(/<template[\s\S]*?<\/template>/g, '');
  assert.equal((outsideTemplates.match(/<img /g) || []).length, 2);
  for (const image of outsideTemplates.matchAll(/<img[^>]+>/g)) {
    assert.match(image[0], /-240\.webp/); assert.match(image[0], /loading="lazy"/); assert.match(image[0], /width="240" height="335"/);
  }
  assert.equal((html.match(/<details[^>]*data-place-story/g) || []).length, 4);
  assert.equal((html.match(/<article data-quiz-question/g) || []).length, 5);
  assert.equal((html.match(/<details data-quiz-explanation>/g) || []).length, 5);
  assert.doesNotMatch(html, /<article data-quiz-question[^>]*hidden|<details[^>]*data-place-story[^>]*hidden/);
  assert.match(html, /suggested as the starting point for the invitations/);
  assert.match(html, /A story map, not to scale/);
  assert.doesNotMatch(html, /firebase|quiz\.html|<audio|<video|C:\\|PersonalArchive|letters-workbook|collection-manifest|leaderboard/i);
});
