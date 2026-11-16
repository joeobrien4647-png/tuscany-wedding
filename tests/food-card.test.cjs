const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const f = require('../js/first/food-core.js');
const { words } = require('../js/first/words.js');
const cards = require('../js/first/cards.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const js = read('js/first/food-card.js');

const NOV = Date.UTC(2026, 10, 10, 12);
const LATE = core.REPLIES_CLOSE_MS + 86400000;
const yes = coming => ({ reply: { answer: 'yes', coming, at: 1 } });
const TWO = ['Kit', 'Sam'];
const TWO_INVITE = { token: 'tFoodCardTwo02bb', display: 'Kit and Sam', people: TWO };
const EIGHT = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];
const given = names => f.cleanFood({ at: 1, people: names.map(name => ({ name, picks: { none: true } })) });
const EIGHT_YES_ONE_GIVEN = Object.assign(yes(EIGHT.map(() => true)), { food: given(['Ana']) });

test('foodCardLine: add, change, see and closed, counting only people coming', () => {
  const v = f.foodCardLine(yes([true, true]), TWO, NOV, words);
  assert.deepEqual(v, { line: words.food.lineNone, action: 'add', label: words.food.add, closed: null });
  const two = Object.assign(yes([true, true]), { food: given(['Kit', 'Sam']) });
  assert.equal(f.foodCardLine(two, TWO, NOV, words).line, 'Food needs given for 2 of 2');
  assert.equal(f.foodCardLine(two, TWO, NOV, words).action, 'change');
  assert.deepEqual(f.foodCardLine(two, TWO, LATE, words), { line: 'Food needs given for 2 of 2', action: 'see', label: words.food.see, closed: words.food.closed });
  assert.equal(f.foodCardLine(yes([true]), ['Alex'], LATE, words).action, null);
  assert.equal(f.foodCardLine(yes([true]), ['Alex'], LATE, words).closed, words.food.closed);
  assert.equal(f.foodCardLine(EIGHT_YES_ONE_GIVEN, EIGHT, NOV, words).line, 'Food needs given for 1 of 8');
  const partly = Object.assign(yes([true, false]), { food: given(['Kit', 'Sam']) });
  assert.equal(f.foodCardLine(partly, TWO, NOV, words).line, 'Food needs given for 1 of 1');
});
test('foodCardLine: a household that has not said yes gets nothing', () => {
  const nothing = { line: null, action: null, label: null, closed: null };
  assert.deepEqual(f.foodCardLine({ reply: { answer: 'no', coming: [false, false], at: 1 } }, TWO, NOV, words), nothing);
  assert.deepEqual(f.foodCardLine(null, TWO, NOV, words), nothing);
});
test('replyView carries the food line', () => {
  assert.deepEqual(cards.replyView(TWO_INVITE, yes([true, true]), NOV, words).food, f.foodCardLine(yes([true, true]), TWO, NOV, words));
});
test('food-card.js loads in Node and exports show', () => {
  assert.equal(typeof require('../js/first/food-card.js').show, 'function');
});
test('food-card.js: textContent only, picks are toggle buttons, the note is capped at 80', () => {
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|outerHTML|document\.write|console\./);
  assert.match(js, /aria-pressed/);
  assert.match(js, /maxLength = (food\.)?NOTE_MAX|maxlength', ?String\((food\.)?NOTE_MAX\)/);
  assert.match(js, /togglePick\(/);
});
test('food-card.js: Done checks the cut-off when pressed, saves once, and only changes the household after a true', () => {
  const done = js.slice(js.indexOf('function done'));
  assert.ok(done.indexOf('canSaveFood(') >= 0 && done.indexOf('canSaveFood(') < done.indexOf('saveFood('));
  assert.match(done, /if \(busy\)/);
  const then = done.slice(done.indexOf('saveFood('));
  assert.ok(then.indexOf('if (!ok)') < then.indexOf('ctx.household ='), 'household changes only after the ok check');
});
test('food-card.js: edit mode reads the household again before the first screen and keeps what it has on an unclear read', () => {
  assert.match(js, /store\.load\(/);
  assert.match(js, /=== undefined/);
});
test('food-card.js: the close control steps back to the card while the step is open', () => {
  assert.match(js, /card\.beforeClose\(/); assert.match(js, /card\.closeLabel\(/);
});
test('reply.js offers the food step only from the yes screen, through home.show({ open: "reply" })', () => {
  const r = read('js/first/reply.js');
  assert.match(r, /shouldOfferFood\(/);
  assert.match(r, /open: 'reply'/);
  const already = r.slice(r.indexOf("mode === 'already'"), r.indexOf("mode === 'closed'"));
  assert.doesNotMatch(already, /shouldOfferFood|open:/);
});
test('home.show opens the asked-for card only while home is still current', () => {
  assert.match(read('js/first/home.js'), /o\.open[\s\S]{0,300}live\(\)[\s\S]{0,200}cards\.open\(o\.open/);
});
test('food styles live inside #first under the Reply card, and the names list goes compact for big households', () => {
  const css = read('css/first.css');
  assert.match(css, /#first \.fc-reply \.ff-picks \{[^}]*display: grid/);
  assert.match(css, /#first \.fc-names\.fc-many \{/);
  assert.match(css, /#first \.fc-reply \.ff-note input \{[^}]*font-size: (1[6-9]|[2-9]\d)px/);
});
test('index.html loads food-card before cards', () => {
  assert.match(read('index.html'), /\["core", "food-core", "words", "store", "sound", "fx", "minute", "reply", "home", "travel-core", "travel-map", "travel-card", "weekend-card", "food-card", "cards", "app"\]/);
});
test('the smaller step heading hangs on a class the step sets, not on :has()', () => {
  const css = read('css/first.css');
  assert.doesNotMatch(css, /:has\(/);
  assert.match(css, /#first \.fc-reply \.fc-inner\.ff-open \{[^}]*gap: 10px/);
  assert.match(css, /#first \.fc-reply \.ff-open \.fc-t \{[^}]*font-size:/);
  assert.match(js, /classList\.add\('ff-open'\)/);
  assert.match(js, /classList\.remove\('ff-open'\)/);
});
test('home opens the asked-for card only when no other card is open', () => {
  const home = read('js/first/home.js');
  const block = home.slice(home.indexOf('if (o.open)'), home.indexOf('listen();', home.indexOf('if (o.open)')));
  assert.match(block, /openKey\(\)/);
});
