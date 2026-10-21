// Builds the two three.js files this folder serves, from three@0.170.0 (MIT, see LICENSE-three.txt).
//   three-core.js  three itself, OrbitControls and mergeGeometries, as one ES module
//   three-fx.js    the post-processing passes for Best graphics; imports three from ./three-core.js
// Run from a folder whose node_modules has three@0.170.0 and esbuild, for example:
//   cd ../mill-lane-home && node ../tuscany-site-villas/js/villas/vendor/build-three.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.cwd(), 'package.json'));
const { build } = require('esbuild');
const version = JSON.parse(readFileSync(join(process.cwd(), 'node_modules', 'three', 'package.json'), 'utf8')).version;
if (version !== '0.170.0') throw new Error(`expected three 0.170.0, found ${version}`);

const header = `/* three.js r170 (three@${version}), MIT licence: Copyright 2010-2024 Three.js Authors. See LICENSE-three.txt. Built by build-three.mjs. */\n`;
const opts = { bundle: true, format: 'esm', minify: true, target: 'es2019', platform: 'browser', write: false, legalComments: 'none', absWorkingDir: process.cwd() };

const core = await build({
  ...opts,
  stdin: {
    contents: `export * from 'three';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';`,
    resolveDir: process.cwd(),
  },
});
writeFileSync(join(out, 'three-core.js'), header + core.outputFiles[0].text);

const fx = await build({
  ...opts,
  plugins: [{ name: 'core', setup: (b) => b.onResolve({ filter: /^three$/ }, () => ({ path: './three-core.js', external: true })) }],
  stdin: {
    contents: `export { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
export { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
export { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
export { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
export { CopyShader } from 'three/addons/shaders/CopyShader.js';`,
    resolveDir: process.cwd(),
  },
});
const fxText = fx.outputFiles[0].text;
if (/from\s*["']three/.test(fxText)) throw new Error('three-fx.js still imports three by package name');
writeFileSync(join(out, 'three-fx.js'), header + fxText);
console.log('three-core.js', (core.outputFiles[0].text.length / 1024).toFixed(0), 'KB; three-fx.js', (fxText.length / 1024).toFixed(0), 'KB');
