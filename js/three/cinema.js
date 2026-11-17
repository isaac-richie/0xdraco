/* ==========================================================================
   cinema.js — the "film look": post-processing stack, image-based lighting,
   per-scene colour grades and atmosphere (mist, embers, fireflies, rain,
   light shafts).
   ========================================================================== */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const { lerp, clamp } = THREE.MathUtils;

/* ---------- final grade: sun rays, lens fringing, contrast, saturation, vignette, grain ---------- */
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, sun: { value: new THREE.Vector2(.5, .5) }, sunVis: { value: 0 },
    rays: { value: 1 }, contrast: { value: .12 }, brightness: { value: 0 }, saturation: { value: .08 },
    vignette: { value: .62 }, grain: { value: .07 }, fringe: { value: .0016 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, sunVis, rays, contrast, brightness, saturation, vignette, grain, fringe; uniform vec2 sun;
    varying vec2 vUv;
    float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 37.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - .5;
      // lens fringing toward the frame edges
      vec2 off = d * fringe * (1.0 + dot(d, d) * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      // screen-space light scattering from the sun (bright sky streams past dark silhouettes)
      if (rays * sunVis > .01) {
        vec2 dir = (vUv - sun) / 28.0; vec2 uv = vUv; float decay = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < 28; i++) {
          uv -= dir;
          vec3 s = texture2D(tDiffuse, uv).rgb;
          acc += max(s - .55, 0.0) * decay; decay *= .93;
        }
        col += acc * .085 * rays * sunVis * vec3(1.0, .82, .62);
      }
      col += brightness;
      col = (col - .5) * (1.0 + contrast) + .5;
      col = mix(vec3(luma(col)), col, 1.0 + saturation);
      col *= mix(1.0, smoothstep(.95, .2, length(d * vec2(1.15, 1.0))), vignette);
      col += (hash(vUv * 1000.0) - .5) * grain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`
};

/* ---------- post-processing ---------- */
export function createPipeline(renderer, scene, camera, sun, { mobile }) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = mobile ? null : new BokehPass(scene, camera, { focus: 8, aperture: .0004, maxblur: .006 });
  if (bokeh) composer.addPass(bokeh);
  const ub = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .85, .62, .78);
  composer.addPass(ub);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);
  if (!mobile) composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));
  const U = film.uniforms;

  const sp = new THREE.Vector3(), ndc = new THREE.Vector3();
  return {
    composer,
    // small facades so the director code can stay effect-agnostic
    bloom: { set intensity(v) { ub.strength = v * .78; }, get intensity() { return ub.strength / .78; } },
    bc: { set contrast(v) { U.contrast.value = v; }, set brightness(v) { U.brightness.value = v; } },
    hs: { set saturation(v) { U.saturation.value = v; } },
    godRays: { blendMode: { opacity: U.rays } },
    setSize(w, h) { composer.setSize(w, h); ub.resolution.set(w / 2, h / 2); },
    render(dt) {
      U.time.value += dt;
      // where is the sun on screen, and is it in front of us?
      sun.getWorldPosition(sp); ndc.copy(sp).project(camera);
      const facing = ndc.z < 1 ? 1 : 0;
      U.sun.value.set(ndc.x * .5 + .5, ndc.y * .5 + .5);
      U.sunVis.value = facing * clamp(1.6 - Math.hypot(ndc.x, ndc.y) * .8, 0, 1);
      composer.render(dt);
    },
    // auto-focus on a world point; shallower for close subjects
    focus(p, range = 4, b = 2.6) {
      if (!bokeh) return;
      const dist = camera.position.distanceTo(p);
      bokeh.uniforms.focus.value = dist;
      bokeh.uniforms.aperture.value = .00055 * b / Math.max(range, 1.5);
      bokeh.uniforms.maxblur.value = .0045 + b * .0008;
    }
  };
}

/* ---------- image-based lighting from the sunset HDRI ---------- */
export function loadHDRI(renderer, scene, url, intensity = .55) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load(url, tex => {
    const env = pmrem.fromEquirectangular(tex).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    tex.dispose(); pmrem.dispose();
  });
}

/* ---------- per-scene looks (blended as the camera travels) ---------- */
export const LOOKS = {
  hero:    { top: '#06071a', mid: '#2b1238', horizon: '#d0452a', glow: '#ff9a4d', fog: '#3a1526', fogD: .0105, sun: '#ff9a5c', sunI: 2.8, hemi: 1.0, env: .55, exp: 1.0, sat: .1,  con: .14, rays: 1 },
  about:   { top: '#05060f', mid: '#1c1030', horizon: '#9a3a2a', glow: '#ff9a4d', fog: '#1c0f18', fogD: .014,  sun: '#ffb070', sunI: 1.2, hemi: .55, env: .35, exp: 1.05, sat: .05, con: .16, rays: 0 },
  arsenal: { top: '#0a0b16', mid: '#3a2034', horizon: '#e0703a', glow: '#ffb060', fog: '#4a2a22', fogD: .016,  sun: '#ffb468', sunI: 3.4, hemi: .8,  env: .5,  exp: 1.05, sat: .12, con: .12, rays: 1.4 },
  work:    { top: '#020412', mid: '#0b1636', horizon: '#3a3a6a', glow: '#7a8cff', fog: '#0e1430', fogD: .012,  sun: '#9db0ff', sunI: 1.1, hemi: .55, env: .3,  exp: 1.15, sat: -.05, con: .18, rays: .25 },
  journey: { top: '#05040f', mid: '#22102e', horizon: '#7a2a3a', glow: '#ff7a5a', fog: '#24101c', fogD: .013,  sun: '#ff8a6a', sunI: 1.6, hemi: .6,  env: .4,  exp: 1.08, sat: .08, con: .15, rays: .5 },
  duel:    { top: '#14040a', mid: '#4a0e18', horizon: '#ff4a22', glow: '#ffb070', fog: '#4a1418', fogD: .0095, sun: '#ff7a48', sunI: 3.2, hemi: .9,  env: .6,  exp: 1.0, sat: .14, con: .2,  rays: 1.6 }
};
const C = {};
for (const k in LOOKS) C[k] = Object.fromEntries(Object.entries(LOOKS[k]).map(([p, v]) => [p, typeof v === 'string' ? new THREE.Color(v) : v]));
export function blendLook(a, b, t) {
  const A = C[a], B = C[b] || A, o = {};
  for (const p in A) o[p] = A[p].isColor ? A[p].clone().lerp(B[p], t) : lerp(A[p], B[p], t);
  return o;
}

/* ---------- atmosphere ---------- */
function softTexture(size = 128, kind = 'blob') {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  if (kind === 'blob') {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, size, size);
  } else {                                   // wispy mist: layered soft blobs
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * size, y = size * (.3 + Math.random() * .4), rr = size * (.08 + Math.random() * .18);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, size, size);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createAtmosphere(scene, { mobile }) {
  const group = new THREE.Group(); scene.add(group);
  const blob = softTexture(64, 'blob'), wisp = softTexture(256, 'mist');

  // drifting ground mist cards around the camera
  const mistMat = new THREE.MeshBasicMaterial({ map: wisp, transparent: true, depthWrite: false, opacity: .5, color: '#ffd8c0', fog: true });
  const mists = [];
  for (let i = 0; i < (mobile ? 10 : 22); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), mistMat);
    m.userData = { a: Math.random() * Math.PI * 2, r: 6 + Math.random() * 22, y: .3 + Math.random() * 1.6, s: .02 + Math.random() * .04 };
    group.add(m); mists.push(m);
  }

  // embers / fireflies: additive points that drift up and flicker
  function sparkField(n, color, size) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 40; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = (Math.random() - .5) * 40; seed[i] = Math.random() * 100; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: blob, color: new THREE.Color(color).multiplyScalar(3), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; group.add(pts);
    return { pts, pos, seed, n };
  }
  const embers = sparkField(mobile ? 120 : 260, '#ff8a3a', .12);
  const flies = sparkField(mobile ? 50 : 110, '#c8ff8a', .16);

  // rain: streaks that fall around the camera (duel)
  const RN = mobile ? 700 : 1800;
  const rgeo = new THREE.BufferGeometry(), rpos = new Float32Array(RN * 6), rvel = new Float32Array(RN);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - .5) * 40, y = Math.random() * 18, z = (Math.random() - .5) * 40; rpos.set([x, y, z, x - .05, y - .5, z], i * 6); rvel[i] = 16 + Math.random() * 8; }
  rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: '#c8d4ff', transparent: true, opacity: 0, depthWrite: false }));
  rain.frustumCulled = false; group.add(rain);

  // light shafts: soft additive cones (dojo / bamboo)
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#ffc890', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const shafts = new THREE.Group(); group.add(shafts);
  function addShafts(origin, dir, count, spread, len = 14, width = .6) {
    for (let i = 0; i < count; i++) {
      const g = new THREE.CylinderGeometry(width * .3, width, len, 10, 1, true); g.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(g, shaftMat);
      m.position.copy(origin).add(new THREE.Vector3((Math.random() - .5) * spread, 0, (Math.random() - .5) * spread));
      m.lookAt(m.position.clone().add(dir)); m.rotateX(Math.PI / 2);
      shafts.add(m);
    }
  }

  const tmp = new THREE.Vector3();
  return {
    group, addShafts,
    update(t, dt, cam, look, weather) {
      // mist
      mists.forEach(m => {
        const u = m.userData; u.a += u.s * dt;
        m.position.set(cam.position.x + Math.cos(u.a) * u.r, u.y, cam.position.z + Math.sin(u.a) * u.r - 6);
        m.lookAt(cam.position.x, m.position.y, cam.position.z);
      });
      mistMat.opacity = weather.mist; mistMat.color.copy(look.fog).multiplyScalar(2.2).lerp(new THREE.Color('#ffffff'), .25);
      // embers rise, fireflies wander
      [[embers, weather.embers, 1.2], [flies, weather.flies, .25]].forEach(([f, amt, rise]) => {
        f.pts.material.opacity = amt; f.pts.visible = amt > .01;
        if (!f.pts.visible) return;
        for (let i = 0; i < f.n; i++) {
          const s = f.seed[i];
          let y = f.pos[i * 3 + 1] + rise * dt * (.5 + (s % 1));
          if (y > 12) y = 0;
          f.pos[i * 3 + 1] = y;
          f.pos[i * 3] += Math.sin(t * .7 + s) * dt * .4; f.pos[i * 3 + 2] += Math.cos(t * .5 + s) * dt * .4;
        }
        f.pts.geometry.attributes.position.needsUpdate = true;
        f.pts.position.set(cam.position.x, cam.position.y - 6, cam.position.z - 10);
        f.pts.material.size = (f === flies ? .16 : .12) * (.8 + .4 * Math.sin(t * 9));
      });
      // rain
      rain.material.opacity = weather.rain * .55; rain.visible = weather.rain > .01;
      if (rain.visible) {
        for (let i = 0; i < RN; i++) {
          let y = rpos[i * 6 + 1] - rvel[i] * dt;
          if (y < 0) y += 18;
          rpos[i * 6 + 1] = y; rpos[i * 6 + 4] = y - .55;
        }
        rgeo.attributes.position.needsUpdate = true;
        rain.position.set(cam.position.x, cam.position.y - 8, cam.position.z - 6);
      }
      shaftMat.opacity = weather.shafts * (.07 + .015 * Math.sin(t * 1.3));
      shafts.visible = weather.shafts > .01;
    }
  };
}
