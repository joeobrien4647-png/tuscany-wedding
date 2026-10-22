// Small DOM helpers shared by the experience modules.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '');

// a button with an icon and words that show on wider screens
export function button({ id, cls = '', label, icon = '', title = label, pressed = null, attrs = '' }) {
  return `<button type="button" class="${cls}"${id ? ` id="${id}"` : ''} title="${esc(title)}"${pressed == null ? '' : ` aria-pressed="${pressed}"`} ${attrs}>${icon}<span>${esc(label)}</span></button>`;
}

export const ICONS = {
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l1.9 5.2 5.3 1.9-5.3 1.9L12 17.4l-1.9-5.2-5.3-1.9 5.3-1.9Z" fill="currentColor"/><path d="M18.6 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8Z" fill="currentColor" opacity=".75"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M6 12.5V19h12v-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18.5" cy="12" r="1.8" fill="currentColor"/></svg>',
};
