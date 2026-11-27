// Small things everywhere: labels that roll up on hover, buttons that lean towards the pointer, anchors that
// glide (and move focus), the store buttons' honest toast, back to top.

import { gsap, calm, fine, lenis, scrollToTarget, toast } from './core.js';

export function init() {
  // Rolling labels: the word, and a copy under it that takes its place on hover.
  for (const el of document.querySelectorAll('[data-roll]')) {
    const text = el.textContent;
    el.textContent = '';
    const inner = document.createElement('span'); inner.className = 'roll__in';
    const a = document.createElement('span'); a.textContent = text;
    const b = document.createElement('span'); b.textContent = text; b.setAttribute('aria-hidden', 'true');
    inner.append(a, b); el.append(inner);
  }

  // Magnetic: the button follows the pointer a little and springs back.
  if (fine && !calm && gsap) {
    for (const el of document.querySelectorAll('[data-magnetic]')) {
      const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x(((e.clientX - r.left) / r.width - 0.5) * Math.min(14, r.width * 0.1));
        y(((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    }
  }

  // In-page links glide there; focus follows, so the keyboard carries on from the section it landed in.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const id = a.getAttribute('href');
    if (a.matches('[data-store]')) {
      e.preventDefault();
      toast(`AsterPay is a design study, so there is no ${a.dataset.store} app to download (yet).`);
      return;
    }
    const target = id === '#top' || id === '#' ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const nav = document.querySelector('[data-nav]');
    scrollToTarget(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -(nav ? 70 : 0) + (id === '#download' ? 70 : 0) });
    history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id);
    if (target !== document.body) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      setTimeout(() => target.focus({ preventScroll: true }), lenis ? 900 : 0);
    }
  });

  // FAQ: the answers open and close with their height, not at once.
  for (const d of document.querySelectorAll('.qa')) {
    const sum = d.querySelector('summary'); const body = d.querySelector('.qa__a');
    let anim = null;
    sum.addEventListener('click', (e) => {
      if (calm || !body.animate) return;
      e.preventDefault();
      anim?.cancel();
      const opening = !d.open;
      const from = body.offsetHeight;
      if (opening) d.open = true;
      const to = opening ? body.scrollHeight : 0;
      anim = body.animate([{ height: `${opening ? 0 : from}px`, opacity: opening ? 0 : 1 }, { height: `${to}px`, opacity: opening ? 1 : 0 }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      anim.onfinish = () => { if (!opening) d.open = false; anim = null; };
    });
  }

  document.querySelector('[data-to-top]')?.addEventListener('click', () => {
    scrollToTarget(0);
    setTimeout(() => document.querySelector('.nav .brand')?.focus({ preventScroll: true }), lenis ? 1000 : 0);
  });
}
