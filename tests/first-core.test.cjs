const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/first/core.js');
const { WEDDING_MS, REPLIES_CLOSE_MS, SHARE_GBP, LOCKS, repliesOpen, countdown, lockState, nextLock,
  comingCount, fill, ukDate, shareLine, canChangeStay, dockStates, stayLabel, landing } = core;

test('dates', () => {
  assert.equal(REPLIES_CLOSE_MS, 1803859200000);
  assert.equal(repliesOpen(REPLIES_CLOSE_MS - 1), true);
  assert.equal(repliesOpen(REPLIES_CLOSE_MS), false);
  assert.deepEqual(countdown(WEDDING_MS, WEDDING_MS - 90061000), { days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(countdown(WEDDING_MS, WEDDING_MS + 5), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
test('locks', () => {
  assert.deepEqual(LOCKS.map(l => l.key), ['estate', 'room', 'menu', 'table', 'film', 'photos']);
  assert.ok(Object.isFrozen(LOCKS));
  assert.deepEqual(LOCKS.map(l => l.opensMs), [Date.UTC(2027, 1, 1, 8), Date.UTC(2027, 3, 1, 7), Date.UTC(2027, 4, 1, 7), Date.UTC(2027, 4, 24, 7), Date.UTC(2027, 4, 27, 7), null]);
  const estate = LOCKS[0];
  assert.equal(lockState(estate, estate.opensMs - 1, true), 'sealed');
  assert.equal(lockState(estate, estate.opensMs, false), 'sealed');
  assert.equal(lockState(estate, estate.opensMs, true), 'ready');
  assert.equal(lockState(LOCKS[5], Date.UTC(2028, 0, 1), true), 'sealed');
  assert.equal(nextLock(Date.UTC(2026, 11, 13)).key, 'estate');
  assert.equal(nextLock(Date.UTC(2027, 4, 28)), null);
});
test('share line', () => {
  assert.equal(shareLine('Your share is {share}', 1), 'Your share is £150');
  assert.equal(shareLine('Your share is {share}', 2), 'Your share is £150 each');
  assert.equal(shareLine('Your share is {share}', 0), 'Your share is £150');
  assert.equal(comingCount({ reply: { answer: 'yes', coming: [true, false] } }), 1);
  assert.equal(comingCount({ reply: { answer: 'yes', coming: [true, true, true] } }), 3);
  assert.equal(comingCount({ reply: { answer: 'yes' } }), 1);
  assert.equal(comingCount({ reply: { answer: 'yes', coming: [] } }), 1);
  assert.equal(comingCount({ reply: { answer: 'no', coming: [true] } }), 0);
  assert.equal(comingCount({}), 0);
});
test('dock', () => {
  const now = Date.UTC(2026, 11, 20), yes = { answer: 'yes', coming: [true] };
  assert.equal(dockStates({ reply: yes }, now).stay, 'glow');
  assert.equal(dockStates({ reply: yes, stay: { choice: 'later' } }, now).stay, 'glow');
  assert.equal(dockStates({ reply: yes, stay: { choice: 'villa' } }, now).stay, 'done');
  assert.equal(dockStates({ reply: yes, stay: { choice: 'own' } }, now).stay, 'done');
  assert.equal(dockStates({ reply: yes }, now).reply, 'done');
  assert.equal(dockStates({}, now).reply, 'glow');
  assert.equal(dockStates({}, now).stay, 'plain');
  assert.equal(dockStates({ reply: yes }, now).travel, 'plain');
  assert.equal(dockStates({ reply: yes }, now).wear, 'plain');
  assert.equal(dockStates({ reply: yes }, now).weekend, 'plain');
  assert.equal(canChangeStay({ stay: { choice: 'own' } }, REPLIES_CLOSE_MS), false);
  assert.equal(canChangeStay({ stay: { choice: 'own' } }, REPLIES_CLOSE_MS - 1), true);
  assert.equal(canChangeStay({ stay: { choice: 'villa' } }, REPLIES_CLOSE_MS - 1), true);
  assert.equal(canChangeStay({ stay: { choice: 'later' } }, REPLIES_CLOSE_MS), true);
  assert.equal(canChangeStay({}, REPLIES_CLOSE_MS), true);
});
test('stay label', () => {
  const labels = { plain: 'Stay', choose: 'Choose stay', villa: 'La Conca', own: 'Own place' };
  const yes = { answer: 'yes', coming: [true] };
  assert.equal(stayLabel({ reply: yes }, labels), 'Choose stay');
  assert.equal(stayLabel({ reply: yes, stay: { choice: 'later' } }, labels), 'Choose stay');
  assert.equal(stayLabel({ reply: yes, stay: { choice: 'villa' } }, labels), 'La Conca');
  assert.equal(stayLabel({ reply: yes, stay: { choice: 'own' } }, labels), 'Own place');
  assert.equal(stayLabel({}, labels), 'Stay');
  assert.equal(stayLabel({ reply: { answer: 'no' } }, labels), 'Stay');
});
test('landing', () => {
  const now = Date.UTC(2026, 11, 20), late = REPLIES_CLOSE_MS + 1, L = landing;
  assert.equal(L({ hasInvite: false, seenMinute: false, household: null, nowMs: now }), 'minute');
  assert.equal(L({ hasInvite: false, seenMinute: true, household: null, nowMs: now }), 'nolink');
  assert.equal(L({ hasInvite: true, seenMinute: false, household: null, nowMs: now }), 'minute');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: undefined, nowMs: now }), 'wait');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: null, nowMs: now }), 'ask');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: {}, nowMs: now }), 'ask');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: { stay: { choice: 'villa' } }, nowMs: now }), 'ask');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: null, nowMs: late }), 'closed');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: {}, nowMs: late }), 'closed');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: { reply: { answer: 'yes' } }, nowMs: late }), 'home');
  assert.equal(L({ hasInvite: true, seenMinute: true, household: { reply: { answer: 'no' } }, nowMs: now }), 'cantcome');
});
test('households that are null, undefined or empty never throw', () => {
  const labels = { plain: 'Stay', choose: 'Choose stay', villa: 'V', own: 'O' };
  for (const h of [null, undefined, {}]) {
    assert.equal(comingCount(h), 0);
    assert.equal(canChangeStay(h, REPLIES_CLOSE_MS + 1), true);
    assert.equal(dockStates(h, 0).reply, 'glow');
    assert.equal(stayLabel(h, labels), 'Stay');
  }
});
test('the amount lives only in SHARE_GBP', () => {
  assert.equal(SHARE_GBP, 150);
  const dir = path.join(__dirname, '..', 'js', 'first');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const hits = src.match(/\b150\b/g) || [];
    assert.equal(hits.length, f === 'core.js' ? 1 : 0, f);
  }
});

test('fill replaces known placeholders and leaves the rest', () => {
  assert.equal(fill('Opens {date} for {n}', { date: 'Mon 1 Feb', n: 3 }), 'Opens Mon 1 Feb for 3');
  assert.equal(fill('Hi {names} {n}', { n: 0 }), 'Hi {names} 0');
  assert.equal(fill('{n} and {n}', { n: 2 }), '2 and 2');
  assert.equal(fill(undefined, { n: 1 }), ''); assert.equal(fill(null), ''); assert.equal(fill('{n}'), '{n}');
});
test('ukDate gives the UK calendar day', () => {
  assert.equal(ukDate(Date.UTC(2027, 1, 1, 8)), 'Mon 1 Feb');
  assert.equal(ukDate(REPLIES_CLOSE_MS - 1), 'Sun 28 Feb');
  assert.equal(ukDate(Date.UTC(2027, 4, 28, 23)), 'Sat 29 May');
});

test('G6: isLocalTest needs a local or home-network host and wtest=1', () => {
  const { isLocalTest } = require('../js/first/core.js');
  for (const h of ['localhost', '127.0.0.1', '[::1]', '192.168.1.20', '10.0.0.5', '172.16.3.4'])
    assert.equal(isLocalTest({ hostname: h, search: '?wtest=1' }), true, h);
  assert.equal(isLocalTest({ hostname: 'localhost', search: '' }), false);
  assert.equal(isLocalTest({ hostname: 'localhost', search: '?wtest=0' }), false);
  for (const h of ['sophieandjoe2027.com', 'localhost.evil.com', '172.32.0.1', '192.169.0.1'])
    assert.equal(isLocalTest({ hostname: h, search: '?wtest=1' }), false, h);
  assert.equal(isLocalTest(null), false);
  assert.equal(isLocalTest(undefined), false);
});

test('G6: store and app use the one isLocalTest in core', () => {
  const fs = require('node:fs'), path = require('node:path');
  for (const f of ['store.js', 'app.js']) {
    const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'first', f), 'utf8');
    assert.doesNotMatch(js, /192\\.168/, f + ' has its own host check');
    assert.match(js, /\.isLocalTest\(/, f);
  }
});
