// The shared runtime: GSAP (+ ScrollTrigger), Lenis on the GSAP ticker where there is a wheel to smooth, a small
// sticky event bus, pointer and scroll state, and helpers the modules share. Modules talk through the bus and never
// import each other.

export const root = document.documentElement;
export const calm = root.classList.contains('is-calm');                 // prefers-reduced-motion, or ?reduced
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const gsap = window.gsap || null;
export const ScrollTrigger = (!calm && window.ScrollTrigger) || null;

if (gsap) {
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 0.8 });
  if (calm && window.ScrollTrigger) window.ScrollTrigger.disable();
}

// ---- events (sticky: a late listener to an event that already happened still hears it) ----
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
    try { fn(data); } catch (e) { console.error('[unorouter]', name, e); }
  }
}
export function once(name, fn) {
  if (seen.has(name)) { fn(seen.get(name)); return () => {}; }
  const off = on(name, (d) => { off(); fn(d); });
  return off;
}

// ---- Lenis, on the GSAP ticker ----
export let lenis = null;
if (!calm && fine && gsap && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false, autoRaf: false });
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

// ---- pointer, in px ----
export const pointer = { x: -1e4, y: -1e4, active: false, down: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  emit('pointer', pointer);
}, { passive: true });
addEventListener('pointerdown', (e) => { pointer.down = true; emit('press', { x: e.clientX, y: e.clientY, type: e.pointerType, target: e.target }); }, { passive: true });
addEventListener('pointerup', () => { pointer.down = false; }, { passive: true });
root.addEventListener('pointerleave', () => { pointer.active = false; emit('pointer', pointer); });

// ---- scroll lock (menu, boot) ----
let locks = 0;
export function lock() { if (locks++ === 0) { if (lenis) lenis.stop(); root.style.overflow = 'hidden'; } }
export function unlock() { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); root.style.overflow = ''; } }

// ---- smooth anchors ----
export function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const top = getComputedStyle(root).scrollPaddingTop;
  const pad = el && el.id !== 'top' ? -(parseFloat(top) || 0) : 0;
  if (lenis) { lenis.scrollTo(el ?? 0, { offset: offset + pad, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  const y = el && el.id !== 'top' ? el.getBoundingClientRect().top + scrollY + offset + pad : 0;
  scrollTo({ top: y, behavior: calm || immediate ? 'auto' : 'smooth' });
}

// ---- ready: the DOM and the fonts (or 2.5 s, whichever comes first) ----
export const ready = new Promise((res) => {
  const go = () => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 2500))]).then(res);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
});

// ---- run something only while an element is near the screen ----
export function whenVisible(el, fn, rootMargin = '120px') {
  if (!el) return () => {};
  const io = new IntersectionObserver(([en]) => fn(en.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

// A requestAnimationFrame loop that runs only while its element is on screen and the tab is visible.
export function loop(el, frame, { margin = '120px' } = {}) {
  let raf = 0; let last = 0; let onScreen = false; let t = 0;
  const tick = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; t += dt; // rAF's stamp can precede start()
    if (frame(dt, t) === false) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  whenVisible(el, (v) => { onScreen = v; if (v) start(); else stop(); }, margin);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  return { start, stop, get running() { return !!raf; } };
}

// ---- small maths ----
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const mod = (a, m) => ((a % m) + m) % m;
export function seeded(seed) { // mulberry32: the same numbers on every load
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash2 = (i, j) => { // 0..1 for an integer pair
  let t = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
};

// Smooth 3D value noise, 0..1 — enough for colour fields on a few thousand cells.
const P = new Uint8Array(512);
{ const r = seeded(7); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const g3 = (h, x, y, z) => { const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise3(x, y, z) { // Perlin, mapped to 0..1
  const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x); const v = fade(y); const w = fade(z);
  const A = P[X] + Y; const AA = P[A] + Z; const AB = P[A + 1] + Z; const B = P[X + 1] + Y; const BA = P[B] + Z; const BB = P[B + 1] + Z;
  const n = lerp(
    lerp(lerp(g3(P[AA] & 15, x, y, z), g3(P[BA] & 15, x - 1, y, z), u), lerp(g3(P[AB] & 15, x, y - 1, z), g3(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(g3(P[AA + 1] & 15, x, y, z - 1), g3(P[BA + 1] & 15, x - 1, y, z - 1), u), lerp(g3(P[AB + 1] & 15, x, y - 1, z - 1), g3(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w);
  return n * 0.5 + 0.5;
}

// The four hot colours, in the order the shot cycles through them: yellow → orange → pink → magenta → yellow.
export const PALETTE = ['#ffcb00', '#ff7500', '#ff2283', '#e824ff'];
export const PALETTE_RGB = [[255, 203, 0], [255, 117, 0], [255, 34, 131], [232, 36, 255]];

// ---- toast ----
let toastTimer = 0;
export function toast(text) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 1800);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} t.remove(); return ok;
  }
}

export function markReady() { root.classList.add('is-ready'); emit('ready'); }
