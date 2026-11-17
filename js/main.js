/* ==========================================================================
   main.js — loader, smooth scroll, cursor, sakura, scroll choreography
   ========================================================================== */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- split headings into masked words ---------- */
  $$('.split').forEach(h => {
    h.innerHTML = h.textContent.trim().split(/\s+/).map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
  });

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: .09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    window.__lenis = lenis;
  }

  /* ---------- sakura petals ---------- */
  const Petals = (() => {
    const c = $('#petals'), ctx = c.getContext('2d');
    let W = 0, H = 0, ps = [];
    const mouse = { x: -1e4, y: -1e4 };
    function resize() {
      const d = Math.min(2, devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      c.width = W * d; c.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function make(top) {
      return {
        x: Math.random() * W * 1.25, y: top ? -20 - Math.random() * H * .3 : Math.random() * H,
        s: 4 + Math.random() * 5.5, vx: -.35 - Math.random() * .8, vy: .45 + Math.random() * 1,
        r: Math.random() * 6.28, vr: (Math.random() - .5) * .05, f: Math.random() * 6.28, vf: .03 + Math.random() * .05,
        c: Math.random() < .25 ? '#ea8fa0' : '#f7c4cd', life: 1, burst: false
      };
    }
    function draw(p) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.sin(p.f)) * .7 + .3);
      ctx.globalAlpha = p.burst ? Math.max(0, p.life) : .85;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.moveTo(0, -p.s);
      ctx.bezierCurveTo(p.s * .9, -p.s * .6, p.s * .7, p.s * .7, 0, p.s);
      ctx.bezierCurveTo(-p.s * .7, p.s * .7, -p.s * .9, -p.s * .6, 0, -p.s);
      ctx.fill();
      ctx.restore();
    }
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    const N = innerWidth < 700 ? 14 : 28;
    for (let i = 0; i < N; i++) ps.push(make(false));
    return {
      tick(dt, t) {
        ctx.clearRect(0, 0, W, H);
        const k = dt * 60, wind = Math.sin(t * .35) * .5;
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i];
          if (p.burst) { p.vy += .12 * k; p.vx *= .985; p.life -= dt * .45; }
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 8100) { const d = Math.sqrt(d2) || 1; p.x += dx / d * 2.2 * k; p.y += dy / d * 2.2 * k; }
          p.x += (p.vx + (p.burst ? 0 : wind)) * k; p.y += p.vy * k;
          p.r += p.vr * k; p.f += p.vf * k;
          draw(p);
          if (p.burst) { if (p.life <= 0 || p.y > H + 20) ps.splice(i, 1); }
          else if (p.y > H + 20 || p.x < -30) ps[i] = make(true);
        }
      },
      burst(x, y, n = 40) {
        for (let i = 0; i < n; i++) {
          const p = make(false);
          Object.assign(p, { x, y, vx: (Math.random() - .5) * 14, vy: -2 - Math.random() * 7, life: 1, burst: true, s: 4 + Math.random() * 6 });
          ps.push(p);
        }
      }
    };
  })();
  window.Petals = Petals;
  if (reduce) $('#petals').style.display = 'none';

  /* ---------- cursor + ink slash on click ---------- */
  function slashAt(x, y) {
    const layer = $('.slash-layer');
    const g = Rig.el('g', { transform: `translate(${x},${y}) rotate(${(-25 - Math.random() * 35).toFixed(1)})` }, layer);
    const L = 64;
    const a = Rig.el('path', { d: `M${-L},3 Q0,-6 ${L},-1 Q0,2 ${-L},3 Z`, fill: '#c8321f' }, g);
    const b = Rig.el('path', { d: `M${-L * .8},1 Q0,-2.5 ${L * .9},-.6 Q0,.4 ${-L * .8},1 Z`, fill: '#fff4e2' }, g);
    gsap.fromTo([a, b], { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: .16, ease: 'power3.out' });
    gsap.to(g, { opacity: 0, duration: .5, delay: .22, onComplete: () => g.remove() });
  }
  if (fine && !reduce) {
    document.body.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring');
    $('.cursor-star').setAttribute('d', Rig.shurikenPath(16));
    const xd = gsap.quickTo(dot, 'x', { duration: .06 }), yd = gsap.quickTo(dot, 'y', { duration: .06 });
    const xr = gsap.quickTo(ring, 'x', { duration: .35, ease: 'power3' }), yr = gsap.quickTo(ring, 'y', { duration: .35, ease: 'power3' });
    addEventListener('pointermove', e => { xd(e.clientX); yd(e.clientY); xr(e.clientX); yr(e.clientY); });
    document.addEventListener('pointerover', e => ring.classList.toggle('is-hover', !!e.target.closest('a, button, .chip')));
    addEventListener('pointerdown', e => slashAt(e.clientX, e.clientY));
  }

  /* ---------- scenes ---------- */
  const S = {
    hero: Scenes.hero(), about: Scenes.about(), arsenal: Scenes.arsenal(),
    work: Scenes.work(), journey: Scenes.journey(), duel: Scenes.duel()
  };
  const roots = { hero: '#hero', about: '.shoji-wrap', arsenal: '#arsenal', work: '#work', journey: '.road', duel: '#duel' };
  const io = new IntersectionObserver(es => es.forEach(e => { e.target._scene.active = e.isIntersecting; }), { rootMargin: '120px' });
  for (const k in S) { const r = $(roots[k]); r._scene = S[k]; io.observe(r); }
  for (const k in S) S[k].update(1 / 60, 0);

  gsap.ticker.add((time, delta) => {
    const dt = Math.min(delta / 1000, 1 / 20);
    for (const k in S) if (S[k].active) S[k].update(dt, time);
    if (!reduce) Petals.tick(dt, time);
  });

  /* ---------- hero parallax ---------- */
  const layers = $$('.hero-scene .px').map(g => ({
    d: +g.dataset.depth, qx: gsap.quickTo(g, 'x', { duration: 1.4, ease: 'power3' }), qy: gsap.quickTo(g, 'y', { duration: 1.4, ease: 'power3' })
  }));
  if (!reduce) {
    addEventListener('pointermove', e => {
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      layers.forEach(l => { l.qx(-nx * 46 * l.d); l.qy(-ny * 18 * l.d); });
    });
    const heroST = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.sun-wrap', { y: 170, ease: 'none', scrollTrigger: heroST });
    gsap.to('#heroSamurai', { y: 50, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero-content > *', { y: -90, opacity: 0, stagger: .04, ease: 'none', scrollTrigger: { ...heroST, end: '70% top' } });
  }

  /* ---------- scroll choreography ---------- */
  let duelST = null;
  const mm = gsap.matchMedia();

  ScrollTrigger.create({ trigger: '.shoji-wrap', start: 'top bottom', end: 'bottom top', onUpdate: s => { S.about.progress = s.progress; } });
  ScrollTrigger.create({ trigger: '.road', start: 'top 62%', end: 'bottom 62%', onUpdate: s => { S.journey.progress = s.progress; } });

  $$('.skill-card').forEach(card => {
    if (reduce) { card.classList.add('hit'); return; }
    ScrollTrigger.create({ trigger: card, start: 'top 80%', once: true, onEnter: () => S.arsenal.throwAt(card) });
  });

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const track = $('.track');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.work-pin', pin: true, start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true }
    });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    duelST = ScrollTrigger.create({
      trigger: '.duel-pin', pin: true, start: 'top top', end: '+=260%',
      onUpdate: s => { S.duel.progress = s.progress; }
    });
    return () => { duelST = null; };
  });
  if (reduce) S.duel.progress = 1;

  ScrollTrigger.addEventListener('refresh', () => { S.work.layout(); S.journey.layout(); });

  // headings, kanji, counters
  if (!reduce) {
    $$('.split').forEach(h => gsap.from(h.querySelectorAll('.w > span'), {
      yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: h, start: 'top 86%' }
    }));
    $$('.sec-kanji').forEach(k => gsap.from(k, {
      scale: .55, rotate: -14, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: k, start: 'top 88%' }
    }));
    $$('.mile').forEach(m => gsap.from(m, {
      y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: m, start: 'top 88%' }
    }));
    gsap.from('.about-copy > *', { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.about-copy', start: 'top 78%' } });
  }
  $$('.stat b').forEach(b => {
    const end = +b.dataset.count, suf = b.dataset.suffix || '', o = { v: 0 };
    const set = () => { b.textContent = Math.round(o.v) + suf; };
    if (reduce) { o.v = end; set(); return; }
    ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: set }) });
  });

  // nav state
  const links = $$('.nav .link');
  const navIds = ['about', 'arsenal', 'work', 'journey', 'duel'];
  function syncNav() {
    const mid = innerHeight / 2;
    let cur = null;
    navIds.forEach(id => { const r = $('#' + id).getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = id; });
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
  }
  ScrollTrigger.addEventListener('refresh', syncNav);
  if (lenis) lenis.on('scroll', syncNav); else addEventListener('scroll', syncNav, { passive: true });
  syncNav();

  // anchor links
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    let target = id === '#contact' ? (duelST ? duelST.end : $('#duel')) : $(id);
    if (target == null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.8 });
    else if (typeof target === 'number') scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- loader -> intro ---------- */
  const loader = $('#loader'), num = $('#loaderNum'), enso = $('.enso path');
  const counter = { v: 0 };
  const show = () => { num.textContent = String(Math.round(counter.v)).padStart(2, '0'); };
  let ready = false;
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r))
  ]).then(() => { ready = true; });
  setTimeout(() => { ready = true; }, 4500);

  function intro() {
    const tl = gsap.timeline();
    tl.from('.hero-title .line > span', { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: .12 })
      .from(['.eyebrow', '.hero-role', '.hero-content .hero-cta', '.hero-vertical', '.scroll-cue'], { y: 26, autoAlpha: 0, duration: .9, stagger: .08, ease: 'power3.out' }, '-=.8')
      .from('.sun', { scale: .72, transformOrigin: '50% 50%', autoAlpha: 0, duration: 1.8, ease: 'power2.out' }, 0)
      .from('#heroSamurai', { autoAlpha: 0, x: 40, duration: 1.4, ease: 'power3.out' }, .3)
      .from('.nav', { autoAlpha: 0, duration: .8 }, .5);
  }

  function exit() {
    gsap.timeline({ onComplete: () => loader.remove() })
      .to('.loader-core', { autoAlpha: 0, scale: .96, duration: .35 })
      .to('.loader-slash', { scaleX: 1, duration: .32, ease: 'expo.in' })
      .add(() => {
        document.body.classList.remove('loading');
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        intro();
      })
      .to('.loader-half.top', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '+=.05')
      .to('.loader-half.bottom', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
      .to('.loader-slash', { autoAlpha: 0, duration: .25 }, '<');
  }

  if (reduce) {
    loader.remove(); document.body.classList.remove('loading'); ScrollTrigger.refresh();
  } else {
    gsap.timeline()
      .to(counter, { v: 82, duration: 1.4, ease: 'power2.inOut', onUpdate: show })
      .to(enso, { strokeDashoffset: 90, duration: 1.4, ease: 'power2.inOut' }, 0)
      .add(function waitReady() {
        const finish = () => {
          gsap.to(counter, { v: 100, duration: .45, ease: 'power2.out', onUpdate: show });
          gsap.to(enso, { strokeDashoffset: 0, duration: .45, ease: 'power2.out', onComplete: exit });
        };
        if (ready) finish();
        else { const iv = setInterval(() => { if (ready) { clearInterval(iv); finish(); } }, 80); }
      });
  }
})();
