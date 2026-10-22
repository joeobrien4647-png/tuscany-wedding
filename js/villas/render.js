// Graphics levels, after mill-lane-home's render.js.
//   Fast draws straight to the screen (MSAA, no passes).
//   Balanced, for phones that prove quick: GTAO at half resolution, FXAA, and bloom at quarter resolution after dusk.
//   Best draws the scene into a half-float target, adds contact shadows (GTAO), a glow on the lit windows and pools
//   after dark (bloom), sun shafts through the trees and a light warm grade and vignette at golden hour, ACES and sRGB
//   in OutputPass, then SMAA.
// The passes load on first use (vendor/three-fx.js). Auto uses Best on computers; on touch screens it starts at Fast
// and, if a short GPU-timed burst of frames shows headroom (and WebGL2 has half-float targets), steps up to
// Balanced. Either way it drops to Fast when frames stay slow. The canvas survives a lost WebGL context (iOS drops
// them under memory pressure): drawing pauses and resumes, with the passes rebuilt. pipeline.photo() renders a
// still at Best quality whatever the level, accumulating jittered samples (realism/photo.js, loaded when asked).
// ?debug=perf shows the numbers for a real-phone check.
import * as THREE from './vendor/three-core.js';

export const GRAPHICS_KEY = 'sj-villas-graphics';
export const MODES = ['auto', 'best', 'balanced', 'fast'];
const SLOW_MS = 30;
const SLOW_FOR = 3000;
const WARM_UP = 5000;
const PROBE_AFTER = 1800;   // ms of drawing at Fast before the step-up probe
const PROBE_FRAMES = 4;
const PROBE_MS = 10;        // a frame's GPU time under this, and Auto steps up to Balanced

const AO_BLUR = {
  uniforms: { tAO: { value: null }, tDepth: { value: null }, step: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 1000 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tAO, tDepth;
    uniform vec2 step;
    uniform float near, far;
    varying vec2 vUv;
    float viewZ(vec2 uv) { return perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    void main() {
      float z0 = viewZ(vUv);
      float tolerance = 0.012 * abs(z0) + 0.01;
      float sum = 0.0, total = 0.0;
      for (int i = -6; i <= 6; i++) {
        vec2 uv = vUv + step * float(i);
        float w = exp(-float(i * i) / 18.0) * exp(-abs(viewZ(uv) - z0) / tolerance);
        sum += texture2D(tAO, uv).r * w;
        total += w;
      }
      gl_FragColor = vec4(vec3(sum / total), 1.0);
    }`,
};

// FXAA (after Timothy Lottes, in the compact form of glsl-fxaa), on the tone-mapped image.
const FXAA = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;
    void main() {
      vec2 px = 1.0 / resolution;
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb;
      vec4 texM = texture2D(tDiffuse, vUv);
      vec3 luma = vec3(0.299, 0.587, 0.114);
      float lNW = dot(rgbNW, luma), lNE = dot(rgbNE, luma), lSW = dot(rgbSW, luma), lSE = dot(rgbSE, luma), lM = dot(texM.rgb, luma);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
      vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lB = dot(b, luma);
      gl_FragColor = vec4((lB < lMin || lB > lMax) ? a : b, texM.a);
    }`,
};

// Best at golden hour: sun shafts through the trees. From each pixel, a march towards the sun on the screen,
// gathering where the depth says open sky; the sum, in the sun's colour, added to the HDR image before bloom.
const SHAFTS = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uColour: { value: new THREE.Color() }, uStrength: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 uSun;
    uniform vec3 uColour;
    uniform float uStrength, uAspect;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (uSun - vUv) / 28.0;
      vec2 uv = vUv;
      float sum = 0.0, w = 1.0;
      for (int i = 0; i < 28; i++) {
        uv += d;
        float sky = step(0.99995, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x);
        sum += sky * w;
        w *= 0.955;
      }
      vec2 off = (vUv - uSun) * vec2(uAspect, 1.0);
      float near = exp(-dot(off, off) * 3.0);
      c.rgb += uColour * (sum / 28.0) * near * uStrength;
      gl_FragColor = c;
    }`,
};

// Best at golden hour: a light warm grade on the highlights and a soft vignette, on the tone-mapped image.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uGold: { value: 0 } },
  vertexShader: FXAA.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGold;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 1.0, 0.88), uGold * smoothstep(0.25, 0.95, l));
      c.rgb += vec3(0.018, 0.008, -0.004) * uGold * (1.0 - l);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.55 * uGold;
      gl_FragColor = c;
    }`,
};

// UnrealBloomPass compiles a blur program for each of its five mips (KERNEL_RADIUS 3 to 11 is a define). The widest
// blur with each smaller kernel's weights, padded with zeros, draws the same picture from one program: four fewer
// after dusk on Balanced and Best
function shareBloomBlur(bloom) {
  const blurs = bloom.separableBlurMaterials;
  const n = Math.max(...blurs.map((m) => m.defines.KERNEL_RADIUS));
  bloom.separableBlurMaterials = blurs.map((m) => {
    if (m.defines.KERNEL_RADIUS === n) return m;
    const w = m.uniforms.gaussianCoefficients.value;
    const wide = bloom.getSeperableBlurMaterial(n);
    wide.uniforms.gaussianCoefficients.value = Array.from({ length: n }, (_, i) => w[i] ?? 0);
    wide.uniforms.invSize.value = m.uniforms.invSize.value;
    m.dispose();
    return wide;
  });
  return bloom;
}

function makePasses(FX) {
  const { Pass, FullScreenQuad, GTAOPass, CopyShader } = FX;
  const copyQuad = () => new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), depthTest: false, depthWrite: false }));

  // The scene into our own target, then GTAO multiplied over it: GTAO rebuilds normals from this
  // target's depth, so the scene is drawn once. `scale` < 1 computes the AO at a lower resolution.
  class SceneAOPass extends Pass {
    constructor(scene, camera, { scale = 1 } = {}) {
      super();
      this.scene = scene;
      this.camera = camera;
      this.scale = scale;
      this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, stencilBuffer: false, depthTexture: new THREE.DepthTexture(1, 1) });
      this.gtao = new GTAOPass(scene, camera, 1, 1);
      this.gtao.setGBuffer(this.target.depthTexture);
      this.gtao.updateGtaoMaterial({ radius: 2, distanceExponent: 1.2, thickness: 1, distanceFallOff: 1, scale: 1.4, samples: scale < 1 ? 12 : 16, screenSpaceRadius: false });
      this.gtao.updatePdMaterial({ lumaPhi: 8, depthPhi: 2.5, normalPhi: 2, radius: 10, radiusExponent: 1, rings: 3, samples: scale < 1 ? 8 : 16 });
      this.gtao.output = GTAOPass.OUTPUT.Off;
      this.blurA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
      this.blurB = this.blurA.clone();
      this.blur = new FullScreenQuad(new THREE.ShaderMaterial({ ...AO_BLUR, uniforms: THREE.UniformsUtils.clone(AO_BLUR.uniforms), depthTest: false, depthWrite: false }));
      this.copy = copyQuad();
      this.apply = new FullScreenQuad(this.gtao.blendMaterial);
    }

    setRadius(r) { this.gtao.gtaoMaterial.uniforms.radius.value = r; }

    setSize(w, h) {
      const aw = Math.max(1, Math.round(w * this.scale)), ah = Math.max(1, Math.round(h * this.scale));
      this.target.setSize(w, h);
      this.gtao.setSize(aw, ah);
      this.blurA.setSize(aw, ah);
      this.blurB.setSize(aw, ah);
    }

    render(renderer, writeBuffer) {
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
      this.gtao.render(renderer, writeBuffer, this.target);
      const u = this.blur.material.uniforms;
      u.tDepth.value = this.target.depthTexture;
      u.near.value = this.camera.near;
      u.far.value = this.camera.far;
      u.tAO.value = this.gtao.pdRenderTarget.texture;
      u.step.value.set(1.5 / this.blurA.width, 0);
      renderer.setRenderTarget(this.blurA);
      this.blur.render(renderer);
      u.tAO.value = this.blurA.texture;
      u.step.value.set(0, 1.5 / this.blurA.height);
      renderer.setRenderTarget(this.blurB);
      this.blur.render(renderer);
      const out = this.renderToScreen ? null : writeBuffer;
      this.copy.material.uniforms.tDiffuse.value = this.target.texture;
      renderer.setRenderTarget(out);
      this.copy.render(renderer);
      this.gtao.blendMaterial.uniforms.tDiffuse.value = this.blurB.texture;
      this.gtao.blendMaterial.uniforms.intensity.value = 1;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      this.apply.render(renderer);
      renderer.autoClear = autoClear;
    }

    dispose() {
      this.target.depthTexture.dispose();
      this.target.dispose();
      this.blurA.dispose();
      this.blurB.dispose();
      this.blur.dispose();
      this.copy.dispose();
      this.gtao.dispose();
    }
  }

  class FXAAPass extends Pass {
    constructor() {
      super();
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...FXAA, uniforms: THREE.UniformsUtils.clone(FXAA.uniforms), depthTest: false, depthWrite: false }));
    }
    setSize(w, h) { this.quad.material.uniforms.resolution.value.set(w, h); }
    render(renderer, writeBuffer, readBuffer) {
      this.quad.material.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
    dispose() { this.quad.dispose(); }
  }
  class ShaftsPass extends Pass {
    constructor(depth) {
      super();
      this.depth = depth;
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...SHAFTS, uniforms: THREE.UniformsUtils.clone(SHAFTS.uniforms), depthTest: false, depthWrite: false }));
      this.enabled = false;
    }
    render(renderer, writeBuffer, readBuffer) {
      const u = this.quad.material.uniforms;
      u.tDiffuse.value = readBuffer.texture;
      u.tDepth.value = this.depth;
      u.uAspect.value = readBuffer.width / Math.max(1, readBuffer.height);
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
    dispose() { this.quad.dispose(); }
  }

  class GradePass extends Pass {
    constructor() {
      super();
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...GRADE, uniforms: THREE.UniformsUtils.clone(GRADE.uniforms), depthTest: false, depthWrite: false }));
    }
    set gold(v) { this.quad.material.uniforms.uGold.value = v; this.enabled = v > 0.01; }
    render(renderer, writeBuffer, readBuffer) {
      this.quad.material.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
    dispose() { this.quad.dispose(); }
  }
  return { SceneAOPass, FXAAPass, GradePass, ShaftsPass };
}

export function createPipeline({ renderer, scene, camera, sky, mode: startMode = 'auto', coarse = false, onAutoDrop = null, onTier = null }) {
  const params = new URLSearchParams(location.search);
  let mode = MODES.includes(startMode) ? startMode : 'auto';
  let dropped = false;
  let fx = null;
  let FX = null, loading = null;
  const size = new THREE.Vector2();
  let night = 0;
  // Auto's step-up on phones. Under automated tests (navigator.webdriver) the probe does not run, so the phone
  // set-up stays at Fast as the budgets assume; ?probe=fast or ?probe=slow forces its answer either way.
  const forced = params.get('probe');
  let probe = { state: coarse && (forced || !navigator.webdriver) ? 'waiting' : 'off', ms: null, promoted: false, startedAt: 0 };

  const tierFor = () => {
    if (mode === 'fast' || mode === 'best' || mode === 'balanced') return mode;
    if (dropped) return 'fast';
    if (coarse) return probe.promoted ? 'balanced' : 'fast';
    return 'best';
  };
  let tier = tierFor();

  function load() {
    loading ??= import('./vendor/three-fx.js').then((m) => { FX = { ...m, ...makePasses(m) }; }).catch(() => { loading = null; });
    return loading;
  }
  // Balanced and Best fetch their passes at once, and the kernel waits for them (ready) before the first frame: a
  // frame drawn straight to the canvas while they load compiles every material in view a second time (sRGB and
  // tone-mapped for the screen, beside the passes' linear target), and three.js keeps both programs alive
  if (tier !== 'fast') load();

  function build() {
    renderer.getSize(size);
    const ratio = renderer.getPixelRatio();
    const composer = new FX.EffectComposer(renderer);
    composer.setPixelRatio(ratio);
    composer.setSize(size.x, size.y);
    const balanced = tier === 'balanced';
    const sceneAO = new FX.SceneAOPass(scene, camera, { scale: balanced ? 0.5 : 1 });
    const bloomRes = new THREE.Vector2(size.x, size.y).multiplyScalar(balanced ? 0.5 : 1);
    const bloom = shareBloomBlur(new FX.UnrealBloomPass(bloomRes, 0.5, 0.5, 1));
    const output = new FX.OutputPass();
    const aa = balanced ? new FX.FXAAPass() : new FX.SMAAPass(size.x * ratio, size.y * ratio);
    const grade = balanced ? null : new FX.GradePass();
    const shafts = balanced ? null : new FX.ShaftsPass(sceneAO.target.depthTexture);
    if (shafts) shafts.name = 'shafts';
    sceneAO.name = 'ao';
    bloom.name = 'bloom';
    output.name = 'output';
    aa.name = balanced ? 'fxaa' : 'smaa';
    if (grade) grade.name = 'grade';
    [sceneAO, shafts, bloom, output, grade, aa].filter(Boolean).forEach((pass) => composer.addPass(pass));
    composer.setSize(size.x, size.y);
    fx = { composer, sceneAO, bloom, output, aa, grade, shafts, tier };
    watchFrom = performance.now() + WARM_UP;
    ema = 16;
    slowSince = 0;
    applyNight();
    sky?.setHdrFog(true);
  }

  function dispose() {
    if (!fx) return;
    fx.composer.passes.forEach((p) => p.dispose?.());
    fx.composer.dispose();
    fx = null;
  }

  // Bloom only gathers on the lit windows, lamps and pools: by day nothing on the estate is brighter than the sky.
  function applyNight() {
    if (!fx) return;
    fx.bloom.enabled = night > 0.05;
    fx.bloom.strength = (fx.tier === 'balanced' ? 0.18 : 0.26) + 0.45 * night;
    fx.bloom.threshold = 2.1 - 1.0 * night;
    fx.bloom.radius = 0.5;
  }

  function apply() {
    const next = tierFor();
    if (next === tier && (next === 'fast' || (fx && fx.tier === next))) return;
    const from = tier;
    tier = next;
    if (tier === 'fast') { dispose(); sky?.setHdrFog(false); } else if (fx && fx.tier !== tier) dispose();
    // every material compiled for the old tier's output (the canvas on Fast, the passes' linear target above it) would
    // keep that program beside the new one for as long as it lives: let them go, so a phone that steps up to Balanced
    // holds Balanced's programs only. Disposing a material frees its programs; it compiles again on its next draw
    if (from !== tier) releasePrograms();
    sky?.setTier?.(tier);
    onTier?.(tier);
  }

  let drewToCanvas = false;
  function releasePrograms() {
    const seen = new Set();
    scene.traverse((o) => {
      const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      if (o.customDepthMaterial) list.push(o.customDepthMaterial);
      list.forEach((m) => { if (!seen.has(m)) { seen.add(m); m.dispose(); } });
    });
  }

  let last = 0, ema = 16, slowSince = 0, watchFrom = 0;
  function watch(now) {
    const dt = now - last;
    last = now;
    if (mode !== 'auto' || tier === 'fast' || !fx || now < watchFrom || dt <= 0 || dt > 1500) return;
    ema += (Math.min(dt, 250) - ema) * 0.05;
    if (ema <= SLOW_MS) { slowSince = 0; return; }
    if (!slowSince) slowSince = now;
    else if (now - slowSince > SLOW_FOR) {
      dropped = true;
      slowSince = 0;
      apply();
      onAutoDrop?.();
    }
  }

  // A short burst of frames, waited for with a one-pixel read so the time is the GPU's, not the vsync's.
  const pixel = new Uint8Array(4);
  function runProbe(now) {
    if (probe.state !== 'waiting') return;
    if (!probe.startedAt) { probe.startedAt = now; return; }
    if (now - probe.startedAt < PROBE_AFTER) return;
    probe.state = 'done';
    const gl = renderer.getContext();
    const halfFloat = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
    if (forced === 'fast' || forced === 'slow') probe.ms = forced === 'fast' ? 5 : 25;
    else {
      renderer.render(scene, camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const t0 = performance.now();
      for (let i = 0; i < PROBE_FRAMES; i++) renderer.render(scene, camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      probe.ms = (performance.now() - t0) / PROBE_FRAMES;
    }
    probe.promoted = halfFloat && probe.ms < PROBE_MS;
    if (probe.promoted && mode === 'auto') apply();
  }

  // sun shafts only while the sun is low, above the horizon and on screen (or just off it)
  const sunNdc = new THREE.Vector3();
  function aimShafts(pass) {
    const st = sky?.state, light = sky?.sun;
    if (!st || !light || st.el < -0.5 || st.el > 16) { pass.enabled = false; return; }
    sunNdc.copy(light.position).sub(light.target.position).normalize().multiplyScalar(1000).add(camera.position).project(camera);
    const ahead = sunNdc.z < 1;
    const u = pass.quad.material.uniforms;
    u.uSun.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
    const onScreen = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y));
    const k = (ahead ? 1 - Math.min(1, Math.max(0, (onScreen - 1.1) / 0.6)) : 0) * Math.min(1, (16 - st.el) / 8) * Math.min(1, (st.el + 0.5) / 1.5);
    u.uColour.value.copy(light.color).multiplyScalar(light.intensity * 0.12);
    u.uStrength.value = k;
    pass.enabled = k > 0.01;
  }

  // ---------- a lost WebGL context ----------
  let lost = false;
  const canvas = renderer.domElement;
  // Best's and Balanced's passes go while the context is lost, when deleting their GPU objects is a silent no-op; the
  // next frame after it comes back builds them again. Disposed after the restore, three.js's old dispose listeners
  // delete the old context's objects on the new one (WebKit logs an INVALID_OPERATION for each)
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; dispose(); }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    sky?.refreshShadow?.();
    restoredAt = performance.now();
  }, false);
  let restoredAt = 0;

  // ---------- GPU timing and the numbers overlay (?debug=perf) ----------
  const perf = params.get('debug') === 'perf' ? createPerf(renderer, () => ({ mode, tier, probe, dropped })) : null;

  // ---------- photo ----------
  let photoJob = null;
  function photo(opts = {}) {
    photoJob?.cancel();
    return Promise.all([load(), import('./realism/photo.js')]).then(([, mod]) => {
      if (!FX) throw new Error('the graphics passes did not load');
      return new Promise((resolve, reject) => {
        photoJob = mod.createPhotoJob({ renderer, scene, camera, sky, FX, makeAO: (s, c) => new FX.SceneAOPass(s, c), ...opts });
        photoJob.promise.then(resolve, reject).finally(() => { photoJob = null; sky?.setHdrFog(!!fx); });
      });
    });
  }

  function render() {
    const now = performance.now();
    if (lost) return;
    perf?.begin();
    watch(now);
    runProbe(now);
    if (photoJob) photoJob.step();
    if (tier !== 'fast') {
      // passes built after frames went straight to the canvas (a step up from Fast): those canvas programs go too
      if (!fx && FX) { build(); if (drewToCanvas) { releasePrograms(); drewToCanvas = false; } }
      if (fx) {
        const d = camera.position.distanceTo(camera.userData.focus || camera.position);
        fx.sceneAO.setRadius(Math.min(6, Math.max(0.35, d * 0.012)));
        if (fx.grade) { const el = sky?.state?.el ?? 30; fx.grade.gold = Math.min(1, Math.max(0, (14 - el) / 10)) * Math.min(1, Math.max(0, (el + 5) / 5)); }
        if (fx.shafts) aimShafts(fx.shafts);
        fx.composer.render();
        perf?.end(now);
        return;
      }
      load();
    }
    renderer.render(scene, camera);
    drewToCanvas = true;
    perf?.end(now);
  }

  onTier?.(tier);
  // compile what is in view now, in parallel where the browser can, so the first flight does not stall. Balanced and
  // Best draw the scene into their passes' linear target, not the canvas: compiled against the canvas, every material
  // would get a second, never-used program (sRGB and tone-mapped) that three.js keeps alive
  const warm = tier === 'fast' ? null : new THREE.WebGLRenderTarget(1, 1);
  const was = renderer.getRenderTarget();
  renderer.setRenderTarget(warm);
  try { renderer.compileAsync?.(scene, camera)?.catch?.(() => {}); } catch { /* older three */ }
  renderer.setRenderTarget(was);
  warm?.dispose();

  return {
    get mode() { return mode; },
    get tier() { return tier; },
    get fx() { return fx; },
    get renderer() { return renderer; },
    MODES,
    setMode(m) {
      if (!MODES.includes(m)) return;
      mode = m;
      if (m !== 'auto') dropped = false;
      apply();
    },
    setNight(n) { night = n; applyNight(); },
    // Best's passes are still loading, a photo is being taken, or the context has just come back: keep drawing
    pending: () => (tier !== 'fast' && !fx) || !!photoJob || performance.now() - restoredAt < 1500,
    setSize(w, h) { fx?.composer.setSize(w, h); },
    render,
    photo,
    get lost() { return lost; },
    ready: () => (tier === 'fast' ? Promise.resolve() : load()),
    info: () => ({ mode, tier, dropped, probe: { ...probe }, ema: Math.round(ema * 10) / 10, passes: fx ? fx.composer.passes.filter((p) => p.enabled).map((p) => p.name) : [], gpuMs: perf?.gpuMs ?? null }),
  };
}

// The ?debug=perf overlay: frame interval median and 90th percentile, the page's own work, GPU time where the
// browser has EXT_disjoint_timer_query_webgl2, triangles, draw calls, programs and textures, and the level.
function createPerf(renderer, state) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const el = document.createElement('div');
  el.className = 'vx-perf';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute', left: '8px', top: '8px', zIndex: 30, padding: '6px 8px', borderRadius: '6px', pointerEvents: 'none',
    font: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', color: '#e8f0e0', background: 'rgba(10,14,12,0.72)', whiteSpace: 'pre',
  });
  (renderer.domElement.parentElement || document.body).appendChild(el);
  const intervals = [], work = [], gpu = [];
  let lastAt = 0, query = null, pending = [], shownAt = 0;
  const q = (list, k) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * k))] || 0; };
  const self = {
    gpuMs: null,
    begin() {
      if (ext && !query) { query = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, query); }
    },
    end(startedAt) {
      const now = performance.now();
      if (query) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(query); query = null; }
      pending = pending.filter((qq) => {
        if (!gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) return true;
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(qq);
        return false;
      });
      if (lastAt && now - lastAt < 1000) intervals.push(now - lastAt);
      lastAt = now;
      work.push(now - startedAt);
      [intervals, work, gpu].forEach((l) => { if (l.length > 240) l.splice(0, l.length - 240); });
      self.gpuMs = gpu.length ? q(gpu, 0.5) : null;
      if (now - shownAt < 500) return;
      shownAt = now;
      const s = state(), i = renderer.info;
      el.textContent = [
        `${s.mode} -> ${s.tier}${s.dropped ? ' (dropped)' : ''}${s.probe.ms != null ? `  probe ${s.probe.ms.toFixed(1)} ms` : ''}`,
        `frame ${q(intervals, 0.5).toFixed(1)} ms  p90 ${q(intervals, 0.9).toFixed(1)}`,
        `render call ${q(work, 0.5).toFixed(1)} ms  gpu ${self.gpuMs != null ? `${self.gpuMs.toFixed(1)} ms` : 'n/a'}`,
        `${(i.render.triangles / 1000).toFixed(0)}K tris  ${i.render.calls} calls`,
        `${i.programs?.length ?? 0} programs  ${i.memory.textures} textures  ${i.memory.geometries} geometries`,
      ].join('\n');
    },
  };
  return self;
}
