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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
const WHITE = new THREE.Color('#ffffff');
export const SUN_DIR = new THREE.Vector3(.2, .13, -1).normalize();

/* ---------- materials: photoscanned CC0 surfaces from Poly Haven ---------- */
const mats = {};
const texLoader = new THREE.TextureLoader();
const TEX = 'assets/env/tex/';
function tex(name, kind) {
  const t = texLoader.load(`${TEX}${name}_${kind}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pbr(key, name, tint, o = {}) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ map: tex(name, 'diff'), normalMap: tex(name, 'nor'), color: tint, roughness: .88, metalness: 0, ...o }));
}
function mat(key, color, o = {}) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, ...o }));
}
function glow(key, color, intensity = 2.5) {
  return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 1 }));
}
const M = {
  roof: () => pbr('roof', 'clay_roof_tiles_02', '#4e4a58', { normalScale: new THREE.Vector2(1.3, 1.3), roughness: .7 }),
  wall: () => pbr('wall', 'black_painted_planks', '#8a7468'),
  plaster: () => pbr('plaster', 'clay_plaster', '#efe4d2'),
  wood: () => pbr('wood', 'brown_planks_07', '#d6a878', { roughness: .7 }),
  woodDark: () => pbr('woodDark', 'black_painted_planks', '#4a3428'),
  stone: () => pbr('stone', 'castle_wall_slates', '#a89c98'),
  rock: () => pbr('rock', 'castle_wall_slates', '#6a5a58', { normalScale: new THREE.Vector2(1.6, 1.6) }),
  red: () => pbr('torii', 'clay_plaster', '#d0321c', { roughness: .55 }),
  black: () => mat('black', '#120c0c', { roughness: .5 }),
  gold: () => mat('gold', '#c9a14a', { metalness: .8, roughness: .3 }),
  window: () => glow('window', '#ff9c4a', 2.2),
  lamp: () => glow('lamp', '#ffb063', 3.6)
};

// scale a geometry's UVs to real-world metres so textures tile at a constant size
const TILE = 1.6;
function boxUV(geo, w, h, d) {
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const [a, b] = nx > .5 ? [d, h] : ny > .5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * a / TILE, uv.getY(i) * b / TILE);
  }
  return geo;
}
function scaleUV(geo, su, sv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; }

/* ---------- primitives ---------- */
function add(parent, mesh, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
const box = (p, w, h, d, m, x, y, z) => add(p, new THREE.Mesh(boxUV(new THREE.BoxGeometry(w, h, d), w, h, d), m), x, y, z);
const cyl = (p, rt, rb, h, s, m, x, y, z) => add(p, new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(rt, rb, h, s), Math.PI * (rt + rb) / TILE, h / TILE), m), x, y, z);
function group(parent, x = 0, y = 0, z = 0, ry = 0, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g); return g; }

// hip roof (pagoda / keep tiers)
function hipRoof(p, w, d, h, y) {
  const geo = new THREE.CylinderGeometry(.06, .7071, 1, 4, 1); geo.rotateY(Math.PI / 4);
  scaleUV(geo, 2 * (w + d) / TILE, Math.hypot(h, Math.max(w, d) / 2) / TILE); geo.scale(w, h, d);
  add(p, new THREE.Mesh(geo, M.roof()), 0, y + h / 2, 0);
  box(p, w * 1.04, .16, d * 1.04, M.roof(), 0, y + .06, 0);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const t = box(p, 1.1, .14, .3, M.roof(), sx * w * .52, y + .28, sz * d * .52);
    t.rotation.y = -Math.atan2(sz * d, sx * w); t.rotation.z = .32;
  });
}
// gable roof with a long ridge along x — runnable
function gableRoof(p, w, d, h, y) {
  const s = new THREE.Shape(); s.moveTo(-d / 2 - .4, 0); s.lineTo(d / 2 + .4, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w * 1.08, bevelEnabled: false }); scaleUV(geo, 1 / TILE, 1 / TILE); geo.translate(0, 0, -w * .54); geo.rotateY(Math.PI / 2);
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
    box(g, .7, .55, .06, M.window(), 0, y + h * .55, w * .31 + .1);
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
    for (let k = -1; k <= 1; k++) box(g, .9, .8, .06, M.window(), k * w * .28, y + h * .55, w * .4 + .1);
    hipRoof(g, w * 1.25, w * 1.05, 2, y + h);
    y += h + 1.2;
  });
  [-1, 1].forEach(sx => { const f = box(g, .5, 1.2, .3, M.gold(), sx * 2.2, y + .6, 0); f.rotation.z = sx * -.4; });
  return g;
}

export function house(parent, x, z, w, d, h, ry = 0) {
  const g = group(parent, x, 0, z, ry);
  box(g, w, h, d, M.wall(), 0, h / 2, 0);
  box(g, w * .98, h * .32, d + .18, M.plaster(), 0, h * .74, 0);
  if (rnd() < .75) box(g, w * .25, h * .28, .06, M.window(), R(-w * .25, w * .25), h * .36, d / 2 + .08);
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

/* ---------- sakura: organic trunks + blossom-card canopies ---------- */
// every tree registers its blossom cards here; one instanced canopy is built at the end
const blossomCards = [];
function tube(g, pts, r0, r1, m) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const seg = 10, rad = 6, geo = new THREE.TubeGeometry(curve, seg, r0, rad, false);
  const pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {                        // taper from r0 to r1 along the branch
    curve.getPointAt(i / seg, c); const k = THREE.MathUtils.lerp(1, r1 / r0, i / seg);
    for (let j = 0; j <= rad; j++) { const id = i * (rad + 1) + j; v.fromBufferAttribute(pos, id).sub(c).multiplyScalar(k).add(c); pos.setXYZ(id, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  return add(g, new THREE.Mesh(geo, m));
}
export function sakura(parent, x, y, z, s = 1) {
  const g = group(parent, x, y, z, R(0, 6), s);
  const bark = mat('bark', '#2a1a16', { roughness: .92 });
  const lean = R(-.45, .45);
  tube(g, [[0, 0, 0], [lean * .3, 1.2, .1], [lean * .7, 2.4, -.08], [lean, 3.1, 0]], .3, .15, bark);
  const tips = [[lean, 3.7, 0]];
  const nb = 5 + Math.floor(rnd() * 2);
  for (let b = 0; b < nb; b++) {
    const a = b / nb * Math.PI * 2 + R(-.3, .3), len = R(1.6, 2.7), up = R(.5, 1.4), sy = R(2.3, 3.05);
    const start = [lean * (sy / 3.1), sy, 0];
    const end = [start[0] + Math.cos(a) * len, sy + up, Math.sin(a) * len];
    tube(g, [start, [start[0] + Math.cos(a) * len * .5, sy + up * .7, Math.sin(a) * len * .5], end], .12, .035, bark);
    tips.push(end);
  }
  g.updateWorldMatrix(true, false);
  tips.forEach(tp => {
    for (let i = 0; i < 24; i++) {
      const v = new THREE.Vector3(tp[0] + R(-1.15, 1.15), tp[1] + R(-.55, .85), tp[2] + R(-1.15, 1.15));
      g.localToWorld(v);
      blossomCards.push({ p: v, s: R(.9, 1.55) * s, r: [R(0, 6), R(0, 6), R(0, 6)] });
    }
  });
  return g;
}
function blossomTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const pinks = ['#ffe3ea', '#f9bccb', '#f3a2b8', '#fff1f4', '#ea8ea8'];
  for (let i = 0; i < 90; i++) {
    const x = 128 + (Math.random() - .5) * 200, y = 128 + (Math.random() - .5) * 200, r = 7 + Math.random() * 12;
    if (Math.hypot(x - 128, y - 128) > 112) continue;
    g.fillStyle = pinks[i % pinks.length];
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + i; g.beginPath(); g.ellipse(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, r * .52, r * .34, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#b8466a'; g.beginPath(); g.arc(x, y, r * .17, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function buildBlossoms(parent) {
  if (!blossomCards.length) return;
  const m = new THREE.MeshStandardMaterial({ map: blossomTexture(), alphaTest: .4, side: THREE.DoubleSide, roughness: .8, emissive: new THREE.Color('#6a2236'), emissiveIntensity: .45 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = grassTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 bwp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      transformed.x += sin(uTime * 1.1 + bwp.x * .4 + bwp.y) * .06;
      transformed.y += cos(uTime * 1.4 + bwp.z * .5) * .04;`);
  };
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, blossomCards.length);
  const o = new THREE.Object3D();
  blossomCards.forEach((c, i) => { o.position.copy(c.p); o.rotation.set(...c.r); o.scale.setScalar(c.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.frustumCulled = false;
  parent.add(im);
}

// tatami floor: 2:1 rush mats in a staggered layout, woven straw with dark cloth borders (heri)
function tatamiTex() {
  const PX = 96, Wm = 12, Dm = 9, c = document.createElement('canvas');
  c.width = Wm * PX; c.height = Dm * PX;
  const x = c.getContext('2d'), mw = 1.82 * PX, mh = .91 * PX;
  x.fillStyle = '#a3955c'; x.fillRect(0, 0, c.width, c.height);
  for (let row = 0; row * mh < c.height; row++) {
    for (let col = -1; col * mw < c.width + mw; col++) {
      const ox = col * mw + (row % 2 ? mw / 2 : 0), oy = row * mh;
      const tone = 0.9 + Math.random() * .16;               // each mat aged a little differently
      x.fillStyle = `rgb(${163 * tone | 0},${149 * tone | 0},${92 * tone | 0})`; x.fillRect(ox, oy, mw, mh);
      x.strokeStyle = 'rgba(70,60,30,.22)'; x.lineWidth = 1;
      for (let k = 2; k < mw; k += 3) { x.beginPath(); x.moveTo(ox + k, oy); x.lineTo(ox + k, oy + mh); x.stroke(); }
      x.fillStyle = '#2a2217';
      x.fillRect(ox, oy, mw, 5); x.fillRect(ox, oy + mh - 5, mw, 5);   // heri along the long sides
      x.fillStyle = 'rgba(30,22,12,.6)'; x.fillRect(ox, oy, 1.5, mh);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function scrollTex(ch) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 640;
  const x = c.getContext('2d');
  x.fillStyle = '#5a3a24'; x.fillRect(0, 0, 256, 640);                       // silk mounting
  x.fillStyle = '#e9dcbc'; x.fillRect(28, 70, 200, 470);                       // paper
  x.fillStyle = '#7a2a20'; x.fillRect(28, 70, 200, 10); x.fillRect(28, 530, 200, 10);
  x.fillStyle = '#1a120c'; x.font = '700 150px "Shippori Mincho", "Hiragino Mincho ProN", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 128, 280);
  x.fillStyle = '#b3241c'; x.fillRect(150, 440, 34, 34);                       // hanko seal
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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
function grassField(parent, cx, cz, w, d, n, color = '#2a1a14', hMin = .35, hMax = 1.1, hole = null) {
  n = Math.round(n * 1.8);
  // fine curved blades: dark at the root, warm sunlit gold at the tip
  const base = new THREE.Color(color).lerp(new THREE.Color('#1c1f10'), .5), tip = base.clone().lerp(new THREE.Color('#c4a25a'), .78);
  const geo = new THREE.PlaneGeometry(.055, 1, 1, 5); geo.translate(0, .5, 0);
  const pos = geo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - y * .9)); pos.setZ(i, y * y * .22);
    c.copy(base).lerp(tip, Math.pow(y, 1.3)); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .85 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = grassTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 gwp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float gs = sin(uTime * 1.6 + gwp.x * .35 + gwp.z * .21) * .3 + sin(uTime * 3.3 + gwp.x * 1.3) * .06;
      transformed.x += gs * position.y * position.y;
      transformed.z += gs * .4 * position.y * position.y;`);
  };
  const im = new THREE.InstancedMesh(geo, m, n);
  const o = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    o.position.set(cx + R(-w / 2, w / 2), 0, cz + R(-d / 2, d / 2));
    o.rotation.set(R(-.18, .18), R(0, Math.PI * 2), R(-.12, .12));
    // a trampled clearing (e.g. the duel circle) keeps only short stubble
    const inHole = hole && Math.hypot(o.position.x - hole.x, o.position.z - hole.z) < hole.r;
    o.scale.set(R(.7, 1.3), R(hMin, hMax) * (inHole ? .22 : 1), 1);
    o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    tint.setHSL(R(-.02, .04), R(.0, .25), R(.38, .6)); im.setColorAt(i, tint.multiplyScalar(1.9));
  }
  im.receiveShadow = true; parent.add(im);
  return im;
}

function bambooTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, '#2c4a26'); gr.addColorStop(.45, '#6f8e4a'); gr.addColorStop(1, '#253f22');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
  for (let y = 0; y < 256; y += 64) { g.fillStyle = 'rgba(20,30,14,.85)'; g.fillRect(0, y, 32, 3); g.fillStyle = 'rgba(190,200,140,.35)'; g.fillRect(0, y + 3, 32, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6);
  return t;
}
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, L = 70 + Math.random() * 50, w = 7 + Math.random() * 5;
    g.save(); g.translate(128, 70); g.rotate(a + Math.PI / 2);
    g.fillStyle = ['#3d6a2c', '#4f7d34', '#2f5524', '#648f3e'][i % 4];
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, L * .45, 0, L); g.quadraticCurveTo(-w, L * .45, 0, 0); g.fill();
    g.strokeStyle = 'rgba(20,40,14,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, L - 4); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bambooGrove(parent, cx, cz, rIn, rOut, n) {
  const geo = new THREE.CylinderGeometry(.075, .095, 1, 8, 1); geo.translate(0, .5, 0);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: bambooTexture(), roughness: .55 }), n);
  const CL = 4;                                            // leaf clusters per stalk (each a crossed pair)
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .75 }), n * CL * 2);
  const o = new THREE.Object3D(), data = [], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = R(0, Math.PI * 2), r = R(rIn, rOut);
    const cls = Array.from({ length: CL }, () => ({ f: R(.62, .98), dx: R(-.8, .8), dz: R(-.8, .8), ry: R(0, Math.PI), tilt: R(-.4, .4) }));
    data.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, h: R(8, 15), ph: R(0, 6), tx: R(-.05, .05), tz: R(-.05, .05), cls });
  }
  im.castShadow = true; parent.add(im); parent.add(leaves);
  function update(t) {
    let k = 0;
    data.forEach((b, i) => {
      const sw = Math.sin(t * .9 + b.ph) * .035;
      o.position.set(b.x, 0, b.z); o.rotation.set(b.tx + sw * .5, 0, b.tz + sw); o.scale.set(1, b.h, 1);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      const rot = o.rotation.clone();
      b.cls.forEach(c => {
        v.set(0, b.h * c.f, 0).applyEuler(rot);
        for (let x = 0; x < 2; x++) {
          o.position.set(b.x + v.x + c.dx, v.y, b.z + v.z + c.dz);
          o.rotation.set(c.tilt, c.ry + x * Math.PI / 2, rot.z); o.scale.set(1, 1, 1);
          o.updateMatrix(); leaves.setMatrixAt(k++, o.matrix);
        }
      });
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

  const sun = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a2a').multiplyScalar(1.8), fog: false, toneMapped: false, transparent: true, depthWrite: false }));
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
  return { sky, clouds, sun, skyMat: m };
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
  const { sky, clouds, sun, skyMat } = makeSky(scene);
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
  gg.computeVertexNormals(); scaleUV(gg, 1800 / 7, 1400 / 7);
  const ground = new THREE.Mesh(gg, pbr('ground', 'aerial_grass_rock', '#6a5a50', { roughness: .95 }));
  ground.receiveShadow = true; world.add(ground);

  // distant mountains: three ridgelines fading into haze with distance (atmospheric perspective)
  const ridgeMats = [];
  const vnoise = x => { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; };
  const fbm = x => { let v = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { v += a * (1 - Math.abs(vnoise(x * f) * 2 - 1)); a *= .5; f *= 2.1; } return v; };
  [[720, 20, 55, '#1a0b18', '#5c2030', 3.1], [860, 35, 85, '#2a1328', '#73303a', 11.7], [1000, 55, 120, '#3c1d34', '#94463f', 23.3]].forEach(([rad, hb, ha, top, bot, seed]) => {
    const N = 260, pos = [], col = [], idx = [], ct = new THREE.Color(top), cb = new THREE.Color(bot);
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI * 1.02 + (Math.PI * 1.04) * i / N, h = hb + ha * Math.pow(fbm(i * .045 + seed), 1.6) * 1.5;
      const x = 260 + Math.cos(a) * rad, z = -80 + Math.sin(a) * rad;
      pos.push(x, -60, z, x, h, z); col.push(cb.r, cb.g, cb.b, ct.r, ct.g, ct.b);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
    ridgeMats.push(m); world.add(new THREE.Mesh(geo, m));
  });
  const fuji = new THREE.Mesh(new THREE.ConeGeometry(300, 260, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#341a2e', fog: false }));
  fuji.position.set(160, 95, -820); world.add(fuji);
  // snowcap sits a few metres proud of the slope (a coincident surface flickers)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(85, 73, 24), new THREE.MeshBasicMaterial({ color: '#c9a5a8', fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  cap.position.set(160, 191, -820); world.add(cap);

  const anchors = {};

  // background-loaded CC0 props; each call clones the cached model
  const gl = new GLTFLoader(), propCache = {};
  function prop(name, parent, pos, ry = 0, scale = 1, tweak) {
    const p = propCache[name] || (propCache[name] = new Promise(res => gl.load(`assets/env/models/${name}/${name}.gltf`, g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = 8; } });
      res(g.scene);
    }, undefined, () => res(null))));
    p.then(src => {
      if (!src) return;
      const o = src.clone(); o.position.set(...pos); o.rotation.y = ry; o.scale.setScalar(scale);
      if (tweak) tweak(o);
      parent.add(o);
    });
  }
  const rocks = (parent, list) => list.forEach(([x, z, s, ry, y = 0]) => prop('rock_moss_set_01', parent, [x, y, z], ry, s));

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
      box(seg, b - a, 1.2, 2.75, M.plaster(), 0, WH - .9, 0);
      gableRoof(seg, b - a, 2.6, 1.3, WH);
      for (let x = a + 6; x < b - 3; x += 12) box(seg, .7, .5, .05, M.window(), x - (a + b) / 2, WH * .5, 1.24);
    });
    rocks(g, [[3.5, -2.5, .9, .2, 6], [-3.8, 1.5, .7, 2, 6], [-1, -4.5, .6, 4, 6]]);
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
    box(g, 12, .02, 9, new THREE.MeshStandardMaterial({ map: tatamiTex(), roughness: .88 }), 0, .51, -1);
    for (const [x, z] of [[-8, -7], [8, -7], [-8, 7], [8, 7], [0, -7], [-8, 0], [8, 0], [-4, 7], [4, 7]]) cyl(g, .26, .28, 5, 8, M.woodDark(), x, 2.75, z);
    hipRoof(g, 20, 18, 3.6, 5.2);
    box(g, 17.4, .2, 15.4, M.woodDark(), 0, 5.12, 0);

    const paper = new THREE.MeshStandardMaterial({ color: '#f3ddb1', emissive: new THREE.Color('#ffb35a'), emissiveIntensity: .55, transparent: true, opacity: .86, side: THREE.DoubleSide, depthWrite: false });
    const wall = (w, x, z, ry) => {
      const s = group(g, x, .5, z, ry);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.6), paper); p.position.y = 2.3; s.add(p);
      for (let k = -w / 2; k <= w / 2 + .01; k += 1) box(s, .07, 4.6, .09, M.woodDark(), k, 2.3, 0);
      for (let k = .2; k <= 4.6; k += .78) box(s, w, .07, .09, M.woodDark(), 0, k, 0);
    };
    wall(16, 0, -7, 0); wall(14, -8, 0, Math.PI / 2); wall(14, 8, 0, Math.PI / 2);
    // lantern key light: in front of and beside her (directly overhead it burnt out her face)
    const light = new THREE.PointLight('#ffb064', 26, 26, 2); light.position.set(3.2, 3.3, 2.6); g.add(light);
    // andon floor lanterns: paper glowing softly inside a dark wooden frame
    const andon = glow('andon', '#ffa552', 1.15);
    [[-6.6, -6], [6.6, -6], [-6.6, 4.5]].forEach(([x, z]) => {
      box(g, .38, .62, .38, andon, x, .86, z);
      for (const [dx, dz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) box(g, .04, .78, .04, M.woodDark(), x + dx, .89, z + dz);
      box(g, .46, .04, .46, M.woodDark(), x, 1.27, z);
    });
    // hanging scroll (kakejiku) with the dojo's character
    const scroll = group(g, -7.85, .5, -2.2, Math.PI / 2);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(.9, 2.3), new THREE.MeshStandardMaterial({ map: scrollTex('道'), roughness: .95 }));
    sp.position.set(0, 2.55, .03); scroll.add(sp);
    cyl(scroll, .035, .035, 1.05, 8, M.woodDark(), 0, 3.72, .03).rotation.z = Math.PI / 2;
    cyl(scroll, .045, .045, 1.05, 8, M.woodDark(), 0, 1.38, .03).rotation.z = Math.PI / 2;
    // photoscanned katana stand + antique katana (Poly Haven, CC0), loaded in the background
    prop('katana_stand_01', g, [-6.2, .5, -4.6], Math.PI / 2 + .35, 1.2);   // weapon rack by the wall
    for (let i = 0; i < 6; i++) sakura(world, D.x + R(-22, 22), 0, D.z + R(-22, -12), R(.8, 1.1));
    for (let i = 0; i < 4; i++) stoneLantern(world, D.x + (i < 2 ? -11 : 11), D.z + 9 + (i % 2) * 5, 1);
    anchors.dojo = { samurai: new THREE.Vector3(D.x, .5, D.z - 1.4), sneak: { z: D.z - 9.6, from: D.x - 14, to: D.x + 14 }, light, paper };
  }

  /* --- 武 training ground in a bamboo grove --- */
  let grove;
  {
    const T = ST.train, g = group(world, T.x, 0, T.z);
    grove = bambooGrove(world, T.x - 3, T.z - 6, 17, 36, mobile ? 140 : 260);
    // the ninja trains on a patch of trampled ground, facing a row of straw targets
    const NX = -7, NZ = .5;
    grassField(g, -3, 0, 26, 22, mobile ? 500 : 1100, '#1f1c12', .15, .5, { x: NX, z: NZ, r: 2.6 });
    const targets = [];
    for (let i = 0; i < 5; i++) {
      const z = -4.2 + i * 2.1, x = -2.2 + Math.abs(i - 2) * .55;
      const t = makiwara(g, x, z, Math.atan2(NX - x, NZ - z));          // straw face turned to the ninja
      targets.push({ group: t, center: new THREE.Vector3(T.x + x, 1.75, T.z + z) });
    }
    prop('katana_stand_01', g, [NX - 2.2, 0, NZ - 2.4], .7, 1.15);
    // lanterns stay behind the training patch (one close to the lens just blooms into a blob)
    [[-12.5, -7.5], [-3.5, -9.5], [3.5, -7], [-14, 6.5]].forEach(([x, z]) => stoneLantern(g, x, z, 1));
    rocks(g, [[-11.5, -3.5, 1.4, .4], [-13, 3.5, 1.1, 2], [2.5, -9, 1.6, 1], [-4, 7.5, 1.2, 4], [6, 4, .9, 3]]);
    anchors.train = { ninja: new THREE.Vector3(T.x + NX, 0, T.z + NZ), targets };
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
          if (wx >= s.a && wx <= s.b) return { y: s.y, u: -1, into: wx - s.a, outOf: s.b - wx };
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
    box(g, 2.6, .1, N * step + 10, mat('path', '#4a3f3a'), 0, .07, -N * step / 2 + 4);
    for (let i = 0; i < N; i += 3) { stoneLantern(g, -2.6, -i * step - 1.2, .8); stoneLantern(g, 2.6, -i * step - 1.2, .8); }
    for (let i = 0; i < 14; i++) sakura(g, (i % 2 ? 1 : -1) * R(6, 11), 0, -i * 5 + R(-2, 2), R(.8, 1.2));
    grassField(g, 0, -N * step / 2, 26, N * step + 20, mobile ? 700 : 1600, '#1b1110', .2, .7);
    anchors.road = { x: Rd.x, z0: Rd.z + 3, z1: Rd.z - N * step + 2 };
  }

  /* --- 決 duel field --- */
  {
    const Du = ST.duel, g = group(world, Du.x, 0, Du.z);
    torii(g, 0, -34, 2.3);
    grassField(g, 0, -8, 70, 50, mobile ? 1600 : 4200, '#140708', .3, 1.0, { x: 0, z: 0, r: 7 });
    for (let i = 0; i < 6; i++) sakura(g, R(-30, 30), 0, R(-50, -22), R(1, 1.4));
    rocks(g, [[-9, -6, 1.8, .3], [11, -9, 2.2, 2.2], [-4, -18, 2.6, 1.4], [16, 2, 1.4, 5]]);
    anchors.duel = { y: 0, z: Du.z, x: Du.x };
  }

  buildBlossoms(world);
  const petals = makePetals(scene, mobile ? 160 : 380);
  const lampMat = M.lamp();

  return {
    anchors, sky, sun, skyMat,
    update(t, dt, cam, focus, look) {
      if (look) ridgeMats.forEach(m => m.color.copy(look.horizon).lerp(WHITE, .55));
      sky.position.copy(cam.position);
      grassTime.value = t;
      clouds.forEach((c, i) => { c.position.x += Math.sin(t * .05 + i) * .02; });
      lampMat.emissiveIntensity = 3 + Math.sin(t * 9) * .25 + Math.sin(t * 23) * .15;
      if (anchors.dojo) anchors.dojo.light.intensity = 25 + Math.sin(t * 11) * 2 + Math.sin(t * 27) * 1.4;
      if (focus === 'arsenal' || focus === 'about' || focus === 'work') grove.update(t);
      petals.update(t, dt, cam);
    }
  };
}
