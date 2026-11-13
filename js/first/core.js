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

  // travelStamped: this phone holds a stamped Getting there ticket (the database never tells a link).
  function dockStates(household, travelStamped) {
    const choice = stayChoiceOf(household);
    return {
      reply: replyOf(household) ? 'done' : 'glow',
      stay: choice === 'villa' || choice === 'own' ? 'done' : stayIsOpen(household) ? 'glow' : 'plain',
      travel: travelStamped === true ? 'done' : 'plain', wear: 'plain', weekend: 'plain'
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

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  // one row per invited household for the admin dashboard; households not in welcome are dropped
  function householdRows(welcome, seen, household) {
    if (!isObj(welcome)) return [];
    const seenMap = isObj(seen) ? seen : {};
    const houseMap = isObj(household) ? household : {};
    const rows = Object.keys(welcome).filter((token) => isObj(welcome[token])).map((token) => {
      const w = welcome[token];
      const last = isObj(seenMap[token]) && isObj(seenMap[token].last) ? seenMap[token].last : null;
      const record = isObj(houseMap[token]) ? houseMap[token] : {};
      const reply = isObj(record.reply) ? record.reply : null;
      const stay = isObj(record.stay) ? record.stay : null;
      const answer = reply && (reply.answer === 'yes' || reply.answer === 'no') ? reply.answer : null;
      return {
        token,
        display: typeof w.display === 'string' ? w.display : '',
        people: Array.isArray(w.people) ? w.people.filter((p) => typeof p === 'string') : [],
        openedAt: last && typeof last.at === 'number' ? last.at : null,
        answer,
        coming: answer && Array.isArray(reply.coming) ? reply.coming.map((c) => c === true) : null,
        stay: stay && ['villa', 'own', 'later'].indexOf(stay.choice) >= 0 ? stay.choice : null,
      };
    });
    const byName = (a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()) || (a.token < b.token ? -1 : 1);
    return rows.sort((a, b) => (a.answer === null) !== (b.answer === null) ? (a.answer === null ? -1 : 1) : byName(a, b));
  }

  // notChosen: households that said yes and have not picked the villa or their own place
  function householdTotals(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const yes = list.filter((r) => r.answer === 'yes');
    return {
      households: list.length,
      opened: list.filter((r) => r.openedAt !== null).length,
      yes: yes.length,
      cantCome: list.filter((r) => r.answer === 'no').length,
      noReply: list.filter((r) => r.answer === null).length,
      villa: yes.filter((r) => r.stay === 'villa').length,
      own: yes.filter((r) => r.stay === 'own').length,
      notChosen: yes.filter((r) => r.stay !== 'villa' && r.stay !== 'own').length,
    };
  }

  // ---- admin view of the Getting there tickets (travel/<token>/<n>, readable only by the admin sign-in) ----
  // travel-core.js loads after this file, so it is looked up when first needed.
  function travelRules() {
    return (root.sjFirst && root.sjFirst.travel) || (typeof require === 'function' ? require('./travel-core.js') : null);
  }
  // One row per invited household that has a stamped ticket: { token, display, tickets: [{ n, who, from, to, toText,
  // via, last, arrive, leave, at }] }. who is the names it is for (from the invitation, by position) or null for the
  // household's own ticket. Households not in welcome are dropped; so is anything that is not a ticket.
  function travelRows(welcome, travel) {
    const rules = travelRules();
    if (!isObj(welcome) || !isObj(travel) || !rules) return [];
    const rows = Object.keys(welcome).filter((token) => isObj(welcome[token])).map((token) => {
      const w = welcome[token], people = Array.isArray(w.people) ? w.people : [];
      const saved = Array.isArray(travel[token]) || isObj(travel[token]) ? travel[token] : {};
      const tickets = [];
      for (let n = 0; n < 8; n++) {
        const t = rules.cleanTicket(saved[n]);
        if (!t) continue;
        tickets.push({
          n, who: t.who ? people.filter((p, i) => typeof p === 'string' && t.who[i] === true) : null,
          from: t.from, to: t.to || null, toText: t.toText || null, via: t.via || null,
          last: t.last, arrive: t.arrive, leave: t.leave, at: typeof t.at === 'number' ? t.at : null,
        });
      }
      return { token, display: typeof w.display === 'string' ? w.display : '', tickets };
    }).filter((r) => r.tickets.length > 0);
    return rows.sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()) || (a.token < b.token ? -1 : 1));
  }

  const TICKET_LAST = { hire: 'hire car', lift: 'getting a lift', taxi: 'taxi', public: 'public transport', own: 'own car' };
  const TICKET_ARRIVE = { early: 'earlier in the week', thu: 'Thu 27', fri: 'Fri 28', sat: 'Sat 29' };
  const TICKET_LEAVE = { sun: 'to Sun 30', mon: 'to Mon 31', later: 'then staying on' };
  const TICKET_FROM = { ABROAD: 'Outside the UK', ITALY: 'Already in Italy', ROAD: 'Driving all the way', TRAIN: 'Train all the way' };
  const ARRIVAL_PLACE = { ROAD: 'By road', TRAIN: 'By train', ITALY: 'Already in Italy' };
  const landsAt = (t) => (t.to === 'OTHER' ? t.toText || 'somewhere else' : t.to);

  // A ticket from travelRows in one plain line for the dashboard, airport codes as saved.
  function ticketLine(t) {
    if (!isObj(t)) return '';
    const kind = TICKET_FROM[t.from];
    let trip = kind || t.from + ' to ' + landsAt(t) + (t.via === 'change' ? ' with a change' : '');
    if (t.from === 'ABROAD') trip = kind + ' to ' + landsAt(t);
    if (t.from === 'ITALY') trip = kind + (t.to ? ', landing at ' + landsAt(t) : ', not flying');
    const names = Array.isArray(t.who) && t.who.length ? t.who.join(', ') + ': ' : '';
    const line = [trip, TICKET_LAST[t.last], TICKET_ARRIVE[t.arrive] + ' ' + TICKET_LEAVE[t.leave]].join(', ');
    return names ? names + line.charAt(0).toLowerCase() + line.slice(1) : line;
  }

  // Who lands where on which day, for information: [{ to, arrive, households }], by day then place.
  function arrivals(rows) {
    const groups = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => r.tickets.forEach((t) => {
      const to = t.to ? landsAt(t) : ARRIVAL_PLACE[t.from] || t.from;
      const key = t.arrive + '|' + to;
      groups[key] = groups[key] || { to, arrive: t.arrive, households: [] };
      groups[key].households.push(r.display + (Array.isArray(t.who) && t.who.length ? ' (' + t.who.join(', ') + ')' : ''));
    }));
    const day = (g) => ['early', 'thu', 'fri', 'sat'].indexOf(g.arrive);
    return Object.keys(groups).map((k) => groups[k]).sort((a, b) => day(a) - day(b) || a.to.toLowerCase().localeCompare(b.to.toLowerCase()))
      .map((g) => ({ to: g.to, arrive: g.arrive, households: g.households.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) }));
  }
  const arrivalDay = (key) => TICKET_ARRIVE[key] || '';

  // ---- admin hand-edits: pure builders for the one-leaf writes the dashboard makes ----
  const SERVER_TIME = { '.sv': 'timestamp' };
  const clampPeople = (n) => Math.min(8, Math.max(1, Math.floor(Number(n)) || 1));

  // coming: one boolean per person (1 to 8); a yes is never all false, a no always is
  function adminReply(answer, peopleCount, coming) {
    if (answer !== 'yes' && answer !== 'no') return null;
    const n = clampPeople(peopleCount);
    if (answer === 'no') return { answer, coming: Array.from({ length: n }, () => false), at: SERVER_TIME };
    const picked = Array.isArray(coming) ? Array.from({ length: n }, (_, i) => coming[i] === true) : [];
    return { answer, coming: picked.some(Boolean) ? picked : Array.from({ length: n }, () => true), at: SERVER_TIME };
  }

  // the same array when the toggle would leave nobody coming (or the input is malformed)
  function adminToggleComing(coming, i) {
    if (!Array.isArray(coming) || !Number.isInteger(i) || i < 0 || i >= coming.length) return coming;
    const next = coming.map((c, j) => (j === i ? c !== true : c === true));
    return next.some(Boolean) ? next : coming;
  }

  function adminStay(choice) {
    return choice === 'villa' || choice === 'own' || choice === 'later' ? { choice, at: SERVER_TIME } : null;
  }

  // ordered single-leaf steps: path is 'stay' or 'reply', value null means remove.
  // Stay is always removed before reply is touched, so a stay never outlives its yes.
  function adminSteps(action, opts) {
    const o = isObj(opts) ? opts : {};
    if (action === 'yes') return [{ path: 'reply', value: adminReply('yes', o.peopleCount) }];
    if (action === 'no') return [{ path: 'stay', value: null }, { path: 'reply', value: adminReply('no', o.peopleCount) }];
    if (action === 'clear') return [{ path: 'stay', value: null }, { path: 'reply', value: null }];
    if (action === 'stay') { const v = adminStay(o.choice); return v ? [{ path: 'stay', value: v }] : []; }
    if (action === 'toggle') {
      if (!Array.isArray(o.coming)) return [];
      const next = adminToggleComing(o.coming, o.index);
      return next === o.coming ? [] : [{ path: 'reply', value: adminReply('yes', o.coming.length, next) }];
    }
    return [];
  }

  const describeStep = (st) => (st.path === 'stay' ? (st.value === null ? 'removed the stay choice' : 'saved the stay choice')
    : (st.value === null ? 'cleared the reply' : 'saved the reply'));

  // what to tell the admin when step number `done` (0-based) failed
  function adminFailureMessage(steps, done, detail) {
    const list = Array.isArray(steps) ? steps : [];
    const why = detail ? ' (' + detail + ')' : '';
    if (list.length <= 1) return 'Could not save that' + why;
    const d = Math.max(0, Math.min(done, list.length));
    const did = list.slice(0, d).map(describeStep), left = list.slice(d).map(describeStep);
    return 'Could not finish that.' + (did.length ? ' Done: ' + did.join(', ') + '.' : ' Nothing was changed.')
      + ' Not done: ' + left.join(', ') + '. Check this row.' + why;
  }

  const api = { shouldShowFirst, isLocalTest, copyProblems, WEDDING_MS, REPLIES_CLOSE_MS, SHARE_GBP, LOCKS, repliesOpen, weddingDay, countdown,
    lockState, nextLock, comingCount, fill, ukDate, shareLine, canChangeStay, dockStates, stayLabel, landing, householdRows, householdTotals,
    travelRows, ticketLine, arrivals, arrivalDay, adminReply, adminToggleComing, adminStay, adminSteps, adminFailureMessage };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
