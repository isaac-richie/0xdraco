/* ==========================================================================
   rig.js — procedural ink-silhouette fighters (ninja + samurai)
   Every character is an articulated SVG skeleton posed with forward
   kinematics each frame. Poses are plain objects of joint angles, so any two
   poses can be blended:  Rig.mix(Rig.POSES.run(p), Rig.POSES.leap(), 0.5)

   Angle convention (character faces right, facing = 1):
     limb angles: 0 = hanging straight down, positive = swung FORWARD
     e* (elbow flex): positive bends the forearm forward / up
     k* (knee flex):  positive bends the shin backward
     lean: torso tilt, positive = forward.  head: extra head tilt.
     sword: blade angle relative to the forearm (0 = straight on).
   (0,0) of a fighter is the ground point under the hips.
   ========================================================================== */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const D = Math.PI / 180;
  const sn = a => Math.sin(a * D), cs = a => Math.cos(a * D);

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = {
    inOut: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    smooth: t => t * t * (3 - 2 * t)
  };
  // remap v from [a,b] to [0,1] clamped
  const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

  const SPECS = {
    ninja:   { T: 30, TW: 15, U: 16, UW: 6.5, F: 15, FW: 5.5, TH: 21, THW: 8.5, SH: 21, SHW: 7 },
    samurai: { T: 31, TW: 21, U: 16, UW: 8.5, F: 15, FW: 7,   TH: 21, THW: 13,  SH: 21, SHW: 13 }
  };

  const BASE = { lean: 0, head: 0, uF: 6, eF: 14, uB: -6, eB: 12, tF: 6, kF: 4, tB: -6, kB: 4, sword: 0, dy: 0, foot: 0 };

  function mix(a, b, t) {
    const o = {};
    for (const k in BASE) o[k] = lerp(a[k] ?? BASE[k], b[k] ?? BASE[k], t);
    return o;
  }

  /* ---------- pose library ---------- */
  const POSES = {
    stand: () => ({ ...BASE }),

    // samurai on a windy cliff, katana lowered
    idle: (t = 0) => {
      const b = Math.sin(t * 1.6);
      return { ...BASE, lean: 3 + b * 1.2, head: -3, uF: 26 + b * 1.5, eF: 40, sword: 24, uB: -6, eB: 22, tF: 13, kF: 7, tB: -13, kB: 6 };
    },

    run: (p = 0) => {
      const s = Math.sin(p), c = Math.cos(p);
      return {
        ...BASE, lean: 17, head: -11,
        tF: 44 * s, kF: 16 + 82 * Math.max(0, c),
        tB: -44 * s, kB: 16 + 82 * Math.max(0, -c),
        uF: -50 * s, eF: 88, uB: 50 * s, eB: 88, foot: 6
      };
    },

    walk: (p = 0) => {
      const s = Math.sin(p), c = Math.cos(p);
      return {
        ...BASE, lean: 4, head: -2,
        tF: 24 * s, kF: 6 + 34 * Math.max(0, c),
        tB: -24 * s, kB: 6 + 34 * Math.max(0, -c),
        uF: -18 * s + 14, eF: 30, uB: 18 * s, eB: 18, sword: 30
      };
    },

    sneak: (p = 0) => {
      const s = Math.sin(p), c = Math.cos(p);
      return {
        ...BASE, lean: 34, head: -26,
        tF: 46 + 30 * s, kF: 84 + 30 * Math.max(0, c),
        tB: 46 - 30 * s, kB: 84 + 30 * Math.max(0, -c),
        uF: 62, eF: 58, uB: 26, eB: 74
      };
    },

    leap: () => ({ ...BASE, lean: 34, head: -18, tF: 88, kF: 122, tB: -6, kB: 98, uF: -64, eF: 14, uB: -84, eB: 6 }),

    crouch: (t = 0) => {
      const b = Math.sin(t * 2.1);
      return { ...BASE, lean: 26 + b * 1.5, head: -14, tF: 72, kF: 142, tB: 34, kB: 132, uF: 40, eF: 52, uB: 18, eB: 66, foot: 4 };
    },

    // k: 0 = wound up, 1 = released
    throwWind: () => ({ ...BASE, lean: -6, head: -8, uF: -128, eF: 62, uB: 52, eB: 28, tF: 30, kF: 34, tB: -26, kB: 10 }),
    throwRelease: () => ({ ...BASE, lean: 24, head: -12, uF: 98, eF: -4, uB: -44, eB: 26, tF: 46, kF: 46, tB: -40, kB: 2 }),

    seiza: (t = 0) => {
      const b = Math.sin(t * 1.2);
      return { ...BASE, lean: 1 + b * 1.2, head: -5, tF: 88, kF: 176, tB: 86, kB: 176, uF: 18, eF: 54, uB: 14, eB: 56, foot: 118 };
    },

    // chudan-no-kamae: katana held forward, point up
    kamae: (t = 0) => {
      const b = Math.sin(t * 1.8);
      return { ...BASE, lean: 7 + b, head: -5, tF: 30, kF: 24, tB: -24, kB: 6, uF: 42, eF: 76 + b * 2, sword: -30, uB: 32, eB: 92 };
    },

    ninjaGuard: (t = 0) => {
      const b = Math.sin(t * 2);
      return { ...BASE, lean: 20 + b, head: -16, tF: 52, kF: 70, tB: -10, kB: 50, uF: 70, eF: 30, sword: -10, uB: 46, eB: 80 };
    },

    slash: () => ({ ...BASE, lean: 30, head: -8, tF: 64, kF: 72, tB: -50, kB: 4, uF: 106, eF: -6, sword: 8, uB: -54, eB: 10 }),

    kneel: () => ({ ...BASE, lean: 26, head: 22, tF: 82, kF: 86, tB: 8, kB: 102, uF: 32, eF: 44, sword: 60, uB: 4, eB: 30, foot: 40 }),

    // hand on the hilt of a sheathed katana, ready to draw
    hilt: (t = 0) => {
      const b = Math.sin(t * 1.6);
      return { ...BASE, lean: 6 + b, head: -4, uF: 10, eF: 72, uB: -4, eB: 42, tF: 16, kF: 12, tB: -16, kB: 8 };
    },
    // iaido: the instant after the draw, blade fully extended
    iaiDraw: () => ({ ...BASE, lean: 14, head: -6, tF: 40, kF: 30, tB: -30, kB: 4, uF: 100, eF: -8, sword: 4, uB: -34, eB: 18 })
  };

  /* dust puff at a point in an SVG layer (needs gsap) */
  function dust(layer, x, y, scale = 1, color = '#14110f', n = 7) {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const c = el('circle', { cx: x, cy: y - 2 * scale, r: (2 + Math.random() * 3) * scale, fill: color, opacity: .35 }, layer);
      gsap.to(c, {
        attr: { cx: x + dir * (10 + Math.random() * 26) * scale, cy: y - (4 + Math.random() * 12) * scale, r: (5 + Math.random() * 5) * scale },
        opacity: 0, duration: .55 + Math.random() * .3, ease: 'power2.out', onComplete: () => c.remove()
      });
    }
  }

  /* ---------- drawing helpers ---------- */
  function capsule(g, len, w, fill) {
    return el('rect', { x: -w / 2, y: -w / 2, width: w, height: len + w, rx: w / 2, fill }, g);
  }
  function flare(g, len, w0, w1, fill) {
    return el('path', { d: `M${-w0 / 2},-2.5 L${w0 / 2},-2.5 L${w1 / 2},${len + 2} Q0,${len + 5} ${-w1 / 2},${len + 2} Z`, fill }, g);
  }
  function shurikenPath(r) {
    const i = r * 0.24;
    return `M0,${-r} L${i},${-i} L${r},0 L${i},${i} L0,${r} L${-i},${i} L${-r},0 L${-i},${-i} Z ` +
      `M0,${-r * .14} A${r * .14},${r * .14} 0 1,0 0.01,${-r * .14} Z`;
  }

  /* ---------- Fighter ---------- */
  class Fighter {
    constructor(parent, o = {}) {
      Object.assign(this, {
        type: 'ninja', ink: '#0d0b0a', accent: '#c8321f', gold: '#c9a14a', steel: '#ece5d6', eye: '#f3e9d6',
        scale: 1, facing: 1, x: 0, y: 0, wind: 1, t: 0
      }, o);
      this.back = o.back || this.ink;
      this.s = SPECS[this.type];
      if (this.weapon === undefined) this.weapon = this.type === 'samurai' ? 'katana' : 'back';
      if (this.cape === undefined) this.cape = this.type === 'samurai';
      const s = this.s, S = this.type === 'samurai';

      this.root = el('g', { class: 'fighter fighter-' + this.type }, parent);
      this.body = el('g', {}, this.root);
      const b = this.body;

      if (this.cape) this.capeEl = el('path', { fill: this.back }, b);
      this.LB = this._leg(b, this.back);
      this.AB = this._arm(b, this.back);
      if (S) {
        this.saya = el('g', {}, b);
        el('path', { d: 'M9,1 L-38,15 L-39,11.5 L8,-2.5 Z', fill: this.ink }, this.saya);
        this.tsuka = el('g', {}, this.saya);   // hilt, visible only while sheathed
        el('path', { d: 'M10,-2.8 L24,-6.8 L25.2,-3.4 L11,.6 Z', fill: this.ink }, this.tsuka);
        el('ellipse', { cx: 9.6, cy: -1, rx: 1.6, ry: 4.6, fill: this.ink, transform: 'rotate(-16 9.6 -1)' }, this.tsuka);
      }

      this.torso = el('g', {}, b);
      if (S) {
        el('path', { d: 'M-15,-16 L15,-16 L11,3 L-11,3 Z', fill: this.ink }, this.torso);                // kusazuri
        el('path', { d: `M-11,0 L11,0 L12.5,${s.T - 3} Q0,${s.T + 3} -12.5,${s.T - 3} Z`, fill: this.ink }, this.torso); // do
        el('rect', { x: -11, y: 3, width: 22, height: 2.4, fill: this.accent }, this.torso);              // obi cord
      } else {
        // sheath on the back (local +x = behind, +y = up the spine)
        el('path', { d: `M${s.TW / 2 - 1},-3 L${s.TW / 2 + 2.5},-2 L${s.TW / 2 - .5},${s.T + 7} L${s.TW / 2 - 4},${s.T + 6} Z`, fill: this.ink }, this.torso);
        this.backSword = el('g', {}, this.torso);
        el('rect', { x: s.TW / 2 - 6.5, y: s.T + 5.5, width: 6, height: 2, fill: this.ink }, this.backSword);
        el('path', { d: `M${s.TW / 2 - 4},${s.T + 7} L${s.TW / 2 - 6.5},${s.T + 17} L${s.TW / 2 - 3.2},${s.T + 17.6} L${s.TW / 2 - 1},${s.T + 7.5} Z`, fill: this.ink }, this.backSword);
        el('rect', { x: -s.TW / 2, y: -4, width: s.TW, height: s.T + 6, rx: 6, fill: this.ink }, this.torso);
        el('rect', { x: -s.TW / 2, y: 1.5, width: s.TW, height: 3, fill: this.accent }, this.torso);
      }

      this.LF = this._leg(b, this.ink);
      this.head = el('g', {}, b);
      this._buildHead();
      this.AF = this._arm(b, this.ink);
      this.hand = el('g', {}, b);
      this._buildWeapons();
      this.render(POSES.stand());
    }

    _leg(p, c) {
      const s = this.s, S = this.type === 'samurai';
      const thigh = el('g', {}, p), shin = el('g', {}, p), foot = el('g', {}, p);
      if (S) { flare(thigh, s.TH, s.THW * .85, s.THW, c); flare(shin, s.SH, s.SHW * .9, s.SHW * 1.18, c); }
      else { capsule(thigh, s.TH, s.THW, c); capsule(shin, s.SH, s.SHW, c); }
      el('path', { d: 'M-3.5,-2.5 L8,-1.5 Q11,.5 9,3.2 L-3.5,3.2 Z', fill: c }, foot);
      return { thigh, shin, foot };
    }

    _arm(p, c) {
      const s = this.s, S = this.type === 'samurai';
      const up = el('g', {}, p), fo = el('g', {}, p);
      capsule(up, s.U, s.UW, c);
      if (S) el('path', { d: 'M-8.5,-4 L6,-4 L7.5,12.5 L-9.5,12.5 Z', fill: c }, up); // sode
      capsule(fo, s.F, s.FW, c);
      el('circle', { cx: 0, cy: s.F + 1, r: s.FW * .66, fill: c }, fo);
      return { up, fo };
    }

    _buildHead() {
      const h = this.head, c = this.ink;
      if (this.type === 'ninja') {
        el('path', { d: 'M-2,2 L4,2 L4,-4 L-3,-4 Z', fill: c }, h);
        el('circle', { cx: 1, cy: -9, r: 8.6, fill: c }, h);
        el('path', { d: 'M-7,-14 Q-11.5,-8 -8,-1.5 L-2,-4 Z', fill: c }, h);
        this.band = el('rect', { x: -8.4, y: -15.2, width: 17.6, height: 2.9, rx: 1, fill: this.accent }, h);
        this.eyeEl = el('rect', { x: 2.6, y: -10.8, width: 7.2, height: 2.3, rx: 1.15, fill: this.eye }, h);
        this.tails = [
          el('path', { fill: 'none', stroke: this.accent, 'stroke-width': 2.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h),
          el('path', { fill: 'none', stroke: this.accent, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h)
        ];
      } else {
        el('path', { d: 'M-3,2 L4,2 L4,-4 L-3,-4 Z', fill: c }, h);
        el('circle', { cx: 1.5, cy: -8.5, r: 8, fill: c }, h);
        el('path', { d: 'M-11,-8 Q-11,-21.5 1,-21.5 Q12.5,-21.5 12.5,-9 Z', fill: c }, h);   // kabuto bowl
        el('path', { d: 'M-10,-9 L-18,-.5 L-12.5,.5 L-5,-5 Z', fill: c }, h);                // shikoro
        el('path', { d: 'M-9,-11.5 L-20,-4 L-16.5,-2 L-6.5,-8 Z', fill: c }, h);
        el('path', { d: 'M8,-12.5 L14,-16 L13.5,-9 Z', fill: c }, h);                       // fukigaeshi
        el('path', { d: 'M5,-19.5 C7,-28 3,-36 -4,-42 C6,-38.5 11,-30 9,-19.5 Z', fill: this.gold }, h); // maedate
        el('path', { d: 'M6,-19.5 C14,-25 19,-33 19.5,-42.5 C23,-32 18.5,-23 9,-18.5 Z', fill: this.gold }, h);
        el('rect', { x: -1.5, y: -23, width: 9.5, height: 3.2, rx: 1, fill: this.gold }, h);
      }
    }

    _buildWeapons() {
      const g = this.hand;
      this.katanaEl = el('g', {}, g);
      el('rect', { x: -11, y: -1.8, width: 14.5, height: 3.6, rx: 1.3, fill: this.ink }, this.katanaEl);
      el('ellipse', { cx: 3.8, cy: 0, rx: 1.7, ry: 4.8, fill: this.ink }, this.katanaEl);
      el('path', { d: 'M5,-1.5 Q33,-2.2 62,-6.6 Q63.8,-5 61.6,-4.4 Q33,.6 5,1.6 Z', fill: this.steel }, this.katanaEl);
      this.glint = el('path', { d: 'M-3,-1.9 L4,-2.3 L2,1.9 L-5,2.2 Z', fill: '#ffffff', opacity: 0 }, this.katanaEl);
      this.bladeEl = el('g', {}, g);
      el('rect', { x: -9, y: -1.6, width: 12, height: 3.2, rx: 1, fill: this.ink }, this.bladeEl);
      el('rect', { x: 2.5, y: -3.8, width: 2.6, height: 7.6, fill: this.ink }, this.bladeEl);
      el('path', { d: 'M5,-1.35 L45,-1.35 L50,0 L45,1.35 L5,1.35 Z', fill: this.steel }, this.bladeEl);
      this.setWeapon(this.weapon);
    }

    setWeapon(w) {
      this.weapon = w;
      this.katanaEl.style.display = w === 'katana' ? '' : 'none';
      this.bladeEl.style.display = w === 'blade' ? '' : 'none';
      if (this.backSword) this.backSword.style.display = w === 'blade' ? 'none' : '';
      if (this.tsuka) this.tsuka.style.display = w === 'katana' ? 'none' : '';
    }

    // a light streak runs down the katana
    flash() {
      if (!this.glint || typeof gsap === 'undefined') return;
      const o = { x: 4 };
      gsap.fromTo(o, { x: 4 }, {
        x: 62, duration: .55, ease: 'power2.inOut',
        onUpdate: () => {
          const k = o.x / 62;
          this.glint.setAttribute('transform', `translate(${o.x.toFixed(1)},${(-k * k * 5).toFixed(2)}) scale(${(1 + Math.sin(k * Math.PI) * 1.4).toFixed(2)})`);
          this.glint.setAttribute('opacity', Math.sin(k * Math.PI).toFixed(2));
        }
      });
    }

    // fading afterimage of the current pose
    ghost(opacity = .3, life = .32) {
      if (typeof gsap === 'undefined') return;
      const g = this.root.cloneNode(true);
      g.setAttribute('class', 'ghost');
      g.setAttribute('opacity', opacity);
      this.root.parentNode.insertBefore(g, this.root);
      gsap.to(g, { opacity: 0, duration: life, ease: 'power1.out', onComplete: () => g.remove() });
    }

    tick(dt) { this.t += dt; }

    render(P) {
      const s = this.s;
      const tr = (g, x, y, a) => g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${a.toFixed(2)})`);
      const leg = (t, k) => {
        const kn = { x: s.TH * sn(t), y: s.TH * cs(t) }, sf = t - k;
        return { t, sf, kn, an: { x: kn.x + s.SH * sn(sf), y: kn.y + s.SH * cs(sf) } };
      };
      const F = leg(P.tF, P.kF), B = leg(P.tB, P.kB);
      const low = Math.max(F.kn.y, F.an.y, B.kn.y, B.an.y) + s.SHW / 2 + 1;
      const H = -low + (P.dy || 0);
      this.H = H;
      this.body.setAttribute('transform', `translate(0,${H.toFixed(2)})`);

      const setLeg = (L, R) => {
        tr(L.thigh, 0, 0, -R.t);
        tr(L.shin, R.kn.x, R.kn.y, -R.sf);
        tr(L.foot, R.an.x, R.an.y, -R.sf * .6 + (P.foot || 0));
      };
      setLeg(this.LB, B); setLeg(this.LF, F);

      const L = P.lean;
      tr(this.torso, 0, 0, 180 + L);
      const top = { x: s.T * sn(L), y: -s.T * cs(L) };
      const sh = { x: (s.T - 4) * sn(L), y: -(s.T - 4) * cs(L) };
      const arm = (A, u, e) => {
        const elb = { x: sh.x + s.U * sn(u), y: sh.y + s.U * cs(u) }, f = u + e;
        tr(A.up, sh.x, sh.y, -u);
        tr(A.fo, elb.x, elb.y, -f);
        return { f, hand: { x: elb.x + (s.F + 1) * sn(f), y: elb.y + (s.F + 1) * cs(f) } };
      };
      arm(this.AB, P.uB, P.eB);
      const af = arm(this.AF, P.uF, P.eF);
      this.handLocal = af.hand;
      tr(this.hand, af.hand.x, af.hand.y, 90 - af.f + (P.sword || 0));
      tr(this.head, top.x, top.y, L + (P.head || 0));
      this.headLocal = top;
      if (this.saya) tr(this.saya, 0, 0, L * .3);

      const t = this.t, w = this.wind;
      if (this.tails && this.tails[0].style.display !== 'none') {
        this.tails.forEach((p, j) => {
          let d = `M-8,${-14 + j}`;
          for (let i = 1; i <= 6; i++) {
            const x = -8 - i * (4.3 - j * .6) * (.55 + .45 * w);
            const y = -14 + j + i * (1.5 - .35 * w) + Math.sin(t * 11 - i * .9 + j * 1.7) * i * .5 * (.3 + w);
            d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
          }
          p.setAttribute('d', d);
        });
      }
      if (this.capeEl) {
        const sx = sh.x, sy = sh.y;
        const tipx = -20 - 20 * w + Math.sin(t * 2.6) * 5 * w, tipy = 6 + Math.sin(t * 3.3) * 5 * w;
        this.capeEl.setAttribute('d',
          `M${(sx + 3).toFixed(1)},${(sy - 1).toFixed(1)} ` +
          `Q${(sx - 12 - 8 * w).toFixed(1)},${(sy + 6 + Math.sin(t * 2.2) * 3).toFixed(1)} ${tipx.toFixed(1)},${tipy.toFixed(1)} ` +
          `Q${(tipx * .5).toFixed(1)},${(tipy + 9 + Math.sin(t * 4.1) * 3).toFixed(1)} -2,13 ` +
          `L${(sx * .5 + 4).toFixed(1)},${(sy * .5 + 4).toFixed(1)} Z`);
      }
      this.place();
    }

    place() {
      const rot = this.rot ? ` rotate(${this.rot.toFixed(1)} 0 ${((this.H || 0) - 12).toFixed(1)})` : '';
      this.root.setAttribute('transform',
        `translate(${this.x.toFixed(2)},${this.y.toFixed(2)}) scale(${(this.facing * this.scale).toFixed(3)},${this.scale.toFixed(3)})${rot}`);
    }

    // a point in the fighter's body space -> parent (scene) coords
    toScene(p) {
      return { x: this.x + this.facing * this.scale * p.x, y: this.y + this.scale * (p.y + (this.H || 0)) };
    }
  }

  window.Rig = { Fighter, POSES, BASE, mix, el, lerp, clamp, ease, range, shurikenPath, dust };
})();
