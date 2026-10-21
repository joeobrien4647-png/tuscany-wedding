// Places, notes and cards in the api's registries. Each place has anchor() (where its pin stands) and shots()
// ({ fly, eye }: the flight there and the eye-level snippet), worked out when asked, after the estate is built.
import * as THREE from '../vendor/three-core.js';
import { bearingDir, blockToWorld } from '../util.js';
import { STATUS } from '../api.js';
import { facePoint } from './houses.js';
import { PHOTOS, ESTATE, VILLAS, VILLA_WHERE, bedroomCard, LIVING, INTERIORS, TRAILS, PLACE_WORDS, NOTE_WORDS, WEDDING_PLACE_WORDS, CEREMONY_PLACE_WORDS, WEDDING_AT } from './words.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const photoOf = (key) => (key && PHOTOS[key] ? { ...PHOTOS[key] } : undefined);

// ctx is filled in by build(): { groundAt, estate, L, model }
export function createPlaces(api, L, ctx) {
  const model = api.model;
  const santarsa = model.villas.find((v) => v.id === 'santarsa');
  const S = L.santarsa, Vl = L.vallorsaia;
  const g = (x, z) => ctx.groundAt(x, z);
  const atGround = ([x, z], h = 0) => V3(x, g(x, z) + h, z);
  const atY = ([x, z], y) => V3(x, y, z);
  const boxAround = ([x, z], r, y1, y2) => ({ x1: x - r, x2: x + r, y1, y2, z1: z - r, z2: z + r });
  const fly = (box, bearing, elevation, margin = 0.06, limits = { min: 4, max: 900 }) => ({ frame: { box, bearing, elevation, margin }, limits });
  const eye = (pos, target, hfov = 72) => ({ pos, target, hfov });
  const look = (pos, bearing, pitch, dist = 60) => {
    const d = bearingDir(bearing), p = THREE.MathUtils.degToRad(pitch);
    return pos.clone().add(V3(d.x * Math.cos(p), Math.sin(p), d.z * Math.cos(p)).multiplyScalar(dist));
  };
  const link = model.roads.find((r) => r.id === 'link-santarsa-vallorsaia');
  const road = L.estate.access.points;
  const mid = link.points[Math.floor(link.points.length / 2)];
  const sWest = santarsa.blocks[0];

  function villaBoxes() { return ['santarsa', 'vallorsaia'].map((id) => ctx.estate.box(id)); }

  function roomShots(key) {
    const r = ctx.estate.rooms.get(key);
    const pad = r.cell.row === null ? 2.5 : 3.2;
    const box = { x1: r.box.x1 - pad, x2: r.box.x2 + pad, y1: r.box.y1, y2: r.box.y2, z1: r.box.z1 - pad, z2: r.box.z2 + pad };
    const bearing = ctx.estate.floorBearing(r.villa);
    return { fly: { frame: { box, bearing, elevation: 62, margin: 0.04 }, limits: { min: 3, max: 600, maxPolar: 1.45 } }, eye: { frame: { box: { ...box }, bearing: bearing + 25, elevation: 48, margin: 0.02 }, hfov: 60 } };
  }

  const P = S.pool, T = S.tettoia, W = S.wing, C = S.chapel;
  const VP = Vl.pool, VT = Vl.tettoia, LO = Vl.lookout;
  // Vallorsaia's old oven (vallorsaia.js, buildOldOven): its iron door on the lower wing's south face, and out from it
  const lower = model.villas.find((v) => v.id === 'vallorsaia').blocks.find((b) => b.id === 'vallorsaia-lower');
  const onLower = (d, up) => { const q = facePoint(lower, 's', 1.25, lower.floor + up, d); return blockToWorld(lower, q.x, q.z).setY(q.y); };
  const t = S.terrace;
  const geo = {
    sunset: {
      anchor: () => V3(santarsa.view[0], 0, santarsa.view[1]).add(bearingDir(292).multiplyScalar(5200)).setY(-90),
      shots: () => {
        const e = blockToWorld(sWest, -sWest.length / 2 - 1.2, 0).setY(sWest.floor + 4.6);
        const v = V3(santarsa.view[0], 0, santarsa.view[1]);
        const pos = v.clone().add(bearingDir(118).multiplyScalar(230)).setY(g(v.x, v.z) + 95);
        return { fly: { pos, target: v.clone().add(bearingDir(290).multiplyScalar(900)).setY(-70), fov: 40, limits: { min: 4, max: 2600 } }, eye: eye(e, e.clone().add(bearingDir(291).multiplyScalar(1000)).setY(e.y - 70), 74) };
      },
    },
    'santarsa-pool': {
      anchor: () => atY(P.c, P.level + 2.2),
      shots: () => {
        const e = atY(P.w(3.2, -3.05), P.level + 1.65);
        return { fly: fly(boxAround(P.c, 16, P.level - 1, P.level + 3), 196, 36), eye: eye(e, look(e, 246, -7), 74) };
      },
    },
    'santarsa-terrace': {
      anchor: () => atY(T.c, T.floor + 4.8),
      shots: () => {
        const e = atY(T.w(5.7, 1.6), T.floor + 1.62);
        return { fly: fly(boxAround(T.c, 9, T.floor - 0.5, T.floor + 4.5), 255, 32, 0.08), eye: eye(e, atY(T.w(-6.2, -0.2), T.floor + 1.2), 78) };
      },
    },
    'santarsa-front': {
      anchor: () => atY(W.w(-1.0, t.z1 + 2.2), t.level + 3.6),
      shots: () => {
        const e = atY(W.w(-8.2, t.z1 + 3.3), t.level + 1.65);
        const box = { ...boxAround(W.w(4, 5), 15, t.level - 2, t.level + 9) };
        return { fly: fly(box, 192, 24), eye: eye(e, atY(W.w(9.6, 6.8), t.level + 2.6), 76) };
      },
    },
    chapel: {
      anchor: () => atY(C.c, C.b.floor + C.b.storeyH + C.b.ridgeOver + 2.2),
      shots: () => {
        const at = C.w(C.b.length / 2 + 5.4, -1.3);
        const e = atY(at, Math.max(C.b.floor, g(...at)) + 1.65);
        return { fly: fly(boxAround(C.c, 8, C.b.floor - 0.5, C.b.floor + 7), 196, 24, 0.08), eye: eye(e, atY(C.w(C.b.length / 2, 0.2), C.b.floor + 2.4), 66) };
      },
    },
    'vallorsaia-pool': {
      anchor: () => atY(VP.c, VP.level + 2.2),
      shots: () => {
        const back = bearingDir(82).multiplyScalar(VP.length / 2 + 2.2);
        const e = V3(VP.c[0] + back.x, VP.level + 1.65, VP.c[1] + back.z);
        const target = V3(VP.c[0], VP.level, VP.c[1]).add(bearingDir(262).multiplyScalar(60)).setY(VP.level - 4);
        return { fly: fly(boxAround(VP.c, 16, VP.level - 1, VP.level + 3), 112, 36), eye: eye(e, target, 74) };
      },
    },
    'vallorsaia-tettoia': {
      anchor: () => atY(VT.c, VT.floor + 4.0),
      shots: () => {
        const e = atGround(VT.w(2.7, 6.8), 1.65);
        return { fly: fly(boxAround(VT.c, 7, VT.floor - 0.5, VT.floor + 3.8), 250, 30, 0.08), eye: eye(e, atY(VT.w(-0.4, -1.6), VT.floor + 1.15), 74) };
      },
    },
    'vallorsaia-oven': {
      anchor: () => onLower(-0.9, 2.6),
      shots: () => {
        const mouth = onLower(-0.87, 0.73), e = onLower(-4.9, 0);
        e.y = Math.max(e.y, g(e.x, e.z)) + 1.65;
        return { fly: fly(boxAround([mouth.x, mouth.z], 7, mouth.y - 1.5, mouth.y + 4), 274, 28, 0.08), eye: eye(e, mouth, 72) };
      },
    },
    'vallorsaia-lookout': {
      anchor: () => atY(LO.c, LO.level + 2.6),
      shots: () => {
        // standing at the rail, eyes over it: the wall and rail along the bottom edge, the lake filling the rest
        const e = atY(LO.w(-1.2, LO.width / 2 - 1.0), LO.level + 1.75);
        return { fly: fly(boxAround(LO.c, 13, LO.level - 3, LO.level + 3), 70, 26), eye: eye(e, atY(LO.w(-2.0, 400), LO.level - 48), 74) };
      },
    },
    lane: {
      anchor: () => atGround(mid, 16),
      shots: () => {
        const p0 = link.points[Math.floor(link.points.length * 0.15)], p1 = link.points[Math.floor(link.points.length * 0.75)];
        const bs = villaBoxes();
        const box = { x1: Math.min(...bs.map((b) => b.x1)), x2: Math.max(...bs.map((b) => b.x2)), y1: -10, y2: 20, z1: Math.min(...bs.map((b) => b.z1)), z2: Math.max(...bs.map((b) => b.z2)) };
        // standing on the track among the oaks, looking along it towards Vallorsaia
        const pts = link.points, i = Math.floor(pts.length * 0.42);
        const ahead = pts[Math.min(pts.length - 1, i + 4)];
        void p0; void p1;
        return { fly: { frame: { box, bearing: 75, elevation: 48, margin: 0.06 }, limits: { min: 4, max: 2600 } }, eye: eye(atGround(pts[i], 1.7), atGround(ahead, 2.2), 70) };
      },
    },
    woods: {
      anchor: () => atGround([118, 150], 24),
      shots: () => {
        const a = atGround([118, 150], 24);
        // a few steps into the oak wood behind Santarsa, looking further in: trunks, scrub and the light through
        const mask = api.use('ground')?.mask;
        const from = [62, 212], dir = [198, -152], len = Math.hypot(...dir);
        let k = 0;
        while (mask && k < 260 && mask(from[0] + dir[0] / len * k, from[1] + dir[1] / len * k) < 0.85) k += 2;
        const at = (t) => [from[0] + dir[0] / len * t, from[1] + dir[1] / len * t];
        return { fly: { pos: a.clone().add(V3(-160, 90, 150)), target: a.clone().setY(a.y - 20), limits: { min: 4, max: 2600 } }, eye: eye(atGround(at(k + 10), 1.7), atGround(at(k + 60), 3.5), 72) };
      },
    },
    road: {
      anchor: () => atGround(road[Math.floor(road.length * 0.55)], 14),
      shots: () => {
        const i = Math.floor(road.length * 0.55);
        const pts = road.slice(Math.floor(road.length * 0.3));
        const box = { x1: Math.min(...pts.map((p) => p[0])) - 20, x2: Math.max(...pts.map((p) => p[0])) + 20, y1: -60, y2: 20, z1: Math.min(...pts.map((p) => p[1])) - 20, z2: Math.max(...pts.map((p) => p[1])) + 20 };
        return { fly: { frame: { box, bearing: 200, elevation: 42, margin: 0.06 }, limits: { min: 4, max: 2600 } }, eye: eye(atGround(road[i - 2], 1.7), atGround(road[i + 2], 1.0), 70) };
      },
    },
    'santarsa-parking': {
      anchor: () => atGround(S.parking.c, 3.2),
      shots: () => {
        const e = atGround(S.parking.w(-11, 3.5), 1.7);
        return { fly: fly(boxAround(S.parking.c, 14, -2, 8), 236, 34), eye: eye(e, atGround(S.parking.w(4, -1), 1.2), 72) };
      },
    },
    pond: {
      anchor: () => atY(L.estate.pond.c, L.estate.pond.level + 4),
      shots: () => {
        const c = L.estate.pond.c;
        const e = atGround([c[0] + 24, c[1] + 4], 1.7);
        return { fly: fly(boxAround(c, 40, L.estate.pond.level - 2, L.estate.pond.level + 12), 120, 40, 0.06, { min: 4, max: 1600 }), eye: eye(e, atY(c, L.estate.pond.level), 70) };
      },
    },
    'wedding-table': {
      anchor: () => atY(P.w(0, -4.6), P.level + 2.4),
      shots: () => ({ fly: fly(boxAround(P.c, 14, P.level - 1, P.level + 4), 205, 30), eye: eye(atY(P.w(-10.4, -4.4), P.level + 1.7), atY(P.w(9, -4.9), P.level + 0.8), 70) }),
    },
    'wedding-lights': {
      anchor: () => atY(T.c, T.floor + 5.2),
      shots: () => ({ fly: fly(boxAround(T.c, 9, T.floor - 0.5, T.floor + 4.5), 250, 26, 0.08), eye: eye(atY(T.w(6.3, -1.3), T.floor + 1.6), atY(T.w(-4.5, 0.4), T.floor + 2.5), 80) }),
    },
    'wedding-lawn': {
      anchor: () => atGround(W.w(-2.5, t.z2 + 4.0), 3.0),
      shots: () => {
        const e = atGround(W.w(-6.5, t.z2 + 7.0), 1.65);
        return { fly: fly(boxAround(W.w(-2.5, t.z2 + 4.0), 12, t.level - 6, t.level + 4), 215, 30), eye: eye(e, atGround(W.w(3.5, t.z2 + 2.5), 1.2), 72) };
      },
    },
    'wedding-lookout': {
      anchor: () => atGround(Vl.oak, 9.5),
      shots: () => {
        const e = atY(Vl.front.w(Vl.frontBlock.length / 2 + 1.4, -8.0), Vl.forecourt.level + 1.65);
        return { fly: fly(boxAround(Vl.oak, 14, Vl.forecourt.level - 2, Vl.forecourt.level + 12), 150, 26), eye: eye(e, atGround(Vl.oak, 6.5), 80) };
      },
    },
  };
  // ceremony spots, where the vignette stands, which way it faces (bearing), and where to stand to see it
  const cer = L.ceremony;
  Object.entries(cer).forEach(([id, c]) => {
    geo[id] = {
      anchor: () => atGround(c.at, 3.2),
      shots: () => {
        const back = bearingDir(c.facing + 180).multiplyScalar(9.5);
        const e = atGround([c.at[0] + back.x, c.at[1] + back.z], 1.7);
        const target = atGround(c.at, 0.9).add(bearingDir(c.facing).multiplyScalar(6));
        return { fly: fly(boxAround(c.at, 10, g(...c.at) - 1, g(...c.at) + 4), c.facing + 180 + 25, 28, 0.08), eye: eye(e, target, 70) };
      },
    };
  });

  function placeEntry(w) {
    const gfx = geo[w.id];
    const entry = {
      ...w, photo: photoOf(w.photo), label: w.short,   // label: the pin's name (experience's seam request 1)
      anchor: w.room ? () => { const r = ctx.estate.rooms.get(w.room); return r.centre.clone().setY(r.centre.y + 1.5); } : gfx.anchor,
      shots: w.room ? () => roomShots(w.room) : gfx.shots,
    };
    if (!entry.photo) delete entry.photo;
    if (w.layer === 'wedding') { entry.at = WEDDING_AT; entry.where = entry.where || 'Ideas from weddings here. Nothing is decided'; }
    if (!entry.pin && !w.room) entry.pin = { minDist: 10, maxDist: 620 };
    return entry;
  }

  return {
    places: [...PLACE_WORDS, ...WEDDING_PLACE_WORDS, ...CEREMONY_PLACE_WORDS].map(placeEntry),
    roomShots,
  };
}

export function registerWords(api, L, ctx, { ceremonyIdeas = true } = {}) {
  const { places, roomShots } = createPlaces(api, L, ctx);
  // the layer's places arrive with the layer (wedding.js): nothing "how it could look" exists until it is on
  places.filter((p) => !p.layer).forEach((p) => api.places.add(p));
  NOTE_WORDS.forEach((n) => api.notes.add({ ...n }));
  const photo = (k) => photoOf(k);
  api.cards.add({ id: 'estate', ...ESTATE, photo: photo(ESTATE.photo) });
  Object.entries(VILLAS).forEach(([id, c]) => api.cards.add({ id: `villa:${id}`, ...c, photo: photo(c.photo), where: VILLA_WHERE, villa: id }));
  api.model.villas.forEach((v) => {
    api.cards.add({ id: `bedroom:${v.id}`, ...bedroomCard(v), villa: v.id });
    api.cards.add({ id: `living:${v.id}`, ...LIVING, kicker: v.name, villa: v.id });
  });
  api.cards.add({ id: 'interiors', ...INTERIORS });
  api.cards.add({ id: 'trails', ...TRAILS });
  return { roomShots, layerPlaces: (withCeremony) => places.filter((p) => p.layer && (withCeremony || !p.ceremony)) };
}

export { STATUS };
