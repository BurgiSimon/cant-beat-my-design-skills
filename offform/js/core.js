// The shared runtime: GSAP and its plugins, Lenis (mouse and trackpad only), a small sticky event bus, pointer and
// scroll state, and helpers the modules share. Modules talk through the bus and never import each other.

export const root = document.documentElement;
export const calm = root.classList.contains('is-calm'); // prefers-reduced-motion, or ?reduced
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const desktop = () => innerWidth >= 1000;
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
    try { fn(data); } catch (e) { console.error('[offform]', name, e); }
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

// ---- scroll state: position, velocity (px per frame, smoothed) and direction ----
export const scroll = { y: scrollY, v: 0, dir: 1 };
function readScroll(e) {
  const y = e && typeof e.scroll === 'number' ? e.scroll : scrollY;
  scroll.v = e && typeof e.velocity === 'number' ? e.velocity : y - scroll.y;
  if (y !== scroll.y) scroll.dir = y > scroll.y ? 1 : -1;
  scroll.y = y;
  emit('scroll', scroll);
}
if (lenis) lenis.on('scroll', readScroll); else addEventListener('scroll', () => readScroll(), { passive: true });
// native scrolling has no velocity of its own: let it fall back to rest between events
if (!lenis) (function decay() { scroll.v *= 0.85; requestAnimationFrame(decay); })();

// ---- pointer: px, -1..1 around the middle of the screen, and speed ----
export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, vx: 0, vy: 0, active: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  emit('pointer', pointer);
}, { passive: true });
root.addEventListener('pointerleave', () => { pointer.active = false; emit('pointer', pointer); });

// ---- scroll lock (overlays, intro) ----
let locks = 0;
export function lock() { if (locks++ === 0) { if (lenis) lenis.stop(); root.style.overflow = 'hidden'; } }
export function unlock() { if (locks > 0 && --locks === 0) { if (lenis) lenis.start(); root.style.overflow = ''; } }

// ---- smooth anchors: the sticky header is taken off the target ----
export function headOffset() {
  const head = document.querySelector('[data-head]');
  return head ? -head.querySelector('.head__bar').offsetHeight + 1 : 0;
}
export function scrollToTarget(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const offset = el && el.id !== 'top' ? headOffset() : 0;
  if (lenis) { lenis.scrollTo(el && el.id !== 'top' ? el : 0, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  const y = el && el.id !== 'top' ? el.getBoundingClientRect().top + scrollY + offset : 0;
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

// ---- a frame loop that only runs while its element is on screen and the tab is visible ----
export function loop(el, fn, rootMargin = '80px') {
  let raf = 0, last = 0, onScreen = false;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    fn(dt, t / 1000);
  };
  const sync = () => {
    const run = onScreen && !document.hidden;
    if (run && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  whenVisible(el, (v) => { onScreen = v; sync(); }, rootMargin);
  document.addEventListener('visibilitychange', sync);
  return sync;
}

// ---- small maths ----
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- rolling digits: each digit is a column of 0–9 that slides to its value ----
export function odometer(el, { text: initial } = {}) {
  const first = initial ?? el.textContent.trim();
  el.classList.add('odo');
  const sr = document.createElement('span'); sr.className = 'sr';
  const vis = document.createElement('span'); vis.className = 'odo__vis'; vis.setAttribute('aria-hidden', 'true');
  el.replaceChildren(sr, vis);
  let cells = [], shape = '';
  function build(str) {
    vis.replaceChildren(); cells = [];
    let fromRight = (str.match(/\d/g) || []).length;
    for (const ch of str) {
      if (/\d/.test(ch)) {
        const cell = document.createElement('span'); cell.className = 'odo__cell';
        const col = document.createElement('span'); col.className = 'odo__col';
        col.innerHTML = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>';
        col.style.transitionDelay = `${--fromRight * 45}ms`;
        cell.append(col); vis.append(cell); cells.push(col);
      } else {
        const s = document.createElement('span'); s.className = 'odo__sym'; s.textContent = ch; vis.append(s); cells.push(null);
      }
    }
  }
  function set(str, { instant = false } = {}) {
    str = String(str);
    sr.textContent = str;
    const nextShape = str.replace(/\d/g, '0');
    if (nextShape !== shape) { build(str); shape = nextShape; instant = true; }
    else if (!instant) void vis.offsetWidth;
    [...str].forEach((ch, i) => {
      const col = cells[i];
      if (!col) return;
      col.style.transitionDuration = instant || calm ? '0s' : '';
      col.style.transform = `translateY(${-Number(ch) * 10}%)`;
    });
  }
  function scramble() {
    for (const col of cells) if (col) { col.style.transitionDuration = '0s'; col.style.transform = `translateY(${-Math.floor(Math.random() * 10) * 10}%)`; }
  }
  set(first, { instant: true });
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
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
}

// ---- London time, for the clocks ----
export function londonTime(withSeconds = false) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', ...(withSeconds && { second: '2-digit' }), hour12: false }).format(new Date());
  } catch (e) {
    const d = new Date();
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
}

// ---- the intro: if nothing runs one, the page is simply ready ----
export function markReady() {
  if (root.classList.contains('is-ready') && seen.has('intro:done')) return;
  root.classList.add('is-ready');
  try { sessionStorage.setItem('offform:seen', '1'); } catch (e) { /* private mode */ }
  emit('intro:done');
}
addEventListener('load', () => { if (ScrollTrigger) ScrollTrigger.refresh(); });

// ---- overlays: one at a time, with the scrim, Escape, focus kept inside and given back, scrolling held ----
let openDialog = null;
const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';
export function dialog(el, { onOpen, onClose, scrim = true } = {}) {
  const scrimEl = document.querySelector('[data-scrim]');
  let returnTo = null, timer = 0;
  const api = {
    get isOpen() { return openDialog === api; },
    open(trigger) {
      if (openDialog === api) return;
      if (openDialog) openDialog.close({ silent: true });
      openDialog = api;
      returnTo = trigger || document.activeElement;
      clearTimeout(timer);
      el.hidden = false;
      if (scrim && scrimEl) { scrimEl.hidden = false; requestAnimationFrame(() => scrimEl.classList.add('is-on')); }
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
      lock();
      if (onOpen) onOpen();
      else setTimeout(() => { const f = el.querySelector(FOCUSABLE); if (f) f.focus({ preventScroll: true }); }, 60);
      emit('dialog', { el, open: true });
    },
    close({ silent = false } = {}) {
      if (openDialog !== api) return;
      openDialog = null;
      el.classList.remove('is-on');
      if (scrim && scrimEl) scrimEl.classList.remove('is-on');
      timer = setTimeout(() => { el.hidden = true; if (scrimEl && !openDialog) scrimEl.hidden = true; }, calm ? 0 : 700);
      unlock();
      onClose?.();
      if (!silent && returnTo && returnTo.focus) returnTo.focus({ preventScroll: true });
      emit('dialog', { el, open: false });
    },
  };
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  return api;
}
document.querySelector('[data-scrim]')?.addEventListener('click', () => openDialog?.close());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDialog) openDialog.close(); });
