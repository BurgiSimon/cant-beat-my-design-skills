// After Hours: the clock is London's, live; the pointer is a torch that the jacket catches; the runner drifts slower
// than the type; the drop date rolls in.
import { calm, fine, gsap, ScrollTrigger, odometer, londonTime } from './core.js';

export function init() {
  // every clock on the page reads London
  const clocks = [...document.querySelectorAll('[data-clock]')];
  const tick = () => { const t = londonTime(); for (const c of clocks) if (c.textContent !== t) { c.textContent = t; c.setAttribute('datetime', t); } };
  tick();
  setInterval(tick, 5000);

  const s = document.getElementById('after-hours');
  if (!s) return;
  const img = s.querySelector('.after__subject');
  const date = s.querySelector('[data-date]');

  if (fine && !calm) {
    const torch = s.querySelector('.after__torch');
    s.addEventListener('pointermove', (e) => {
      const r = torch.getBoundingClientRect();
      torch.style.setProperty('--tx', `${e.clientX - r.left}px`);
      torch.style.setProperty('--ty', `${e.clientY - r.top}px`);
    });
  }

  if (calm || !gsap || !ScrollTrigger) return;
  gsap.fromTo(img, { yPercent: 8, scale: 1.08 }, { yPercent: -4, scale: 1, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo(s.querySelector('.after__l--2'), { x: 80 }, { x: -20, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo(s.querySelectorAll('.after__l--1, .after__l--3'), { x: -40 }, { x: 30, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from(s.querySelectorAll('.after__copy, .after__btn'), { opacity: 0, y: 20, duration: 1, stagger: 0.1, scrollTrigger: { trigger: s, start: 'top 40%', once: true } });

  if (date) {
    const odo = odometer(date, { text: '00.00' });
    ScrollTrigger.create({ trigger: date, start: 'top 95%', once: true, onEnter: () => setTimeout(() => odo.set('06.26'), 150) });
  }
}
