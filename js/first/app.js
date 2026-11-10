// The boot file: waits for the personal link (window.sjInvite), loads the household, and lets landing() pick the screen.
// Loaded last, with defer; starts by itself only when the layer is on, and does nothing when required by Node tests.
// No clear answer is never "no": a lookup that timed out shows "one moment" and a retry, never the no-link screen.
// Testing only: with ?wtest=1 on a local or home-network server, ?fnow=<ms> sets the clock (same check as js/invite.js).
(function (root) {
  'use strict';
  const QUIET_MS = 400;
  let started = false;

  function isLocalTest() {
    try {
      return /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/
        .test(location.hostname) && new URLSearchParams(location.search).get('wtest') === '1';
    } catch (e) { return false; }
  }
  function clock() {
    const fixed = isLocalTest() ? Number(new URLSearchParams(location.search).get('fnow')) : NaN;
    if (!Number.isFinite(fixed) || fixed <= 0) return Date.now;
    const offset = fixed - Date.now();
    return () => Date.now() + offset;
  }

  function start() {
    if (started) return;
    started = true;
    const first = root.sjFirst || {}, host = document.getElementById('first');
    if (!host || !first.reply || !first.minute || !first.store || !first.landing) return;
    const link = root.sjInvite || null;
    const ctx = { invite: null, household: undefined, now: clock() };
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
    // A token is set but the lookup gave no clear answer.
    const unclear = () => !ctx.invite && !!(link && link.token);

    function watchAgain() {
      first.reply.clear();
      first.minute.play({ root: host, invite: ctx.invite, onDone: () => route(true) });
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
    function retry() {
      if (!ctx.invite) { root.location.reload(); return; }
      wait(false);
      first.store.load(ctx.invite.token).then(function (household) { ctx.household = household; route(false); });
    }

    if (seen) first.minute.play({ root: host, invite: null, quick: true });
    whenReady(Promise.resolve(link), function (invite) {
      ctx.invite = invite || null;
      const loading = ctx.invite ? first.store.load(ctx.invite.token) : Promise.resolve(unclear() ? undefined : null);
      if (seen) { whenReady(loading, function (household) { ctx.household = household; route(false); }); return; }
      first.reply.clear();
      first.minute.play({
        root: host, invite: ctx.invite,
        onDone: function () {
          first.store.markSeen();
          if (link && typeof link.remember === 'function') link.remember();
          whenReady(loading, function (household) { ctx.household = household; route(true); });
        }
      });
    });
  }

  const api = { app: { start } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList.contains('first-on')) start();
})(typeof window !== 'undefined' ? window : globalThis);
