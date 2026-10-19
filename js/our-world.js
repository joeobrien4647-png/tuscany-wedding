(function (root) {
  'use strict';
  function createCards(element) {
    var cards = element ? Array.from(element.querySelectorAll('[data-world-card]')) : [];
    function reveal(card) {
      var template = card.querySelector('[data-card-template]');
      var art = card.querySelector('[data-card-art]');
      if (card.open && template && art && !art.hasChildNodes()) art.appendChild(template.content.cloneNode(true));
    }
    cards.forEach(function (card) { card.addEventListener('toggle', function () { reveal(card); }); reveal(card); });
    return { open: function (id) {
      var card = cards.find(function (item) { return item.id === id; });
      if (!card) return false;
      card.open = true;
      reveal(card);
      return true;
    } };
  }
  function createPlaces(element) {
    var links = element ? Array.from(element.querySelectorAll('[data-place-link]')) : [];
    var stories = element ? Array.from(element.querySelectorAll('[data-place-story]')) : [];
    function sync() {
      links.forEach(function (link) {
        var story = stories.find(function (item) { return '#' + item.id === link.getAttribute('href'); });
        if (story) { link.setAttribute('aria-controls', story.id); link.setAttribute('aria-expanded', String(story.open)); }
      });
    }
    function select(id, focus) {
      var story = stories.find(function (item) { return item.id === id; });
      if (!story) return false;
      stories.forEach(function (item) { item.open = item === story; });
      sync();
      if (focus) story.querySelector('summary').focus();
      return true;
    }
    links.forEach(function (link) { link.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
      if (select(link.getAttribute('href').slice(1), true)) event.preventDefault();
    }); });
    stories.forEach(function (story) { story.addEventListener('toggle', sync); });
    sync();
    return { select: select };
  }
  function createQuiz(element) {
    if (!element) return null;
    var questions = Array.from(element.querySelectorAll('[data-quiz-question]'));
    var choices = Array.from(element.querySelectorAll('[data-quiz-choice]'));
    var paper = element.querySelector('.world-quiz-paper');
    var names = ['progress', 'controls', 'feedback', 'next', 'result', 'score', 'restart'];
    var ui = {};
    names.forEach(function (name) { ui[name] = element.querySelector('[data-quiz-' + name + ']'); });
    if (!paper || !questions.length || choices.length !== 2 || names.some(function (name) { return !ui[name]; }) || questions.some(function (question) { return !question.querySelector('h3') || !question.querySelector('[data-quiz-explanation]') || ['Sophie', 'Joe'].indexOf(question.getAttribute('data-answer')) === -1; })) return null;
    var index = 0, score = 0, answered = false, finished = false;
    function show(focus) {
      questions.forEach(function (question, i) {
        question.hidden = i !== index;
        var explanation = question.querySelector('[data-quiz-explanation]');
        explanation.hidden = true;
        explanation.open = false;
      });
      choices.forEach(function (choice) { choice.disabled = false; choice.setAttribute('aria-pressed', 'false'); });
      ui.progress.textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
      ui.progress.hidden = false;
      ui.controls.hidden = false;
      ui.result.hidden = true;
      ui.feedback.textContent = '';
      ui.next.hidden = true;
      if (focus) questions[index].querySelector('h3').focus();
    }
    function answer(choice) {
      if (finished || answered || ['Sophie', 'Joe'].indexOf(choice) === -1) return false;
      answered = true;
      var correct = questions[index].getAttribute('data-answer');
      if (choice === correct) score++;
      choices.forEach(function (button) { button.disabled = true; button.setAttribute('aria-pressed', String(button.getAttribute('data-quiz-choice') === choice)); });
      var explanation = questions[index].querySelector('[data-quiz-explanation]');
      explanation.hidden = false;
      explanation.open = true;
      ui.feedback.textContent = choice === correct ? 'You got it — ' + correct + '.' : 'This one was ' + correct + '.';
      ui.next.textContent = index === questions.length - 1 ? 'See my score' : 'Next question';
      ui.next.hidden = false;
      ui.feedback.focus();
      return true;
    }
    function next() {
      if (!answered || finished) return false;
      if (index === questions.length - 1) {
        finished = true;
        questions[index].hidden = true;
        ui.controls.hidden = true;
        ui.progress.hidden = true;
        ui.result.hidden = false;
        ui.score.textContent = score + ' out of ' + questions.length;
        ui.score.focus();
      } else { index++; answered = false; show(true); }
      return true;
    }
    function reset() { index = 0; score = 0; answered = false; finished = false; show(true); }
    choices.forEach(function (choice) { choice.addEventListener('click', function () { answer(choice.getAttribute('data-quiz-choice')); }); });
    ui.next.addEventListener('click', next);
    ui.restart.addEventListener('click', reset);
    paper.setAttribute('data-enhanced', '');
    show(false);
    return { answer: answer, next: next, reset: reset, state: function () { return { index: index, score: score, answered: answered, finished: finished }; } };
  }
  var api = { createCards: createCards, createPlaces: createPlaces, createQuiz: createQuiz };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    var cards = createCards(root.document.querySelector('[data-world-cards]'));
    var places = createPlaces(root.document.querySelector('[data-world-places]'));
    createQuiz(root.document.querySelector('[data-world-quiz]'));
    function followHash() { var id = root.location.hash.slice(1); cards.open(id); places.select(id, false); }
    followHash();
    root.addEventListener('hashchange', followHash);
  }
})(typeof window !== 'undefined' ? window : globalThis);
