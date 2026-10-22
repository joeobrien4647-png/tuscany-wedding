(function (root) {
  'use strict';
  // Placeholder words from the welcome film's titles. Joe writes the final lines.
  // Pieces: x and w are % of the page width, depth is % down the floor (0 is the fold).
  const SCENES = [
    { id: 'tuscany', label: 'Tuscany', kicker: '28 to 31 May 2027', title: 'A weekend in good company', ink: '#3b2b40',
      sky: 'linear-gradient(180deg,#f2b089 0%,#f7c994 45%,#fbe3b2 100%)', sun: [72, 62, 70, '#fff3cf'], fore: ['#3c5a33', '#e6b8c0'],
      pieces: [
        { art: 'hills', opts: { c: '#8aa65b', v: 1, stripes: '#7b9750' }, x: -10, w: 120, depth: 1 },
        { art: 'cypress', x: 5, w: 4.5, depth: 6 }, { art: 'cypress', x: 11, w: 4.5, depth: 6 }, { art: 'cypress', x: 17, w: 4.5, depth: 6 },
        { art: 'cypress', x: 84, w: 4.5, depth: 8 }, { art: 'cypress', x: 90, w: 4.5, depth: 8 },
        { art: 'villa', x: 30, w: 44, depth: 14 },
        { art: 'olive', x: 74, w: 20, depth: 22 },
        { art: 'cypress', opts: { c: '#36502f' }, x: 4, w: 9, depth: 30 },
        { art: 'fiat', x: 38, w: 28, depth: 40, act: 'drive' }
      ] },
    { id: 'friday', label: 'Friday', kicker: 'Friday 28 May', title: 'Pizza night', ink: '#fff4dc', stars: 26,
      sky: 'linear-gradient(180deg,#25244f 0%,#5b3b6b 45%,#c4687a 78%,#f2a26f 100%)', sun: [80, 18, 26, '#fff4dc'], fore: ['#161f1a', '#2a2a3a'],
      pieces: [
        { art: 'villa', opts: { glow: true, stone: '#cdb48c', shade: '#bfa47c', roof: '#a5573a' }, x: 46, w: 50, depth: 3 },
        { art: 'cypress', opts: { c: '#2c3f2c' }, x: 6, w: 6, depth: 5 }, { art: 'cypress', opts: { c: '#2c3f2c' }, x: 14, w: 5, depth: 5 },
        { art: 'olive', opts: { c: '#6f8358' }, x: 86, w: 18, depth: 12 },
        { art: 'oven', x: 4, w: 30, depth: 20, act: 'fire' },
        { art: 'table', x: 34, w: 62, depth: 36 }
      ] },
    { id: 'saturday', label: 'Saturday', kicker: 'Saturday 29 May', title: 'The wedding', ink: '#3b2b40',
      sky: 'linear-gradient(180deg,#f3c79a 0%,#f8dcb0 50%,#fbeccb 100%)', sun: [24, 70, 60, '#fff6dc'], fore: ['#4a6a3a', '#fff4ec'],
      pieces: [
        { art: 'cypress', x: 3, w: 4, depth: 3 }, { art: 'cypress', x: 9, w: 4, depth: 3 }, { art: 'cypress', x: 15, w: 4, depth: 3 },
        { art: 'villa', x: 62, w: 38, depth: 5 },
        { art: 'olive', x: 0, w: 22, depth: 20 },
        { art: 'arch', x: 36, w: 28, depth: 18, act: 'petals' },
        { art: 'chairs', x: 14, w: 72, depth: 42 }
      ] },
    { id: 'sunday', label: 'Sunday', kicker: 'Sunday 30 May', title: 'Pool day', ink: '#24354a',
      sky: 'linear-gradient(180deg,#7fc6ec 0%,#b9e2f5 60%,#e7f6fb 100%)', sun: [78, 26, 46, '#fffbe6'], fore: ['#3f6a3a', '#f3d36b'],
      pieces: [
        { art: 'pool', x: 21, w: 58, depth: 36, act: 'splash', flat: true },
        { art: 'villa', opts: { shutter: '#5f8fa6' }, x: 54, w: 42, depth: 3 },
        { art: 'cypress', x: 5, w: 5, depth: 4 }, { art: 'cypress', x: 12, w: 5, depth: 4 },
        { art: 'parasol', x: 6, w: 20, depth: 16 }, { art: 'parasol', opts: { b: '#5f8fa6' }, x: 76, w: 20, depth: 14 },
        { art: 'lounger', x: 4, w: 28, depth: 30 }, { art: 'lounger', x: 68, w: 28, depth: 34 }
      ] },
    { id: 'monday', label: 'Monday', kicker: 'Monday 31 May', title: 'Buon viaggio', ink: '#3b2b40', auto: 'drive',
      sky: 'linear-gradient(180deg,#a9cfe8 0%,#f6d6b7 70%,#fbe6c6 100%)', sun: [30, 74, 54, '#fff1cf'], fore: ['#45633a', '#e6b8c0'],
      pieces: [
        { art: 'cypress', x: 58, w: 4, depth: 4 }, { art: 'cypress', x: 64, w: 4, depth: 6 }, { art: 'cypress', x: 70, w: 4, depth: 8 }, { art: 'cypress', x: 76, w: 4, depth: 10 },
        { art: 'villa', x: 76, w: 22, depth: 1 },
        { art: 'olive', x: 4, w: 22, depth: 16 },
        { art: 'fiat', opts: { bag: true }, x: 20, w: 34, depth: 42, act: 'drive' }
      ] },
    { id: 'reply', label: 'Reply', kicker: 'Reply by 28 February', title: 'Are you coming?', ink: '#fff4dc', stars: 40, reply: true,
      notes: ['We kindly ask £150 each for your room', 'Once you’re here, nothing else to pay', 'No presents, please'],
      sky: 'linear-gradient(180deg,#141838 0%,#2a2a58 55%,#4b3a66 100%)', sun: [84, 16, 22, '#fff4dc'], fore: ['#10161a', '#2a2a3a'],
      pieces: [
        { art: 'cypress', opts: { c: '#22311f' }, x: 4, w: 6, depth: 4 }, { art: 'cypress', opts: { c: '#22311f' }, x: 90, w: 6, depth: 4 },
        { art: 'screen', x: 20, w: 60, depth: 8, cls: 'glowpop' },
        { art: 'fiat', opts: { lights: true }, x: 70, w: 26, depth: 16, act: 'drive' }
      ] },
    { id: 'pocket', label: 'Pocket', kicker: 'Everything else', title: 'In the pocket', ink: '#f3dda4', stars: 18, pocket: true,
      sky: 'radial-gradient(120% 80% at 50% 35%,#2a3d72 0%,#1b2952 60%,#131d3c 100%)', sun: [50, 20, 0, '#f3dda4'], fore: ['#1b2952', '#e3b660'],
      pieces: [] }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = { SCENES };
  else root.StorybookScenes = SCENES;
})(typeof window !== 'undefined' ? window : globalThis);
