(function (root) {
  'use strict';
  // Hand-cut paper pieces in the welcome film's golden-hour palette. Every piece takes opts, and the book adds
  // side ('l' or 'r', the side the sun is on) and night. The shared gradients live once in DEFS.
  const svg = (vb, inner, cls = '') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="${cls}">${inner}</svg>`;
  const R = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  // Darker towards warm umber (k < 0) or lighter towards warm cream (k > 0).
  const tone = (c, k) => { const t = k < 0 ? [40, 22, 12] : [255, 244, 214], a = Math.abs(k); return '#' + rgb(c).map((v, i) => Math.round(v + (t[i] - v) * a).toString(16).padStart(2, '0')).join(''); };
  const away = side => `url(#sb${side === 'l' ? 'DR' : 'DL'})`;
  const toward = side => `url(#sb${side === 'l' ? 'LL' : 'LR'})`;
  // One paper shape: its colour with the cream cut edge, shade on the side away from the sun, warm light on the sun side.
  const cut = (tag, attrs, c, side, lit = true) => `<${tag} class="cut" ${attrs} fill="${c}"/><${tag} ${attrs} fill="${away(side)}"/>${lit ? `<${tag} ${attrs} fill="${toward(side)}"/>` : ''}`;
  // Overlapping blobs cut as one silhouette: every edge first, then the colour over them, so no seams show inside.
  const clump = (blobs, c) => blobs.map(b => `<ellipse class="cut" ${b} fill="${c}"/>`).join('') + blobs.map(b => `<ellipse ${b} fill="${c}"/>`).join('');
  const blob = ([x, y, rx, ry]) => `cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"`;
  const bez = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

  const DEFS = '<svg class="sb-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="sbDL" x1="0" x2="1"><stop offset="0" stop-color="#2a1608" stop-opacity=".4"/><stop offset=".62" stop-color="#2a1608" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sbDR" x1="1" x2="0"><stop offset="0" stop-color="#2a1608" stop-opacity=".4"/><stop offset=".62" stop-color="#2a1608" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sbLL" x1="0" x2="1"><stop offset="0" stop-color="#ffecbd" stop-opacity=".62"/><stop offset=".32" stop-color="#ffecbd" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sbLR" x1="1" x2="0"><stop offset="0" stop-color="#ffecbd" stop-opacity=".62"/><stop offset=".32" stop-color="#ffecbd" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sbFoot" x1="0" x2="0" y1="0" y2="1"><stop offset=".5" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".34"/></linearGradient>' +
    '<radialGradient id="sbGlow"><stop offset="0" stop-color="#fff3c8" stop-opacity=".95"/><stop offset=".38" stop-color="#ffc861" stop-opacity=".5"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="sbWater" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8be2f3"/><stop offset="1" stop-color="#1b8fbd"/></linearGradient>' +
    '<linearGradient id="sbGlass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d6edf5"/><stop offset=".5" stop-color="#8dbdd4"/><stop offset="1" stop-color="#5a88a2"/></linearGradient>' +
    '<linearGradient id="sbBeam" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#fff6d8" stop-opacity=".75"/><stop offset="1" stop-color="#fff6d8" stop-opacity=".04"/></linearGradient>' +
    '<linearGradient id="sbChrome" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c8ccd3"/><stop offset="1" stop-color="#868b96"/></linearGradient>' +
    '</defs></svg>';

  /* trees */
  const cypress = ({ c = '#3d5a3b', side = 'r' } = {}) => {
    const d = 'M15 2 C21 22 26 48 25 74 C24 96 21 108 18 114 L12 114 C9 108 6 96 5 74 C4 48 9 22 15 2Z', deep = tone(c, -.4);
    return svg('0 0 30 120', '<rect x="13.5" y="110" width="3" height="10" fill="#5b3e2a"/>' + cut('path', `d="${d}"`, c, side) +
      R(8, i => { const y = 16 + i * 12, w = 3 + (i % 3); return `<path d="M${15 - w} ${y + 4} q${w} -6 ${w * 2} 0" stroke="${deep}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".65"/>`; }));
  };
  const olive = ({ c = '#8aa06a', side = 'r' } = {}) => {
    const trunk = 'M50 120 C52 104 44 94 38 80 L44 78 C50 90 54 98 56 104 C58 94 62 86 70 74 L76 77 C68 88 62 100 60 120Z';
    const blobs = [[34, 60, 28, 20], [74, 56, 30, 21], [54, 40, 30, 22], [22, 46, 16, 12], [88, 42, 16, 12], [56, 22, 20, 14]];
    const sun = side === 'l' ? -1 : 1;
    return svg('0 0 110 120', cut('path', `d="${trunk}"`, '#6b5440', side, false) + clump(blobs.map(blob), c) +
      blobs.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y + ry * .38}" rx="${rx * .86}" ry="${ry * .55}" fill="${tone(c, -.32)}" opacity=".55"/>`).join('') +
      blobs.map(([x, y, rx, ry]) => `<ellipse cx="${x + sun * rx * .28}" cy="${y - ry * .42}" rx="${rx * .5}" ry="${ry * .3}" fill="${tone(c, .45)}" opacity=".7"/>`).join('') +
      `<ellipse cx="55" cy="45" rx="50" ry="36" fill="${away(side)}"/>` +
      R(24, i => `<path d="M${12 + rnd(i) * 86} ${20 + rnd(i + 40) * 48} l3 -1.6" stroke="#eef3df" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>`));
  };

  /* far land */
  const hills = ({ c = '#8ea85e', v = 0, stripes = '', side = 'r' } = {}) => {
    const d = v ? 'M0 90 L0 40 C50 22 90 30 140 42 C190 54 220 30 270 24 C320 18 360 34 400 30 L400 90Z' : 'M0 90 L0 50 C40 30 85 26 130 38 C170 49 200 36 240 28 C285 19 330 32 370 44 L400 50 L400 90Z';
    const ridge = d.replace(/^M0 90 L/, 'M').replace(/ L400 90Z$/, '').replace(/ L400 50$/, '');
    let s = cut('path', `d="${d}"`, c, side, false) + `<path d="${ridge}" stroke="${tone(c, .38)}" stroke-width="2.4" fill="none" opacity=".75"/>`;
    if (stripes) s += R(9, i => `<path d="M${40 + i * 38} 90 C${50 + i * 38} 70 ${70 + i * 38} 58 ${96 + i * 38} 52" stroke="${stripes}" stroke-width="2.5" fill="none" opacity=".55"/>`);
    return svg('0 0 400 90', s);
  };
  const town = ({ c = '#c49a86', side = 'r', night = false } = {}) => {
    const lit = tone(c, .22), dark = tone(c, -.18), win = night ? '#ffd27a' : tone(c, -.35);
    const blocks = [[58, 30, 20, 22], [78, 24, 26, 28], [112, 28, 28, 24], [138, 36, 18, 16], [44, 38, 16, 14]];
    let s = `<path class="cut" d="M0 90 C30 62 60 50 100 48 C140 50 170 62 200 90Z" fill="${c}"/>`;
    s += blocks.map(([x, y, w, h]) => `<rect class="cut" x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/><rect x="${side === 'l' ? x : x + w * .55}" y="${y}" width="${w * .45}" height="${h}" fill="${side === 'l' ? lit : dark}" opacity=".7"/>`).join('');
    s += `<rect class="cut" x="104" y="4" width="9" height="46" fill="${c}"/><path class="cut" d="M102 6 L108.5 -5 L115 6Z" fill="${dark}"/><circle class="cut" cx="92" cy="22" r="7" fill="${c}"/>`;
    s += `<path d="M60 31 L72 22 L84 31Z M78 25 L92 16 L106 25Z M110 29 L126 20 L142 29Z" fill="${tone('#c4693f', .25)}" opacity=".75"/>`;
    s += R(10, i => `<rect x="${50 + rnd(i) * 95}" y="${32 + rnd(i + 9) * 16}" width="2" height="3" fill="${win}" opacity="${night ? 1 : .6}"/>`);
    return svg('0 0 200 90', s);
  };

  /* the villa */
  const villa = ({ stone, shade, roof = '#c4693f', glow = false, shutter = '#7b8f5e', side = 'r', night = false } = {}) => {
    stone = stone || (night ? '#cdb48c' : '#ecd5a8'); shade = shade || tone(stone, -.1);
    const lit = glow || night, frame = tone(stone, .4), course = tone(stone, -.14), tile = tone(roof, -.28);
    const window = (x, y, w, h) => {
      const glass = lit
        ? `<rect x="${x - 7}" y="${y - 6}" width="${w + 14}" height="${h + 12}" fill="url(#sbGlow)" opacity=".85"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffcf6e"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sbGlass)"/><path d="M${x + 2} ${y + h - 4} L${x + w - 4} ${y + 2}" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`;
      const slats = sx => R(5, i => `<path d="M${sx} ${y + 3 + i * (h - 4) / 5}h5" stroke="${tone(shutter, -.3)}" stroke-width=".8"/>`);
      return `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" fill="${frame}"/>${glass}<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="${frame}" stroke-width="1.2"/>` +
        `<rect class="cut" x="${x - 8}" y="${y}" width="6" height="${h}" fill="${shutter}"/>${slats(x - 7.5)}<rect class="cut" x="${x + w + 2}" y="${y}" width="6" height="${h}" fill="${shutter}"/>${slats(x + w + 2.5)}` +
        `<rect x="${x - 4}" y="${y + h + 1}" width="${w + 8}" height="2.5" fill="${course}"/>`;
    };
    let s = cut('rect', 'x="18" y="62" width="140" height="88"', stone, side);
    s += R(9, i => `<path d="M18 ${70 + i * 9}h128" stroke="${course}" stroke-width=".7" opacity=".55"/>`);
    s += R(16, i => `<rect x="${22 + rnd(i) * 116}" y="${66 + rnd(i + 20) * 76}" width="${7 + rnd(i + 5) * 6}" height="4" fill="none" stroke="${course}" stroke-width=".6" opacity=".6"/>`);
    // hipped terracotta roof with tile courses and a shadow under the eaves
    s += `<rect x="18" y="68" width="140" height="6" fill="#2a1608" opacity=".2"/><rect x="56" y="26" width="9" height="14" fill="${tone(stone, -.2)}"/><rect x="54" y="24" width="13" height="3" fill="${tile}"/>`;
    s += cut('path', 'd="M4 67 L30 38 L148 38 L172 67Z"', roof, side);
    s += R(5, i => { const y = 43 + i * 5, k = (y - 38) * 26 / 29; return `<path d="M${30 - k} ${y}H${148 + k}" stroke="${tile}" stroke-width=".9" opacity=".8"/>`; });
    s += R(22, i => `<path d="M${10 + i * 7.4} 66.5 q3.7 3 7.4 0" stroke="${tile}" stroke-width="1.1" fill="none"/>`);
    // the tower, its pyramid roof and arched belfry
    s += cut('rect', 'x="146" y="26" width="52" height="124"', shade, side);
    s += R(13, i => `<path d="M146 ${34 + i * 9}h52" stroke="${course}" stroke-width=".7" opacity=".5"/>`);
    s += cut('path', 'd="M140 28 L172 7 L204 28Z"', roof, side) + R(6, i => `<path d="M${146 + i * 9.5} 27.5 L172 8" stroke="${tile}" stroke-width=".7" opacity=".7"/>`);
    s += `<path d="M164 40 v-4 a8 8 0 0 1 16 0 v4Z" fill="${lit ? '#ffcf6e' : '#4a3a32'}"/>`;
    for (const x of [34, 74, 114]) for (const y of [82, 114]) if (!(x === 74 && y === 114)) s += window(x, y, 16, 22);
    s += window(164, 60, 16, 20) + window(164, 100, 16, 20);
    // arched door with planks, step and lantern
    s += `<path class="cut" d="M75 150 L75 126 C75 114 99 114 99 126 L99 150Z" fill="#7a4e32"/>` + R(4, i => `<path d="M${79 + i * 5} 119v31" stroke="#5e3a24" stroke-width=".9"/>`) +
      `<circle cx="95" cy="136" r="1.3" fill="#e3b660"/><rect x="70" y="147" width="34" height="3" fill="${tone(stone, -.25)}"/>` +
      `${lit ? '<circle cx="108" cy="122" r="12" fill="url(#sbGlow)"/>' : ''}<rect x="105" y="117" width="6" height="9" rx="1.5" fill="${lit ? '#ffd27a' : '#3d3a40'}"/>`;
    // climbing roses on the left wall and lemon trees by the door
    s += clump([[20, 120, 9, 9], [26, 106, 7, 7], [18, 94, 6, 6], [24, 138, 11, 11], [30, 84, 5, 5]].map(blob), '#6f8f4c');
    s += R(9, i => `<circle cx="${16 + rnd(i) * 16}" cy="${84 + rnd(i + 3) * 60}" r="2.2" fill="${i % 3 ? '#e98fa5' : '#f6c9d2'}"/>`);
    for (const x of [64, 110]) s += `<path class="cut" d="M${x - 5} 150 l1.5 -9 h7 l1.5 9Z" fill="#b5653f"/><circle class="cut" cx="${x}" cy="135" r="7" fill="#5f8248"/><circle cx="${x - 2}" cy="133" r="1.4" fill="#f3d14b"/><circle cx="${x + 3}" cy="137" r="1.4" fill="#f3d14b"/>`;
    return svg('0 0 210 150', s);
  };

  /* the cream Fiat 500 */
  const fiat = ({ body = '#f2e2b8', bag = false, lights = false, wave = false, side = 'r' } = {}) => {
    const shell = 'M14 76 C12 58 22 50 40 48 L52 26 C56 18 64 15 76 15 L104 15 C117 15 125 20 131 30 L142 48 C158 50 162 60 160 76 Z', line = tone(body, -.3);
    let s = '';
    if (bag) s += `<path d="M54 15 V9 M118 15 V9" stroke="#5a4a3e" stroke-width="2"/>` + cut('rect', 'x="58" y="0" width="34" height="11" rx="2.5"', '#a8693d', side) + cut('rect', 'x="88" y="2" width="26" height="9" rx="2"', '#c99760', side) +
      `<path d="M66 0v11M84 0v11M96 2v9M106 2v9" stroke="#5e3a24" stroke-width="1.4"/><rect x="50" y="9.5" width="72" height="3" rx="1.5" fill="url(#sbChrome)"/>`;
    if (lights) s += '<ellipse cx="170" cy="60" rx="26" ry="13" fill="url(#sbGlow)"/>';
    s += cut('path', `d="${shell}"`, body, side) + `<path d="${shell}" fill="url(#sbFoot)" opacity=".5"/>`;
    s += '<path d="M57 28 C60 22 65 20 73 20 L84 20 L84 46 L50 46 Z" fill="url(#sbGlass)"/><path d="M90 20 L104 20 C113 20 119 24 123 30 L131 46 L90 46 Z" fill="url(#sbGlass)"/>' +
      '<path d="M62 42 L74 22 M98 42 L108 22" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>';
    s += `<path d="M86 46V72M40 48H142" stroke="${line}" stroke-width="1.1" fill="none"/><rect x="92" y="52" width="9" height="2.2" rx="1" fill="url(#sbChrome)"/><rect x="18" y="62" width="140" height="2.4" fill="url(#sbChrome)"/>` +
      '<path d="M127 40 l6 -4 l2 3 l-6 3z" fill="url(#sbChrome)"/><rect x="12" y="55" width="4.5" height="7" rx="2" fill="#c6463a"/>' +
      `<circle cx="151" cy="57" r="6.5" fill="url(#sbChrome)"/><circle cx="151" cy="57" r="4.6" fill="${lights ? '#fff6c8' : '#f4f1e6'}"/>` +
      '<rect x="8" y="68" width="13" height="5" rx="2.5" fill="url(#sbChrome)"/><rect x="149" y="68" width="16" height="5" rx="2.5" fill="url(#sbChrome)"/>' +
      '<path d="M28 76 a18 18 0 0 1 36 0Z M110 76 a18 18 0 0 1 36 0Z" fill="#2a1608" opacity=".28"/>';
    const wheel = x => `<g class="wheel" style="transform-origin:${x}px 78px"><circle cx="${x}" cy="78" r="14" fill="#26252c"/><circle cx="${x}" cy="78" r="8" fill="url(#sbChrome)"/><circle cx="${x}" cy="78" r="3" fill="#7d818a"/><rect x="${x - 1}" y="66" width="2" height="24" fill="#55525e" opacity=".55"/></g>`;
    s += wheel(46) + wheel(128);
    if (wave) s += [[58, 40, -1], [124, 40, 1]].map(([x, y, d]) => `<g class="wave"><path class="cut" d="M${x} ${y} q${d * 4} -12 ${d * 9} -24" stroke="#f7f1e3" stroke-width="5" fill="none" stroke-linecap="round"/><circle class="cut" cx="${x + d * 9}" cy="${y - 27}" r="4" fill="#f0c4a0"/><path d="M${x + d * 9 - 3} ${y - 30} l-1 -3 M${x + d * 9} ${y - 31} v-3.5 M${x + d * 9 + 3} ${y - 30} l1 -3" stroke="#f0c4a0" stroke-width="1.8" stroke-linecap="round"/></g>`).join('');
    return svg('0 0 170 100', s, 'car');
  };

  /* the pizza oven */
  const oven = ({ side = 'r' } = {}) => {
    const dome = 'M16 86 C16 30 114 30 114 86Z', mortar = '#9b5b3a';
    let s = '<ellipse class="floorglow" cx="65" cy="123" rx="72" ry="9" fill="url(#sbGlow)"/>';
    s += '<g class="puffs"><circle cx="68" cy="4" r="6" fill="#ebe4da"/><circle cx="70" cy="4" r="7" fill="#ebe4da"/><circle cx="66" cy="4" r="6" fill="#ebe4da"/></g>';
    s += cut('rect', 'x="62" y="8" width="13" height="30"', '#8d5a3e', side) + '<rect x="59" y="6" width="19" height="4" fill="#6e4430"/>' + R(4, i => `<path d="M62 ${15 + i * 6}h13" stroke="${mortar}" stroke-width=".7"/>`);
    s += cut('rect', 'x="8" y="84" width="114" height="41"', '#b98d66', side) + R(3, r => R(6, i => `<rect x="${8 + i * 19 + (r % 2) * 9}" y="${86 + r * 13}" width="17" height="11" rx="1" fill="none" stroke="#8f6a4c" stroke-width=".8"/>`));
    s += '<rect x="30" y="100" width="70" height="25" fill="#3b2418"/>' + R(7, i => { const x = 37 + (i % 4) * 17 + (i > 3 ? 8 : 0), y = i > 3 ? 106 : 118; return `<circle cx="${x}" cy="${y}" r="6" fill="#c79d6e"/><circle cx="${x}" cy="${y}" r="3.4" fill="none" stroke="#9a7048" stroke-width=".8"/>`; });
    s += cut('path', `d="${dome}"`, '#c8794f', side);
    for (let r = 0; r < 4; r++) {
      const a = 22 + r * 7, h = 40 + r * 9, b = 108 - r * 7, y0 = 86 - r * 0;
      s += `<path d="M${a} ${y0} C${a} ${h} ${b} ${h} ${b} ${y0}" stroke="${mortar}" stroke-width=".9" fill="none" opacity=".75"/>`;
      s += R(7, i => { const t = (i + .5 + (r % 2) * .5) / 8, x = bez(t, a, a, b, b), y = bez(t, y0, h, h, y0); return `<path d="M${x} ${y}l0 -6" stroke="${mortar}" stroke-width=".8" opacity=".7"/>`; });
    }
    s += `<path d="M43 86 C43 60 87 60 87 86Z" fill="#2b140c"/><ellipse class="ember" cx="65" cy="80" rx="22" ry="13" fill="url(#sbGlow)"/>`;
    s += '<g class="fire"><path d="M50 86 C50 74 56 70 58 62 C62 70 64 66 66 58 C70 68 76 72 80 86Z" fill="#ff9a3c"/><path d="M57 86 C57 78 61 76 62 70 C65 76 68 78 72 86Z" fill="#ffd27a"/></g>';
    s += `<path d="M120 124 L104 66" stroke="#a7825a" stroke-width="2.6" stroke-linecap="round"/><ellipse class="cut" cx="102" cy="58" rx="7" ry="11" fill="#c9a06c" transform="rotate(-15 102 58)"/>`;
    return svg('0 0 130 125', s);
  };

  /* the long table */
  const table = ({ side = 'r' } = {}) => {
    let scal = '';
    for (let x = 320; x > 0; x -= 20) scal += ` Q${x - 10} 60 ${x - 20} 52`;
    const cloth = `M0 30 L320 30 L320 52${scal} Z`;
    let s = '<rect x="16" y="44" width="5" height="32" fill="#7a5236"/><rect x="299" y="44" width="5" height="32" fill="#7a5236"/>' + cut('path', `d="${cloth}"`, '#fbf5e6', side) +
      R(16, i => `<path d="M${10 + i * 20} 33 v18" stroke="#e7dcc4" stroke-width="1.2" opacity=".8"/>`);
    for (const x of [62, 162, 262]) s += `<ellipse cx="${x}" cy="29" rx="26" ry="6.5" fill="#a87b4f"/><ellipse cx="${x}" cy="28" rx="24" ry="6" fill="#e3ae5f"/><ellipse cx="${x}" cy="27" rx="19" ry="4.5" fill="#d9573e"/>` +
      R(5, i => `<circle cx="${x - 12 + i * 6}" cy="${26.5 + (i % 2)}" r="1.6" fill="${i % 2 ? '#fff4dc' : '#5d8a3a'}"/>`);
    for (const x of [112, 214]) s += `<rect class="cut" x="${x}" y="6" width="8" height="24" rx="2" fill="#2f5a3a"/><rect x="${x + 2.5}" y="0" width="3" height="8" fill="#2f5a3a"/><rect x="${x + 1}" y="14" width="6" height="7" fill="#efe3c4"/>`;
    for (const x of [26, 98, 140, 196, 236, 300]) s += `<path d="M${x} 16 L${x + 8} 16 L${x + 6} 26 L${x + 2} 26Z" fill="rgba(235,245,255,.75)"/><path d="M${x + 1} 19 L${x + 7} 19 L${x + 6} 24 L${x + 2} 24Z" fill="#8e2a3a"/><rect x="${x + 3.4}" y="26" width="1.4" height="4" fill="#ccd"/>`;
    for (const x of [130, 186, 84, 248]) s += `<circle cx="${x + 2}" cy="12" r="7" fill="url(#sbGlow)"/><rect x="${x}" y="16" width="4" height="14" fill="#fff7e6"/><ellipse class="flame" cx="${x + 2}" cy="13" rx="2.2" ry="4" fill="#ffc35a"/>`;
    return svg('0 0 320 76', s);
  };

  /* the flower arch */
  const arch = ({ side = 'r' } = {}) => {
    const cols = ['#fffaf2', '#f7cdc6', '#e8949b', '#fffaf2', '#f3dcae', '#f7cdc6'];
    let s = cut('rect', 'x="16" y="70" width="9" height="130"', '#efe4cc', side) + cut('rect', 'x="145" y="70" width="9" height="130"', '#efe4cc', side);
    s += R(18, i => { const y = 84 + i * 6.5, l = i % 2; return `<ellipse cx="${l ? 26 : 15}" cy="${y}" rx="5" ry="2.4" fill="#6e8f52" transform="rotate(${l ? 30 : -30} ${l ? 26 : 15} ${y})"/><ellipse cx="${l ? 144 : 155}" cy="${y + 3}" rx="5" ry="2.4" fill="#6e8f52" transform="rotate(${l ? -30 : 30} ${l ? 144 : 155} ${y + 3})"/>`; });
    s += `<path class="cut" d="M20 76 C20 4 150 4 150 76" stroke="#5f8248" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M20 76 C20 4 150 4 150 76" stroke="${away(side)}" stroke-width="16" fill="none"/>`;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, x = bez(t, 20, 20, 150, 150), y = bez(t, 76, 4, 4, 76), r = 5 + (i % 3) * 1.6;
      s += `<ellipse cx="${x + (i % 2 ? 7 : -7)}" cy="${y + 4}" rx="7" ry="3" fill="${i % 3 ? '#5f8248' : '#9db59a'}" transform="rotate(${i * 13} ${x} ${y})"/>`;
      s += `<circle class="cut" cx="${x}" cy="${y}" r="${r}" fill="${cols[i % cols.length]}"/><path d="M${x - r * .45} ${y} a${r * .45} ${r * .45} 0 1 1 ${r * .5} ${r * .3}" stroke="${tone(cols[i % cols.length], -.25)}" stroke-width=".8" fill="none"/>`;
      if (i % 4 === 2) s += `<path d="M${x} ${y + r} q${(rnd(i) - .5) * 8} 14 ${(rnd(i + 1) - .5) * 6} ${22 + rnd(i) * 18}" stroke="#6e8f52" stroke-width="1.2" fill="none"/>` + R(3, k => `<ellipse cx="${x + (rnd(i + k) - .5) * 6}" cy="${y + r + 8 + k * 8}" rx="2.6" ry="1.4" fill="#7fa266"/>`);
    }
    s += R(10, i => { const t = (i + .5) / 10, x = bez(t, 20, 20, 150, 150), y = bez(t, 76, 4, 4, 76); return `<circle cx="${x + (rnd(i) - .5) * 14}" cy="${y + (rnd(i + 3) - .5) * 10}" r="2.2" fill="#fffdf6"/>`; });
    s += [[20, 86], [150, 86]].map(([x, y]) => `<path d="M${x - 6} ${y} q6 -6 12 0 q-6 6 -12 0Z" fill="#fbf1dc"/><path d="M${x} ${y} q-3 14 -7 24 M${x} ${y} q3 14 7 24" stroke="#fbf1dc" stroke-width="2.2" fill="none"/>`).join('');
    return svg('0 0 170 200', s);
  };

  /* rows of chairs for the ceremony */
  const chairs = ({ side = 'r' } = {}) => {
    let s = '';
    for (const [y, sc] of [[6, .9], [30, 1]]) for (let i = 0; i < 12; i++) {
      const x = i < 6 ? 8 + i * 22 : 162 + (i - 6) * 22, aisle = i === 5 || i === 6;
      s += `<g transform="translate(${x} ${y}) scale(${sc})">${cut('rect', 'x="0" y="0" width="13" height="15" rx="2"', '#f6efe0', side)}<rect x="-1" y="14" width="15" height="4" fill="#e6dac0"/><rect x="0" y="18" width="2" height="7" fill="#d8ccb2"/><rect x="11" y="18" width="2" height="7" fill="#d8ccb2"/><path d="M2 4h9M2 8h9" stroke="#e2d6bc" stroke-width=".8"/>${aisle ? '<circle cx="6.5" cy="5" r="3" fill="#e8a9a6"/><path d="M5 7 l-2 6 M8 7 l2 6" stroke="#e8a9a6" stroke-width="1"/>' : ''}</g>`;
    }
    return svg('0 0 300 60', s);
  };

  /* pool side */
  const parasol = ({ a = '#f6ecd6', b = '#d9785a', side = 'r' } = {}) => {
    let s = '<rect x="58.5" y="12" width="3" height="106" fill="#8a6a4a"/><ellipse cx="60" cy="121" rx="10" ry="3" fill="#6b5440"/>';
    for (let i = 0; i < 6; i++) { const x1 = 8 + i * 104 / 6, x2 = 8 + (i + 1) * 104 / 6; s += cut('path', `d="M60 10 L${x1} 52 Q${(x1 + x2) / 2} 59 ${x2} 52Z"`, i % 2 ? b : a, side, false); }
    s += `<path d="M8 52 L60 10 L112 52" fill="${away(side)}" opacity=".9"/>` + R(12, i => `<path d="M${8 + i * 8.67} 52 q4.3 6 8.67 0" fill="${i % 2 ? b : a}"/>`);
    return svg('0 0 120 125', s + '<circle cx="60" cy="9" r="3" fill="#8a6a4a"/>');
  };
  const lounger = ({ side = 'r' } = {}) => svg('0 0 120 44', cut('path', 'd="M8 30 L30 4 L36 8 L18 30Z"', '#f4ede0', side) + cut('rect', 'x="16" y="26" width="98" height="8" rx="2"', '#f4ede0', side) +
    '<rect x="40" y="25" width="30" height="9" fill="#5fb0cf"/><path d="M44 25v9M50 25v9M56 25v9M62 25v9" stroke="#fff" stroke-width="1.6" opacity=".8"/><ellipse cx="86" cy="25" rx="9" ry="3.5" fill="#f7cdc6"/>' +
    '<rect x="20" y="34" width="3" height="10" fill="#9b8164"/><rect x="104" y="34" width="3" height="10" fill="#9b8164"/><rect x="16" y="33" width="98" height="2" fill="#2a1608" opacity=".15"/>');
  // The spike's ground pool, lifted out as a flat piece so it can be tapped. Stretched 1.5x tall like the spike's ground.
  const pool = ({ side = 'r' } = {}) => svg('0 0 108 69', '<g transform="scale(1 1.5)">' + cut('rect', 'x="0" y="0" width="108" height="46" rx="6"', '#f3ead6', side) +
    R(10, i => `<path d="M${6 + i * 10.6} 0v3M${6 + i * 10.6} 43v3" stroke="#d9cba9" stroke-width=".8"/>`) +
    '<rect x="4" y="3" width="100" height="40" rx="5" fill="url(#sbWater)"/><rect x="4" y="3" width="100" height="5" rx="3" fill="#0d5f80" opacity=".35"/>' +
    '<path class="shimmer" d="M12 12 Q22 9 32 12 T52 12 M44 26 Q54 23 64 26 T84 26 M16 36 Q26 33 36 36 M70 15 Q78 12 86 15 T100 15 M60 37 Q68 34 76 37" stroke="#d3f6ff" stroke-width="1.6" fill="none"/>' +
    R(14, i => `<path d="M${10 + rnd(i) * 88} ${8 + rnd(i + 7) * 32} l2 -1 l2 1" stroke="#e8fbff" stroke-width=".7" fill="none" opacity=".8"/>`) +
    '<path d="M92 3 v-5 a3 3 0 0 1 6 0 v5 M95 3 v-5" stroke="url(#sbChrome)" stroke-width="1.4" fill="none"/>' +
    '<circle class="ripple" cx="54" cy="23" r="9"/><circle class="ripple" cx="54" cy="23" r="9"/><circle class="ripple" cx="54" cy="23" r="9"/></g>');

  /* the cinema screen in the courtyard */
  const screen = ({ side = 'r' } = {}) => svg('0 0 240 180',
    '<rect x="8" y="2" width="224" height="146" fill="url(#sbGlow)" opacity=".7"/>' +
    cut('rect', 'x="20" y="20" width="4" height="160"', '#4a3a32', side, false) + cut('rect', 'x="216" y="20" width="4" height="160"', '#4a3a32', side, false) +
    '<path d="M22 20 L4 180 M218 20 L236 180" stroke="#4a3a32" stroke-width=".8" opacity=".6"/>' +
    cut('rect', 'x="26" y="14" width="188" height="118"', '#fffaf0', side) + '<rect x="26" y="14" width="188" height="118" fill="none" stroke="#e8dcc2" stroke-width="3"/>' +
    '<path d="M24 12 Q120 26 216 12" stroke="#2c2733" stroke-width="1" fill="none"/>' + R(9, i => { const t = (i + 1) / 10, x = 24 + t * 192, y = 12 + 4 * t * (1 - t) * 14; return `<circle class="bulb" cx="${x}" cy="${y + 3}" r="2.6" fill="#ffd77e"/>`; }) +
    '<text x="120" y="70" text-anchor="middle" font-family="Pinyon Script" font-size="32" fill="#2b2740">Sophie &amp; Joe</text><text x="120" y="100" text-anchor="middle" font-family="Cormorant Garamond" font-weight="700" font-size="15" letter-spacing="4" fill="#2b2740">29.05.2027</text>' +
    '<path d="M114 170 L26 14 L214 14 L126 170Z" fill="url(#sbBeam)" opacity=".32"/>' +
    '<rect x="106" y="168" width="28" height="10" rx="2" fill="#2f2a33"/><circle cx="120" cy="170" r="3.4" fill="#fff6d8"/><circle cx="120" cy="170" r="10" fill="url(#sbGlow)"/>');

  /* the blurred leaves in the front corners */
  const branch = ({ leaf = '#3c5a33', bloom = '#e6b8c0' } = {}) => {
    let s = `<path d="M6 236 C40 176 76 132 122 96 C150 72 168 46 190 10" stroke="${leaf}" stroke-width="4" fill="none"/>`;
    s += R(22, i => { const t = i / 21, x = bez(t, 6, 40, 150, 190), y = bez(t, 236, 176, 72, 10), a = (i % 2 ? 1 : -1) * (36 + (i % 3) * 10), l = 22 - t * 8; return `<ellipse cx="${x}" cy="${y}" rx="${l}" ry="${l * .3}" fill="${i % 3 ? leaf : tone(leaf, .3)}" transform="rotate(${a - 50} ${x} ${y}) translate(${l * .8} 0)"/>`; });
    s += [[96, 118], [148, 70], [56, 168], [176, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${bloom}"/><circle cx="${x}" cy="${y}" r="2" fill="#f2c25a"/>`).join('');
    return svg('0 0 200 240', s);
  };

  /* walls and grounds */
  const lightsSvg = (y = 0) => {
    const P = [[0, 10], [100, 64], [200, 22], [300, 64], [400, 10]];
    let s = '<path d="M0 10 Q100 64 200 22 Q300 64 400 10" stroke="#2c2733" stroke-width="1.4" fill="none"/>';
    for (const [a, c, b] of [[P[0], P[1], P[2]], [P[2], P[3], P[4]]]) for (let i = 1; i < 10; i++) {
      const t = i / 10, x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], yy = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1];
      s += `<circle class="bulb" cx="${x}" cy="${yy + 4}" r="3.4" fill="#ffd77e" style="animation-delay:${(i * .37 % 2.6).toFixed(2)}s;filter:drop-shadow(0 0 4px #ffcf6a)"/>`;
    }
    return `<svg class="wallsvg lights" viewBox="0 0 400 80" style="top:${y}%" data-act="lights">${s}</svg>`;
  };
  const swallowSvg = () => '<svg class="swallow" viewBox="0 0 34 18"><path class="wing" d="M1 9 Q9 0 17 9 Q25 0 33 9 Q25 5 17 13 Q9 5 1 9Z" fill="#26213a"/><path d="M15 9 L19 9 L23 17 L17 12 L11 17Z" fill="#26213a"/></svg>';
  const tiles = c => Array.from({ length: 22 * 14 }, (_, i) => { const r = Math.floor(i / 22), k = i % 22; return `<rect x="${k * 14 + (r % 2) * 7 - 7}" y="${r * 15}" width="12.5" height="13.5" rx="2.5" fill="${c[(i * 7 + r) % 3]}"/>`; }).join('');
  const stars = n => R(n, i => `<i class="star" style="left:${(i * 37.7) % 100}%;top:${(i * 23.3) % 62}%;animation-delay:${(i * .41) % 3}s"></i>`);
  const layer = (style, inner) => `<div class="wallsvg" style="${style}">${inner}</div>`;

  const WALLS = {
    tuscany: () => layer('bottom:12%', hills({ c: '#d8b48e', v: 1 })) + layer('bottom:0;left:-4%;width:46%', town({ c: '#c69a83' })) + layer('bottom:0', hills({ c: '#b8b183', stripes: '#a39f72' })) + swallowSvg(),
    friday: () => layer('bottom:0', hills({ c: '#4b4566', v: 1 })) + lightsSvg(44),
    saturday: () => layer('bottom:8%', hills({ c: '#d9c19b' })) + layer('bottom:0;left:56%;width:46%', town({ c: '#cfae96', side: 'l' })) + layer('bottom:0', hills({ c: '#b9b47f', v: 1, stripes: '#a7a370' })) + swallowSvg(),
    sunday: () => '<svg class="wallsvg" viewBox="0 0 400 60" style="top:30%"><g fill="#fff"><ellipse cx="80" cy="30" rx="44" ry="13"/><ellipse cx="110" cy="22" rx="28" ry="14"/><ellipse cx="300" cy="40" rx="40" ry="10"/><ellipse cx="322" cy="33" rx="22" ry="11"/></g></svg>' + layer('bottom:4%', hills({ c: '#a9c9a5', v: 1 })) + layer('bottom:0', hills({ c: '#93b871', stripes: '#84a964' })) + swallowSvg(),
    monday: () => layer('bottom:10%', hills({ c: '#c9c1a3' })) + layer('bottom:0', hills({ c: '#a8b47d', v: 1, stripes: '#98a46e' })) + swallowSvg(),
    reply: () => layer('bottom:0', hills({ c: '#33324f', v: 1 })) + lightsSvg(52),
    // The inside of the back cover: a gold frame. The pocket and its cards are HTML above the scene, so they stay real links.
    pocket: () => '<svg class="wallsvg" viewBox="0 0 400 300" style="top:0;height:100%" preserveAspectRatio="none"><rect x="40" y="14" width="320" height="300" rx="10" fill="none" stroke="#e3b660" stroke-width="1.5" opacity=".75"/></svg>'
  };
  const GROUNDS = {
    tuscany: () => '<rect width="300" height="200" fill="#93ad63"/><path d="M150 200 C150 150 120 120 160 80 C190 50 170 20 190 0" stroke="#ead8a8" stroke-width="20" fill="none"/><path d="M0 30 L300 30 M0 70 L300 70" stroke="#86a058" stroke-width="5" opacity=".6"/>',
    friday: () => '<rect width="300" height="200" fill="#a98d6c"/>' + tiles(['#b39673', '#a68866', '#ba9d7a']),
    saturday: () => '<rect width="300" height="200" fill="#9fbb6e"/>' + R(8, i => `<rect x="${i * 40}" y="0" width="20" height="200" fill="#a9c477" opacity=".7"/>`) + '<path d="M138 200 L146 26 L154 26 L162 200Z" fill="#f4ead2"/>',
    sunday: () => '<rect width="300" height="200" fill="#e2cfa4"/>' + R(30, i => `<path d="M0 ${i * 7} L300 ${i * 7}" stroke="#d6c193" stroke-width="1"/>`),
    monday: () => '<rect width="300" height="200" fill="#9db56a"/><path d="M40 200 C60 140 200 150 180 90 C165 45 230 30 240 0" stroke="#ead8a8" stroke-width="22" fill="none"/>',
    reply: () => '<rect width="300" height="200" fill="#7f6a55"/>' + tiles(['#8a735b', '#7c6751', '#917a60']),
    pocket: () => '<rect width="300" height="200" fill="#e9dbbd"/>' + R(60, i => `<circle cx="${(i % 10) * 30 + 15}" cy="${Math.floor(i / 10) * 34 + 17}" r="1.4" fill="#b9a175" opacity=".55"/>`)
  };

  const ART = { cypress, hills, town, villa, fiat, oven, table, arch, chairs, olive, parasol, lounger, screen, pool, branch };
  const api = { ART, WALLS, GROUNDS, STARS: stars, DEFS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StorybookArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
