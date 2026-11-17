/* ==========================================================================
   world.js — one continuous Edo-era world at dusk, built in code.
   Stations (one per page section), laid out across the landscape:
     hero   cliff above a castle town, ninjas on the castle wall
     dojo   lantern-lit dojo with translucent shoji walls
     train  bamboo grove with straw targets
     roofs  a street of rooftops for the ninja run
     road   a tunnel of vermilion torii gates
     duel   open grass field under a giant torii at sunset
   ========================================================================== */
import * as THREE from 'three';

let seed = 20261116;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const R = (a, b) => a + rnd() * (b - a);

export const ST = {
  hero:  new THREE.Vector3(0, 0, 0),
  dojo:  new THREE.Vector3(90, 0, -60),
  train: new THREE.Vector3(170, 0, -20),
  roofs: new THREE.Vector3(240, 0, -120),
  road:  new THREE.Vector3(420, 0, -40),
  duel:  new THREE.Vector3(520, 0, -170)
};
export const SUN_DIR = new THREE.Vector3(.2, .13, -1).normalize();

/* ---------- materials ---------- */
const mats = {};
function mat(key, color, o = {}) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, flatShading: true, ...o }));
}
function glow(key, color, intensity = 2.5) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 1 }));
}
const M = {
  roof: () => mat('roof', '#16101a'),
  wall: () => mat('wall', '#2c1e1a'),
  plaster: () => mat('plaster', '#8a7b70'),
  wood: () => mat('wood', '#5a3620'),
  woodDark: () => mat('woodDark', '#24150c'),
  stone: () => mat('stone', '#4f4852'),
  rock: () => mat('rock', '#1f1519'),
  red: () => mat('torii', '#b5271a', { flatShading: false, roughness: .55 }),
  black: () => mat('black', '#120c0c'),
  gold: () => mat('gold', '#c9a14a', { metalness: .7, roughness: .35, flatShading: false }),
  window: () => glow('window', '#ff9c4a', 1.8),
  lamp: () => glow('lamp', '#ffb063', 3.2)
};

/* ---------- primitives ---------- */
function add(parent, mesh, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
const box = (p, w, h, d, m, x, y, z) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
const cyl = (p, rt, rb, h, s, m, x, y, z) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m), x, y, z);
function group(parent, x = 0, y = 0, z = 0, ry = 0, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g); return g; }

// hip roof (pagoda / keep tiers)
function hipRoof(p, w, d, h, y) {
  const geo = new THREE.CylinderGeometry(.06, .7071, 1, 4, 1); geo.rotateY(Math.PI / 4);
  const r = add(p, new THREE.Mesh(geo, M.roof()), 0, y + h / 2, 0); r.scale.set(w, h, d);
  box(p, w * 1.04, .16, d * 1.04, M.roof(), 0, y + .06, 0);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const t = box(p, 1.1, .14, .3, M.roof(), sx * w * .52, y + .28, sz * d * .52);
    t.rotation.y = -Math.atan2(sz * d, sx * w); t.rotation.z = .32;
  });
}
// gable roof with a long ridge along x — runnable
function gableRoof(p, w, d, h, y) {
  const s = new THREE.Shape(); s.moveTo(-d / 2 - .4, 0); s.lineTo(d / 2 + .4, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w * 1.08, bevelEnabled: false }); geo.translate(0, 0, -w * .54); geo.rotateY(Math.PI / 2);
  add(p, new THREE.Mesh(geo, M.roof()), 0, y, 0);
  box(p, w * 1.12, .22, .34, M.black(), 0, y + h + .04, 0);
  return y + h + .15;
}

export function pagoda(parent, x, z, tiers = 5, s = 1) {
  const g = group(parent, x, 0, z, R(0, 1), s);
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const w = 9 - i * 1.3, h = 3.2 - i * .15;
    box(g, w * .62, h, w * .62, M.wall(), 0, y + h / 2, 0);
    box(g, .7, .55, .06, M.window(), 0, y + h * .55, w * .31 + .04);
    hipRoof(g, w * 1.15, w * 1.15, 1.3, y + h);
    y += h + .9;
  }
  cyl(g, .12, .12, 6, 6, M.roof(), 0, y + 3, 0);
  for (let k = 0; k < 6; k++) cyl(g, .45 - k * .04, .45 - k * .04, .12, 8, M.gold(), 0, y + 1 + k * .7, 0);
  return g;
}

function castleKeep(parent, x, z, s = 1) {
  const g = group(parent, x, 0, z, .3, s);
  const base = add(g, new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 8, 4), M.stone()), 0, 4, 0); base.rotation.y = Math.PI / 4;
  let y = 8;
  [[16, 6], [13, 5], [10, 4.4], [7, 4]].forEach(([w, h], i) => {
    box(g, w, h, w * .8, M.plaster(), 0, y + h / 2, 0);
    for (let k = -1; k <= 1; k++) box(g, .9, .8, .06, M.window(), k * w * .28, y + h * .55, w * .4 + .04);
    hipRoof(g, w * 1.25, w * 1.05, 2, y + h);
    y += h + 1.2;
  });
  [-1, 1].forEach(sx => { const f = box(g, .5, 1.2, .3, M.gold(), sx * 2.2, y + .6, 0); f.rotation.z = sx * -.4; });
  return g;
}

export function house(parent, x, z, w, d, h, ry = 0) {
  const g = group(parent, x, 0, z, ry);
  box(g, w, h, d, M.wall(), 0, h / 2, 0);
  box(g, w * .98, h * .32, d * 1.01, M.plaster(), 0, h * .74, 0);
  if (rnd() < .75) box(g, w * .25, h * .28, .06, M.window(), R(-w * .25, w * .25), h * .36, d / 2 + .04);
  const top = gableRoof(g, w, d, Math.min(w, d) * .36, h);
  return { g, top };
}

export function torii(parent, x, z, s = 1, ry = 0) {
  const g = group(parent, x, 0, z, ry, s);
  cyl(g, .24, .29, 5.2, 12, M.red(), -2, 2.6, 0); cyl(g, .24, .29, 5.2, 12, M.red(), 2, 2.6, 0);
  box(g, 5.4, .28, .3, M.red(), 0, 4.15, 0);
  box(g, 6.6, .38, .56, M.red(), 0, 5.0, 0);
  box(g, 7.0, .3, .64, M.black(), 0, 5.34, 0);
  const l = box(g, 1.1, .3, .64, M.black(), -3.85, 5.46, 0); l.rotation.z = .2;
  const r = box(g, 1.1, .3, .64, M.black(), 3.85, 5.46, 0); r.rotation.z = -.2;
  box(g, .32, .75, .32, M.red(), 0, 4.55, 0);
  cyl(g, .34, .36, .32, 12, M.black(), -2, .16, 0); cyl(g, .34, .36, .32, 12, M.black(), 2, .16, 0);
  return g;
}

export function stoneLantern(parent, x, z, s = 1, y = 0) {
  const g = group(parent, x, y, z, R(0, 1), s);
  box(g, .7, .22, .7, M.stone(), 0, .11, 0);
  cyl(g, .12, .15, .95, 6, M.stone(), 0, .68, 0);
  box(g, .62, .14, .62, M.stone(), 0, 1.2, 0);
  box(g, .4, .4, .4, M.lamp(), 0, 1.47, 0);
  const cap = add(g, new THREE.Mesh(new THREE.CylinderGeometry(.04, .56, .36, 4), M.stone()), 0, 1.86, 0); cap.rotation.y = Math.PI / 4;
  add(g, new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 4), M.stone()), 0, 2.08, 0);
  return g;
}

export function sakura(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, R(0, 6), s);
  const bark = mat('bark', '#22140f');
  const t = cyl(g, .16, .34, 3.2, 6, bark, 0, 1.5, 0); t.rotation.z = .12;
  const b1 = cyl(g, .07, .15, 2.4, 5, bark, .75, 3.1, 0); b1.rotation.z = -.75;
  const b2 = cyl(g, .07, .14, 2.1, 5, bark, -.6, 3.15, .2); b2.rotation.z = .85;
  const bl = mat('blossom', '#f0a3b6', { emissive: new THREE.Color('#7a2a40'), emissiveIntensity: .45 });
  for (let i = 0; i < 10; i++) add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(R(.8, 1.5), 0), bl), R(-2.3, 2.3), R(3.3, 5), R(-1.5, 1.5));
  return g;
}

function makiwara(parent, x, z, ry) {
  const g = group(parent, x, 0, z, ry);
  cyl(g, .09, .1, 1.7, 6, M.wood(), 0, .85, 0);
  const t = cyl(g, .55, .55, .12, 20, mat('straw', '#a98348'), 0, 1.75, 0); t.rotation.x = Math.PI / 2;
  const r1 = cyl(g, .36, .36, .13, 20, M.red(), 0, 1.75, .005); r1.rotation.x = Math.PI / 2;
  const r2 = cyl(g, .2, .2, .14, 20, mat('straw', '#a98348'), 0, 1.75, .01); r2.rotation.x = Math.PI / 2;
  const r3 = cyl(g, .08, .08, .15, 16, M.red(), 0, 1.75, .015); r3.rotation.x = Math.PI / 2;
  return g;
}

export function shurikenMesh() {
  const s = new THREE.Shape(), r = .11, i = .028;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? i : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    k ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, .018, 0, Math.PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: .012, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1 });
  geo.center();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: .55, roughness: .3, emissive: new THREE.Color('#3a3a3a') }));
}

/* ---------- instanced vegetation ---------- */
const grassTime = { value: 0 };
function grassField(parent, cx, cz, w, d, n, color = '#2a1a14', hMin = .35, hMax = 1.1) {
  const geo = new THREE.PlaneGeometry(.09, 1, 1, 4); geo.translate(0, .5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (1 - pos.getY(i)));
  const m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = grassTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 gwp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float gs = sin(uTime * 1.6 + gwp.x * .35 + gwp.z * .21) * .32 + sin(uTime * 3.3 + gwp.x * 1.3) * .07;
      transformed.x += gs * position.y * position.y;
      transformed.z += gs * .4 * position.y * position.y;`);
  };
  const im = new THREE.InstancedMesh(geo, m, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(cx + R(-w / 2, w / 2), 0, cz + R(-d / 2, d / 2));
    o.rotation.set(R(-.15, .15), R(0, Math.PI), 0);
    o.scale.set(R(.7, 1.4), R(hMin, hMax), 1);
    o.updateMatrix(); im.setMatrixAt(i, o.matrix);
  }
  im.receiveShadow = true; parent.add(im);
  return im;
}

function bambooGrove(parent, cx, cz, rIn, rOut, n) {
  const geo = new THREE.CylinderGeometry(.075, .095, 1, 6, 8); geo.translate(0, .5, 0);
  const im = new THREE.InstancedMesh(geo, mat('bamboo', '#2c4728'), n);
  const lgeo = new THREE.ConeGeometry(.9, 2.6, 5); lgeo.rotateX(Math.PI);
  const leaves = new THREE.InstancedMesh(lgeo, mat('bambooLeaf', '#1d3320'), n);
  const o = new THREE.Object3D(), data = [];
  for (let i = 0; i < n; i++) {
    const a = R(0, Math.PI * 2), r = R(rIn, rOut);
    data.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, h: R(8, 15), ph: R(0, 6), tx: R(-.05, .05), tz: R(-.05, .05) });
  }
  im.castShadow = true; parent.add(im); parent.add(leaves);
  function update(t) {
    data.forEach((b, i) => {
      const sw = Math.sin(t * .9 + b.ph) * .035;
      o.position.set(b.x, 0, b.z); o.rotation.set(b.tx + sw * .5, 0, b.tz + sw); o.scale.set(1, b.h, 1);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      const top = new THREE.Vector3(0, b.h * .92, 0).applyEuler(o.rotation);
      o.position.set(b.x + top.x, top.y, b.z + top.z); o.scale.set(1, 1, 1);
      o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { update };
}

/* ---------- sky ---------- */
function makeSky(scene) {
  const sky = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#06071a') }, mid: { value: new THREE.Color('#2b1238') },
      horizon: { value: new THREE.Color('#d0452a') }, glowC: { value: new THREE.Color('#ff9a4d') }, sunDir: { value: SUN_DIR }
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, horizon, glowC, sunDir; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(horizon, mid, smoothstep(-.02, .2, h));
        c = mix(c, top, smoothstep(.18, .65, h));
        float s = max(dot(vDir, sunDir), 0.0);
        c += glowC * (pow(s, 6.0) * .55 + pow(s, 40.0) * .7);
        c = mix(c, horizon * .3, smoothstep(0.0, -.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), m));

  const sun = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4d24').multiplyScalar(1.6), fog: false, toneMapped: false }));
  sun.position.copy(SUN_DIR).multiplyScalar(820); sun.lookAt(0, 0, 0); sky.add(sun);

  // ink cloud bands across the sun
  const cm = new THREE.MeshBasicMaterial({ color: '#1a0b16', fog: false, transparent: true, opacity: .85 });
  const clouds = [];
  [[-60, 40, 260, 9], [70, 72, 200, 6], [-10, 108, 300, 7], [120, 20, 180, 5], [-150, 90, 160, 5]].forEach(([x, y, w, h]) => {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(h, w, 4, 12), cm);
    c.rotation.z = Math.PI / 2; c.position.set(x, y, -800); sky.add(c); clouds.push(c);
  });

  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(R(-1, 1), R(.15, 1), R(-1, 1)).normalize().multiplyScalar(900);
    sp.push(v.x, v.y, v.z);
  }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#f3e9d6', size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: .8 })));

  scene.add(sky);
  return { sky, clouds, sun };
}

/* ---------- petals around the camera ---------- */
function makePetals(scene, n) {
  const geo = new THREE.PlaneGeometry(.07, .05);
  const m = new THREE.MeshStandardMaterial({ color: '#f6b9c6', emissive: new THREE.Color('#a8455c'), emissiveIntensity: .6, side: THREE.DoubleSide, roughness: 1 });
  const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false;
  const o = new THREE.Object3D();
  const ps = Array.from({ length: n }, () => ({ x: R(-22, 22), y: R(-2, 14), z: R(-22, 22), r: R(0, 6), vr: R(.5, 2), ph: R(0, 6), v: R(.4, .9) }));
  scene.add(im);
  return {
    update(t, dt, cam) {
      ps.forEach((p, i) => {
        p.y -= p.v * dt; p.x += (Math.sin(t * .4 + p.ph) * .6 - .35) * dt; p.r += p.vr * dt;
        if (p.y < -3) { p.y = 14; p.x = R(-22, 22); p.z = R(-22, 22); }
        const wx = cam.position.x + ((p.x % 44 + 66) % 44 - 22), wz = cam.position.z + ((p.z % 44 + 66) % 44 - 22);
        o.position.set(wx, cam.position.y - 4 + p.y, wz);
        o.rotation.set(p.r, p.r * .7, Math.sin(t * 2 + p.ph));
        o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  };
}

/* ======================================================================
   build
   ====================================================================== */
export function buildWorld(scene, { mobile = false } = {}) {
  scene.fog = new THREE.FogExp2('#3a1526', .0105);
  const { sky, clouds } = makeSky(scene);
  const world = new THREE.Group(); scene.add(world);

  // ground
  const gg = new THREE.PlaneGeometry(1800, 1400, 120, 100); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    let near = 1e9;
    Object.values(ST).forEach(s => { near = Math.min(near, Math.hypot(x + 260 - s.x, z - 80 - s.z)); });
    const amp = THREE.MathUtils.smoothstep(near, 30, 90);
    gp.setY(i, (Math.sin(x * .021) * Math.cos(z * .017) * 3 + Math.sin(x * .05 + z * .03)) * amp - .02);
  }
  gg.translate(260, 0, -80);
  gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, mat('ground', '#1d1013', { flatShading: false }));
  ground.receiveShadow = true; world.add(ground);

  // distant mountains (unfogged silhouettes)
  const mm = [new THREE.MeshBasicMaterial({ color: '#2c1328', fog: false }), new THREE.MeshBasicMaterial({ color: '#1b0b19', fog: false })];
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * .95 + (i / 25) * Math.PI * .9 + R(-.04, .04), r = R(620, 760);
    const h = R(70, 170);
    const c = new THREE.Mesh(new THREE.ConeGeometry(R(90, 170), h, 7), mm[i % 2]);
    c.position.set(260 + Math.cos(a) * r, h / 2 - 25, -80 + Math.sin(a) * r);
    world.add(c);
  }
  const fuji = new THREE.Mesh(new THREE.ConeGeometry(300, 260, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#341a2e', fog: false }));
  fuji.position.set(160, 95, -820); world.add(fuji);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(78, 68, 24), new THREE.MeshBasicMaterial({ color: '#c9a5a8', fog: false }));
  cap.position.set(160, 191, -820); world.add(cap);

  const anchors = {};

  /* --- 序 hero: cliff, castle wall for the ninjas, castle town --- */
  {
    const H = ST.hero, g = group(world, H.x, 0, H.z);
    const cg = new THREE.CylinderGeometry(6.5, 10, 6, 11, 4); cg.translate(0, 3, 0);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 5.9) { cp.setX(i, cp.getX(i) * R(.85, 1.15)); cp.setZ(i, cp.getZ(i) * R(.85, 1.15)); }
    cg.computeVertexNormals();
    add(g, new THREE.Mesh(cg, M.rock()), 0, 0, 0);
    grassField(g, 0, 0, 10, 10, mobile ? 260 : 520, '#1a0e10', .12, .38).position.y = 6;
    sakura(g, -22, 0, -16, 1.4); sakura(g, 18, 0, -20, 1.2);

    const WZ = -45, WH = 6;
    [[-80, -6], [6, 80]].forEach(([a, b]) => {
      const seg = group(g, (a + b) / 2, 0, WZ);
      box(seg, b - a, WH, 2.4, M.wall(), 0, WH / 2, 0);
      box(seg, b - a, 1.2, 2.5, M.plaster(), 0, WH - .9, 0);
      gableRoof(seg, b - a, 2.6, 1.3, WH);
      for (let x = a + 6; x < b - 3; x += 12) box(seg, .7, .5, .05, M.window(), x - (a + b) / 2, WH * .5, 1.24);
    });
    anchors.hero = { samurai: new THREE.Vector3(H.x, 6, H.z), wall: { z: H.z + WZ, y: WH + 1.45, gap: [-6, 6], from: -80, to: 80 } };

    castleKeep(g, -38, -110, 1.2);
    pagoda(g, 46, -95, 5, 1.3);
    for (let i = 0; i < 26; i++) { const x = R(-90, 90), z = R(-140, -60); if (Math.abs(x + 38) < 16 && z < -95) continue; house(g, x, z, R(6, 10), R(5, 7), R(3, 4.5), R(-.2, .2)); }
    for (let i = 0; i < 10; i++) stoneLantern(g, R(-20, 20), R(-40, -20), 1.2);
  }

  /* --- 道 dojo --- */
  {
    const D = ST.dojo, g = group(world, D.x, 0, D.z);
    box(g, 17, .5, 15, M.wood(), 0, .25, 0);
    box(g, 12, .02, 9, mat('tatami', '#9c8a55'), 0, .51, -1);
    for (const [x, z] of [[-8, -7], [8, -7], [-8, 7], [8, 7], [0, -7], [-8, 0], [8, 0], [-4, 7], [4, 7]]) cyl(g, .26, .28, 5, 8, M.woodDark(), x, 2.75, z);
    hipRoof(g, 20, 18, 3.6, 5.2);
    box(g, 17.4, .3, 15.4, M.woodDark(), 0, 5.2, 0);

    const paper = new THREE.MeshStandardMaterial({ color: '#f3ddb1', emissive: new THREE.Color('#ffb35a'), emissiveIntensity: .75, transparent: true, opacity: .86, side: THREE.DoubleSide, depthWrite: false });
    const wall = (w, x, z, ry) => {
      const s = group(g, x, .5, z, ry);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.6), paper); p.position.y = 2.3; s.add(p);
      for (let k = -w / 2; k <= w / 2 + .01; k += 1) box(s, .07, 4.6, .09, M.woodDark(), k, 2.3, 0);
      for (let k = .2; k <= 4.6; k += .78) box(s, w, .07, .09, M.woodDark(), 0, k, 0);
    };
    wall(16, 0, -7, 0); wall(14, -8, 0, Math.PI / 2); wall(14, 8, 0, Math.PI / 2);
    const light = new THREE.PointLight('#ffb064', 40, 22, 2); light.position.set(0, 3, -1); g.add(light);
    [-5, 5].forEach(x => { box(g, .45, .7, .45, M.lamp(), x, .9, -4.5); box(g, .55, .08, .55, M.woodDark(), x, 1.28, -4.5); });
    // katana on its stand
    const ks = group(g, 0, .5, 1.6);
    box(ks, .08, .45, .3, M.woodDark(), -.5, .22, 0); box(ks, .08, .45, .3, M.woodDark(), .5, .22, 0);
    box(ks, 1.5, .04, .04, M.black(), 0, .4, 0); box(ks, .3, .04, .04, mat('tsuka', '#3a2a22'), -.85, .4, 0);
    for (let i = 0; i < 6; i++) sakura(world, D.x + R(-22, 22), 0, D.z + R(-22, -12), R(.8, 1.1));
    for (let i = 0; i < 4; i++) stoneLantern(world, D.x + (i < 2 ? -11 : 11), D.z + 9 + (i % 2) * 5, 1);
    anchors.dojo = { samurai: new THREE.Vector3(D.x, .5, D.z - 1.4), sneak: { z: D.z - 9.6, from: D.x - 14, to: D.x + 14 }, light, paper };
  }

  /* --- 武 training ground in a bamboo grove --- */
  let grove;
  {
    const T = ST.train, g = group(world, T.x, 0, T.z);
    grove = bambooGrove(world, T.x - 3, T.z - 6, 17, 36, mobile ? 140 : 260);
    grassField(g, -3, 0, 26, 22, mobile ? 500 : 1100, '#1f1c12', .15, .5);
    const rock = add(g, new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), M.rock()), -9.5, .7, 0); rock.scale.set(1.3, .8, 1.1);
    const targets = [];
    for (let i = 0; i < 5; i++) {
      const z = -5 + i * 2.5, x = -2.6 + Math.abs(i - 2) * .7;
      const t = makiwara(g, x, z, -Math.PI / 2 + Math.atan2(z, x + 9.5) * .8);
      targets.push({ group: t, center: new THREE.Vector3(T.x + x - .05, 1.75, T.z + z) });
    }
    for (let i = 0; i < 4; i++) stoneLantern(g, R(-12, 4), i < 2 ? -9 : 7, 1);
    anchors.train = { ninja: new THREE.Vector3(T.x - 9.5, 1.95, T.z), targets };
  }

  /* --- 戦 rooftop street --- */
  {
    const F = ST.roofs, g = group(world, F.x, 0, F.z);
    const segs = [];
    let x = 0;
    for (let i = 0; i < 14; i++) {
      const w = R(8, 11), h = R(3.6, 5.6);
      const hs = house(g, x + w / 2, 0, w, 6, h);
      segs.push({ a: F.x + x, b: F.x + x + w, y: hs.top });
      x += w + R(2.6, 3.8);
      // a second row of houses behind
      house(g, x - w / 2, -14, R(8, 12), 7, R(4, 6.5));
      if (i % 2) stoneLantern(g, x - w, 6.5, 1);
    }
    // lanterns strung across the street
    const lm = glow('chochin', '#ff5a2a', 2.6);
    for (let k = 0; k < 18; k++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), lm); l.scale.y = 1.35;
      l.position.set(F.x + k * 7 + 3, 4.6 + Math.sin(k) * .3, 6); world.add(l);
    }
    anchors.roofs = {
      z: F.z, segs, length: x,
      // ridge height + leap progress at world x
      at(wx) {
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          if (wx >= s.a && wx <= s.b) return { y: s.y, u: -1 };
          const n = segs[i + 1];
          if (n && wx > s.b && wx < n.a) {
            const u = (wx - s.b) / (n.a - s.b);
            return { y: THREE.MathUtils.lerp(s.y, n.y, u) + Math.sin(Math.PI * u) * 2.4, u, gap: i };
          }
        }
        return { y: segs[segs.length - 1].y, u: -1 };
      }
    };
  }

  /* --- 旅 torii tunnel road --- */
  {
    const Rd = ST.road, g = group(world, Rd.x, 0, Rd.z);
    const N = mobile ? 22 : 30, step = 2.4;
    for (let i = 0; i < N; i++) torii(g, 0, -i * step, .62);
    box(g, 2.6, .06, N * step + 10, mat('path', '#4a3f3a'), 0, .03, -N * step / 2 + 4);
    for (let i = 0; i < N; i += 3) { stoneLantern(g, -2.6, -i * step - 1.2, .8); stoneLantern(g, 2.6, -i * step - 1.2, .8); }
    for (let i = 0; i < 14; i++) sakura(g, (i % 2 ? 1 : -1) * R(6, 11), 0, -i * 5 + R(-2, 2), R(.8, 1.2));
    grassField(g, 0, -N * step / 2, 26, N * step + 20, mobile ? 700 : 1600, '#1b1110', .2, .7);
    anchors.road = { x: Rd.x, z0: Rd.z + 3, z1: Rd.z - N * step + 2 };
  }

  /* --- 決 duel field --- */
  {
    const Du = ST.duel, g = group(world, Du.x, 0, Du.z);
    torii(g, 0, -34, 2.3);
    grassField(g, 0, -8, 70, 50, mobile ? 1600 : 4200, '#140708', .5, 1.4);
    for (let i = 0; i < 6; i++) sakura(g, R(-30, 30), 0, R(-50, -22), R(1, 1.4));
    anchors.duel = { y: 0, z: Du.z, x: Du.x };
  }

  const petals = makePetals(scene, mobile ? 160 : 380);
  const lampMat = M.lamp();

  return {
    anchors, sky,
    update(t, dt, cam, focus) {
      sky.position.copy(cam.position);
      grassTime.value = t;
      clouds.forEach((c, i) => { c.position.x += Math.sin(t * .05 + i) * .02; });
      lampMat.emissiveIntensity = 3 + Math.sin(t * 9) * .25 + Math.sin(t * 23) * .15;
      if (anchors.dojo) anchors.dojo.light.intensity = 38 + Math.sin(t * 11) * 3 + Math.sin(t * 27) * 2;
      if (focus === 'arsenal' || focus === 'about' || focus === 'work') grove.update(t);
      petals.update(t, dt, cam);
    }
  };
}
