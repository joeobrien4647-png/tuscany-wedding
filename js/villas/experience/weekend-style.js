// The weekend mode's styles and icons (weekend-mode.js puts the styles in the page the first time the mode opens), in
// the site's own tokens from css/styles.css, dark mode included. Phone first: under 700 px high the card is the kicker,
// the title and the tags only, so the middle third of the screen stays clear; sideways, the card moves to the right
// third. On a touch screen every control reaches 44 px to the touch without growing on screen (v2's rule).
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  play: svg('<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/>'),
  pause: svg('<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/>'),
  next: svg('<path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  sound: svg('<path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4Z" fill="currentColor"/><path d="M15.2 9.4a3.8 3.8 0 0 1 0 5.2M17.6 7.2a7 7 0 0 1 0 9.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  camera: svg('<path d="M4 8.2h3.1l1.6-2.4h6.6l1.6 2.4H20v10.3H4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
};

export const CSS = `
.vx.is-weekend{position:fixed;inset:0;z-index:1200;height:auto;max-height:none;min-height:0;border:0}
html.vx-wk-lock,html.vx-wk-lock body{overflow:hidden}
.vx.is-weekend.is-photo .vx-wk{display:none}
.vx.is-weekend>:not(.vx-stage):not(.vx-wk):not(.vx-note):not(.vx-toast):not(.vx-photo-mode),.vx.is-weekend .vx-labels>:not(.vx-tag),.vx.is-weekend .vx-tag-sub{display:none!important}
.vx.is-weekend .vx-tag{pointer-events:none;min-height:0}
.vx.is-weekend .vx-note{left:auto;right:10px;bottom:auto;top:calc(var(--wk-bar,58px) + 6px);transform:none;max-width:calc(50% - 20px);font-size:9.5px;text-align:right;transition:opacity .3s}
.vx.is-weekend .vx-note>span{display:block}
.vx.is-weekend .vx-note-credit::before{content:none}
.vx.is-weekend:has(.vx-wk-day.is-on) .vx-note,.vx-wk-day.is-on~.vx-wk-here{opacity:0}
.vx-wk{position:absolute;inset:0;z-index:30;pointer-events:none;color:var(--color-charcoal);--wk-g:12px}
.vx-wk button{pointer-events:auto;font:inherit;color:inherit;cursor:pointer;background:none;border:0}
.vx-wk-bar{position:absolute;left:0;right:0;top:0;padding:6px var(--wk-g) 3px;background:linear-gradient(rgba(255,253,248,.95),rgba(255,253,248,.88));border-bottom:1px solid var(--hair);pointer-events:auto}
.vx-wk-row{display:flex;align-items:center;gap:6px;height:32px}
.vx-wk-name{flex:1;margin:0;font:600 13px/1 var(--caps);letter-spacing:.2em;text-transform:uppercase;color:var(--gold-ink)}
.vx-wk-ic{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;flex:none}
.vx-wk-ic svg{width:20px;height:20px}
.vx-wk-snd[aria-pressed=true]{color:var(--terra-ink)}
.vx-wk-honest,.vx-wk-idea{margin:0;font:400 11px/14px var(--font-body);color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vx-wk-idea{margin-top:2px;line-height:16px;color:var(--gold-ink);font-weight:700}
.vx-wk-here{position:absolute;left:var(--wk-g);top:calc(var(--wk-bar,58px) + 6px);max-width:calc(50% - 20px);margin:0;padding:3px 9px;border-radius:10px;background:rgba(23,19,17,.62);border:1px solid rgba(230,194,126,.55);font:600 9.5px/1.3 var(--caps);letter-spacing:.14em;text-transform:uppercase;color:var(--cream-ink);transition:opacity .3s}
.vx-wk-here:empty{display:none}
.vx-wk-day{position:absolute;left:0;right:0;top:calc(var(--wk-bar,58px) + 1px);padding:16px var(--wk-g) 34px;text-align:center;background:linear-gradient(rgba(23,19,17,.74),rgba(23,19,17,.5) 70%,rgba(23,19,17,0));color:var(--cream-ink);text-shadow:0 1px 10px rgba(0,0,0,.6);opacity:0;transition:opacity .5s}
.vx-wk-day.is-on{opacity:1}
.vx-wk-day p{margin:0;font:600 12px/1.4 var(--caps);letter-spacing:.24em;text-transform:uppercase;color:var(--glow)}
.vx-wk-day h2{margin:4px 0 2px;font:500 clamp(30px,8vw,40px)/1.1 var(--font-heading);color:var(--cream-ink)}
.vx-wk-day h2 em,.vx-wk-end h2 em{color:var(--glow)}
.vx-wk-day small{font:400 13px/1.3 var(--font-body)}
.vx-wk-fade{position:absolute;inset:0;background:var(--color-cream,#f7f1e6);opacity:0;transition:opacity .2s}
.vx-wk-fade.is-on{opacity:1}
.vx-wk-stills{position:absolute;inset:0;background:#2a2420}
.vx-wk-stills img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}
.vx-wk-stills img.is-in{opacity:1}
.vx-wk-bottom{position:absolute;left:0;right:0;bottom:0;padding:0 var(--wk-g) env(safe-area-inset-bottom);display:flex;flex-direction:column;align-items:center;pointer-events:none}
.vx-wk-bottom>*{width:100%;max-width:560px}
.vx-wk-card{position:relative;box-sizing:border-box;margin:0 0 6px;padding:9px 13px;max-height:calc(33.3vh - var(--wk-dock,104px) - 12px);max-height:calc(33.3dvh - var(--wk-dock,104px) - 12px);overflow:hidden;background:var(--paper);border:1px solid var(--hair);box-shadow:var(--shadow-soft);pointer-events:auto;cursor:pointer}
.vx-wk-card.is-night{background:var(--night);border-color:var(--color-gold,#c9a961);color:var(--cream-ink)}
.vx-wk-card.is-night::after{content:"";position:absolute;inset:6px;border:1px solid rgba(230,194,126,.35);pointer-events:none}
.vx-wk-pop:not([hidden])+.vx-wk-card{display:none}
.vx-wk-when{display:flex;align-items:center;gap:8px;margin:0;font:600 11px/15px var(--caps);letter-spacing:.18em;text-transform:uppercase;color:var(--terra-ink)}
.is-night .vx-wk-when{color:var(--glow)}
.vx-wk-mark{width:8px;height:8px;transform:rotate(45deg);background:var(--color-gold,#c9a961);flex:none}
.is-night .vx-wk-mark{background:var(--glow)}
.vx-wk-title{margin:3px 0 2px;font:500 19px/1.2 var(--font-heading);color:inherit}
.vx-wk-title em{font-style:italic;color:var(--terra-ink)}
.is-night .vx-wk-title{color:var(--cream-ink)}.is-night .vx-wk-title em{color:var(--glow)}
.vx-wk-cap{margin:0 0 5px;font:400 13px/1.35 var(--font-body);color:var(--text-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.is-night .vx-wk-cap{color:rgba(251,240,210,.82)}
.vx-wk-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:0}
.vx-wk-tag,.vx-wk .vx-wk-more{padding:3px 8px;border:1px solid var(--hair);border-radius:999px;font:600 9.5px/1.3 var(--caps);letter-spacing:.14em;text-transform:uppercase;color:var(--gold-ink);white-space:nowrap}
.vx-wk-tag.is-tbd{border-style:dashed;border-color:var(--terra-ink);color:var(--terra-ink)}
.is-night .vx-wk-tag,.is-night .vx-wk-more{color:var(--glow);border-color:rgba(230,194,126,.55)}
.vx-wk .vx-wk-more{margin:-4px -8px -4px auto;min-height:28px;text-decoration:underline;text-underline-offset:2px;border-color:transparent;letter-spacing:.14em}
.vx-wk .vx-wk-more.vx-wk-pill{margin-right:-4px;border:1px dashed currentColor;text-decoration:none}
.vx-wk .vx-wk-card:focus-visible{outline:none}
.vx-wk-card.no-head .vx-wk-opts-h,.vx-wk-card.no-cap .vx-wk-cap,.vx-wk-card.is-tight .vx-wk-opts,.vx-wk-card.no-model .vx-wk-tag.is-idea,.vx-wk-card.is-tight .vx-wk-tag.is-idea{display:none}
.vx-wk-opts{margin-top:6px}
.vx-wk-opts-h,.vx-wk-opts-n{margin:0 0 4px;font:600 9.5px/1.3 var(--caps);letter-spacing:.14em;text-transform:uppercase;color:var(--gold-ink)}
.vx-wk-opts-n{margin:3px 0 0;font:400 11.5px/1.3 var(--font-body);letter-spacing:0;text-transform:none;color:var(--text-soft)}
.is-night .vx-wk-opts-h{color:var(--glow)}.is-night .vx-wk-opts-n{color:rgba(251,240,210,.8)}
.vx-wk-seg{display:flex;flex-wrap:wrap;gap:16px 5px}
.vx-wk .vx-wk-seg button,.vx-wk .vx-wk-go{position:relative;isolation:isolate;min-height:44px;margin:-8px 0;padding:3px 10px;font:400 12.5px/1.2 var(--font-body)}
.vx-wk-seg button::before,.vx-wk-go::before{content:"";position:absolute;inset:8px 0;z-index:-1;border:1px dashed var(--gold-ink);border-radius:999px;background:rgba(255,253,248,.6)}
.vx-wk .vx-wk-seg button[aria-pressed=true],.vx-wk .vx-wk-go{color:#fff}
.vx-wk-seg button[aria-pressed=true]::before,.vx-wk-go::before{border-style:solid;background:var(--terra-ink);border-color:var(--terra-ink)}
.is-night .vx-wk-seg button::before{background:transparent;border-color:var(--glow)}
.vx-wk .is-night .vx-wk-seg button[aria-pressed=true]{color:var(--night)}
.is-night .vx-wk-seg button[aria-pressed=true]::before{background:var(--glow)}
.vx-wk-pop{position:relative;box-sizing:border-box;margin:0 0 6px;padding:12px 14px;max-height:52vh;overflow:auto;background:var(--paper);border:1px solid var(--hair);box-shadow:var(--shadow-soft);pointer-events:auto;font:400 14px/1.5 var(--font-body)}
.vx-wk-pop p{margin:0 0 8px}
.vx-wk-pop .vx-wk-title{margin:0 0 4px}
.vx-wk .vx-wk-pop .vx-wk-x2{position:absolute;right:4px;top:4px}
.vx-wk-dock{box-sizing:border-box;padding:4px 6px 6px;margin-bottom:4px;background:rgba(255,253,248,.94);border:1px solid var(--hair);pointer-events:auto}
.vx-wk-days{display:grid;grid-template-columns:repeat(4,1fr);height:40px}
.vx-wk .vx-wk-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;border-bottom:2px solid transparent;line-height:1}
.vx-wk-tab b{font:600 10px/1 var(--caps);letter-spacing:.18em;text-transform:uppercase;color:var(--gold-ink)}
.vx-wk-tab span{font:500 18px/1.1 var(--font-heading)}
.vx-wk .vx-wk-tab[aria-pressed=true]{border-bottom-color:var(--terra-ink)}
.vx-wk-scrub{display:flex;align-items:flex-end;gap:4px;height:52px}
.vx-wk-play,.vx-wk-next{width:40px;height:40px;margin-bottom:0}
.vx-wk .vx-wk-play{background:var(--terra-ink);color:#fff}
.vx-wk-track{position:relative;flex:1;height:52px;pointer-events:none}
.vx-wk-clock{position:absolute;left:0;right:0;top:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;font:400 11px/12px var(--font-body);color:var(--color-charcoal);white-space:nowrap}
.vx-wk-c2{color:var(--terra-ink)}
.vx-wk-line{position:absolute;left:10px;right:10px;bottom:13px;height:16px}
.vx-wk-rail{position:absolute;left:0;right:0;top:6px;height:4px;border-radius:2px;box-shadow:0 0 0 1px var(--color-gold,#c9a961)}
.vx-wk-band{position:absolute;top:3px;height:10px;border-radius:5px;background:rgba(201,169,97,.35);box-shadow:inset 0 0 0 1px rgba(201,169,97,.5)}
.vx-wk-band.is-here{background:rgba(180,83,31,.28)}
.vx-wk-dia{position:absolute;top:3px;width:9px;height:9px;margin-left:-5px;transform:rotate(45deg);background:var(--color-gold,#c9a961);box-sizing:border-box}
.vx-wk-dia.is-likely{background:var(--paper);border:1.5px solid var(--color-gold,#c9a961)}
.vx-wk-dia.is-tbd{background:transparent;border:1.5px dashed var(--terra-ink)}
.vx-wk-lab,.vx-wk-sunlab{position:absolute;top:16px;transform:translateX(-50%);font:600 8.5px/1 var(--caps);letter-spacing:.1em;text-transform:uppercase;color:var(--gold-ink);white-space:nowrap}
.vx-wk-sun{position:absolute;top:-1px;width:1px;height:18px;background:var(--terra-ink)}
.vx-wk-sunlab{color:var(--terra-ink)}.vx-wk-sunlab svg{width:10px;height:10px}
.vx-wk-range{position:absolute;left:0;right:0;bottom:4px;width:100%;height:34px;margin:0;background:transparent;-webkit-appearance:none;appearance:none;pointer-events:auto;cursor:pointer}
.vx-wk-range::-webkit-slider-runnable-track{height:100%;background:transparent}
.vx-wk-range::-moz-range-track{height:100%;background:transparent}
.vx-wk-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:7px;border-radius:50%;background:var(--paper);border:2px solid var(--terra-ink);box-shadow:0 2px 6px rgba(0,0,0,.3)}
.vx-wk-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--paper);border:2px solid var(--terra-ink)}
.vx-wk-end{position:absolute;inset:0;display:grid;place-items:center;padding:24px;background:rgba(23,19,17,.72);text-align:center;color:var(--cream-ink);pointer-events:auto}
.vx-wk-end h2{margin:0 0 14px;font:500 clamp(30px,8vw,44px)/1.1 var(--font-heading);color:var(--cream-ink)}
.vx-wk-end p{margin:0 0 6px;font:600 12px/1.5 var(--caps);letter-spacing:.22em;text-transform:uppercase;color:var(--glow)}
.vx-wk-end div{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
.vx-wk .vx-wk-end button{min-height:44px;padding:0 18px;border:1px solid var(--glow);border-radius:999px;font:700 13px/1 var(--font-body);color:var(--cream-ink)}
.vx-wk .vx-wk-end button:first-child{background:var(--glow);color:var(--night)}
.vx-wk .vx-wk-go{padding:0 14px;font-weight:700}
.vx-wk :focus-visible{outline:2px solid var(--terra-ink);outline-offset:2px}
@media (pointer:coarse){
.vx-wk-row{gap:14px}
.vx-wk .vx-wk-ic,.vx-wk .vx-wk-tab{position:relative}
.vx-wk .vx-wk-ic::after{content:"";position:absolute;inset:-6px}
.vx-wk .vx-wk-play::after,.vx-wk .vx-wk-next::after{inset:-2px}
.vx-wk .vx-wk-tab::after{content:"";position:absolute;left:0;right:0;top:-2px;bottom:-4px}
.vx-wk-range{height:44px;bottom:-4px}
.vx-wk-line{bottom:10px}
.vx-wk-range::-webkit-slider-thumb{width:44px;height:44px;margin-top:0;border:0;box-shadow:none;background:radial-gradient(circle,var(--paper) 0 9.5px,var(--terra-ink) 10px 12px,transparent 12.5px)}
.vx-wk-range::-moz-range-thumb{width:44px;height:44px;border:0;background:radial-gradient(circle,var(--paper) 0 9.5px,var(--terra-ink) 10px 12px,transparent 12.5px)}
}
@media (max-height:699px){
.vx-wk-card{height:84px;max-height:84px;margin-bottom:4px;padding:8px 12px}
.vx-wk-when{font-size:10px;letter-spacing:.12em}
.vx-wk-cap,.vx-wk-opts{display:none}
.vx-wk-tag{padding:2px 6px;font-size:8.5px;letter-spacing:.1em}
.vx-wk-day{padding:10px var(--wk-g) 18px}.vx-wk-day h2{font-size:28px}
.vx-wk-days{height:32px}.vx-wk-tab span{display:none}
.vx-wk-scrub{height:46px}.vx-wk-track{height:46px}
.vx-wk-dock{padding:0 6px;margin-bottom:0}
.vx-wk-clock{top:-31px;height:30px;justify-content:center;background:rgba(255,253,248,.97);opacity:0;transition:opacity .2s}
.vx-wk.is-scrubbing .vx-wk-clock,.vx-wk.is-playing .vx-wk-clock{opacity:1}
.vx-wk-line{bottom:12px}
}
@media (max-height:699px) and (pointer:coarse){
.vx-wk .vx-wk-tab::after{top:-11px;bottom:-3px}
.vx-wk .vx-wk-play::after,.vx-wk .vx-wk-next::after{inset:-4px -2px -1px}
.vx-wk-range{bottom:0}
.vx-wk-line{bottom:14px}
}
@media (max-height:520px) and (orientation:landscape){
.vx-wk-bottom{align-items:stretch}
.vx-wk-bottom>*{max-width:none}
.vx-wk-card{position:absolute;right:var(--wk-g);bottom:84px;width:33%;height:auto;max-height:calc(100vh - var(--wk-bar,58px) - 100px);max-height:calc(100dvh - var(--wk-bar,58px) - 100px);margin:0}
.vx-wk-pop{position:absolute;right:var(--wk-g);bottom:84px;width:40%;max-height:calc(100vh - var(--wk-bar,58px) - 100px)}
.vx-wk-cap{display:-webkit-box}.vx-wk-opts:not([hidden]){display:block}
.vx.is-weekend .vx-note{right:auto;left:12px;top:calc(var(--wk-bar,58px) + 34px);text-align:left}
.vx-wk-dock{display:flex;align-items:flex-end;gap:8px}.vx-wk-days{width:220px;flex:none}.vx-wk-scrub{flex:1}
}
@media (min-width:900px){.vx-wk-bottom>*{max-width:620px}.vx-wk-title{font-size:22px}}
`;
