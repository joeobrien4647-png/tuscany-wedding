(function (root) {
  'use strict';
  // The invitation layer shows only when switched on in index.html, or forced with ?first=1 (?first=0 forces it off).
  // A password reset link (?signin=1) always goes straight to Sign in.
  function shouldShowFirst({ search, enabled, signingIn }) {
    if (signingIn) return false;
    const forced = new URLSearchParams(search || '').get('first');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return !!enabled;
  }

  // Testing only: a local or home-network host with ?wtest=1 (the same check as js/invite.js). loc is like window.location.
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;
  function isLocalTest(loc) {
    try { return LOCAL_HOST.test(loc.hostname) && new URLSearchParams(loc.search).get('wtest') === '1'; } catch (e) { return false; }
  }

  const SENTIMENTAL = /\bour story\b|\blove story\b|\bshe said yes\b|\bhappily ever after\b|\bsoul ?mates?\b|\bfairy ?tale\b|\bmeant to be\b|\btrue love\b/i;
  // Copy rules for every guest-facing line: same four checks as js/storybook.js.
  function copyProblems(text) {
    const s = String(text || ''), problems = [];
    if (s.includes(String.fromCharCode(0x2014))) problems.push('em dash');
    if (s.includes(String.fromCharCode(0xb7))) problems.push('middle dot');
    if (/\.\s*$/.test(s)) problems.push('trailing full stop');
    if (SENTIMENTAL.test(s)) problems.push('sentimental');
    return problems;
  }

  // Dates. Times are UTC; UK is GMT until 28 Mar 2027, then BST.
  const WEDDING_MS = Date.UTC(2027, 4, 28, 23); // Sat 29 May 2027, 00:00 UK
  const REPLIES_CLOSE_MS = Date.UTC(2027, 2, 1); // end of Sun 28 Feb 2027
  const SHARE_GBP = 150;
  const LOCKS = Object.freeze([
    Object.freeze({ key: 'estate', opensMs: Date.UTC(2027, 1, 1, 8) }),
    Object.freeze({ key: 'room', opensMs: Date.UTC(2027, 3, 1, 7) }),
    Object.freeze({ key: 'menu', opensMs: Date.UTC(2027, 4, 1, 7) }),
    Object.freeze({ key: 'table', opensMs: Date.UTC(2027, 4, 24, 7) }),
    Object.freeze({ key: 'film', opensMs: Date.UTC(2027, 4, 27, 7) }),
    Object.freeze({ key: 'photos', opensMs: null })
  ]);

  const repliesOpen = nowMs => nowMs < REPLIES_CLOSE_MS;
  // The wedding day is the UK calendar day that starts at WEDDING_MS (BST all day, so 24 hours long).
  const weddingDay = nowMs => (nowMs < WEDDING_MS ? 'before' : nowMs < WEDDING_MS + 86400000 ? 'today' : 'after');

  function countdown(targetMs, nowMs) {
    const left = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
    return { days: Math.floor(left / 86400), hours: Math.floor(left % 86400 / 3600), minutes: Math.floor(left % 3600 / 60), seconds: left % 60 };
  }

  const lockState = (lock, nowMs, hasContent) =>
    lock.opensMs !== null && nowMs >= lock.opensMs && hasContent ? 'ready' : 'sealed';
  const nextLock = nowMs => LOCKS.find(l => l.opensMs !== null && l.opensMs > nowMs) || null;

  // Household helpers: a household may be null, undefined or {}.
  const replyOf = household => (household && household.reply) || null;
  const stayChoiceOf = household => (household && household.stay && household.stay.choice) || null;
  const saidYes = household => !!replyOf(household) && replyOf(household).answer === 'yes';
  const stayIsOpen = household => saidYes(household) && (!stayChoiceOf(household) || stayChoiceOf(household) === 'later');

  function comingCount(household) {
    if (!saidYes(household)) return 0;
    const coming = replyOf(household).coming;
    return Array.isArray(coming) && coming.length ? coming.filter(c => c === true).length : 1;
  }

  // Replaces each {key} that vars has; unknown placeholders stay as they are.
  function fill(template, vars) {
    const v = vars || {};
    return String(template == null ? '' : template)
      .replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m));
  }

  // The UK calendar date as weekday, day, month: ukDate(Date.UTC(2027, 1, 1, 8)) is 'Mon 1 Feb'.
  const UK_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
  function ukDate(ms) {
    const parts = UK_DATE.formatToParts(new Date(ms));
    const part = type => (parts.find(p => p.type === type) || {}).value;
    return part('weekday') + ' ' + part('day') + ' ' + part('month');
  }

  function shareLine(template, count) {
    return fill(template, { share: '\u00a3' + SHARE_GBP + (count >= 2 ? ' each' : '') });
  }

  const canChangeStay = (household, nowMs) =>
    repliesOpen(nowMs) || !['villa', 'own'].includes(stayChoiceOf(household));

  function dockStates(household) {
    const choice = stayChoiceOf(household);
    return {
      reply: replyOf(household) ? 'done' : 'glow',
      stay: choice === 'villa' || choice === 'own' ? 'done' : stayIsOpen(household) ? 'glow' : 'plain',
      travel: 'plain', wear: 'plain', weekend: 'plain'
    };
  }

  function stayLabel(household, labels) {
    const choice = stayChoiceOf(household);
    if (choice === 'villa') return labels.villa;
    if (choice === 'own') return labels.own;
    return stayIsOpen(household) ? labels.choose : labels.plain;
  }

  function landing({ hasInvite, seenMinute, household, nowMs }) {
    if (!hasInvite) return seenMinute ? 'nolink' : 'minute';
    if (!seenMinute) return 'minute';
    if (household === undefined) return 'wait';
    const reply = replyOf(household);
    if (!reply) return repliesOpen(nowMs) ? 'ask' : 'closed';
    return reply.answer === 'no' ? 'cantcome' : 'home';
  }

  const api = { shouldShowFirst, isLocalTest, copyProblems, WEDDING_MS, REPLIES_CLOSE_MS, SHARE_GBP, LOCKS, repliesOpen, weddingDay, countdown,
    lockState, nextLock, comingCount, fill, ukDate, shareLine, canChangeStay, dockStates, stayLabel, landing };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
