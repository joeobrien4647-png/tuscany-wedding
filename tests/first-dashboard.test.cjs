const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { householdRows, householdTotals } = require('../js/first/core.js');

const dashboard = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

const welcome = {
  tokB: { display: 'the Aldens', lines: ['x'], people: ['Ana', 'Ben'] },
  tokA: { display: 'Zed Ward', lines: ['x'], people: ['Zed'] },
  tokC: { display: 'bea Hollis', lines: ['x'] },
};
const seen = { tokB: { last: { at: 1000, key: 'k'.repeat(20) } }, tokOrphan: { last: { at: 5, key: 'k'.repeat(20) } } };
const household = {
  tokB: { reply: { answer: 'yes', coming: [true, false], at: 2000 }, stay: { choice: 'villa', at: 3000 } },
  tokOrphan: { reply: { answer: 'no', coming: [false], at: 1 } },
};

test('householdRows: unreplied first, then by display, case-insensitive', () => {
  const rows = householdRows(welcome, seen, household);
  assert.deepEqual(rows.map(r => r.token), ['tokC', 'tokA', 'tokB']);
  assert.deepEqual(rows[2], { token: 'tokB', display: 'the Aldens', people: ['Ana', 'Ben'], openedAt: 1000, answer: 'yes', coming: [true, false], stay: 'villa' });
});

test('householdRows: a never-opened household has nulls, people falls back to []', () => {
  const row = householdRows(welcome, seen, household).find(r => r.token === 'tokC');
  assert.deepEqual(row, { token: 'tokC', display: 'bea Hollis', people: [], openedAt: null, answer: null, coming: null, stay: null });
});

test('householdRows: tokens missing from welcome are left out', () => {
  assert.ok(!householdRows(welcome, seen, household).some(r => r.token === 'tokOrphan'));
});

test('householdRows: missing or malformed inputs give []', () => {
  assert.deepEqual(householdRows(null, seen, household), []);
  assert.deepEqual(householdRows(undefined, undefined, undefined), []);
  assert.deepEqual(householdRows('x', 1, []), []);
  assert.deepEqual(householdRows([], {}, {}), []);
  const rows = householdRows({ t1: { display: 'One', lines: [] }, t2: null, t3: 'junk' }, 'bad', 7);
  assert.deepEqual(rows.map(r => r.token), ['t1']);
  assert.equal(rows[0].openedAt, null);
});

test('householdRows: ignores unknown answers and stay choices', () => {
  const rows = householdRows({ t1: { display: 'One', lines: [] } }, {}, { t1: { reply: { answer: 'maybe', coming: [true], at: 1 }, stay: { choice: 'moon', at: 1 } } });
  assert.equal(rows[0].answer, null);
  assert.equal(rows[0].stay, null);
});

test('householdRows: a reply with no usable coming list gives coming null', () => {
  const rows = householdRows({ t1: { display: 'One', lines: [] } }, {}, { t1: { reply: { answer: 'yes', at: 1 } } });
  assert.equal(rows[0].answer, 'yes');
  assert.equal(rows[0].coming, null);
});

test('householdTotals counts each bucket', () => {
  const rows = householdRows({
    a: { display: 'A', lines: [] }, b: { display: 'B', lines: [] }, c: { display: 'C', lines: [] }, d: { display: 'D', lines: [] },
  }, { a: { last: { at: 1, key: 'k' } }, b: { last: { at: 1, key: 'k' } } }, {
    a: { reply: { answer: 'yes', coming: [true], at: 1 }, stay: { choice: 'villa', at: 1 } },
    b: { reply: { answer: 'yes', coming: [true], at: 1 }, stay: { choice: 'later', at: 1 } },
    c: { reply: { answer: 'no', coming: [false], at: 1 } },
  });
  assert.deepEqual(householdTotals(rows), { households: 4, opened: 2, yes: 2, cantCome: 1, noReply: 1, villa: 1, own: 0, notChosen: 1 });
  assert.deepEqual(householdTotals(null), { households: 0, opened: 0, yes: 0, cantCome: 0, noReply: 0, villa: 0, own: 0, notChosen: 0 });
});

test('dashboard.html loads the first core and keeps the invitation data out of localStorage', () => {
  assert.match(dashboard, /<script src="js\/first\/core\.js"><\/script>/);
  const keys = dashboard.match(/const NO_CACHE_KEYS = \[([^\]]*)\]/)[1];
  for (const k of ['"welcome"', '"welcomeSeen"', '"household"']) assert.ok(keys.includes(k), k);
  assert.match(dashboard, /useStorage\("household"[^\n]*noCache: true/);
  assert.match(dashboard, /useStorage\("welcome"[^\n]*noCache: true/);
  assert.match(dashboard, /useStorage\("welcomeSeen"[^\n]*noCache: true/);
  const writes = dashboard.match(/localStorage\.setItem\([^)]*\)/g) || [];
  assert.ok(!writes.some(w => /token|tok\b|household|welcome/i.test(w)), writes.join('\n'));
});

test('dashboard admin controls write one leaf only', () => {
  assert.match(dashboard, /db\.ref\("household\/" \+ [\w.]+ \+ "\/reply"\)/);
  assert.match(dashboard, /db\.ref\("household\/" \+ [\w.]+ \+ "\/stay"\)/);
  assert.match(dashboard, /\{ "\.sv": "timestamp" \}/);
  assert.ok(!/db\.ref\("household"\)\.(set|update)/.test(dashboard));
  assert.match(dashboard, /const \[household, , b\d+\] = useStorage\("household"/);
});
