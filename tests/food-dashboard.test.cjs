// What Joe and Sophie see: food needs per person and one caterer list. Invented names and tokens only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const food = require('../js/first/food-core.js');
const { adminSteps } = require('../js/first/core.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const WELCOME = {
  tokKitSam: { display: 'Kit & Sam', lines: ['x'], people: ['Kit', 'Sam'] },
  tokAlex: { display: 'Alex', lines: ['x'], people: ['Alex'] },
  tokRobin: { display: 'Robin Ash', lines: ['x'], people: ['Robin Ash'] },
  tokJoKit: { display: 'Jo & Kit', lines: ['x'], people: ['Jo', 'Kit'] }
};
const WELCOME_RENAMED = Object.assign({}, WELCOME, { tokKitSam: { display: 'Kit & Robin', lines: ['x'], people: ['Kit', 'Robin'] } });
const yes = coming => ({ answer: 'yes', coming, at: 1 });
const HOUSEHOLD = {
  tokKitSam: { reply: yes([true, true]), food: { at: 5, people: {
    0: { name: 'Kit', picks: { vegan: true } },
    1: { name: 'Sam', picks: { nuts: true }, note: 'No coriander' } } } },
  tokAlex: { reply: yes([true]), food: { at: 6, people: { 0: { name: 'Alex', picks: { none: true } } } } },
  tokRobin: {},
  tokJoKit: { reply: yes([true, true]) }
};
const withReply = (token, reply) => Object.assign({}, HOUSEHOLD, { [token]: Object.assign({}, HOUSEHOLD[token], { reply }) });

test('foodRows: yes households only, people coming only, answered by place and name', () => {
  const rows = food.foodRows(WELCOME, HOUSEHOLD);
  assert.deepEqual(rows.map(r => r.token), ['tokAlex', 'tokJoKit', 'tokKitSam']);
  assert.deepEqual(rows.map(r => r.display), ['Alex', 'Jo & Kit', 'Kit & Sam']);
  const ks = rows.find(r => r.token === 'tokKitSam');
  assert.deepEqual(ks.people, [
    { i: 0, name: 'Kit', picks: ['vegan'], note: '', answered: true, savedAs: null },
    { i: 1, name: 'Sam', picks: ['nuts'], note: 'No coriander', answered: true, savedAs: null }]);
  const jo = rows.find(r => r.token === 'tokJoKit');
  assert.deepEqual(jo.people.map(p => [p.name, p.answered, p.savedAs]), [['Jo', false, null], ['Kit', false, null]]);
  const partly = food.foodRows(WELCOME, withReply('tokKitSam', yes([false, true])));
  assert.deepEqual(partly.find(r => r.token === 'tokKitSam').people.map(p => [p.i, p.name]), [[1, 'Sam']]);
  const wire = food.foodRows(WELCOME, { tokKitSam: { reply: yes([true, true]), food: { at: 5, people: [{ name: 'Kit', picks: { vegan: true } }, null] } } });
  assert.deepEqual(wire[0].people.map(p => [p.name, p.answered]), [['Kit', true], ['Sam', false]]);
});
test('foodRows: a saved name that no longer matches is not shown as theirs and says who it was saved for', () => {
  const r = food.foodRows(WELCOME_RENAMED, HOUSEHOLD);   // place 1 was Sam, is now Robin
  const ks = r.find(x => x.token === 'tokKitSam');
  assert.deepEqual(ks.people[0], { i: 0, name: 'Kit', picks: ['vegan'], note: '', answered: true, savedAs: null });
  assert.deepEqual(r[0].people[0].name, 'Alex');
  assert.deepEqual(ks.people[1], { i: 1, name: 'Robin', picks: [], note: '', answered: false, savedAs: 'Sam' });
  const spaced = { tokKitSam: { reply: yes([true, true]), food: { at: 1, people: { 0: { name: ' KIT ', picks: { vegan: true } } } } } };
  assert.equal(food.foodRows(WELCOME, spaced)[0].people[0].answered, true, 'names match without case or spaces');
});
test('foodRows: food for someone no longer coming, or a household that said no, is ignored', () => {
  const rows = food.foodRows(WELCOME, withReply('tokKitSam', yes([true, false])));
  assert.deepEqual(rows.find(r => r.token === 'tokKitSam').people.map(p => p.name), ['Kit']);
  assert.equal(food.catererList(rows).needs.some(n => n.name === 'Sam'), false);
  const no = withReply('tokKitSam', { answer: 'no', coming: [false, false], at: 1 });
  assert.equal(food.foodRows(WELCOME, no).some(r => r.token === 'tokKitSam'), false);
  const orphan = Object.assign({}, HOUSEHOLD, { tokNobody: { reply: yes([true]), food: HOUSEHOLD.tokAlex.food } });
  assert.equal(food.foodRows(WELCOME, orphan).some(r => r.token === 'tokNobody'), false);
  assert.equal(food.foodRows(WELCOME, { tokRobin: { reply: { answer: 'maybe', coming: [true], at: 1 } } }).length, 0);
});
test('foodRows: missing or malformed inputs give []', () => {
  for (const bad of [undefined, null, 'x', 7, [], true]) {
    assert.deepEqual(food.foodRows(bad, HOUSEHOLD), []);
    assert.deepEqual(food.foodRows(WELCOME, bad), []);
  }
  const junkWelcome = { tokA: 'junk', tokB: null, tokC: { display: 'X', lines: ['x'] } };
  const everyoneYes = { tokA: { reply: yes([true]) }, tokB: { reply: yes([true]) }, tokC: { reply: yes([true]) } };
  assert.deepEqual(food.foodRows(junkWelcome, everyoneYes).map(r => r.people), [[]], 'a household with no people has no one to ask');
  const junkFood = food.foodRows(WELCOME, { tokAlex: { reply: yes([true]), food: 'junk' } });
  assert.deepEqual(junkFood[0].people, [{ i: 0, name: 'Alex', picks: [], note: '', answered: false, savedAs: null }]);
  assert.deepEqual(food.catererList(undefined), { needs: [], counts: [], coming: 0, notAnswered: 0, mismatched: 0 });
  assert.equal(food.catererText(undefined), 'Food needs\n0 of 0 coming have not answered yet');
  assert.equal(food.pickLabels(undefined), '');
});
test('catererList: needs by name, a count per pick, not answered and mismatched', () => {
  const l = food.catererList(food.foodRows(WELCOME, HOUSEHOLD));
  assert.deepEqual(l.needs.map(n => n.name), ['Kit', 'Sam']);   // Alex said nothing for me: answered, no need
  assert.deepEqual(l.counts, [{ key: 'vegan', label: 'Vegan', n: 1 }, { key: 'nuts', label: 'Nut allergy', n: 1 }, { key: 'none', label: 'Nothing needed', n: 1 }]);
  assert.equal(l.coming, 5); assert.equal(l.notAnswered, 2); assert.equal(l.mismatched, 0);
  assert.deepEqual(l.needs[1], { name: 'Sam', display: 'Kit & Sam', picks: ['nuts'], note: 'No coriander' });
});
const NOTE_ONLY = { tokAlex: { reply: yes([true]), food: { at: 1, people: { 0: { name: 'Alex', note: 'Hates olives' } } } }, tokKitSam: HOUSEHOLD.tokKitSam };
test('catererList: a note on its own is a need, a mismatch counts as not answered', () => {
  const l = food.catererList(food.foodRows(WELCOME_RENAMED, NOTE_ONLY));
  assert.deepEqual(l.needs.map(n => [n.name, n.picks, n.note]), [['Alex', [], 'Hates olives'], ['Kit', ['vegan'], '']]);
  assert.deepEqual(l.counts, [{ key: 'vegan', label: 'Vegan', n: 1 }]);
  assert.equal(l.coming, 3); assert.equal(l.notAnswered, 1); assert.equal(l.mismatched, 1);
});
test('catererText: the exact plain text', () => {
  assert.equal(food.catererText(food.catererList(food.foodRows(WELCOME, HOUSEHOLD))), [
    'Food needs',
    'Kit (Kit & Sam): Vegan',
    'Sam (Kit & Sam): Nut allergy. Note: No coriander',
    'Totals: Vegan 1, Nut allergy 1, Nothing needed 1',
    '2 of 5 coming have not answered yet'
  ].join('\n'));
});
test('catererText: same name as the household drops the brackets, a note alone, a mismatch line', () => {
  assert.equal(food.catererText(food.catererList(food.foodRows(WELCOME_RENAMED, NOTE_ONLY))), [
    'Food needs',
    'Alex: Note: Hates olives',
    'Kit (Kit & Robin): Vegan',
    'Totals: Vegan 1',
    '1 of 3 coming have not answered yet',
    '1 saved for a name that has since changed: check the dashboard'
  ].join('\n'));
});
test('pickLabels joins the labels in the order given', () => {
  assert.equal(food.pickLabels(['vegan', 'nuts']), 'Vegan, Nut allergy');
  assert.equal(food.pickLabels([]), '');
});
test('PICK_LABELS covers exactly PICKS', () => assert.deepEqual(Object.keys(food.PICK_LABELS), food.PICKS));
test('dashboard.html loads food-core after the travel rules and builds the list from it', () => {
  const html = read('dashboard.html');
  assert.match(html, /<script src="js\/first\/travel-core\.js"><\/script>\s*<script src="js\/first\/food-core\.js"><\/script>/);
  assert.match(html, /sjFirst\.food\.foodRows\(welcome, household\)/);
  assert.match(html, /navigator\.clipboard && navigator\.clipboard\.writeText\(sjFirst\.food\.catererText\(/);
  assert.match(html, /data-food-list/);
  assert.match(html, /Read only\. A guest who answers by message: open their own link and add it there\./);
  assert.match(html, /Saved for \{p\.savedAs\}, check with them/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});
test('the dashboard never sets food: it only removes it, where it already removes stay', () => {
  // every household removal of stay (no, clear) also removes food, in the same action, before the reply changes
  for (const action of ['no', 'clear']) {
    const steps = adminSteps(action, { peopleCount: 2 });
    assert.deepEqual(steps.map(s => s.path).slice(0, 3), ['stay', 'food', 'reply'], action);
    assert.equal(steps[1].value, null, action + ': a delete only');
  }
  // no action writes a value to food, and the panel writes only what adminSteps plans
  for (const action of ['yes', 'no', 'clear', 'stay', 'toggle']) {
    const steps = adminSteps(action, { peopleCount: 2, choice: 'villa', coming: [true, true], index: 0 });
    steps.filter(s => s.path === 'food').forEach(s => assert.equal(s.value, null, action));
  }
  const html = read('dashboard.html');
  const panel = html.slice(html.indexOf('function InvitationsPanel'), html.indexOf('function SiteTab'));
  assert.ok(panel.includes('sjFirst.adminSteps('), 'the panel writes through adminSteps');
  assert.ok(!/["'`]food["'`]/.test(panel), 'no path named food is written by hand');
  assert.ok(!/household\/["'`]?[^\n]*food/.test(panel), 'no database path to food in the panel');
  assert.match(read('js/first/core.js'), /\{ path: 'stay', value: null \}, \{ path: 'food', value: null \}, \{ path: 'reply'/);
});
