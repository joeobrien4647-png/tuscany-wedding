// A still at Best quality whatever the graphics level, after mill-lane-home's photo mode: the current view at the
// asked size, samples jittered across the pixel (clean edges) and across the sun's disc (soft shadow edges), with
// contact shadows, averaged in a half-float target. A few samples run in each frame of the explorer's own loop, so
// the page stays responsive; the promise gives a canvas. Loaded only when the first photo is taken.
import * as THREE from '../vendor/three-core.js';

function halton(i, base) {
  let f = 1, r = 0;
  for (let n = i; n > 0; n = Math.floor(n / base)) { f /= base; r += f * (n % base); }
  return r;
}

export function createPhotoJob({ renderer, scene, camera, sky, FX, makeAO, width = 1600, height = 1000, samples = 48, perFrame = 3, onProgress = null }) {
  width = Math.max(16, Math.round(width));
  height = Math.max(16, Math.round(height));
  const n = Math.max(1, samples);
  const cam = camera.clone();
  cam.userData = { ...camera.userData };
  cam.clearViewOffset();
  cam.aspect = width / height;
  cam.updateProjectionMatrix();

  const half = { type: THREE.HalfFloatType };
  const composer = new FX.EffectComposer(renderer, new THREE.WebGLRenderTarget(width, height, half));
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.renderToScreen = false;
  const ao = makeAO(scene, cam);
  ao.setRadius(Math.min(6, Math.max(0.35, cam.position.distanceTo(cam.userData.focus || cam.position) * 0.012)));
  composer.addPass(ao);
  composer.addPass(new FX.OutputPass());
  const accum = new THREE.WebGLRenderTarget(width, height, { ...half, depthBuffer: false });
  const out = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
  const quad = (blend) => {
    const m = new THREE.ShaderMaterial({ ...FX.CopyShader, uniforms: THREE.UniformsUtils.clone(FX.CopyShader.uniforms), depthTest: false, depthWrite: false });
    if (blend) Object.assign(m, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    return new FX.FullScreenQuad(m);
  };
  const add = quad(true), copy = quad(false);
  const sun = sky?.sun;
  const sunAt = new THREE.Vector3(), across = new THREE.Vector3(), up = new THREE.Vector3();
  const clear = new THREE.Color();
  let i = 0, done = false, resolveFn, rejectFn;
  const promise = new Promise((res, rej) => { resolveFn = res; rejectFn = rej; });
  sky?.setHdrFog?.(true);

  function cleanup() {
    composer.passes.forEach((p) => p.dispose?.());
    composer.dispose();
    accum.dispose();
    out.dispose();
    add.dispose();
    copy.dispose();
    if (sun) sun.shadow.needsUpdate = true;
  }

  function finish() {
    copy.material.uniforms.tDiffuse.value = accum.texture;
    renderer.setRenderTarget(out);
    copy.render(renderer);
    renderer.setRenderTarget(null);
    const px = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(out, 0, 0, width, height, px);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const x = c.getContext('2d');
    const img = x.createImageData(width, height);
    for (let row = 0; row < height; row++) img.data.set(px.subarray((height - 1 - row) * width * 4, (height - row) * width * 4), row * width * 4);
    x.putImageData(img, 0, 0);
    return c;
  }

  function step() {
    if (done) return;
    try {
      if (sun) {
        sunAt.copy(sun.position).sub(sun.target.position);
        across.set(0, 1, 0).cross(sunAt).normalize();
        up.crossVectors(sunAt, across).normalize();
      }
      const autoClear = renderer.autoClear;
      for (let k = 0; k < perFrame && i < n; k++, i++) {
        const s = i + 1;
        cam.setViewOffset(width, height, halton(s, 2) - 0.5, halton(s, 3) - 0.5, width, height);
        if (sun) {
          // across the sun's disc (a little wider than its 0.27 degree radius, for a soft penumbra)
          const a = 2 * Math.PI * halton(s, 5), r = Math.sqrt(halton(s, 7)) * sunAt.length() * 0.008;
          sun.position.copy(sun.target.position).add(sunAt).addScaledVector(across, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
          sun.shadow.needsUpdate = true;
        }
        composer.render();
        add.material.uniforms.tDiffuse.value = composer.readBuffer.texture;
        add.material.uniforms.opacity.value = 1 / n;
        renderer.setRenderTarget(accum);
        renderer.autoClear = false;
        if (i === 0) {
          renderer.getClearColor(clear);
          const alpha = renderer.getClearAlpha();
          renderer.setClearColor(0x000000, 0);
          renderer.clear();
          renderer.setClearColor(clear, alpha);
        }
        add.render(renderer);
        renderer.autoClear = autoClear;
      }
      if (sun) sun.position.copy(sun.target.position).add(sunAt);
      renderer.setRenderTarget(null);
      onProgress?.(i, n);
      if (i < n) return;
      done = true;
      const canvas = finish();
      cleanup();
      resolveFn(canvas);
    } catch (e) {
      done = true;
      cleanup();
      rejectFn(e);
    }
  }

  return {
    promise, step,
    cancel() { if (done) return; done = true; cleanup(); rejectFn(new Error('cancelled')); },
  };
}
