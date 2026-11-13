(function (root) {
  'use strict';
  // The Getting there card's map: the UK down to Tuscany as one SVG, drawn in the welcome film's projection
  // (Lambert conformal conic, standard parallels 42 and 45 N, centred on 11.6 E), with the maths written out here.
  // create() builds it in a host element and show(view) redraws it for what the guest has chosen so far:
  //   a fan of arcs for airports being compared, one arc with a plane and then the drive for a chosen route,
  //   a single line for a trip overland. Every position comes from data/getting-there.json.
  // Lines and markers keep the same size on screen at every zoom. Nothing here is the only way to choose anything.
  const RAD = Math.PI / 180, PAR0 = 42 * RAD, PAR1 = 45 * RAD, MID_LON = 11.6, SCALE = 3000;
  const MIN_SPAN = 56;   // map units: the camera never frames less than this (about 120 km)
  const NS = 'http://www.w3.org/2000/svg';
  const tany = phi => Math.tan((Math.PI / 2 + phi) / 2);
  const CN = Math.log(Math.cos(PAR0) / Math.cos(PAR1)) / Math.log(tany(PAR1) / tany(PAR0));
  const CF = Math.cos(PAR0) * Math.pow(tany(PAR0), CN) / CN;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

  // [x, y] in map units; y grows southwards, as on screen.
  function project(lon, lat) {
    const lam = (lon - MID_LON) * RAD, r = CF / Math.pow(tany(lat * RAD), CN);
    return [SCALE * r * Math.sin(CN * lam), SCALE * (r * Math.cos(CN * lam) - CF)];
  }

  // The box that holds every point with `pad` (a fraction) of room on each side, widened or heightened to `aspect`.
  function fitBox(points, pad, aspect) {
    const pts = Array.isArray(points) && points.length ? points : [[0, 0]];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    let w = Math.max(x1 - x0, MIN_SPAN) * (1 + pad * 2), h = Math.max(y1 - y0, MIN_SPAN) * (1 + pad * 2);
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
  }

  // A gentle curve from a to b; bend is how far it bows, as a fraction of its length (the sign picks the side).
  function arcPath(a, b, bend) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = (a[0] + b[0]) / 2 + dy * bend, cy = (a[1] + b[1]) / 2 - dx * bend;
    return 'M' + a[0] + ',' + a[1] + ' Q' + cx + ',' + cy + ' ' + b[0] + ',' + b[1];
  }

  const fixed = p => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  // The outline file's rings for one role ('land' or 'italy') as one path; '' when there is nothing usable.
  function outlinePath(outline, role) {
    const features = isObject(outline) && Array.isArray(outline.features) ? outline.features : [];
    let d = '';
    features.forEach(function (f) {
      if (!isObject(f) || !isObject(f.properties) || f.properties.role !== role || !isObject(f.geometry)) return;
      const polys = Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
      polys.forEach(poly => (Array.isArray(poly) ? poly : []).forEach(function (ring) {
        const pts = (Array.isArray(ring) ? ring : []).filter(c => Array.isArray(c) && isNum(c[0]) && isNum(c[1]));
        if (pts.length >= 3) d += 'M' + pts.map(c => fixed(project(c[0], c[1]))).join('L') + 'Z';
      }));
    });
    return d;
  }
  // A drive from the data ([lat, lon] pairs) as a path; '' unless every point is usable.
  function linePath(polyline) {
    const pts = Array.isArray(polyline) ? polyline : [];
    if (pts.length < 2 || !pts.every(c => Array.isArray(c) && isNum(c[0]) && isNum(c[1]))) return '';
    return 'M' + pts.map(c => fixed(project(c[1], c[0]))).join('L');
  }

  // What to draw for a view. known: { uk: {code: ...}, it: {code: ...} }, the airports the data can place.
  function sceneOf(view, known) {
    const v = isObject(view) ? view : {};
    if (v.from === 'ROAD' || v.from === 'TRAIN') return 'overland';
    const kind = v.from === 'ABROAD' || v.from === 'ITALY', uk = !!known.uk[v.from];
    if (v.to && known.it[v.to] && (kind || uk)) return 'trip';
    if (kind) return 'italy';
    if (v.to && uk) return 'origin';
    return (Array.isArray(v.froms) ? v.froms : []).some(c => known.uk[c]) ? 'fan' : 'all';
  }

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Room kept clear on screen: the card's heading above the map, the ticket's overlap below.
  const INSET = { top: 46, bottom: 26 };

  function create(opts) {
    const o = opts || {}, host = o.host, data = isObject(o.data) ? o.data : {}, reduced = !!o.reduced;
    const doc = host.ownerDocument;
    function sv(tag, attrs, parent) {
      const e = doc.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
      if (parent) parent.appendChild(e);
      return e;
    }

    // ---- where things are ----
    const P = { uk: {}, it: {}, villa: [0, 0], road: [0, 0] }, flies = {}, drives = {}, names = {};
    (Array.isArray(data.airports) ? data.airports : []).forEach(function (a) {
      const t = isObject(a) ? a.terminal : null;
      if (!isObject(t) || !isNum(t.lat) || !isNum(t.lon) || typeof a.code !== 'string') return;
      P.it[a.code] = project(t.lon, t.lat);
      names[a.code] = typeof a.shortName === 'string' ? a.shortName : a.code;
      drives[a.code] = isObject(a.drive) ? linePath(a.drive.polyline) : '';
    });
    const ukData = isObject(data.ukAirports) ? data.ukAirports : {};
    Object.keys(ukData).forEach(function (code) {
      const a = ukData[code], p = isObject(a) ? a.pos : null;
      if (!isObject(p) || !isNum(p.lat) || !isNum(p.lon)) return;
      P.uk[code] = project(p.lon, p.lat);
      flies[code] = {};
      (Array.isArray(a.flies) ? a.flies : []).forEach(f => { if (isObject(f) && P.it[f.to]) flies[code][f.to] = true; });
    });
    const sat = isObject(data.venue) && isObject(data.venue.satnav) ? data.venue.satnav : null;
    if (sat && isNum(sat.lat) && isNum(sat.lon)) P.villa = project(sat.lon, sat.lat);
    // A trip overland has no known start, so its line comes in from the north-west of the map.
    const bb = isObject(o.outline) && Array.isArray(o.outline.bbox) && o.outline.bbox.length === 4 && o.outline.bbox.every(isNum)
      ? o.outline.bbox : [-11, 39.5, 19, 59.5];
    P.road = project(bb[0] + (bb[2] - bb[0]) * 0.4, bb[1] + (bb[3] - bb[1]) * 0.58);
    const itCodes = Object.keys(P.it), ukCodes = Object.keys(P.uk);
    const itPts = () => itCodes.map(c => P.it[c]);
    const allPts = () => ukCodes.map(c => P.uk[c]).concat(itPts(), [P.villa]);

    // ---- the drawing ----
    const svg = sv('svg', { 'class': 'tm-svg', role: 'img', 'aria-label': o.label || '', preserveAspectRatio: 'xMidYMid meet' });
    const grad = sv('radialGradient', { id: 'tm-glow' }, sv('defs', null, svg));
    sv('stop', { offset: '0', 'class': 'tm-glow-in' }, grad);
    sv('stop', { offset: '1', 'class': 'tm-glow-out' }, grad);
    sv('path', { 'class': 'tm-land', d: outlinePath(o.outline, 'land') }, svg);
    const italy = sv('path', { 'class': 'tm-italy', d: outlinePath(o.outline, 'italy') }, svg);
    sv('circle', { 'class': 'tm-glow', r: 52, cx: P.villa[0], cy: P.villa[1], fill: 'url(#tm-glow)' }, svg);
    const drive = sv('path', { 'class': 'tm-route tm-drive' }, svg);
    const fan = sv('g', { 'class': 'tm-fan' }, svg);
    const arc = sv('path', { 'class': 'tm-route tm-arc' }, svg);
    const dots = sv('g', null, svg);
    const plane = sv('path', { 'class': 'tm-plane', d: 'M-6,-4 L7,0 L-6,4 L-3,0Z', opacity: 0 }, svg);

    let pick = null;
    const markers = [];
    function marker(kind, code, p, label, r) {
      const g = sv('g', { 'class': 'tm-dot tm-' + kind }, dots);
      sv('circle', { 'class': 'tm-hit', r: 14 }, g);
      sv('circle', { 'class': 'tm-ring', r: 9 }, g);
      if (kind === 'villa') sv('path', { 'class': 'tm-pt', d: 'M0,-7 L5,0 L0,7 L-5,0Z' }, g);
      else sv('circle', { 'class': 'tm-pt', r }, g);
      sv('text', { x: 10, y: 4 }, g).textContent = label;
      if (kind !== 'villa') g.addEventListener('click', () => { if (pick) pick(kind === 'uk' ? { uk: code } : { airport: code }); });
      const m = { el: g, x: p[0], y: p[1], kind, code };
      markers.push(m);
      return m;
    }
    ukCodes.forEach(c => marker('uk', c, P.uk[c], c, 2.6));
    itCodes.forEach(c => marker('it', c, P.it[c], names[c], 3.6));
    const villa = marker('villa', 'villa', P.villa, o.villaLabel || '', 0);
    host.appendChild(svg);

    // ---- the camera ----
    const EMPTY = { froms: [], from: null, to: null, wide: false };
    let px = { w: 1, h: 1 }, V = { x: 0, y: 0, w: 1, h: 1 }, run = 0, cur = EMPTY, curKey = '', lastTrip = '';
    let pose = { x: 0, y: 0, a: 0 };

    function frame(points, pad) {
      const top = Math.min(INSET.top, px.h * 0.22), bottom = Math.min(INSET.bottom, px.h * 0.12);
      const b = fitBox(points, pad, px.w / Math.max(40, px.h - top - bottom)), s = b.w / px.w;
      return { x: b.x, y: b.y - top * s, w: b.w, h: b.h + (top + bottom) * s };
    }
    function apply(v) {
      V = v;
      svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h);
      const k = v.w / px.w;   // map units per pixel: everything of fixed size on screen is scaled by it
      svg.classList.toggle('tm-close', k < 0.62);
      arc.style.strokeWidth = 1.6 * k;
      drive.style.strokeWidth = 2.6 * k;
      fan.style.strokeWidth = k;
      italy.style.strokeWidth = 0.8 * k;
      markers.forEach(m => m.el.setAttribute('transform', 'translate(' + m.x + ' ' + m.y + ') scale(' + k + ')'));
      plane.setAttribute('transform', 'translate(' + pose.x + ' ' + pose.y + ') rotate(' + pose.a + ') scale(' + k + ')');
    }
    // Runs step(0..1) over ms; resolves early, without finishing, when a newer show() has started.
    function tween(ms, step) {
      const my = run;
      return new Promise(function (resolve) {
        if (reduced || ms <= 0) { step(1); resolve(); return; }
        const t0 = root.performance.now();
        root.requestAnimationFrame(function tick(now) {
          if (my !== run) { resolve(); return; }
          const t = Math.min(1, Math.max(0, (now - t0) / ms));
          step(t);
          if (t < 1) root.requestAnimationFrame(tick); else resolve();
        });
      });
    }
    function moveTo(points, pad, ms) {
      const a = V, b = frame(points, pad);
      return tween(ms, function (t) {
        const e = ease(t);
        apply({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e });
      });
    }
    function setLine(path, shown) {
      if (!path.getAttribute('d')) return 0;
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = shown ? 0 : len;
      return len;
    }
    function draw(path, ms, withPlane) {
      const len = setLine(path, false);
      if (!len) return Promise.resolve();
      if (withPlane) plane.setAttribute('opacity', 1);
      return tween(ms, function (t) {
        const e = ease(t);
        path.style.strokeDashoffset = len * (1 - e);
        if (!withPlane) return;
        const a = path.getPointAtLength(len * e), b = path.getPointAtLength(Math.min(len, len * e + 1));
        pose = { x: a.x, y: a.y, a: (b.x === a.x && b.y === a.y) ? pose.a : Math.atan2(b.y - a.y, b.x - a.x) / RAD };
        apply(V);
      }).then(() => { if (withPlane) plane.setAttribute('opacity', 0); });
    }

    function paint(v, scene) {
      const froms = v.froms.filter(c => P.uk[c]);
      const served = code => froms.some(f => flies[f][code]);
      const trip = scene === 'trip';
      markers.forEach(function (m) {
        const c = m.el.classList;
        if (m.kind === 'uk') {
          const sel = trip || scene === 'origin' ? v.from === m.code : scene === 'fan' && froms.indexOf(m.code) >= 0;
          c.toggle('tm-sel', sel);
          c.toggle('tm-dim', scene !== 'all' && !sel);
          c.toggle('tm-named', sel && (scene !== 'fan' || froms.length <= 3));
        } else if (m.kind === 'it') {
          const sel = trip && v.to === m.code;
          const open = (scene === 'italy' && !v.to) || (scene === 'fan' && served(m.code));
          c.toggle('tm-sel', sel);
          c.toggle('tm-served', open);
          c.toggle('tm-dim', !sel && !open && scene !== 'all');
        }
      });
    }
    function clearLines() {
      fan.textContent = '';
      arc.removeAttribute('d');
      drive.removeAttribute('d');
      plane.setAttribute('opacity', 0);
      villa.el.classList.remove('tm-arrived');
    }

    // Each scene checks after every wait that it is still the newest; a newer show() takes over where it left off.
    async function play(v, scene, fast) {
      const my = ++run, ms = n => (fast ? 0 : n), stale = () => my !== run;
      const fresh = scene === 'trip' && lastTrip !== v.from + '>' + v.to;
      lastTrip = scene === 'trip' ? v.from + '>' + v.to : '';
      paint(v, scene);
      if (scene !== 'trip') clearLines();

      if (scene === 'all') return moveTo(allPts(), 0.07, ms(700));
      if (scene === 'italy') return moveTo(itPts().concat([P.villa]), 0.16, ms(800));
      if (scene === 'origin') return moveTo([P.uk[v.from], P.villa], 0.2, ms(800));
      if (scene === 'overland') {
        arc.setAttribute('d', arcPath(P.road, P.villa, -0.12));
        setLine(arc, false);
        await moveTo([P.road, P.villa], 0.2, ms(800)); if (stale()) return;
        await draw(arc, ms(1500), false); if (stale()) return;
        villa.el.classList.add('tm-arrived');
        return;
      }
      if (scene === 'fan') {
        const froms = v.froms.filter(c => P.uk[c]), lines = [];
        froms.forEach(from => Object.keys(flies[from]).forEach(function (to) {
          const p = sv('path', { 'class': 'tm-route tm-fanline', d: arcPath(P.uk[from], P.it[to], 0.14) }, fan);
          const len = p.getTotalLength();
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          lines.push({ p, len });
        }));
        await moveTo(froms.map(c => P.uk[c]).concat(itPts(), [P.villa]), 0.16, ms(550)); if (stale()) return;
        const n = lines.length, gap = n > 1 ? 0.5 / (n - 1) : 0;
        return tween(ms(600 + Math.min(900, n * 60)), function (t) {
          lines.forEach((l, i) => { l.p.style.strokeDashoffset = l.len * (1 - ease(Math.min(1, Math.max(0, (t - i * gap) / 0.5)))); });
        });
      }
      // A chosen route: the flight (from a UK airport), then down into Tuscany for the drive to the villa.
      const from = P.uk[v.from], to = P.it[v.to], full = fresh && !fast && !v.wide;
      fan.textContent = '';
      villa.el.classList.remove('tm-arrived');
      plane.setAttribute('opacity', 0);
      if (drives[v.to]) drive.setAttribute('d', drives[v.to]); else drive.removeAttribute('d');
      if (from) arc.setAttribute('d', arcPath(from, to, 0.14)); else arc.removeAttribute('d');
      const whole = (from ? [from] : itPts()).concat([to, P.villa]);
      if (full && from) {
        setLine(arc, false); setLine(drive, false);
        await moveTo(whole, 0.2, ms(700)); if (stale()) return;
        await draw(arc, ms(1200), true); if (stale()) return;
        await tween(ms(160), function () {}); if (stale()) return;
      } else setLine(arc, true);
      if (v.wide) {
        setLine(drive, true);
        await moveTo(whole, 0.2, ms(800)); if (stale()) return;
      } else {
        if (full) setLine(drive, false);
        await moveTo([to, P.villa], 0.34, ms(full ? 1300 : 750)); if (stale()) return;
        if (full) { await draw(drive, ms(1100), false); if (stale()) return; } else setLine(drive, true);
      }
      villa.el.classList.add('tm-arrived');
    }

    function show(view) {
      const v = isObject(view) ? view : {};
      const next = { froms: Array.isArray(v.froms) ? v.froms.slice() : [], from: v.from || null, to: v.to || null, wide: !!v.wide };
      const key = JSON.stringify(next);
      if (key === curKey) return;
      cur = next; curKey = key;
      play(cur, sceneOf(cur, P), false);
    }
    // The map's box changed size: jump straight to where the current view ends up.
    function resize() {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height || (Math.abs(r.width - px.w) < 1 && Math.abs(r.height - px.h) < 1)) return;
      px = { w: r.width, h: r.height };
      play(cur, sceneOf(cur, P), true);
    }
    const watcher = typeof root.ResizeObserver === 'function' ? new root.ResizeObserver(resize) : null;
    if (watcher) watcher.observe(host); else root.addEventListener('resize', resize);
    resize();

    return {
      show, resize,
      onPick(fn) { pick = typeof fn === 'function' ? fn : null; },
      destroy() {
        run++;
        if (watcher) watcher.disconnect(); else root.removeEventListener('resize', resize);
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    };
  }

  const api = { project, fitBox, arcPath, outlinePath, linePath, sceneOf, create, MIN_SPAN };
  root.sjFirst = root.sjFirst || {};
  root.sjFirst.travelMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
