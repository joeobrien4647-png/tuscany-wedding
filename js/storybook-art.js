(function (root) {
  'use strict';
  // Paper pieces ported unchanged from the approved spike. Session 3 redraws them.
  const svg = (vb, inner, cls = '') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="${cls}">${inner}</svg>`;

  const cypress = ({ c = '#3d5a3b' } = {}) => svg('0 0 30 120', `<path d="M15 2 C21 22 26 48 25 74 C24 96 21 108 18 114 L12 114 C9 108 6 96 5 74 C4 48 9 22 15 2Z" fill="${c}"/><path d="M15 8 C19 36 21 66 19 100" stroke="rgba(255,255,255,.16)" stroke-width="2" fill="none"/><rect x="13.5" y="112" width="3" height="8" fill="#5b3e2a"/>`);
  const hills = ({ c = '#8ea85e', v = 0, stripes = '' } = {}) => {
    const d = v ? 'M0 90 L0 40 C50 22 90 30 140 42 C190 54 220 30 270 24 C320 18 360 34 400 30 L400 90Z' : 'M0 90 L0 50 C40 30 85 26 130 38 C170 49 200 36 240 28 C285 19 330 32 370 44 L400 50 L400 90Z';
    let s = `<path d="${d}" fill="${c}"/>`;
    if (stripes) for (let i = 0; i < 9; i++) s += `<path d="M${40 + i * 38} 90 C${50 + i * 38} 70 ${70 + i * 38} 58 ${96 + i * 38} 52" stroke="${stripes}" stroke-width="2.5" fill="none" opacity=".55"/>`;
    return svg('0 0 400 90', s);
  };
  const town = ({ c = '#c49a86' } = {}) => svg('0 0 200 90', `<path d="M0 90 C30 62 60 50 100 48 C140 50 170 62 200 90Z" fill="${c}"/><g fill="${c}"><rect x="62" y="30" width="20" height="22"/><rect x="80" y="24" width="24" height="28"/><rect x="104" y="4" width="9" height="46"/><path d="M102 6 L108.5 -5 L115 6Z"/><rect x="112" y="28" width="28" height="24"/><path d="M60 31 L72 22 L84 31Z M78 25 L92 16 L106 25Z M110 29 L126 20 L142 29Z"/><circle cx="92" cy="22" r="7"/></g>`);
  const villa = ({ stone = '#ecd5a8', shade = '#dcc08e', roof = '#c4693f', glow = false, shutter = '#7b8f5e' } = {}) => {
    const w = glow ? '#ffc964' : '#5d6f7d';
    let s = `<rect x="18" y="62" width="140" height="88" fill="${stone}"/><path d="M8 64 L88 30 L168 64Z" fill="${roof}"/><rect x="8" y="64" width="160" height="5" fill="rgba(0,0,0,.12)"/><rect x="146" y="26" width="52" height="124" fill="${shade}"/><path d="M140 28 L172 6 L204 28Z" fill="${roof}"/>`;
    for (const x of [34, 74, 114]) for (const y of [80, 114]) {
      if (x === 74 && y === 114) continue;
      s += `<rect x="${x - 6}" y="${y}" width="5" height="22" fill="${shutter}"/><rect x="${x + 17}" y="${y}" width="5" height="22" fill="${shutter}"/><rect x="${x}" y="${y}" width="16" height="22" rx="1" fill="${w}"/>`;
    }
    s += `<path d="M76 150 L76 126 C76 115 98 115 98 126 L98 150Z" fill="#7a4e32"/><rect x="164" y="44" width="16" height="20" fill="${w}"/><rect x="164" y="92" width="16" height="20" fill="${w}"/>`;
    s += `<g fill="#6f8f4c"><circle cx="20" cy="120" r="9"/><circle cx="26" cy="106" r="7"/><circle cx="18" cy="94" r="6"/><circle cx="24" cy="138" r="11"/></g><g fill="#e98fa5"><circle cx="22" cy="112" r="2.2"/><circle cx="17" cy="128" r="2.2"/><circle cx="28" cy="132" r="2.2"/><circle cx="21" cy="98" r="2"/></g>`;
    return svg('0 0 210 150', s);
  };
  const fiat = ({ body = '#f2e2b8', bag = false, lights = false } = {}) => svg('0 0 170 100', `
    ${bag ? '<rect x="58" y="1" width="56" height="14" rx="3" fill="#a8693d"/><rect x="62" y="6" width="48" height="2" fill="rgba(0,0,0,.22)"/><rect x="52" y="14" width="68" height="3" rx="1.5" fill="#6b5a4a"/>' : ''}
    <path d="M14 76 C12 58 22 50 40 48 L52 26 C56 18 64 15 76 15 L104 15 C117 15 125 20 131 30 L142 48 C158 50 162 60 160 76 Z" fill="${body}"/>
    <path d="M57 28 C60 22 65 20 73 20 L84 20 L84 46 L50 46 Z" fill="#a9d3e6"/><path d="M90 20 L104 20 C113 20 119 24 123 30 L131 46 L90 46 Z" fill="#a9d3e6"/>
    <rect x="14" y="64" width="146" height="3" fill="rgba(0,0,0,.1)"/><rect x="86" y="46" width="2" height="22" fill="rgba(0,0,0,.14)"/>
    <circle cx="152" cy="58" r="5" fill="${lights ? '#fff3b0' : '#fffbe8'}"/>
    <rect x="10" y="68" width="10" height="5" rx="2" fill="#c9c6bd"/><rect x="150" y="68" width="14" height="5" rx="2" fill="#c9c6bd"/>
    <g class="wheel" style="transform-origin:46px 78px"><circle cx="46" cy="78" r="14" fill="#2b2a33"/><circle cx="46" cy="78" r="6" fill="#d8d5cc"/><rect x="45" y="66" width="2" height="24" fill="#55525e"/></g>
    <g class="wheel" style="transform-origin:128px 78px"><circle cx="128" cy="78" r="14" fill="#2b2a33"/><circle cx="128" cy="78" r="6" fill="#d8d5cc"/><rect x="127" y="66" width="2" height="24" fill="#55525e"/></g>`, 'car');
  const oven = () => svg('0 0 130 125', `
    <g class="puffs"><circle cx="68" cy="4" r="6" fill="#ebe4da"/><circle cx="70" cy="4" r="7" fill="#ebe4da"/><circle cx="66" cy="4" r="6" fill="#ebe4da"/></g>
    <rect x="62" y="8" width="13" height="30" fill="#8d5a3e"/>
    <rect x="8" y="84" width="114" height="41" fill="#b98d66"/><rect x="8" y="84" width="114" height="4" fill="rgba(0,0,0,.14)"/>
    <path d="M16 86 C16 30 114 30 114 86Z" fill="#c8794f"/>
    <path d="M26 62 C40 48 90 48 104 62 M21 75 C40 65 90 65 109 75" stroke="rgba(120,50,20,.35)" stroke-width="2" fill="none"/>
    <path d="M43 86 C43 60 87 60 87 86Z" fill="#2b140c"/>
    <g class="fire"><path d="M50 86 C50 74 56 70 58 62 C62 70 64 66 66 58 C70 68 76 72 80 86Z" fill="#ff9a3c"/><path d="M57 86 C57 78 61 76 62 70 C65 76 68 78 72 86Z" fill="#ffd27a"/></g>`);
  const table = () => {
    let scal = '';
    for (let x = 320; x > 0; x -= 20) scal += ` Q${x - 10} 60 ${x - 20} 52`;
    let s = `<rect x="16" y="44" width="5" height="32" fill="#7a5236"/><rect x="299" y="44" width="5" height="32" fill="#7a5236"/><path d="M0 30 L320 30 L320 52${scal} Z" fill="#fbf5e6"/>`;
    for (const x of [62, 162, 262]) s += `<ellipse cx="${x}" cy="28" rx="24" ry="6" fill="#e3ae5f"/><ellipse cx="${x}" cy="27" rx="19" ry="4.5" fill="#d9573e"/><circle cx="${x - 7}" cy="27" r="1.6" fill="#fff4dc"/><circle cx="${x + 6}" cy="26.5" r="1.6" fill="#fff4dc"/><circle cx="${x}" cy="28" r="1.4" fill="#5d8a3a"/>`;
    for (const x of [112, 214]) s += `<rect x="${x}" y="6" width="8" height="24" rx="2" fill="#2f5a3a"/><rect x="${x + 2.5}" y="0" width="3" height="8" fill="#2f5a3a"/>`;
    for (const x of [26, 98, 140, 196, 236, 300]) s += `<path d="M${x} 16 L${x + 8} 16 L${x + 6} 26 L${x + 2} 26Z" fill="rgba(235,245,255,.75)"/><rect x="${x + 3.4}" y="26" width="1.4" height="4" fill="#ccd"/>`;
    for (const x of [130, 186]) s += `<rect x="${x}" y="16" width="4" height="14" fill="#fff7e6"/><ellipse class="flame" cx="${x + 2}" cy="13" rx="2.2" ry="4" fill="#ffc35a"/>`;
    return svg('0 0 320 76', s);
  };
  const arch = () => {
    let s = '<rect x="16" y="70" width="9" height="130" fill="#efe4cc"/><rect x="145" y="70" width="9" height="130" fill="#efe4cc"/><path d="M20 76 C20 4 150 4 150 76" stroke="#6e8f52" stroke-width="16" fill="none" stroke-linecap="round"/>';
    const cols = ['#fffaf2', '#f7cdc6', '#e8949b', '#fffaf2', '#f3dcae', '#f7cdc6'];
    const B = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, x = B(t, 20, 20, 150, 150), y = B(t, 76, 4, 4, 76);
      s += `<ellipse cx="${x + (i % 2 ? 6 : -6)}" cy="${y + 3}" rx="7" ry="3.5" fill="#5f8248" transform="rotate(${i * 13} ${x} ${y})"/><circle cx="${x}" cy="${y}" r="${6 + (i % 3)}" fill="${cols[i % cols.length]}"/>`;
    }
    for (const [x, y, r, k] of [[20, 92, 6, 1], [24, 106, 5, 2], [18, 120, 4, 0], [150, 92, 6, 2], [146, 106, 5, 1], [152, 120, 4, 3]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${cols[k]}"/>`;
    return svg('0 0 170 200', s);
  };
  const chairs = () => {
    let s = '';
    for (const [y, sc] of [[6, .9], [30, 1]]) for (let i = 0; i < 12; i++) {
      const x = i < 6 ? 8 + i * 22 : 162 + (i - 6) * 22;
      s += `<g transform="translate(${x} ${y}) scale(${sc})"><rect x="0" y="0" width="13" height="15" rx="2" fill="#f6efe0"/><rect x="-1" y="14" width="15" height="4" fill="#efe5d0"/><rect x="0" y="18" width="2" height="7" fill="#d8ccb2"/><rect x="11" y="18" width="2" height="7" fill="#d8ccb2"/><circle cx="6.5" cy="6" r="2.4" fill="#e8a9a6"/></g>`;
    }
    return svg('0 0 300 60', s);
  };
  const olive = ({ c = '#8aa06a' } = {}) => svg('0 0 110 120', `<path d="M52 120 C54 100 48 88 40 76 M56 120 C58 98 64 86 72 74" stroke="#6b5440" stroke-width="7" fill="none" stroke-linecap="round"/><g fill="${c}"><ellipse cx="38" cy="58" rx="30" ry="22"/><ellipse cx="72" cy="52" rx="32" ry="24"/><ellipse cx="55" cy="36" rx="30" ry="22"/></g><g fill="rgba(255,255,255,.18)"><ellipse cx="50" cy="30" rx="16" ry="8"/><ellipse cx="80" cy="46" rx="12" ry="6"/></g>`);
  const parasol = ({ a = '#f6ecd6', b = '#d9785a' } = {}) => {
    let s = '<rect x="58.5" y="12" width="3" height="110" fill="#8a6a4a"/>';
    for (let i = 0; i < 6; i++) { const x1 = 8 + i * 104 / 6, x2 = 8 + (i + 1) * 104 / 6; s += `<path d="M60 10 L${x1} 52 Q${(x1 + x2) / 2} 59 ${x2} 52Z" fill="${i % 2 ? b : a}"/>`; }
    return svg('0 0 120 125', s + '<circle cx="60" cy="9" r="3" fill="#8a6a4a"/>');
  };
  const lounger = () => svg('0 0 120 44', '<path d="M8 30 L30 4 L36 8 L18 30Z" fill="#f4ede0"/><rect x="16" y="26" width="98" height="8" rx="2" fill="#f4ede0"/><rect x="40" y="25" width="30" height="9" fill="#5fb0cf"/><rect x="20" y="34" width="3" height="10" fill="#9b8164"/><rect x="104" y="34" width="3" height="10" fill="#9b8164"/>');
  const screen = () => svg('0 0 240 180', `<rect x="20" y="20" width="4" height="160" fill="#4a3a32"/><rect x="216" y="20" width="4" height="160" fill="#4a3a32"/><rect x="26" y="14" width="188" height="118" fill="#fffaf0"/><text x="120" y="70" text-anchor="middle" font-family="Pinyon Script" font-size="32" fill="#2b2740">Sophie &amp; Joe</text><text x="120" y="100" text-anchor="middle" font-family="Cormorant Garamond" font-weight="700" font-size="15" letter-spacing="4" fill="#2b2740">29.05.2027</text>`);
  // The spike's ground pool, lifted out as a piece that lies flat so it can be tapped. Stretched 1.5x tall like the spike's ground.
  const pool = () => svg('0 0 108 69', '<g transform="scale(1 1.5)"><rect x="0" y="0" width="108" height="46" rx="6" fill="#ffffff"/><rect x="4" y="3" width="100" height="40" rx="5" fill="#4cbde0"/><path class="shimmer" d="M12 12 Q22 9 32 12 T52 12 M44 26 Q54 23 64 26 T84 26 M16 36 Q26 33 36 36" stroke="#c9f1ff" stroke-width="2" fill="none"/><circle class="ripple" cx="54" cy="23" r="9"/><circle class="ripple" cx="54" cy="23" r="9"/><circle class="ripple" cx="54" cy="23" r="9"/></g>');
  const branch = ({ leaf = '#3c5a33', bloom = '#e6b8c0' } = {}) => {
    let s = `<path d="M10 230 C40 170 70 130 120 90 C150 66 170 40 190 6" stroke="${leaf}" stroke-width="5" fill="none"/><path d="M60 150 C40 120 30 100 30 70" stroke="${leaf}" stroke-width="3.5" fill="none"/>`;
    const pts = [[30, 205, -40], [48, 178, 30], [64, 156, -50], [84, 132, 35], [104, 110, -45], [126, 92, 30], [146, 72, -40], [162, 50, 35], [178, 28, -35], [38, 120, 20], [32, 92, -30], [44, 140, 40]];
    for (const [x, y, r] of pts) s += `<ellipse cx="${x}" cy="${y}" rx="24" ry="8" fill="${leaf}" transform="rotate(${r} ${x} ${y})"/>`;
    for (const [x, y] of [[92, 120], [140, 80], [52, 168], [36, 104]]) s += `<circle cx="${x}" cy="${y}" r="7" fill="${bloom}"/><circle cx="${x}" cy="${y}" r="2.5" fill="#f2c25a"/>`;
    return svg('0 0 200 240', s);
  };

  // Walls, grounds and the bits that live on them.
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
  const stars = n => { let s = ''; for (let i = 0; i < n; i++) s += `<i class="star" style="left:${(i * 37.7) % 100}%;top:${(i * 23.3) % 62}%;animation-delay:${(i * .41) % 3}s"></i>`; return s; };
  const layer = (style, inner) => `<div class="wallsvg" style="${style}">${inner}</div>`;

  const WALLS = {
    tuscany: () => layer('bottom:12%', hills({ c: '#d8b48e', v: 1 })) + layer('bottom:0;left:-4%;width:46%', town({ c: '#c69a83' })) + layer('bottom:0', hills({ c: '#b8b183', stripes: '#a39f72' })) + swallowSvg(),
    friday: () => layer('bottom:0', hills({ c: '#4b4566', v: 1 })) + lightsSvg(44),
    saturday: () => layer('bottom:8%', hills({ c: '#d9c19b' })) + layer('bottom:0;left:56%;width:46%', town({ c: '#cfae96' })) + layer('bottom:0', hills({ c: '#b9b47f', v: 1, stripes: '#a7a370' })) + swallowSvg(),
    sunday: () => '<svg class="wallsvg" viewBox="0 0 400 60" style="top:30%"><g fill="#fff"><ellipse cx="80" cy="30" rx="44" ry="13"/><ellipse cx="110" cy="22" rx="28" ry="14"/><ellipse cx="300" cy="40" rx="40" ry="10"/><ellipse cx="322" cy="33" rx="22" ry="11"/></g></svg>' + layer('bottom:4%', hills({ c: '#a9c9a5', v: 1 })) + layer('bottom:0', hills({ c: '#93b871', stripes: '#84a964' })) + swallowSvg(),
    monday: () => layer('bottom:10%', hills({ c: '#c9c1a3' })) + layer('bottom:0', hills({ c: '#a8b47d', v: 1, stripes: '#98a46e' })) + swallowSvg(),
    reply: () => layer('bottom:0', hills({ c: '#33324f', v: 1 })) + lightsSvg(52),
    // The inside of the back cover: a gold frame. The pocket and its cards are HTML above the scene, so they stay real links.
    pocket: () => '<svg class="wallsvg" viewBox="0 0 400 300" style="top:0;height:100%" preserveAspectRatio="none"><rect x="40" y="14" width="320" height="300" rx="10" fill="none" stroke="#e3b660" stroke-width="1.5" opacity=".75"/></svg>'
  };
  const GROUNDS = {
    tuscany: () => '<rect width="300" height="200" fill="#93ad63"/><path d="M150 200 C150 150 120 120 160 80 C190 50 170 20 190 0" stroke="#ead8a8" stroke-width="20" fill="none"/><path d="M0 30 L300 30 M0 70 L300 70" stroke="#86a058" stroke-width="5" opacity=".6"/>',
    friday: () => '<rect width="300" height="200" fill="#a98d6c"/>' + tiles(['#b39673', '#a68866', '#ba9d7a']),
    saturday: () => '<rect width="300" height="200" fill="#9fbb6e"/>' + Array.from({ length: 8 }, (_, i) => `<rect x="${i * 40}" y="0" width="20" height="200" fill="#a9c477" opacity=".7"/>`).join('') + '<path d="M138 200 L146 26 L154 26 L162 200Z" fill="#f4ead2"/>',
    sunday: () => '<rect width="300" height="200" fill="#e2cfa4"/>' + Array.from({ length: 30 }, (_, i) => `<path d="M0 ${i * 7} L300 ${i * 7}" stroke="#d6c193" stroke-width="1"/>`).join(''),
    monday: () => '<rect width="300" height="200" fill="#9db56a"/><path d="M40 200 C60 140 200 150 180 90 C165 45 230 30 240 0" stroke="#ead8a8" stroke-width="22" fill="none"/>',
    reply: () => '<rect width="300" height="200" fill="#7f6a55"/>' + tiles(['#8a735b', '#7c6751', '#917a60']),
    pocket: () => '<rect width="300" height="200" fill="#e9dbbd"/>' + Array.from({ length: 60 }, (_, i) => `<circle cx="${(i % 10) * 30 + 15}" cy="${Math.floor(i / 10) * 34 + 17}" r="1.4" fill="#b9a175" opacity=".55"/>`).join('')
  };

  const ART = { cypress, hills, town, villa, fiat, oven, table, arch, chairs, olive, parasol, lounger, screen, pool, branch };
  const api = { ART, WALLS, GROUNDS, STARS: stars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StorybookArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
