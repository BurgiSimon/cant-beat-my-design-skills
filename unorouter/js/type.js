// Text that resolves out of noise, the way a terminal would draw it: every character runs through random glyphs and
// locks into place left to right. The type is monospaced, so nothing moves while it does. Headings decode when they
// come into view (until then they sit there as dim noise); links and buttons scramble once under the pointer.

import { calm, fine } from './core.js';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/?$';
const LOWER = 'abcdefghjkmnpqrstuvwxyz0123456789#%&*+=<>/?$';
const pick = (set) => set[Math.floor(Math.random() * set.length)];
const glyphFor = (ch) => (ch === ' ' || ch === ' ' ? ch : /[A-Z]/.test(ch) ? pick(UPPER) : pick(LOWER));

const running = new WeakMap();

// Draw `final` into `el` out of noise. Resolves when done.
export function decode(el, { duration = 0.8, delay = 0, from = 'noise' } = {}) {
  const final = (el.dataset.text ??= el.textContent);
  if (calm) { el.textContent = final; return Promise.resolve(); }
  const token = {}; running.set(el, token);
  const n = final.length;
  const at = Array.from(final, (_, i) => delay + (i / Math.max(1, n - 1)) * duration * 0.65 + Math.random() * duration * 0.35);
  const born = Array.from(final, (_, i) => (from === 'blank' ? delay + (i / Math.max(1, n - 1)) * duration * 0.4 : -1));
  const start = performance.now();
  let tick = -1;
  return new Promise((done) => {
    const frame = (now) => {
      if (running.get(el) !== token) return done();
      const t = (now - start) / 1000;
      const step = Math.floor(t * 28);                     // new noise ~28 times a second, not every frame
      if (step !== tick) {
        tick = step;
        let s = '';
        for (let i = 0; i < n; i++) s += t >= at[i] ? final[i] : t < born[i] ? ' ' : glyphFor(final[i]);
        el.textContent = s;
      }
      if (t < Math.max(...at)) requestAnimationFrame(frame);
      else { el.textContent = final; running.delete(el); done(); }
    };
    requestAnimationFrame(frame);
  });
}

// Show `el` as static noise (same length, same spaces) until it is decoded.
export function encode(el) {
  const final = (el.dataset.text ??= el.textContent);
  el.textContent = Array.from(final, glyphFor).join('');
  el.classList.add('is-encoded');
}

export function scramble(el, duration = 0.38) {
  if (calm || running.has(el)) return;
  decode(el, { duration }).then(() => {});
}

export function init() {
  // headings decode on the way into view; their accessible name is the real text throughout
  const heads = [...document.querySelectorAll('[data-decode]')].filter((el) => !el.closest('.hero'));
  for (const el of heads) {
    const h = el.closest('h1, h2, h3') || el;
    if (!h.hasAttribute('aria-label')) h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    for (const part of h.querySelectorAll('[data-decode]')) part.setAttribute('aria-hidden', 'true');
    if (h.matches('[data-decode]')) { /* the heading itself: its name is set above */ }
  }
  if (!calm) {
    for (const el of heads) encode(el);
    const io = new IntersectionObserver((seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target;
        decode(el, { duration: Math.min(1.1, 0.35 + el.dataset.text.length * 0.025), delay: 0.05 }).then(() => el.classList.remove('is-encoded'));
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    heads.forEach((el) => io.observe(el));
  }

  // links and buttons: a short scramble under the pointer (or on keyboard focus)
  for (const el of document.querySelectorAll('[data-scramble]')) {
    el.dataset.text ??= el.textContent;
    const host = el.closest('a, button') || el;
    // a stable name while the text scrambles (what is aria-hidden, like a chevron, stays out of it)
    if (!host.hasAttribute('aria-label')) {
      const copy = host.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      host.setAttribute('aria-label', copy.textContent.replace(/\s+/g, ' ').trim());
    }
    if (fine) host.addEventListener('pointerenter', () => scramble(el));
    host.addEventListener('focus', () => { if (host.matches(':focus-visible')) scramble(el); });
  }
}
