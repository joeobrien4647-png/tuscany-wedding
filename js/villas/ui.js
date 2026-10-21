// The explorer's controls: search, the dock (places and floors), light and graphics, the card that shows a
// room or a place with its snippet, and the labels pinned in the scene. The markup lives in villas.html. `app` is
// the navigation (experience/nav.js), `api` the seam: places, cards and photos come from its registries.
import { STATUS } from './api.js';
import { fillPin } from './experience/pins.js';
import { markStill, saveCanvas, shareLink } from './experience/keep.js';

const GFX_NAMES = { auto: 'Auto', fast: 'Fast', balanced: 'Balanced', best: 'Best' };
const GFX_ORDER = ['auto', 'fast', 'balanced', 'best'];
const GFX_NOTES = { fast: 'Fast: smoothest on phones', balanced: 'Balanced: soft contact shadows, and a glow after dark', best: 'Best: softer shadows and glowing lights' };
const BED_ICON = '<svg class="vx-room-bed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-9M3 14h18v4M21 14v-2.5a2.5 2.5 0 0 0-2.5-2.5H11v5M5.5 12.2a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHARED_NAMES = { 'santarsa-salone': 'Salone', 'santarsa-kitchen': 'Kitchen', 'vallorsaia-salone': 'Old stable', 'vallorsaia-big-kitchen': 'Big kitchen' };

export function createUI(app, root, api) {
  const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
  const card = $('vx-card');
  const results = $('vx-results');
  const input = $('vx-q');
  const stage = $('vx-stage');
  let cardSpec = null;
  let active = -1;
  let current = [];

  // ---------- search ----------
  function renderResults(list) {
    current = list;
    active = list.length ? 0 : -1;
    if (!input.value.trim()) { results.hidden = true; return; }
    results.innerHTML = list.length
      ? list.map((r, i) => `<li role="option" id="vx-r${i}" aria-selected="${i === active}" data-i="${i}" class="vx-result vx-result--${r.type}">
          <span class="vx-result-title">${esc(r.title)}${r.tag ? ` <span class="vx-result-tag">${esc(r.tag)}</span>` : ''}</span><span class="vx-result-sub">${esc(r.sub || '')}</span></li>`).join('')
      : '<li class="vx-result vx-result--none" aria-disabled="true"><span class="vx-result-title">Nothing by that name</span><span class="vx-result-sub">Try pool, pizza oven, sunset or bedrooms</span></li>';
    results.hidden = false;
    input.setAttribute('aria-activedescendant', active >= 0 ? `vx-r${active}` : '');
  }

  function choose(r) {
    if (!r) return;
    results.hidden = true;
    input.value = '';
    input.blur();
    if (r.layer || r.type === 'time') self.onChoose?.(r);
    else if (r.type === 'room') app.showRoom(r.id);
    else if (r.type === 'place') app.showPlace(r.id);
    else if (r.type === 'note') app.showNote(r.id);
    else if (r.type === 'villa') app.openVilla(r.id);
    else self.onChoose?.(r);
  }

  input.addEventListener('input', () => renderResults(app.search(input.value)));
  input.addEventListener('focus', () => { if (input.value.trim()) renderResults(app.search(input.value)); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!current.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + current.length) % current.length;
      results.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', `vx-r${active}`);
    } else if (e.key === 'Escape') {
      results.hidden = true;
    }
  });
  $('vx-search').addEventListener('submit', (e) => { e.preventDefault(); choose(current[Math.max(0, active)]); });
  results.addEventListener('pointerdown', (e) => e.preventDefault());
  results.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) choose(current[Number(li.dataset.i)]);
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#vx-search')) results.hidden = true; });

  // ---------- dock, floors, light, graphics ----------
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    hideCard();
    if (b.dataset.go === 'estate') app.goEstate();
    else app.openVilla(b.dataset.go);
  }));
  root.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.floor === 'outside' ? 'outside' : Number(b.dataset.floor);
    app.setFloor(f);
  }));
  root.querySelectorAll('[data-moment]').forEach((b) => b.addEventListener('click', () => app.setMoment(b.dataset.moment)));
  const gfxBtn = $('vx-gfx-btn'), gfxMenu = $('vx-gfx-menu');
  gfxBtn.addEventListener('click', () => {
    gfxMenu.hidden = !gfxMenu.hidden;
    gfxBtn.setAttribute('aria-expanded', String(!gfxMenu.hidden));
  });
  gfxMenu.addEventListener('change', (e) => { if (e.target.name === 'vx-gfx') app.setGraphics(e.target.value); });
  const closeMenu = () => { gfxMenu.hidden = true; gfxBtn.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('pointerdown', (e) => {
    if (!gfxMenu.hidden && !e.target.closest('.vx-gfx')) closeMenu();
  });
  gfxMenu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); gfxBtn.focus(); } });

  // ---------- card ----------
  const body = card.querySelector('.vx-card-body');
  const markMore = () => body.classList.toggle('has-more', body.scrollHeight - body.scrollTop - body.clientHeight > 6);
  body.addEventListener('scroll', markMore, { passive: true });
  new ResizeObserver(markMore).observe(body);
  $('vx-photo-img').addEventListener('load', markMore);
  $('vx-card-close').addEventListener('click', () => hideCard());
  $('vx-card-actions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'look') app.lookFromHere();
    else if (a === 'next-place') app.nextPlace(1);
    else if (a === 'floor-0') app.setFloor(0);
    else if (a === 'floor-1') app.setFloor(1);
    else if (a === 'close') hideCard();
    else self.onAction?.(a, cardSpec);
  });
  $('vx-card-moment').addEventListener('click', () => { if (cardSpec?.moment) app.setMoment(cardSpec.moment); });
  $('vx-inside-more').addEventListener('click', () => {
    const c = api.cards.get('interiors');
    if (c) showCard({ kind: 'note', kicker: c.kicker, title: c.title, text: c.text, facts: c.facts, status: c.status, actions: [{ id: 'close', label: 'Got it' }] });
  });
  $('vx-tour').addEventListener('click', () => api.use('nav').tour());
  // a saved snippet carries the model's honesty line, and "How it could look" when the spot is an idea or indoors
  const snapIsIdea = () => {
    const place = cardSpec?.placeId && api.places.get(cardSpec.placeId);
    return !!place && (place.status === 'idea' || !!place.layer || !!place.room);
  };
  $('vx-snap-save').addEventListener('click', async () => {
    const src = $('vx-snap-img').getAttribute('src');
    if (!src || !cardSpec?.placeId) return;
    const name = `la-conca-${cardSpec.placeId}-${app.state.moment || clockName()}.jpg`;
    saveCanvas(await markStill(src, { idea: snapIsIdea() }), name, { ui: self, root, type: 'image/jpeg' });
  });
  $('vx-snap-share').addEventListener('click', () => {
    if (!cardSpec?.placeId) return;
    const url = new URL(location.href);
    url.search = `?place=${cardSpec.placeId}`;
    url.hash = '';
    // the share sheet on phones and tablets only, as Share this view does
    shareLink(url.href, { ui: self, root, sheetOk: api.coarse, copied: 'Link to this spot copied' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden && !e.target.closest('#vx-search')) hideCard();
  });

  const clockName = () => { const m = Math.round(api.time.get()); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`; };
  const photoOf = (p) => (p && typeof p === 'object' && p.src ? p : null);

  function showCard(spec) {
    cardSpec = spec;
    card.dataset.kind = spec.kind;
    card.classList.toggle('is-caption', spec.kind === 'caption');
    $('vx-card-kicker').textContent = spec.kicker || '';
    const status = spec.status ?? (spec.placeId && api.places.get(spec.placeId)?.status);
    const said = spec.tag || STATUS[status] || '';
    const tag = said.toLowerCase() === String(spec.kicker || '').toLowerCase() ? '' : said;   // the kicker says it already
    $('vx-card-status').hidden = !tag;
    $('vx-card-status').textContent = tag;
    $('vx-card-status').dataset.status = status || '';
    $('vx-card-title').innerHTML = spec.title || '';
    $('vx-card-text').textContent = spec.text || '';
    $('vx-card-facts').innerHTML = (spec.facts || []).map((f) => `<li>${esc(f)}</li>`).join('');
    const where = $('vx-card-where');
    where.hidden = !spec.where;
    where.textContent = spec.where || '';
    where.classList.toggle('is-approx', !!spec.approx);
    const note = $('vx-card-note');
    note.hidden = !spec.note;
    note.textContent = spec.note || '';
    const photo = $('vx-photo');
    const ph = spec.photo && photoOf(spec.photo);
    photo.hidden = !ph;
    if (ph) { $('vx-photo-img').src = ph.src; $('vx-photo-img').alt = ph.alt; }
    const snap = $('vx-snap');
    snap.hidden = spec.kind !== 'place';
    snap.classList.toggle('is-loading', spec.kind === 'place');
    if (spec.kind === 'place') $('vx-snap-img').removeAttribute('src');
    $('vx-card-actions').innerHTML = (spec.actions || []).map((a) => `<button type="button" class="vx-btn${a.id === 'next-place' || a.primary ? ' vx-btn--primary' : ''}" data-action="${esc(a.id)}">${esc(a.label)}</button>`).join('');
    updateMomentButton();
    card.hidden = false;
    root.classList.add('has-card');
    card.scrollTop = 0;
    body.scrollTop = 0;
    markMore();
  }

  function updateMomentButton() {
    const b = $('vx-card-moment');
    const m = cardSpec?.moment;
    b.hidden = !m || app.state.moment === m;
    if (m) b.textContent = m === 'sunset' ? 'See it at sunset' : m === 'night' ? 'See it at night' : 'See it by day';
  }

  function setSnapshot(url, tag) {
    const snap = $('vx-snap');
    if (!url) { snap.hidden = true; return; }
    $('vx-snap-img').src = url;
    $('vx-snap-img').alt = `How ${cardSpec?.kicker || 'this spot'} looks in the model at ${tag.toLowerCase()}`;
    $('vx-snap-tag').textContent = tag;
    snap.classList.remove('is-loading');
  }

  function hideCard({ keepSelection = false } = {}) {
    const was = cardSpec;
    card.hidden = true;
    card.classList.remove('is-caption');
    root.classList.remove('has-card');
    cardSpec = null;
    if (was) self.onHide?.(was);
    if (!keepSelection) {
      if (app.state.selected?.type === 'room') app.estate.highlight(null);
      app.state.selected = null;
      update(app.state);
    }
  }

  // ---------- state to controls ----------
  function update(state) {
    root.querySelectorAll('[data-go]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === state.view)));
    const floors = $('vx-floors');
    floors.hidden = state.view === 'estate';
    root.querySelectorAll('[data-floor]').forEach((b) => b.setAttribute('aria-pressed', String(String(state.floor) === b.dataset.floor)));
    root.querySelectorAll('[data-moment]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.moment === state.moment)));
    root.dataset.view = state.view;
    root.dataset.floor = String(state.floor);
    // a cut-open floor is furnished as an idea: say so for as long as it is open
    const inside = state.view !== 'estate' && state.floor !== 'outside';
    $('vx-inside').hidden = !inside;
    root.classList.toggle('has-inside', inside);
    const sel = state.selected?.type === 'room' ? state.selected.id : null;
    root.querySelectorAll('.vx-room').forEach((el) => el.classList.toggle('is-selected', el.dataset.room === sel));
    updateMomentButton();
    api.view.set(Object.freeze({ view: state.view, floor: state.floor, selected: state.selected ? { ...state.selected } : null }));
    app.refreshLabels?.();
  }

  function setTour(on) { $('vx-tour').setAttribute('aria-pressed', String(on)); $('vx-tour').title = on ? 'Stop the tour' : 'Take the tour'; }

  // the modes the renderer has, in the seam's order (v1: Auto, Fast, Best; realism adds Balanced)
  const modesBox = $('vx-gfx-modes');
  function setGraphics(mode, tier) {
    const have = GFX_ORDER.filter((m) => (app.pipeline?.MODES || GFX_ORDER).includes(m));
    if (modesBox.dataset.modes !== have.join()) {
      modesBox.dataset.modes = have.join();
      modesBox.innerHTML = have.map((m) => `<label><input type="radio" name="vx-gfx" value="${m}"> ${GFX_NAMES[m]}</label>`).join('');
    }
    root.querySelectorAll('input[name=vx-gfx]').forEach((r) => { r.checked = r.value === mode; });
    $('vx-gfx-note').textContent = mode === 'auto' ? `Auto is using ${GFX_NAMES[tier] || tier} here` : GFX_NOTES[mode] || '';
    root.dataset.tier = tier;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('vx-toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  // ---------- labels in the scene ----------
  function villaTag(v) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'vx-tag';
    el.innerHTML = `<span class="vx-tag-name">${esc(v.name)}</span><span class="vx-tag-sub">${v.bedrooms} bedrooms · sleeps ${v.sleeps}</span>`;
    el.addEventListener('click', () => app.openVilla(v.id));
    return el;
  }

  // a place's pin; experience/pins.js fills it again when a weekend chip points at it
  function pin(place) {
    const el = document.createElement('button');
    el.type = 'button';
    fillPin(el, place);
    el.addEventListener('click', () => app.showPlace(place.id));
    return el;
  }

  // bedrooms get a bed icon and no number: La Conca has not published its room numbers or the beds in each
  function roomTag(r, place) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `vx-room${r.bedroom ? '' : ' vx-room--shared'}`;
    el.dataset.room = r.id;
    if (r.bedroom) {
      el.setAttribute('aria-label', 'Bedroom');
      el.title = 'Bedroom';
      el.innerHTML = BED_ICON;
      el.addEventListener('click', () => app.showRoom(r.id));
    } else {
      el.innerHTML = `<span class="vx-room-name">${esc(place?.label || SHARED_NAMES[r.id] || 'Shared')}</span>`;
      el.addEventListener('click', () => app.showPlace(place.id));
    }
    return el;
  }

  // the snippet's shape: wide on phones (the card is short), a little taller on computers
  const snapAspect = () => (stage.clientWidth < 640 ? 2 : 1.6);

  const self = { update, showCard, hideCard, setSnapshot, setGraphics, setTour, toast, villaTag, pin, roomTag, snapAspect,
    get card() { return cardSpec; }, onAction: null, onHide: null, onChoose: null };
  return self;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
