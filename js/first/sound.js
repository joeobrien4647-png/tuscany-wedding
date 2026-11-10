// The invitation's sound: the film's music through Web Audio so it can fade, plus a few synthesised touches.
// Ported from the first-minute prototype. Safe before any tap: until the browser allows audio, every call is silent.
(function (root) {
  'use strict';
  const MUSIC_SRC = 'audio/storybook-music.mp3';
  const KEY = 'sj-first-sound';
  const hasDom = typeof document !== 'undefined';
  const read = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* not remembered on this phone */ } };

  let el = null, ac = null, master = null, mg = null, wired = false, wanted = false, noiseBuf = null;
  let isOn = read(KEY) !== 'off';

  function media() {
    if (!el && hasDom) { el = new Audio(); el.preload = 'auto'; el.src = MUSIC_SRC; }
    return el;
  }
  // Browsers refuse audio until a tap; where the browser can say so, wait for one instead of making a context it will block.
  const tapped = () => !(root.navigator && root.navigator.userActivation && !root.navigator.userActivation.hasBeenActive);

  function ctx() {
    if (ac) return ac;
    if (!tapped()) return null;
    try { if (root.navigator.audioSession) root.navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); master = ac.createGain(); master.gain.value = isOn ? 1 : 0; master.connect(ac.destination); } catch (e) { ac = null; }
    return ac;
  }
  function unlock() { const c = ctx(); if (c && c.state !== 'running' && c.resume) c.resume().catch(() => {}); }
  function play(m) { try { const p = m.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* no media playback */ } }
  function music() {
    const m = media();
    if (!m) return;
    const c = ctx();
    wanted = true;
    if (c && !wired) {
      try { const src = c.createMediaElementSource(m); mg = c.createGain(); mg.gain.value = 0.0001; src.connect(mg); mg.connect(master); wired = true; } catch (e) { mg = null; }
    }
    try { m.currentTime = 0; } catch (e) { /* not loaded yet */ }
    if (!mg) { m.muted = !isOn; try { m.volume = 0.5; } catch (e) { /* iOS keeps its own volume */ } }
    play(m);
    if (mg) { const t = c.currentTime; mg.gain.cancelScheduledValues(t); mg.gain.setValueAtTime(0.0001, t); mg.gain.exponentialRampToValueAtTime(0.42, t + 2.6); }
  }
  function quiet() {
    wanted = false;
    if (mg && ac) mg.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
    root.setTimeout(() => { if (!wanted && el) el.pause(); }, 1400);
  }
  function tone(freq, t0, dur, vol, type) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, freq, q, vol, type) {
    if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.4); s.stop(t0 + dur + 0.05);
  }
  function crack() { if (!ctx()) return; const t = ac.currentTime + 0.01; noise(t, 0.06, 2800, 1.4, 0.55); noise(t + 0.025, 0.14, 950, 0.9, 0.4); tone(96, t, 0.3, 0.3); noise(t + 0.1, 1.3, 6000, 0.5, 0.045, 'highpass'); }
  function chime() { if (!ctx()) return; const t = ac.currentTime + 0.01; [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.075, 1.5, 0.075)); }
  function pop(v) { if (!ctx()) return; const k = v || 1, t = ac.currentTime + 0.005; tone(660, t, 0.14, 0.06 * k, 'triangle'); noise(t, 0.05, 3200, 1, 0.07 * k); }
  function boom() { if (!ac) return; const t = ac.currentTime + 0.005; noise(t, 0.6, 260, 0.7, 0.2, 'lowpass'); noise(t + 0.06, 1.1, 4200, 0.5, 0.035, 'highpass'); }
  function toggle() {
    isOn = !isOn; write(KEY, isOn ? 'on' : 'off');
    if (master && ac) master.gain.setTargetAtTime(isOn ? 1 : 0, ac.currentTime, 0.06);
    if (!mg && el) el.muted = !isOn;
    return isOn;
  }
  const on = () => isOn;

  if (hasDom) {
    media();
    document.addEventListener('visibilitychange', () => {
      if (!el) return;
      if (document.hidden) { if (wanted) el.pause(); return; }
      if (wanted) { unlock(); play(el); }
    });
  }

  const api = { sound: { unlock, music, quiet, crack, chime, pop, boom, toggle, on } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
