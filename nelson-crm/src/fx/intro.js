/* ==========================================================================
   fx/intro — preloader + first-viewport entrance

   Paths
     full     first visit: white overlay, Nelson mark draws in, a Gambetta
              counter 0 → 100 tracks real loading (fonts, hero/statue decode,
              hero-gl textures when that module is present, window load;
              min 1.25 s, max 4 s), then the overlay wipes upward while the
              hero opens from an inset card and the first viewport settles.
     short    repeat visit in the same session: no counter, ~1 s reveal.
     hash     URL has a #target: no preloader; jump to the target, fade the cover.
     instant  prefers-reduced-motion or no GSAP: nothing animates, events fire now.

   Events: intro:start → intro:hero {progress 0..1} (hero-gl tears the painting
   open with it) → intro:done. FX.lock() + .page[inert] while covered (released
   as soon as the hero has opened); a 7 s watchdog (counted from when the tab
   is visible) always force-finishes.
   Every inline prop set here is cleared at the end, so the rest state is
   exactly the stylesheet's.

   Owns: the overlay; .hero clip-path + transform (scale); .brand / .nav-right
   (container opacity + transform); .intro h1 (SplitText lines, reverted);
   .proof (+ its parts); .logos (opacity only).
   ========================================================================== */
window.FX && (window.FX.introRunning = true);
(() => {
  const FX = window.FX;
  const root = document.documentElement;
  if (!FX) { root.classList.remove('is-loading'); return; }

  const gsap = FX.hasGsap ? FX.gsap : null;
  const T0 = performance.now();
  const KEY = 'nelson:intro-seen';
  const MIN = 1.25;         // s — shortest counter run
  const MAX = 4.0;          // s from script start — loading is considered done after this
  const WATCHDOG = 7000;    // ms — force-finish no matter what
  const ANCHOR_OFFSET = -100;
  const $ = (s, r = document) => r.querySelector(s);
  const fail = (where, e) => console.error('[fx:intro]', where, e);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // clip-paths are driven through proxies: the browser normalises inset() strings
  // (inset(10% 8% 10% 8%) reads back as inset(10% 8%)), which breaks string tweening
  const insetCSS = (t, r, b, l) => `inset(${t}% ${r}% ${b}% ${l}%)`;
  let heroInset = [10, 8];
  const heroClip = k => {
    if (!els.hero) return;
    const [v, h] = heroInset;
    els.hero.style.clipPath = k <= 0 ? insetCSS(0, 0, 0, 0) : insetCSS(v * k, h * k, v * k, h * k);
  };
  const wipeUp = (el, vars) => {
    const o = { k: 0 };
    el.style.clipPath = insetCSS(0, 0, 0, 0);
    return gsap.to(o, Object.assign({}, vars, { k: 1, onUpdate: () => { el.style.clipPath = insetCSS(0, 0, +(o.k * 100).toFixed(3), 0); } }));
  };

  const els = {};
  let overlay = null, split = null, loaderTick = null, loaderTl = null, exitTl = null;
  let watchdog = 0, onVisible = null, prepared = false, locked = false, started = false, doneEmitted = false, finished = false, heroP = -1;

  /* ---------------- events ---------------- */
  const emitStart = (fromZero) => { if (started) return; started = true; FX.emit('intro:start', {}); if (fromZero && heroP < 0) emitHero(0); };
  const emitHero = p => { if (p === heroP) return; heroP = p; FX.emit('intro:hero', { progress: p }); };
  const emitDone = reason => {
    if (doneEmitted) return;
    emitStart();
    if (heroP < 1) emitHero(1);
    doneEmitted = true;
    FX.introRunning = false;
    FX.emit('intro:done', { reason });
  };
  // while covered, nothing behind the overlay can take focus or clicks (released at unlock / finish)
  const setInert = on => { try { if (els.page) els.page.inert = on; } catch (e) { /* noop */ } };
  const unlock = () => { setInert(false); if (!locked) return; locked = false; try { FX.unlock(); } catch (e) { /* noop */ } };
  const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const markSeen = () => { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ } };

  const toTop = () => {
    try {
      window.scrollTo(0, 0);
      if (FX.lenis) FX.lenis.scrollTo(0, { immediate: true, force: true });
    } catch (e) { /* noop */ }
  };

  /* ---------------- teardown: always lands on the designed rest state ---------------- */
  function clear(targets, props) {
    const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (!list.length) return;
    if (gsap) gsap.set(list, { clearProps: props });
    else {
      const css = props.split(',').map(p => p.trim().replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
      list.forEach(el => css.forEach(p => el.style.removeProperty(p)));
    }
    list.forEach(el => { if (el.getAttribute('style') === '') el.removeAttribute('style'); });
  }
  function restore() {
    try { if (split) split.revert(); } catch (e) { fail('revert', e); }
    split = null;
    if (!prepared) return;
    clear(els.hero, 'clipPath,transform');
    clear([els.brand, els.navRight], 'opacity,transform');
    clear(els.proof, 'transform');
    clear(els.parts, 'opacity');
    clear(els.rules, 'opacity,transform,transformOrigin');
    clear(els.h1, 'opacity,transform');
    clear(els.logos, 'opacity');
  }
  function finish(reason) {
    if (finished) return;
    finished = true;
    setInert(false);
    clearTimeout(watchdog);
    if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    try { if (loaderTick && gsap) gsap.ticker.remove(loaderTick); } catch (e) { /* noop */ }
    [loaderTl, exitTl].forEach(t => { try { if (t) t.kill(); } catch (e) { /* noop */ } });
    try { restore(); } catch (e) { fail('restore', e); }
    try { if (overlay) overlay.remove(); } catch (e) { /* noop */ }
    overlay = null;
    root.classList.add('fx-intro-mounted');
    root.classList.remove('fx-intro-run');
    if (els.page) els.page.removeAttribute('aria-busy');
    unlock();
    emitDone(reason);
  }

  /* ---------------- DOM ---------------- */
  function grab() {
    els.page = $('.page');
    els.hero = $('.hero');
    els.brand = $('.brand');
    els.navRight = $('.nav-right');
    els.h1 = $('.intro h1');
    els.proof = $('.proof');
    els.logos = $('.logos');
    const kids = els.proof ? Array.from(els.proof.children) : [];
    els.rules = kids.filter(k => k.classList.contains('rule'));
    els.parts = kids.filter(k => !k.classList.contains('rule'));
  }
  function mount(withContent, locking) {
    overlay = document.createElement('div');
    overlay.className = 'fx-intro';
    overlay.setAttribute('aria-hidden', 'true');
    if (withContent) {
      overlay.innerHTML =
        '<div class="fx-intro__brand"><span class="fx-intro__mask"><span class="fx-intro__word">' +
          '<svg class="fx-intro__mark"><use href="#i-mark"/></svg><span>Nelson</span></span></span></div>' +
        '<div class="fx-intro__count"><span class="fx-intro__mask"><span class="fx-intro__num">0</span></span></div>' +
        '<div class="fx-intro__line"><span class="fx-intro__fill"></span></div>';
    }
    document.body.appendChild(overlay);
    // same task as the append: the pseudo cover retires exactly when the real one exists
    root.classList.add('fx-intro-mounted', 'fx-intro-run');
    if (els.page) els.page.setAttribute('aria-busy', 'true');
    if (locking) setInert(true);
  }

  /* hidden start state of the first viewport (behind the overlay) */
  function prepare(short) {
    const g = gsap;
    prepared = true;
    heroInset = short ? [3.5, 3] : [10, 8];
    if (els.hero) { heroClip(1); g.set(els.hero, { scale: short ? 1.025 : 1.04 }); }
    g.set([els.brand, els.navRight].filter(Boolean), { opacity: 0, y: -16 });
    if (els.proof) g.set(els.proof, { y: 14 });
    if (els.parts.length) g.set(els.parts, { opacity: 0 });
    els.rules.forEach((r, i) => g.set(r, { scaleX: 0, opacity: 0, transformOrigin: i === 0 ? '100% 50%' : '0% 50%' }));
    if (els.h1) g.set(els.h1, { opacity: 0 });
    if (els.logos) g.set(els.logos, { opacity: 0 });
  }

  /* h1 lines in masks — only once the serif is in, so the line breaks are final */
  function splitH1() {
    if (split || !els.h1) return;
    if (FX.SplitText) {
      try {
        split = new FX.SplitText(els.h1, { type: 'lines', mask: 'lines', linesClass: 'fx-intro-line', aria: 'auto' });
        gsap.set(split.lines, { yPercent: 108 });
        gsap.set(els.h1, { clearProps: 'opacity' });
        return;
      } catch (e) { fail('split', e); split = null; }
    }
    gsap.set(els.h1, { opacity: 0, y: 26 });
  }

  /* the first-viewport choreography (shared by the full and short paths) */
  const FULL = { hero: 1.4, tearAt: .15, tear: 1.75, proofAt: .55, h1At: .6, text: 1.2, stagger: .1, navAt: .95, nav: 1.0, logosAt: .9, logos: .9 };
  const SHORT = { hero: .95, tearAt: 0, tear: .95, proofAt: .2, h1At: .22, text: .95, stagger: .07, navAt: .45, nav: .8, logosAt: .35, logos: .7 };
  function entrance(c) {
    const t = gsap.timeline();
    if (els.hero) {
      const hc = { k: 1 };
      t.to(hc, { k: 0, duration: c.hero, ease: 'expo.inOut', onUpdate: () => heroClip(hc.k) }, 0)
       .to(els.hero, { scale: 1, duration: c.hero, ease: 'expo.inOut' }, 0);
    }
    const pr = { p: 0 };
    t.to(pr, { p: 1, duration: c.tear, ease: 'power1.inOut', onUpdate: () => emitHero(pr.p), onComplete: () => emitHero(1) }, c.tearAt);
    if (split) t.to(split.lines, { yPercent: 0, duration: c.text, ease: 'expo.out', stagger: c.stagger }, c.h1At);
    else if (els.h1) t.to(els.h1, { opacity: 1, y: 0, duration: c.text, ease: 'expo.out' }, c.h1At);
    if (els.proof) t.to(els.proof, { y: 0, duration: c.text, ease: 'expo.out' }, c.proofAt);
    if (els.parts.length) t.to(els.parts, { opacity: 1, duration: c.text * .7, ease: 'power2.out', stagger: .07 }, c.proofAt + .04);
    if (els.rules.length) t.to(els.rules, { scaleX: 1, opacity: 1, duration: c.text * 1.1, ease: 'expo.out' }, c.proofAt + .14);
    if (els.brand) t.to(els.brand, { opacity: 1, y: 0, duration: c.nav, ease: 'expo.out' }, c.navAt);
    if (els.navRight) t.to(els.navRight, { opacity: 1, y: 0, duration: c.nav, ease: 'expo.out' }, c.navAt + .08);
    if (els.logos) t.to(els.logos, { opacity: 1, duration: c.logos, ease: 'power2.out' }, c.logosAt);
    return t;
  }

  /* ---------------- real loading ---------------- */
  function decode(src) {
    return new Promise(res => {
      if (!src) { res(); return; }
      const img = new Image();
      img.decoding = 'async';
      const done = () => res();
      img.onerror = done;
      img.src = src;
      if (img.decode) img.decode().then(done, done); else img.onload = done;
    });
  }
  function heroURL() {
    try {
      const m = /url\((['"]?)(.*?)\1\)/.exec(getComputedStyle(els.hero).backgroundImage || '');
      if (m) return m[2];
    } catch (e) { /* noop */ }
    return 'assets/hero.jpg';
  }
  function loadingTasks() {
    const hasGL = !!document.querySelector('canvas.hero-gl, script[data-src="fx/hero-gl.js"]');
    const tasks = [
      FX.ready,
      decode(heroURL()),
      decode('assets/statue.jpg'),
      document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true })),
    ];
    // the textures hero-gl needs for its first frame (same URLs → it gets cache hits)
    if (hasGL) tasks.push(decode('assets/hero-mask.png'), decode('assets/hero-gl-plate.jpg'));
    return tasks;
  }
  const loaderFonts = () => {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      Promise.all([document.fonts.load('500 22px Inter'), document.fonts.load('300 120px Gambetta')]).catch(() => {}),
      wait(700),
    ]);
  };

  /* ---------------- paths ---------------- */
  async function runFull() {
    FX.lock(); locked = true;
    mount(true, true);
    prepare(false);
    markSeen();

    const word = $('.fx-intro__word', overlay), num = $('.fx-intro__num', overlay);
    const mark = $('.fx-intro__mark', overlay), fill = $('.fx-intro__fill', overlay);
    gsap.set([word, num], { yPercent: 110 });
    gsap.set(mark, { strokeDashoffset: 27 });

    // count real work
    const tasks = loadingTasks();
    let ready = 0;
    tasks.forEach(p => Promise.resolve(p).then(() => { ready++; }, () => { ready++; }));

    await loaderFonts();
    if (finished) return;
    toTop();

    const setFill = gsap.quickSetter(fill, 'scaleX');
    // the loader's clock starts on the first frame actually drawn: a tab opened in the
    // background (rAF paused) still gets its mark/word rise and a real count when shown
    let L0 = -1, last = 0, smooth = 0, shown = 0, label = -1;
    loaderTick = () => {
      try {
        const now = performance.now();
        if (L0 < 0) {
          L0 = last = now;
          loaderTl = gsap.timeline()
            .to(word, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 0)
            .to(mark, { strokeDashoffset: 0, duration: 1.15, ease: 'power3.inOut' }, .05)
            .to(num, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, .1);
        }
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        const real = (now - T0) / 1000 >= MAX ? 1 : ready / tasks.length;
        smooth += (real - smooth) * (1 - Math.pow(.8, dt * 60));
        if (real >= 1 && smooth > .985) smooth = 1;
        const x = Math.min(1, (now - L0) / 1000 / MIN);
        const cap = x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;   // power2.inOut over MIN
        shown = Math.max(shown, Math.min(smooth, cap));
        const n = Math.round(shown * 100);
        if (n !== label) { label = n; num.textContent = n; }
        setFill(shown);
        if (shown >= 1) {
          gsap.ticker.remove(loaderTick); loaderTick = null;
          gsap.delayedCall(.12, () => { try { exitFull(word, num, fill); } catch (e) { fail('exit', e); finish('error'); } });
        }
      } catch (e) {
        fail('loader', e);
        gsap.ticker.remove(loaderTick); loaderTick = null;
        finish('error');
      }
    };
    gsap.ticker.add(loaderTick);
  }

  async function exitFull(word, num, fill) {
    if (finished) return;
    await Promise.race([FX.ready, wait(600)]);   // the serif must be in before the h1 is split
    if (finished) return;
    splitH1();
    toTop();
    emitStart(true);
    exitTl = gsap.timeline({ onComplete: () => finish('complete') })
      .to([word, num], { yPercent: -110, duration: .55, ease: 'power3.in', stagger: .05 }, 0)
      .to(fill, { scaleX: 0, transformOrigin: '100% 50%', duration: .7, ease: 'power3.inOut' }, 0)
      .add(wipeUp(overlay, { duration: 1.1, ease: 'expo.inOut' }), .1)
      .add(() => { if (overlay) overlay.style.pointerEvents = 'none'; }, .7)
      .add(entrance(FULL), .1)
      .add(unlock, 1.5);   // interactive as soon as the hero has opened; the last settles finish under the user
  }

  async function runShort() {
    FX.lock(); locked = true;
    mount(false, true);
    prepare(true);
    await Promise.race([FX.ready, wait(1200)]);
    if (finished) return;
    splitH1();
    toTop();
    emitStart(true);
    exitTl = gsap.timeline({ onComplete: () => finish('short') })
      .add(wipeUp(overlay, { duration: .8, ease: 'expo.inOut' }), 0)
      .add(() => { if (overlay) overlay.style.pointerEvents = 'none'; }, .4)
      .add(entrance(SHORT), 0)
      .add(unlock, .8);
  }

  async function runHash(target) {
    mount(false);                         // plain white cover, no lock: the visitor asked for a place
    // Chrome keeps re-anchoring to the fragment until window load, so jump after it (capped)
    let moved = false;
    const touched = () => { moved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, touched, { once: true, passive: true }));
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true }));
    const jump = () => {
      try {
        const y = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY + ANCHOR_OFFSET));
        window.scrollTo(0, y);
        if (FX.lenis) FX.lenis.scrollTo(y, { immediate: true, force: true });   // keep Lenis' own position in sync
      } catch (e) { /* noop */ }
    };
    await Promise.race([Promise.all([FX.ready, loaded]), wait(1500)]);
    if (finished) return;
    jump();
    loaded.then(() => requestAnimationFrame(() => { if (!moved) jump(); }));   // a late load re-anchors: put it back
    await new Promise(r => requestAnimationFrame(() => r()));
    if (finished) return;
    emitDone('hash');                     // the page underneath is final; fade the cover off it
    exitTl = gsap.to(overlay, { opacity: 0, duration: .6, ease: 'power2.out', onComplete: () => finish('hash') });
  }

  function runInstant() {
    root.classList.add('fx-intro-mounted');
    FX.introRunning = false;
    finished = true;
    emitStart();
    emitHero(1);
    emitDone('instant');
  }

  /* ---------------- go ---------------- */
  try {
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* noop */ }
    let hashTarget = null;
    const h = location.hash;
    if (h && h.length > 1 && h !== '#top') {
      try { hashTarget = document.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { hashTarget = null; }
    }
    if (!hashTarget) toTop();

    if (FX.reduce || !gsap) { runInstant(); return; }

    grab();
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        try { finish('watchdog'); } catch (e) { fail('watchdog', e); }
      }, WATCHDOG);
    };
    arm();
    // loaded in a background tab: count the 7 s from the moment it is shown, so the intro
    // (which can't progress while rAF is paused) isn't cut mid-exit; still force-finishes
    // if it then stalls. While hidden the original timer still finishes it unseen.
    onVisible = () => { if (!finished && !document.hidden) arm(); };
    document.addEventListener('visibilitychange', onVisible);

    const run = hashTarget ? runHash(hashTarget) : seen() ? runShort() : runFull();
    Promise.resolve(run).catch(e => { fail('run', e); finish('error'); });
  } catch (e) {
    fail('init', e);
    try { finish('error'); } catch (e2) { emitDone('error'); }
  }
})();
