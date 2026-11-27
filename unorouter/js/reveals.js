// Scroll reveals: each section's parts step in as they arrive (prompt, lede, boxes), lists ripple in row by row.
// Hard, short and stepped where it suits the pixels; nothing moves far.

import { calm, gsap, ScrollTrigger } from './core.js';

export function init() {
  if (calm || !gsap || !ScrollTrigger) return;
  const groups = [
    ['.section .prompt, .cta .prompt', { y: 10 }],
    ['.lede', { y: 14 }],
    ['.steps__item', { y: 12, stagger: 0.07 }],
    ['.term, .explorer, .router, .plans, .keygen', { y: 28 }],
    ['.board__row, .qa', { y: 10, stagger: 0.05 }],
    ['.foot__cols nav', { y: 14, stagger: 0.06 }],
  ];
  for (const [sel, o] of groups) {
    const els = gsap.utils.toArray(sel).filter((el) => !el.closest('.hero'));
    if (!els.length) continue;
    gsap.set(els, { opacity: 0, y: o.y });
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: o.stagger ?? 0.08, overwrite: true }),
    });
  }
  // the strip's line draws itself across
  gsap.from('.strip', { clipPath: 'inset(0 100% 0 0)', duration: 1.1, ease: 'steps(14)', scrollTrigger: { trigger: '.strip', start: 'top 92%', once: true } });
  // the footer wordmark tracks the pointer with a light that brings out the colours
  const word = document.querySelector('.foot__word');
  if (word) {
    word.parentElement.addEventListener('pointermove', (e) => {
      const r = word.getBoundingClientRect();
      word.style.setProperty('--mx', `${e.clientX - r.left}px`); word.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    word.parentElement.addEventListener('pointerleave', () => { word.style.setProperty('--mx', '-999px'); });
  }
  addEventListener('load', () => ScrollTrigger.refresh());
}
