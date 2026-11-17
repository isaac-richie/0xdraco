/* ==========================================================================
   scenes.js — one choreographed scene per section.
   Each scene returns { update(dt, time), active, ... } and is ticked by main.js
   only while it is on screen. Sound cues go through window.Sound.sfx (no-ops
   when sound is off).
   ========================================================================== */
(function () {
  const { Fighter, POSES, mix, el, lerp, clamp, ease, range, shurikenPath, dust } = Rig;
  const rand = (a, b) => a + Math.random() * (b - a);
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const sfx = new Proxy({}, { get: (_, k) => (...a) => window.Sound && Sound.sfx[k] && Sound.sfx[k](...a) });
  const Scenes = {};

  // emits afterimages at a fixed rate while `on`
  function ghoster(f, every = .045) {
    let acc = 0;
    return (dt, on, op = .3, life = .3) => { acc += dt; if (on && acc >= every) { acc = 0; f.ghost(op, life); } };
  }

  // radiating sparks on the fixed full-screen fx layer (screen coords)
  function screenSparks(x, y, n = 10, color = '#ffb27a') {
    const layer = document.querySelector('.slash-layer');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, L = rand(18, 54);
      const ln = el('line', { x1: x, y1: y, x2: x, y2: y, stroke: color, 'stroke-width': rand(1.2, 2.6), 'stroke-linecap': 'round' }, layer);
      gsap.to(ln, {
        attr: { x1: x + Math.cos(a) * L * .5, y1: y + Math.sin(a) * L * .5, x2: x + Math.cos(a) * L, y2: y + Math.sin(a) * L },
        opacity: 0, duration: rand(.3, .5), ease: 'power3.out', onComplete: () => ln.remove()
      });
    }
  }

  /* ------------------------------------------------------------------ 序 HERO
     Ninjas sprint the castle ridge and flip over the gap; crows cross the
     sun; the samurai on the cliff waits with his hand on the hilt and draws
     (iaido) when the page opens. */
  Scenes.hero = function () {
    const svg = document.querySelector('.hero-scene');
    const stars = svg.querySelector('#stars');
    for (let i = 0; i < 80; i++) {
      el('circle', {
        cx: rand(0, 1600).toFixed(0), cy: rand(0, 440).toFixed(0), r: rand(.5, 1.7).toFixed(2), fill: '#f3e9d6', class: 'star',
        style: `animation-delay:${rand(0, 4).toFixed(2)}s;animation-duration:${rand(2, 5).toFixed(2)}s`
      }, stars);
    }

    const RY = 566, GAP = [690, 840];
    const ridge = svg.querySelector('#ridge');
    const seg = (a, b) => {
      el('rect', { x: a, y: RY + 22, width: b - a, height: 340, fill: '#170a11' }, ridge);
      el('path', { d: `M${a - 28},${RY + 26} Q${a - 6},${RY + 12} ${a + 8},${RY + 3} L${b - 8},${RY + 3} Q${b + 6},${RY + 12} ${b + 28},${RY + 26} L${b + 8},${RY + 30} L${a - 8},${RY + 30} Z`, fill: '#1f0d16' }, ridge);
      for (let x = a + 10; x < b - 10; x += 14) el('rect', { x, y: RY + 7, width: 2, height: 19, fill: '#2d1521', opacity: .7 }, ridge);
      el('rect', { x: a, y: RY - 1, width: b - a, height: 6, rx: 2, fill: '#1f0d16' }, ridge);
      for (let x = a + 40; x < b - 30; x += 120) el('rect', { x, y: RY + 60, width: 16, height: 10, fill: '#ffb56b', opacity: .55, class: 'window' }, ridge);
    };
    seg(-60, GAP[0]); seg(GAP[1], 1700);

    const pg = svg.querySelector('#pagoda');
    let y = RY + 12; const cx = 1470;
    for (let i = 0; i < 5; i++) {
      const w = 150 - i * 20, h = 46 - i * 3;
      el('rect', { x: cx - w * .32, y: y - h, width: w * .64, height: h, fill: '#1a0b13' }, pg);
      el('path', { d: `M${cx - w / 2 - 16},${y - h + 7} Q${cx - w / 2 + 10},${y - h - 2} ${cx - w * .3},${y - h - 13} L${cx + w * .3},${y - h - 13} Q${cx + w / 2 - 10},${y - h - 2} ${cx + w / 2 + 16},${y - h + 7} Z`, fill: '#1a0b13' }, pg);
      y -= h + 11;
    }
    el('rect', { x: cx - 2, y: y - 62, width: 4, height: 74, fill: '#1a0b13' }, pg);
    for (let k = 0; k < 6; k++) el('rect', { x: cx - 7 + k * .6, y: y - 52 + k * 8, width: 14 - k * 1.2, height: 2.6, fill: '#1a0b13' }, pg);

    const grass = svg.querySelector('#grass');
    for (let x = 1158; x < 1610; x += 9) {
      const top = x < 1226 ? 760 - (x - 1158) * .8 : (x < 1400 ? 700 : 700 + (x - 1400) * .22);
      const h = rand(14, 40), lean = rand(-6, 8);
      el('path', { d: `M${x},${top + 4} q-2,${-h / 2} ${lean},${-h} q3,${h / 2} 5,${h} Z`, fill: '#0b0709', class: 'grass-blade', style: `animation-delay:${rand(0, 3).toFixed(2)}s` }, grass);
    }

    // crows crossing the sky
    const crowG = svg.querySelector('#crows');
    const crows = Array.from({ length: 4 }, (_, i) => ({
      p: el('path', { fill: 'none', stroke: '#12070d', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, crowG),
      x: 1700 + i * 260, y: rand(170, 420), s: rand(.7, 1.25), v: rand(70, 110), ph: rand(0, 6)
    }));

    const nLayer = svg.querySelector('#heroNinjas');
    const fxLayer = el('g', {}, nLayer);
    const ninjas = [
      new Fighter(nLayer, { type: 'ninja', scale: 1.05, ink: '#0e060b', eye: '#ffcf9e' }),
      new Fighter(nLayer, { type: 'ninja', scale: .9, ink: '#170a12', eye: '#ffcf9e' })
    ];
    const ghosts = ninjas.map(n => ghoster(n, .035));
    const air = [false, false];

    const samLayer = svg.querySelector('#heroSamurai');
    const sam = new Fighter(samLayer, { type: 'samurai', scale: 2.45, facing: -1, x: 1252, y: 702, ink: '#0b0709', wind: 1.15, weapon: 'none' });
    const samGhost = ghoster(sam, .03);
    let drawT = -1, glintIn = 6;

    const SPEED = 340, START = -90, END = 1690, DELAYS = [0, .55], PAUSE = 2.2;
    const travel = (END - START) / SPEED, period = travel + DELAYS[1] + PAUSE;
    let clock = 1.2, dir = 1, cycle = 0;
    const phases = [0, 1.3];

    function runNinja(n, i, dt) {
      const local = clock - DELAYS[i];
      if (local < 0 || local > travel) { n.root.style.display = 'none'; n.rot = 0; return; }
      n.root.style.display = '';
      let x = START + local * SPEED;
      if (dir < 0) x = END - (x - START);
      n.facing = dir; n.x = x; n.y = RY; n.tick(dt);
      phases[i] += dt * 15.5;
      let P = POSES.run(phases[i]);
      const a = GAP[0] - 55, b = GAP[1] + 55, inZone = x > a && x < b;
      n.rot = 0;
      if (inZone) {
        const u = (x - a) / (b - a), prog = dir > 0 ? u : 1 - u, h = Math.sin(Math.PI * u);
        if (!air[i]) { air[i] = true; sfx.whoosh(.12); }
        P = mix(P, POSES.leap(), clamp(h * 1.7, 0, 1));
        P.dy = -150 * 4 * u * (1 - u);
        if ((cycle + i) % 2 === 0) n.rot = 360 * ease.inOut(prog);
      } else if (air[i]) {
        air[i] = false;
        dust(fxLayer, x, RY, .8, '#2a1420');
      }
      n.render(P);
      ghosts[i](dt, inZone, .28, .28);
    }

    function updateSamurai(dt) {
      sam.tick(dt);
      let P;
      if (drawT < 0) P = POSES.hilt(sam.t);
      else {
        drawT += dt;
        const T = drawT;
        if (T < .45) P = mix(POSES.hilt(sam.t), { ...POSES.hilt(sam.t), lean: 12, tF: 26, kF: 22 }, ease.inOut(T / .45));
        else if (T < .56) {
          if (sam.weapon !== 'katana') { sam.setWeapon('katana'); }
          P = mix({ ...POSES.hilt(sam.t), lean: 12, tF: 26, kF: 22 }, POSES.iaiDraw(), ease.out((T - .45) / .11));
        } else if (T < 1.3) P = POSES.iaiDraw();
        else P = mix(POSES.iaiDraw(), POSES.idle(sam.t), ease.inOut(range(T, 1.3, 2.3)));
        samGhost(dt, T > .45 && T < .7, .35, .35);
        if (T >= .62 && T - dt < .62) sam.flash();
        if (T > 2.3) {
          glintIn -= dt;
          if (glintIn <= 0) { glintIn = rand(6, 10); sam.flash(); }
        }
      }
      sam.render(P);
    }

    function resize() {
      // phones: shift the camera down so the name sits on night sky, sun + samurai below it
      svg.setAttribute('viewBox', innerWidth < 760 ? '760 -360 760 1260' : '0 0 1600 900');
    }
    resize();
    addEventListener('resize', resize);

    return {
      active: true,
      drawSword() {
        if (drawT >= 0) return;
        drawT = 0;
        setTimeout(() => sfx.unsheathe(.42), 120);
      },
      update(dt) {
        clock += dt;
        if (clock > period) { clock = 0; dir *= -1; cycle++; }
        ninjas.forEach((n, i) => runNinja(n, i, dt));
        updateSamurai(dt);
        crows.forEach(c => {
          c.x -= c.v * dt; c.ph += dt * 9;
          if (c.x < -60) { c.x = 1700 + rand(0, 600); c.y = rand(150, 430); }
          const w = Math.sin(c.ph) * 7;
          c.p.setAttribute('d', `M-13,${(w - 2).toFixed(1)} Q-6,${(-4 + w * .35).toFixed(1)} 0,0 Q6,${(-4 + w * .35).toFixed(1)} 13,${(w - 2).toFixed(1)}`);
          c.p.setAttribute('transform', `translate(${c.x.toFixed(1)},${(c.y + Math.sin(c.ph * .2) * 6).toFixed(1)}) scale(${c.s})`);
        });
      }
    };
  };

  /* ------------------------------------------------------------------ 道 ABOUT
     Shadow play on a lantern-lit shoji: a samurai meditates in seiza while a
     ninja's shadow creeps past as you scroll. The samurai senses it. */
  Scenes.about = function () {
    const svg = document.querySelector('.shoji-scene');
    const C = '#2a170c';
    const ninja = new Fighter(svg.querySelector('#shojiFar'), { type: 'ninja', scale: 3.3, ink: C, accent: C, eye: C, y: 556, x: -180, wind: .4 });
    const sam = new Fighter(svg.querySelector('#shojiNear'), { type: 'samurai', scale: 2.7, ink: C, accent: C, gold: C, steel: C, weapon: 'none', cape: false, wind: 0, x: 168, y: 546 });
    const flick = svg.querySelector('.flicker');
    let prog = 0, cur = 0, lastX = -180, phase = 0, alert = 0, sensed = false;

    return {
      active: true,
      set progress(v) { prog = v; },
      update(dt, t) {
        cur = damp(cur, prog, 6, dt);
        const x = lerp(-200, 700, ease.inOut(range(cur, .15, .8)));
        const dx = x - lastX; lastX = x;
        phase += Math.abs(dx) * .045;
        if (dx < -.05) ninja.facing = -1; else if (dx > .05) ninja.facing = 1;
        ninja.x = x; ninja.tick(dt);
        ninja.render(POSES.sneak(phase));

        const near = clamp(1 - Math.abs(x - 200) / 210, 0, 1);
        alert = damp(alert, near, 4, dt);
        if (near > .6 && !sensed) { sensed = true; sfx.pluck(); }
        if (near < .1) sensed = false;
        sam.tick(dt);
        const P = mix(POSES.seiza(sam.t), POSES.hilt(sam.t), 0);
        P.head -= 18 * alert; P.lean -= 3 * alert; P.uB += 46 * alert; P.eB += 30 * alert;
        sam.render(P);
        flick.setAttribute('opacity', (.05 + .05 * Math.sin(t * 13) * Math.sin(t * 7.3)).toFixed(3));
      }
    };
  };

  /* ------------------------------------------------------------------ 武 ARSENAL
     A ninja crouched before the red moon throws a shuriken at each skill card
     as it scrolls in. The star streaks, sparks and sticks in the card. */
  Scenes.arsenal = function () {
    const svg = document.querySelector('.arsenal-scene');
    const ninja = new Fighter(svg.querySelector('#arsenalNinja'), { type: 'ninja', scale: 2.7, x: 182, y: 352, ink: '#0d0b0a', eye: '#ffd2a8', wind: .7 });
    const throwGhost = ghoster(ninja, .03);
    document.querySelectorAll('.stuck path').forEach(p => p.setAttribute('d', shurikenPath(17)));
    const queue = [];
    let throwT = -1, target = null, fired = false;

    function launch(card) {
      const hp = ninja.toScene(ninja.handLocal);
      const pt = svg.createSVGPoint(); pt.x = hp.x; pt.y = hp.y;
      let s = pt.matrixTransform(svg.getScreenCTM());
      const r = svg.getBoundingClientRect();
      if (r.bottom < 40 || r.top > innerHeight - 40) s = { x: -30, y: innerHeight * .45 };
      const tr = card.querySelector('.stuck').getBoundingClientRect();
      const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
      const star = el('svg', { class: 'flying-star', viewBox: '-20 -20 40 40' }, document.body);
      el('path', { d: shurikenPath(17) }, star);
      gsap.set(star, { x: s.x, y: s.y });
      sfx.whoosh(.32);
      let n = 0;
      gsap.to(star, {
        x: tx, y: ty, rotation: 1260, duration: .44, ease: 'power1.in',
        onUpdate() {
          if (n++ % 2) return;
          const g = star.cloneNode(true);
          g.style.opacity = .35; g.style.filter = 'none';
          document.body.appendChild(g);
          gsap.to(g, { opacity: 0, scale: .6, duration: .25, onComplete: () => g.remove() });
        },
        onComplete() {
          star.remove();
          card.classList.add('hit', 'impact');
          sfx.thunk(.5);
          screenSparks(tx, ty, 12);
          card.animate([{ translate: '0 0' }, { translate: '-7px 2px' }, { translate: '5px -1px' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 360, easing: 'ease-out' });
          setTimeout(() => card.classList.remove('impact'), 700);
        }
      });
    }

    return {
      active: true,
      throwAt(card) {
        if (card.classList.contains('hit') || card._queued) return;
        card._queued = true; queue.push(card);
      },
      update(dt) {
        ninja.tick(dt);
        if (throwT < 0 && queue.length) { target = queue.shift(); throwT = 0; fired = false; }
        let P = POSES.crouch(ninja.t);
        if (throwT >= 0) {
          throwT += dt;
          const T = throwT, W = POSES.throwWind(), R = POSES.throwRelease();
          if (T < .2) P = mix(P, W, ease.out(T / .2));
          else if (T < .32) P = mix(W, R, ease.out((T - .2) / .12));
          else if (T < .8) P = mix(R, P, ease.inOut((T - .32) / .48));
          else throwT = -1;
          if (!fired && T >= .27) { fired = true; launch(target); }
          throwGhost(dt, T > .18 && T < .36, .3, .25);
        }
        ninja.render(P);
      }
    };
  };

  /* ------------------------------------------------------------------ 戦 CAMPAIGNS
     A ninja runs beneath the horizontal project track at your scroll speed,
     turns when you scroll back, front-flips the stone lanterns at speed (and
     crouches on top of one if you stop mid-jump). */
  Scenes.work = function () {
    const track = document.querySelector('.track');
    const svg = document.querySelector('.runner');
    const groundPath = el('path', { fill: '#14110f' }, svg);
    const lanternsG = el('g', {}, svg);
    const fx = el('g', {}, svg);
    const ninja = new Fighter(svg, { type: 'ninja', scale: 1.25, ink: '#14110f', eye: '#efe6d3' });
    const ghost = ghoster(ninja, .04);
    let W = 0, G = 120, nx = 0, lanterns = [];
    let prevW = null, phase = 0, runAmt = 0, zone = null, latch = 1, flipK = 0, lastStep = 0;
    const LH = 45;

    function lantern(g) {
      el('path', { d: 'M-10,0 L10,0 L8,-4 L-8,-4 Z M-4,-4 L4,-4 L4,-16 L-4,-16 Z M-12,-16 L12,-16 L10,-20 L-10,-20 Z M-8,-20 L8,-20 L8,-31 L-8,-31 Z M-16,-31 Q0,-42 16,-31 L11,-35 Q0,-44 -11,-35 Z M-2,-40 L2,-40 L1,-46 L-1,-46 Z', fill: '#14110f' }, g);
      el('rect', { x: -4.5, y: -28, width: 9, height: 5.5, fill: '#e2482c' }, g);
    }

    function layout() {
      W = svg.clientWidth; const H = svg.clientHeight;
      if (!W) return;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      G = H - 30; nx = W * .14;
      groundPath.setAttribute('d', `M0,${G + 1} Q${W * .25},${G - 2} ${W * .5},${G + 1} T${W},${G} L${W},${G + 5} Q${W * .5},${G + 8} 0,${G + 6} Z`);
      lanternsG.innerHTML = ''; lanterns = [];
      const cards = [...track.children];
      for (let i = 0; i < cards.length - 1; i++) {
        const a = cards[i], b = cards[i + 1];
        const x = (a.offsetLeft + a.offsetWidth + b.offsetLeft) / 2;
        const g = el('g', {}, lanternsG); lantern(g);
        lanterns.push({ x, g });
      }
    }

    return {
      active: true,
      layout,
      update(dt) {
        if (!W) layout();
        if (!W) return;
        const tx = gsap.getProperty(track, 'x') || 0;
        lanterns.forEach(l => l.g.setAttribute('transform', `translate(${(l.x + tx).toFixed(1)},${G})`));
        const wx = nx - tx;
        if (prevW === null) prevW = wx;
        const dx = wx - prevW; prevW = wx;
        const speed = Math.abs(dx) / Math.max(dt, 1 / 120);
        runAmt = damp(runAmt, clamp(speed / 240, 0, 1), 7, dt);
        if (Math.abs(dx) > .4) ninja.facing = Math.sign(dx);
        const before = phase;
        phase += Math.abs(dx) * .055 + dt * runAmt * 3;
        ninja.wind = .3 + runAmt;
        ninja.tick(dt);

        let P = mix(POSES.crouch(ninja.t), POSES.run(phase), runAmt);
        let lift = 0, air = 0, hit = null, u = 0;
        for (const l of lanterns) {
          const d = l.x - wx, R = 95;
          if (Math.abs(d) < R) { hit = l; u = (d + R) / (2 * R); }
        }
        if (hit) {
          if (zone !== hit) { zone = hit; latch = ninja.facing; flipK = runAmt > .55 ? 1 : 0; if (runAmt > .3) sfx.whoosh(.18); }
          const s = Math.sin(Math.PI * u);
          lift = clamp(s * 1.8, 0, 1) * (LH + 2) + 30 * s * runAmt;
          air = s;
          const prog = latch > 0 ? 1 - u : u;
          ninja.rot = 360 * ease.inOut(prog) * flipK;
        } else {
          if (zone) { if (runAmt > .2) { dust(fx, nx, G, 1, '#14110f'); sfx.land(.18); } zone = null; }
          ninja.rot = 0;
        }
        if (air > 0) P = mix(P, POSES.leap(), clamp(air * 1.6, 0, 1) * runAmt);
        P.dy = -lift;
        ninja.x = nx; ninja.y = G;
        ninja.render(P);
        ghost(dt, runAmt > .75 || (air > .2 && flipK > 0), .22, .3);

        if (!hit && runAmt > .3 && Math.floor(phase / Math.PI) !== Math.floor(before / Math.PI) && performance.now() - lastStep > 90) {
          lastStep = performance.now(); sfx.step(.07 + runAmt * .05);
        }
      }
    };
  };

  /* ------------------------------------------------------------------ 旅 JOURNEY
     An ink road draws itself as you scroll; a samurai walks along its tip,
     turning with each bend and lighting up each milestone. */
  Scenes.journey = function () {
    const road = document.querySelector('.road');
    const svg = road.querySelector('.road-svg');
    const ghostPath = svg.querySelector('.road-ghost'), ink = svg.querySelector('.road-ink');
    const nodesG = el('g', {}, svg);
    const miles = [...road.querySelectorAll('.mile')];
    const sam = new Fighter(svg.querySelector('.road-walker'), { type: 'samurai', scale: .8, ink: '#14110f', wind: .5 });
    svg.appendChild(svg.querySelector('.road-walker'));
    let len = 0, prog = 0, cur = 0, lastL = 0, phase = 0, walkAmt = 0, marks = [], nodes = [], lit = [];

    function layout() {
      const W = road.clientWidth, H = road.clientHeight;
      if (!W || !H) return;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const mobile = W < 800, cx = mobile ? 26 : W / 2, amp = mobile ? 8 : 60;
      const pts = [{ x: cx, y: 0 }];
      miles.forEach((m, i) => {
        const off = mobile ? (i % 2 ? amp : -amp) : (m.classList.contains('l') ? -amp : amp);
        pts.push({ x: cx + off, y: m.offsetTop + m.offsetHeight / 2 });
      });
      pts.push({ x: cx, y: H });
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2;
        d += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
      }
      ghostPath.setAttribute('d', d); ink.setAttribute('d', d);
      len = ink.getTotalLength();
      ink.style.strokeDasharray = len;
      nodesG.innerHTML = '';
      nodes = []; marks = [];
      pts.slice(1, -1).forEach(p => {
        let best = 0, bd = 1e9;
        for (let s = 0; s <= len; s += len / 500) {
          const q = ink.getPointAtLength(s), dd = Math.abs(q.y - p.y);
          if (dd < bd) { bd = dd; best = s; }
        }
        marks.push(best / len);
        nodes.push(el('rect', { x: p.x - 9, y: p.y - 9, width: 18, height: 18, rx: 3, fill: '#efe6d3', stroke: '#14110f', 'stroke-width': 2, transform: `rotate(45 ${p.x} ${p.y})` }, nodesG));
      });
    }

    return {
      active: true,
      layout,
      set progress(v) { prog = v; },
      update(dt) {
        if (!len) layout();
        if (!len) return;
        cur = damp(cur, prog, 7, dt);
        const L = cur * len;
        ink.style.strokeDashoffset = len - L;
        const p = ink.getPointAtLength(L), q = ink.getPointAtLength(Math.min(len, L + 3));
        const moved = L - lastL; lastL = L;
        const before = phase;
        phase += Math.abs(moved) * .12;
        const hx = (q.x - p.x) * Math.sign(moved || 1);
        if (Math.abs(q.x - p.x) > .6 && Math.abs(moved) > .05) sam.facing = Math.sign(hx);
        walkAmt = damp(walkAmt, clamp(Math.abs(moved) / 1.2, 0, 1), 6, dt);
        sam.x = p.x; sam.y = p.y; sam.tick(dt);
        sam.render(mix(POSES.idle(sam.t), POSES.walk(phase), walkAmt));
        if (walkAmt > .4 && Math.floor(phase / Math.PI) !== Math.floor(before / Math.PI)) sfx.step(.05);
        miles.forEach((m, i) => {
          const on = cur >= marks[i] - .005;
          if (on && !lit[i]) { sfx.pluck(); }
          lit[i] = on;
          m.classList.toggle('lit', on);
          nodes[i].setAttribute('fill', on ? '#c8321f' : '#efe6d3');
        });
      }
    };
  };

  /* ------------------------------------------------------------------ 決 DUEL
     Scroll-scrubbed iaijutsu duel under a torii at sunset, framed in
     letterbox: hyoshigi clappers, the stance, the charge with afterimages,
     one flash of steel with sparks, ink and camera shake — the ninja's
     headband falls, he kneels, and the invitation appears. */
  Scenes.duel = function () {
    const svg = document.querySelector('.duel-scene');
    const fg = svg.querySelector('#duelFighters'), fxG = svg.querySelector('#duelFx');
    const kanji = svg.querySelector('.duel-kanji'), slash = svg.querySelector('.duel-slash'), sun = svg.querySelector('.duel-sun');
    const flash = document.querySelector('.duel-flash'), cta = document.querySelector('.duel-cta'), step = document.querySelector('.duel-step');
    const bars = [...document.querySelectorAll('.cine')];
    const GY = 780;
    const sam = new Fighter(fg, { type: 'samurai', scale: 2.7, facing: 1, ink: '#120607', wind: .8 });
    const nin = new Fighter(fg, { type: 'ninja', scale: 2.7, facing: -1, ink: '#120607', eye: '#ffd2a8', wind: .8 });
    const gS = ghoster(sam, .035), gN = ghoster(nin, .035);
    const ribbon = el('path', { d: 'M0,0 L-12,3 L-22,2 L-32,7', fill: 'none', stroke: '#c8321f', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, fg);
    const grass = svg.querySelector('#duelGrass');
    for (let x = -10; x < 1620; x += 11) {
      const h = rand(16, 58);
      el('path', { d: `M${x},${GY + 40} q-2,${-h / 2} ${rand(-6, 9).toFixed(1)},${-h} q3,${h / 2} 5,${h} Z`, fill: '#120607', class: 'grass-blade', style: `animation-delay:${rand(0, 3).toFixed(2)}s` }, grass);
    }
    let prog = 0, cur = 0, prevP = 0, lastS = null, lastN = null, phS = 0, phN = 0, stepTxt = '', shake = 0;
    const steps = [[.1, 'The challenge'], [.3, 'Kamae — the stance'], [.555, 'The charge'], [.76, 'One cut'], [2, 'Your move']];

    function reach() {
      const r = svg.getBoundingClientRect();
      const visW = r.height ? Math.min(1600, 900 * r.width / r.height) : 1600;
      return Math.min(390, visW * .36);
    }

    function clash(sc) {
      sfx.clash();
      shake = .6;
      const cx = 800, cy = GY - 62 * sc;
      for (let i = 0; i < 22; i++) {                       // sparks
        const a = rand(0, Math.PI * 2), L = rand(40, 170);
        const ln = el('line', { x1: cx, y1: cy, x2: cx, y2: cy, stroke: i % 3 ? '#ffd9a0' : '#ffffff', 'stroke-width': rand(2, 5), 'stroke-linecap': 'round' }, fxG);
        gsap.to(ln, { attr: { x1: cx + Math.cos(a) * L * .55, y1: cy + Math.sin(a) * L * .55, x2: cx + Math.cos(a) * L, y2: cy + Math.sin(a) * L }, opacity: 0, duration: rand(.35, .7), ease: 'power3.out', onComplete: () => ln.remove() });
      }
      for (let i = 0; i < 26; i++) {                       // ink spray along the cut
        const t = rand(-.4, .4), ox = 800 + t * 1100, oy = 465 + t * 470;
        const c = el('circle', { cx: ox, cy: oy, r: rand(2, 9), fill: i % 4 ? '#120607' : '#c8321f' }, fxG);
        gsap.to(c, { attr: { cx: ox + rand(-60, 160), cy: oy + rand(40, 260) }, opacity: 0, duration: rand(.6, 1.1), ease: 'power2.in', onComplete: () => c.remove() });
      }
      if (window.Petals) Petals.burst(innerWidth / 2, innerHeight * .55, 60);
    }

    return {
      active: true,
      set progress(v) { prog = v; },
      update(dt) {
        cur = damp(cur, prog, 10, dt);
        const p = cur, R = reach(), sc = clamp(R / 390 * 2.7, 1.45, 2.7);
        sam.scale = nin.scale = sc;
        sam.tick(dt); nin.tick(dt);

        const inn = ease.in(range(p, .3, .56)), out = ease.out(range(p, .56, .64));
        const sx = p < .56 ? lerp(800 - R, 794, inn) : lerp(794, 800 + R * .82, out);
        const nx = p < .56 ? lerp(800 + R, 806, inn) : lerp(806, 800 - R * .82, out);
        if (lastS !== null) { phS += Math.abs(sx - lastS) * .07 / sc * 2.7; phN += Math.abs(nx - lastN) * .07 / sc * 2.7; }
        lastS = sx; lastN = nx;
        const runA = range(p, .3, .36) * (1 - range(p, .5, .56));
        const slashA = range(p, .5, .56);

        let S = mix(POSES.idle(sam.t), POSES.kamae(sam.t), ease.inOut(range(p, .1, .28)) * (1 - range(p, .74, .88)));
        if (runA > 0) { const r = POSES.run(phS); r.uF = -30; r.eF = 20; r.sword = 80; S = mix(S, r, runA); }
        S = mix(S, POSES.slash(), slashA * (1 - ease.inOut(range(p, .74, .88))));
        sam.x = sx; sam.y = GY; sam.render(S);

        nin.setWeapon(p > .2 ? 'blade' : 'back');
        let N = mix(POSES.crouch(nin.t), POSES.ninjaGuard(nin.t), ease.inOut(range(p, .12, .28)));
        if (runA > 0) { const r = POSES.run(phN); r.uF = -30; r.eF = 20; r.sword = 80; N = mix(N, r, runA); }
        N = mix(N, POSES.slash(), slashA);
        N = mix(N, POSES.kneel(), ease.inOut(range(p, .68, .8)));
        const cut = p >= .6;
        nin.tails.forEach(t => { t.style.display = cut ? 'none' : ''; });
        nin.x = nx; nin.y = GY; nin.render(N);

        const charging = Math.abs(prog - cur) > .002 && p > .38 && p < .62;
        gS(dt, charging, .26, .3); gN(dt, charging, .26, .3);

        if (cut) {
          const f = range(p, .6, .86);
          const x0 = 800 - R * .82 + 18 * sc, y0 = GY - 88 * sc;
          const rx = x0 + 60 * f * sc / 2.7 + Math.sin(f * 9) * 10, ry = lerp(y0, GY - 4, ease.in(Math.min(1, f * 1.05)));
          ribbon.setAttribute('transform', `translate(${rx.toFixed(1)},${ry.toFixed(1)}) rotate(${(f * 220).toFixed(1)}) scale(${(sc / 1.4).toFixed(2)})`);
          ribbon.setAttribute('opacity', 1);
        } else ribbon.setAttribute('opacity', 0);

        flash.style.opacity = (range(p, .535, .56) * (1 - range(p, .56, .66))).toFixed(3);
        slash.style.strokeDashoffset = (1300 * (1 - ease.out(range(p, .555, .6)))).toFixed(1);
        slash.style.opacity = (1 - range(p, .68, .8)).toFixed(3);
        kanji.style.opacity = (.75 * range(p, .02, .16) * (1 - .7 * range(p, .56, .7))).toFixed(3);
        sun.setAttribute('opacity', (.92 - .62 * range(p, .78, .92)).toFixed(3));

        // letterbox
        const bh = range(p, .03, .14) * (1 - range(p, .76, .86)) * 9;
        bars.forEach(b => { b.style.height = bh.toFixed(2) + 'vh'; });

        // camera shake after the clash
        if (shake > 0) {
          shake = Math.max(0, shake - dt);
          const a = shake * 22;
          svg.style.transform = `translate(${rand(-a, a).toFixed(1)}px,${rand(-a, a).toFixed(1)}px) scale(1.03)`;
        } else if (svg.style.transform) svg.style.transform = '';

        // sound + one-shot beats, fired when scrolling forward past them
        const ev = (th, fn) => { if (prevP < th && p >= th) fn(); };
        ev(.04, () => sfx.hyoshigi());
        ev(.2, () => { sfx.unsheathe(.35); sam.flash(); });
        ev(.4, () => sfx.drum(.6));
        ev(.47, () => sfx.drum(.75));
        ev(.52, () => sfx.whoosh(.5));
        ev(.555, () => clash(sc));
        ev(.63, () => sfx.pluck());
        ev(.72, () => sfx.land(.45));
        ev(.85, () => { sfx.resolve(); sam.flash(); });
        prevP = p;

        const c = range(p, .82, .94);
        cta.style.opacity = c.toFixed(3);
        cta.style.visibility = c > 0 ? 'visible' : 'hidden';
        cta.style.transform = `translateX(-50%) translateY(${((1 - c) * 30).toFixed(1)}px)`;

        const txt = steps.find(s => p < s[0])[1];
        if (txt !== stepTxt) { stepTxt = txt; step.textContent = txt; }
      }
    };
  };

  window.Scenes = Scenes;
})();
