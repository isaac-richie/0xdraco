/* ==========================================================================
   audio.js — "Way of the Warrior": an original, procedural samurai score
   plus sound effects. Everything is synthesised live with the Web Audio API
   (no audio files, no licensing), on the Japanese "in" scale: D Eb G A Bb.

   Ensemble
     odaiko      giant drum, chest-deep low end
     nagado      mid taiko, the main voice of the drum line
     shime       small tight drum, fast doko-doko patterns
     kane        hand bell / gong accents
     shamisen    buzzing plucked riffs (Karplus-Strong + sawari buzz)
     koto        plucked zither colour
     shakuhachi  bamboo flute: the recurring warrior leitmotif
     horagai     conch-shell war horn for big moments
     strings     tremolo tension bed for the duel
   Each page section has its own mood (tempo, rhythm, layers); the duel moves
   from heartbeat tension into battle and then the aftermath.
   Sound is off until the visitor opts in (browsers require a click anyway).
   ========================================================================== */
(function () {
  const R = Math.random;
  const SCALE = [0, 1, 5, 7, 8];            // in-sen / miyako-bushi on D
  const ROOT = 50;                            // D3
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const deg = d => { const n = SCALE.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return ROOT + SCALE[i] + 12 * o; };

  let ctx = null, master, music, sfxBus, wet, noiseBuf, droneG, windG, tremG;
  let trackBus = null, curTrack = null, tracksOK = true;
  let on = false, timer = null, nextT = 0, stepIdx = 0, mood = 'hero';
  let motifIdx = 0, motifEnd = 0, offT = null, heardHorn = {};
  let ksCache = {};

  /* ---------- moods: tempo + which layers play ---------- */
  // orchestra layers (0–1): ost string ostinato · brass swells · choir pad · bass low strings · lead strings double the theme · crash cymbals
  const MOODS = {
    hero:   { bpm: 92,  drone: .3,  wind: .04, trem: 0,   drums: 'hero',   shime: 'soft',   shami: null,    shaku: 1,   koto: .1,  horn: true, ost: .55, brass: .8, choir: .8, bass: .8, lead: .5, crash: 1 },
    calm:   { bpm: 66,  drone: .4,  wind: .03, trem: 0,   drums: 'calm',   shime: null,     shami: null,    shaku: .9,  koto: .35, choir: .45, bass: .4 },
    drums:  { bpm: 108, drone: .2,  wind: .02, trem: 0,   drums: 'drums',  shime: 'jiuchi', shami: 'riffA', shaku: .5,  koto: 0,   ost: .85, brass: .45, bass: .75, crash: .6 },
    march:  { bpm: 116, drone: .2,  wind: .02, trem: 0,   drums: 'march',  shime: 'jiuchi', shami: 'riffB', shaku: .65, koto: 0,   ost: 1, brass: .9, choir: .4, bass: .85, lead: .6, crash: 1 },
    walk:   { bpm: 84,  drone: .35, wind: .04, trem: 0,   drums: 'walk',   shime: 'soft',   shami: null,    shaku: .85, koto: .4,  ost: .3, choir: .6, bass: .5 },
    duel:   { bpm: 72,  drone: .22, wind: .12, trem: .55, drums: 'heart',  shime: 'roll',   shami: null,    shaku: 0,   koto: 0,   choir: .35 },
    battle: { bpm: 132, drone: .2,  wind: .04, trem: .25, drums: 'battle', shime: 'jiuchi', shami: 'riffA', shaku: .8,  koto: 0,   horn: true, ost: 1, brass: 1, choir: 1, bass: 1, lead: 1, crash: 1 },
    after:  { bpm: 60,  drone: .3,  wind: .08, trem: 0,   drums: null,     shime: null,     shami: null,    shaku: 1,   koto: .4,  horn: true, choir: .8, bass: .6 }
  };
  // dark cinematic progression built only from in-scale tones, two bars per chord:
  // D5 → B♭ → Gm → E♭   ({b: bass, t: three chord tones})
  const PROG = [
    { b: 38, t: [50, 57, 62] },
    { b: 34, t: [46, 50, 58] },
    { b: 43, t: [50, 55, 58] },
    { b: 39, t: [51, 55, 58] }
  ];
  const OST = [0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 2, 1, 2, 1];   // spiccato figure over the chord
  const ACC = new Set([0, 3, 6, 8, 11, 14]);                        // 3-3-2 accents
  // one 16-step bar per string, two bars per pattern.
  // O odaiko · o soft odaiko · N nagado · n soft nagado · k rim · K kane
  const DRUMS = {
    hero:   ['O.......N.......', 'O.......N...N.N.'],
    calm:   ['n...............', '................'],
    drums:  ['O..N..N.O.N.N.k.', 'O..N..N.O.NNN.KK'],
    march:  ['O...N.N.O...N.N.', 'O...N.N.O.N.NNNN'],
    walk:   ['N.......n...k...', 'N.......n.k.k...'],
    heart:  ['O..o............', 'O..o............'],
    battle: ['O.N.O.N.ONNNO.KK', 'O.NNO.N.O.NNNNNN']
  };
  const SHIME = {          // S accent · s soft
    soft:   ['s.......s.......', 's.......s...s.s.'],
    jiuchi: ['S.s.s.S.s.s.S.s.', 'S.s.s.S.s.s.SsSs'],
    roll:   ['................', 'ssssSSSSssssSSSS']
  };
  const RIFFS = {           // shamisen, scale degrees from low D (null = rest)
    riffA: [0, null, 0, 4, null, 3, null, 0, 0, null, 0, 4, 5, 4, 3, 1],
    riffB: [0, 0, 3, null, 4, null, 3, 1, 0, 0, 3, null, 5, null, 4, 3]
  };
  // the warrior leitmotif: four 2-bar phrases, [degree, beats]
  const MOTIF = [
    [[5, 1], [7, 1], [8, 1.5], [9, .5], [8, 1], [7, 1], [8, 2]],
    [[10, 1.5], [9, .5], [8, 1], [7, 1], [6, 2], [5, 2]],
    [[8, 1], [10, 1], [11, 2], [10, 1], [9, 1], [8, 2]],
    [[9, 1], [8, 1], [7, 1], [6, 1], [5, 4]]
  ];

  /* ---------- graph ---------- */
  function buildGraph() {
    ksCache = {};
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = .006; comp.release.value = .25;
    const lim = ctx.createDynamicsCompressor();                 // brickwall-ish limiter
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .12;
    const soft = ctx.createWaveShaper(), curve = new Float32Array(1024);   // tanh soft clip catches overshoot
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    soft.curve = curve; soft.oversample = '2x';
    master = ctx.createGain(); master.gain.value = 0;
    chain(master, comp, lim, soft, ctx.destination);

    const conv = ctx.createConvolver(); conv.buffer = impulse(3.8, 2.2);   // a big wooden hall
    wet = ctx.createGain(); wet.gain.value = .45; wet.connect(conv); conv.connect(master);

    music = ctx.createGain(); music.gain.value = .62; music.connect(master);
    send(music, .5);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .95; sfxBus.connect(master);
    send(sfxBus, .3);
    trackBus = ctx.createGain(); trackBus.gain.value = 1; trackBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    startDrone(); startWind(); startStrings();
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
  function pan(v) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; }

  /* ---------- drums ---------- */
  function drumBody(t, f0, f1, drop, vel, dur, dest, p = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + drop);
    env(g, t, .003, vel, dur);
    chain(o, g, pan(p), dest); o.start(t); o.stop(t + dur + .1);
  }
  function skin(t, freq, vel, dur, dest, type = 'lowpass', q = .8) {
    const n = noise(), g = ctx.createGain();
    env(g, t, .0015, vel, dur);
    chain(n, filt(type, freq, q), g, dest); n.start(t, R()); n.stop(t + dur + .05);
  }
  function odaiko(t, vel = 1, dest = music) {
    drumBody(t, 64, 37, .4, vel, 2.1, dest);
    drumBody(t, 128, 66, .3, vel * .32, 1.1, dest);
    skin(t, 1100, vel * .55, .3, dest);
  }
  function nagado(t, vel = .8, dest = music) {
    const p = (R() - .5) * .35;
    drumBody(t, 150, 82, .2, vel, .75, dest, p);
    drumBody(t, 300, 170, .12, vel * .22, .3, dest, p);
    skin(t, 1900, vel * .5, .12, dest);
  }
  function shime(t, vel = .4, dest = music) {
    const p = (R() - .5) * .5;
    drumBody(t, 460, 340, .05, vel * .7, .11, dest, p);
    skin(t, 3400, vel * .6, .05, dest, 'bandpass', 1.6);
  }
  function ka(t, vel = .25, dest = music) { skin(t, 2700, vel, .05, dest, 'bandpass', 6); }
  function kane(t, vel = .3, dest = music) {
    [1820, 2610, 3940, 5230].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * (1 + R() * .004);
      env(g, t, .001, vel / (i + 1.6), .45 - i * .06); chain(o, g, pan(.35), dest); o.start(t); o.stop(t + .6);
    });
    skin(t, 6000, vel * .3, .03, dest, 'highpass');
  }

  /* ---------- strings ---------- */
  function ksBuffer(key, m, bright, damp, buzz) {
    if (ksCache[key]) return ksCache[key];
    const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * 2.4);
    const b = ctx.createBuffer(1, len, sr), out = b.getChannelData(0), ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = R() * 2 - 1; ring[i] = bright ? w - prev * .7 : w; prev = w; }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nx = (idx + 1) % N, v = ring[idx];
      out[i] = buzz ? Math.tanh(v * buzz) / Math.tanh(buzz) : v;    // sawari buzz on the shamisen
      ring[idx] = damp * .5 * (v + ring[nx]); idx = nx;
    }
    return (ksCache[key] = b);
  }
  function koto(m, t, vel = .5, p = 0, dest = music) {
    const s = ctx.createBufferSource(); s.buffer = ksBuffer('k' + m, m, false, .997 - Math.max(0, m - 60) * .0005, 0);
    const g = ctx.createGain(); g.gain.value = vel * .55;
    chain(s, filt('lowpass', 4200, .7), g, pan(p), dest); s.start(t); s.stop(t + 2.4);
  }
  function shamisen(m, t, vel = .45, dest = music) {
    const s = ctx.createBufferSource(); s.buffer = ksBuffer('s' + m, m, true, .992, 2.4);
    const g = ctx.createGain(); env(g, t, .002, vel * .6, .9);
    chain(s, filt('peaking', 2400, 1), g, pan(-.25), dest); s.start(t); s.stop(t + 1.2);
    skin(t, 4200, vel * .35, .02, dest, 'highpass');              // bachi plectrum click
  }

  /* ---------- winds ---------- */
  function shaku(m, t, dur, vel = .3) {
    const f = mtof(m), end = t + dur + .5;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sine'; o2.type = 'triangle';
    [o, o2].forEach(x => { x.frequency.setValueAtTime(f * .94, t); x.frequency.exponentialRampToValueAtTime(f, t + .2); });
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .014, t + dur * .85);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = .25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    chain(g, filt('lowpass', 2600, .6), pan(.15), music);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + .14);
    g.gain.setValueAtTime(vel, t + dur * .55);
    g.gain.linearRampToValueAtTime(vel * 1.2, t + dur * .8);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .35);
    const n = noise(), ng = ctx.createGain();                     // breath / muraiki attack
    chain(n, filt('bandpass', f * 2.1, 2), ng, music);
    ng.gain.setValueAtTime(.0001, t);
    ng.gain.exponentialRampToValueAtTime(vel * .7, t + .04);
    ng.gain.exponentialRampToValueAtTime(vel * .1, t + .28);
    ng.gain.exponentialRampToValueAtTime(.0001, t + dur + .3);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(end); });
    n.start(t, R() * 1.5); n.stop(end);
  }
  // horagai: conch-shell war horn — scooped attack, growl, falling release
  function horn(t, dur = 2.8, vel = .5, dest = music) {
    const f = mtof(ROOT), end = t + dur + 1;
    const g = ctx.createGain(), growl = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + .45);
    g.gain.setValueAtTime(vel, t + dur - .4);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .6);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 27;
    const lg = ctx.createGain(); lg.gain.value = .28; chain(lfo, lg, growl.gain); growl.gain.value = .75;
    [[1, 'sawtooth', 1], [1.004, 'sawtooth', .8], [.5, 'square', .25], [1.5, 'sawtooth', .18]].forEach(([mult, type, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; og.gain.value = a;
      o.frequency.setValueAtTime(f * mult * .86, t);
      o.frequency.exponentialRampToValueAtTime(f * mult, t + .35);
      o.frequency.setValueAtTime(f * mult, t + dur - .3);
      o.frequency.exponentialRampToValueAtTime(f * mult * .93, t + dur + .5);
      chain(o, og, growl); o.start(t); o.stop(end);
    });
    chain(growl, filt('bandpass', 640, 1.1), filt('lowpass', 2200, .7), g, dest);
    lfo.start(t); lfo.stop(end);
  }

  /* ---------- cinematic orchestra ---------- */
  function saws(m, t, end, dest, n = 3, spread = 9, type = 'sawtooth') {
    const out = [];
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m);
      o.detune.value = (i - (n - 1) / 2) * spread + (R() - .5) * 3;
      o.connect(dest); o.start(t); o.stop(end); out.push(o);
    }
    return out;
  }
  // short bowed spiccato note: the driving "da-da-da" of epic scores
  function spic(m, t, vel, p = 0) {
    const g = ctx.createGain(), lp = filt('lowpass', 3200, 1.2);
    lp.frequency.setValueAtTime(3600, t); lp.frequency.exponentialRampToValueAtTime(700, t + .16);
    env(g, t, .004, vel, .17);
    const mix = ctx.createGain(); mix.gain.value = .33;
    saws(m, t, t + .3, mix); saws(m - 12, t, t + .3, mix, 2, 6);
    chain(mix, lp, g, pan(p), music);
  }
  // legato violins doubling the theme
  function strLine(m, t, dur, vel) {
    const g = ctx.createGain(), mix = ctx.createGain(); mix.gain.value = .3;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .12);
    g.gain.setValueAtTime(vel, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .35);
    const os = saws(m, t, t + dur + .5, mix, 4, 7);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.6;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(12, t + dur * .6);
    vib.connect(vg); os.forEach(o => vg.connect(o.detune)); vib.start(t); vib.stop(t + dur + .5);
    chain(mix, filt('lowpass', 3000, .7), filt('peaking', 1400, 1), g, pan(-.2), music);
  }
  // brass section swell: low horns/trombones opening up on each chord
  function brass(c, t, dur, vel) {
    const g = ctx.createGain(), lp = filt('lowpass', 300, 2.2), mix = ctx.createGain(); mix.gain.value = .16;
    lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1900, t + .35);
    lp.frequency.exponentialRampToValueAtTime(950, t + 1.3);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .09);
    g.gain.setValueAtTime(vel * .8, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .5);
    [c.b + 12, ...c.t.map(m => m - 12)].forEach(m => saws(m, t, t + dur + .6, mix, 2, 8));
    const shaper = ctx.createWaveShaper(), cv = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; cv[i] = Math.tanh(x * 2); }
    shaper.curve = cv;
    chain(mix, shaper, lp, g, music);
  }
  // wordless "ah" choir: saws through vowel formants
  function choir(c, t, dur, vel) {
    const g = ctx.createGain(), mix = ctx.createGain(); mix.gain.value = .22;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .9);
    g.gain.setValueAtTime(vel, t + dur * .75); g.gain.exponentialRampToValueAtTime(.0001, t + dur + 1.2);
    const vib = ctx.createOscillator(); vib.frequency.value = 4.8;
    const vg = ctx.createGain(); vg.gain.value = 9; vib.connect(vg);
    [...c.t, c.t[0] + 12].forEach(m => saws(m, t, t + dur + 1.4, mix, 3, 11).forEach(o => vg.connect(o.detune)));
    vib.start(t); vib.stop(t + dur + 1.4);
    const sum = ctx.createGain();
    [[730, 7, 1], [1090, 9, .55], [2440, 10, .2]].forEach(([f, q, a]) => {
      const fg = ctx.createGain(); fg.gain.value = a * 2.4; chain(mix, filt('bandpass', f, q), fg, sum);
    });
    chain(sum, g, music);
  }
  // low strings / contrabass holding the root
  function bassStr(m, t, dur, vel) {
    const g = ctx.createGain(), mix = ctx.createGain(); mix.gain.value = .3;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .06);
    g.gain.exponentialRampToValueAtTime(vel * .55, t + .7);
    g.gain.setValueAtTime(vel * .55, t + dur * .8); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .4);
    saws(m, t, t + dur + .5, mix, 3, 6);
    chain(mix, filt('lowpass', 520, 1.1), g, music);
  }
  function crash(t, vel = .2) {
    const n = noise(), g = ctx.createGain();
    env(g, t, .002, vel, 2.6);
    chain(n, filt('highpass', 4200, .5), filt('peaking', 8000, 1.5), g, pan(.3), music); n.start(t, R()); n.stop(t + 2.8);
    const n2 = noise(), g2 = ctx.createGain(); env(g2, t, .001, vel * .8, .25);
    chain(n2, filt('bandpass', 2600, 1.2), g2, music); n2.start(t, R()); n2.stop(t + .3);
  }

  /* ---------- beds ---------- */
  function startDrone() {
    droneG = ctx.createGain(); droneG.gain.value = 0;
    const lp = filt('lowpass', 480, .6);
    [ROOT - 24, ROOT - 12, ROOT - 5].forEach((m, i) => [-6, 6].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      const g = ctx.createGain(); g.gain.value = .05 / (i + 1);
      chain(o, g, lp); o.start();
    }));
    const lfo = ctx.createOscillator(); lfo.frequency.value = .05;
    const lg = ctx.createGain(); lg.gain.value = 220; chain(lfo, lg, lp.frequency); lfo.start();
    chain(lp, droneG, music);
  }
  function startWind() {
    const n = noise(), bp = filt('bandpass', 520, .7);
    windG = ctx.createGain(); windG.gain.value = 0;
    const l1 = ctx.createOscillator(); l1.frequency.value = .07;
    const g1 = ctx.createGain(); g1.gain.value = 320; chain(l1, g1, bp.frequency);
    chain(n, bp, windG, master); n.start(); l1.start();
  }
  // trembling low strings for tension
  function startStrings() {
    tremG = ctx.createGain(); tremG.gain.value = 0;
    const amp = ctx.createGain(); amp.gain.value = .6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9.5;
    const lg = ctx.createGain(); lg.gain.value = .4; chain(lfo, lg, amp.gain); lfo.start();
    const lp = filt('lowpass', 950, .8);
    [ROOT - 12, ROOT - 5, ROOT, ROOT + 1].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = (R() - .5) * 14;
      const g = ctx.createGain(); g.gain.value = [.06, .045, .035, .02][i];
      chain(o, g, lp); o.start();
    });
    chain(lp, amp, tremG, music);
  }

  /* ---------- sequencer ---------- */
  const stepDur = () => 60 / MOODS[mood].bpm / 4;
  function phrase(t, idx, vel) {
    const beat = stepDur() * 4;
    let time = t;
    const lead = MOODS[mood].lead || 0;
    MOTIF[idx % MOTIF.length].forEach(([d, b]) => {
      shaku(deg(d), time, b * beat * .94, vel);
      if (lead) strLine(deg(d), time, b * beat * .96, .2 * lead);
      time += b * beat;
    });
    return time;
  }
  function step(t, s) {
    const M = MOODS[mood], pos = s % 16, bar = Math.floor(s / 16);
    const C = PROG[Math.floor(bar / 2) % PROG.length], bar2 = stepDur() * 32;
    if (M.ost) {
      const v = (ACC.has(pos) ? .34 : .2) * M.ost;
      spic(C.t[OST[pos]], t, v, -.3);
      if (M.ost > .9 && ACC.has(pos)) spic(C.t[OST[pos]] + 12, t, v * .5, .35);
    }
    if (pos === 0 && bar % 2 === 0) {
      if (M.bass) bassStr(C.b, t, bar2 * .97, .4 * M.bass);
      if (M.brass) brass(C, t, bar2 * .9, .3 * M.brass);
      if (M.choir) choir(C, t, bar2, .2 * M.choir);
    }
    if (M.crash && pos === 0 && bar % 4 === 0) crash(t, .16 * M.crash);
    if (M.drums) {
      const c = DRUMS[M.drums][bar % 2][pos];
      if (c === 'O') odaiko(t, 1); else if (c === 'o') odaiko(t, .5);
      else if (c === 'N') nagado(t, .75); else if (c === 'n') nagado(t, .35);
      else if (c === 'k') ka(t, .3); else if (c === 'K') kane(t, .28);
    }
    if (M.shime) {
      const c = SHIME[M.shime][bar % 2][pos];
      const ramp = M.shime === 'roll' ? .25 + pos / 16 * .55 : 1;
      if (c === 'S') shime(t, .5 * ramp); else if (c === 's') shime(t, .25 * ramp);
    }
    if (M.shami) { const d = RIFFS[M.shami][pos]; if (d !== null) shamisen(deg(d), t, pos % 4 === 0 ? .5 : .32); }
    if (M.koto > 0 && pos % 2 === 0 && R() < M.koto * .35) koto(deg(5 + [0, 2, 3, 4, 5, 7][Math.floor(R() * 6)]), t, .28 + R() * .15, (R() - .5) * .8);
    if (pos === 0 && bar % 2 === 0 && M.shaku > 0 && t >= motifEnd - .01 && R() < M.shaku) {
      motifEnd = phrase(t, motifIdx++, .26 * Math.min(1, M.shaku + .2));
      if (M.shaku < .8) motifEnd += stepDur() * 32;              // breathe between phrases
    }
  }
  // the synthesised score only plays if the recorded soundtrack can't load
  function tick() {
    if (!ctx || !on || tracksOK) return;
    const ahead = ctx.currentTime + .3;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
    while (nextT < ahead) { step(nextT, stepIdx); nextT += stepDur(); stepIdx++; }
  }
  function applyMood(at) {
    if (!ctx) return;
    const M = MOODS[mood], t = at ?? ctx.currentTime;
    droneG.gain.setTargetAtTime(tracksOK ? 0 : M.drone * .9, t, 1);
    windG.gain.setTargetAtTime(M.wind * (tracksOK ? .5 : 1), t, 1);
    tremG.gain.setTargetAtTime(tracksOK ? 0 : M.trem, t, .8);
  }
  // land on a fresh bar when the mood changes; big moods announce themselves with the horn
  function enterMood(t) {
    stepIdx = Math.ceil(stepIdx / 16) * 16;
    motifEnd = 0;
    if (tracksOK) return;
    const M = MOODS[mood];
    if (M.horn && !heardHorn[mood]) { heardHorn[mood] = true; horn(t + .05, mood === 'after' ? 3.6 : 2.8, .42); if (mood !== 'after') crash(t + .05, .22); }
    if (M.drums === 'battle' || M.drums === 'drums' || M.drums === 'march') [0, 1, 2, 3].forEach(i => nagado(t + i * stepDur(), .3 + i * .15));
  }

  /* ---------- recorded soundtrack (royalty-free, Pixabay Content License) ----------
     One track per part of the page. Tracks crossfade when the section changes and
     resume where they left off when you come back. Gains level-match the masters. */
  const TRACKS = {
    epic:  { src: 'assets/audio/epic.m4a',  gain: .64 },   // Epic Japanese Trailer Orchestral — E-orchestral
    calm:  { src: 'assets/audio/calm.m4a',  gain: 1.05 },  // Silent Blade — RubyZephyr
    taiko: { src: 'assets/audio/taiko.m4a', gain: .86 },   // Intense Taiko War Drums — DesiFreeMusic
    duel:  { src: 'assets/audio/duel.m4a',  gain: .74 }    // The Last Samurai — ONECinematicStudio
  };
  const MOOD_TRACK = {
    hero: ['epic', 1], calm: ['calm', .85], drums: ['taiko', .95], march: ['epic', 1], walk: ['calm', .9],
    duel: ['duel', .7], battle: ['duel', 1.08], after: ['duel', .5]
  };
  function trackNode(name) {
    const T = TRACKS[name];
    if (!T.el) {
      const el = new Audio();
      el.loop = true; el.preload = 'auto'; el.src = T.src;
      el.addEventListener('error', () => {               // fall back to the live score
        if (!tracksOK) return;
        tracksOK = false; updateTracks(.5); applyMood(); nextT = ctx.currentTime + .1;
      });
      T.el = el; T.g = ctx.createGain(); T.g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(T.g); T.g.connect(trackBus);
    }
    return T;
  }
  function updateTracks(fadeIn = 2.6) {
    if (!ctx || !trackBus) return;
    const t = ctx.currentTime, [want, lvl] = MOOD_TRACK[mood] || [];
    for (const name in TRACKS) {
      const live = on && tracksOK && name === want;
      if (!live && !TRACKS[name].el) continue;
      const T = trackNode(name), g = T.g.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      clearTimeout(T.stopT);
      if (live) {
        g.linearRampToValueAtTime(T.gain * lvl, t + (name === curTrack ? 1.4 : fadeIn));
        if (T.el.paused) T.el.play().catch(() => {});
      } else if (g.value < .01) {
        g.setValueAtTime(0, t); T.el.pause();             // already silent: stop it now
      } else {
        g.setTargetAtTime(0, t + .35, .8);                // hold a beat, then a long tail out
        T.stopT = setTimeout(() => { if (T.g.gain.value < .02 || !on) T.el.pause(); }, 4200);
      }
    }
    curTrack = on && tracksOK ? want : null;
  }
  // phones only let media start inside a tap: touch each track once while we have one
  function unlockTracks() {
    for (const name in TRACKS) {
      const T = trackNode(name);
      if (T.unlocked) continue;
      T.unlocked = true;
      T.el.play().then(() => { if (curTrack !== name) T.el.pause(); }).catch(() => {});
    }
  }
  function duck(depth = .45, hold = .25) {
    if (!trackBus) return;
    const t = ctx.currentTime, g = trackBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setTargetAtTime(depth, t, .02); g.setTargetAtTime(1, t + hold, .45);
  }

  /* ---------- sound effects ---------- */
  const now = () => (offT != null ? offT : ctx.currentTime + .01);
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
      const t = now(); duck();
      odaiko(t, 1.1, sfxBus); whoosh(t - .05, .3, .7, 5200); ring(t, .55, 2.6);
      skin(t, 3000, .5, .5, sfxBus, 'highpass');
    },
    hyoshigi() {
      [0, .34].forEach(dt => {
        const t = now() + dt;
        skin(t, 1950, .9, .09, sfxBus, 'bandpass', 14);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 1950;
        env(og, t, .001, .25, .07); chain(o, og, sfxBus); o.start(t); o.stop(t + .1);
      });
    },
    horn(vel = .5) { horn(now(), 3, vel, sfxBus); },
    pluck() { koto(deg(10 + Math.floor(R() * 6)), now(), .22, (R() - .5) * .6, sfxBus); },
    resolve() { [5, 7, 8, 10, 12, 13].forEach((d, i) => koto(deg(d), now() + i * .13, .4, -.4 + i * .16, sfxBus)); },
    step(vel = .1) { skin(now(), 520, vel, .05, sfxBus); },
    land(vel = .35) { nagado(now(), vel, sfxBus); },
    drum(vel = .8) { odaiko(now(), vel, sfxBus); }
  };

  /* ---------- public API ---------- */
  const Sound = {
    get on() { return on; },
    get status() {                                     // handy when checking in devtools
      const tr = {};
      for (const n in TRACKS) { const T = TRACKS[n]; if (T.el) tr[n] = { playing: !T.el.paused, t: +T.el.currentTime.toFixed(1), gain: +T.g.gain.value.toFixed(3), ready: T.el.readyState }; }
      return { ctx: ctx && ctx.state, mood, track: curTrack, recorded: tracksOK, tracks: tr };
    },
    enable(v) {
      if (v && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); buildGraph(); } catch (e) { return; } }
      if (!ctx) return;
      on = !!v;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      if (on) {
        ctx.resume();
        master.gain.setTargetAtTime(.7, t, .5);
        applyMood(); nextT = ctx.currentTime + .12; enterMood(nextT);
        updateTracks(3.2); unlockTracks();
        if (!timer) timer = setInterval(tick, 50);
      } else {
        master.gain.setTargetAtTime(0, t, .2);
        updateTracks();
        setTimeout(() => {
          if (on || !ctx) return;
          for (const n in TRACKS) if (TRACKS[n].el) TRACKS[n].el.pause();
          ctx.suspend();
        }, 900);
      }
      try { localStorage.setItem('shogun-sound', on ? '1' : '0'); } catch (e) { /* storage blocked */ }
      document.dispatchEvent(new CustomEvent('soundchange', { detail: on }));
    },
    toggle() { this.enable(!on); },
    setMood(m) {
      if (!MOODS[m] || m === mood) return;
      mood = m;
      if (ctx && on) { applyMood(); nextT = Math.max(nextT, ctx.currentTime + .05); enterMood(nextT); updateTracks(); }
    },
    sfx: {}
  };
  for (const k in SFX) Sound.sfx[k] = (...a) => { if (on && ctx && ctx.state === 'running') SFX[k](...a); };
  window.Sound = Sound;
})();
