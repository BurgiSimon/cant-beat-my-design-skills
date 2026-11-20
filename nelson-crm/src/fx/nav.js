/* ==========================================================================
   fx/nav — the navigation, made persistent and a little smarter

   • after intro:done, once the page is scrolled past ~140px the .nav switches
     to position:fixed with exactly the geometry it has in the hero (left /
     width / top measured from the live layout on every resize) — the switch
     happens while it's off-screen, so nothing jumps. Hides on scroll down,
     comes back on scroll up, always shown near the top; at the very top it
     returns to its original absolute placement (identical position → seamless).
   • a frosted pill behind "Sign In" while the fixed nav floats over the page
     (below the near-top zone), so the white label reads on any background.
   • a 2px scroll-progress line inside the brand box.
   • menu panel: links stagger in on open; the section in view is marked.
   • in-page anchors: smooth scroll (FX.scrollTo, offset -100), menu closes,
     URL hash updated with replaceState, focus moved to the target.

   Owns: .nav (position + transform after the intro), .fx-nav-progress,
   .menu-panel link animations / state classes. Never touches .brand,
   .nav-right (intro) or the buttons inside (cursor module).
   ========================================================================== */
(() => {
  const FX = window.FX;
  if (!FX) return;
  const fail = (where, e) => console.error('[fx:nav]', where, e);
  const safe = (where, fn) => function () {
    try { return fn.apply(this, arguments); } catch (e) { fail(where, e); return undefined; }
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const gsap = FX.hasGsap ? FX.gsap : null;
  const THRESHOLD = 140;
  const ANCHOR_OFFSET = -100;
  const SECTIONS = ['features', 'growth', 'process', 'results', 'footer'];

  const nav = $('.nav'), hero = $('.hero'), brand = $('.brand'), menu = $('#menu');
  if (!nav || !hero) return;
  nav.classList.add('fx-nav');
  const links = menu ? $$('a', menu) : [];
  const menuOpen = () => !!(menu && menu.classList.contains('open'));
  let showNav = () => {};                // set once the persistent nav is live
  const closeMenu = () => { if (menuOpen() && window.APP && window.APP.setMenu) window.APP.setMenu(false); };

  // recent user scroll input (tells a deep landing apart from a scroll in progress)
  let inputAt = -Infinity;
  const markInput = () => { inputAt = performance.now(); };
  ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, markInput, { passive: true }));

  /* ------------------------------------------------------------------
     1. scroll progress line inside the brand box
     ------------------------------------------------------------------ */
  safe('progress', () => {
    if (!brand) return;
    const line = document.createElement('span');
    line.className = 'fx-nav-progress';
    line.setAttribute('aria-hidden', 'true');
    brand.appendChild(line);
    const set = gsap ? gsap.quickSetter(line, 'scaleX') : v => { line.style.transform = 'scaleX(' + v + ')'; };
    const fromLayout = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      set(Math.min(1, Math.max(0, window.scrollY / max)));
    };
    FX.on('scroll', s => set(s.progress));
    addEventListener('resize', fromLayout);
    FX.on('load', fromLayout);
    FX.ready.then(fromLayout);
  })();

  /* ------------------------------------------------------------------
     2. menu links: label/number structure, stagger on open
     ------------------------------------------------------------------ */
  safe('menu', () => {
    links.forEach(a => {
      const num = a.querySelector('span');
      if (num) num.classList.add('fx-mn');
      Array.from(a.childNodes).forEach(n => {
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const t = document.createElement('span');
        t.className = 'fx-mt';
        t.textContent = n.textContent.trim();
        a.insertBefore(t, n);
        n.textContent = ' ';             // keeps "Features 01" as the accessible name
      });
    });
    let tween = null;
    const tidyLinks = () => links.forEach(a => { if (a.getAttribute('style') === '') a.removeAttribute('style'); });
    const menuBtn = $('.menu-btn');
    FX.on('app:menu', safe('menu:toggle', d => {
      if (tween) { tween.kill(); tween = null; if (gsap) gsap.set(links, { clearProps: 'opacity,transform' }); tidyLinks(); }
      if (!(d && d.open)) {
        // closing with focus inside (Escape): hand focus back to the toggle instead of letting
        // it fall to <body> when the panel becomes hidden (an anchor jump re-focuses its target after this)
        if (menu && menuBtn && menu.contains(document.activeElement)) { try { menuBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
        return;
      }
      showNav();
      if (!gsap || FX.reduce || !links.length) return;
      tween = gsap.fromTo(links, { y: 14, opacity: 0 }, {
        y: 0, opacity: 1, duration: .5, ease: 'power3.out', stagger: .04, delay: .02,
        clearProps: 'opacity,transform', onComplete: () => { tween = null; tidyLinks(); },
      });
    }));
  })();

  /* ------------------------------------------------------------------
     3. active section → menu link (blue number + dot, aria-current)
     ------------------------------------------------------------------ */
  safe('sections', () => {
    const ST = FX.ScrollTrigger;
    const secs = SECTIONS
      .map(id => ({ id, el: document.getElementById(id), a: links.find(l => l.getAttribute('href') === '#' + id) }))
      .filter(s => s.el && s.a);
    if (!ST || !FX.hasGsap || !secs.length) return;
    let current = null;
    const triggers = [];
    const pick = () => {
      let id = null;
      triggers.forEach((t, i) => { if (t.isActive) id = secs[i].id; });
      if (id === current) return;
      current = id;
      secs.forEach(s => {
        const on = s.id === id;
        s.a.classList.toggle('is-current', on);
        if (on) s.a.setAttribute('aria-current', 'location'); else s.a.removeAttribute('aria-current');
      });
    };
    secs.forEach((s, i) => {
      const next = secs[i + 1];
      triggers.push(ST.create({
        trigger: s.el,
        start: 'top 55%',
        endTrigger: next ? next.el : s.el,
        end: next ? 'top 55%' : 'bottom top',
        onToggle: safe('sections:toggle', pick),
      }));
    });
    pick();
  })();

  /* ------------------------------------------------------------------
     4. smooth in-page anchors
     ------------------------------------------------------------------ */
  const focusTarget = el => {
    const natural = el.matches('a[href],button,input,select,textarea,[tabindex]');
    if (!natural) {
      el.setAttribute('tabindex', '-1');
      el.setAttribute('data-fx-anchor', '');
      el.addEventListener('blur', () => { el.removeAttribute('tabindex'); el.removeAttribute('data-fx-anchor'); }, { once: true });
    }
    try { el.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  };
  document.addEventListener('click', safe('anchor', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.length < 2) return;            // href="#" → browser default, nothing special
    let id;
    try { id = decodeURIComponent(href.slice(1)); } catch (err) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    inputAt = -Infinity;                 // the jump itself (even when started with Enter) doesn't hide the nav
    const top = id === 'top';
    FX.scrollTo(top ? 0 : target, { offset: top ? 0 : ANCHOR_OFFSET });
    try { history.replaceState(history.state, '', top ? location.pathname + location.search : href); } catch (err) { /* file:// etc. */ }
    focusTarget(target);
  }));

  /* ------------------------------------------------------------------
     5. persistent nav (after the intro)
     ------------------------------------------------------------------ */
  FX.once('intro:done', safe('sticky', () => {
    if (!gsap) return;
    let mode = 'abs', shown = true, geo = null, tween = null, reach = 0;
    let lastY = window.scrollY, turnY = lastY, dir = 0;

    const tidy = () => { if (nav.getAttribute('style') === '') nav.removeAttribute('style'); };
    const fix = () => {
      const s = nav.style;
      s.position = 'fixed';
      s.top = geo.top + 'px';
      s.left = geo.left + 'px';
      s.width = geo.width + 'px';
      s.right = 'auto';
      s.zIndex = '60';
      nav.classList.add('is-fixed');
    };
    const unfix = () => {
      ['position', 'top', 'left', 'width', 'right', 'z-index'].forEach(p => nav.style.removeProperty(p));
      nav.classList.remove('is-fixed', 'is-frost');
      tidy();
    };
    // natural (absolute) geometry, read from the live layout; transforms never matter here
    const measure = () => {
      const wasFixed = mode === 'fixed';
      if (wasFixed) unfix();
      const sy = window.scrollY;
      const hr = hero.getBoundingClientRect(), nr = nav.getBoundingClientRect();
      const insetTop = parseFloat(getComputedStyle(nav).top) || 0;
      geo = { left: nr.left, width: nr.width, h: nr.height || 1, top: hr.top + sy + insetTop };
      // how far below the nav's top edge the open menu panel reaches (layout offsets: transform-free)
      reach = brand && menu ? brand.offsetTop + menu.offsetTop + menu.offsetHeight : geo.h;
      if (wasFixed) fix();
    };
    // far enough up that nothing (not even the button's antialiased edge, or an open
    // menu panel fading out) peeks in
    const hiddenPct = () => -Math.max(140, (geo.top + (menuOpen() ? Math.max(reach, geo.h) : geo.h) + 12) / geo.h * 100);
    const settle = () => { if (mode === 'abs' && shown) { gsap.set(nav, { clearProps: 'transform' }); tidy(); } };
    const animate = (pct, dur, ease, done) => {
      if (tween) tween.kill();
      tween = gsap.to(nav, { yPercent: pct, duration: dur, ease, overwrite: true, onComplete: () => { tween = null; if (done) done(); } });
    };
    // every state change re-anchors the direction tracking: the next flip needs 10px of fresh travel
    const show = () => { turnY = FX.scroll.y; if (shown) return; shown = true; animate(0, .7, 'power3.out', settle); };
    const hide = () => {
      if (!shown) return;
      if (nav.querySelector(':focus-visible')) return;     // never slide keyboard focus off-screen
      turnY = FX.scroll.y;
      shown = false; closeMenu(); animate(hiddenPct(), .5, 'power3.in');
    };
    // floating anywhere but the near-top zone (where it sits over the same sky as in the design)
    const frost = y => nav.classList.toggle('is-frost', mode === 'fixed' && y > THRESHOLD);
    const toFixedHidden = y => {
      if (tween) { tween.kill(); tween = null; }
      mode = 'fixed';
      fix();
      gsap.set(nav, { yPercent: hiddenPct() });
      shown = false;
      turnY = y;
    };

    const onScroll = () => {
      const y = FX.scroll.y;
      if (mode === 'abs') {
        // the absolute nav has long left the viewport at this point: switching while hidden is invisible.
        // With the menu open, wait until the panel has scrolled out too, then close it unseen
        // (otherwise the panel would jump and hang below the hidden nav).
        if (y > THRESHOLD && !(menuOpen() && geo.top + reach + 12 > y)) { toFixedHidden(y); closeMenu(); }
      } else if (y < 1) {
        // back at the very top: fixed and absolute placements coincide
        mode = 'abs';
        unfix();
        if (shown) { if (!tween) settle(); } else show();
      }
      if (mode === 'fixed') {
        const d = y - lastY;
        if (d) {
          const nd = d > 0 ? 1 : -1;
          if (nd !== dir) { dir = nd; turnY = lastY; }
        }
        if (y < THRESHOLD) { if (!shown) show(); }
        else if (dir > 0 && shown && y - turnY > 10) {
          // only a scroll the visitor drives hides the nav: scroll anchoring after a late font /
          // image settle, or a jump they asked for from the nav itself, leaves it where it is
          if (performance.now() - inputAt < 1500) hide(); else turnY = y;
        }
        else if (dir < 0 && !shown && turnY - y > 10) show();
        frost(y);
      }
      lastY = y;
    };

    let rq = 0;
    const remeasure = () => {
      cancelAnimationFrame(rq);
      rq = requestAnimationFrame(safe('measure', () => {
        measure();
        if (mode === 'fixed') {
          if (!shown) gsap.set(nav, { yPercent: hiddenPct() });
          frost(FX.scroll.y);
        }
      }));
    };

    measure();
    showNav = safe('showNav', () => { if (mode === 'fixed') show(); });
    const y0 = window.scrollY;
    if (y0 > THRESHOLD) {
      // landed deep in the page (hash link): present the nav, unless the visitor is already scrolling
      toFixedHidden(y0);
      lastY = y0;
      frost(y0);
      if (performance.now() - inputAt > 400) show();
    }

    FX.on('scroll', safe('scroll', onScroll));
    nav.addEventListener('focusin', () => showNav());
    addEventListener('resize', remeasure);
    FX.on('load', remeasure);
    if (FX.ScrollTrigger) FX.ScrollTrigger.addEventListener('refresh', remeasure);
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(hero);
  }));
})();
