const { test } = require('node:test');
const assert = require('node:assert/strict');
const f = require('../js/first/food-core.js');
const core = require('../js/first/core.js');
const TWO = ['Kit', 'Sam'];
const yes = coming => ({ reply: { answer: 'yes', coming, at: 1 } });
const saved = people => ({ at: 5, people });
test('PICKS: ten fixed keys, nothing for me last', () => {
  assert.equal(f.PICKS.length, 10); assert.equal(f.PICKS[9], 'none');
  for (const k of f.PICKS) assert.match(k, /^[a-z]+$/);
  assert.equal(f.NOTE_MAX, 80);
  assert.equal(f.MAX_PEOPLE, 8);
});
test('cleanFood: an object or an array of people, cleaned and sorted', () => {
  const wire = { at: 7, people: { 1: { name: 'Sam', picks: { vegan: true, nuts: true }, note: 'No coriander' }, 0: { name: 'Kit', picks: { none: true } } } };
  assert.deepEqual(f.cleanFood(wire), { at: 7, people: [
    { i: 0, name: 'Kit', picks: ['none'], note: '' }, { i: 1, name: 'Sam', picks: ['vegan', 'nuts'], note: 'No coriander' }] });
  assert.deepEqual(f.cleanFood({ at: 7, people: [null, { name: 'Sam', note: 'Soft food' }] }).people, [{ i: 1, name: 'Sam', picks: [], note: 'Soft food' }]);
  assert.deepEqual(f.cleanFood({ at: 7 }), { at: 7, people: [] });
});
test('cleanFood: bad shapes give null or drop the bad part', () => {
  for (const bad of [null, 'x', {}, { at: 'now' }, { at: 1, people: 'x' }, { at: 1, people: { 8: { name: 'A', picks: { vegan: true } } } }])
    assert.equal(f.cleanFood(bad), null, JSON.stringify(bad));
  const c = f.cleanFood({ at: 1, people: { 0: { name: 'Kit', picks: { vegan: true, steak: true }, note: 'x'.repeat(81) }, 1: { name: '', picks: { vegan: true } }, 2: { name: 'Jo' } } });
  assert.deepEqual(c.people, [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }]);
  assert.deepEqual(f.cleanFood({ at: 1, people: { 0: { name: 'Kit', picks: { none: true, vegan: true } } } }).people[0].picks, ['vegan']);
  assert.deepEqual(f.cleanFood({ at: 1, people: { 0: { name: 'x'.repeat(81), picks: { vegan: true } } } }).people, []);
});
test('foodScreens: only the people coming, in invitation order; a household of one shows no names', () => {
  assert.deepEqual(f.foodScreens(TWO, [false, true]), [{ i: 1, name: 'Sam' }]);
  assert.deepEqual(f.foodScreens(TWO, [true, true]).map(s => s.i), [0, 1]);
  assert.deepEqual(f.foodScreens(TWO, null), []);
  assert.equal(f.namesShown(['Alex']), false); assert.equal(f.namesShown(TWO), true);
});
test('togglePick: nothing for me switches the others off, any other pick switches it off', () => {
  assert.deepEqual(f.togglePick([], 'nuts'), ['nuts']);
  assert.deepEqual(f.togglePick(['nuts'], 'vegan'), ['vegan', 'nuts']);
  assert.deepEqual(f.togglePick(['vegan', 'nuts'], 'none'), ['none']);
  assert.deepEqual(f.togglePick(['none'], 'vegan'), ['vegan']);
  assert.deepEqual(f.togglePick(['vegan'], 'vegan'), []);
  const same = ['vegan']; assert.equal(f.togglePick(same, 'steak'), same);
});
test('startDraft: prefilled only where the saved name still matches the person at that place', () => {
  const food = f.cleanFood(saved({ 0: { name: 'Kit', picks: { vegan: true } }, 1: { name: 'Robin', picks: { nuts: true } } }));
  const d = f.startDraft(food, f.foodScreens(TWO, [true, true]));
  assert.deepEqual(d, [{ i: 0, name: 'Kit', picks: ['vegan'], note: '' }, { i: 1, name: 'Sam', picks: [], note: '' }]);
  assert.deepEqual(f.startDraft(null, [{ i: 0, name: 'Kit' }]), [{ i: 0, name: 'Kit', picks: [], note: '' }]);
  assert.equal(f.sameName(' kit ', 'Kit'), true);
  assert.equal(f.sameName('Kit', 'Sam'), false);
});
test('foodToSave: empty people are left out, notes trimmed and cut to 80, picks as fixed keys', () => {
  const wire = f.foodToSave([{ i: 0, name: 'Kit', picks: ['vegan', 'nuts'], note: '  No coriander ' }, { i: 1, name: 'Sam', picks: [], note: '   ' }, { i: 2, name: 'Jo', picks: [], note: 'y'.repeat(90) }]);
  assert.deepEqual(wire, { people: { 0: { name: 'Kit', picks: { vegan: true, nuts: true }, note: 'No coriander' }, 2: { name: 'Jo', note: 'y'.repeat(80) } } });
  assert.deepEqual(f.foodToSave([{ i: 0, name: 'Kit', picks: [], note: '' }]), {});
});
test('foodStatus: counts only people coming whose saved name still matches', () => {
  const h = Object.assign(yes([true, true]), { food: f.cleanFood(saved({ 0: { name: 'Kit', picks: { none: true } }, 1: { name: 'Sam', note: 'Soft food' } })) });
  assert.deepEqual([f.foodStatus(h, TWO).given, f.foodStatus(h, TWO).coming], [2, 2]);
  const fewer = Object.assign({}, h, { reply: { answer: 'yes', coming: [false, true], at: 2 } });
  assert.deepEqual(f.foodStatus(fewer, TWO).entries.map(e => e.i), [1]);
  assert.equal(f.foodStatus(fewer, TWO).coming, 1);
  assert.equal(f.foodStatus(h, ['Kit', 'Robin']).given, 1);                  // place 1 is someone else now
  assert.deepEqual(f.foodStatus(Object.assign({}, h, { reply: { answer: 'no', coming: [false, false], at: 3 } }), TWO), { coming: 0, given: 0, entries: [] });
});
test('canSaveFood and shouldOfferFood: a yes, before the cut-off, and the offer only while someone coming has not given', () => {
  const open = core.REPLIES_CLOSE_MS - 1, shut = core.REPLIES_CLOSE_MS;
  assert.equal(f.canSaveFood(yes([true]), open), true);
  assert.equal(f.canSaveFood(yes([true]), shut), false);
  assert.equal(f.canSaveFood({ reply: { answer: 'no', coming: [false], at: 1 } }, open), false);
  assert.equal(f.shouldOfferFood(yes([true, true]), TWO, open), true);
  const done = Object.assign(yes([true, true]), { food: f.cleanFood(saved({ 0: { name: 'Kit', picks: { none: true } }, 1: { name: 'Sam', picks: { vegan: true } } })) });
  assert.equal(f.shouldOfferFood(done, TWO, open), false);
  assert.equal(f.shouldOfferFood(yes([true, true]), TWO, shut), false);
});
