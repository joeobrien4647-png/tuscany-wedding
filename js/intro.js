/* First-visit welcome film (V25: the swallow, the little car to the cinema courtyard, the countdown and the weekend). Include straight after <body>:
     <script src="js/intro.js" data-enabled="false"></script>
   Plays once per browser (localStorage), skippable, muted autoplay. Off unless data-enabled="true";
   ?intro=1 forces it (for previewing and "watch again" links). Never blocks the page: any error closes it.

   One landscape film in two sizes: welcome-v25-1080.mp4 where the film is drawn 1000 CSS px wide or more, and
   welcome-v25-720.mp4 on phones and small screens. It is never cropped (object-fit: contain): on a portrait phone it
   sits letterboxed on the dark film background.

   Personal links: js/invite.js (loaded just before this) owns ?w=<token> and looks up the guest's display and lines
   (window.sjInvite.name, which does not wait for the register form's people). The guest's name is drawn over the
   swallow's post shot, the film's first, in the clear sky to the right of the swallow and above it, from 0.6 s to
   4.0 s while it sings, turns its head to the engine and opens its wings (that sky stays plain to the shot's end at
   4.2 s; docs/v25-overlay.json), in the film's own title type (src/v16/Opening.tsx: Bodoni Moda 600, cream, the
   soft dark shadow, the same margins as the title, set from the right), timed from the film's own frames. Where Skip
   sits over the name's corner (the film filling a 16:9 screen to its top right), the name's right edge moves in to clear it. The
   film waits for the name and its font together (3.5 s at most), so the name is never blank while it shows. With no
   name, or if the lookup fails, nothing is drawn. Each personal link has its own once-only flag (keyed by a hash of the token, never the token), so a guest
   who has seen the film without a name still sees their name once, and so does every other personal link opened in
   the same browser. to is taken out of the address bar and history as soon as it is read, as w is by js/invite.js.
   ?intro=1&to=NAME previews a name: only together with ?intro=1, and only a name-like NAME. */
(function () {
  var me = document.currentScript, args = new URLSearchParams(location.search), invite = window.sjInvite;
  var token = (invite && invite.token) || "", to = args.get("to") || "";
  if (args.has("to") && window.history && history.replaceState) {
    args.delete("to");
    var rest = args.toString();
    try { history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
  }
  var force = args.get("intro") === "1";
  if (!force && !(me && me.getAttribute("data-enabled") === "true")) return;
  if (args.get("preview") === "done") return;

  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) token = "";
  var preview = force ? to.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (!/^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ &,.'’-]*$/.test(preview)) preview = "";

  var KEY = "sj-intro-seen-v1", NAMED_KEY = token ? KEY + "-named-" + hash(token) : "";
  var seenPlain = false, seenNamed = false;
  try { seenPlain = localStorage.getItem(KEY) === "1"; seenNamed = !!NAMED_KEY && localStorage.getItem(NAMED_KEY) === "1"; } catch (e) {}
  if (!force && (token ? seenNamed : seenPlain)) return;
  if (!force && navigator.connection && navigator.connection.saveData) return;
  if (!force && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var NAME_MS = 3500;       // display and lines (a few hundred bytes) and the font; past this the film plays without the name
  var GIVE_UP_MS = 10000;   // from the film's request: no picture by then (and no Play button waiting) and it closes
  var END_HOLD_MS = 500;    // when the film ends, its last frame (the invitation) stays up this long before the fade
  var FILM = { w: 1920, h: 1080, fps: 30 };
  var BIG_PX = 1000;        // drawn this wide (CSS px) or wider: the 1080p film
  // The name, in film px: set from the right at the title's margins (left 96, top 68), no further left than x 1150, so
  // it stays in the sky clear of the swallow's climb out of the frame. It fades in and out on the title's smoothstep.
  var NAME = { right: 96, top: 68, left: 1150, px: 86, lineHeight: 1.08, t0: 0.6, t1: 1.1, t2: 3.5, t3: 4.0 };
  var CLEAR_PX = 10;        // CSS px kept between the Skip button and the name
  var FONT_CSS = "https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@600&display=block";
  var FONT = "'Bodoni Moda',serif";

  var big = Math.min(window.innerWidth, window.innerHeight * FILM.w / FILM.h) >= BIG_PX;
  var SRC = "video/welcome-v25-" + (big ? "1080" : "720") + ".mp4", POSTER = "video/welcome-v25-poster.jpg";
  function hash(s) {
    for (var h = 2166136261, i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }

  var css = document.createElement("style");
  css.textContent =
    "html.sj-intro-open{overflow:hidden}" +
    // top/right/bottom/left rather than inset, which iPhone Safari only reads from iOS 14.5 (an iPhone 6 stops at iOS 12)
    ".sj-intro{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;overflow:hidden;background:#120D0A;outline:none;transition:opacity .9s ease}" +
    ".sj-intro.sj-out{opacity:0;pointer-events:none}" +
    // the poster again as the background, placed as the film is: WebKit can drop the poster attribute once src is set,
    // and then shows the background until the first frame
    ".sj-intro video{width:100%;height:100%;object-fit:contain;display:block;" +
      "background:#120D0A url(" + POSTER + ") 50% 50%/contain no-repeat}" +
    ".sj-film{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}" +
    ".sj-name{position:absolute;text-align:right;visibility:hidden}" +
    ".sj-row{font-family:" + FONT + ";font-weight:600;font-style:normal;line-height:" + NAME.lineHeight + ";white-space:nowrap;" +
      "letter-spacing:normal;text-transform:none;color:#FBF2DE;text-shadow:0 2px 15px rgba(11,27,18,.8)}" +
    ".sj-intro button{font-family:ui-monospace,Consolas,'Roboto Mono',monospace;text-transform:uppercase;letter-spacing:.22em;cursor:pointer}" +
    ".sj-sound{position:absolute;top:max(14px,env(safe-area-inset-top));left:14px;font-size:11px;padding:10px 16px;border-radius:999px;" +
      "border:1px solid rgba(44,44,44,.18);background:rgba(250,246,240,.82);color:#2C2C2C;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".sj-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;font-size:11px;padding:10px 16px;border-radius:999px;" +
      "border:1px solid rgba(44,44,44,.18);background:rgba(250,246,240,.82);color:#2C2C2C;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    // near the foot of the screen, on one line however narrow the screen
    ".sj-play{position:absolute;left:50%;bottom:max(32px,calc(env(safe-area-inset-bottom) + 16px));transform:translateX(-50%);" +
      "white-space:nowrap;font-size:12px;padding:16px 26px;border-radius:999px;border:0;background:#C45C26;color:#fff}";
  document.head.appendChild(css);

  var box = document.createElement("div");
  box.className = "sj-intro";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Welcome video");
  box.tabIndex = -1;
  box.innerHTML =
    '<video muted playsinline autoplay preload="auto" poster="' + POSTER + '"></video>' +
    '<div class="sj-film" aria-hidden="true"><div class="sj-name"></div></div>' +
    '<button class="sj-sound" type="button" aria-pressed="false">Sound on</button>' +
    '<button class="sj-skip" type="button">Skip</button>' +
    '<button class="sj-play" type="button" hidden>Play the welcome</button>';
  document.body.insertBefore(box, document.body.firstChild);
  document.documentElement.classList.add("sj-intro-open");

  var video = box.querySelector("video"), skip = box.querySelector(".sj-skip"), play = box.querySelector(".sj-play");
  var sound = box.querySelector(".sj-sound"), layer = box.querySelector(".sj-film"), nameEl = box.querySelector(".sj-name");
  var closed = false, started = false, named = false, personal = false, guest = null, laidOut = false, nameOn = false;
  var right = null;         // the name's right margin in film px: NAME.right, or more to clear Skip

  sound.onclick = function () {
    video.muted = !video.muted;
    sound.textContent = video.muted ? "Sound on" : "Sound off";
    sound.setAttribute("aria-pressed", String(!video.muted));
    if (video.paused && video.currentSrc) { var p2 = video.play(); if (p2 && p2.catch) p2.catch(function () {}); }
  };

  // Skip, Esc and the film's end count as seen. Giving up on a film that never started (a slow connection, a load
  // error, a refused Play) does not, so the next visit tries again, the guest's name included.
  function close(seen) {
    if (closed) return;
    closed = true;
    if (seen !== false) {
      try { localStorage.setItem(KEY, "1"); if (personal) localStorage.setItem(NAMED_KEY, "1"); } catch (e) {}
    }
    try { video.pause(); } catch (e) {}
    document.documentElement.classList.remove("sj-intro-open");
    box.classList.add("sj-out");
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 950);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", place);
    window.removeEventListener("orientationchange", place);
  }
  function giveUp() { close(started); }
  function onKey(e) { if (e.key === "Escape") close(); }

  skip.onclick = function () { close(); };
  document.addEventListener("keydown", onKey);
  video.addEventListener("ended", function () { setTimeout(close, END_HOLD_MS); });
  video.addEventListener("playing", function () { started = true; play.hidden = true; });
  video.addEventListener("error", giveUp);
  play.onclick = function () { var p = video.play(); if (p && p.catch) p.catch(giveUp); };
  // Focus goes to the dialog itself, which draws no ring, rather than to Skip, which would show one over the film.
  try { box.focus({ preventScroll: true }); } catch (e) {}

  // An iPhone in-app browser that does not allow inline video plays the film in the system's own full-screen
  // player, where nothing can be drawn over it: the film carries on there without the name, and closes with it.
  video.addEventListener("webkitbeginfullscreen", function () { named = false; show(false); });
  video.addEventListener("webkitendfullscreen", close);

  // ---- the name, in film px on a layer placed exactly where the video draws the film

  function place() {
    var cw = video.clientWidth, ch = video.clientHeight;
    if (!cw || !ch) return;
    var s = Math.min(cw / FILM.w, ch / FILM.h);
    var x = video.offsetLeft + (cw - FILM.w * s) / 2, y = video.offsetTop + (ch - FILM.h * s) / 2;
    layer.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
    // where Skip's foot comes below the name's top, the name's right edge moves in past Skip's left side
    var b = skip.getBoundingClientRect(), r = NAME.right;
    if ((b.bottom + CLEAR_PX - y) / s > NAME.top) r = Math.max(r, Math.ceil((x + FILM.w * s - b.left + CLEAR_PX) / s));
    if (r !== right) {
      right = r;
      nameEl.style.right = r + "px";
      nameEl.style.maxWidth = room() + "px";
      laidOut = false;
      render(video.currentTime);
    }
  }
  function room() { return FILM.w - right - NAME.left; }

  // "TOM AND ELLIE" as the film sets its own names ("Sophie & Joe"): capitals to words, "and" in lower case.
  function words(s) {
    return String(s).replace(/\s+/g, " ").trim().replace(/[,.]+$/, "").toLowerCase()
      .replace(/(^|[\s'’-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/(^| )And(?= |$)/g, "$1and");
  }
  function measure(lines) {
    var s = document.createElement("span"), out;
    s.style.cssText = "position:absolute;left:0;top:-10000px;visibility:hidden;white-space:pre;font-family:" + FONT +
      ";font-weight:600;font-size:" + NAME.px + "px";
    document.body.appendChild(s);
    out = lines.map(function (text) { s.textContent = text; return s.getBoundingClientRect().width; });
    document.body.removeChild(s);
    return Math.max.apply(null, out);
  }
  // Two rows where one would not fit at full size: the invitation's own lines (three joined into two, the narrower
  // way), or the words split where the rows come out most even, never ending a row on "and" or "&".
  function twoRows(text, lines) {
    if (lines && lines.length === 2) return lines.map(words);
    if (lines && lines.length === 3) {
      var l = lines.map(words);
      var join = function (x, y) { return text.indexOf(x + ", " + y) >= 0 ? x + ", " + y : x + " " + y; };
      var a = [join(l[0], l[1]), l[2]], b = [l[0], join(l[1], l[2])];
      return measure(a) <= measure(b) ? a : b;
    }
    var w = text.split(" "), best = null;
    for (var i = 1; i < w.length; i++) {
      if (/^(and|&)$/.test(w[i - 1])) continue;
      var split = [w.slice(0, i).join(" "), w.slice(i).join(" ")], width = measure(split);
      if (!best || width < best.width) best = { rows: split, width: width };
    }
    return best ? best.rows : [text];
  }
  function layoutName() {
    laidOut = true;
    var w = room(), text = words(guest.display), list = measure([text]) <= w ? [text] : twoRows(text, guest.lines);
    var size = Math.min(NAME.px, Math.floor(NAME.px * w / measure(list)));
    nameEl.textContent = "";
    list.forEach(function (row) {
      var d = document.createElement("div");
      d.className = "sj-row";
      d.style.fontSize = size + "px";
      d.textContent = row;
      nameEl.appendChild(d);
    });
  }

  function ease(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  // The film's frame on screen at a video time, as its own time (a frame's media time can be a hair under it).
  function frameTime(t) { return Math.floor(t * FILM.fps + 0.01) / FILM.fps; }
  function show(on) { if (on !== nameOn) { nameOn = on; nameEl.style.visibility = on ? "visible" : "hidden"; } }
  function render(time) {
    if (!named) return;
    var t = frameTime(time), o = ease((t - NAME.t0) / (NAME.t1 - NAME.t0)) * ease((NAME.t3 - t) / (NAME.t3 - NAME.t2));
    if (o > 0) {
      if (!laidOut) layoutName();
      nameEl.style.opacity = Math.round(o * 1000) / 1000;
    }
    show(o > 0);
  }

  function follow() {
    if (closed) return;
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(function (now, meta) { render(meta.mediaTime); follow(); });
    } else {
      requestAnimationFrame(function () { render(video.currentTime); follow(); });
    }
  }

  // Bodoni Moda, as in the film, requested as soon as a name is possible. Settles once it has loaded (or failed), and
  // the name is measured again then.
  function loadFont() {
    return new Promise(function (done) {
      var font = document.createElement("link");
      font.rel = "stylesheet";
      font.href = FONT_CSS;
      font.onerror = done;
      font.onload = function () {
        if (!(document.fonts && document.fonts.load)) return done();
        document.fonts.load("600 " + NAME.px + "px 'Bodoni Moda'").then(function () {
          laidOut = false;
          render(video.currentTime);
          done();
        }, done);
      };
      document.head.appendChild(font);
    });
  }

  function start(name) {
    if (closed) return;
    named = !!(name && name.display);
    if (named) {
      guest = name;
      layer.style.width = FILM.w + "px";
      layer.style.height = FILM.h + "px";
      nameEl.style.top = NAME.top + "px";
      place();
      if (window.ResizeObserver) new ResizeObserver(place).observe(video);
      window.addEventListener("resize", place);
      window.addEventListener("orientationchange", place);
      video.addEventListener("seeked", function () { render(video.currentTime); });
      follow();
    }
    video.src = SRC;
    var p = video.play();
    if (p && p.catch) p.catch(function () { if (!closed) play.hidden = false; });
    // a film that will not load: don't hold the page hostage (the name lookup's wait does not count against it)
    setTimeout(function () { if (!started && play.hidden) giveUp(); }, GIVE_UP_MS);
  }

  // display and lines as the invitation has them; anything else is dropped rather than trusted.
  function readNode(display, lines) {
    if (typeof display !== "string" || !display.trim()) return null;
    var ok = Array.isArray(lines) && lines.length >= 1 && lines.length <= 3 &&
      lines.every(function (l) { return typeof l === "string" && l.trim(); });
    return { display: display.slice(0, 80), lines: ok ? lines : null };
  }

  var previewName = preview ? { display: preview, lines: null } : null;
  if (token || preview) {
    var budget = new Promise(function (r) { setTimeout(r, NAME_MS, null); }), font = loadFont();
    Promise.race([token ? invite.name || invite : null, budget]).then(function (v) {
      var node = v && readNode(v.display, v.lines);
      personal = !!node;
      var name = node || previewName;
      // a failed personal link plays the film without a name, unless this browser has already seen it
      if (!name && token && seenPlain && !force) return close();
      if (!name) return start(null);
      // the name is up from 1.0 s, and display=block would leave it blank until a late font came: wait for the font
      // too, within the same budget
      Promise.race([font, budget]).then(function () { start(name); });
    });
  } else {
    start(null);
  }
})();
