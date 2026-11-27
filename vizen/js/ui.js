// Small things everywhere: labels whose letters run through glyphs on hover, buttons that lean toward the pointer,
// anchors that glide (and move focus), a tag that follows the pointer where there is something to do, toasts,
// the studio clock, the newsletter, back to top.

import { gsap, calm, fine, lenis, scrollToTarget, toast } from './core.js';

const GLYPHS = '#%&*+=-/<>[]{}0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Run the letters of el through glyphs and settle on text (the same text, or a new one), left to right.
const running = new WeakMap();
export function scramble(el, text = el.dataset.text || el.textContent, { duration = 520, upper = true } = {}) {
  if (!el) return;
  if (!el.dataset.text) el.dataset.text = el.textContent;
  el.dataset.text = text;
  if (calm) { el.textContent = text; return; }
  cancelAnimationFrame(running.get(el));
  const from = el.textContent;
  const len = Math.max(from.length, text.length);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / duration);
    let out = '';
    for (let i = 0; i < len; i++) {
      const settle = (i + 1) / len;
      const ch = text[i] ?? '';
      if (k >= settle * 0.85 + 0.15) out += ch;
      else if (ch === ' ' || (from[i] === ' ' && k < 0.2)) out += ch === '' ? '' : ' ';
      else { const g = GLYPHS[(Math.random() * GLYPHS.length) | 0]; out += upper ? g : g.toLowerCase(); }
    }
    el.textContent = out;
    if (k < 1) running.set(el, requestAnimationFrame(step)); else el.textContent = text;
  };
  running.set(el, requestAnimationFrame(step));
}

export function init() {
  // Scramble on hover: nav links and the button's label. The label keeps its width while it runs.
  if (fine && !calm) {
    for (const el of document.querySelectorAll('[data-scramble], [data-scramble-self]')) {
      const target = el.matches('[data-scramble-self]') ? el : el;
      const host = el.matches('[data-scramble-self]') ? el.closest('button') : el;
      host.addEventListener('pointerenter', () => scramble(target, target.dataset.text || target.textContent, { duration: 420 }));
    }
  }

  // Magnetic: the arrows and the button lean a little toward the pointer.
  if (fine && !calm && gsap) {
    for (const el of document.querySelectorAll('.arrow, .icon-btn, .drawer__x, .news__go')) {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x(((e.clientX - r.left) / r.width - 0.5) * Math.min(10, r.width * 0.2));
        y(((e.clientY - r.top) / r.height - 0.5) * Math.min(10, r.height * 0.2));
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    }
  }

  // In-page links glide there; focus follows, so the keyboard carries on from where it landed.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (a.dataset.toast) { e.preventDefault(); toast(a.dataset.toast); return; }
    const id = a.getAttribute('href');
    const target = id === '#top' || id === '#' ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const inHero = target.closest?.('.hero');
    scrollToTarget(id === '#top' || inHero ? 0 : target, { offset: 0 });
    history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id);
    const focusable = target === document.body ? document.querySelector('.nav__logo') : target;
    if (!focusable.matches('a, button, input, [tabindex]')) focusable.setAttribute('tabindex', '-1');
    setTimeout(() => focusable.focus({ preventScroll: true }), lenis ? 1100 : 0);
  });

  // A tag that follows the pointer where there is something to do.
  const cur = document.querySelector('[data-cursor]');
  const label = document.querySelector('[data-cursor-label]');
  if (cur && fine && !calm) {
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => { x += (tx - x) * 0.3; y += (ty - y) * 0.3; cur.style.transform = `translate(${x}px, ${y}px)`; raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0; };
    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      const t = e.target.closest?.('[data-cursor-text]');
      const text = t ? (t.matches('[data-frame]') && t.closest('.viewer')?.classList.contains('is-drag') ? 'Turning' : t.dataset.cursorText) : '';
      if (label.textContent !== text) label.textContent = text;
      cur.classList.toggle('is-on', !!t);
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  // Studio time in Lugano.
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' });
    const tick = () => { clock.textContent = `Lugano ${f.format(new Date())}`; };
    tick(); setInterval(tick, 20000);
  }

  // The newsletter: checks the address and says thank you.
  const news = document.querySelector('[data-news]');
  if (news) {
    const msg = news.querySelector('[data-news-msg]'); const input = news.querySelector('input');
    news.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.checkValidity() || !input.value) { msg.textContent = 'That address does not look right.'; input.focus(); return; }
      msg.textContent = 'You are on the list. First dispatch with revision 8.';
      input.value = '';
    });
  }

  document.querySelector('[data-to-top]')?.addEventListener('click', () => {
    scrollToTarget(0);
    setTimeout(() => document.querySelector('.nav__logo')?.focus({ preventScroll: true }), lenis ? 1100 : 0);
  });
  for (const el of document.querySelectorAll('button[data-toast]')) el.addEventListener('click', () => toast(el.dataset.toast));
}
