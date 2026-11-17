/* ==========================================================================
   audio.js — a procedural, original samurai soundtrack + sound effects.
   Everything is synthesised live with the Web Audio API: no audio files,
   no licensing. Built on the Japanese "in" scale (D Eb G A Bb).

   Instruments
     koto       plucked string (Karplus-Strong, pre-rendered per note)
     shakuhachi breathy bamboo flute with "meri" pitch slides + vibrato
     taiko/ka   big drum + rim click
     drone      low detuned pad, wind = filtered noise
   The music follows the section you are in (setMood) and every scene can
   fire sound effects through Sound.sfx.*  Sound is off until the visitor
   opts in (browsers require a click before audio can start anyway).
   ========================================================================== */
(function () {
  const R = Math.random;
  const BPM = 74, EIGHTH = 60 / BPM / 2;
  const SCALE = [0, 1, 5, 7, 8];          // in-sen / miyako-bushi
  const ROOT = 50;                          // D3
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const deg = d => { const n = SCALE.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return ROOT + SCALE[i] + 12 * o; };

  let ctx = null, master, music, sfxBus, wet, noiseBuf, droneG, windG;
  let on = false, timer = null, nextT = 0, stepIdx = 0, phraseEnd = 0;
  let mood = 'hero';
  const ksCache = {};

  const MOODS = {
    hero:  { drone: .55, wind: .05, shaku: .9,  koto: .35, drums: 'hero' },
    calm:  { drone: .5,  wind: .035, shaku: .85, koto: .22, drums: null },
    drums: { drone: .3,  wind: .03, shaku: .2,  koto: .5,  drums: 'drums', ost: [0, 4, 3, 4, 5, 4, 3, 1] },
    march: { drone: .35, wind: .03, shaku: .3,  koto: .55, drums: 'march', ost: [0, 2, 3, 2, 4, 3, 2, 1] },
    walk:  { drone: .45, wind: .05, shaku: .5,  koto: .5,  drums: 'walk' },
    duel:  { drone: .18, wind: .14, shaku: 0,   koto: 0,   drums: 'heart' }
  };
  const PATTERNS = {               // one bar of eighths: D = taiko, d = soft taiko, k = rim
    hero:  ['D.......', '......k.'],
    drums: ['D.kD.Dk.', 'D.kD.DDk'],
    march: ['D.d.Dkd.', 'D.d.DkDk'],
    walk:  ['d...k...', 'd...k.k.'],
    heart: ['dd......', 'dd......']
  };

  /* ---------- graph ---------- */
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ctx.destination);

    const conv = ctx.createConvolver(); conv.buffer = impulse(3.4, 2.4);
    wet = ctx.createGain(); wet.gain.value = .5; wet.connect(conv); conv.connect(master);

    music = ctx.createGain(); music.gain.value = .6; music.connect(master);
    send(music, .55);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .95; sfxBus.connect(master);
    send(sfxBus, .3);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    startDrone(); startWind();
  }
  function send(node, amt) { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(wet); }
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  }
  function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }

  /* ---------- instruments ---------- */
  function ksBuffer(m) {
    if (ksCache[m]) return ksCache[m];
    const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * 2.6);
    const b = ctx.createBuffer(1, len, sr), out = b.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = R() * 2 - 1;
    const damp = .997 - Math.max(0, m - 60) * .0005;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nx = (idx + 1) % N, v = ring[idx];
      out[i] = v; ring[idx] = damp * .5 * (v + ring[nx]); idx = nx;
    }
    return (ksCache[m] = b);
  }
  function koto(m, t, vel = .5, pan = 0, dest = music) {
    const s = ctx.createBufferSource(); s.buffer = ksBuffer(m);
    const g = ctx.createGain(); g.gain.value = vel * .55;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    chain(s, filt('lowpass', 4200, .7), g, p, dest);
    s.start(t); s.stop(t + 2.6);
  }
  function shaku(m, t, dur, vel = .3) {
    const f = mtof(m), end = t + dur + .5;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sine'; o2.type = 'triangle';
    [o, o2].forEach(x => { x.frequency.setValueAtTime(f * .94, t); x.frequency.exponentialRampToValueAtTime(f, t + .24); });
    const vib = ctx.createOscillator(); vib.frequency.value = 5.1;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .013, t + dur * .85);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = .22;
    o.connect(g); o2.connect(g2); g2.connect(g);
    chain(g, filt('lowpass', 2300, .6), music);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + .2);
    g.gain.setValueAtTime(vel, t + dur * .55);
    g.gain.linearRampToValueAtTime(vel * 1.18, t + dur * .78);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .4);
    const n = noise(), ng = ctx.createGain();       // breath
    chain(n, filt('bandpass', f * 2.1, 2.2), ng, music);
    ng.gain.setValueAtTime(.0001, t);
    ng.gain.exponentialRampToValueAtTime(vel * .55, t + .05);
    ng.gain.exponentialRampToValueAtTime(vel * .1, t + .32);
    ng.gain.exponentialRampToValueAtTime(.0001, t + dur + .3);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(end); });
    n.start(t, R() * 1.5); n.stop(end);
  }
  function taiko(t, vel = .8, big = false, dest = music) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(big ? 115 : 150, t);
    o.frequency.exponentialRampToValueAtTime(big ? 40 : 58, t + .28);
    env(g, t, .004, vel, big ? 1.5 : .7);
    chain(o, g, dest); o.start(t); o.stop(t + 1.6);
    const n = noise(), ng = ctx.createGain();
    env(ng, t, .002, vel * .45, .14);
    chain(n, filt('lowpass', big ? 900 : 1500), ng, dest); n.start(t, R()); n.stop(t + .3);
  }
  function ka(t, vel = .25, dest = music) {
    const n = noise(), g = ctx.createGain();
    env(g, t, .001, vel, .05);
    chain(n, filt('bandpass', 2700, 6), g, dest); n.start(t, R()); n.stop(t + .1);
  }
  function startDrone() {
    droneG = ctx.createGain(); droneG.gain.value = 0;
    const lp = filt('lowpass', 520, .6);
    [ROOT - 12, ROOT - 5, ROOT].forEach((m, i) => [-5, 5].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      const g = ctx.createGain(); g.gain.value = .045 / (i + 1);
      chain(o, g, lp); o.start();
    }));
    const lfo = ctx.createOscillator(); lfo.frequency.value = .05;
    const lg = ctx.createGain(); lg.gain.value = 240; chain(lfo, lg, lp.frequency); lfo.start();
    chain(lp, droneG, music);
  }
  function startWind() {
    const n = noise(), bp = filt('bandpass', 520, .7);
    windG = ctx.createGain(); windG.gain.value = 0;
    const l1 = ctx.createOscillator(); l1.frequency.value = .07;
    const g1 = ctx.createGain(); g1.gain.value = 320; chain(l1, g1, bp.frequency);
    chain(n, bp, windG, master);
    n.start(); l1.start();
  }

  /* ---------- generative sequencer ---------- */
  function phrase(t, M) {
    let d = 7 + Math.floor(R() * 5), time = t;
    const len = 3 + Math.floor(R() * 3);
    for (let i = 0; i < len; i++) {
      const beats = [1, 1.5, 2, 2, 3][Math.floor(R() * 5)];
      const dur = beats * EIGHTH * 2;
      shaku(deg(d), time, dur * .92, .26 * M.shaku);
      time += dur;
      d += [-2, -1, -1, 1, 1, 2][Math.floor(R() * 6)];
      d = Math.max(5, Math.min(13, d));
      if (i === len - 2) d = R() < .5 ? 5 : 8;            // resolve to tonic or fifth
    }
    return time;
  }
  function step(t, s) {
    const M = MOODS[mood], pos = s % 8, bar = Math.floor(s / 8);
    if (M.drums) {
      const pat = PATTERNS[M.drums][bar % 2];
      const c = pat[pos];
      if (c === 'D') taiko(t, .7, pos === 0 && M.drums !== 'march');
      else if (c === 'd') { taiko(t, .32); if (M.drums === 'heart') taiko(t + .22, .22); }
      else if (c === 'k') ka(t);
    }
    if (M.koto > 0) {
      if (M.ost) koto(deg(5 + M.ost[pos]), t, .32 * M.koto * 2, (pos % 2 ? .3 : -.3));
      else if (R() < M.koto * .55) koto(deg(5 + [0, 2, 3, 4, 5, 7][Math.floor(R() * 6)]), t, .3 + R() * .2, (R() - .5) * .8);
    }
    if (pos === 0 && M.shaku > 0 && t > phraseEnd && R() < M.shaku * .6) phraseEnd = phrase(t + EIGHTH, M) + EIGHTH * 4;
  }
  function tick() {
    if (!ctx || !on) return;
    const ahead = ctx.currentTime + .3;
    while (nextT < ahead) { step(nextT, stepIdx); nextT += EIGHTH; stepIdx++; }
  }
  function applyMood() {
    if (!ctx) return;
    const M = MOODS[mood], t = ctx.currentTime;
    droneG.gain.setTargetAtTime(M.drone * .9, t, 1.2);
    windG.gain.setTargetAtTime(M.wind, t, 1.2);
  }

  /* ---------- sound effects ---------- */
  const now = () => ctx.currentTime + .01;
  function ring(t, vel, len = 1.6) {
    [2093, 3322, 4980, 7040, 9390].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * (1 + R() * .005);
      env(g, t, .003, vel / (i + 1.4), len - i * .2);
      chain(o, g, sfxBus); o.start(t); o.stop(t + len + .1);
    });
  }
  function whoosh(t, dur, vel, hi = 2600) {
    const n = noise(), bp = filt('bandpass', 300, 1.3), g = ctx.createGain();
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(hi, t + dur * .5);
    bp.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * .45);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    chain(n, bp, g, sfxBus); n.start(t, R()); n.stop(t + dur + .05);
  }
  const SFX = {
    unsheathe(vel = .4) {
      const t = now(), n = noise(), bp = filt('bandpass', 1800, 9), g = ctx.createGain();
      bp.frequency.setValueAtTime(1600, t); bp.frequency.exponentialRampToValueAtTime(7200, t + .36);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .05);
      g.gain.exponentialRampToValueAtTime(vel * .25, t + .34); g.gain.exponentialRampToValueAtTime(.0001, t + .42);
      chain(n, bp, g, sfxBus); n.start(t, R()); n.stop(t + .5);
      ring(t + .34, vel * .9);
    },
    slash(vel = .45) { const t = now(); whoosh(t, .24, vel, 4400); ring(t + .07, vel * .2, .8); },
    whoosh(vel = .3) { whoosh(now(), .32, vel); },
    thunk(vel = .5) {
      const t = now(), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(70, t + .12);
      env(g, t, .002, vel, .18); chain(o, g, sfxBus); o.start(t); o.stop(t + .25);
      ka(t, vel * .8, sfxBus); ring(t, vel * .12, .5);
    },
    clash() {
      const t = now();
      taiko(t, 1, true, sfxBus); whoosh(t - .05, .3, .7, 5200); ring(t, .55, 2.6);
      const n = noise(), g = ctx.createGain(); env(g, t, .002, .5, .5);
      chain(n, filt('highpass', 3000), g, sfxBus); n.start(t, R()); n.stop(t + .6);
    },
    hyoshigi() {
      [0, .34].forEach(dt => {
        const t = now() + dt, n = noise(), g = ctx.createGain();
        env(g, t, .001, .9, .09); chain(n, filt('bandpass', 1950, 14), g, sfxBus); n.start(t, R()); n.stop(t + .15);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 1950;
        env(og, t, .001, .25, .07); chain(o, og, sfxBus); o.start(t); o.stop(t + .1);
      });
    },
    pluck() { koto(deg(10 + Math.floor(R() * 6)), now(), .22, (R() - .5) * .6, sfxBus); },
    resolve() { [5, 7, 8, 10, 12, 13].forEach((d, i) => koto(deg(d), now() + i * .13, .4, -.4 + i * .16, sfxBus)); },
    step(vel = .1) { const t = now(), n = noise(), g = ctx.createGain(); env(g, t, .002, vel, .05); chain(n, filt('lowpass', 520), g, sfxBus); n.start(t, R()); n.stop(t + .1); },
    land(vel = .35) { taiko(now(), vel, false, sfxBus); },
    drum(vel = .8) { taiko(now(), vel, true, sfxBus); }
  };

  /* ---------- public API ---------- */
  const Sound = {
    get on() { return on; },
    enable(v) {
      if (v && !ctx) { try { build(); } catch (e) { return; } }
      if (!ctx) return;
      on = !!v;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      if (on) {
        ctx.resume();
        master.gain.setTargetAtTime(.9, t, .5);
        applyMood();
        nextT = ctx.currentTime + .12;
        if (!timer) timer = setInterval(tick, 60);
      } else {
        master.gain.setTargetAtTime(0, t, .2);
        setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 900);
      }
      try { localStorage.setItem('shogun-sound', on ? '1' : '0'); } catch (e) { /* storage blocked */ }
      document.dispatchEvent(new CustomEvent('soundchange', { detail: on }));
    },
    toggle() { this.enable(!on); },
    setMood(m) { if (MOODS[m] && m !== mood) { mood = m; applyMood(); } },
    sfx: {}
  };
  for (const k in SFX) Sound.sfx[k] = (...a) => { if (on && ctx && ctx.state === 'running') SFX[k](...a); };
  window.Sound = Sound;
})();
