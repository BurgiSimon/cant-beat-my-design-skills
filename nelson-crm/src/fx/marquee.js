/* ==========================================================================
   fx/marquee — the logo strip as a living, scroll-aware loop

   • replaces style.css's CSS keyframe marquee (.logo-track, 38s per set) with
     a ticker-driven loop at exactly the same base speed (one set of 7 cells
     per 38s at any scale), starting from x = 0 so the first frame is the
     design. The loop eases in from rest once the intro is done.
   • scroll velocity boosts it (soft-saturating curve, ~6x at most) and the
     scroll direction steers it: scrolling up runs it backwards. When the
     scroll settles it glides back to the base speed and direction.
   • hover (fine pointer) eases it down to 0.25x; leaving eases it back.
   • the ticker callback is only attached while the strip is near the
     viewport and the tab is visible; no layout reads per frame (the period
     is measured on init / load and by a ResizeObserver on the track).
   • reduced motion: nothing runs here — style.css keeps the strip static at 0.
   • any failure restores the CSS loop (class removed, inline transform gone).

   Owns: .logo-track transform (+ .fx-marquee on .logos, which disables the
   CSS animation); logo-cell hover styling (marquee.css).
   ========================================================================== */
(() => {
  const FX = window.FX;
  if (!FX) return;
  const log = (where, e) => { try { console.error('[fx:marquee]', where, e); } catch (_) { /* noop */ } };
  if (FX.reduce || !FX.hasGsap) return;          // reduced motion: static (style.css); no GSAP: the CSS loop stays

  const gsap = FX.gsap;
  const logos = document.querySelector('.logos');
  const track = logos && logos.querySelector('.logo-track');
  if (!track) return;

  const SET_SECONDS = 38;       // style.css: one set per 38s — same feel
  const BOOST_MAX = 5;          // extra multiplier on top of the base (=> 6x)
  const BOOST_SCALE = 1100;     // px/s of scroll for ~63% of the boost
  const MOVING = 24;            // px/s below which the page counts as "not scrolling"
  const ATTACK = 0.2;           // s — time constant while scrolling
  const RELEASE = 0.8;          // s — time constant back to base
  const HOVER = 0.25;
  const TELEPORT = 600;         // px in one frame: treated as a jump, ignored

  const cells = Array.from(track.children);
  const n = Math.floor(cells.length / 2);
  if (n < 1) return;

  let dead = false, ticking = false, started = false, near = false;
  let period = 0, x = 0, factor = 0, vel = 0, lastY = FX.scroll.y, written = null;
  let base0 = 0, hx = null, hoverCell = -1;
  const hover = { m: 1 };
  const cleanups = [];

  const write = () => {
    const v = Math.round(x * 100) / 100;
    if (v === written) return;
    written = v;
    track.style.transform = `translate3d(${v}px, 0, 0)`;
  };

  // The hovered cell is tracked here, not by :hover: a pointer that rests on the
  // strip never re-hit-tests while the cells slide under it, so :hover would stay
  // on a logo that has drifted away. Pure arithmetic on cached geometry.
  const setCell = i => {
    if (i === hoverCell) return;
    if (hoverCell >= 0 && cells[hoverCell]) cells[hoverCell].classList.remove('fx-hover');
    hoverCell = i;
    if (i >= 0 && cells[i]) cells[i].classList.add('fx-hover');
  };
  const trackHover = () => {
    if (hx === null || !(period > 0)) { setCell(-1); return; }
    const i = Math.floor((hx - base0 - (written || 0)) / (period / n));
    setCell(i >= 0 && i < cells.length ? i : -1);
  };

  const teardown = () => {
    if (dead) return;
    dead = true;
    try { gsap.ticker.remove(tick); } catch (_) { /* noop */ }
    cleanups.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
    try { gsap.killTweensOf(hover); } catch (_) { /* noop */ }
    try { setCell(-1); } catch (_) { /* noop */ }
    track.style.transform = '';
    logos.classList.remove('fx-marquee');        // the CSS loop takes over again
  };

  // exact period of one set (subpixel): distance between cell 0 and its duplicate
  function measure() {
    const w0 = written || 0;
    const a = cells[0].getBoundingClientRect(), b = cells[n].getBoundingClientRect();
    const p = b.left - a.left;
    if (!(p > 1)) return;
    base0 = a.left - w0;                           // the track's untranslated left edge
    if (period > 0 && p !== period) x *= p / period;   // keep the phase across resizes
    period = p;
    wrap();
    write();
    trackHover();
  }
  function wrap() {
    if (!(period > 0)) return;
    x %= period;                                   // (-period, period)
    if (x > 0) x -= period;                        // (-period, 0]
  }

  function tick(time, deltaMs) {
    if (dead) return;
    try {
      const dt = Math.min(Math.max((deltaMs || 16.7) / 1000, 0.001), 0.1);
      const y = FX.scroll.y;
      // a jump (immediate scrollTo, restored position) is a teleport, not a speed
      const raw = Math.abs(y - lastY) > TELEPORT ? 0 : (y - lastY) / dt;
      lastY = y;
      vel += (raw - vel) * (1 - Math.exp(-dt / 0.06));   // de-jitter the per-frame velocity
      const speed = Math.abs(vel);
      const scrolling = speed > MOVING;
      let target = started ? 1 : 0;
      if (started && scrolling) target = Math.sign(vel) * (1 + BOOST_MAX * (1 - Math.exp(-speed / BOOST_SCALE)));
      factor += (target - factor) * (1 - Math.exp(-dt / (scrolling ? ATTACK : RELEASE)));
      if (!(period > 0)) return;
      x -= (period / SET_SECONDS) * factor * hover.m * dt;
      wrap();
      write();
      if (hx !== null) trackHover();
    } catch (e) { log('tick', e); teardown(); }
  }

  const sync = () => {
    if (dead) return;
    const run = near && !document.hidden;
    if (run === ticking) return;
    ticking = run;
    if (run) {
      lastY = FX.scroll.y; vel = 0;                // no velocity spike from the time spent away
      gsap.ticker.add(tick);
    } else {
      gsap.ticker.remove(tick);
    }
  };

  try {
    logos.classList.add('fx-marquee');            // CSS animation off: from here on the loop owns the track
    x = 0;
    write();
    measure();

    cleanups.push(FX.whenVisible(logos, v => { near = v; sync(); }, '80px'));
    cleanups.push(FX.on('visibility', sync));

    // re-measure the moment the cells change size. A ResizeObserver on the track
    // runs after layout and before paint, so no frame is ever drawn with a stale
    // period (a debounced resize showed a blank gap at the strip's end meanwhile).
    const remeasure = where => () => { try { measure(); } catch (e) { log(where, e); } };
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(remeasure('ro'));
      ro.observe(track);                           // its width = 2 sets: changes exactly with the period
      cleanups.push(() => ro.disconnect());
    } else {
      let rf = 0;
      const onResize = () => { if (!rf) rf = requestAnimationFrame(() => { rf = 0; remeasure('resize')(); }); };
      addEventListener('resize', onResize, { passive: true });
      cleanups.push(() => { removeEventListener('resize', onResize); cancelAnimationFrame(rf); });
    }
    cleanups.push(FX.on('load', () => { try { measure(); } catch (e) { log('load', e); } }));
    FX.ready.then(() => { try { if (!dead) measure(); } catch (e) { log('ready', e); } });

    // hover: ease down to a quarter, ease back up on leave (mouse / pen only)
    if (FX.finePointer) {
      const isMouse = e => !e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen';
      const enter = e => {
        if (!isMouse(e)) return;
        hx = e.clientX; trackHover();
        gsap.to(hover, { m: HOVER, duration: 0.9, ease: 'power2.out', overwrite: true });
      };
      const move = e => { if (isMouse(e)) { hx = e.clientX; trackHover(); } };
      const leave = e => {
        if (!isMouse(e)) return;
        hx = null; setCell(-1);
        gsap.to(hover, { m: 1, duration: 1.2, ease: 'power2.inOut', overwrite: true });
      };
      logos.addEventListener('pointerenter', enter);
      logos.addEventListener('pointermove', move, { passive: true });
      logos.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        logos.removeEventListener('pointerenter', enter);
        logos.removeEventListener('pointermove', move);
        logos.removeEventListener('pointerleave', leave);
      });
    }

    // the loop eases in from rest once the page has been revealed
    FX.once('intro:done', () => { started = true; });
  } catch (e) {
    log('init', e);
    teardown();
  }
})();
