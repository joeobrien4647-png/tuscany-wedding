// Keeping a picture or a link: every still that leaves the page carries the model's honesty line (and "How it could
// look" when it shows an idea); saving says what really happens, and where a browser cannot download (the in-app
// browsers of WhatsApp, Instagram and the like) the picture opens big to press and hold instead; a link that cannot
// be shared or copied is shown so it can be copied by hand.
import { esc } from './dom.js';

export const MODEL_LINE = 'An illustrative model of La Conca, not an exact plan';
export const IDEA_LINE = 'How it could look: an idea, not our plan';

// in-app browsers that ignore a download link (a guess from the user agent; none of them says so)
const IN_APP = /\b(WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|MicroMessenger|GSA\/|TikTok|musical_ly|Messenger)\b/i;
export const inAppBrowser = () => IN_APP.test(navigator.userAgent || '');

// a canvas or an image URL in, a canvas with the caption band out
export async function markStill(src, { idea = false } = {}) {
  const img = typeof src === 'string' ? await loadImage(src) : src;
  const w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const size = Math.max(11, Math.round(Math.min(w, h * 1.4) / 52));
  const pad = Math.round(size * 0.75);
  const lines = idea ? [IDEA_LINE, MODEL_LINE] : [MODEL_LINE];
  const band = lines.length * size * 1.35 + pad * 1.2;
  const grad = g.createLinearGradient(0, h - band * 1.6, 0, h);
  grad.addColorStop(0, 'rgba(20, 16, 12, 0)');
  grad.addColorStop(1, 'rgba(20, 16, 12, 0.62)');
  g.fillStyle = grad;
  g.fillRect(0, h - band * 1.6, w, band * 1.6);
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0, 0, 0, 0.45)';
  g.shadowBlur = size * 0.4;
  lines.forEach((line, i) => {
    g.font = `${i === 0 && idea ? 600 : 400} ${size}px Georgia, "Times New Roman", serif`;
    g.fillStyle = i === 0 && idea ? '#f3d9a2' : '#fbf3e2';
    g.fillText(fit(g, line, w - 2 * pad), pad, h - pad * 0.8 - (lines.length - 1 - i) * size * 1.35);
  });
  return c;
}

function fit(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 8 && g.measureText(`${t}...`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

// save a canvas: a download where the browser does that, else the picture big with "press and hold"
export async function saveCanvas(canvas, name, { ui, root, type = 'image/png' } = {}) {
  if (inAppBrowser()) { holdToSave(root, canvas.toDataURL(type, 0.9), name); return 'shown'; }
  const blob = await toBlob(canvas, type, 0.9);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  ui?.toast('Downloading the picture');
  return 'download';
}

function sheet(root, cls, html) {
  root.querySelector(`.${cls}`)?.remove();
  const el = document.createElement('div');
  el.className = `vx-keep ${cls}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="vx-keep-box">${html}<div class="vx-keep-actions"><button type="button" class="vx-btn" data-keep="close">Done</button></div></div>`;
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-keep="close"]')) close(); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  root.append(el);
  return el;
}

export function holdToSave(root, url, name) {
  const el = sheet(root, 'vx-keep--photo', `<p class="vx-keep-title">Press and hold the picture to save it</p><img src="${esc(url)}" alt="${esc(name)}">`);
  el.querySelector('[data-keep="close"]').focus();
  return el;
}

// share a link: the share sheet where it is wanted, else the clipboard, else the link itself to copy by hand
export async function shareLink(url, { ui, root, title = 'La Conca in 3D', sheetOk = true, copied = 'Link copied' } = {}) {
  try {
    if (sheetOk && navigator.share) { await navigator.share({ title, url }); return 'shared'; }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    ui?.toast(copied);
    return 'copied';
  } catch {
    const el = sheet(root, 'vx-keep--link', `<p class="vx-keep-title">Copy this link</p><input type="text" readonly value="${esc(url)}" aria-label="Link to this view">`);
    const input = el.querySelector('input');
    input.focus();
    input.select();
    return 'shown';
  }
}
