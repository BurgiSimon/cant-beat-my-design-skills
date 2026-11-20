/* ==========================================================================
   FX core — shared motion runtime for every effect module.
   Loaded after the vendor libs (gsap, ScrollTrigger, SplitText, Lenis) and
   before app.js and the fx modules. Modules talk to each other ONLY through
   window.FX (events + shared state); they never import each other.
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const mq = q => matchMedia(q);
  const reduce = mq('(prefers-reduced-motion: reduce)').matches;
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';

  if (hasGsap) {
    const plugins = [window.ScrollTrigger, window.SplitText].filter(Boolean);
    gsap.registerPlugin(...plugins);
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
    if (reduce) gsap.globalTimeline.timeScale(1000); // anything that still animates resolves instantly
  }

  /* ---------- tiny event bus ---------- */
  const bus = new Map();
  const on = (name, fn) => { (bus.get(name) || bus.set(name, new Set()).get(name)).add(fn); return () => bus.get(name).delete(fn); };
  const emitted = new Map();               // sticky events: late subscribers to 'once' events still fire
  const emit = (name, data) => { emitted.set(name, data); (bus.get(name) || []).forEach(fn => { try { fn(data); } catch (e) { console.error('[FX]', name, e); } }); };
  const once = (name, fn) => { if (emitted.has(name)) { fn(emitted.get(name)); return () => {}; } const off = on(name, d => { off(); fn(d); }); return off; };

  /* ---------- Lenis smooth scroll, driven by the GSAP ticker ---------- */
  let lenis = null;
  if (!reduce && hasGsap && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, autoRaf: false });
    if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    root.classList.add('fx-smooth'); // not 'has-lenis': Lenis strips /lenis(-\w+)?/ from <html> class names
  }

  /* ---------- scroll state (velocity, direction) — works with or without Lenis ---------- */
  const scroll = { y: scrollY, velocity: 0, direction: 1, progress: 0 };
  const readScroll = (e) => {
    const y = e && typeof e.scroll === 'number' ? e.scroll : scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scroll.velocity = e && typeof e.velocity === 'number' ? e.velocity : y - scroll.y;
    if (y !== scroll.y) scroll.direction = y > scroll.y ? 1 : -1;
    scroll.y = y; scroll.progress = Math.min(1, Math.max(0, y / max));
    emit('scroll', scroll);
  };
  if (lenis) lenis.on('scroll', readScroll); else addEventListener('scroll', () => readScroll(), { passive: true });

  /* ---------- pointer state (client px + normalised -1..1 around viewport centre) ---------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false };
  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
    emit('pointer', pointer);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; emit('pointer', pointer); });

  /* ---------- scroll lock (intro, overlays) ---------- */
  let locks = 0;
  const lock = () => { if (locks++ === 0) { lenis ? lenis.stop() : (root.style.overflow = 'hidden'); root.classList.add('is-locked'); } };
  const unlock = () => { if (locks > 0 && --locks === 0) { lenis ? lenis.start() : (root.style.overflow = ''); root.classList.remove('is-locked'); } };

  /* ---------- smooth anchor scrolling ---------- */
  const scrollTo = (target, opts = {}) => {
    const offset = opts.offset ?? -12;
    if (lenis) return lenis.scrollTo(target, { offset, duration: opts.duration ?? 1.4, easing: t => 1 - Math.pow(1 - t, 4), immediate: !!opts.immediate });
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const y = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + scrollY + offset : 0;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- layout helpers ---------- */
  const isDesktop = () => mq('(min-width: 1100px)').matches;   // the scaled 1:1 composition
  const unit = () => parseFloat(getComputedStyle(document.querySelector('.frame') || root).getPropertyValue('--u')) || 1;

  /* ---------- readiness: DOM + fonts (with a safety timeout) ---------- */
  const ready = new Promise(res => {
    const go = () => Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]).then(res);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go, { once: true }) : go();
  });

  /* ---------- run only while visible (IntersectionObserver helper) ---------- */
  const whenVisible = (el, onChange, rootMargin = '120px') => {
    if (!el) return () => {};
    const io = new IntersectionObserver(([en]) => onChange(en.isIntersecting), { rootMargin });
    io.observe(el); return () => io.disconnect();
  };

  /* ---------- page visibility ---------- */
  document.addEventListener('visibilitychange', () => emit('visibility', !document.hidden));

  /* ---------- refresh ScrollTrigger once everything (fonts, images) has settled ---------- */
  addEventListener('load', () => { if (window.ScrollTrigger) ScrollTrigger.refresh(); emit('load'); });

  window.FX = {
    gsap: window.gsap, ScrollTrigger: window.ScrollTrigger, SplitText: window.SplitText, lenis,
    reduce, finePointer, hasGsap,
    on, once, emit, scroll, pointer, lock, unlock, scrollTo, isDesktop, unit, ready, whenVisible,
    // the intro module emits 'intro:start', 'intro:hero' (progress 0..1), and finally 'intro:done'.
    // If no intro module is present, core emits 'intro:done' itself after ready.
    introDone: false,
  };
  on('intro:done', () => { window.FX.introDone = true; root.classList.remove('is-loading'); root.classList.add('is-ready'); });
  ready.then(() => setTimeout(() => { if (!window.FX.introRunning && !window.FX.introDone) emit('intro:done', { skipped: true }); }, 0));
})();
