// Tour 2.0: one continuous flight of about 80 seconds on a Catmull-Rom spline, the look point running a little ahead
// of the camera, the clock sweeping from 17:00 to 21:30 on the way. It opens on the view west, then comes up the
// road from the Segheria fork, over Santarsa, down to the pool and the covered terrace, along the lane to Vallorsaia
// and its pool, out to the lookout and back to the view west, holding as the sun drops behind the ridge and the
// valley lights come on. Captions are the places' one-liners, not cards. Any touch, key or scroll stops it.
// With reduced motion it is a cross-fade of eye-level stills instead.
import { bearingDir, reducedMotion, clamp } from '../util.js';
import { strip } from './dom.js';

const LEAD = 0.7;           // seconds: the look point runs this far ahead of the camera
const TIME_STEP_MS = 150;   // the clock moves at most this often (each move redraws the sun's shadows)
// the clock through the flight: [seconds, minutes after midnight]
const CLOCK = [[0, 17 * 60], [59, 20 * 60 + 12], [66, 20 * 60 + 28], [73, 20 * 60 + 41], [79, 21 * 60 + 5], [85, 21 * 60 + 30]];

// Fritsch-Carlson monotone cubic through (x, y): smooth speed, never backwards; zero slope at both ends (the weekend
// mode's flights use it too)
export function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export function createTour(ctx) {
  const { api, ui, base, $ } = ctx;
  const THREE = api.THREE;
  const rig = api.use('rig'), ground = api.use('ground'), model = api.model;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const gy = (x, z) => ground.groundAt(x, z);

  // ---------- the route, from the model and the registry ----------
  function route() {
    const place = (id) => api.places.get(id);
    const anchor = (id, fallback) => place(id)?.anchor?.() || fallback;
    const villa = (id) => {
      const v = model.villas.find((x) => x.id === id);
      const c = v.blocks.reduce((s, b) => [s[0] + b.c[0] / v.blocks.length, s[1] + b.c[1] / v.blocks.length], [0, 0]);
      return { v, c: V(c[0], gy(c[0], c[1]), c[1]) };
    };
    const S = villa('santarsa'), W = villa('vallorsaia');
    const pool = (id) => { const p = model.pools.find((x) => x.villa === id); return { p, c: V(p.c[0], p.level, p.c[1]) }; };
    const P1 = pool('santarsa'), P2 = pool('vallorsaia');
    const road = model.roads.find((r) => r.id === 'access-road')?.points || [[-230, 260], [-80, 190]];
    const link = model.roads.find((r) => r.id === 'link-santarsa-vallorsaia')?.points || [[-79, 190], [-18, -197]];
    const at = (pts, k) => { const p = pts[clamp(Math.round(pts.length * k), 0, pts.length - 1)]; return V(p[0], gy(p[0], p[1]), p[1]); };
    const fork = V(link[0][0], gy(link[0][0], link[0][1]), link[0][1]);
    const sunsetShots = place('sunset')?.shots?.();
    const sunPos = sunsetShots?.fly?.pos ? V(sunsetShots.fly.pos.x, sunsetShots.fly.pos.y, sunsetShots.fly.pos.z) : S.c.clone().add(V(120, 95, 60));
    const sunTarget = sunsetShots?.fly?.target ? V(sunsetShots.fly.target.x, sunsetShots.fly.target.y, sunsetShots.fly.target.z) : S.c.clone().add(bearingDir(290).multiplyScalar(900)).setY(-70);
    const terrace = anchor('santarsa-terrace', P1.c.clone().add(V(-10, 3, 0)));
    const lookout = api.places.all((p) => /lookout/.test(p.id))[0];
    const lookoutAt = lookout?.anchor?.() || V(W.v.view[0], gy(W.v.view[0], W.v.view[1]), W.v.view[1]).add(bearingDir(268).multiplyScalar(40));
    const westFar = (from, drop = 60) => from.clone().add(bearingDir(286).multiplyScalar(1000)).setY(from.y - drop);
    const roadA = at(road, 0.55), roadB = at(road, 0.8);
    const poolLook = bearingDir(282);
    const p1end = P1.c.clone().addScaledVector(poolLook, -(P1.p.length / 2 + 3));
    const p2side = P2.c.clone().add(bearingDir(80).multiplyScalar(P2.p.length / 2 + 4));

    // [seconds, camera, look point, lens, caption id]
    // close-ups come in pairs with one look point, so the camera lingers on the place its caption names
    const poolAim = P1.c.clone().addScaledVector(poolLook, 40).setY(P1.c.y - 3);
    const p2aim = P2.c.clone().add(bearingDir(262).multiplyScalar(2)).setY(P2.c.y - 1.5);
    return [
      [0, sunPos.clone().add(V(-30, 60, 40)), sunTarget, 44, 'sunset'],
      [6, sunPos.clone().add(V(-140, 40, 60)), roadA.clone().setY(roadA.y + 10), 46, 'sunset'],
      [12, roadA.clone().add(V(-30, 24, 14)), fork.clone().setY(fork.y + 4), 50, 'card:estate'],
      [17, fork.clone().add(V(-18, 15, 4)), S.c.clone().setY(S.c.y + 5), 52, 'card:estate'],
      [22, roadB.lerp(S.c, 0.75).setY(S.c.y + 22), S.c.clone().setY(S.c.y + 3), 50, 'card:villa:santarsa'],
      [27, S.c.clone().add(V(-8, 36, -26)), P1.c.clone().setY(P1.c.y + 1), 52, 'card:villa:santarsa'],
      [31, p1end.clone().setY(P1.c.y + 3.4), poolAim, 58, 'santarsa-pool'],
      [34.5, p1end.clone().addScaledVector(poolLook, 3).setY(P1.c.y + 2.6), poolAim, 58, 'santarsa-pool'],
      [37.5, terrace.clone().add(V(7, 0.5, 11)), terrace.clone().setY(terrace.y - 3), 56, 'santarsa-terrace'],
      [40.5, terrace.clone().add(V(2, 5, 9)), terrace.clone().setY(terrace.y - 3.5), 54, 'santarsa-terrace'],
      [45.5, at(link, 0.3).add(V(-14, 30, 10)), at(link, 0.55).add(V(0, 6, 0)), 50, 'lane'],
      [50.5, at(link, 0.6).add(V(-10, 28, 0)), W.c.clone().setY(W.c.y + 4), 50, 'lane'],
      [55, W.c.clone().add(V(58, 32, 44)), W.c.clone().setY(W.c.y + 3), 50, 'card:villa:vallorsaia'],
      [59, p2side.clone().setY(P2.c.y + 7), p2aim, 56, 'vallorsaia-pool'],
      [62, p2side.clone().add(bearingDir(170).multiplyScalar(5)).setY(P2.c.y + 6), p2aim, 54, 'vallorsaia-pool'],
      [67, lookoutAt.clone().add(V(16, 14, 6)), westFar(lookoutAt, 40), 48, lookout ? lookout.id : 'sunset'],
      [73, sunPos.clone(), sunTarget, 42, 'sunset'],
      [85, sunPos.clone().add(V(14, -6, 26)), sunTarget.clone().add(V(0, -10, 0)), 40, 'sunset'],
    ];
  }

  // ---------- captions: a slim strip at the bottom, from the registries ----------
  function caption(id) {
    if (!id) return null;
    if (id.startsWith('card:')) {
      const c = api.cards.get(id.slice(5));
      return c && { kicker: c.kicker, title: c.title, place: null };
    }
    const p = api.places.get(id);
    return p && { kicker: p.kicker, title: p.title, place: p.id };
  }
  let shown = null;
  function showCaption(id) {
    if (id === shown) return;
    shown = id;
    const c = caption(id);
    if (!c) return;
    if (c.place) base.state.selected = { type: 'place', id: c.place };
    ctx.tourAt = c.place;
    ui.showCard({ kind: 'caption', kicker: c.kicker, title: c.title, text: '', actions: [] });
    ui.update(base.state);
  }

  // the last caption lingers a moment after the flight lands, then goes
  function fadeCaption() {
    const spec = ui.card;
    setTimeout(() => { if (ui.card === spec && spec?.kind === 'caption') ui.hideCard(); }, 3500);
  }

  // ---------- the flight ----------
  let touring = null;
  function stop({ keepCaption = false } = {}) {
    if (!touring) return;
    const t = touring;
    touring = null;
    t.cancel?.();
    if (rig.driving) rig.release({ limits: { min: 4, max: 2600 } });
    ctx.tourAt = null;
    shown = null;
    ui.setTour(false);
    $('explorer').classList.remove('is-touring');
    if (!keepCaption && ui.card?.kind === 'caption') ui.hideCard();
    api.loop.request();
  }

  function fly(token) {
    const keys = route();
    const n = keys.length;
    const times = keys.map((k) => k[0]);
    const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal');
    const tgtCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[2]), false, 'centripetal');
    const lensAt = monotone(times, keys.map((k) => k[3]));
    const uAt = monotone(times, keys.map((_, i) => i));
    const clockAt = monotone(CLOCK.map((c) => c[0]), CLOCK.map((c) => c[1]));
    const end = times[n - 1];
    let t = 0, lastClock = -Infinity;
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    api.time.set(clockAt(0));
    rig.drive((dt) => {
      if (touring !== token) return null;
      t += Math.min(dt, 0.1);
      const u = uAt(t);
      posCurve.getPoint(u / (n - 1), pos);
      tgtCurve.getPoint(uAt(t + LEAD) / (n - 1), tgt);
      pos.y = Math.max(pos.y, gy(pos.x, pos.z) + 2.2);
      const now = performance.now();
      if (now - lastClock > TIME_STEP_MS) { lastClock = now; api.time.set(clockAt(t)); }
      const i = Math.min(n - 1, Math.round(u));
      showCaption(keys[i][4]);
      api.loop.wake();
      if (t >= end) setTimeout(() => { if (touring === token) { api.time.set(clockAt(end)); stop({ keepCaption: true }); fadeCaption(); } }, 0);
      return { pos, target: tgt, fov: lensAt(t) };
    });
  }

  // reduced motion: eye-level stills of each place, cross-faded, the clock set for each
  async function stills(token) {
    const list = ['sunset', 'santarsa-pool', 'santarsa-terrace', 'lane', 'vallorsaia-pool', 'sunset'].map((id) => api.places.get(id)).filter(Boolean);
    const box = $('vx-stills'), frame = box.querySelector('.vx-stills-frame');
    const clocks = [17 * 60, 18 * 60 + 10, 19 * 60, 19 * 60 + 40, 20 * 60 + 15, 20 * 60 + 40];
    box.hidden = false;
    for (let i = 0; i < list.length && touring === token; i++) {
      api.time.set(clocks[i] ?? 20 * 60 + 40);
      const eye = list[i].shots?.()?.eye;
      const url = eye ? await base.snapshot(eye) : '';
      if (touring !== token) break;
      const img = document.createElement('img');
      img.alt = `${strip(list[i].kicker)}, in the model`;
      img.src = url;
      frame.append(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('is-in')));
      [...frame.children].slice(0, -2).forEach((el) => el.remove());
      showCaption(list[i].id);
      await new Promise((r) => setTimeout(r, 4200));
    }
    if (touring === token) { stop({ keepCaption: true }); fadeCaption(); }
  }

  function start() {
    if (touring) { stop(); return; }
    ui.hideCard();
    ctx.stopOthers?.();
    $('explorer').classList.add('is-touring');
    ui.setTour(true);
    const token = {};
    touring = token;
    if (reducedMotion) {
      token.cancel = () => { const box = $('vx-stills'); box.hidden = true; box.querySelector('.vx-stills-frame').innerHTML = ''; };
      stills(token);
    } else fly(token);
  }

  // anything the guest does stops it: a touch anywhere but the tour button, a key, the wheel. A touch on the caption
  // (its close button included) leaves it up for the click to deal with: hidden at the touch, the click that follows
  // lands on whatever was under it (WebKit opened the pool's card under the close button)
  const root = api.root;
  root.addEventListener('pointerdown', (e) => { if (touring && !e.target.closest('#vx-tour')) stop({ keepCaption: !!e.target.closest('#vx-card') }); }, { capture: true });
  // (Enter or Space on the tour button itself toggles it through its click)
  // keys anywhere on the page count (a clicked button keeps no focus in Safari, so the key may come from the body)
  document.addEventListener('keydown', (e) => {
    if (!touring || ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.target.closest?.('#vx-tour') && (e.key === 'Enter' || e.key === ' ')) return;
    stop();
  }, { capture: true });
  root.addEventListener('wheel', () => { if (touring) stop(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop({ keepCaption: true }); });
  rig.onEvent((e) => { if (e === 'released' && touring) stop(); });

  return { start, stop, get touring() { return !!touring; }, route };
}
