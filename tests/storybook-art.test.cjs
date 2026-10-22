const test = require('node:test');
const assert = require('node:assert/strict');
const { SCENES } = require('../js/storybook-scenes.js');
const { ART, WALLS, GROUNDS, STARS, DEFS } = require('../js/storybook-art.js');

const piecesOf = s => s.pieces.map(p => ART[p.art](Object.assign({ side: s.sun[0] < 50 ? 'l' : 'r', night: !!s.stars }, p.opts || {})));

test('every piece is cut paper lit by the shared light', () => {
  for (const s of SCENES) for (const svg of piecesOf(s)) {
    assert.match(svg, /class="cut"/, s.id);
    assert.match(svg, /url\(#sb(DL|DR)\)/, s.id);
  }
});

test('the shade falls on the side away from the sun', () => {
  for (const name of ['villa', 'fiat', 'oven', 'arch', 'screen', 'cypress', 'olive']) {
    assert.match(ART[name]({ side: 'l' }), /url\(#sbDR\)/, name + ' lit from the left');
    assert.doesNotMatch(ART[name]({ side: 'l' }), /url\(#sbDL\)/, name + ' lit from the left');
    assert.match(ART[name]({ side: 'r' }), /url\(#sbDL\)/, name + ' lit from the right');
  }
});

test('the shared defs hold every gradient the art asks for, once', () => {
  const used = new Set();
  const collect = text => { for (const m of text.matchAll(/url\(#(sb\w+)\)/g)) used.add(m[1]); };
  for (const s of SCENES) { piecesOf(s).forEach(collect); collect(WALLS[s.id]()); collect(GROUNDS[s.id]()); collect(ART.branch({ leaf: s.fore[0], bloom: s.fore[1] })); }
  collect(STARS(10));
  assert.ok(used.size >= 4);
  for (const id of used) assert.equal((DEFS.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
  assert.match(DEFS, /^<svg[^>]*class="sb-defs"/);
  assert.doesNotMatch(DEFS, /href=|url\(http/);
});

test('hero pieces carry their detail', () => {
  const villa = ART.villa({ night: true });
  assert.match(villa, /url\(#sbGlow\)/, 'lit windows at night');
  assert.match(ART.fiat({ bag: true }), /url\(#sbChrome\)/);
  assert.match(ART.oven(), /class="ember"/); assert.match(ART.oven(), /class="floorglow"/);
  assert.match(ART.screen(), /url\(#sbBeam\)/);
  assert.match(ART.pool(), /url\(#sbWater\)/);
  for (const cls of ['car', 'wheel', 'fire', 'puffs', 'flame', 'ripple', 'shimmer']) {
    assert.ok([ART.fiat(), ART.oven(), ART.table(), ART.pool()].some(svg => svg.includes(cls)), cls);
  }
});
