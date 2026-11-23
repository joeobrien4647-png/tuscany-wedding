(function (root) {
  'use strict';
  // Apple's catalogue (the iTunes Search API): search by song or artist, and look songs up by id. Nothing of ours goes
  // with a request: no cookies, no referrer (the page address holds the invitation token), and the URL carries only
  // the search term or the song ids. Answers are kept for the life of the page and a repeated search is answered from
  // memory, because Apple allows about 20 calls a minute.
  //   search(term) resolves Found[] ([] under 2 characters), or undefined when Apple gave no clear answer.
  //   lookup(ids)  resolves { <id>: Found } for the songs Apple returned; a chunk that failed is simply missing.
  const WAIT_MS = 15000;
  const OPTS = { credentials: 'omit', referrerPolicy: 'no-referrer' };
  const searches = {}, known = {};

  // songs-core.js loads first on the page; under Node tests it is required here.
  function rules() {
    return (root.sjFirst && root.sjFirst.songs) || (typeof require === 'function' ? require('./songs-core.js') : null);
  }
  // fetch with a timeout, as store.js does. Resolves the parsed body, or undefined for no clear answer.
  function getJson(url) {
    return new Promise(function (resolve) {
      let ctl = null;
      try { ctl = typeof AbortController === 'function' ? new AbortController() : null; } catch (e) {}
      const timer = setTimeout(function () { resolve(undefined); if (ctl) ctl.abort(); }, WAIT_MS);
      const done = v => { clearTimeout(timer); resolve(v); };
      try {
        fetch(url, Object.assign({ signal: ctl ? ctl.signal : undefined }, OPTS))
          .then(r => (r && r.ok ? r.json() : undefined)).then(done, () => done(undefined));
      } catch (e) { done(undefined); }
    });
  }
  const remember = found => { found.forEach(f => { known[f.id] = f; }); return found; };

  function search(term) {
    const r = rules(), url = r ? r.searchUrl(term) : null;
    if (!url) return Promise.resolve(r ? [] : undefined);
    const key = r.searchKey(term);
    if (!searches[key]) {
      searches[key] = getJson(url).then(body => {
        if (body === undefined) { delete searches[key]; return undefined; }
        return remember(r.fromAppleBody(body));
      });
    }
    return searches[key].then(found => (found ? found.slice() : undefined));
  }

  function lookup(ids) {
    const r = rules(), out = {}, need = [];
    if (!r) return Promise.resolve(out);
    (Array.isArray(ids) ? ids : []).forEach(id => {
      if (typeof id !== 'string' || !r.ID.test(id)) return;
      if (known[id]) out[id] = known[id];
      else if (need.indexOf(id) < 0) need.push(id);
    });
    return Promise.all(r.lookupUrls(need).map(url => getJson(url).then(body => { if (body !== undefined) remember(r.fromAppleBody(body)); })))
      .then(() => { need.forEach(id => { if (known[id]) out[id] = known[id]; }); return out; });
  }

  const api = { search, lookup };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.apple = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
