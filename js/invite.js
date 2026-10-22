/* Personal invitation links (https://sophieandjoe2027.com/?w=<token>), ported from the launch branch.
   Load on index.html in <head>, without defer, so js/intro.js and js/storybook.js both find window.sjInvite.
   This script owns w. It reads it, takes it out of the address bar and history at once (so a copied or shared URL
   carries no token), and keeps it in sessionStorage for this tab only (never localStorage, never logged), so a reload
   or a trip back to this page still knows the invitation. It reads the invitation's small fields from
   welcome/<token> over REST, once (display and lines, plus people), and hands the result on:
     window.sjInvite         a promise of { token, display, lines, people } or null (no link, a token that is not an
                             invitation, or no answer in time); it never rejects
     window.sjInvite.token   the token straight away ("" if none), before the lookup has answered
     window.sjInvite.name    a promise of { token, display, lines } or null as soon as display and lines have answered,
                             for js/intro.js: a slow people never costs the film its name
     "sj:invite"             an event on window when the lookup finds an invitation, with the same object as detail
   Each opening of a personal link (w in the address, not a reload) is recorded at welcomeSeen/<token>, fire and
   forget, once the page is visible: { <20-character key>: server time, ..., last: { at: server time, key } }. The
   rules take one new key a minute per link, and only the key named in last, so a forwarded link cannot flood it.
   Never recorded with &test=1, with ?preview=done, from an automated browser, or in a browser where an admin has
   opened dashboard.html (it sets localStorage sj-admin).
   Testing only: ?wtest=1 on a local or home-network server reads .local-test/welcome/<token>/<field>.json and sends
   the record to .local-test/welcomeSeen/<token>.json instead. .local-test is git-ignored. */
(function () {
  var DB = "https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app";
  var KEY = "sj-invite", TOKEN = /^[A-Za-z0-9_-]{16,64}$/, WAIT_MS = 15000;
  var args = new URLSearchParams(location.search), fromLink = args.has("w"), token = args.get("w") || "";
  if (fromLink) {
    args.delete("w");
    var rest = args.toString();
    try { history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
  } else {
    try { token = sessionStorage.getItem(KEY) || ""; } catch (e) {}
  }
  if (!TOKEN.test(token)) token = "";
  function keep(t) { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) {} }
  keep(token);

  var local = /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/
    .test(location.hostname) && args.get("wtest") === "1";
  var base = local ? ".local-test/" : DB + "/";
  var OPTS = { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" };

  // One field of the node: its value (null when the database has none), or undefined when there was no clear answer.
  // A refused or failed lookup stays silent: the page simply carries on without the names.
  function get(field) {
    return new Promise(function (resolve) {
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { resolve(undefined); if (ctl) ctl.abort(); }, WAIT_MS);
      function done(v) { clearTimeout(timer); resolve(v); }
      fetch(base + "welcome/" + token + "/" + field + ".json", Object.assign({ signal: ctl ? ctl.signal : undefined }, OPTS))
        .then(function (r) { return r.ok ? r.json() : undefined; })
        .then(done, function () { done(undefined); });
    });
  }
  function names(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(function (n) { return typeof n === "string" && n.trim(); })
      .map(function (n) { return n.replace(/\s+/g, " ").trim().slice(0, 80); }).slice(0, 8);
  }

  var fields = token ? ["display", "lines", "people"].map(get) : [];
  var name = !token ? Promise.resolve(null) : Promise.all(fields.slice(0, 2)).then(function (v) {
    if (typeof v[0] !== "string" || !v[0].trim()) {
      if (v[0] === null) keep("");   // the database says there is no such invitation; a timeout keeps it for a reload
      return null;
    }
    return { token: token, display: v[0].trim().slice(0, 80), lines: Array.isArray(v[1]) ? v[1] : null };
  }, function () { return null; });
  var found = !token ? Promise.resolve(null) : Promise.all([name, fields[2]]).then(function (v) {
    if (!v[0]) return null;
    var invite = { token: token, display: v[0].display, lines: v[0].lines, people: names(v[1]) };
    try { window.dispatchEvent(new CustomEvent("sj:invite", { detail: invite })); } catch (e) {}
    return invite;
  }, function () { return null; });
  found.token = token;
  found.name = name;
  window.sjInvite = found;

  // A key shaped like the database's own push keys: 8 characters of time, so they sort by time, then 12 random ones.
  var PUSH = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
  function pushKey() {
    var k = "", t = Date.now(), i, r = new Uint8Array(12);
    for (i = 0; i < 8; i++) { k = PUSH.charAt(t % 64) + k; t = Math.floor(t / 64); }
    try { crypto.getRandomValues(r); } catch (e) { for (i = 0; i < 12; i++) r[i] = Math.floor(Math.random() * 64); }
    for (i = 0; i < 12; i++) k += PUSH.charAt(r[i] % 64);
    return k;
  }
  function adminBrowser() { try { return localStorage.getItem("sj-admin") === "1"; } catch (e) { return false; } }
  function record() {
    found.then(function (invite) {
      if (!invite) return;
      var key = pushKey(), at = { ".sv": "timestamp" }, body = { last: { at: at, key: key } };
      body[key] = at;
      fetch(base + "welcomeSeen/" + token + ".json", Object.assign({ method: "PATCH", body: JSON.stringify(body) }, OPTS))
        .catch(function () {});
    });
  }
  function whenVisible(fn) {
    if (document.visibilityState === "visible") return fn();
    document.addEventListener("visibilitychange", function on() {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", on);
      fn();
    });
  }
  if (token && fromLink && args.get("test") !== "1" && args.get("preview") !== "done" && !navigator.webdriver && !adminBrowser()) {
    whenVisible(record);
  }
})();
