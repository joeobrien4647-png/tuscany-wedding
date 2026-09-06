/* Reveal switch. Pages including this script stay hidden until /public/config/revealed is true,
   or the viewer is a signed-in admin (listed under /admins). Fails closed. */
(function () {
  var CFG = {
    apiKey: "AIzaSyAbEpCIPFFqiuElH0DK1dkkl7JBbNyZTc8",
    databaseURL: "https://tuscany-wedding-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tuscany-wedding"
  };
  if (!window.firebase) return curtain();
  if (!firebase.apps.length) firebase.initializeApp(CFG);

  var db = firebase.database();
  var shown = false;

  function show() {
    if (shown) return;
    shown = true;
    var gate = document.getElementById("reveal-gate-style");
    if (gate) gate.parentNode.removeChild(gate);
  }

  function curtain() {
    if (shown) return;
    document.documentElement.style.visibility = "visible";
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'background:#FAF6F0;font-family:Lato,\'Segoe UI\',sans-serif;text-align:center;padding:24px">' +
      '<div style="max-width:440px">' +
      '<div style="font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.3em;' +
      'text-transform:uppercase;color:#C45C26;margin-bottom:18px">Sophie &amp; Joe &middot; Tuscany 2027</div>' +
      '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:44px;color:#2C2C2C;line-height:1.1;margin-bottom:16px">Not yet.</div>' +
      '<p style="color:#6B6460;font-weight:300;line-height:1.7;margin:0 0 26px">This part of the site is being kept back until nearer the time. ' +
      'For now, the one thing to do is register.</p>' +
      '<a href="index.html" style="display:inline-block;background:#C45C26;color:#fff;text-decoration:none;' +
      'padding:14px 28px;border-radius:999px;font-size:13px;letter-spacing:.06em;font-weight:700">Register &rarr;</a>' +
      '</div></div>';
    var gate = document.getElementById("reveal-gate-style");
    if (gate) gate.parentNode.removeChild(gate);
  }

  var decided = false;
  function decide(revealed) {
    if (decided) return;
    if (revealed) { decided = true; return show(); }
    // not revealed: allow signed-in admins through, everyone else sees the curtain
    firebase.auth().onAuthStateChanged(function (u) {
      if (decided) return;
      if (!u) { decided = true; return curtain(); }
      db.ref("admins/" + u.uid).once("value").then(function (s) {
        decided = true;
        s.exists() ? show() : curtain();
      }).catch(function () { decided = true; curtain(); });
    });
  }

  db.ref("public/config/revealed").once("value")
    .then(function (s) { decide(s.val() === true); })
    .catch(function () { decide(false); });

  // Safety net: if Firebase never answers, fail closed rather than flashing content.
  setTimeout(function () { if (!decided) { decided = true; curtain(); } }, 6000);
})();
