const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/first/core.js');
const { app } = require('../js/first/app.js');

const TOKEN = 'tok_FAKEHOUSEHOLD01';
const INVITE = { token: TOKEN, display: 'Alex & Sam', lines: null, people: ['Alex', 'Sam'] };
const YES = { reply: { answer: 'yes', coming: [true, true], at: 1 } };
const NO = { reply: { answer: 'no', coming: [false, false], at: 1 } };
const AFTER_CLOSE = core.REPLIES_CLOSE_MS + 86400000;
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

function link(invite, token) {
  const p = Promise.resolve(invite);
  p.token = token;
  p.remembered = false;
  p.remember = () => { p.remembered = true; };
  return p;
}

// Runs app.run with fake parts. household is a value, or a function read on each load.
function boot({ seen = false, invite = INVITE, token = invite ? invite.token : '', household = null, nowMs, home } = {}) {
  const calls = { shown: [], plays: [], marked: false, loads: 0, home: 0, last: null };
  let done = null;
  const first = Object.assign({}, core, {
    store: {
      seenMinute: () => seen,
      markSeen: () => { calls.marked = true; },
      load: () => { calls.loads++; return Promise.resolve(typeof household === 'function' ? household() : household); }
    },
    minute: { play: o => { calls.plays.push(o.quick ? 'quick' : 'full'); if (!o.quick) done = o.onDone; } },
    reply: { show: o => { calls.shown.push(o.mode); calls.last = o; }, clear() {} },
    home: home ? { show: () => { calls.home++; } } : undefined
  });
  const l = link(invite, token);
  const location = nowMs ? { hostname: 'localhost', search: '?wtest=1&fnow=' + nowMs } : { hostname: 'example.com', search: '' };
  app.run({ first, host: { hidden: true }, link: l, location, reload: () => { calls.reloaded = true; } });
  return { calls, link: l, finish: async () => { await settle(); assert.ok(done, 'a full minute is playing'); done(); await settle(); } };
}
const last = calls => calls.shown[calls.shown.length - 1];

test('no link: the minute plays, then the no-link screen', async () => {
  const b = boot({ invite: null, token: '' });
  await b.finish();
  assert.deepEqual(b.calls.plays, ['full']);
  assert.equal(last(b.calls), 'nolink');
  assert.equal(b.calls.marked, true);
});

test('invitation, no reply, minute not seen: the minute, marked seen, remembered, then the question', async () => {
  const b = boot();
  await b.finish();
  assert.deepEqual(b.calls.plays, ['full']);
  assert.equal(b.calls.marked, true);
  assert.equal(b.link.remembered, true);
  assert.equal(last(b.calls), 'ask');
  assert.equal(b.calls.last.onWatch, undefined, 'no watch-again right after the minute');
});

test('minute seen, no reply: the question with a way to watch again, no full minute', async () => {
  const b = boot({ seen: true });
  await settle();
  assert.deepEqual(b.calls.plays, ['quick']);
  assert.equal(last(b.calls), 'ask');
  assert.equal(typeof b.calls.last.onWatch, 'function');
});

test('watching again reads the household again when it ends', async () => {
  let h = null;
  const b = boot({ seen: true, household: () => h });
  await settle();
  const loads = b.calls.loads;
  b.calls.last.onWatch();
  h = NO;
  await b.finish();
  assert.ok(b.calls.loads > loads);
  assert.equal(last(b.calls), 'already');
});

test('reply yes: home when it exists, already-replied while it does not', async () => {
  const withHome = boot({ seen: true, household: YES, home: true });
  await settle();
  assert.equal(withHome.calls.home, 1);
  const without = boot({ seen: true, household: YES });
  await settle();
  assert.equal(last(without.calls), 'already');
});

test('reply no: the can\'t-come screen', async () => {
  const b = boot({ seen: true, household: NO });
  await settle();
  assert.equal(last(b.calls), 'cantcome');
});

test('replies closed: closed without a reply, can\'t-come with one', async () => {
  const none = boot({ seen: true, household: null, nowMs: AFTER_CLOSE });
  await settle();
  assert.equal(last(none.calls), 'closed');
  const replied = boot({ seen: true, household: NO, nowMs: AFTER_CLOSE });
  await settle();
  assert.equal(last(replied.calls), 'cantcome');
  const afterMinute = boot({ household: null, nowMs: AFTER_CLOSE });
  await afterMinute.finish();
  assert.equal(last(afterMinute.calls), 'closed');
});

test('household load unclear: wait with retry, never the question', async () => {
  for (const seen of [true, false]) {
    const b = boot({ seen, household: () => undefined });
    if (seen) await settle(); else await b.finish();
    assert.equal(last(b.calls), 'wait');
    assert.equal(b.calls.last.failed, true);
    assert.ok(!b.calls.shown.includes('ask'));
  }
});

test('invitation lookup unclear on a first visit: wait with retry, no minute, not marked seen or remembered', async () => {
  const b = boot({ invite: null, token: TOKEN });
  await settle();
  assert.ok(!b.calls.plays.includes('full'));
  assert.equal(b.calls.marked, false);
  assert.equal(b.link.remembered, false);
  assert.equal(last(b.calls), 'wait');
  assert.equal(b.calls.last.failed, true);
  b.calls.last.onRetry();
  assert.equal(b.calls.reloaded, true);
  const back = boot({ seen: true, invite: null, token: TOKEN });
  await settle();
  assert.equal(last(back.calls), 'wait');
  assert.ok(!back.calls.shown.includes('nolink'));
});

test('partner replied during the minute: lands on the already-replied screen, not the question', async () => {
  let h = null;
  const b = boot({ household: () => h });
  await settle();
  h = YES;
  await b.finish();
  assert.equal(last(b.calls), 'already');
  assert.ok(!b.calls.shown.includes('ask'));
});

test('retry after an unclear household load reads it again', async () => {
  let h;
  const b = boot({ seen: true, household: () => h });
  await settle();
  assert.equal(last(b.calls), 'wait');
  h = null;
  b.calls.last.onRetry();
  await settle();
  assert.equal(last(b.calls), 'ask');
});
