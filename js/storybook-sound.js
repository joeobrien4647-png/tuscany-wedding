(function (root) {
  'use strict';
  // Paper sounds synthesised with Web Audio (ported from the spike) and the film's music streamed from an audio element.
  const KEY = 'sj-book-sound', MUSIC = 'audio/storybook-music.mp3', MUSIC_VOLUME = .32;

  function createSound(win) {
    const read = () => { try { return win.localStorage.getItem(KEY); } catch (e) { return null; } };
    const write = v => { try { win.localStorage.setItem(KEY, v); } catch (e) { /* the choice just is not remembered */ } };
    let on = read() !== 'off', started = false, stopped = false;
    let ac = null, master = null, music = null, musicGain = null;

    function context() {
      const AC = win.AudioContext || win.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = on ? 1 : 0;
        master.connect(ac.destination);
        wake();
      } catch (e) { ac = null; master = null; }
    }
    // Phones suspend or interrupt the audio when the guest switches apps; it has to be resumed by hand.
    function wake() {
      if (!ac || ac.state === 'running' || !ac.resume) return;
      try { const resumed = ac.resume(); if (resumed && resumed.catch) resumed.catch(() => {}); } catch (e) { /* stays quiet */ }
    }
    function playMusic() {
      if (!win.Audio) return;
      if (!music) {
        music = new win.Audio();
        music.preload = 'none';
        music.loop = true;
        music.src = MUSIC;
        // Fade in through Web Audio where we can: iPhones ignore the element's own volume.
        if (ac && ac.createMediaElementSource) {
          try {
            const source = ac.createMediaElementSource(music);
            musicGain = ac.createGain();
            musicGain.gain.setValueAtTime(0, ac.currentTime);
            musicGain.gain.linearRampToValueAtTime(MUSIC_VOLUME, ac.currentTime + 3);
            source.connect(musicGain);
            musicGain.connect(ac.destination);
          } catch (e) { musicGain = null; }
        }
        if (!musicGain) music.volume = MUSIC_VOLUME;
      }
      const playing = music.play();
      if (playing && playing.catch) playing.catch(() => {});
    }
    function pauseMusic() { if (music) music.pause(); }

    const noise = dur => { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = ac.createBufferSource(); n.buffer = b; return n; };
    const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); };
    const quiet = () => !ac || !on;

    return {
      // Called from the cover tap, the moment browsers allow sound.
      start() {
        if (started) return;
        started = true;
        // Ambient audio respects the iPhone silent switch and mixes with anything already playing.
        try { if (win.navigator && win.navigator.audioSession) win.navigator.audioSession.type = 'ambient'; } catch (e) { /* older Safari */ }
        context();
        if (on) playMusic();
        const doc = win.document;
        if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', () => { if (doc.hidden) pauseMusic(); else if (on && !stopped) { wake(); playMusic(); } });
      },
      stop() { stopped = true; pauseMusic(); },
      toggle() {
        on = !on;
        write(on ? 'on' : 'off');
        if (master) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, .1);
        if (on && started && !stopped) { wake(); playMusic(); } else pauseMusic();
        return on;
      },
      isOn() { return on; },
      pop(k = 0) { if (quiet()) return; const t = ac.currentTime, n = noise(.12), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'bandpass'; f.frequency.value = 1400 + (k % 5) * 260; f.Q.value = 1.4; env(g, t, .004, .22, .09); n.connect(f); f.connect(g); g.connect(master); n.start(t); const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + .1); env(og, t, .003, .18, .1); o.connect(og); og.connect(master); o.start(t); o.stop(t + .15); },
      whoosh() { if (quiet()) return; const t = ac.currentTime, n = noise(.8), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .35); f.frequency.exponentialRampToValueAtTime(400, t + .75); env(g, t, .25, .16, .5); n.connect(f); f.connect(g); g.connect(master); n.start(t); },
      chime() { if (quiet()) return; [1318.5, 1568, 1975.5, 2637].forEach((fr, i) => { const t = ac.currentTime + .1 + i * .11, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = fr; env(g, t, .01, .09, 1.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.6); }); },
      boom() { if (quiet()) return; const t = ac.currentTime, n = noise(.5), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 500; env(g, t, .005, .3, .4); n.connect(f); f.connect(g); g.connect(master); n.start(t); }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createSound };
  else root.StorybookSound = { createSound };
})(typeof window !== 'undefined' ? window : globalThis);
