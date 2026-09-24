/* First-visit welcome video. Include straight after <body>:
     <script src="js/intro.js" data-enabled="false"></script>
   Plays once per browser (localStorage), skippable, muted autoplay. Off unless data-enabled="true";
   ?intro=1 forces it (for previewing and "watch again" links). Never blocks the page: any error closes it. */
(function () {
  var me = document.currentScript, q = location.search;
  var force = /[?&]intro=1/.test(q);
  if (!force && !(me && me.getAttribute("data-enabled") === "true")) return;
  if (/[?&]preview=done/.test(q)) return;

  var KEY = "sj-intro-seen-v1";
  try { if (!force && localStorage.getItem(KEY) === "1") return; } catch (e) {}
  if (!force && navigator.connection && navigator.connection.saveData) return;
  if (!force && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var base = "video/welcome-" + (window.innerHeight > window.innerWidth ? "portrait" : "landscape");
  var css = document.createElement("style");
  css.textContent =
    "html.sj-intro-open{overflow:hidden}" +
    ".sj-intro{position:fixed;inset:0;z-index:9999;background:#FAF6F0;transition:opacity .9s ease}" +
    ".sj-intro.sj-out{opacity:0;pointer-events:none}" +
    ".sj-intro video{width:100%;height:100%;object-fit:cover;display:block;background:#FAF6F0}" +
    ".sj-intro button{font-family:ui-monospace,Consolas,'Roboto Mono',monospace;text-transform:uppercase;letter-spacing:.22em;cursor:pointer}" +
    ".sj-sound{position:absolute;top:max(14px,env(safe-area-inset-top));left:14px;font-size:11px;padding:10px 16px;border-radius:999px;" +
      "border:1px solid rgba(44,44,44,.18);background:rgba(250,246,240,.82);color:#2C2C2C;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".sj-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;font-size:11px;padding:10px 16px;border-radius:999px;" +
      "border:1px solid rgba(44,44,44,.18);background:rgba(250,246,240,.82);color:#2C2C2C;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".sj-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;padding:16px 26px;border-radius:999px;border:0;background:#C45C26;color:#fff}";
  document.head.appendChild(css);

  var box = document.createElement("div");
  box.className = "sj-intro";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Welcome video");
  box.innerHTML =
    '<video muted playsinline autoplay preload="auto" poster="' + base + '-poster.jpg">' +
      '<source src="' + base + '.mp4" type="video/mp4"></video>' +
    '<button class="sj-sound" type="button" aria-pressed="false">Sound on</button>' +
    '<button class="sj-skip" type="button">Skip</button>' +
    '<button class="sj-play" type="button" hidden>Play the welcome</button>';
  document.body.insertBefore(box, document.body.firstChild);
  document.documentElement.classList.add("sj-intro-open");

  var video = box.querySelector("video"), skip = box.querySelector(".sj-skip"), play = box.querySelector(".sj-play");
  var sound = box.querySelector(".sj-sound");
  sound.onclick = function () {
    video.muted = !video.muted;
    sound.textContent = video.muted ? "Sound on" : "Sound off";
    sound.setAttribute("aria-pressed", String(!video.muted));
    if (video.paused) { var p2 = video.play(); if (p2 && p2.catch) p2.catch(function () {}); }
  };
  var closed = false, started = false;

  function close() {
    if (closed) return;
    closed = true;
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    try { video.pause(); } catch (e) {}
    document.documentElement.classList.remove("sj-intro-open");
    box.classList.add("sj-out");
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 950);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  skip.onclick = close;
  document.addEventListener("keydown", onKey);
  video.addEventListener("ended", close);
  video.addEventListener("playing", function () { started = true; play.hidden = true; });
  video.querySelector("source").addEventListener("error", close);
  video.addEventListener("error", close);
  play.onclick = function () { var p = video.play(); if (p && p.catch) p.catch(close); };

  var p = video.play();
  if (p && p.catch) p.catch(function () { if (!closed) play.hidden = false; });
  // slow connection or blocked autoplay with no tap: don't hold the page hostage
  setTimeout(function () { if (!started && play.hidden) close(); }, 10000);
  skip.focus();
})();
