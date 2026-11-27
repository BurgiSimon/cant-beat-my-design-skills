// The shared runtime: GSAP and its plugins, Lenis smooth scrolling (mouse and trackpad only), a small event bus,
// pointer and scroll state, and helpers every module uses (visibility, rolling digits, toast). The modules talk
// through the bus and never import each other.

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
    try { fn(data); } catch (e) { console.error('[asterpay]', name, e); }
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
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false });
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
export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, active: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  emit('pointer', pointer);
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; emit('pointer', pointer); });

// ---- scroll lock (menu, intro) ----
let locks = 0;
export function lock() { if (locks++ === 0) { if (lenis) lenis.stop(); else root.style.overflow = 'hidden'; } }
export function unlock() { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); else root.style.overflow = ''; } }

// ---- smooth anchors ----
export function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (lenis) { lenis.scrollTo(el ?? 0, { offset, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  const y = el ? el.getBoundingClientRect().top + scrollY + offset : 0;
  scrollTo({ top: y, behavior: calm || immediate ? 'auto' : 'smooth' });
}

// ---- ready: the DOM and the fonts (or 2.5 s, whichever comes first) ----
export const ready = new Promise((res) => {
  const go = () => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 2500))]).then(res);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
});

// ---- run something only while an element is near the screen ----
export function whenVisible(el, fn, rootMargin = '100px') {
  if (!el) return () => {};
  const io = new IntersectionObserver(([en]) => fn(en.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

// ---- small maths ----
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export function seeded(seed) { // mulberry32: the same numbers on every load
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const money = (v, dec = 2) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

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

// ---- rolling digits: each digit is a column of 0–9 that slides to its value ----
// odometer(el, { value, prefix, decimals, dimDecimals }) → { set(v) }. The element keeps an accessible text copy.
export function odometer(el, { value = 0, prefix = '', suffix = '', decimals = 0, dimDecimals = false, signed = false } = {}) {
  el.classList.add('odo');
  const sr = document.createElement('span'); sr.className = 'sr';
  const vis = document.createElement('span'); vis.className = 'odo__vis'; vis.setAttribute('aria-hidden', 'true');
  el.replaceChildren(sr, vis);
  let cells = [];
  const text = (v) => `${signed ? (v >= 0 ? '+' : '−') : ''}${prefix}${money(Math.abs(v), decimals)}${suffix}`;
  function build(str) {
    vis.replaceChildren();
    cells = [];
    const dot = str.indexOf('.');
    let fromRight = (str.match(/\d/g) || []).length;
    [...str].forEach((ch, i) => {
      const dim = dimDecimals && dot >= 0 && i >= dot;
      if (/\d/.test(ch)) {
        const cell = document.createElement('span'); cell.className = 'odo__cell' + (dim ? ' dim' : '');
        const col = document.createElement('span'); col.className = 'odo__col';
        col.innerHTML = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>';
        col.style.transitionDelay = `${--fromRight * 28}ms`;
        cell.append(col); vis.append(cell); cells.push({ col, ch });
      } else {
        const s = document.createElement('span'); s.className = 'odo__sym' + (dim ? ' dim' : ''); s.textContent = ch; vis.append(s);
        cells.push(null);
      }
    });
  }
  let shape = '';
  function set(v, { instant = false } = {}) {
    const str = text(v);
    sr.textContent = str;
    const nextShape = str.replace(/\d/g, '0');
    if (nextShape !== shape) { build(str); shape = nextShape; instant = true; }
    else if (!instant) void vis.offsetWidth; // a scramble just before has to be on screen first
    [...str].forEach((ch, i) => {
      const c = cells[i];
      if (!c) return;
      c.col.style.transitionDuration = instant || calm ? '0s' : '';
      c.col.style.transform = `translateY(${-Number(ch) * 10}%)`;
    });
  }
  // every digit to a random one, at once: the next set() rolls them all into place
  function scramble() {
    for (const c of cells) if (c) { c.col.style.transitionDuration = '0s'; c.col.style.transform = `translateY(${-Math.floor(Math.random() * 10) * 10}%)`; }
  }
  set(value, { instant: true });
  return { set, scramble, get text() { return sr.textContent; } };
}

// ---- a toast at the foot of the screen ----
let toastTimer = 0;
export function toast(msg) {
  const t = document.querySelector('[data-toast]');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3600);
}

// ---- the intro: if nothing runs one, the page is simply ready ----
export function markReady() {
  root.classList.add('is-ready');
  try { sessionStorage.setItem('asterpay:seen', '1'); } catch (e) { /* private mode */ }
  emit('intro:done');
}
addEventListener('load', () => { if (ScrollTrigger) ScrollTrigger.refresh(); });
