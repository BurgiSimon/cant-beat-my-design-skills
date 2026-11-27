// The shared runtime: GSAP and its plugins, Lenis smooth scrolling (where there is a wheel), the header, and the small
// motion primitives every page uses, driven by data attributes so sections stay declarative:
//
//   data-reveal[="up|fade|scale|left|right"]   rises/fades in once when it enters the screen
//   data-reveal-stagger                          its children reveal one after another
//   data-split                                   a heading whose lines rise out of a mask
//   data-count="1234" [data-decimals data-prefix data-suffix]   a number that counts up when seen
//   data-marquee[="speed"]                       an endless horizontal strip (duplicate the content once in the markup)
//   data-magnetic                                leans toward the pointer
//   data-tilt                                    tilts toward the pointer in 3D
//   data-spotlight                               a soft light follows the pointer across it (sets --mx/--my)
//   data-roll                                    its text rolls up into a white copy on hover
//
// Everything resolves to the resting design under reduced motion (.is-calm) and without scripts.

export const root = document.documentElement;
export const calm = root.classList.contains('is-calm');
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const gsap = window.gsap || null;
export const ScrollTrigger = window.ScrollTrigger || null;
export const SplitText = window.SplitText || null;
export let lenis = null;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/** Run fn(true/false) as el comes near / leaves the screen. Returns a stop function. */
export function whenVisible(el, fn, rootMargin = '120px') {
  if (!el) return () => {};
  const io = new IntersectionObserver(([e]) => fn(e.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/** Scroll to an element or y, smoothly where Lenis runs. */
export function scrollToTarget(target, { offset = -84, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (lenis) { lenis.scrollTo(el ?? 0, { offset, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4), immediate }); return; }
  const y = el ? el.getBoundingClientRect().top + scrollY + offset : 0;
  scrollTo({ top: y, behavior: calm || immediate ? 'auto' : 'smooth' });
}

let locks = 0;
export function lockScroll() { if (locks++ === 0) { lenis?.stop(); root.style.overflow = 'hidden'; } }
export function unlockScroll() { if (locks > 0 && --locks === 0) { lenis?.start(); root.style.overflow = ''; } }

export function boot() {
  if (gsap) {
    gsap.registerPlugin(...[ScrollTrigger, SplitText].filter(Boolean));
    gsap.defaults({ ease: 'power3.out', duration: 0.9 });
  }
  if (!calm && fine && gsap && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false });
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  header();
  anchors();
  rolls();
  if (calm || !gsap) { root.classList.add('is-ready'); return; }
  reveals();
  splits();
  counters();
  marquees();
  if (fine) { magnetic(); tilt(); spotlight(); }
  // deep links land where they point once the layout (fonts, images) has settled
  if (location.hash.length > 1) addEventListener('load', () => { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) scrollToTarget(t, { immediate: true }); }, { once: true });
  addEventListener('load', () => ScrollTrigger?.refresh());
  document.fonts?.ready.then(() => ScrollTrigger?.refresh());
}

// ---- the header: frosted once the page moves, out of the way while reading down, a progress line, a menu ----
function header() {
  const bar = $('.header');
  if (!bar) return;
  let last = scrollY;
  const onScroll = () => {
    const y = lenis ? lenis.scroll : scrollY;
    bar.classList.toggle('is-scrolled', y > 16);
    const down = y > last + 2, up = y < last - 2;
    if (!bar.contains(document.activeElement) && !bar.classList.contains('is-open')) {
      if (down && y > 480) bar.classList.add('is-hidden');
      else if (up || y < 480) bar.classList.remove('is-hidden');
    }
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  };
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));

  // dropdowns: open on hover (with a short grace) and on click/Enter; Escape closes and returns focus
  for (const item of $$('.nav__item[data-menu]', bar)) {
    const btn = $('.nav__trigger', item);
    let t = 0;
    const open = (v) => { item.classList.toggle('is-open', v); btn.setAttribute('aria-expanded', String(v)); };
    btn.addEventListener('click', () => open(!item.classList.contains('is-open')));
    if (fine) {
      item.addEventListener('pointerenter', () => { clearTimeout(t); open(true); });
      item.addEventListener('pointerleave', () => { t = setTimeout(() => open(false), 160); });
    }
    item.addEventListener('keydown', (e) => { if (e.key === 'Escape') { open(false); btn.focus(); } });
    item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) open(false); });
  }

  // the menu on small screens: a real dialog (focus kept inside, Escape, scroll locked)
  const toggle = $('.header__burger', bar);
  const panel = $('.menu', bar.parentElement) || $('.menu');
  if (!toggle || !panel) return;
  const focusables = () => $$('a, button', panel).filter((el) => !el.closest('[hidden]'));
  const set = (v) => {
    bar.classList.toggle('is-open', v);
    panel.classList.toggle('is-open', v);
    toggle.setAttribute('aria-expanded', String(v));
    toggle.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    panel.inert = !v;
    if (v) { lockScroll(); setTimeout(() => focusables()[0]?.focus(), 60); } else unlockScroll();
  };
  panel.inert = true;
  toggle.addEventListener('click', () => set(!panel.classList.contains('is-open')));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => {
    if (!panel.classList.contains('is-open')) return;
    if (e.key === 'Escape') { set(false); toggle.focus(); }
    if (e.key === 'Tab') {
      const f = [toggle, ...focusables()]; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches && panel.classList.contains('is-open')) set(false); });
}

// ---- in-page anchors glide (and move focus to where they land) ----
function anchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
    const t = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!t) return;
    e.preventDefault();
    scrollToTarget(t);
    history.pushState(null, '', url.hash);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });
}

function rolls() {
  for (const a of $$('[data-roll]')) {
    if (a.querySelector('.roll')) continue;
    const t = a.textContent.trim();
    a.innerHTML = `<span class="roll"><span>${t}</span></span>`;
  }
}

// ---- reveals ----
const FROM = {
  up: { y: 28, opacity: 0 },
  fade: { opacity: 0 },
  scale: { scale: 0.94, opacity: 0 },
  left: { x: -28, opacity: 0 },
  right: { x: 28, opacity: 0 },
};
function reveals() {
  const items = $$('[data-reveal]');
  const groups = $$('[data-reveal-stagger]');
  for (const el of items) {
    const from = FROM[el.dataset.reveal] || FROM.up;
    gsap.set(el, from);
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(el, { x: 0, y: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out', delay: parseFloat(el.dataset.delay || 0), clearProps: 'transform,opacity', onComplete: () => el.classList.add('is-in') }),
    });
  }
  for (const g of groups) {
    const kids = [...g.children];
    gsap.set(kids, { y: 24, opacity: 0 });
    ScrollTrigger.create({
      trigger: g, start: 'top 86%', once: true,
      onEnter: () => gsap.to(kids, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: parseFloat(g.dataset.revealStagger || 0.07), clearProps: 'transform,opacity' }),
    });
  }
  root.classList.add('is-ready');
}

function splits() {
  if (!SplitText) return;
  for (const el of $$('[data-split]')) {
    const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    gsap.set(split.lines, { yPercent: 110 });
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(split.lines, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.08, delay: parseFloat(el.dataset.delay || 0), onComplete: () => split.revert() }),
    });
  }
}

export function countTo(el, to, { decimals = 0, prefix = '', suffix = '', duration = 1.8 } = {}) {
  const n = { v: 0 };
  const fmt = (v) => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  el.setAttribute('aria-label', fmt(to));
  gsap.to(n, { v: to, duration, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(n.v); } });
}
function counters() {
  for (const el of $$('[data-count]')) {
    const to = parseFloat(el.dataset.count);
    const opts = { decimals: parseInt(el.dataset.decimals || 0, 10), prefix: el.dataset.prefix || '', suffix: el.dataset.suffix || '' };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => countTo(el, to, opts) });
  }
}

// ---- marquees: an endless strip, faster (and with you) while the page scrolls ----
function marquees() {
  for (const m of $$('[data-marquee]')) {
    const track = m.firstElementChild;
    if (!track) continue;
    const speed = parseFloat(m.dataset.marquee) || 40;   // px a second
    let x = 0, v = 0, on = false;
    whenVisible(m, (vis) => { on = vis; });
    gsap.ticker.add((t, dt) => {
      if (!on) return;
      const half = track.scrollWidth / 2;
      const kick = lenis ? lenis.velocity : 0;
      v = damp(v, kick * 0.6, 4, dt / 1000);
      x -= (speed + Math.abs(v) * 14) * (dt / 1000) * (m.matches(':hover') ? 0.25 : 1);
      if (-x >= half) x += half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }
}

function magnetic() {
  for (const el of $$('[data-magnetic]')) {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const k = parseFloat(el.dataset.magnetic) || 0.3;
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * k); y((e.clientY - r.top - r.height / 2) * k); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  }
}

function tilt() {
  for (const el of $$('[data-tilt]')) {
    const max = parseFloat(el.dataset.tilt) || 6;
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * max * 2); rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2); });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

function spotlight() {
  for (const el of $$('[data-spotlight]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
}
