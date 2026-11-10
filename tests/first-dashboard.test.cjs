const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { householdRows, householdTotals, adminReply, adminToggleComing, adminStay, adminSteps, adminFailureMessage } = require('../js/first/core.js');

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

test('dashboard writes go through the pure step plan, one leaf at a time', () => {
  assert.match(dashboard, /sjFirst\.adminSteps\(/);
  assert.match(dashboard, /db\.ref\("household\/" \+ r\.token \+ "\/" \+ st\.path\)/);
  assert.ok(!/db\.ref\("household"\)\.(set|update)/.test(dashboard));
  assert.match(dashboard, /const \[household, , b\d+, householdFailed\] = useStorage\("household"/);
  assert.match(dashboard, /data-invitations-failed/);
});

const SV = { '.sv': 'timestamp' };

test('adminReply: exact payloads', () => {
  assert.deepEqual(adminReply('yes', 3), { answer: 'yes', coming: [true, true, true], at: SV });
  assert.deepEqual(adminReply('no', 2), { answer: 'no', coming: [false, false], at: SV });
  assert.deepEqual(adminReply('yes', 3, [true, false, true]), { answer: 'yes', coming: [true, false, true], at: SV });
});

test('adminReply: clamps people to 1 to 8', () => {
  for (const [n, len] of [[0, 1], [1, 1], [8, 8], [9, 8], [-3, 1], [NaN, 1], [undefined, 1], ['4', 4]]) {
    assert.equal(adminReply('yes', n).coming.length, len, String(n));
    assert.equal(adminReply('no', n).coming.length, len, String(n));
  }
});

test('adminReply: a yes is never all false, a no is all false, bad input is null', () => {
  assert.deepEqual(adminReply('yes', 2, [false, false]).coming, [true, true]);
  assert.deepEqual(adminReply('yes', 2, 'junk').coming, [true, true]);
  assert.ok(adminReply('no', 3, [true, true, true]).coming.every((c) => c === false));
  assert.equal(adminReply('maybe', 2), null);
  assert.equal(adminReply(undefined, 2), null);
});

test('adminToggleComing: flips one, never leaves nobody, safe on bad input', () => {
  assert.deepEqual(adminToggleComing([true, false], 1), [true, true]);
  assert.deepEqual(adminToggleComing([true, true], 0), [false, true]);
  const last = [true, false];
  assert.equal(adminToggleComing(last, 0), last);
  assert.equal(adminToggleComing(last, 5), last);
  assert.equal(adminToggleComing(last, -1), last);
  assert.equal(adminToggleComing(last, 'x'), last);
  assert.equal(adminToggleComing(null, 0), null);
});

test('adminStay: exact payload, null for anything else', () => {
  assert.deepEqual(adminStay('villa'), { choice: 'villa', at: SV });
  assert.deepEqual(adminStay('own'), { choice: 'own', at: SV });
  assert.deepEqual(adminStay('later'), { choice: 'later', at: SV });
  assert.equal(adminStay('moon'), null);
  assert.equal(adminStay(undefined), null);
});

test('adminSteps: ordered single leaves, stay removed before reply is touched', () => {
  assert.deepEqual(adminSteps('yes', { peopleCount: 2 }), [{ path: 'reply', value: { answer: 'yes', coming: [true, true], at: SV } }]);
  assert.deepEqual(adminSteps('no', { peopleCount: 2 }), [
    { path: 'stay', value: null }, { path: 'reply', value: { answer: 'no', coming: [false, false], at: SV } }]);
  assert.deepEqual(adminSteps('clear', { peopleCount: 2 }), [{ path: 'stay', value: null }, { path: 'reply', value: null }]);
  assert.deepEqual(adminSteps('stay', { choice: 'own' }), [{ path: 'stay', value: { choice: 'own', at: SV } }]);
  assert.deepEqual(adminSteps('toggle', { coming: [true, false], index: 1 }), [{ path: 'reply', value: { answer: 'yes', coming: [true, true], at: SV } }]);
  for (const action of ['yes', 'no', 'clear', 'stay', 'toggle']) {
    const steps = adminSteps(action, { peopleCount: 2, choice: 'villa', coming: [true, true], index: 0 });
    assert.ok(steps.length >= 1 && steps.every((st) => st.path === 'stay' || st.path === 'reply'), action);
  }
  for (const action of ['no', 'clear']) {
    const paths = adminSteps(action, { peopleCount: 1 }).map((st) => st.path);
    assert.equal(paths[0], 'stay');
    assert.ok(paths.indexOf('stay') < paths.indexOf('reply'));
  }
});

test('adminSteps: malformed input plans nothing', () => {
  assert.deepEqual(adminSteps('explode', {}), []);
  assert.deepEqual(adminSteps(undefined), []);
  assert.deepEqual(adminSteps('stay', { choice: 'moon' }), []);
  assert.deepEqual(adminSteps('toggle', { coming: null, index: 0 }), []);
  assert.deepEqual(adminSteps('toggle', { coming: [true, false], index: 0 }), []);
  assert.deepEqual(adminSteps('yes', 'junk'), [{ path: 'reply', value: { answer: 'yes', coming: [true], at: SV } }]);
});

test('adminFailureMessage: says what did and did not happen', () => {
  const steps = adminSteps('clear', { peopleCount: 1 });
  assert.equal(adminFailureMessage(steps, 1, 'denied'), 'Could not finish that. Done: removed the stay choice. Not done: cleared the reply. Check this row. (denied)');
  assert.equal(adminFailureMessage(steps, 0, ''), 'Could not finish that. Nothing was changed. Not done: removed the stay choice, cleared the reply. Check this row.');
  assert.equal(adminFailureMessage(adminSteps('stay', { choice: 'own' }), 0, 'denied'), 'Could not save that (denied)');
  assert.equal(adminFailureMessage(null, 0), 'Could not save that');
});

test('householdRows: equal display sorts by token', () => {
  const rows = householdRows({ tb: { display: 'Same', lines: [] }, ta: { display: 'same', lines: [] } }, {}, {});
  assert.deepEqual(rows.map((r) => r.token), ['ta', 'tb']);
});

test('householdRows: coming longer than people is passed through unchanged', () => {
  const rows = householdRows({ t1: { display: 'One', lines: [], people: ['A'] } }, {}, { t1: { reply: { answer: 'yes', coming: [true, false, true], at: 1 } } });
  assert.deepEqual(rows[0].coming, [true, false, true]);
  assert.deepEqual(rows[0].people, ['A']);
});

test('householdTotals: a stay on a no household is not counted', () => {
  const rows = householdRows({ t1: { display: 'One', lines: [] } }, {}, { t1: { reply: { answer: 'no', coming: [false], at: 1 }, stay: { choice: 'own', at: 1 } } });
  assert.equal(rows[0].stay, 'own');
  const t = householdTotals(rows);
  assert.equal(t.own, 0);
  assert.equal(t.notChosen, 0);
  assert.equal(t.cantCome, 1);
});
