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
    let picks = isObject(p.picks) ? PICKS.filter(k => has(p.picks, k) && p.picks[k] === true) : [];
    if (picks.length > 1) picks = picks.filter(k => k !== 'none');   // a need beats "nothing"
    const note = typeof p.note === 'string' && p.note.length <= NOTE_MAX ? p.note : '';
    return picks.length || note ? { i, name: p.name, picks, note } : null;
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
      const note = String(d.note || '').trim().slice(0, NOTE_MAX), picks = inPicksOrder(d.picks || []);
      if (!picks.length && !note) return;
      const person = { name: d.name };
      if (picks.length) person.picks = picks.reduce((o, k) => { o[k] = true; return o; }, {});
      if (note) person.note = note;
      people[d.i] = person;
      any = true;
    });
    return any ? { people } : {};
  }

  const replyOf = household => (household && household.reply) || null;
  const saidYes = household => !!replyOf(household) && replyOf(household).answer === 'yes';
  function foodStatus(household, people) {
    const coming = saidYes(household) && Array.isArray(household.reply.coming) ? household.reply.coming : [];
    const food = household && household.food, saved = food && Array.isArray(food.people) ? food.people : [];
    const entries = saved.filter(e => coming[e.i] === true && typeof (people || [])[e.i] === 'string' && sameName(e.name, people[e.i]));
    return { coming: coming.filter(c => c === true).length, given: entries.length, entries };
  }
  const canSaveFood = (household, nowMs) => saidYes(household) && core.repliesOpen(nowMs);
  function shouldOfferFood(household, people, nowMs) {
    if (!canSaveFood(household, nowMs)) return false;
    const s = foodStatus(household, people);
    return s.given < s.coming;
  }

  const api = { PICKS, NOTE_MAX, MAX_PEOPLE, cleanFood, foodScreens, namesShown, sameName, togglePick, startDraft,
    foodToSave, foodStatus, canSaveFood, shouldOfferFood };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.food = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
