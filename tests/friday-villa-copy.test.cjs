const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Friday labels and captions avoid an unconfirmed meal or event time', () => {
  const words = read('js/villas/content/words.js');
  const friday = words.split('\n').find(line => line.includes("moment('fri-pizza'"));
  const sunsetText = words.split('\n').find(line => line.includes('Both villas look west over the Tiber valley'));
  const stage = read('js/villas/content/weekend.js');
  const friLine = stage.split('\n').find(line => line.includes("fri: { it:"));
  const intro = stage.split('\n').find(line => line.includes('intro: { when:'));
  const day = read('js/villas/experience/weekend.js').split('\n').find(line => line.includes("['fri', 'Friday'"));
  const story = read('js/storybook-scenes.js').split('\n').find(line => line.includes("id: 'friday'"));
  for (const [label, line] of Object.entries({ friday, sunsetText, friLine, intro, day, story })) {
    assert.ok(line, label);
    assert.doesNotMatch(line.replaceAll('fri-pizza', ''), /pizza|drinks|as the sun goes down/i, label);
  }
});

test('Friday illustrative view does not offer an implied cooking plan', () => {
  const stage = read('js/villas/content/weekend.js');
  const part = stage.split("    'fri-pizza': {")[1]?.split("    'sat-ceremony': {")[0];
  assert.ok(part, 'stable Friday moment remains available');
  assert.match(part, /options:\s*ovens/);
  assert.match(part, /fire:santarsa/);
  assert.match(part, /fire:vallorsaia/);
  assert.match(part, /illustrative, not a plan for Friday/i);
  assert.doesNotMatch(part, /which one gets lit/i);
  assert.match(stage, /header: 'Illustrative oven views'/);
  assert.match(stage, /note: 'For exploring only, not a plan for Friday'/);
  assert.match(stage, /IDEA_PROPS = new Set\(\[[^\]]*'fire:santarsa'[^\]]*'fire:vallorsaia'/);
});

test('Friday arrival and check-in timing is not implied', () => {
  const words = read('js/villas/content/words.js');
  const stage = read('js/villas/content/weekend.js');
  for (const id of ['fri-arrive', 'fri-settle']) {
    const line = words.split('\n').find(item => item.includes("moment('" + id + "'"));
    assert.ok(line, id);
    assert.doesNotMatch(line, /whenever you land/i);
    assert.match(line, /arrival details will follow/i);
  }
  const arrival = stage.split("    'fri-arrive': {")[1]?.split("    'fri-settle': {")[0];
  assert.ok(arrival);
  assert.doesNotMatch(arrival, /whenever you land/i);
  assert.match(arrival, /arrival details/i);
});
