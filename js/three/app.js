/* ==========================================================================
   app.js — the 3D portfolio: renderer, scroll-driven camera that flies
   between stations, per-section choreography, UI, sound.
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, ST, shurikenMesh } from './world.js';
import { loadCast, Character, manager } from './characters.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const sfx = new Proxy({}, { get: (_, k) => (...a) => window.Sound && Sound.sfx[k] && Sound.sfx[k](...a) });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const { clamp, lerp } = THREE.MathUtils;
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const easeIn = t => t * t * t, easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = t => t * t * (3 - 2 * t);

/* ---------- renderer ---------- */
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !mobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(mobile ? 60 : 44, innerWidth / innerHeight, .1, 2200);
camera.position.set(-5, 8, 9);

scene.add(new THREE.HemisphereLight('#6a5690', '#1c0d10', 1.0));
const sunL = new THREE.DirectionalLight('#ff9a5c', 2.6);
sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
Object.assign(sunL.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 220 });
sunL.shadow.bias = -.0005; sunL.shadow.normalBias = .03;
scene.add(sunL, sunL.target);
const fill = new THREE.DirectionalLight('#8a96ff', .35); scene.add(fill, fill.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .8, .55, .8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const world = buildWorld(scene, { mobile });
const A = world.anchors;

/* ---------- loader ---------- */
const loader = $('#loader'), num = $('#loaderNum'), enso = $('.enso path');
let loadFrac = 0, shown = 0;
manager.onProgress = (u, l, t) => { loadFrac = Math.max(loadFrac, l / Math.max(t, 1)); };
const loaderTick = () => {
  shown = lerp(shown, Math.max(loadFrac * 100, Math.min(shown + .4, 90)), .08);
  num.textContent = String(Math.round(shown)).padStart(2, '0');
  enso.style.strokeDashoffset = 520 * (1 - shown / 100);
};
gsap.ticker.add(loaderTick);

const cast = await loadCast();
await (document.fonts ? document.fonts.ready : Promise.resolve());
loadFrac = 1;

/* ---------- characters ---------- */
const all = [];
function mk(kind, station) { const c = new Character(kind, cast[kind] || null); c.station = station; scene.add(c.root); all.push(c); return c; }

const heroSam = mk('samurai', 'hero');
heroSam.root.position.copy(A.hero.samurai); heroSam.root.rotation.y = Math.PI * .9;
heroSam.setArmed(false); heroSam.scrub(heroSam.has('draw') ? 'draw' : 'idle', 0);
const heroN = [mk('ninja', 'hero'), mk('ninja', 'hero')];
heroN[1].root.scale.setScalar(.93);

const dojoSam = mk('samurai', 'about');
dojoSam.root.position.copy(A.dojo.samurai); dojoSam.setArmed(false); dojoSam.play('meditate');
const dojoNin = mk('ninja', 'about');
dojoNin.root.position.set(A.dojo.sneak.from, 0, A.dojo.sneak.z); dojoNin.play('crouch');

const trainNin = mk('ninja', 'arsenal');
trainNin.root.position.copy(A.train.ninja); trainNin.root.rotation.y = Math.PI / 2; trainNin.play('crouch');

const roofNin = mk('ninja', 'work');
roofNin.play('crouch');

const roadSam = mk('samurai', 'journey');
roadSam.setArmed(true); roadSam.root.position.set(A.road.x, 0, A.road.z0); roadSam.root.rotation.y = Math.PI; roadSam.play('idle');

const duelSam = mk('samurai', 'duel'), duelNin = mk('ninja', 'duel');
duelSam.root.rotation.y = Math.PI / 2; duelNin.root.rotation.y = -Math.PI / 2;
duelSam.play('idle'); duelNin.play('crouch');

const cfg = (c, k, d) => (cast[c.kind]?.def?.timing?.[k] ?? d);

/* ---------- fx: sparks + flying shuriken ---------- */
const SPARKS = 220;
const sparkGeo = new THREE.BufferGeometry();
const sp = new Float32Array(SPARKS * 3), sv = new Float32Array(SPARKS * 3), sl = new Float32Array(SPARKS);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: new THREE.Color('#ffb56b').multiplyScalar(3), size: .09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
sparks.frustumCulled = false; scene.add(sparks);
let sparkHead = 0;
function burst(p, n = 40, speed = 7) {
  for (let i = 0; i < n; i++) {
    const j = (sparkHead++) % SPARKS;
    sp[j * 3] = p.x; sp[j * 3 + 1] = p.y; sp[j * 3 + 2] = p.z;
    const d = new THREE.Vector3(Math.random() - .5, Math.random() * .9 - .2, Math.random() - .5).normalize().multiplyScalar(speed * (.4 + Math.random()));
    sv[j * 3] = d.x; sv[j * 3 + 1] = d.y; sv[j * 3 + 2] = d.z; sl[j] = .5 + Math.random() * .5;
  }
}
function updateSparks(dt) {
  for (let j = 0; j < SPARKS; j++) {
    if (sl[j] <= 0) { sp[j * 3 + 1] = -999; continue; }
    sl[j] -= dt * 1.4; sv[j * 3 + 1] -= 9.8 * dt;
    sp[j * 3] += sv[j * 3] * dt; sp[j * 3 + 1] += sv[j * 3 + 1] * dt; sp[j * 3 + 2] += sv[j * 3 + 2] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}
const stars = [];
function launchStar(from, target, card) {
  const m = shurikenMesh(); m.position.copy(from); scene.add(m);
  const to = target.center.clone().add(V((Math.random() - .5) * .3, (Math.random() - .5) * .3, 0));
  stars.push({ m, from: from.clone(), to, t: 0, dur: .42, target, card });
}
function updateStars(dt) {
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i]; s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    s.m.position.lerpVectors(s.from, s.to, k); s.m.position.y += Math.sin(Math.PI * k) * .35;
    s.m.rotation.set(Math.PI / 2, 0, s.t * 40);
    if (k >= 1) {
      stars.splice(i, 1);
      s.m.rotation.set(0, Math.PI / 2 + .3, .4);           // stuck in the straw
      burst(s.to, 18, 3.5); sfx.thunk(.5);
      gsap.fromTo(s.target.group.rotation, { z: .18 }, { z: 0, duration: .9, ease: 'elastic.out(1,.3)' });
      if (s.card) { s.card.classList.add('hit', 'impact'); setTimeout(() => s.card.classList.remove('impact'), 700); }
    }
  }
}

/* ---------- sections + scroll ---------- */
const IDS = ['hero', 'about', 'arsenal', 'work', 'journey', 'duel'];
const MOOD = { hero: 'hero', about: 'calm', arsenal: 'drums', work: 'march', journey: 'walk', duel: 'duel' };
let ranges = [];
const track = $('.track');
function trackDist() { return mobile ? 0 : Math.max(0, track.scrollWidth - innerWidth); }
function measure() {
  $('#work').style.height = mobile ? '' : (innerHeight + trackDist() * 1.1 + innerHeight * .3) + 'px';
  ranges = IDS.map(id => {
    const el = $('#' + id), top = el.getBoundingClientRect().top + scrollY;
    return { id, start: top, end: Math.max(top + 1, top + el.offsetHeight - innerHeight) };
  });
}

// camera framing per section, k = progress through that section
const CAM = {
  // wide screens: samurai sits in the right third; narrow screens: centred low under the text
  hero: k => {
    const H = ST.hero, w = clamp((camera.aspect - .6) / 1.2, 0, 1);
    return { p: V(H.x - .7 - w * 2.7 + k * 2, 7.6 + (1 - w) * .5 + k * 4, H.z + 4.4 + (1 - w) * 1.8 - k * 2), l: V(H.x - .1 - w * 1.1 + k, 7.5 - (1 - w) * 1.1 + k * 1.5, H.z - 22) };
  },
  // low, close dolly on the kneeling samurai; she sits in the left third beside the text
  about: k => {
    const D = A.dojo.samurai, n = camera.aspect < 1 ? 2.5 : 0;
    return { p: V(D.x + 2.3 - k * .9, 1.25 + n * .2, D.z + 6.6 + n - k * 2.4), l: V(D.x + 1.25 - n * .5, .95, D.z - 2) };
  },
  arsenal: k => {
    const T = ST.train;
    if (camera.aspect < 1) return { p: V(T.x - 7.6 - k * .6, 2.3, T.z + 8.6 - k), l: V(T.x - 8.3, 1.7, T.z - .5) };   // phones: centre the ninja
    return { p: V(T.x - 5 - k * 1.2, 2.35, T.z + 8.4 - k * 1.2), l: V(T.x - 5.4, 1.65, T.z - .5) };
  },
  // tracking shot alongside the run, leading slightly in the running direction
  work: () => {
    const p = roofNin.root.position, lead = roofNin.root.rotation.y > 0 ? 1.4 : -1.4, n = camera.aspect < 1 ? 3 : 0;
    return { p: V(p.x + lead * .6, p.y + 1.1, ST.roofs.z + 7.6 + n), l: V(p.x + lead, p.y + 1.6 + n * .3, ST.roofs.z) };
  },
  // over-the-shoulder through the torii tunnel
  // inside the tunnel (the torii pillars stand at ±1.24 m), just behind her shoulder
  journey: () => { const p = roadSam.root.position, n = camera.aspect < 1 ? 1 : 0; return { p: V(p.x + .55, 1.8 + n * .35, p.z + 3.4 + n * 1.2), l: V(p.x - .15, 1.3, p.z - 6) }; },
  // orbits slowly around the fighters, pushes in on every strike, cranes up for the finale
  duel: k => {
    const D = ST.duel, narrow = camera.aspect < 1;
    const mid = duelState.mid || V(D.x, 0, D.z), bi = duelState.bi || 0, end = range(k, .8, .95);
    const ang = lerp(-.34, .26, range(k, .08, .8));
    const dist = (narrow ? 8.6 : 6.4) - range(k, .22, .36) * 1.3 - bi * 1.9 + end * 3;
    return {
      p: V(mid.x + Math.sin(ang) * dist, 1.35 - bi * .2 + end * 1.4 + (1 - range(k, .2, .3)) * .4, mid.z + Math.cos(ang) * dist),
      l: V(mid.x, 1.2 + end * .9, mid.z - 1)
    };
  }
};
const camPos = camera.position.clone(), camLook = V(0, 7, -20), tmpP = V(0, 0, 0), tmpL = V(0, 0, 0);
const prog = Object.fromEntries(IDS.map(i => [i, 0]));
let focus = 'hero', shake = 0;
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

function frameCamera(dt) {
  const y = scrollY;
  ranges.forEach(r => { prog[r.id] = range(y, r.start, r.end); });
  let target = null;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i], n = ranges[i + 1];
    if (y <= r.end || !n) { target = CAM[r.id](prog[r.id]); focus = r.id; break; }
    if (y < n.start) {
      const t = smooth(range(y, r.end, n.start));
      const a = CAM[r.id](1), b = CAM[n.id](0);
      target = { p: a.p.lerp(b.p, t), l: a.l.lerp(b.l, t) };
      target.p.y += Math.sin(Math.PI * t) * 16;               // fly over the land between stations
      focus = t < .5 ? r.id : n.id;
      break;
    }
  }
  if (!target) target = CAM.hero(0);
  if (window.__camOverride) { const o = window.__camOverride; target = { p: V(...o.p), l: V(...o.l) }; }
  const k = 1 - Math.exp(-dt * (focus === 'work' || focus === 'journey' ? 9 : 5));
  const tt = performance.now() / 1000;                       // subtle handheld drift
  tmpP.copy(target.p).add(V(mouse.x * .6 + Math.sin(tt * .31) * .07, -mouse.y * .3 + Math.sin(tt * .23) * .05, Math.sin(tt * .17) * .05));
  camPos.lerp(tmpP, k); camLook.lerp(target.l, k);
  camera.position.copy(camPos);
  if (shake > 0) { const a = shake * .35; camera.position.add(V((Math.random() - .5) * a, (Math.random() - .5) * a, 0)); shake = Math.max(0, shake - dt); }
  camera.lookAt(camLook);

  // keep the sun light + shadow camera on whatever we are looking at
  const f = camLook;
  sunL.target.position.copy(f); sunL.position.copy(f).add(V(10, 40, -60));
  fill.target.position.copy(f); fill.position.copy(f).add(V(-20, 10, 30));
}

/* ---------- station choreography ---------- */
const W = A.hero.wall, NSPEED = 8.5, travel = (W.to - W.from) / NSPEED, DEL = [0, .6], PERIOD = travel + DEL[1] + 2.2;
let nClock = 1.5, nDir = 1, drawState = 0, glintIn = 6;

const stations = {
  hero(dt) {
    nClock += dt;
    if (nClock > PERIOD) { nClock = 0; nDir *= -1; }
    heroN.forEach((n, i) => {
      const local = nClock - DEL[i];
      if (local < 0 || local > travel) { n.root.visible = false; return; }
      n.root.visible = true;
      let xr = W.from + local * NSPEED; if (nDir < 0) xr = W.to - (xr - W.from);
      let y = W.y;
      const a = W.gap[0] - 3.5, b = W.gap[1] + 3.5;
      if (xr > a && xr < b) {
        const u = (xr - a) / (b - a);
        y += Math.sin(Math.PI * u) * 2.4;
        if (n.has('flip')) n.scrub('flip', nDir > 0 ? u : 1 - u, .1); else n.play('run');
        if (!n._air) { n._air = true; sfx.whoosh(.1); }
      } else { n._air = false; n.play('run', { speed: 1.15, fade: .15 }); }
      n.root.position.set(ST.hero.x + xr, y, W.z);
      n.root.rotation.y = nDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    if (drawState === 1) {
      const a = heroSam.current, d = a ? a.getClip().duration : 1, fr = a ? a.time / d : 1;
      if (!heroSam.armed && fr > cfg(heroSam, 'drawAt', .42)) { heroSam.setArmed(true); sfx.unsheathe(.42); heroSam.glint(); }
      if (!heroSam.has('draw') || fr >= .97) { drawState = 2; heroSam.setArmed(true); heroSam.play('idle', { fade: .5 }); }
    } else if (drawState === 2 && (glintIn -= dt) <= 0) { glintIn = 6 + Math.random() * 5; heroSam.glint(); }
  },

  about(dt) {
    const S = A.dojo.sneak, k = prog.about;
    const x = lerp(S.from, S.to, easeInOut(range(k, .08, .85)));
    const v = (x - dojoNin.root.position.x) / Math.max(dt, 1e-3);
    if (Math.abs(v) > .15) { dojoNin.play('sneak', { speed: clamp(Math.abs(v) / 1.3, .4, 1.8) }); dojoNin.root.rotation.y = v > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else dojoNin.play('crouch', { fade: .4 });
    dojoNin.root.position.x = x;
    const near = Math.abs(x - A.dojo.samurai.x) < 2.5;
    if (near && !dojoNin._near) sfx.pluck();
    dojoNin._near = near;
  },

  arsenal(dt) {
    if (!throwing && throwQ.length) { throwing = { ...throwQ.shift(), t: 0, fired: false }; trainNin.play('throw', { loop: false, fade: .12, restart: true, speed: 1.25 }); }
    if (throwing) {
      throwing.t += dt;
      const a = trainNin.current, d = a ? a.getClip().duration / 1.25 : .8;
      const fr = trainNin.has('throw') ? a.time / a.getClip().duration : throwing.t / .8;
      if (!throwing.fired && fr > cfg(trainNin, 'throwAt', .42)) {
        throwing.fired = true; sfx.whoosh(.3);
        launchStar(trainNin.handWorld(), A.train.targets[throwing.i % A.train.targets.length], throwing.card);
      }
      if (fr >= .96 || throwing.t > d + .3) { throwing = null; trainNin.play('crouch', { fade: .35 }); }
    }
  },

  work(dt) {
    const F = A.roofs, k = prog.work;
    const wx = ST.roofs.x + 3 + k * (F.length - 10);
    const r = F.at(wx), p = roofNin.root.position;
    const v = (wx - p.x) / Math.max(dt, 1e-3);
    if (Math.abs(v) > .25) roofNin.root.rotation.y = v > 0 ? Math.PI / 2 : -Math.PI / 2;
    const fwd = roofNin.root.rotation.y > 0;
    if (r.u >= 0) {
      if (roofNin.has('flip')) roofNin.scrub('flip', fwd ? r.u : 1 - r.u, .1); else roofNin.play('run');
      if (!roofNin._air && Math.abs(v) > 2) sfx.whoosh(.16);
      roofNin._air = true;
    } else {
      if (roofNin._air && Math.abs(v) > 1) sfx.land(.2);
      roofNin._air = false;
      if (Math.abs(v) > .6) {
        roofNin.play('run', { speed: clamp(Math.abs(v) / 7, .45, 1.9), fade: .2 });
        roofNin._d = (roofNin._d || 0) + Math.abs(wx - p.x);
        if (roofNin._d > 1.7) { roofNin._d = 0; sfx.step(.08); }
      } else roofNin.play('crouch', { fade: .45 });
    }
    p.set(wx, r.y, F.z);
  },

  journey(dt) {
    const k = prog.journey, R = A.road;
    const z = lerp(R.z0, R.z1, k), p = roadSam.root.position;
    const v = (z - p.z) / Math.max(dt, 1e-3);
    if (Math.abs(v) > .12) {
      roadSam.play('walk', { speed: clamp(Math.abs(v) / 1.4, .5, 2), fade: .25 });
      roadSam.root.rotation.y = v < 0 ? Math.PI : 0;
      roadSam._d = (roadSam._d || 0) + Math.abs(z - p.z);
      if (roadSam._d > 1.3) { roadSam._d = 0; sfx.step(.05); }
    } else roadSam.play('idle', { fade: .5 });
    p.set(R.x, 0, z);
  },

  duel(dt) { duelUpdate(dt); }
};

/* arsenal: throw queue driven by the skill cards */
const throwQ = []; let throwing = null;
$$('.skill-card').forEach((card, i) => {
  if (reduce) { card.classList.add('hit'); return; }
  ScrollTrigger.create({ trigger: card, start: 'top 78%', once: true, onEnter: () => throwQ.push({ i, card }) });
});

/* ---------- 決 duel ---------- */
const flashEl = $('.flash'), bars = $$('.cine'), cta = $('.duel-cta'), stepEl = $('.duel-step'), slashEl = $('.slash-streak');
let dPrev = 0, dCur = 0, stepTxt = '';
const steps = [[.1, 'The challenge'], [.27, 'The charge'], [.68, 'Steel meets steel'], [.86, 'One cut'], [2, 'Your move']];
// Scroll -> fight-time warp. Each beat (measured from the mocap) gets extra scroll, so the
// fight slows into slow motion around every strike and the final cut, then speeds up between.
let warpLUT = null, duelBeats = [];
const duelState = { ft: 0, bi: 0, mid: null };
function buildWarp() {
  duelBeats = [
    ...cfg(duelSam, 'clashes', [.165, .33, .517]).map(b => [b, 2.6]),
    [cfg(duelSam, 'cutAt', .706), 5]
  ];
  const N = 800, W = new Float32Array(N + 1); let acc = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N; let w = 1;
    duelBeats.forEach(([b, a]) => { w += a * Math.exp(-Math.pow((t - b) / .022, 2)); });
    if (i) acc += w; W[i] = acc;
  }
  for (let i = 0; i <= N; i++) W[i] /= acc;
  warpLUT = W;
}
function warp(u) {
  const W = warpLUT, N = W.length - 1; let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (W[m] < u) lo = m; else hi = m; }
  return (lo + (u - W[lo]) / Math.max(1e-6, W[hi] - W[lo])) / N;
}
buildWarp();
let ftPrev = 0;

function duelUpdate(dt) {
  dCur = lerp(dCur, prog.duel, 1 - Math.exp(-dt * 10));
  const k = dCur, X = ST.duel.x, Z = ST.duel.z, R = mobile ? 4.2 : 7.5;
  // the real fight: Mixamo's synced "Sword Fight One" (A = samurai wins, B = ninja loses).
  // Before it, both close the distance at a run.
  const real = duelSam.has('duel') && duelNin.has('duel');
  const GAP = cfg(duelSam, 'duelGap', .8);
  const app = easeInOut(range(k, .1, .26));
  const sx = lerp(X - R, X - GAP, app), nx = lerp(X + R, X + GAP, app);
  const vS = (sx - duelSam.root.position.x) / Math.max(dt, 1e-3);
  duelSam.root.position.set(sx, 0, Z); duelNin.root.position.set(nx, 0, Z);
  const ft = warp(range(k, .27, .86));
  duelSam.setArmed(true); duelNin.setArmed(k > .06);

  if (k < .1) { duelSam.play('idle'); duelNin.play('crouch'); }
  else if (k < .27) {
    const sp = clamp(Math.abs(vS) / 5, .3, 1.6);
    duelSam.play('run', { speed: sp, fade: .25 }); duelNin.play('run', { speed: sp, fade: .25 });
  } else if (real) { duelSam.scrub('duel', ft, .2); duelNin.scrub('duel', ft, .2); }
  else { duelSam.play('idle'); duelNin.play('crouch'); }

  // beat intensity drives the camera push-in and bloom
  let bi = 0;
  if (k > .27) duelBeats.forEach(([b, a]) => { bi = Math.max(bi, Math.exp(-Math.pow((ft - b) / .03, 2)) * (a > 3 ? 1 : .6)); });
  duelState.ft = ft; duelState.bi = bi;
  duelState.mid = (duelState.mid || V()).set((sx + nx) / 2, 0, Z);
  bloom.strength = .8 + bi * .7;

  // DOM fx around the finishing cut
  const CUT = cfg(duelSam, 'cutAt', .706);
  const cutOn = k > .27 ? 1 : 0;
  flashEl.style.opacity = (cutOn * range(ft, CUT - .012, CUT) * (1 - range(ft, CUT, CUT + .05))).toFixed(3);
  slashEl.style.strokeDashoffset = (1300 * (1 - easeOut(cutOn * range(ft, CUT - .004, CUT + .025)))).toFixed(1);
  slashEl.style.opacity = (1 - range(ft, CUT + .06, CUT + .14)).toFixed(3);
  const bh = range(k, .03, .14) * (1 - range(k, .8, .9)) * (10 + bi * 4) * (focus === 'duel' ? 1 : 0);
  bars.forEach(b => { b.style.height = bh.toFixed(2) + 'vh'; });
  const c = range(k, .89, .97);
  cta.style.opacity = c.toFixed(3); cta.style.visibility = c > 0 ? 'visible' : 'hidden';
  cta.style.transform = `translateY(${((1 - c) * 30).toFixed(1)}px)`;
  const txt = steps.find(s => k < s[0])[1];
  if (txt !== stepTxt) { stepTxt = txt; stepEl.textContent = txt; }

  // one-shot beats, fired only when scrolling forward past them
  const ev = (th, fn) => { if (dPrev < th && k >= th) fn(); };
  ev(.04, () => sfx.hyoshigi());
  ev(.06, () => { sfx.unsheathe(.35); duelSam.glint(); });
  ev(.14, () => sfx.drum(.6));
  ev(.22, () => sfx.drum(.75));
  const fev = (th, fn) => { if (k > .27 && ftPrev < th && ft >= th) fn(); };
  const [nStrike, ...sStrikes] = cfg(duelSam, 'clashes', [.165, .33, .517]);
  fev(nStrike, () => { sfx.whoosh(.45); burst(duelNin.bladeTip(), 25, 4); shake = Math.max(shake, .15); });
  sStrikes.forEach(b => fev(b, () => {
    sfx.slash(.5); sfx.drum(.5); duelSam.glint();
    burst(duelSam.bladeTip(), 55, 6); shake = Math.max(shake, .3);
  }));
  fev(CUT, () => { sfx.clash(); shake = .7; burst(duelSam.bladeTip(), 140, 9); duelSam.glint(); });
  fev(cfg(duelSam, 'fallAt', .775), () => sfx.land(.5));
  ev(.9, () => { sfx.resolve(); duelSam.glint(); });
  dPrev = k; ftPrev = ft;
}

/* ---------- main loop ---------- */
let lastFocus = null;
const links = $$('.nav .link');
const near = { hero: ['hero', 'about'], about: ['hero', 'about', 'arsenal'], arsenal: ['about', 'arsenal', 'work'], work: ['arsenal', 'work', 'journey'], journey: ['work', 'journey', 'duel'], duel: ['journey', 'duel'] };
function frame(time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  frameCamera(dt);
  const live = near[focus];
  live.forEach(id => stations[id](dt));
  all.forEach(c => {
    const on = live.includes(c.station);
    if (!on) { c.root.visible = false; return; }
    if (!heroN.includes(c)) c.root.visible = true;   // hero ninjas manage their own visibility
    c.update(dt);
  });
  // horizontal campaign track
  if (!mobile) track.style.transform = `translate3d(${(-trackDist() * range(prog.work, .04, .96)).toFixed(1)}px,0,0)`;
  updateSparks(dt); updateStars(dt);
  world.update(time, dt, camera, focus);
  composer.render();

  if (focus !== lastFocus) {
    lastFocus = focus;
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + focus));
    window.Sound && Sound.setMood(MOOD[focus]);
  }
}

/* ---------- resize ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  measure(); ScrollTrigger.refresh();
}
addEventListener('resize', resize);

/* ---------- UI: smooth scroll, nav, cursor, reveals ---------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: .085 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  window.__lenis = lenis;
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  const r = ranges.find(x => '#' + x.id === (id === '#contact' ? '#duel' : id));
  if (!r) return;
  e.preventDefault();
  const y = id === '#contact' ? r.end : r.start;
  lenis ? lenis.scrollTo(y, { duration: 2.2 }) : scrollTo({ top: y, behavior: 'smooth' });
}));

$$('.split').forEach(h => { h.innerHTML = h.textContent.trim().split(/\s+/).map(w => `<span class="w"><span>${w}</span></span>`).join(' '); });
if (!reduce) {
  $$('.split').forEach(h => gsap.from(h.querySelectorAll('.w > span'), { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: h, start: 'top 86%' } }));
  $$('.sec-kanji').forEach(k => gsap.fromTo(k, { clipPath: 'inset(0% 0% 100% 0%)', filter: 'blur(8px)', scale: 1.15 }, { clipPath: 'inset(0% 0% 0% 0%)', filter: 'blur(0px)', scale: 1, duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: k, start: 'top 88%' } }));
  $$('.reveal').forEach(m => gsap.from(m, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: m, start: 'top 90%' } }));
}
$$('.mile').forEach(m => ScrollTrigger.create({ trigger: m, start: 'top 60%', end: 'bottom 40%', onToggle: s => { m.classList.toggle('lit', s.isActive); if (s.isActive) sfx.pluck(); } }));
$$('.stat b').forEach(b => {
  const end = +b.dataset.count, suf = b.dataset.suffix || '', o = { v: 0 };
  const set = () => { b.textContent = Math.round(o.v) + suf; };
  ScrollTrigger.create({ trigger: b, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: set }) });
});

// cursor + ink slash on click
function slashAt(x, y) {
  const layer = $('.slash-layer'), NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', `translate(${x},${y}) rotate(${(-25 - Math.random() * 35).toFixed(1)})`); layer.appendChild(g);
  [['M-64,3 Q0,-6 64,-1 Q0,2 -64,3 Z', '#c8321f'], ['M-51,1 Q0,-2.5 58,-.6 Q0,.4 -51,1 Z', '#fff4e2']].forEach(([d, f]) => {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', f); g.appendChild(p);
    gsap.fromTo(p, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: .16, ease: 'power3.out' });
  });
  gsap.to(g, { opacity: 0, duration: .5, delay: .22, onComplete: () => g.remove() });
  sfx.slash(.25);
}
if (fine && !reduce) {
  document.body.classList.add('has-cursor');
  const dot = $('.cursor-dot'), ring = $('.cursor-ring');
  $('.cursor-star').setAttribute('d', 'M0,-16 L3.8,-3.8 L16,0 L3.8,3.8 L0,16 L-3.8,3.8 L-16,0 L-3.8,-3.8 Z');
  const xd = gsap.quickTo(dot, 'x', { duration: .06 }), yd = gsap.quickTo(dot, 'y', { duration: .06 });
  const xr = gsap.quickTo(ring, 'x', { duration: .35, ease: 'power3' }), yr = gsap.quickTo(ring, 'y', { duration: .35, ease: 'power3' });
  addEventListener('pointermove', e => { xd(e.clientX); yd(e.clientY); xr(e.clientX); yr(e.clientY); });
  let lastHover = null, lastPluck = 0;
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, .chip, .card');
    ring.classList.toggle('is-hover', !!t);
    if (t && t !== lastHover && performance.now() - lastPluck > 70) { lastPluck = performance.now(); sfx.pluck(); }
    lastHover = t;
  });
  addEventListener('pointerdown', e => { if (!e.target.closest('#loader')) slashAt(e.clientX, e.clientY); });
}

// sound toggle
const st = $('.sound-toggle');
st.addEventListener('click', () => Sound.toggle());
document.addEventListener('soundchange', e => { st.classList.toggle('on', e.detail); st.setAttribute('aria-pressed', e.detail); });

/* ---------- start ---------- */
measure();
ScrollTrigger.refresh();
gsap.ticker.add(frame);

function intro() {
  gsap.timeline()
    .from('.hero-title .line > span', { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: .12 })
    .from(['.eyebrow', '.hero-role', '.hero .hero-cta', '.scroll-cue'], { y: 26, autoAlpha: 0, duration: .9, stagger: .08, ease: 'power3.out' }, '-=.8')
    .from('.nav', { autoAlpha: 0, duration: .8 }, .4)
    .add(() => { drawState = 1; heroSam.play(heroSam.has('draw') ? 'draw' : 'idle', { loop: false, fade: .1 }); }, .9);
}
function enter(withSound) {
  if (withSound) Sound.enable(true);
  sfx.hyoshigi();
  gsap.ticker.remove(loaderTick);
  gsap.timeline({ onComplete: () => loader.remove() })
    .to('.loader-core', { autoAlpha: 0, scale: .96, duration: .35 })
    .to('.loader-slash', { scaleX: 1, duration: .32, ease: 'expo.in' })
    .add(() => { document.body.classList.remove('loading'); lenis && lenis.start(); measure(); ScrollTrigger.refresh(); intro(); })
    .to('.loader-half.top', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '+=.05')
    .to('.loader-half.bottom', { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
    .to('.loader-slash', { autoAlpha: 0, duration: .25 }, '<');
}
gsap.to(enso, { strokeDashoffset: 0, duration: .5 });
num.textContent = '100';
gsap.ticker.remove(loaderTick);
gsap.to('.loader-line', { autoAlpha: 0, duration: .3 });
gsap.to('.loader-enter', { autoAlpha: 1, y: 0, duration: .6, delay: .2 });
$('.enter-sound').addEventListener('click', () => enter(true), { once: true });
$('.enter-quiet').addEventListener('click', () => enter(false), { once: true });
window.__app = { scene, camera, cast, all, prog, ranges: () => ranges };
