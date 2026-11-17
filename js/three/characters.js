/* ==========================================================================
   characters.js — Mixamo-rigged samurai + ninja with motion-capture clips.
   assets/manifest.json lists the model + clip files. Every Mixamo rig shares
   the same bone names, so one set of clips drives both characters.
   Without a manifest (or while files are missing) a stand-in figure is used.
   ========================================================================== */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const manager = new THREE.LoadingManager();
const fbx = new FBXLoader(manager), gltf = new GLTFLoader(manager);

function load(url) {
  return new Promise((res, rej) => {
    if (/\.fbx$/i.test(url)) fbx.load(url, o => res({ scene: o, animations: o.animations || [] }), undefined, rej);
    else gltf.load(url, g => res({ scene: g.scene, animations: g.animations || [] }), undefined, rej);
  });
}

// turn a clip around the vertical axis (Mixamo paired clips are authored facing each other)
function yawClip(clip, deg) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
  const tq = new THREE.Quaternion(), tp = new THREE.Vector3();
  clip.tracks.forEach(t => {
    const v = t.values;
    if (/Hips\.quaternion$/.test(t.name)) for (let i = 0; i < v.length; i += 4) { tq.fromArray(v, i).premultiply(q).toArray(v, i); }
    if (/Hips\.position$/.test(t.name)) for (let i = 0; i < v.length; i += 3) { tp.fromArray(v, i).applyQuaternion(q).toArray(v, i); }
  });
  return clip;
}

// keep the animation in place: we move characters ourselves
function cleanClip(clip, name) {
  const c = clip.clone(); c.name = name;
  c.tracks.forEach(t => {
    if (/Hips\.position$/.test(t.name)) {
      const v = t.values, x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  });
  return c;
}

export async function loadCast() {
  let man = null;
  try { const r = await fetch('assets/manifest.json', { cache: 'no-cache' }); if (r.ok) man = await r.json(); } catch (e) { /* no manifest yet */ }
  const cast = {};
  if (!man) return cast;
  const clipCache = {};
  await Promise.all(['samurai', 'ninja'].map(async kind => {
    const def = man[kind]; if (!def) return;
    const keep = new Set(def.keepRoot || []);
    const getClip = (name, url) => (clipCache[url] = clipCache[url] || load(url).then(a => {
      const c = a.animations[0]; if (!c) return null;
      if (keep.has(name)) {           // keep the root motion, but start it at the character's origin
        const k = c.clone(); k.name = name;
        k.tracks.forEach(t => {
          if (/Hips\.position$/.test(t.name)) {
            const v = t.values, x0 = v[0], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) { v[i] -= x0; v[i + 2] -= z0; }
          }
        });
        return k;
      }
      return cleanClip(c, name);
    }).catch(e => { console.warn('clip', name, e); return null; }));
    try {
      const map = {};
      let base;
      if (def.clips === 'embedded') {          // compressed GLB: model + named clips in one file
        base = await load(def.model);
        const roots = rootTracks(base.scene, base.animations, def, keep);
        base.animations.forEach(c => {
          if (keep.has(c.name)) {
            const k = c.clone();
            if (def.clipYaw && def.clipYaw[c.name]) yawClip(k, def.clipYaw[c.name]);
            k.tracks.forEach(t => {
              if (/Hips\.position$/.test(t.name)) { const v = t.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] -= x0; v[i + 2] -= z0; } }
            });
            map[c.name] = k;
          } else if (roots[c.name]) map[c.name] = cleanClip(c, c.name);   // travels: pinned here, the root follows instead
          else map[c.name] = c;                                             // in place: keep the captured hip sway, so planted feet stay planted
        });
        cast[kind] = { base: base.scene, clips: map, def, roots };
        return;
      }
      const [b, ...clips] = await Promise.all([load(def.model), ...Object.entries(def.clips || {}).map(([n, u]) => getClip(n, u).then(c => c && [n, c]))]);
      base = b;
      clips.forEach(e => { if (e) map[e[0]] = e[1].name === e[0] ? e[1] : Object.assign(e[1].clone(), { name: e[0] }); });
      cast[kind] = { base: base.scene, clips: map, def };
    } catch (e) { console.warn('model', kind, e); }
  }));
  return cast;
}

// Root motion: attacks like the flying kick carry the body metres forward. The clips are pinned in
// place for the mixer, so record where the hips travel and let the character's root follow that
// path instead: the feet then stay planted rather than skating.
function rootTracks(base, clips, def, keep) {
  const out = {}, N = 90, s = def.scale ?? .01;
  const m = SkeletonUtils.clone(base); m.scale.setScalar(s);
  let hips = null; m.traverse(o => { if (o.isBone && /Hips$/.test(o.name)) hips = hips || o; });
  if (!hips) return out;
  const mixer = new THREE.AnimationMixer(m), p = new THREE.Vector3();
  clips.forEach(c => {
    if (keep.has(c.name)) return;
    mixer.stopAllAction(); const a = mixer.clipAction(c); a.reset().play();
    const xz = new Float32Array((N + 1) * 2); let x0 = 0, z0 = 0;
    for (let i = 0; i <= N; i++) {
      mixer.setTime(c.duration * i / N * .9999); m.updateMatrixWorld(true); hips.getWorldPosition(p);
      if (!i) { x0 = p.x; z0 = p.z; }
      xz[i * 2] = p.x - x0; xz[i * 2 + 1] = p.z - z0;
    }
    a.stop();
    const travel = Math.hypot(xz[N * 2], xz[N * 2 + 1]);
    if (travel > .35) out[c.name] = { xz, N, dur: c.duration, travel };   // only clips that really go somewhere
  });
  mixer.uncacheRoot(m);
  return out;
}

/* ---------- look: dark ink body, fiery rim light from the sun ---------- */
export function addRim(m, color, pow = 2.4, strength = 1) {
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = { value: new THREE.Color(color).multiplyScalar(strength) };
    sh.uniforms.rimPow = { value: pow };
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimPow;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), rimPow);
       totalEmissiveRadiance += rimColor * rimF;`);
  };
  m.customProgramCacheKey = () => 'rim' + color + pow + strength;
  return m;
}
function stylize(model, o) {
  model.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    const out = list.map(src => {
      const n = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.tint), map: src.map || null, normalMap: src.normalMap || null, roughness: .62, metalness: .04, envMapIntensity: 1.1 });
      if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
      if (n.normalMap) n.normalScale.set(1, 1);
      return addRim(n, o.rim, o.rimPow, o.rimStrength);
    });
    m.material = Array.isArray(m.material) ? out : out[0];
  });
}

/* ---------- props (built in metres) ---------- */
const steel = addRim(new THREE.MeshStandardMaterial({ color: '#e4e8ee', metalness: .92, roughness: .16, envMapIntensity: 1.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 }), '#ffd2a0', 2.4, .5);
const lacquer = new THREE.MeshStandardMaterial({ color: '#120c0c', roughness: .45, metalness: .2 });
const goldM = new THREE.MeshStandardMaterial({ color: '#d6ad55', metalness: .8, roughness: .3, emissive: new THREE.Color('#5a3a10'), emissiveIntensity: .6 });
const redM = new THREE.MeshStandardMaterial({ color: '#c8321f', roughness: .7, emissive: new THREE.Color('#5a0e06'), emissiveIntensity: .5, side: THREE.DoubleSide });

export function katana(len = .74) {
  const g = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .27, 8), lacquer); grip.position.y = -.02; g.add(grip);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .008, 16), goldM); tsuba.position.y = .12; g.add(tsuba);
  const s = new THREE.Shape();
  s.moveTo(-.012, 0); s.quadraticCurveTo(-.016, len * .55, .006, len); s.lineTo(.016, len * .93); s.quadraticCurveTo(.006, len * .5, .014, 0); s.closePath();
  const bg = new THREE.ExtrudeGeometry(s, { depth: .005, bevelEnabled: false }); bg.translate(0, 0, -.0025);
  const blade = new THREE.Mesh(bg, steel); blade.position.y = .125; g.add(blade);
  g.userData.blade = blade;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function scabbard(len = .78) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.CylinderGeometry(.022, .017, len, 8), lacquer); s.position.y = len / 2; g.add(s);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .27, 8), lacquer); hilt.position.y = -.15; g.add(hilt);
  const ts = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .008, 16), goldM); ts.position.y = -.005; g.add(ts);
  g.userData.hilt = [hilt, ts];
  return g;
}
function kabuto() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(.135, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lacquer); g.add(bowl);
  const shikoro = new THREE.Mesh(new THREE.CylinderGeometry(.15, .24, .13, 18, 1, true, Math.PI * .25, Math.PI * 1.5), lacquer);
  shikoro.material = lacquer.clone(); shikoro.material.side = THREE.DoubleSide; shikoro.position.y = -.05; shikoro.rotation.y = Math.PI; g.add(shikoro);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(.13, .012, 6, 24, Math.PI * .8), goldM);
  crest.position.set(0, .12, .1); crest.rotation.set(-.2, 0, Math.PI * .1); g.add(crest);
  const base = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .02), goldM); base.position.set(0, .08, .135); g.add(base);
  return g;
}
function headband() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.105, .014, 6, 24), redM); ring.rotation.x = Math.PI / 2; g.add(ring);
  const tails = [0, 1].map(i => {
    const geo = new THREE.PlaneGeometry(.035, .5, 1, 10); geo.translate(0, -.25, 0);
    const m = new THREE.Mesh(geo, redM); m.position.set(i ? .02 : -.02, 0, -.1); m.rotation.x = 1.2; g.add(m);
    m.userData.base = geo.attributes.position.array.slice(); m.userData.i = i;
    return m;
  });
  g.userData.tails = tails;
  return g;
}

/* ---------- Character ---------- */
const LOOK = {
  samurai: { tint: '#e8dcd4', rim: '#ff8a4c', rimPow: 3.2, rimStrength: .55 },
  ninja:   { tint: '#b4aebc', rim: '#ff6a3e', rimPow: 3.2, rimStrength: .5 }
};
// motion-captured technique plays a touch slower than real time so visitors can read every move.
// Locomotion is left alone: its speed is matched to how fast the character travels.
export const TEMPO = .78;
const LOCO = /^(run|walk|sneak)$/;

// soft contact shadow under the feet (the only shadow on phones, where shadow maps are off)
let shadowTex = null;
function contactShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.45, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .5, color: '#000000', polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(.95, .8, 1); m.renderOrder = 1;
  return m;
}

const FALLBACK = { stance: 'idle', draw: 'idle', walk: 'run', sneak: 'walk', crouch: 'idle', throw: 'idle', flip: 'run', kneel: 'idle', slash: 'idle', meditate: 'idle', fall: 'idle' };

const _v = new THREE.Vector3();
export class Character {
  shadowStrength = .5;

  constructor(kind, asset, o = {}) {
    this.kind = kind; this.root = new THREE.Group(); this.actions = {}; this.current = null; this.t = Math.random() * 10;
    this.props = {};
    if (asset) {
      this.model = SkeletonUtils.clone(asset.base);
      const s = asset.def.scale ?? .01;
      this.model.scale.setScalar(s);
      this.root.add(this.model);
      this.mixer = new THREE.AnimationMixer(this.model);
      for (const [k, c] of Object.entries(asset.clips)) this.actions[k] = this.mixer.clipAction(c);
      stylize(this.model, { ...LOOK[kind], ...(asset.def.look || {}) });
      this.bones = {};
      this.model.traverse(b => { if (b.isBone) this.bones[b.name.replace(/^mixamorig:?/, '').replace(/^.*?(Hips|Spine|Neck|Head|Left|Right)/, '$1')] = b; });
      this.unit = 1 / s;
      this.propCfg = asset.def.props || {};
      this.roots = asset.roots || {}; this.gaits = asset.def.gait || {};
    } else this._standIn();
    this._dress(o);
    this.shadow = contactShadow(); this.shadow.position.y = .02; this.root.add(this.shadow);
  }

  _standIn() {
    const m = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: .7 });
    addRim(m, LOOK[this.kind].rim, 2.2, 1.3);
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .55, 4, 10), m); torso.position.y = 1.2; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), m); head.position.y = 1.68; body.add(head);
    const legs = [-1, 1].map(s => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.08, .7, 4, 8), m); l.position.set(s * .1, .45, 0); body.add(l); return l; });
    const arms = [-1, 1].map(s => { const a = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .55, 4, 8), m); a.position.set(s * .27, 1.2, 0); body.add(a); return a; });
    body.traverse(x => { if (x.isMesh) x.castShadow = true; });
    this.root.add(body);
    this.standIn = { body, legs, arms, head };
    const hand = new THREE.Object3D(); hand.position.set(.3, .9, .1); body.add(hand);
    this.bones = { RightHand: hand, Head: head, Hips: torso, Spine2: torso };
    this.unit = 1; this.propCfg = {};
  }

  _attach(boneName, obj, cfg = {}) {
    const bone = this.bones[boneName]; if (!bone) return null;
    const holder = new THREE.Group();
    holder.scale.setScalar(this.unit);
    if (cfg.pos) holder.position.set(...cfg.pos.map(v => v * this.unit));
    if (cfg.rot) holder.rotation.set(...cfg.rot);
    if (cfg.dir) holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...cfg.dir).normalize());
    holder.add(obj); bone.add(holder);
    return holder;
  }

  _dress() {
    const P = this.propCfg;
    if (this.kind === 'samurai') {
      this.props.katana = this._attach('RightHand', katana(), P.katana || { pos: [0, .08, .02], rot: [-Math.PI / 2, 0, 0] });
      this.props.saya = this._attach('Hips', scabbard(), P.saya || { pos: [.17, -.02, .02], rot: [-2.2, 0, .25] });
      if (P.helmet) this.props.helmet = this._attach('Head', kabuto(), P.helmet);   // off for Kachujin: keep her topknot
    } else {
      this.props.band = this._attach('Head', headband(), P.band || { pos: [0, .12, .01], rot: [0, 0, 0] });
      this.props.back = this._attach('Spine2', scabbard(.62), P.back || { pos: [0, .05, -.14], rot: [0, 0, 2.5] });
      // this rig's hand bone is oriented differently: direction measured from the duel mocap
      this.props.blade = this._attach('RightHand', katana(.55), P.blade || { pos: [0, .08, .02], dir: [.18, -.97, -.17] });
    }
    this.setArmed(this.kind === 'samurai' ? true : false);
  }

  // samurai: blade in hand vs sheathed; ninja: blade drawn vs on the back
  setArmed(v) {
    this.armed = v;
    const hand = this.props.katana || this.props.blade;
    if (hand) hand.visible = v;
    const sheath = this.props.saya || this.props.back;
    if (sheath) sheath.children[0].userData.hilt.forEach(h => { h.visible = !v; });
  }

  glint() {
    const b = (this.props.katana || this.props.blade)?.children[0]?.userData.blade; if (!b) return;
    const o = { k: 0 };
    if (window.gsap) gsap.fromTo(o, { k: 0 }, { k: 1, duration: .6, ease: 'power2.inOut', onUpdate: () => { b.material.emissiveIntensity = Math.sin(o.k * Math.PI) * 1.8; } });
  }

  has(name) { return !!this.actions[name]; }

  // metres per second a locomotion clip covers at speed 1 (measured from the planted foot)
  gait(name) { return this.gaits[name] || (name === 'run' ? 4.5 : name === 'walk' ? 1.3 : 2); }
  // how far a clip carries the body, and where the hips are (in the character's facing frame) at a time
  travel(name) { return this.roots?.[name]?.travel || 0; }
  rootAt(name, time, out) {
    const r = this.roots?.[name]; if (!r) return out.set(0, 0, 0);
    const f = THREE.MathUtils.clamp(time / r.dur, 0, 1) * r.N, i = Math.min(r.N - 1, Math.floor(f)), u = f - i;
    return out.set(r.xz[i * 2] + (r.xz[i * 2 + 2] - r.xz[i * 2]) * u, 0, r.xz[i * 2 + 1] + (r.xz[i * 2 + 3] - r.xz[i * 2 + 1]) * u);
  }
  // turn smoothly toward a heading instead of snapping (rate: how quickly, per second)
  face(yaw, rate = 6) { this.yawGoal = yaw; this.yawRate = rate; }
  snapFace(yaw) { this.yawGoal = yaw; this.yawRate = this.yawRate || 6; this.root.rotation.y = yaw; }

  play(name, { fade = .3, loop = true, speed = 1, restart = false } = {}) {
    let a = this.actions[name] || this.actions[FALLBACK[name]] || this.actions.idle || this.actions.crouch;
    this.state = name; this.speed = speed;
    if (!a) return null;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    this.tempo = LOCO.test(name) ? 1 : TEMPO;
    a.clampWhenFinished = !loop; a.timeScale = speed * this.tempo; a.paused = false;
    if (this.current !== a || restart) {
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
      this.current = a;
    }
    return a;
  }

  // drive a clip by a 0..1 value (scroll scrubbing)
  scrub(name, k, fade = .2) {
    const a = this.play(name, { fade, loop: true });
    if (!a) return;
    a.paused = true;
    a.time = THREE.MathUtils.clamp(k, 0, .999) * a.getClip().duration;
  }

  setSpeed(s) { this.speed = s; if (this.current) this.current.timeScale = s * (this.tempo || 1); }

  // the blade's two ends in world space (for the sword trail); null while sheathed
  bladeEnds(base, tip) {
    const holder = this.props.katana || this.props.blade, b = holder && holder.children[0].userData.blade;
    if (!b || !holder.visible) return false;
    const len = this.props.katana ? .74 : .55;
    b.localToWorld(base.set(.002, len * .12, 0)); b.localToWorld(tip.set(.006, len, 0));
    return true;
  }

  bladeTip(v = new THREE.Vector3()) {
    const holder = this.props.katana || this.props.blade, b = holder && holder.children[0].userData.blade;
    if (!b || !holder.visible) return this.handWorld(v);
    return b.localToWorld(v.set(.006, this.props.katana ? .74 : .55, 0));
  }

  handWorld(v = new THREE.Vector3()) { const b = this.bones.RightHand; return b ? b.getWorldPosition(v) : this.root.getWorldPosition(v).setY(1.3); }

  update(dt) {
    this.t += dt;
    if (this.mixer) this.mixer.update(dt);
    if (this.yawGoal != null) {
      const r = this.root.rotation, d = Math.atan2(Math.sin(this.yawGoal - r.y), Math.cos(this.yawGoal - r.y));
      r.y += d * (1 - Math.exp(-dt * (this.yawRate || 6)));
    }
    // keep the contact shadow under the hips, fading as the body leaves the ground
    const hips = this.bones.Hips;
    if (hips && this.shadow.visible) {
      hips.getWorldPosition(_v); this.root.worldToLocal(_v);
      this.shadow.position.x = _v.x; this.shadow.position.z = _v.z;
      const lift = THREE.MathUtils.clamp((_v.y - 1.05) / .9, 0, 1);
      this.shadow.material.opacity = this.shadowStrength * (1 - lift);
    }
    if (this.standIn) {           // simple procedural motion for the stand-in
      const s = this.standIn, st = this.state || 'idle';
      const moving = /run|walk|sneak/.test(st), k = moving ? Math.sin(this.t * (st === 'run' ? 12 : 6) * (this.speed || 1)) : 0;
      s.legs[0].rotation.x = k * .6; s.legs[1].rotation.x = -k * .6;
      s.arms[0].rotation.x = -k * .5; s.arms[1].rotation.x = k * .5;
      s.body.position.y = moving ? Math.abs(k) * .05 : Math.sin(this.t * 1.6) * .01;
      s.body.rotation.x = st === 'run' ? .25 : (/crouch|sneak|kneel|meditate/.test(st) ? .35 : 0);
      s.body.scale.y = /crouch|kneel|meditate/.test(st) ? .7 : 1;
    }
    const band = this.props.band?.children[0];
    if (band) band.userData.tails.forEach(m => {
      const p = m.geometry.attributes.position, b = m.userData.base;
      for (let i = 0; i < p.count; i++) {
        const y = b[i * 3 + 1];
        p.setX(i, b[i * 3] + Math.sin(this.t * 9 - y * 10 + m.userData.i) * y * .12);
        p.setZ(i, b[i * 3 + 2] + Math.cos(this.t * 7 - y * 8) * y * .06);
      }
      p.needsUpdate = true;
    });
  }
}
