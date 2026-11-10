// The boot file: waits for the personal link (window.sjInvite), loads the household, and lets landing() pick the screen.
// Loaded last, with defer; starts by itself only when the layer is on, and does nothing when required by Node tests.
// No clear answer is never "no": a lookup that timed out shows "one moment" and a retry, never the no-link screen,
// and a first-time guest keeps their named minute for when the invitation is known.
// The household is read again whenever the minute ends, so a partner's reply sent meanwhile is never shown as no reply.
// Testing only: with ?wtest=1 on a local or home-network server, ?fnow=<ms> sets the clock.
(function (root) {
  'use strict';
  const QUIET_MS = 400;
  let started = false;

  function clock(first, loc) {
    const fixed = first.isLocalTest(loc) ? Number(new URLSearchParams(loc.search).get('fnow')) : NaN;
    if (!Number.isFinite(fixed) || fixed <= 0) return Date.now;
    const offset = fixed - Date.now();
    return () => Date.now() + offset;
  }

  // env: { first, host, link, location, reload }. start() fills it from the page; tests pass fakes.
  function run(env) {
    const first = env.first, host = env.host, link = env.link || null;
    const reload = env.reload || (() => root.location.reload());
    const ctx = { invite: null, household: undefined, now: clock(first, env.location || {}) };
    const seen = first.store.seenMinute();
    const show = (mode, extra) => first.reply.show(Object.assign({ root: host, ctx, mode }, extra));
    const wait = failed => show('wait', { failed, onRetry: retry });
    host.hidden = false;

    // "One moment" only when an answer is slow, so a quick one never flashes it.
    function whenReady(promise, then) {
      let settled = false;
      const t = root.setTimeout(() => { if (!settled) wait(false); }, QUIET_MS);
      promise.then(function (value) { settled = true; root.clearTimeout(t); then(value); });
    }
    // A token is set but the invitation lookup gave no clear answer.
    const unclear = () => !ctx.invite && !!(link && link.token);
    // Reads the household now (an invitation is known), then carries on with the fresh result.
    function fresh(then) {
      whenReady(first.store.load(ctx.invite.token), function (household) { ctx.household = household; then(); });
    }

    function route(justWatched) {
      if (unclear()) return wait(true);
      const where = first.landing({ hasInvite: !!ctx.invite, seenMinute: true, household: ctx.household, nowMs: ctx.now() });
      if (where === 'wait') return wait(true);
      if (where === 'home') {
        const home = first.home;
        if (!justWatched && home && typeof home.show === 'function') { first.reply.clear(); return home.show({ root: host, ctx }); }
        return show('already');
      }
      if (where === 'cantcome') return show(justWatched ? 'already' : 'cantcome');
      if (where === 'ask') return show('ask', justWatched ? {} : { onWatch: watchAgain });
      return show(where);
    }
    function afterMinute() {
      if (!ctx.invite) return route(true);
      fresh(() => route(true));
    }
    function playMinute(onDone) {
      first.reply.clear();
      first.minute.play({ root: host, invite: ctx.invite, onDone });
    }
    function watchAgain() { playMinute(afterMinute); }
    function retry() {
      if (!ctx.invite) { reload(); return; }
      wait(false);
      fresh(() => route(false));
    }

    if (seen) first.minute.play({ root: host, invite: null, quick: true });
    whenReady(Promise.resolve(link), function (invite) {
      ctx.invite = invite || null;
      if (unclear()) {
        // Not known yet whether there is an invitation: no minute, nothing marked seen or remembered.
        if (!seen) first.minute.play({ root: host, invite: null, quick: true });
        return wait(true);
      }
      if (seen) return ctx.invite ? fresh(() => route(false)) : route(false);
      playMinute(function () {
        first.store.markSeen();
        if (link && typeof link.remember === 'function') link.remember();
        afterMinute();
      });
    });
  }

  function start() {
    if (started) return;
    started = true;
    const first = root.sjFirst || {}, host = document.getElementById('first');
    if (!host || !first.reply || !first.minute || !first.store || !first.landing || !first.isLocalTest) return;
    run({ first, host, link: root.sjInvite || null, location: root.location });
  }

  const api = { app: { start, run } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList.contains('first-on')) start();
})(typeof window !== 'undefined' ? window : globalThis);
