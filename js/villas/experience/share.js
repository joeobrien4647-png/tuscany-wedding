// Share a view: the camera in the link (?v=x,y,z,tx,ty,tz,fov in metres to a decimetre, the lens in degrees), the
// clock (&t=20:35) and any layer that is on (&l=wedding). Nothing personal. On load the view is clamped to the
// estate's bounds; ?place= and ?villa= links still work as in v1.
import { DAY, toHHMM, toMinutes } from '../api.js';
import { clamp } from '../util.js';
import { shareLink } from './keep.js';

const BOUNDS = 1400;        // the look point stays this close to the middle of the estate (camera.js keeps the same)
const REACH = 3000;         // and the camera this close to the look point
const r1 = (n) => String(Math.round(n * 10) / 10);

export function installShare(ctx) {
  const { api, $, ui } = ctx;
  const rig = api.use('rig'), ground = api.use('ground');
  const THREE = api.THREE;

  function link() {
    const c = rig.camera.position, t = rig.controls.target;
    const parts = [`v=${[c.x, c.y, c.z, t.x, t.y, t.z].map(r1).join(',')},${Math.round(rig.lens)}`, `t=${toHHMM(api.time.get())}`];
    const on = api.layers.all().filter((l) => api.layers.isOn(l.id)).map((l) => l.id);
    if (on.length) parts.push(`l=${on.join(',')}`);
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    return `${url.href}?${parts.join('&')}#explorer`;
  }

  async function share() {
    const url = link();
    await shareLink(url, { ui, root: api.root, sheetOk: api.coarse, copied: 'Link to this view copied' });
    return url;
  }

  // a shared view, made safe: finite numbers, the look point inside the estate's bounds, the camera above ground
  function parse(v) {
    const n = String(v || '').split(',').map(Number);
    if (n.length < 6 || n.slice(0, 6).some((x) => !Number.isFinite(x))) return null;
    const pos = new THREE.Vector3(n[0], n[1], n[2]), target = new THREE.Vector3(n[3], n[4], n[5]);
    const fov = clamp(Number.isFinite(n[6]) ? n[6] : 40, 15, 80);
    const flat = Math.hypot(target.x, target.z);
    if (flat > BOUNDS) { const k = BOUNDS / flat; const move = new THREE.Vector3(target.x * (k - 1), 0, target.z * (k - 1)); target.add(move); pos.add(move); }
    target.y = clamp(target.y, ground.heightAt(target.x, target.z) - 200, 2500);
    const off = pos.clone().sub(target);
    if (off.length() > REACH) pos.copy(target).addScaledVector(off.normalize(), REACH);
    if (off.length() < 0.2) pos.copy(target).add(new THREE.Vector3(0, 0.5, 1));
    pos.y = clamp(pos.y, ground.groundAt(pos.x, pos.z) + 1.2, 4000);
    return { pos, target, fov };
  }

  function show(view) {
    const above = view.pos.y - ground.groundAt(view.pos.x, view.pos.z);
    const d = view.pos.distanceTo(view.target);
    const polar = Math.acos(clamp((view.pos.y - view.target.y) / Math.max(d, 1e-6), -1, 1));
    const eye = above < 3;
    rig.jumpTo({ pos: view.pos, target: view.target, fov: view.fov, fixed: true, eye, limits: { min: Math.min(0.5, d), max: Math.max(3200, d), maxPolar: Math.max(eye ? 2.6 : 1.55, polar + 0.01) } });
    api.loop.request();
  }

  // ?w=<moment>&o=<option> opens the weekend mode (?w=reel waits for a tap)
  function applyLink(params = api.params) {
    const w = params.get('w');
    if (w && /^[a-z-]{1,24}$/.test(w)) { ctx.weekend.open(w, { option: params.get('o') }); return true; }
    const t = params.get('t');
    const hm = /^(\d{1,2}):(\d{2})$/.exec(t || '');
    if (hm && +hm[1] <= 24 && +hm[2] < 60) api.time.set(clamp(toMinutes(t), DAY.start, DAY.end));
    const wanted = new Set((params.get('l') || '').split(',').filter(Boolean));
    const turnOn = (l) => { if (wanted.has(l.id)) { wanted.delete(l.id); ctx.layersUI.set(l.id, true); } };
    api.layers.all().forEach(turnOn);
    if (wanted.size) api.layers.on((op, l) => { if (op === 'add') turnOn(l); });
    const view = params.get('v') && parse(params.get('v'));
    if (view) show(view);
    return !!view;
  }

  $('vx-share-view')?.addEventListener('click', () => { ctx.closeMenu?.(); share(); });
  return { link, share, parse, show, applyLink };
}
