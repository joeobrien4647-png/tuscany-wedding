(function (root) {
  'use strict';
  // The food needs rules, with no screen in them: what a guest can pick, how a saved entry is cleaned, what is
  // shown and saved, and who is still to be asked. The same limits are enforced by the database rules.
  //   Food      { at, people: FoodEntry[] }         people sorted by i
  //   FoodEntry { i, name, picks: string[], note }  picks in PICKS order, note '' when none
  //   FoodDraft { i, name, picks, note }            what the screens edit
  //   wire      { people?: { '<i>': { name, picks?: { <key>: true }, note? } } }, with at added by the store
  const PICKS = ['vegetarian', 'vegan', 'pescatarian', 'glutenfree', 'dairyfree', 'nuts', 'shellfish', 'nopork', 'noalcohol', 'none'];
  const NOTE_MAX = 80, MAX_PEOPLE = 8;

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.repliesOpen ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const inPicksOrder = list => PICKS.filter(k => list.indexOf(k) >= 0);
  const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  // A line break or other control character in a name or note becomes one space, so a copied list keeps one line per person.
  const oneLine = s => String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();
  // Cut by whole characters (never half an emoji), at most max UTF-16 units, as the database counts.
  function cut(s, max) {
    let out = '';
    for (const ch of s) { if (out.length + ch.length > max) break; out += ch; }
    return out;
  }

  // A saved entry may come back as an array with null holes or as an object keyed '0' to '7'.
  function placesOf(raw) {
    if (raw === undefined || raw === null) return [];
    if (Array.isArray(raw)) return raw.length > MAX_PEOPLE ? null : raw.map((p, i) => [i, p]);
    if (!isObject(raw)) return null;
    const keys = Object.keys(raw);
    return keys.every(k => /^[0-7]$/.test(k)) ? keys.map(k => [Number(k), raw[k]]) : null;
  }
  function cleanPerson(i, p) {
    if (!isObject(p) || typeof p.name !== 'string' || !p.name.length || p.name.length > 80) return null;
    const name = oneLine(p.name);
    if (!name) return null;
    let picks = isObject(p.picks) ? PICKS.filter(k => has(p.picks, k) && p.picks[k] === true) : [];
    if (picks.length > 1) picks = picks.filter(k => k !== 'none');   // a need beats "nothing"
    const note = typeof p.note === 'string' && p.note.length <= NOTE_MAX ? oneLine(p.note) : '';
    return picks.length || note ? { i, name, picks, note } : null;
  }
  function cleanFood(raw) {
    if (!isObject(raw) || typeof raw.at !== 'number') return null;
    const places = placesOf(raw.people);
    if (!places) return null;
    const people = places.map(([i, p]) => cleanPerson(i, p)).filter(Boolean).sort((a, b) => a.i - b.i);
    return { at: raw.at, people };
  }

  const namesShown = people => Array.isArray(people) && people.length > 1;
  function foodScreens(people, coming) {
    if (!Array.isArray(people) || !Array.isArray(coming)) return [];
    const out = [];
    people.forEach((name, i) => {
      if (i < MAX_PEOPLE && coming[i] === true && typeof name === 'string' && name.length) out.push({ i, name });
    });
    return out;
  }

  function togglePick(picks, key) {
    if (PICKS.indexOf(key) < 0) return picks;
    if (picks.indexOf(key) >= 0) return picks.filter(k => k !== key);
    return key === 'none' ? ['none'] : inPicksOrder(picks.filter(k => k !== 'none').concat(key));
  }

  function startDraft(food, screens) {
    const saved = food && Array.isArray(food.people) ? food.people : [];
    return screens.map(s => {
      const entry = saved.find(e => e.i === s.i && sameName(e.name, s.name));
      return { i: s.i, name: s.name, picks: entry ? entry.picks.slice() : [], note: entry ? entry.note : '' };
    });
  }

  function foodToSave(draft) {
    const people = {};
    let any = false;
    draft.forEach(d => {
      const name = oneLine(d.name || ''), note = cut(oneLine(d.note || ''), NOTE_MAX).trim(), picks = inPicksOrder(d.picks || []);
      if (!name || (!picks.length && !note)) return;
      const person = { name };
      if (picks.length) person.picks = picks.reduce((o, k) => { o[k] = true; return o; }, {});
      if (note) person.note = note;
      people[d.i] = person;
      any = true;
    });
    return any ? { people } : {};
  }

  // At Done: each pick and the note are sent as this phone has them only where this phone changed them since the
  // step began. Everything else is sent as it is saved now, for the name at that place (a partner may have saved
  // meanwhile), and saved now with nothing there means removed: a draft copied from an older save never brings back
  // what the partner took away. A need beats "nothing". A person the step did not begin with is sent as it is.
  const hasPick = (list, k) => Array.isArray(list) && list.indexOf(k) >= 0;
  function mergeDraft(draftAtStart, draftNow, serverFood) {
    const saved = serverFood && Array.isArray(serverFood.people) ? serverFood.people : [];
    return draftNow.map(d => {
      const was = (draftAtStart || []).find(s => s.i === d.i);
      if (!was) return { i: d.i, name: d.name, picks: d.picks.slice(), note: d.note };
      const entry = saved.find(e => e.i === d.i && sameName(e.name, d.name)) || { picks: [], note: '' };
      let picks = PICKS.filter(k => hasPick(hasPick(d.picks, k) !== hasPick(was.picks, k) ? d.picks : entry.picks, k));
      if (picks.length > 1) picks = picks.filter(k => k !== 'none');
      const note = oneLine(d.note || '') !== oneLine(was.note || '') ? d.note : entry.note;
      return { i: d.i, name: d.name, picks, note };
    });
  }

  const replyOf = household => (household && household.reply) || null;
  const saidYes = household => !!replyOf(household) && replyOf(household).answer === 'yes';
  function foodStatus(household, people) {
    // Counted from the screens, as the step and the dashboard count: a person with no name to show is not asked.
    const screens = foodScreens(people, saidYes(household) ? household.reply.coming : null);
    const food = household && household.food, saved = food && Array.isArray(food.people) ? food.people : [];
    const entries = saved.filter(e => screens.some(s => s.i === e.i && sameName(e.name, s.name)));
    return { coming: screens.length, given: entries.length, entries };
  }
  const canSaveFood = (household, nowMs) => saidYes(household) && core.repliesOpen(nowMs);
  function shouldOfferFood(household, people, nowMs) {
    if (!canSaveFood(household, nowMs)) return false;
    const s = foodStatus(household, people);
    return s.given < s.coming;
  }

  // The Reply card's food line and its one button: add or change while replies are open, see after (when some were
  // given), with the closed line after the cut-off. Nothing at all for a household that has not said yes, or with
  // nobody coming to ask (no names on the invitation).
  function foodCardLine(household, people, nowMs, w) {
    const s = foodStatus(household, people);
    if (!s.coming) return { line: null, action: null, label: null, closed: null };
    const open = canSaveFood(household, nowMs);
    const line = s.given ? core.fill(w.food.line, { n: s.given, total: s.coming }) : w.food.lineNone;
    const action = open ? (s.given ? 'change' : 'add') : (s.given ? 'see' : null);
    return { line, action, label: action ? w.food[action] : null, closed: open ? null : w.food.closed };
  }

  // What Joe and Sophie see, not guest words.
  const PICK_LABELS = { vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', glutenfree: 'Gluten free', dairyfree: 'Dairy free',
    nuts: 'Nut allergy', shellfish: 'Shellfish allergy', nopork: 'No pork', noalcohol: 'No alcohol', none: 'Nothing needed' };
  const pickLabels = picks => (Array.isArray(picks) ? picks : []).filter(k => has(PICK_LABELS, k)).map(k => PICK_LABELS[k]).join(', ');

  // The people list as the phone cleans it (js/invite.js names()), so places here are the places the phone saved.
  function invitePeople(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(n => typeof n === 'string' && n.trim()).map(n => n.replace(/\s+/g, ' ').trim().slice(0, 80)).slice(0, MAX_PEOPLE);
  }

  // One row per household that has said yes, one person per person coming, in invitation order. A saved entry counts
  // as theirs only when the name at that place still matches; otherwise savedAs says who it was saved for.
  function foodRows(welcome, household) {
    if (!isObject(welcome) || !isObject(household)) return [];
    const rows = Object.keys(welcome).filter(token => isObject(welcome[token]) && saidYes(household[token])).map(token => {
      const w = welcome[token], h = household[token];
      const saved = (cleanFood(h.food) || { people: [] }).people;
      const people = foodScreens(invitePeople(w.people), h.reply.coming).map(s => {
        const entry = saved.find(e => e.i === s.i);
        const mine = !!entry && sameName(entry.name, s.name);
        return { i: s.i, name: s.name, picks: mine ? entry.picks : [], note: mine ? entry.note : '', answered: mine, savedAs: entry && !mine ? entry.name : null };
      });
      return { token, display: typeof w.display === 'string' ? w.display : '', people };
    });
    return rows.sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()) || (a.token < b.token ? -1 : 1));
  }

  // What to tell the caterer: who has a need, a count per pick, and who is still to be asked.
  function catererList(rows) {
    const all = [];
    (Array.isArray(rows) ? rows : []).forEach(r => (r && Array.isArray(r.people) ? r.people : []).forEach(p => all.push({ display: r.display, p })));
    const needs = all.filter(({ p }) => p.answered && (p.note || p.picks.some(k => k !== 'none')))
      .map(({ display, p }) => ({ name: p.name, display, picks: p.picks, note: p.note, i: p.i }))
      .sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()) || a.i - b.i);
    const counts = PICKS.map(key => ({ key, label: PICK_LABELS[key], n: all.filter(({ p }) => p.answered && p.picks.indexOf(key) >= 0).length })).filter(c => c.n > 0);
    return { needs, counts, coming: all.length, notAnswered: all.filter(({ p }) => !p.answered).length, mismatched: all.filter(({ p }) => p.savedAs !== null).length };
  }

  function catererText(list) {
    const l = list || { needs: [], counts: [], coming: 0, notAnswered: 0, mismatched: 0 };
    const lines = ['Food needs'];
    l.needs.forEach(n => {
      const who = sameName(n.name, n.display) ? n.name : n.name + ' (' + n.display + ')';
      const labels = pickLabels(n.picks), note = n.note ? 'Note: ' + n.note : '';
      lines.push(who + ': ' + [labels, note].filter(Boolean).join('. '));
    });
    if (l.counts.length) lines.push('Totals: ' + l.counts.map(c => c.label + ' ' + c.n).join(', '));
    lines.push(l.notAnswered + ' of ' + l.coming + ' coming have not answered yet');
    if (l.mismatched) lines.push(l.mismatched + ' saved for a name that has since changed: check the dashboard');
    return lines.join('\n');
  }

  const api = { PICKS, PICK_LABELS, foodRows, catererList, catererText, pickLabels, NOTE_MAX, MAX_PEOPLE, cleanFood, foodScreens, namesShown, sameName, togglePick, startDraft,
    foodToSave, mergeDraft, foodStatus, canSaveFood, shouldOfferFood, foodCardLine };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.food = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
