(function (root) {
  'use strict';
  // The Weekend card's rules, with no screen in them: what each of the four days shows. A day's picture is named by its
  // position (fri, sat, sun, mon). A line that is missing, empty or not text is left out, never shown empty.
  const KEYS = ['fri', 'sat', 'sun', 'mon'];
  const ROW_KINDS = ['wear', 'food', 'where'];
  const MAX_PARTS = 3;

  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = v => (typeof v === 'string' ? v.trim() : '');
  const textList = v => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

  function partsOf(day) {
    return (Array.isArray(day.parts) ? day.parts : [])
      .filter(isObject)
      .map(p => ({ when: text(p.when), what: text(p.what) }))
      .filter(p => p.when && p.what)
      .slice(0, MAX_PARTS);
  }

  function rowsOf(day, labels) {
    return ROW_KINDS
      .map(kind => ({ kind, label: text(labels[kind]), text: text(day[kind]), tags: kind === 'wear' ? textList(day.bring) : [] }))
      .filter(r => r.text);
  }

  function weekendView(w) {
    const wk = isObject(w) && isObject(w.weekend) ? w.weekend : {};
    const labels = isObject(wk.labels) ? wk.labels : {};
    const days = Array.isArray(wk.days) ? wk.days : [];
    return {
      title: text(wk.title), vibe: text(wk.vibe), hint: text(wk.hint), swipe: text(wk.swipe), back: text(wk.back),
      days: KEYS.map((key, i) => {
        const d = isObject(days[i]) ? days[i] : {};
        return { key, img: key, date: text(d.date), name: text(d.name), intro: text(d.intro), parts: partsOf(d), rows: rowsOf(d, labels) };
      })
    };
  }

  const api = { weekendView };
  root.sjFirst = Object.assign(root.sjFirst || {}, { weekendCard: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
