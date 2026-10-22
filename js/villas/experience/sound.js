// Ambient sound, made live with Web Audio (no audio files): a breeze in the leaves by day, birdsong at dusk,
// crickets after dark, a scops owl's single note now and then, and water lapping by the pools (louder the nearer the
// camera is). Mixed by the light (api.light) and the camera's distance to the pools. What you might hear in these
// hills at the end of May; typical, not recorded at La Conca. Loaded on the first tap of the speaker; fades out when
// the page is hidden or the explorer scrolls off screen.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createSound(ctx, audio) {
  const { api, root } = ctx;
  const ac = audio || new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain();
  master.gain.value = 0;
  // a gentle compressor keeps the layers from stacking up into anything loud
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 3;
  master.connect(comp).connect(ac.destination);

  // two seconds of noise, looped: the raw stuff of wind and water
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.985 * b0 + 0.015 * w; d[i] = w * 0.6 + b0 * 3; }
  const noiseSource = () => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 2); return s; };
  const bus = (gain = 0) => { const g = ac.createGain(); g.gain.value = gain; g.connect(master); return g; };
  const pan = (p) => { if (!ac.createStereoPanner) return null; const n = ac.createStereoPanner(); n.pan.value = p; return n; };

  // ---------- breeze: low rush plus a leafy hiss that swells with the gusts ----------
  const breeze = bus();
  const rush = noiseSource(), rushF = ac.createBiquadFilter();
  rushF.type = 'lowpass'; rushF.frequency.value = 520; rushF.Q.value = 0.4;
  const leaves = noiseSource(), leavesF = ac.createBiquadFilter(), leavesG = ac.createGain();
  leavesF.type = 'bandpass'; leavesF.frequency.value = 3200; leavesF.Q.value = 0.7; leavesG.gain.value = 0.25;
  rush.connect(rushF).connect(breeze);
  leaves.connect(leavesF).connect(leavesG).connect(breeze);
  const gust = ac.createGain();
  gust.gain.value = 0.6;
  breeze.disconnect();
  breeze.connect(gust).connect(master);

  // ---------- water lapping by the pools ----------
  const water = bus();
  const lap = noiseSource(), lapF = ac.createBiquadFilter(), lapG = ac.createGain();
  lapF.type = 'lowpass'; lapF.frequency.value = 380; lapG.gain.value = 0;
  lap.connect(lapF).connect(lapG).connect(water);

  // ---------- birds, crickets and the owl: little scheduled notes ----------
  const birds = bus(), crickets = bus(), owl = bus();

  function chirp(t, f0, f1, len, gain, out, type = 'sine') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, len / 3));
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  // a phrase from a songbird somewhere in the trees: a run of quick whistles
  function birdPhrase(t) {
    const p = pan(Math.random() * 1.6 - 0.8);
    const out = p ? (p.connect(birds), p) : birds;
    const base = 2200 + Math.random() * 2600, notes = 2 + Math.floor(Math.random() * 6);
    let at = t;
    for (let i = 0; i < notes; i++) {
      const up = Math.random() > 0.5;
      const len = 0.05 + Math.random() * 0.12;
      chirp(at, base * (up ? 0.85 : 1.15), base * (up ? 1.2 : 0.8), len, 0.05 + Math.random() * 0.05, out);
      at += len + 0.03 + Math.random() * 0.09;
    }
  }

  // field crickets: a 4.5 kHz tone in pulses of three, a few voices out of step
  const cricketVoices = [-0.6, 0.15, 0.7].map((p) => ({ pan: p, f: 4300 + Math.random() * 400, rate: 0.55 + Math.random() * 0.5, next: 0 }));
  function cricketChirp(v, t) {
    const node = pan(v.pan);
    const out = node ? (node.connect(crickets), node) : crickets;
    for (let i = 0; i < 3; i++) chirp(t + i * 0.034, v.f, v.f * 0.99, 0.022, 0.035, out, 'sine');
  }

  // the scops owl: one soft "tyoo", the same note every two to three seconds
  const owlSpot = { pan: -0.35 + Math.random() * 0.2, next: 0 };
  function hoot(t) {
    const node = pan(owlSpot.pan);
    const out = node ? (node.connect(owl), node) : owl;
    chirp(t, 1260, 1180, 0.2, 0.09, out, 'sine');
    chirp(t, 2520, 2380, 0.16, 0.012, out, 'sine');
  }

  // ---------- the weekend mode's one-shots (weekend-mode-spec.md, section 5): no music, no beat ----------
  // crackle: sparse pops of band-passed noise over a low rumble, near an oven; clink: two glassy partials now and
  // then; splash: noise through a falling band-pass, now and then near a pool; gravel: brown noise swelling as a car
  // goes by
  const cueBus = bus(0.7);
  const cueSet = new Set(), cueNext = {};
  function burst(t, len, gain, type, f0, f1 = f0, q = 1) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, len / 4));
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    src.connect(f).connect(g).connect(cueBus);
    src.start(t, Math.random() * 1.5, len + 0.05);
  }
  const CUES = {
    crackle: { every: [0.15, 0.9], play: (t) => { burst(t, 0.03 + Math.random() * 0.05, 0.5 + Math.random() * 0.5, 'bandpass', 1800 + Math.random() * 2400, undefined, 2); if (Math.random() < 0.2) burst(t, 0.9, 0.12, 'lowpass', 160); } },
    clink: { every: [8, 15], play: (t) => { chirp(t, 2600, 2590, 0.15, 0.06, cueBus); chirp(t + 0.004, 4100, 4090, 0.15, 0.04, cueBus); } },
    splash: { every: [15, 30], play: (t) => burst(t, 0.7, 0.35, 'bandpass', 1800, 400, 0.8) },
    gravel: { every: [1.5, 3], play: (t) => burst(t, 1.2 + Math.random() * 0.6, 0.3, 'lowpass', 320, 260, 0.5) },
  };
  function scheduleCues(t, ahead) {
    cueSet.forEach((name) => {
      const c = CUES[name];
      if (!c) return;
      if (!(cueNext[name] > t - 1)) cueNext[name] = t + Math.random() * c.every[0];
      if (cueNext[name] < ahead) { c.play(Math.max(cueNext[name], t)); cueNext[name] = Math.max(cueNext[name], t) + c.every[0] + Math.random() * (c.every[1] - c.every[0]); }
    });
  }

  // ---------- the mix: how much of each, from the light and where the camera is ----------
  const mix = { breeze: 0, birds: 0, crickets: 0, owl: 0, water: 0 };
  function setMix() {
    const l = api.light.get();
    const el = l.el ?? 10, night = l.night ?? 0;
    const morning = (l.minutes ?? 1200) < 12 * 60;
    mix.breeze = 0.16 + 0.22 * smooth(-4, 12, el);
    mix.birds = (morning ? 0.9 : 1) * smooth(-7, -1, el) * (1 - smooth(10, 26, el)) + 0.18 * smooth(10, 30, el);
    mix.crickets = smooth(0.25, 0.85, night) * 0.9 + 0.12 * smooth(-3, 3, -el) * (1 - night);
    mix.owl = smooth(0.6, 0.95, night);
    const now = ac.currentTime;
    breeze.gain.setTargetAtTime(mix.breeze, now, 0.8);
    birds.gain.setTargetAtTime(Math.min(1, mix.birds), now, 0.8);
    crickets.gain.setTargetAtTime(mix.crickets, now, 0.8);
    owl.gain.setTargetAtTime(mix.owl, now, 0.8);
  }
  function setWater() {
    const cam = api.camera.position;
    let near = Infinity;
    api.model.pools.forEach((p) => { near = Math.min(near, Math.hypot(cam.x - p.c[0], cam.z - p.c[1], (cam.y - p.level) * 0.6)); });
    mix.water = 1 - smooth(6, 45, near);
    water.gain.setTargetAtTime(mix.water * 0.55, ac.currentTime, 0.4);
  }

  // ---------- the scheduler: a few notes ahead, every 120 ms, frames or no frames ----------
  let timer = 0, nextBird = 0, nextGust = 0, nextLap = 0;
  function schedule() {
    const t = ac.currentTime, ahead = t + 0.3;
    if (t >= nextGust) {
      gust.gain.setTargetAtTime(0.35 + Math.random() * 0.9, t, 0.9 + Math.random() * 1.5);
      leavesG.gain.setTargetAtTime(0.12 + Math.random() * 0.35, t, 0.7);
      nextGust = t + 1.2 + Math.random() * 2.5;
    }
    if (mix.water > 0.02 && t >= nextLap) {
      lapG.gain.cancelScheduledValues(t);
      lapG.gain.setValueAtTime(lapG.gain.value, t);
      lapG.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, t + 0.12 + Math.random() * 0.1);
      lapG.gain.linearRampToValueAtTime(0.05, t + 0.5 + Math.random() * 0.4);
      lapF.frequency.setTargetAtTime(260 + Math.random() * 260, t, 0.2);
      nextLap = t + 0.45 + Math.random() * 0.7;
    }
    if (mix.birds > 0.03 && nextBird < ahead) { birdPhrase(Math.max(nextBird, t)); nextBird = Math.max(nextBird, t) + (1.2 + Math.random() * 3) / Math.max(0.25, mix.birds); }
    if (mix.crickets > 0.03) cricketVoices.forEach((v) => {
      if (v.next < t) v.next = t + Math.random() * 0.4;
      while (v.next < ahead) { cricketChirp(v, v.next); v.next += v.rate * (0.85 + Math.random() * 0.3); }
    });
    scheduleCues(t, ahead);
    if (mix.owl > 0.05) {
      if (owlSpot.next < t) owlSpot.next = t + 1 + Math.random() * 2;
      if (owlSpot.next < ahead) { hoot(owlSpot.next); owlSpot.next += 2.4 + Math.random() * 0.6; }
    }
  }

  // ---------- on, off, and out of the way when nobody is looking ----------
  let on = false, visible = true;
  const level = () => (on && visible && !document.hidden ? 0.8 : 0);
  function apply() {
    const target = level();
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.linearRampToValueAtTime(target, ac.currentTime + (target ? 1.4 : 0.6));
    clearInterval(timer);
    if (target) {
      if (ac.state === 'suspended') ac.resume();
      timer = setInterval(schedule, 120);
    } else setTimeout(() => { if (!level() && ac.state === 'running') ac.suspend(); }, 700);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; apply(); }).observe(root);
  document.addEventListener('visibilitychange', apply);
  api.light.on(() => { if (on) setMix(); });
  api.loop.onFrame(({ moved }) => { if (on && moved) setWater(); }, { phase: 'post' });

  return {
    context: ac,
    get on() { return on; },
    get mix() { return { ...mix, master: master.gain.value, state: ac.state }; },
    // the weekend mode's cues for the moment on screen (crackle, clink, splash, gravel); [] for none
    cues(list = []) { cueSet.clear(); list.forEach((n) => { if (CUES[n]) cueSet.add(n); }); },
    get cueNames() { return [...cueSet]; },
    set(value) {
      on = !!value;
      if (on) { setMix(); setWater(); }
      apply();
    },
  };
}
