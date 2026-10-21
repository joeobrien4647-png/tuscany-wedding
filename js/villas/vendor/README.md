# three.js for villas.html

Vendored so the villa explorer has no third-party script host and no import map (older iPhones and WhatsApp's
in-app browser load plain relative ES modules fine).

- `three-core.js`: three@0.170.0 with OrbitControls and mergeGeometries, one minified ES module (about 180 KB gzipped)
- `three-fx.js`: the post-processing passes used by Best graphics (GTAO, bloom, SMAA, output); loaded only when
  Best is in use, and imports three from `./three-core.js`
- `LICENSE-three.txt`: three.js's MIT licence, which must stay with these files

Rebuild with `build-three.mjs` (instructions at its top). Nothing else here is hand-edited.
