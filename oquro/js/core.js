// The shared runtime: GSAP and its plugins, Lenis smooth scrolling (mouse and trackpad only), a small event bus,
// pointer and scroll state, and helpers every module uses. Modules talk through the bus and never import each other.

export const root = document.documentElement;
export const calm = root.classList.contains('is-calm');               // prefers-reduced-motion, or ?reduced
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const gsap = window.gsap || null;
export const ScrollTrigger = (!calm && window.ScrollTrigger) || null;
export const SplitText = window.SplitText || null;

if (gsap) {
  gsap.registerPlugin(...[window.ScrollTrigger, SplitText].filter(Boolean));
  gsap.defaults({ ease: 'power3.out', duration: 0.9 });
  if (calm && window.ScrollTrigger) window.ScrollTrigger.disable();
}

// ---- events (sticky: a late listener to an event that has already happened still hears it) ----
const bus = new Map();
const seen = new Map();
export function on(name, fn) {
  if (!bus.has(name)) bus.set(name, new Set());
  bus.get(name).add(fn);
  return () => bus.get(name).delete(fn);
}
export function emit(name, data) {
  seen.set(name, data);
  for (const fn of bus.get(name) || []) {
    try { fn(data); } catch (e) { console.error('[oquro]', name, e); }
  }
}
export function once(name, fn) {
  if (seen.has(name)) { fn(seen.get(name)); return () => {}; }
  const off = on(name, (d) => { off(); fn(d); });
  return off;
}

// ---- Lenis, on the GSAP ticker, only where there is a wheel to smooth ----
export let lenis = null;
if (!calm && fine && gsap && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.095, smoothWheel: true, syncTouch: false, autoRaf: false });
  if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ---- scroll state ----
export const scroll = { y: scrollY, v: 0, dir: 1 };
function readScroll(e) {
  const y = e && typeof e.scroll === 'number' ? e.scroll : scrollY;
  scroll.v = e && typeof e.velocity === 'number' ? e.velocity : y - scroll.y;
  if (y !== scroll.y) scroll.dir = y > scroll.y ? 1 : -1;
  scroll.y = y;
  emit('scroll', scroll);
}
if (lenis) lenis.on('scroll', readScroll); else addEventListener('scroll', () => readScroll(), { passive: true });

// ---- pointer: px, and -1..1 around the middle of the screen ----
export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false, down: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && !pointer.down) return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  emit('pointer', pointer);
}, { passive: true });
addEventListener('pointerdown', (e) => { pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; emit('pointer', pointer); });

// ---- scroll lock (intro) ----
let locks = 0;
export function lock() { if (locks++ === 0) { if (lenis) lenis.stop(); else root.style.overflow = 'hidden'; } }
export function unlock() { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); else root.style.overflow = ''; } }

// ---- smooth anchors ----
export function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (lenis) { lenis.scrollTo(el ?? 0, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  const y = el && el !== 0 ? el.getBoundingClientRect().top + scrollY + offset : 0;
  scrollTo({ top: y, behavior: calm || immediate ? 'auto' : 'smooth' });
}

// ---- ready: the DOM and the fonts (or 2.5 s, whichever comes first) ----
export const ready = new Promise((res) => {
  const go = () => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 2500))]).then(res);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
});

// ---- run something only while an element is near the screen (and the tab is visible) ----
export function whenVisible(el, fn, rootMargin = '120px') {
  if (!el) return () => {};
  let inView = false;
  const tell = () => fn(inView && !document.hidden);
  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; tell(); }, { rootMargin });
  io.observe(el);
  document.addEventListener('visibilitychange', tell);
  return () => { io.disconnect(); document.removeEventListener('visibilitychange', tell); };
}

// ---- a loop that only runs while asked to (on the GSAP ticker when there is one) ----
export function loop(fn) {
  let on = false; let last = 0; let raf = 0;
  const tick = (t) => { const now = t * 1000; const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; fn(dt, now / 1000); };
  const rafTick = (t) => { tick(t / 1000); if (on) raf = requestAnimationFrame(rafTick); };
  return {
    set(v) {
      if (v === on) return;
      on = v; last = 0;
      if (gsap) { if (on) gsap.ticker.add(tick); else gsap.ticker.remove(tick); }
      else if (on) raf = requestAnimationFrame(rafTick); else cancelAnimationFrame(raf);
    },
    get on() { return on; },
  };
}

// ---- small maths ----
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function seeded(seed) { // mulberry32: the same numbers on every load
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const fmt = (v, dec = 0) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// A smooth path through points (Catmull-Rom, as cubic Béziers).
export function smoothPath(pts, tension = 0.5) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

// ---- WebGL: can we, and how sharp ----
export const gl = (() => {
  if (/[?&]nogl/.test(location.search)) return null;
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2');
    if (!ctx) return null;
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    ctx.getExtension('WEBGL_lose_context')?.loseContext();
    const soft = /swiftshader|llvmpipe|software/i.test(name);
    const small = Math.min(screen.width, screen.height) < 600;
    return { soft, small, tier: soft ? 0 : small ? 1 : 2 };
  } catch (e) { return null; }
})();
export const dpr = (max = 2) => Math.min(max, devicePixelRatio || 1);

// ---- the intro: if nothing runs one, the page is simply ready ----
export function markReady() {
  root.classList.add('is-ready');
  try { sessionStorage.setItem('oquro:seen', '1'); } catch (e) { /* private mode */ }
  emit('intro:done');
}
addEventListener('load', () => { if (ScrollTrigger) ScrollTrigger.refresh(); });
