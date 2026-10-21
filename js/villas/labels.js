// HTML labels pinned to points in the scene: hotspots, villa names, room tags and (v2) landmarks across the
// valley. Each frame the camera moved, every visible label is projected to the screen and moved with a transform.
// Names and pins that would land on top of a more important one step aside (hide) until there is room; room tags
// always show. An item may carry `when()`, checked every update on top of setShown (v2 labels the v1 filter does
// not know about), and `anchor`: 'dot' (a pin's dot sits on the spot), 'centre', or 'foot' (the label stands on it).
import * as THREE from './vendor/three-core.js';

export function createLabels(layer, camera) {
  const items = new Map();
  const v = new THREE.Vector3();
  let w = 1, h = 1;
  let order = 0;

  function add(id, { position, el, group = 'pin', minDist = 0, maxDist = Infinity, priority = null, when = null, anchor = null, clip = false }) {
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.willChange = 'transform';
    el.hidden = true;
    layer.appendChild(el);
    const rank = priority ?? (group === 'villa' ? 0 : group === 'pin' ? 10 + order++ : 1000);
    const item = { id, position: position.clone(), el, group, minDist, maxDist, rank, shown: true, onScreen: false, when, clip,
      anchor: anchor || (group === 'pin' ? 'dot' : group === 'villa' ? 'foot' : 'centre') };
    items.set(id, item);
    return item;
  }

  function remove(id) {
    const it = items.get(id);
    if (!it) return;
    it.el.remove();
    items.delete(id);
  }

  function setShown(filter) {
    items.forEach((it) => { it.shown = filter(it); });
  }

  function resize(width, height) { w = width; h = height; }

  function hide(it) {
    if (it.onScreen) { it.el.hidden = true; it.onScreen = false; }
  }

  // size and anchor, measured once the label has been laid out
  function measure(it) {
    if (it.size) return;
    it.el.hidden = false;
    const width = it.el.offsetWidth, height = it.el.offsetHeight;
    if (!width) return;
    const left = it.anchor === 'dot' ? 11 : width / 2;
    const up = it.anchor === 'foot' ? height : height / 2;
    it.size = { width, height, left, up };
  }

  // labels marked `clip` stay out of the band the page's own controls cover at the top of the stage
  let clipTop = () => 0;
  function setClip(fn) { clipTop = fn; }

  // the page's controls over the model (rects in stage pixels, `side` for the button column a label may slide left
  // of), and whether something solid stands between the camera and a label's spot (hills, woods, buildings)
  let obstacles = () => [];
  let occluded = null;
  function setObstacles(fn) { obstacles = fn; }
  function setOccluder(fn) { occluded = fn; }
  const hit = (r, q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0;
  // an occlusion answer is kept until the camera has moved half a metre
  function hiddenBehind(it) {
    if (!occluded) return false;
    const c = camera.position;
    if (!it.occ || it.occ.at.distanceToSquared(c) > 0.25) it.occ = { at: c.clone(), hidden: occluded(c, it.position, it) };
    return it.occ.hidden;
  }

  function update() {
    const placed = [];
    const top = clipTop();
    const blocks = obstacles();
    const visible = [];
    items.forEach((it) => {
      if (!it.shown || (it.when && !it.when())) return hide(it);
      const d = camera.position.distanceTo(it.position);
      v.copy(it.position).project(camera);
      if (!(v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 && d >= it.minDist && d <= it.maxDist)) return hide(it);
      visible.push({ it, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, d });
    });
    visible.sort((a, b) => a.it.rank - b.it.rank);
    for (const p of visible) {
      const { it, d } = p;
      let { x, y } = p;
      if (it.group !== 'room') {
        if (hiddenBehind(it)) { hide(it); continue; }
        measure(it);
        const s = it.size;
        if (s && it.clip && y - s.up < top + 4) { it.el.hidden = true; it.onScreen = false; continue; }
        if (s) {
          // keep names and pins whole at the stage's edges, clear of the page's controls, and off each other
          x = Math.min(Math.max(x, s.left + 6), w - (s.width - s.left) - 6);
          let r = { x0: x - s.left - 4, x1: x - s.left + s.width + 4, y0: y - s.up - 3, y1: y - s.up + s.height + 3 };
          for (const q of blocks) {
            if (!hit(r, q)) continue;
            // slide left of the button column, or down below the search bar, rather than vanish
            if (q.side) { x -= r.x1 - q.x0; r = { ...r, x0: x - s.left - 4, x1: x - s.left + s.width + 4 }; }
            else if (q.top && r.y0 < q.y1 && y < q.y1 + 40) { const dy = q.y1 + 4 - r.y0; y += dy; r = { ...r, y0: r.y0 + dy, y1: r.y1 + dy }; }
          }
          // measure() shows a label to size it: one turned away here is hidden again even if it never showed
          if (r.x0 < 0 || r.y0 < 0 || r.y1 > h || blocks.some((q) => hit(r, q)) || placed.some((q) => hit(r, q))) { it.el.hidden = true; it.onScreen = false; continue; }
          placed.push(r);
        }
      }
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      it.el.style.zIndex = String(Math.max(1, 1000 - Math.round(d / 10)));
      if (!it.onScreen) { it.el.hidden = false; it.onScreen = true; }
    }
  }

  // a label whose words changed size measures itself again
  function remeasure(id) { const it = items.get(id); if (it) it.size = null; }

  return { add, remove, setShown, resize, update, remeasure, setClip, setObstacles, setOccluder, items };
}
