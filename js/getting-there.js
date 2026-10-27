/* The getting-there planner (getting-there.html). Reads data/getting-there.json (every fact cited in
   data/getting-there-sources.md) and data/getting-there-map.json (Natural Earth, public domain).
   The map uses the welcome film's projection, d3.geoConicConformal().parallels([42, 45]).rotate([-11.6, 0]),
   with its maths written out below, so there is no library. Tap an airport: a dotted gold flight arc comes in
   from the UK side, then the film's line-drawn Fiat 500 (tuscany-welcome-video src/scenes/s02/Fiat500.tsx)
   drives the real route to La Conca with the line drawing behind it. With reduced motion the route just appears.
   Times are local Italian time; every drive figure stops at the estate gate. */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var RAD = Math.PI / 180;
  var CODES = ["PEG", "FLR", "BLQ", "PSA", "CIA", "FCO"];
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function listWords(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  // ---- times: minutes after midnight on the landing day ----
  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function clock(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function round5(min) { return Math.round(min / 5) * 5; }
  function dur(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + " min";
    return h + " hr" + (m ? " " + m + " min" : "");
  }

  // ---- the film's projection: Lambert conformal conic, standard parallels 42 and 45 N, centred on 11.6 E ----
  var PAR0 = 42 * RAD, PAR1 = 45 * RAD;
  function tany(phi) { return Math.tan((Math.PI / 2 + phi) / 2); }
  var CN = Math.log(Math.cos(PAR0) / Math.cos(PAR1)) / Math.log(tany(PAR1) / tany(PAR0));
  var CF = Math.cos(PAR0) * Math.pow(tany(PAR0), CN) / CN;
  function conic(lon, lat) {
    var lam = (lon - 11.6) * RAD, r = CF / Math.pow(tany(lat * RAD), CN);
    return [r * Math.sin(CN * lam), r * Math.cos(CN * lam) - CF];   // y grows southwards, as on screen
  }

  // The view: Pisa to the Adriatic, Bologna to Rome, fitted to a box 360 units wide.
  var VIEW = { lon0: 9.75, lon1: 13.45, lat0: 41.5, lat1: 44.85, w: 360 };
  var FIT = (function () {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (var i = 0; i <= 16; i++) {
      var lon = VIEW.lon0 + (VIEW.lon1 - VIEW.lon0) * i / 16;
      [VIEW.lat0, VIEW.lat1].forEach(function (lat) {
        var p = conic(lon, lat);
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      });
    }
    var k = VIEW.w / (x1 - x0);
    return { x0: x0, y0: y0, k: k, h: Math.round((y1 - y0) * k) };
  })();
  var W = VIEW.w, H = FIT.h;
  function project(lon, lat) {
    var p = conic(lon, lat);
    return [(p[0] - FIT.x0) * FIT.k, (p[1] - FIT.y0) * FIT.k];
  }
  function ringsPath(polys) {
    var d = "";
    polys.forEach(function (poly) {
      poly.forEach(function (ring) {
        ring.forEach(function (c, i) {
          var p = project(c[0], c[1]);
          d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
        });
        d += "Z";
      });
    });
    return d;
  }

  // ---- polylines in map units, with lengths along them ----
  function track(latlons, proj) {
    var pts = latlons.map(function (ll) { return proj(ll[1], ll[0]); });
    var cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts: pts, cum: cum, total: cum[cum.length - 1] };
  }
  function pointAt(t, s) {
    s = Math.max(0, Math.min(t.total, s));
    var lo = 0, hi = t.cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (t.cum[mid] <= s) lo = mid; else hi = mid; }
    var seg = t.cum[hi] - t.cum[lo] || 1, u = (s - t.cum[lo]) / seg;
    return [t.pts[lo][0] + (t.pts[hi][0] - t.pts[lo][0]) * u, t.pts[lo][1] + (t.pts[hi][1] - t.pts[lo][1]) * u];
  }
  function lineD(pts) {
    return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2); }).join("");
  }

  // ---- the Fiat 500, from the welcome film: side view facing right, ground point between the wheels ----
  var FIAT_LENGTH = 44;
  var CAR_BODY = "M -20.5 -5 C -22 -5 -22.6 -7.6 -22.2 -10.4 C -21.7 -13.6 -19.2 -15.6 -15.2 -15.9 " +
    "C -13.2 -21.4 -9.2 -23.6 -3 -23.6 C 3 -23.6 7 -21.6 9.6 -16 L 17.8 -14.3 " +
    "C 21.4 -13.6 22.6 -11.2 22.4 -8.6 C 22.3 -6.2 21.6 -5 20 -5 L 19.3 -5 " +
    "A 6.3 6.3 0 0 0 6.7 -5 L -6.7 -5 A 6.3 6.3 0 0 0 -19.3 -5 Z";
  var CAR_WINDOW = "M -12.9 -16.2 C -11.8 -18 -10.4 -18.7 -8.4 -18.7 L 3.2 -18.7 C 5 -18.7 6.4 -17.6 7.6 -16.2 Z";
  var carSeq = 0;
  function drawCar(parent, line) {
    var id = "gt-car-clip-" + (++carSeq);
    var g = el("g", { "class": "gt-car" }, parent);
    var defs = el("defs", {}, g);
    el("path", { d: CAR_BODY }, el("clipPath", { id: id }, defs));
    el("path", { d: CAR_BODY, "class": "gt-car-body" }, g);
    el("rect", { x: -24, y: -26, width: 48, height: 6.6, "class": "gt-car-stripe", "clip-path": "url(#" + id + ")" }, g);
    el("path", { d: CAR_WINDOW, "class": "gt-car-glass", "stroke-width": line * 0.7 }, g);
    el("line", { x1: -2, y1: -18.7, x2: -2, y2: -16.2, "class": "gt-car-line", "stroke-width": line * 0.7 }, g);
    el("path", { d: CAR_BODY, "class": "gt-car-line", "stroke-width": line }, g);
    el("circle", { cx: 19, cy: -10.4, r: 2, "class": "gt-car-wheel", "stroke-width": line * 0.7 }, g);
    [-13, 13].forEach(function (cx) {
      el("circle", { cx: cx, cy: -4.6, r: 4.6, "class": "gt-car-wheel", "stroke-width": line }, g);
      el("circle", { cx: cx, cy: -4.6, r: 1.3, "class": "gt-car-hub" }, g);
    });
    return g;
  }
  function carIcon() {
    var svg = el("svg", { viewBox: "-24 -27 48 29", "aria-hidden": "true", focusable: "false" });
    drawCar(svg, 2.2);
    return svg;
  }

  // ---- state ----
  var DATA = null, BY = {}, ORIGIN = "", CURRENT = null, ANIM = 0, PENDING = null, SAY = 0;
  var map = {}, mapReady = false; // svg layers and per-airport pieces
  var CAR_LEN = 28;       // map units (the map is 360 wide); 34 on phones
  var PIN_R = 7.5;        // the pin's gold ring
  var RING_R = 6.5;

  // ---- the big map ----
  function buildMap(shapes) {
    var svg = $("gt-svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    el("rect", { x: 0, y: 0, width: W, height: H, "class": "gt-sea" }, svg);
    var land = el("g", {}, svg);
    shapes.features.forEach(function (f) {
      var polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      var d = ringsPath(polys);
      if (f.properties.role === "italy") {
        el("path", { d: d, "class": "gt-land", "fill-rule": "evenodd" }, land);
        map.coast = d;
      } else {
        el("path", { d: d, "class": "gt-neigh", "fill-rule": "evenodd" }, land);
      }
    });
    if (map.coast) el("path", { d: map.coast, "class": "gt-coast" }, svg);

    // names: regions as in the film, the two seas, and Arezzo for the train notes
    var names = el("g", { "aria-hidden": "true" }, svg);
    var t = project(11.0, 43.12), u = project(12.78, 42.9);
    el("text", { x: t[0], y: t[1], "class": "gt-region gt-region--t" }, names).textContent = "TUSCANY";
    el("text", { x: u[0], y: u[1], "class": "gt-region gt-region--u" }, names).textContent = "UMBRIA";
    var ty = project(10.55, 41.85), ad = project(12.95, 44.5);
    el("text", { x: ty[0], y: ty[1], "class": "gt-seaname" }, names).textContent = "Tyrrhenian Sea";
    el("text", { x: ad[0], y: ad[1], "class": "gt-seaname" }, names).textContent = "Adriatic Sea";
    (DATA.map.labels || []).forEach(function (lab) {
      if (lab.name === "Arezzo") {
        var p = project(lab.lon, lab.lat);
        el("circle", { cx: p[0], cy: p[1], r: 1.8, "class": "gt-town-dot" }, names);
        el("text", { x: p[0] - 4, y: p[1] + 11, "class": "gt-town gt-halo", "text-anchor": "end" }, names).textContent = lab.name;
      }
    });

    // where the flight arcs come in from
    var uk = el("g", { "class": "gt-uk", "aria-hidden": "true" }, svg);
    el("path", { d: "M17 17 L9 9 M9 9 L9 15 M9 9 L15 9" }, uk);
    el("text", { x: 20, y: 25 }, uk).textContent = "FROM THE UK";

    map.arc = el("path", { "class": "gt-arc", d: "" }, svg);
    map.route = el("path", { "class": "gt-route", d: "" }, svg);
    map.apts = el("g", {}, svg);
    map.carLayer = el("g", {}, svg);
    map.pinLayer = el("g", {}, svg);
    map.labels = el("g", {}, svg);
    map.hits = el("g", {}, svg);

    var pin = project(DATA.venue.satnav.lon, DATA.venue.satnav.lat);
    map.pin = pin;
    var pg = el("g", { transform: "translate(" + pin[0].toFixed(2) + " " + pin[1].toFixed(2) + ")" }, map.pinLayer);
    el("circle", { r: PIN_R, "class": "gt-pin-pulse" }, pg);
    el("circle", { r: PIN_R, "class": "gt-pin-ring" }, pg);
    el("circle", { r: 3.8, "class": "gt-pin-dot" }, pg);
    el("text", { x: pin[0] + 12, y: pin[1] - 7, "class": "gt-pin-label gt-halo" }, map.labels).textContent = "La Conca";

    // label offsets: [dx, dy, anchor], placed clear of each airport's own route
    var LABEL = { PEG: [10, 4, "start"], FLR: [-9, -7, "end"], BLQ: [-10, 4, "end"], PSA: [0, -11, "middle"],
                  CIA: [22, 21, "middle"], FCO: [-10, 3, "end"] };
    DATA.airports.forEach(function (a) {
      var p = project(a.terminal.lon, a.terminal.lat);
      var g = el("g", { "class": "gt-apt", "data-code": a.code }, map.apts);
      el("circle", { cx: p[0], cy: p[1], r: RING_R, "class": "gt-ring" }, g);
      el("circle", { cx: p[0], cy: p[1], r: 2.4, "class": "gt-ring-dot" }, g);
      var lo = LABEL[a.code] || [10, 4, "start"];
      var lg = el("g", { "class": "gt-apt", "data-code": a.code }, map.labels);
      el("text", { x: p[0] + lo[0], y: p[1] + lo[1], "text-anchor": lo[2], "class": "gt-alabel gt-halo" }, lg).textContent = a.shortName;
      var hr = hitArea(a);
      var hit = el("circle", { cx: hr.x.toFixed(1), cy: hr.y.toFixed(1), r: hr.r.toFixed(1), "class": "gt-hit", "data-code": a.code }, map.hits);
      hit.addEventListener("click", function () { choose(a.code, true); });
      var tr = track(a.drive.polyline, project);
      tr.faceLeft = tr.pts[tr.pts.length - 1][0] < tr.pts[0][0];
      BY[a.code].track = tr;
      BY[a.code].at = p;
      BY[a.code].ring = g;
      BY[a.code].label = lg;
    });
    map.uk = project(-1.5, 52.5);   // "the UK side": the arcs come in on the bearing to the Midlands
    var shown = svg.getBoundingClientRect().width;
    if (shown && shown < 420) CAR_LEN = 34;   // on a phone the Fiat would be about 22 px long; a little bigger reads as a Fiat
    map.car = drawCar(map.carLayer, 1.5 * FIAT_LENGTH / CAR_LEN);
    map.car.setAttribute("opacity", "0");
    $("gt-loading").hidden = true;
  }

  // Tap targets of up to 28 map units (about 44 px even on a 320 px phone). Where two airports sit close (the two Rome
  // ones), each target slides away from its neighbour so it can stay big without overlapping, still covering its ring.
  function hitArea(a) {
    var p = project(a.terminal.lon, a.terminal.lat), near = Infinity, q = p;
    DATA.airports.forEach(function (b) {
      if (b === a) return;
      var o = project(b.terminal.lon, b.terminal.lat), d = Math.hypot(o[0] - p[0], o[1] - p[1]);
      if (d < near) { near = d; q = o; }
    });
    var half = near / 2 - 1;
    if (half >= 28) return { x: p[0], y: p[1], r: 28 };
    var shift = Math.min(28 - half, 28 - RING_R - 2), ux = (p[0] - q[0]) / near, uy = (p[1] - q[1]) / near;
    return { x: p[0] + ux * shift, y: p[1] + uy * shift, r: half + shift };
  }

  // ---- the flight arc: a quadratic from the map's edge on the bearing to the UK, bowed a little ----
  function arcFor(code) {
    var a = BY[code].at, dx = map.uk[0] - a[0], dy = map.uk[1] - a[1], L = Math.hypot(dx, dy);
    dx /= L; dy /= L;
    var m = 14, ts = [];
    if (dx < 0) ts.push((-m - a[0]) / dx); if (dx > 0) ts.push((W + m - a[0]) / dx);
    if (dy < 0) ts.push((-m - a[1]) / dy); if (dy > 0) ts.push((H + m - a[1]) / dy);
    var t = Math.min.apply(null, ts);
    var e = [a[0] + dx * t, a[1] + dy * t];
    var len = t, nx = -dy, ny = dx;
    if (ny > 0) { nx = -nx; ny = -ny; }           // bow towards the top of the map
    var c = [(e[0] + a[0]) / 2 + nx * len * 0.16, (e[1] + a[1]) / 2 + ny * len * 0.16];
    return [e, c, a];
  }
  function quadPart(q, u) {   // the first u (0 to 1) of a quadratic, by de Casteljau
    var p01 = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
    var p12 = [q[1][0] + (q[2][0] - q[1][0]) * u, q[1][1] + (q[2][1] - q[1][1]) * u];
    var end = [p01[0] + (p12[0] - p01[0]) * u, p01[1] + (p12[1] - p01[1]) * u];
    return "M" + q[0][0].toFixed(2) + " " + q[0][1].toFixed(2) + "Q" + p01[0].toFixed(2) + " " + p01[1].toFixed(2) + " " + end[0].toFixed(2) + " " + end[1].toFixed(2);
  }

  // ---- the car on the route: faces the way the route runs overall, tilts with the road (at most 12 degrees) ----
  // The road's angle is read over a car's length each side, so bends don't rock it. A side-on car can't climb a road
  // that runs straight up the map, so past 35 degrees the lean eases back towards 6 instead of sitting on the cap.
  function carPose(tr, s) {
    var p = pointAt(tr, s);
    var a = pointAt(tr, s - CAR_LEN), b = pointAt(tr, s + CAR_LEN);
    var travel = Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
    var road = ((((tr.faceLeft ? travel - 180 : travel) + 180) % 360) + 360) % 360 - 180;
    var mag = Math.abs(road), lean = mag <= 35 ? Math.min(12, mag) : 12 - 6 * Math.min(1, (mag - 35) / 55);
    return { x: p[0], y: p[1], tilt: road < 0 ? -lean : lean, faceLeft: tr.faceLeft };
  }
  function placeCar(pose, hop, opacity) {
    var k = CAR_LEN / FIAT_LENGTH;
    map.car.setAttribute("transform", "translate(" + pose.x.toFixed(2) + " " + (pose.y - (hop || 0)).toFixed(2) + ") rotate(" +
      pose.tilt.toFixed(2) + ") scale(" + (pose.faceLeft ? -k : k) + " " + k + ")");
    map.car.setAttribute("opacity", String(opacity));
  }
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function clamp01(u) { return Math.max(0, Math.min(1, u)); }

  function animate(code) {
    cancelAnimationFrame(ANIM);
    var tr = BY[code].track, q = arcFor(code);
    map.route.setAttribute("d", lineD(tr.pts));
    map.route.style.strokeDasharray = tr.total.toFixed(2) + " " + (tr.total + 10).toFixed(2);
    var startS = RING_R + CAR_LEN * 0.55, endS = tr.total - (PIN_R + CAR_LEN * 0.55);
    if (reduced) {
      map.arc.setAttribute("d", quadPart(q, 1));
      map.arc.style.opacity = "0.55";
      map.route.style.strokeDashoffset = "0";
      placeCar(carPose(tr, endS), 0, 1);
      map.svgDone = true;
      return;
    }
    var ARC = 850, GO = 650, DRIVE = 1700 + BY[code].drive.aboutMinutes * 13, HOP = 650;
    var t0 = null;
    map.route.style.strokeDashoffset = tr.total.toFixed(2);
    map.arc.style.opacity = "1";
    placeCar(carPose(tr, startS), 0, 0);
    var tilt = null, last = null;
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0, dt = last === null ? 16 : now - last;
      last = now;
      map.arc.setAttribute("d", quadPart(q, ease(clamp01(t / ARC))));
      map.arc.style.opacity = String(1 - clamp01((t - GO - 250) / 600));
      var u = ease(clamp01((t - GO) / DRIVE)), head = u * tr.total;
      map.route.style.strokeDashoffset = (tr.total - head).toFixed(2);
      var s = Math.max(startS, Math.min(endS, head - CAR_LEN * 0.5));
      var hu = clamp01((t - GO - DRIVE) / HOP);
      var hop = t > GO + DRIVE ? (CAR_LEN / 9) * Math.abs(Math.sin(2 * Math.PI * hu)) * (1 - hu) : 0;
      var pose = carPose(tr, s);
      tilt = tilt === null ? pose.tilt : tilt + (pose.tilt - tilt) * Math.min(1, dt / 180);   // eased, not snapped
      pose.tilt = tilt;
      placeCar(pose, hop, clamp01((t - GO) / 150));
      if (t < GO + DRIVE + HOP) ANIM = requestAnimationFrame(frame);
      else { map.arc.setAttribute("d", ""); map.svgDone = true; }
    }
    map.svgDone = false;
    ANIM = requestAnimationFrame(frame);
  }

  // ---- choosing an airport ----
  function choose(code, fromUser) {
    var a = BY[code];
    if (!a) return;
    CURRENT = code;
    if (PENDING) { PENDING.disconnect(); PENDING = null; }
    Array.prototype.forEach.call(document.querySelectorAll(".gt-chip"), function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-code") === code)); });
    CODES.forEach(function (c) {
      if (!BY[c].ring) return;
      BY[c].ring.classList.toggle("is-on", c === code);
      BY[c].label.classList.toggle("is-on", c === code);
    });
    renderCard(a);
    $("gt-calc").hidden = false;
    $("gt-reply-box").hidden = false;
    $("gt-reply").setAttribute("href", "index.html?into=" + code + "#card");
    $("gt-reply").textContent = "Add " + a.shortName + " to my reply";
    $("gt-reply-hint").textContent = "Opens the reply form with " + a.shortName + " picked as your airport. Nothing is saved until you send it.";
    calc();
    if (mapReady) {
      if (fromUser) { showMap(); animate(code); } else driveWhenSeen(code);
    }
    $("gt-status").textContent = a.shortName + ": " + a.drive.label + " to La Conca";
    if (fromUser && window.history && history.replaceState) history.replaceState(null, "", "#" + code);
  }
  // one column (phones, small tablets): the map is below the list, so scroll it up unless it's already in view
  function showMap() {
    if (!window.matchMedia || !window.matchMedia("(max-width: 959px)").matches) return;
    var fig = $("gt-map"), r = fig.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 64)) / (r.height || 1);
    if (seen > 0.85) return;
    try { fig.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); } catch (e) { fig.scrollIntoView(true); }
  }
  // a deep link (#PEG) picks the airport at once, but the drive starts when the map is on screen
  function driveWhenSeen(code) {
    if (reduced || !("IntersectionObserver" in window)) return animate(code);
    cancelAnimationFrame(ANIM);
    map.route.setAttribute("d", "");
    map.arc.setAttribute("d", "");
    map.car.setAttribute("opacity", "0");
    map.svgDone = false;
    PENDING = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      PENDING.disconnect(); PENDING = null;
      if (CURRENT === code) animate(code);
    }, { threshold: 0.6 });
    PENDING.observe($("gt-map"));
  }

  function ukName(code) { return (DATA.ukAirports[code] && DATA.ukAirports[code].name) || code; }

  function renderCard(a) {
    var d = a.drive, tolls = d.tolls, fromName = ORIGIN ? ukName(ORIGIN) : "";
    var h = "";
    h += '<div class="eyebrow">' + esc(a.code) + (a.tag ? ", " + esc(a.tag.charAt(0).toLowerCase() + a.tag.slice(1)) : "") + "</div>";
    h += "<h3>Fly into <em>" + esc(a.shortName) + "</em></h3>";
    h += '<p class="gt-official">' + esc(a.englishName) + "</p>";
    h += '<ul class="gt-facts">'
      + "<li><b>" + esc(cap(d.label)) + "</b><span>to the estate gate</span></li>"
      + "<li><b>" + (tolls.tolled.length ? "Tolls" : "No tolls") + "</b><span>" + (tolls.tolled.length ? "on part of the way" : "all the way") + "</span></li>"
      + "<li><b>About " + esc(d.aboutKm) + " km</b><span>by road</span></li></ul>";
    h += '<div class="gt-calc-slot"></div>';   // the arrival sums sit straight after the three facts

    h += '<div class="gt-block"><h4>The drive</h4>'
      + "<p>Via the " + esc(d.via.replace(/^the /i, "")) + ". Our three route planners give " + esc(d.rangeLabel)
      + ", and none of them count stops, roadworks or holiday traffic.</p>"
      + "<p>" + esc(tollLine(tolls)) + "</p>"
      + "<p>Times stop at the estate gate. The villas are about 2.4 to 2.7 km further up the estate&rsquo;s own road.</p></div>";

    h += '<div class="gt-block"><h4>Car hire</h4><p>' + esc(a.carHire.where) + "</p>"
      + "<p>Desks: " + esc(listWords(a.carHire.companies)) + "</p></div>";

    h += '<div class="gt-block"><h4>From the UK, usually</h4><ul>';
    var routeLi = function (r) {
      var mine = ORIGIN && r.from.indexOf(ORIGIN) > -1;
      var names = r.from.map(function (c) { return c === ORIGIN ? "<mark>" + esc(ukName(c)) + "</mark>" : esc(ukName(c)); });
      if (r.isNew) {
        return "<li" + (mine ? ' class="is-from"' : "") + "><b>New:</b> " + esc(r.airline) + " from " + listWords(names)
          + (r.note ? ", " + esc(r.note) : "") + "</li>";
      }
      return "<li" + (mine ? ' class="is-from"' : "") + "><b>" + esc(r.airline) + "</b> from " + listWords(names)
        + (r.note ? " (" + esc(r.note) + ")" : "")
        + (r.warn ? '<span class="gt-warn">' + esc(r.warn) + "</span>" : "") + "</li>";
    };
    a.ukRoutes.filter(function (r) { return !r.isNew; }).forEach(function (r) { h += routeLi(r); });
    a.ukRoutes.filter(function (r) { return r.isNew; }).forEach(function (r) { h += routeLi(r); });
    (a.alsoReported || []).forEach(function (r) {
      h += "<li><b>Maybe:</b> " + esc(r.note) + "</li>";
    });
    h += "</ul>";
    if (ORIGIN && !servedFrom(a, ORIGIN)) h += "<p>Nothing direct from " + esc(fromName) + " that we know of</p>";
    h += '<p class="gt-check">Summer 2027 schedules aren&rsquo;t all out yet, so check before you book</p></div>';

    if (a.worthListing && a.worthListing.why) {
      h += '<div class="gt-block"><h4>Why Ciampino too</h4><p>' + esc(a.worthListing.why) + "</p></div>";
    }

    var pt = a.publicTransport;
    h += '<div class="gt-block"><h4>Without a car</h4><p><b>' + esc(pt.summary) + ".</b> " + esc(pt.notes) + "</p></div>";
    var body = $("gt-card-body"), calcBox = $("gt-calc");
    body.innerHTML = h;
    var slot = body.querySelector(".gt-calc-slot");
    slot.parentNode.replaceChild(calcBox, slot);
  }
  function tollLine(t) {
    if (!t.tolled.length) return t.summary + ": " + t.tollFree.join(", ");
    return t.summary;
  }
  function servedFrom(a, origin) {
    return a.ukRoutes.some(function (r) { return r.from.indexOf(origin) > -1; });
  }

  // ---- flying from ----
  function buildFrom() {
    var sel = $("gt-from");
    Object.keys(DATA.ukAirports).map(function (c) { return [c, DATA.ukAirports[c].name]; })
      .sort(function (x, y) { return x[1] < y[1] ? -1 : 1; })
      .forEach(function (o) {
        var opt = document.createElement("option");
        opt.value = o[0]; opt.textContent = o[1];
        sel.appendChild(opt);
      });
    sel.addEventListener("change", function () { setOrigin(sel.value); });
  }
  // "From Cardiff, ..." : the usual routes, then any brand-new ones, then known gaps in the weekend's days
  function fromNote(origin, served) {
    var mine = function (a) { return a.ukRoutes.filter(function (r) { return r.from.indexOf(origin) > -1; }); };
    var usual = served.filter(function (a) { return mine(a).some(function (r) { return !r.isNew; }); });
    var fresh = served.filter(function (a) { return usual.indexOf(a) < 0; });
    var names = function (list) { return listWords(list.map(function (a) { return a.shortName; })); };
    var out = [];
    if (usual.length) out.push("From " + ukName(origin) + ", airlines usually fly to " + names(usual) + ".");
    fresh.forEach(function (a) {
      var airlines = listWords(mine(a).map(function (r) { return r.airline; }));
      out.push((usual.length ? "There’s also " : "From " + ukName(origin) + ", the only direct route we know of is ")
        + airlines + "’s new route to " + a.shortName + ".");
    });
    served.forEach(function (a) {
      mine(a).forEach(function (r) { if (r.warnShort) out.push(r.warnShort + "."); });
    });
    out.push(fresh.length ? "Check before you book, and check the new route runs in May 2027." : "Check before you book.");
    return out.join(" ");
  }
  function setOrigin(code) {
    ORIGIN = code;
    var note = $("gt-from-note");
    var served = ORIGIN ? DATA.airports.filter(function (a) { return servedFrom(a, ORIGIN); }) : DATA.airports;
    DATA.airports.forEach(function (a) {
      var on = !ORIGIN || servedFrom(a, ORIGIN);
      var chip = document.querySelector('.gt-chip[data-code="' + a.code + '"]');
      if (chip) { chip.classList.toggle("is-dim", !on); chip.classList.toggle("is-served", !!ORIGIN && on); }
      if (BY[a.code].ring) { BY[a.code].ring.classList.toggle("is-dim", !on); BY[a.code].label.classList.toggle("is-dim", !on); }
    });
    if (!ORIGIN) { note.hidden = true; note.textContent = ""; }
    else {
      note.hidden = false;
      note.textContent = served.length ? fromNote(ORIGIN, served) : "Nothing direct from " + ukName(ORIGIN) + " that we know of";
    }
    if (CURRENT) renderCard(BY[CURRENT]);
  }

  // ---- the airport list ----
  function buildChips() {
    var box = $("gt-chips");
    DATA.airports.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gt-chip";
      b.setAttribute("data-code", a.code);
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = "<b>" + esc(a.shortName) + "</b><span>" + esc(a.drive.label) + "</span>" + (a.tag ? "<i>" + esc(a.tag) + "</i>" : "");
      b.addEventListener("click", function () { choose(a.code, true); });
      box.appendChild(b);
    });
  }

  // ---- when will I get there ----
  function buildCalc() {
    var pd = DATA.friday.plannerDefaults, sel = $("gt-allow");
    (pd.choices || [30, 45, 60, 90]).forEach(function (m) {
      var o = document.createElement("option");
      o.value = m; o.textContent = dur(m);
      if (m === pd.landingToDrivingMinutes) o.selected = true;
      sel.appendChild(o);
    });
    $("gt-calc-hint").textContent = "Use the landing time on your booking: it’s Italian time, an hour ahead of the UK. The allowance is our rough guess, and the new EU passport checks can make your first entry slower.";
    ["gt-land", "gt-day", "gt-allow"].forEach(function (id) {
      $(id).addEventListener("input", calcAndSay);
      $(id).addEventListener("change", calcAndSay);
    });
  }

  function calcAndSay() {
    calc();
    clearTimeout(SAY);
    SAY = setTimeout(function () {
      var out = $("gt-result"), when = out.querySelector(".gt-when"), title = out.getAttribute("data-verdict");
      if (when && title) $("gt-status").textContent = when.textContent.replace(/(around)(\d)/, "$1 $2").replace(/(\d)([A-Z])/, "$1 $2") + ". " + title;
    }, 900);
  }

  function weekDay(iso) { return (DATA.friday.weekSun.days || []).filter(function (d) { return d.date === iso; })[0]; }

  function calc() {
    var out = $("gt-result");
    if (!CURRENT) { out.innerHTML = ""; return; }
    var land = toMin($("gt-land").value);
    if (land === null) {
      out.innerHTML = '<p class="gt-sum">Put in your landing time and we&rsquo;ll do the sums</p>';
      return;
    }
    var a = BY[CURRENT], day = $("gt-day").value, allow = +$("gt-allow").value;
    var at = land + allow + a.drive.aboutMinutes, slow = land + allow + a.drive.rangeMinutes[1];
    var sun = DATA.friday.sun;
    var SUNRISE = toMin(sun.sunrise), GOLD = toMin(sun.goldenHourStarts), SET = toMin(sun.sunset), DARK = toMin(sun.lastLight);
    var shown = round5(at), nextDay = shown >= 1440;
    var DAYS = { fri: ["Friday", "Saturday"], thu: ["Thursday", "Friday"], other: ["", "the next day"] };
    var dayWord = DAYS[day][nextDay ? 1 : 0];

    var whenWord = day === "thu" ? "Near Sansepolcro around" : "At the gate around";
    var h = '<div class="gt-when"><span>' + whenWord + "</span><b>" + clock(shown) + "</b>" + (dayWord ? "<em>" + dayWord + "</em>" : "") + "</div>";
    h += '<p class="gt-sum">Lands ' + clock(land) + ", then " + dur(allow) + " for passport, bags and the car, then "
      + esc(a.drive.label) + " on the road. On the slowest of our three estimates, about " + clock(round5(slow))
      + (round5(slow) >= 1440 && !nextDay ? ", after midnight" : "") + ".</p>";

    var v = { cls: "is-ok", title: "", text: [], dark: false };
    if (day === "fri") {
      h += strip(at, sun);
      if (at >= 1440) {
        v = { cls: "is-dark", title: "Estimated arrival on Saturday", dark: true,
              text: ["Your estimated arrival is after midnight. The last stretch may be dark, so check the route before setting off."] };
      } else if (at < SUNRISE) {
        v = { cls: "is-dark", title: "Estimated arrival before sunrise", dark: true,
              text: ["Your estimated arrival is before sunrise, calculated at about " + sun.sunrise + ". The last stretch may be dark."] };
      } else if (at <= GOLD) {
        v = { cls: "is-ok", title: "Estimated arrival in daylight",
              text: ["Your estimated arrival is before sunset, calculated at about " + sun.sunset + " for a flat horizon. Hills may hide the sun earlier."] };
        if (slow > SET) v.text.push("The slower drive estimate is around " + clock(round5(slow)) + ", which could be after sunset.");
      } else if (at <= SET) {
        v = { cls: "is-tight", title: "Estimated arrival around sunset",
              text: ["Sunset is calculated at about " + sun.sunset + " for a flat horizon. Hills may hide the sun earlier."] };
        if (slow > SET) v.text.push("The slower drive estimate is around " + clock(round5(slow)) + ", which could be after sunset.");
      } else if (at <= DARK) {
        v = { cls: "is-dark", title: "Estimated arrival around dusk", dark: true,
              text: ["Sunset is estimated at about " + sun.sunset + " and last light at " + sun.lastLight + ". It may be dark on the estate road; local conditions and hills can affect the light."] };
      } else {
        v = { cls: "is-dark", title: "Estimated arrival after last light", dark: true,
              text: ["You may reach the estate road after dark. Sunset is estimated at about " + sun.sunset + " and last light at " + sun.lastLight + "."] };
      }
    } else if (day === "thu") {
      var thu = weekDay("2027-05-27") || { sunset: sun.sunset, lastLight: sun.lastLight };
      var tSet = toMin(thu.sunset), tDark = toMin(thu.lastLight);
      var light = at >= 1440 || at < SUNRISE ? "after dark" : at <= tSet ? "before the estimated sunset at " + thu.sunset : at <= tDark ? "around dusk, after the estimated sunset at " + thu.sunset : "after dark, with sunset estimated at " + thu.sunset;
      var thuLit = at < 1440 && at >= SUNRISE && at <= tSet;
      v = { cls: thuLit ? "is-ok" : "is-dark", title: "A day ahead", dark: !thuLit, darkTitle: "If you’re driving in the dark",
            text: ["We have the villas from Friday 28 May, so Thursday night is yours to arrange.",
                   "If you drive to the Sansepolcro area on Thursday, your estimated arrival is " + light + ". Hills may hide the sun earlier."] };
    } else {
      var days = DATA.friday.weekSun.days || [];
      var firstSet = days.length ? days[0].sunset : sun.sunset, lastSet = days.length ? days[days.length - 1].sunset : sun.sunset;
      var oSet = toMin(firstSet), oDark = days.length ? toMin(days[days.length - 1].lastLight) : DARK;
      var lit = at < 1440 && at >= SUNRISE && at <= oSet;
      var dusk = at < 1440 && at > oSet && at <= oDark;
      v = { cls: lit ? "is-ok" : "is-dark", title: "Planning your arrival", dark: !lit,
            text: ["Sunset is estimated between " + firstSet + " and " + lastSet + " that week. Hills may hide the sun earlier.",
                   lit ? "Your estimated arrival is in daylight." : "Your estimated arrival is " + (dusk ? "around dusk" : "after dark") + "; check the route before setting off."] };
    }
    h += '<div class="gt-verdict ' + v.cls + '"><h5>' + esc(v.title) + "</h5>" + v.text.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
    if (v.dark) h += darkTips(v.darkTitle);
    out.innerHTML = h;
    var spot = out.querySelector(".gt-strip-car");
    if (spot) spot.appendChild(carIcon());
    out.setAttribute("data-verdict", v.title);
  }

  function darkTips(title) {
    var ls = DATA.lastStretch, sat = DATA.venue.satnav;
    var items = ls.facts.filter(function (f) { return f.afterDark; }).map(function (f) {
      return "<li>" + esc(f.text) + (/satnav/i.test(f.text) ? ": <b>" + esc(sat.lat + ", " + sat.lon) + "</b>" : "") + "</li>";
    });
    (ls.unknown || []).forEach(function (u) { items.push("<li>" + esc(u.text) + "</li>"); });
    return '<div class="gt-dark"><h5>' + esc(title || "For the drive up in the dark") + '</h5><ul class="s-list">' + items.join("") + '</ul><p class="gt-hint"><a href="#last-stretch">More on the last stretch</a></p></div>';
  }

  // Friday from noon to midnight: daylight, golden hour, dusk and night, with the car where you'd arrive
  function strip(at, sun) {
    var from = 720, span = 720;
    var pos = function (m) { return Math.max(0, Math.min(100, (m - from) / span * 100)); };
    var G = toMin(sun.goldenHourStarts), S = toMin(sun.sunset), D = toMin(sun.lastLight);
    var x = pos(at), edge = at < from ? " is-left" : at > from + span ? " is-right" : "";
    var h = '<div class="gt-strip" aria-hidden="true"><div class="gt-strip-bar">'
      + '<i class="gt-strip-gold" style="left:' + pos(G) + "%;width:" + (pos(S) - pos(G)) + '%"></i>'
      + '<i class="gt-strip-dusk" style="left:' + pos(S) + "%;width:" + (pos(D) - pos(S)) + '%"></i>'
      + '<i class="gt-strip-night" style="left:' + pos(D) + "%;width:" + (100 - pos(D)) + '%"></i></div>'
      + '<span class="gt-strip-tick" style="left:0">12:00</span>'
      + '<span class="gt-strip-tick is-sun" style="left:' + pos(S) + '%"><b>' + sun.sunset + "</b> <span>estimated sunset</span></span>"
      + '<span class="gt-strip-tick is-end" style="left:100%">24:00</span>'
      + '<span class="gt-strip-car' + edge + '" style="left:' + x + '%"></span></div>';
    return h;
  }

  // ---- Friday's light, the last stretch, the small print ----
  function buildStatic() {
    var sun = DATA.friday.sun;
    $("gt-sun").innerHTML = [[sun.goldenHourStarts, "Golden hour, estimated"], [sun.sunset, "Sunset, estimated"], [sun.lastLight, "Last light, estimated"]]
      .map(function (t) { return "<li><b>" + esc(t[0]) + "</b><span>" + esc(t[1]) + "</span></li>"; }).join("");
    $("gt-sun-note").textContent = sun.note + " All times are Italian time, " + sun.timezone + ".";

    var ls = DATA.lastStretch, sat = DATA.venue.satnav;
    $("gt-stretch-summary").textContent = ls.summary;
    $("gt-coords").innerHTML = esc(sat.lat + ", " + sat.lon) + "<small>" + esc(sat.dms) + "</small>";
    $("gt-satnav-note").textContent = sat.note;
    $("gt-tips").innerHTML = ls.facts.filter(function (f) { return !/satnav/i.test(f.text); })
      .map(function (f) { return "<li>" + esc(f.text) + "</li>"; }).join("")
      + (ls.unknown || []).map(function (u) { return '<li class="is-unknown">' + esc(u.text) + "</li>"; }).join("");
    $("gt-copy").addEventListener("click", function () { copyCoords(sat.lat + ", " + sat.lon); });

    var c = DATA.checked && /^(\d{4})-(\d{2})-(\d{2})$/.exec(DATA.checked);
    var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (c) $("gt-checked").textContent = "Checked " + +c[3] + " " + MONTHS[+c[2] - 1] + " " + c[1] + ". Map from Natural Earth. Routes and places © OpenStreetMap contributors.";
    buildMini();
  }

  function copyCoords(text) {
    var btn = $("gt-copy");
    var done = function (ok) {
      btn.textContent = ok ? "Copied" : "Press and hold the numbers to copy";
      setTimeout(function () { btn.textContent = "Copy the coordinates"; }, 2600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else done(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  // The last stretch close up: the lane from the turn-off, the gate, the estate road up to both villas
  function buildMini() {
    var ls = DATA.lastStretch, v = DATA.venue, svg = $("gt-mini");
    var lat0 = 43.597, cosl = Math.cos(lat0 * RAD);
    var raw = function (lon, lat) { return [lon * cosl, -lat]; };
    var all = [].concat(ls.polylines.lane, ls.polylines.estateToSantarsa, ls.polylines.estateToVallorsaia, [[v.satnav.lat, v.satnav.lon]]);
    var xs = all.map(function (p) { return raw(p[1], p[0])[0]; }), ys = all.map(function (p) { return raw(p[1], p[0])[1]; });
    var MW = 340, MH = 300, padL = 34, padR = 118, padT = 30, padB = 40;
    var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys);
    var k = Math.min((MW - padL - padR) / (bx1 - bx0), (MH - padT - padB) / (by1 - by0));
    var ox = padL + ((MW - padL - padR) - (bx1 - bx0) * k) / 2, oy = padT + ((MH - padT - padB) - (by1 - by0) * k) / 2;
    var P = function (lon, lat) { var r = raw(lon, lat); return [ox + (r[0] - bx0) * k, oy + (r[1] - by0) * k]; };
    svg.setAttribute("viewBox", "0 0 " + MW + " " + MH);
    var line = function (pts, cls) { el("path", { d: lineD(pts.map(function (p) { return P(p[1], p[0]); })), "class": cls }, svg); };
    line(ls.polylines.estateToSantarsa, "gt-estate");
    line(ls.polylines.estateToVallorsaia, "gt-estate");
    line(ls.polylines.lane, "gt-lane");
    var label = function (p, dx, dy, a, main, sub) {
      el("text", { x: p[0] + dx, y: p[1] + dy, "text-anchor": a, "class": "gt-mlabel gt-halo" }, svg).textContent = main;
      if (sub) el("text", { x: p[0] + dx, y: p[1] + dy + 13, "text-anchor": a, "class": "gt-msub gt-halo" }, svg).textContent = sub;
    };
    var turn = P(ls.turnOff.lon, ls.turnOff.lat), gate = P(v.gate.lon, v.gate.lat), sat = P(v.satnav.lon, v.satnav.lat);
    el("circle", { cx: turn[0], cy: turn[1], r: 4.5, "class": "gt-mark" }, svg);
    label(turn, 9, 4, "start", "Turn-off", "about " + ls.turnOff.elevationM + " m above sea level");
    el("circle", { cx: gate[0], cy: gate[1], r: 4.5, "class": "gt-mark" }, svg);
    label(gate, 9, 4, "start", "Estate gate", "drive times end here");
    el("circle", { cx: sat[0], cy: sat[1], r: 4, "class": "gt-mark" }, svg);
    label(sat, -9, 4, "end", "La Conca", "satnav point");
    v.villas.forEach(function (vl, i) {
      var p = P(vl.lon, vl.lat);
      el("rect", { x: p[0] - 4, y: p[1] - 4, width: 8, height: 8, transform: "rotate(45 " + p[0] + " " + p[1] + ")", "class": "gt-villa" }, svg);
      label(p, 10, i ? -2 : 8, "start", vl.name, "about " + vl.elevationM + " m above sea level");
    });
    // a 500 m scale bar and north
    var m500 = 500 / 111320 * k;
    var sx = MW - 16 - m500, sy = MH - 16;
    el("line", { x1: sx, y1: sy, x2: sx + m500, y2: sy, "class": "gt-scale" }, svg);
    el("line", { x1: sx, y1: sy - 4, x2: sx, y2: sy + 1, "class": "gt-scale" }, svg);
    el("line", { x1: sx + m500, y1: sy - 4, x2: sx + m500, y2: sy + 1, "class": "gt-scale" }, svg);
    el("text", { x: sx + m500 / 2, y: sy - 8, "text-anchor": "middle", "class": "gt-msub" }, svg).textContent = "500 m";
    el("text", { x: 18, y: 22, "class": "gt-north" }, svg).textContent = "N";
    el("path", { d: "M18 26 L14 36 L18 33 L22 36 Z", fill: "currentColor", "class": "gt-north" }, svg);
  }

  // ---- go ----
  function validBaseMap(shapes) {
    if (!shapes || shapes.type !== "FeatureCollection" || !Array.isArray(shapes.features) || !shapes.features.length) return false;
    var italy = false;
    var valid = shapes.features.every(function (feature) {
      if (!feature || !feature.properties || !feature.geometry) return false;
      var geometry = feature.geometry;
      if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return false;
      var polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      if (!Array.isArray(polygons) || !polygons.length) return false;
      if (feature.properties.role === "italy") italy = true;
      return polygons.every(function (polygon) {
        return Array.isArray(polygon) && polygon.length && polygon.every(function (ring) {
          return Array.isArray(ring) && ring.length >= 3 && ring.every(function (point) {
            return Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
          });
        });
      });
    });
    return valid && italy;
  }
  function mapUnavailable() {
    mapReady = false;
    map = {};
    DATA.airports.forEach(function (a) { delete a.track; delete a.at; delete a.ring; delete a.label; });
    var svg = $("gt-svg"), fig = $("gt-map"), notice = $("gt-loading");
    svg.hidden = true;
    svg.setAttribute("hidden", "");
    svg.setAttribute("aria-hidden", "true");
    fig.setAttribute("aria-label", "Map unavailable");
    var caption = fig.querySelector("figcaption");
    if (caption) caption.hidden = true;
    notice.hidden = false;
    notice.style.position = "static";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.textContent = "The map is unavailable. Choose an airport from the list to continue.";
  }
  function start(values) {
    if (!$("gt-svg")) return;
    DATA = values[0];
    DATA.airports.forEach(function (a) { BY[a.code] = a; });
    buildChips();
    buildFrom();
    buildCalc();
    buildStatic();
    try {
      if (!validBaseMap(values[1])) throw new Error("Invalid map data");
      buildMap(values[1]);
      mapReady = true;
    } catch (e) {
      mapUnavailable();
    }
    var pick = (/^#([A-Za-z]{3})$/.exec(location.hash) || [])[1];
    if (pick && BY[pick.toUpperCase()]) choose(pick.toUpperCase(), false);
  }
  function getJSON(url, signal) {
    var options = { credentials: "same-origin" };
    if (signal) options.signal = signal;
    return fetch(url, options).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function optionalMap() {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var done = false, timer, finish;
    function cancel() {
      if (done) return;
      if (controller) controller.abort();
      finish(null);
    }
    var promise = new Promise(function (resolve) {
      finish = function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(cancel, 5000);
      getJSON("data/getting-there-map.json", controller && controller.signal).then(finish, function () { finish(null); });
    });
    return { promise: promise, cancel: cancel };
  }
  var mapRequest = optionalMap();
  Promise.all([getJSON("data/getting-there.json"), mapRequest.promise])
    .then(start)
    .catch(function (e) {
      mapRequest.cancel();
      if ($("gt-loading")) {
        $("gt-loading").setAttribute("role", "status");
        $("gt-loading").textContent = "The travel planner didn’t load. Try refreshing the page.";
      }
      if (window.console) console.warn("getting-there:", e);
    });

  // test hook: lets the checks skip to the end of a drive
  window.__gtState = function () { return { current: CURRENT, done: !!map.svgDone }; };
})();
