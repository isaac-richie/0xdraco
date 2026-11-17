/* ==========================================================================
   app.js — the 3D portfolio: renderer, scroll-driven camera that flies
   between stations, per-section choreography, UI, sound.
   ========================================================================== */
import * as THREE from 'three';
import { buildWorld, ST, shurikenMesh } from './world.js?v=13';
import { createPipeline, loadHDRI, createAtmosphere, blendLook } from './cinema.js?v=13';
import { loadCast, Character, manager, TEMPO } from './characters.js?v=12';

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' });
// resolution adapts to the device: it starts sharp and steps down if the frame rate drops (see perf())
const PR = { max: Math.min(devicePixelRatio, mobile ? 1.6 : 1.75), min: Math.min(devicePixelRatio, mobile ? .8 : 1) };
let pr = Math.min(PR.max, mobile ? 1.35 : 1.75);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !mobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
// near/far kept tight for depth precision (a wide range makes distant surfaces shimmer)
const camera = new THREE.PerspectiveCamera(mobile ? 60 : 44, innerWidth / innerHeight, .35, 1700);
camera.position.set(-5, 8, 9);

const hemi = new THREE.HemisphereLight('#6a5690', '#1c0d10', 1.0); scene.add(hemi);
const sunL = new THREE.DirectionalLight('#ff9a5c', 2.6);
sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
Object.assign(sunL.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 220 });
sunL.shadow.bias = -.0005; sunL.shadow.normalBias = .03;
scene.add(sunL, sunL.target);
const fill = new THREE.DirectionalLight('#8a96ff', .35); scene.add(fill, fill.target);

const world = buildWorld(scene, { mobile });
const A = world.anchors;

// film pipeline: HDRI sky light, depth of field, god rays, bloom, ACES, grade, grain, lens fringing
const pipe = createPipeline(renderer, scene, camera, world.sun, { mobile });
const bloom = pipe.bloom;
loadHDRI(renderer, scene, 'assets/env/sky_on_fire_1k.hdr', .55);
const atmo = createAtmosphere(scene, { mobile });
// light shafts falling through the bamboo canopy and into the dojo
atmo.addShafts(V(ST.train.x - 4, 15, ST.train.z - 8), V(.18, -1, .55), mobile ? 4 : 8, 14, 22, 1.1);
atmo.addShafts(V(A.dojo.samurai.x, 6.5, A.dojo.samurai.z - 4), V(.15, -1, .5), mobile ? 3 : 5, 7, 9, .55);

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
dojoSam.root.position.copy(A.dojo.samurai); dojoSam.root.rotation.y = .35; dojoSam.setArmed(false); dojoSam.play('meditate');
const dojoNin = mk('ninja', 'about');
dojoNin.root.position.set(A.dojo.sneak.from, 0, A.dojo.sneak.z); dojoNin.snapFace(Math.PI / 2); dojoNin.play('crouch');

const trainNin = mk('ninja', 'arsenal');
trainNin.root.position.copy(A.train.ninja); trainNin.root.rotation.y = Math.PI / 2; trainNin.play('idle');

const roofNin = mk('ninja', 'work');
roofNin.snapFace(Math.PI / 2); roofNin.play('crouch');

const roadSam = mk('samurai', 'journey');
roadSam.setArmed(false); roadSam.root.position.set(A.road.x, 0, A.road.z0); roadSam.snapFace(Math.PI); roadSam.play('idle');

const duelSam = mk('samurai', 'duel'), duelNin = mk('ninja', 'duel');
duelSam.root.rotation.y = Math.PI / 2; duelNin.root.rotation.y = -Math.PI / 2;
duelSam.play('idle'); duelNin.play('crouch');

// contact shadows: the hero ninjas and rooftop runner spend most of their time airborne
all.forEach(c => { c.shadowStrength = mobile ? .62 : .4; });
heroN.forEach(n => { n.shadow.visible = false; });

const cfg = (c, k, d) => (cast[c.kind]?.def?.timing?.[k] ?? d);

// a fighter running drills up and down a lane: holds a ready stance, performs a technique (its root
// motion carries the body forward, so the feet stay planted), and turns around at the end of the lane
const yawOf = d => Math.atan2(d.x, d.z);
function drills(c, stance, moves, { rest = [1.4, 2.6], lane, onMove } = {}) {
  let move = null, wait = rest[0], last = null, turning = false;
  const nextWait = () => rest[0] + Math.random() * (rest[1] - rest[0]);
  const off = V(0, 0, 0), along = V(0, 0, 0);
  const L = lane.b.clone().sub(lane.a), len = L.length(), dirB = L.clone().normalize();
  // the lane end the fighter is facing, and how much room is left before it
  const heading = () => { const f = V(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y)); return f.dot(dirB) >= 0 ? 1 : -1; };
  const room = h => { const t = along.copy(c.root.position).sub(lane.a).dot(dirB); return h > 0 ? len - t : t; };
  return {
    cancel() { if (move) { move = null; c.play(stance, { fade: .4 }); } wait = nextWait(); },
    update(dt) {
      if (move) {
        move.t += dt;
        const a = c.current, on = a && c.state === move.name, fr = on ? a.time / a.getClip().duration : 1;
        if (on) { c.rootAt(move.name, a.time, off).applyAxisAngle(UP, move.yaw); c.root.position.copy(move.from).add(off); }
        if (fr >= .97 || move.t > move.max) { move = null; wait = nextWait(); c.play(stance, { fade: .45 }); }
        return;
      }
      if (c.state !== stance) c.play(stance, { fade: .45 });
      const h = heading();
      if (!turning) c.face(yawOf(dirB.clone().multiplyScalar(h)), 4);      // square up to the lane while resting
      if ((wait -= dt) > 0) return;
      turning = false;
      const r = room(h);
      let pool = moves.filter(m => c.has(m) && c.travel(m) <= r + .15);
      if (pool.length > 1) pool = pool.filter(m => m !== last);         // vary the techniques when there's a choice
      // turn around when nothing fits, when cornered, or when only the big travelling techniques would fit the other way
      const bigFits = rr => moves.some(m => c.has(m) && c.travel(m) > .35 && c.travel(m) <= rr + .15);
      if (!pool.length || (r < len * .3 && Math.random() < .5) || (!bigFits(r) && bigFits(len - r) && Math.random() < .7)) {
        // out of room: turn to face back down the lane, settle, then go again
        c.face(yawOf(dirB.clone().multiplyScalar(-h)), 2.8); turning = true; wait = 1.8; return;
      }
      const name = last = pool[Math.floor(Math.random() * pool.length)];
      const a = c.play(name, { loop: false, fade: .3, restart: true });
      c.yawGoal = c.root.rotation.y;             // the technique travels the way the body actually faces
      move = { name, t: 0, max: a ? a.getClip().duration / a.timeScale + .4 : 2, from: c.root.position.clone(), yaw: c.root.rotation.y };
      onMove && onMove(name);
    }
  };
}
const UP = V(0, 1, 0);
// the ninja drills toward the straw targets and back; the samurai along the tatami, toward the lens and away
const NL = A.train.ninja, DL = A.dojo.samurai;
trainNin.root.position.copy(NL).add(V(-3, 0, .25)); trainNin.snapFace(Math.PI / 2);
const ninDrill = drills(trainNin, 'idle', ['kick', 'flipkick', 'hurricane'], { rest: [2.2, 3.6], lane: { a: NL.clone().add(V(-3, 0, .25)), b: NL.clone().add(V(2.6, 0, -.25)) }, onMove: () => setTimeout(() => sfx.whoosh(.16), 380 / TEMPO) });
const samDrill = drills(dojoSam, 'ready', ['combo', 'power'], { rest: [2.2, 3.4], lane: { a: DL.clone().add(V(-.7, 0, -3.4)), b: DL.clone().add(V(.45, 0, 1.6)) }, onMove: n => [.42, n === 'combo' ? 1.3 : null, n === 'combo' ? 2.2 : null].forEach(t => t && setTimeout(() => sfx.slash(.16), t * 1000 / TEMPO)) });
dojoSam.snapFace(.35);

// scroll-driven walkers. Scroll arrives in bursts, so a gait played by time always lags and the
// feet skate. Instead the clip is stride-locked: it advances by the distance actually covered,
// divided by how far that gait carries the body per second of animation. Planted feet stay planted.
function stride(c, name, dist) {
  const a = c.actions[name]; if (!a) return;
  a.paused = true;
  const d = a.getClip().duration;
  a.time = ((a.time + Math.abs(dist) / c.gait(name)) % d + d) % d;
}
function locomote(c, dist, dt, { slow, fast, fastAt = Infinity, idle = 'idle' }) {
  c._v = lerp(c._v || 0, dist / Math.max(dt, 1e-3), 1 - Math.exp(-dt * 6));
  const sp = Math.abs(c._v);
  if (sp < (c._moving ? .05 : .1)) {
    c._moving = false;
    if (c.state !== idle) c.play(idle, { fade: .45 });
    [slow, fast].forEach(n => stride(c, n, dist));            // a gait still fading out keeps stepping in time
    return 0;
  }
  c._moving = true;
  const quick = c.state === fast ? sp > fastAt * .8 : sp > fastAt;
  const name = quick && c.has(fast) ? fast : slow;
  if (c.state !== name) c.play(name, { fade: .3 });
  [slow, fast].forEach(n => stride(c, n, dist));
  return c._v;
}
let samPhase = 'sit';

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
  stars.push({ m, from: from.clone(), to, t: 0, dur: .5, target, card });
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

/* ---------- sword trails: a faint arc of light that only shows when the blade really moves ---------- */
const TRAIL_N = 18;
const trailMat = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color('#ffe2c0') } },
  vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA, vA); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
function swordTrail(c) {
  const pos = new Float32Array(TRAIL_N * 2 * 3), alpha = new Float32Array(TRAIL_N * 2), idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, trailMat); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  const base = V(0, 0, 0), tip = V(0, 0, 0), prev = V(0, 0, 0);
  let fresh = true, glow = 0;
  return function update(dt) {
    if (!c.root.visible || !c.bladeEnds(base, tip)) { mesh.visible = false; fresh = true; glow = 0; return; }
    if (fresh) { for (let i = 0; i < TRAIL_N; i++) { pos.set([base.x, base.y, base.z], i * 6); pos.set([tip.x, tip.y, tip.z], i * 6 + 3); } prev.copy(tip); fresh = false; }
    const speed = tip.distanceTo(prev) / Math.max(dt, 1e-3); prev.copy(tip);
    glow = lerp(glow, smooth(range(speed, 3.5, 9)), 1 - Math.exp(-dt * 14));
    pos.copyWithin(6, 0, (TRAIL_N - 1) * 6);
    pos.set([base.x, base.y, base.z], 0); pos.set([tip.x, tip.y, tip.z], 3);
    for (let i = 0; i < TRAIL_N; i++) { const f = Math.pow(1 - i / (TRAIL_N - 1), 1.6) * glow * .55; alpha[i * 2] = f * .08; alpha[i * 2 + 1] = f; }
    geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
    mesh.visible = glow > .01;
  };
}
const trails = [heroSam, dojoSam, duelSam, duelNin].map(swordTrail);

/* ---------- adaptive resolution: hold a smooth frame rate on phones and older laptops ---------- */
let perfT = 0, perfN = 0, perfGood = 0;
function setPR(v) { pr = Math.round(v * 100) / 100; renderer.setPixelRatio(pr); pipe.setPixelRatio(pr); }
function perf(rawDt) {
  if (document.hidden || rawDt > .25 || introK < 1) return;      // ignore hitches, background tabs and the opening shot's loading
  perfT += rawDt; perfN++;
  if (perfT < 1.5) return;
  const fps = perfN / perfT; perfT = perfN = 0;
  if (fps < 44 && pr > PR.min) { setPR(Math.max(PR.min, pr - .15)); perfGood = 0; }
  else if (fps > 57 && pr < PR.max && ++perfGood >= 3) { setPR(Math.min(PR.max, pr + .1)); perfGood = 0; }
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
  // slow dolly in on the samurai at her kata; she stands in the left third beside the text
  about: k => {
    const D = A.dojo.samurai, n = camera.aspect < 1 ? 2.5 : 0;
    return { p: V(D.x + 2.1 - k * .8, 1.5 + n * .25, D.z + 6.4 + n - k * 1.9), l: V(D.x + 1.3 - n * .5, 1.3, D.z - 2) };
  },
  // low three-quarter shot: the ninja in the left third, his straw targets receding behind the cards
  arsenal: k => {
    const N = A.train.ninja, fx = trainNin.root.position.x - N.x;           // he drills up and down a lane: follow him
    if (camera.aspect < 1) return { p: V(N.x + fx - 1.5 - k * .5, 1.45, N.z + 6.6 - k * .6), l: V(N.x + fx + .7, 1.15, N.z - .6) };   // phones: centre the ninja
    return { p: V(N.x + fx * .35 - 2.4 - k * .9, 1.3, N.z + 5.4 - k * .7), l: V(N.x + fx * .35 + 3.1, 1.2, N.z - 1) };
  },
  // tracking shot alongside the run: low and closer, so he runs along the bottom of the frame under the cards
  work: () => {
    const p = roofNin.root.position, lead = roofNin.root.rotation.y > 0 ? 1.4 : -1.4, n = camera.aspect < 1 ? 3 : 0;
    return { p: V(p.x + lead * .5, p.y + .85 + n * .3, ST.roofs.z + 6 + n), l: V(p.x + lead * 1.1, p.y + 2.25 + n * .1, ST.roofs.z) };
  },
  // over-the-shoulder through the torii tunnel
  // inside the tunnel (the torii pillars stand at ±1.24 m), just behind her shoulder
  journey: () => { const p = roadSam.root.position, n = camera.aspect < 1 ? 1 : 0; return { p: V(p.x + .55, 1.8 + n * .35, p.z + 3.4 + n * 1.2), l: V(p.x - .15, 1.3, p.z - 6) }; },
  // orbits slowly around the fighters, pushes in on every strike, cranes up for the finale
  duel: k => {
    const D = ST.duel, narrow = camera.aspect < 1;
    const mid = duelState.mid || V(D.x, 0, D.z), bi = duelState.bi || 0, end = range(k, .8, .95);
    const ang = lerp(-.34, .26, range(k, .08, .8));
    // wide establishing shot for the bows, then in close for the fight
    const dist = (narrow ? 8.6 : 6.4) + (1 - range(k, .16, .3)) * (narrow ? 5 : 3) - range(k, .22, .36) * 1.3 - bi * 1.9 + end * 3;
    const orbit = {
      p: V(mid.x + Math.sin(ang) * dist, 1.35 - bi * .2 + end * 1.4 + (1 - range(k, .2, .3)) * .4, mid.z + Math.cos(ang) * dist),
      l: V(mid.x, 1.2 + end * .9, mid.z - 1)
    };
    // the standoff: low over the samurai's shoulder, the ninja waiting down the field; then swing into the orbit
    const w = smooth(range(k, .17, .3));
    if (w >= 1) return orbit;
    const s = duelSam.root.position, n = duelNin.root.position;
    // three-quarter from behind her, on the near side, so the torii, sakura and sunset sit behind the ninja
    const dir = V(n.x - s.x, 0, n.z - s.z).normalize(), near = V(0, 0, 1);
    const ots = {
      p: V(s.x, 0, s.z).addScaledVector(dir, -(narrow ? 3.4 : 1.7) - k * 2).addScaledVector(near, narrow ? .5 : 2.9).setY(1.55),
      l: V(n.x, 1.25, n.z).addScaledVector(near, narrow ? 0 : -2.2)
    };
    return { p: ots.p.lerp(orbit.p, w), l: ots.l.lerp(orbit.l, w) };
  }
};
const camPos = camera.position.clone(), camLook = V(0, 7, -20), tmpP = V(0, 0, 0), tmpL = V(0, 0, 0);
const prog = Object.fromEntries(IDS.map(i => [i, 0]));
let focus = 'hero', shake = 0, lookA = 'hero', lookB = 'hero', lookT = 0, introK = 1, lightning = 0;
// opening crane: high over the castle town, sweeping down onto the samurai on her cliff
const INTRO = [
  { p: V(-46, 52, 84), l: V(10, 6, -90) },
  { p: V(-18, 20, 30), l: V(2, 7, -40) }
];
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

const SUN_OFF = V(10, 40, -60), sunDir = SUN_OFF.clone().normalize();
const sunRight = V(0, 1, 0).cross(sunDir).normalize(), sunUp = sunDir.clone().cross(sunRight).normalize();
const TEXEL = 52 / 2048, snapped = V(0, 0, 0);
function snapToTexel(p) {
  const r = Math.round(p.dot(sunRight) / TEXEL) * TEXEL, u = Math.round(p.dot(sunUp) / TEXEL) * TEXEL, d = p.dot(sunDir);
  return snapped.copy(sunRight).multiplyScalar(r).addScaledVector(sunUp, u).addScaledVector(sunDir, d);
}

function frameCamera(dt) {
  const y = scrollY;
  ranges.forEach(r => { prog[r.id] = range(y, r.start, r.end); });
  let target = null;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i], n = ranges[i + 1];
    if (y <= r.end || !n) { target = CAM[r.id](prog[r.id]); focus = lookA = lookB = r.id; lookT = 0; break; }
    if (y < n.start) {
      const t = smooth(range(y, r.end, n.start));
      const a = CAM[r.id](1), b = CAM[n.id](0);
      target = { p: a.p.lerp(b.p, t), l: a.l.lerp(b.l, t) };
      target.p.y += Math.sin(Math.PI * t) * 16;               // fly over the land between stations
      focus = t < .5 ? r.id : n.id; lookA = r.id; lookB = n.id; lookT = t;
      break;
    }
  }
  if (!target) target = CAM.hero(0);
  if (introK < 1) {
    const u = easeInOut(introK), a = INTRO[0], b = INTRO[1];
    const p1 = a.p.clone().lerp(b.p, range(u, 0, .65)), l1 = a.l.clone().lerp(b.l, range(u, 0, .65));
    const w = smooth(range(u, .55, 1));
    target = { p: p1.lerp(target.p, w), l: l1.lerp(target.l, w) };
  }
  if (window.__camOverride) { const o = window.__camOverride; target = { p: V(...o.p), l: V(...o.l) }; }
  const k = introK < 1 ? 1 : 1 - Math.exp(-dt * (focus === 'work' || focus === 'journey' ? 9 : 5));
  const tt = performance.now() / 1000;                       // subtle handheld drift
  tmpP.copy(target.p).add(V(mouse.x * .6 + Math.sin(tt * .31) * .07, -mouse.y * .3 + Math.sin(tt * .23) * .05, Math.sin(tt * .17) * .05));
  camPos.lerp(tmpP, k); camLook.lerp(target.l, k);
  camera.position.copy(camPos);
  if (shake > 0) { const a = shake * .35; camera.position.add(V((Math.random() - .5) * a, (Math.random() - .5) * a, 0)); shake = Math.max(0, shake - dt); }
  camera.lookAt(camLook);

  // keep the sun light + shadow camera on whatever we are looking at
  // snap the shadow camera to whole shadow-map texels so shadows don't crawl/shimmer as the camera drifts
  const f = snapToTexel(camLook);
  sunL.target.position.copy(f); sunL.position.copy(f).add(SUN_OFF);
  fill.target.position.copy(f); fill.position.copy(f).add(V(-20, 10, 30));
}

/* ---------- station choreography ---------- */
// they sprint at the run clip's natural pace (feet locked to the wall) and carry extra speed through the leap
const W = { ...A.hero.wall, from: -50, to: 50 }, NSPEED = 4.9, LEAP = [W.gap[0] - 2, W.gap[1] + 2], LEAPX = 1.7;
const pathLen = (W.to - W.from) + (LEAP[1] - LEAP[0]) * (1 / LEAPX - 1);       // in run-time metres
const travel = pathLen / NSPEED, DEL = [0, .8], PERIOD = travel + DEL[1] + 3;
// distance along the wall after running for t seconds (faster across the leap)
function wallX(t) {
  const d = t * NSPEED, a = LEAP[0] - W.from, b = a + (LEAP[1] - LEAP[0]) / LEAPX;
  return W.from + (d < a ? d : d < b ? a + (d - a) * LEAPX : (LEAP[1] - W.from) + (d - b));
}
let nClock = 1.5, nDir = 1, drawState = 0, glintIn = 6;

const stations = {
  hero(dt) {
    nClock += dt;
    if (nClock > PERIOD) { nClock = 0; nDir *= -1; }
    heroN.forEach((n, i) => {
      const local = nClock - DEL[i];
      if (local < 0 || local > travel) { n.root.visible = false; return; }
      n.root.visible = true;
      let xr = wallX(local); if (nDir < 0) xr = W.to - (xr - W.from);
      let y = W.y;
      const a = LEAP[0], b = LEAP[1];
      if (xr > a && xr < b) {
        const u = (xr - a) / (b - a);
        y += Math.sin(Math.PI * u) * 2.8;
        if (n.has('flip')) n.scrub('flip', nDir > 0 ? u : 1 - u, .1); else n.play('run');
        if (!n._air) { n._air = true; sfx.whoosh(.1); }
      } else { n._air = false; n.play('run', { speed: NSPEED / n.gait('run'), fade: .15 }); }
      n.root.position.set(ST.hero.x + xr, y, W.z);
      n.root.rotation.y = nDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    if (drawState === 1) {
      const a = heroSam.current, d = a ? a.getClip().duration : 1, fr = a ? a.time / d : 1;
      if (!heroSam.armed && fr > cfg(heroSam, 'drawAt', .42)) { heroSam.setArmed(true); sfx.unsheathe(.42); heroSam.glint(); }
      if (!heroSam.has('draw') || fr >= .97) { drawState = 2; heroSam.setArmed(true); heroSam.play(heroSam.has('pose') ? 'pose' : 'idle', { fade: .6 }); }
    } else if (drawState === 2 && (glintIn -= dt) <= 0) { glintIn = 6 + Math.random() * 5; heroSam.glint(); }
  },

  about(dt) {
    const S = A.dojo.sneak, k = prog.about;
    const x = lerp(S.from, S.to, easeInOut(range(k, .08, .85)));
    const v = locomote(dojoNin, x - dojoNin.root.position.x, dt, { slow: 'sneak', fast: 'run', fastAt: 3.6, idle: 'crouch' });
    if (Math.abs(v) > .25) dojoNin.face(v > 0 ? Math.PI / 2 : -Math.PI / 2, 7);
    dojoNin.root.position.x = x;
    const near = Math.abs(x - A.dojo.samurai.x) < 2.5;
    if (near && !dojoNin._near) sfx.pluck();
    dojoNin._near = near;

    // she meditates as you arrive, then rises, draws and runs her kata
    if (k < .12) {
      if (samPhase !== 'sit') { samPhase = 'sit'; samDrill.cancel(); dojoSam.setArmed(false); dojoSam.face(.35, 3); dojoSam.play('meditate', { fade: .9 }); }
    } else if (samPhase === 'sit') {
      samPhase = 'draw'; dojoSam.play('draw', { loop: false, fade: .8, restart: true });
    } else if (samPhase === 'draw') {
      const a = dojoSam.current, fr = a && dojoSam.state === 'draw' ? a.time / a.getClip().duration : 1;
      if (!dojoSam.armed && fr > cfg(dojoSam, 'drawAt', .42)) { dojoSam.setArmed(true); sfx.unsheathe(.3); dojoSam.glint(); }
      if (fr >= .97) { dojoSam.setArmed(true); samPhase = 'kata'; dojoSam.play('ready', { fade: .5 }); }
    } else samDrill.update(dt);
  },

  arsenal(dt) {
    if (!throwing && throwQ.length) {
      ninDrill.cancel(); throwing = { ...throwQ.shift(), t: 0, fired: false };
      const tg = A.train.targets[throwing.i % A.train.targets.length].center, p = trainNin.root.position;
      trainNin.face(Math.atan2(tg.x - p.x, tg.z - p.z), 9);          // square up to the target during the wind-up
      trainNin.play('throw', { loop: false, fade: .25, restart: true, speed: 1.15 });
    }
    if (!throwing) { ninDrill.update(dt); return; }
    if (throwing) {
      throwing.t += dt;
      const a = trainNin.current, d = a ? a.getClip().duration / a.timeScale : .8;
      const fr = trainNin.has('throw') ? a.time / a.getClip().duration : throwing.t / .8;
      if (!throwing.fired && fr > cfg(trainNin, 'throwAt', .42)) {
        throwing.fired = true; sfx.whoosh(.3);
        launchStar(trainNin.handWorld(), A.train.targets[throwing.i % A.train.targets.length], throwing.card);
      }
      if (fr >= .96 || throwing.t > d + .3) { throwing = null; trainNin.play('idle', { fade: .4 }); }
    }
  },

  work(dt) {
    const F = A.roofs, k = prog.work;
    const wx = ST.roofs.x + 3 + k * Math.min(F.length - 10, mobile ? 52 : 68);
    const r = F.at(wx), p = roofNin.root.position;
    const v = (wx - p.x) / Math.max(dt, 1e-3);
    roofNin._v = lerp(roofNin._v || 0, v, 1 - Math.exp(-dt * 7));
    if (Math.abs(roofNin._v) > .3) roofNin.face(roofNin._v > 0 ? Math.PI / 2 : -Math.PI / 2, 8);
    const fwd = (roofNin.yawGoal ?? Math.PI / 2) > 0;
    if (r.u >= 0) {
      if (roofNin.has('flip')) roofNin.scrub('flip', fwd ? r.u : 1 - r.u, .1); else roofNin.play('run');
      if (!roofNin._air && Math.abs(v) > 2) sfx.whoosh(.16);
      roofNin._air = true;
    } else {
      const landed = roofNin._air;
      if (landed && Math.abs(v) > 1) sfx.land(.2);
      roofNin._air = false;
      const into = fwd ? r.into : r.outOf;
      if (roofNin.state === 'roll' && roofNin.current && roofNin.current.time < roofNin.current.getClip().duration * .92) {
        stride(roofNin, 'roll', wx - p.x);                     // the landing roll, stride-locked like the run
      } else if (roofNin.has('roll') && landed && Math.abs(roofNin._v) > 2.5 && into != null && into < 1.5) {
        roofNin.play('roll', { loop: false, restart: true, fade: .1 }); stride(roofNin, 'roll', 0);
      } else if (locomote(roofNin, wx - p.x, dt, { slow: 'sneak', fast: 'run', fastAt: 2.4, idle: 'crouch' })) {
        roofNin._d = (roofNin._d || 0) + Math.abs(wx - p.x);
        if (roofNin._d > 1.7) { roofNin._d = 0; sfx.step(.08); }
      }
    }
    roofNin.shadow.visible = r.u < 0;
    p.set(wx, r.y, F.z);
  },

  journey(dt) {
    const k = prog.journey, R = A.road;
    const z = lerp(R.z0, R.z1, k), p = roadSam.root.position;
    const v = locomote(roadSam, z - p.z, dt, { slow: 'walk', fast: 'run', fastAt: 2.3 });
    if (v) {
      roadSam.face(v < 0 ? Math.PI : 0, 6);
      roadSam._d = (roadSam._d || 0) + Math.abs(z - p.z);
      if (roadSam._d > 1.3) { roadSam._d = 0; sfx.step(.05); }
    }
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
  const k = dCur, X = ST.duel.x, Z = ST.duel.z, R = mobile ? 3.2 : 4.4;
  // the real fight: Mixamo's synced "Sword Fight One" (A = samurai wins, B = ninja loses).
  // Before it, both close the distance at a run.
  const real = duelSam.has('duel') && duelNin.has('duel');
  const GAP = cfg(duelSam, 'duelGap', .8);
  const app = easeInOut(range(k, .17, .27));
  const sx = lerp(X - R, X - GAP, app), nx = lerp(X + R, X + GAP, app);
  const vS = (sx - duelSam.root.position.x) / Math.max(dt, 1e-3);
  duelSam.root.position.set(sx, 0, Z); duelNin.root.position.set(nx, 0, Z);
  const ft = warp(range(k, .27, .86));
  duelSam.setArmed(true); duelNin.setArmed(k > .17);

  if (k < .06) { duelSam.play('idle'); duelNin.play('crouch'); }
  else if (k < .17 && duelSam.has('bow')) { const b = range(k, .06, .16); duelSam.scrub('bow', b, .3); duelNin.scrub('bow', b, .3); }
  else if (k < .27) {
    const ds = vS * Math.max(dt, 1e-3);              // distance covered this frame (positions were already moved above)
    if (duelSam.state !== 'run') { duelSam.play('run', { fade: .25 }); duelNin.play('run', { fade: .25 }); }
    stride(duelSam, 'run', ds); stride(duelNin, 'run', ds);
  } else if (real) { duelSam.scrub('duel', ft, .2); duelNin.scrub('duel', ft, .2); }
  else { duelSam.play('idle'); duelNin.play('crouch'); }

  // beat intensity drives the camera push-in and bloom
  let bi = 0;
  if (k > .27) duelBeats.forEach(([b, a]) => { bi = Math.max(bi, Math.exp(-Math.pow((ft - b) / .03, 2)) * (a > 3 ? 1 : .6)); });
  duelState.ft = ft; duelState.bi = bi;
  duelState.mid = (duelState.mid || V()).set((sx + nx) / 2, 0, Z);
  bloom.intensity = 1.1 + bi * .9;

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
  ev(.17, () => { sfx.unsheathe(.35); duelSam.glint(); });
  ev(.14, () => sfx.drum(.6));
  ev(.22, () => sfx.drum(.75));
  const fev = (th, fn) => { if (k > .27 && ftPrev < th && ft >= th) fn(); };
  const [nStrike, ...sStrikes] = cfg(duelSam, 'clashes', [.165, .33, .517]);
  fev(nStrike, () => { sfx.whoosh(.45); burst(duelNin.bladeTip(), 25, 4); shake = Math.max(shake, .15); });
  sStrikes.forEach(b => fev(b, () => {
    sfx.slash(.5); sfx.drum(.5); duelSam.glint();
    burst(duelSam.bladeTip(), 55, 6); shake = Math.max(shake, .3);
  }));
  fev(CUT, () => { sfx.clash(); sfx.drum(1); shake = .7; lightning = 1; burst(duelSam.bladeTip(), 140, 9); duelSam.glint(); });
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
  updateSparks(dt); updateStars(dt); trails.forEach(t => t(dt)); perf(deltaMs / 1000);
  world.update(time, dt, camera, focus, curLook);
  grade(dt, time);
  pipe.render(dt);

  if (focus !== lastFocus) {
    if (lastFocus && introK >= 1) chapter(focus);
    lastFocus = focus;
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + focus));
  }
  // the duel scores itself: heartbeat tension → battle drums → aftermath
  const mood = focus !== 'duel' ? MOOD[focus] : prog.duel < .27 ? 'duel' : prog.duel < .84 ? 'battle' : 'after';
  if (mood !== lastMood) { lastMood = mood; window.Sound && Sound.setMood(mood); }
}
let lastMood = null;

/* ---------- look + weather + focus per scene ---------- */
const WEATHER = {
  hero:    { mist: .45, embers: .55, flies: 0,  rain: 0, shafts: 0,  petals: .9 },
  about:   { mist: .2,  embers: .15, flies: .8, rain: 0, shafts: .9, petals: 0 },
  arsenal: { mist: .32, embers: 0,   flies: .7, rain: 0, shafts: 1,  petals: 0 },
  work:    { mist: .3,  embers: .5,  flies: 0,  rain: 0, shafts: 0,  petals: 0 },
  journey: { mist: .5,  embers: .2,  flies: .6, rain: 0, shafts: 0,  petals: 1 },
  duel:    { mist: .26, embers: .9,  flies: 0,  rain: 0, shafts: 0,  petals: .55 }
};
const FOCUS = {          // what the lens holds sharp, and how shallow the focus is
  hero: () => [heroSam.root.position, 1.4, 7, 2.2],
  about: () => (Math.abs(dojoNin.root.position.x - A.dojo.samurai.x) < 3.5 ? [dojoNin.root.position, 1.1, 3, 3.4] : [dojoSam.root.position, samPhase === 'sit' ? .9 : 1.3, 2.4, 3.4]),
  arsenal: () => [trainNin.root.position, 1, 6, 2.6],
  work: () => [roofNin.root.position, 1.2, 6, 2.4],
  journey: () => [roadSam.root.position, 1.3, 4, 3],
  duel: () => [duelState.mid || duelSam.root.position, 1.2, 4.5, 2.8]
};
const fp = V(0, 0, 0), white = new THREE.Color('#ffffff');
let curLook = null;
function grade(dt, t) {
  const L = curLook = blendLook(lookA, lookB, lookT);
  const u = world.skyMat.uniforms;
  u.top.value.copy(L.top); u.mid.value.copy(L.mid); u.horizon.value.copy(L.horizon).lerp(white, lightning * .8); u.glowC.value.copy(L.glow);
  scene.fog.color.copy(L.fog).lerp(white, lightning * .5); scene.fog.density = L.fogD;
  sunL.color.copy(L.sun); sunL.intensity = L.sunI; hemi.intensity = L.hemi + lightning * 5;
  scene.environmentIntensity = L.env;
  pipe.bc.contrast = L.con; pipe.bc.brightness = (L.exp - 1) * .4 + lightning * .25; pipe.hs.saturation = L.sat;
  pipe.godRays.blendMode.opacity.value = Math.min(1, L.rays);
  lightning = Math.max(0, lightning - dt * 2.2);
  // weather
  const wa = WEATHER[lookA], wb = WEATHER[lookB], W = {};
  for (const key in wa) W[key] = lerp(wa[key], wb[key], lookT);
  if (focus === 'duel') W.rain = range(prog.duel, .22, .36) * (1 - range(prog.duel, .9, 1) * .5);
  atmo.update(t, dt, camera, L, W);
  // focus pull
  const [p, h, rng, bokeh] = FOCUS[focus]();
  fp.lerp(V(p.x, p.y + h, p.z), 1 - Math.exp(-dt * 4));
  pipe.focus(fp, rng, introK < 1 ? 1.2 : bokeh);
}

// chapter title card while flying between scenes
const CHAPTERS = {
  about: ['道', '第一章 · Chapter I', 'The Way'], arsenal: ['武', '第二章 · Chapter II', 'The Arsenal'],
  work: ['戦', '第三章 · Chapter III', 'Campaigns'], journey: ['旅', '第四章 · Chapter IV', 'The Road'], duel: ['決', '終章 · Finale', 'The Duel']
};
const chapterEl = $('.chapter');
function chapter(id) {
  const c = CHAPTERS[id]; if (!c || reduce) return;
  chapterEl.querySelector('.ch-kanji').textContent = c[0];
  chapterEl.querySelector('.ch-num').textContent = c[1];
  chapterEl.querySelector('.ch-title').textContent = c[2];
  sfx.drum(.35);
  gsap.killTweensOf(chapterEl);
  gsap.timeline()
    .fromTo(chapterEl, { autoAlpha: 0, scale: 1.08, filter: 'blur(10px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: .7, ease: 'power3.out' })
    .fromTo(chapterEl.querySelector('.ch-rule'), { scaleX: 0 }, { scaleX: 1, duration: .8, ease: 'expo.out' }, '<.1')
    .to(chapterEl, { autoAlpha: 0, scale: .97, filter: 'blur(6px)', duration: .8, ease: 'power2.in' }, '+=1.1');
}

/* ---------- resize ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  pipe.setSize(innerWidth, innerHeight);
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

// any click, scroll, swipe or key skips the opening crane shot
let introTL = null;
const skipIntro = e => { if (introK < 1 && introTL && !(e.target && e.target.closest && e.target.closest('#loader'))) introTL.progress(1); };
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, skipIntro, { passive: true }));
function intro() {
  const o = { k: 0 };
  lenis && lenis.stop();
  introK = reduce ? 1 : 0;
  gsap.set(['.hero-title .line > span'], { yPercent: 115 });
  gsap.set(['.eyebrow', '.hero-role', '.hero .hero-cta', '.scroll-cue', '.nav'], { autoAlpha: 0 });
  introTL = gsap.timeline()
    .to(o, { k: 1, duration: reduce ? 0 : 6.2, ease: 'none', onUpdate: () => { introK = o.k; } })
    .add(() => sfx.drum(.5), 3.6)
    .to('.hero-title .line > span', { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: .14 }, 3.4)
    .to(['.eyebrow', '.hero-role', '.hero .hero-cta', '.scroll-cue'], { y: 0, autoAlpha: 1, duration: .9, stagger: .08, ease: 'power3.out' }, 4.4)
    .to('.nav', { autoAlpha: 1, duration: .8 }, 5)
    .add(() => { drawState = 1; heroSam.play(heroSam.has('draw') ? 'draw' : 'idle', { loop: false, fade: .1 }); }, 4.8)
    .add(() => { introK = 1; lenis && lenis.start(); });
}
function enter(withSound) {
  if (withSound) Sound.enable(true);
  sfx.hyoshigi();
  gsap.ticker.remove(loaderTick);
  gsap.timeline({ onComplete: () => loader.remove() })
    .to('.loader-core', { autoAlpha: 0, scale: .96, duration: .35 })
    .to('.loader-slash', { scaleX: 1, duration: .32, ease: 'expo.in' })
    .add(() => { document.body.classList.remove('loading'); measure(); ScrollTrigger.refresh(); intro(); })
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
window.__app = { scene, camera, cast, all, prog, pipe, world, ranges: () => ranges, get pr() { return pr; } };
