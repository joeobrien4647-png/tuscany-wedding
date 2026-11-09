const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

test('villas.html preloads the model, three.js and the explorer kernel from its head', () => {
  const head = read('villas.html').split('</head>')[0];
  assert.match(head, /<link rel="preload" href="data\/villas-model\.json" as="fetch" crossorigin>/);
  assert.match(head, /<link rel="modulepreload" href="js\/villas\/vendor\/three-core\.js">/);
  assert.match(head, /<link rel="modulepreload" href="js\/villas\/app\.js">/);
  assert.ok(read('js/villas/app.js').includes("from './vendor/three-core.js'"), 'app.js still loads the preloaded three.js');
});

test('the explorer starts loading its code alongside the model, with no idle wait', () => {
  const boot = read('js/villas/boot.js');
  assert.doesNotMatch(boot, /requestIdleCallback/);
  const fetchAt = boot.indexOf("fetch('data/villas-model.json')");
  const importAt = boot.indexOf("import('./app.js')");
  assert.ok(fetchAt > -1 && importAt > fetchAt, 'the model fetch starts first, then the import');
  assert.ok(importAt < boot.indexOf('await modelLoad'), 'app.js starts loading before the model is awaited');
});
