// The hero's figures: they count up as the hero lands; the tokens figure is live (point at it and the exact count
// runs, every routed request in the art adds to it); and the copy drifts off a little slower than the page as you
// scroll past.

import { calm, gsap, once, on, ScrollTrigger, fine } from './core.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function init() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // ---- count up ----
  const nums = [...hero.querySelectorAll('[data-count]')];
  const tokens = hero.querySelector('[data-tokens]');
  once('hero:stats', () => {
    if (calm || !gsap) return;
    for (const el of nums) {
      const to = +el.dataset.count; const suffix = el.dataset.suffix || ''; const o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.3, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v) + suffix; } });
    }
    if (tokens) {
      const to = +tokens.dataset.tokens; const o = { v: to - 420 };
      gsap.to(o, { v: to, duration: 1.6, ease: 'expo.out', onUpdate: () => { tokens.textContent = `${fmt(o.v)}T`; } });
    }
  });

  // ---- the live count, under the tokens figure ----
  const stat = hero.querySelector('.stat--live');
  if (stat && !calm) {
    const live = document.createElement('span');
    live.className = 'stat__live'; live.setAttribute('aria-hidden', 'true');
    stat.append(live);
    let total = 2_036_418_203_557; let rate = 384_000; // tokens a second
    let shown = false; let last = performance.now(); let raf = 0;
    const tick = (now) => {
      const dt = Math.max(0, (now - last) / 1000); last = now;
      total += rate * dt * (0.85 + Math.random() * 0.3);
      live.innerHTML = `${fmt(total)} <i>tokens</i>`;
      raf = shown ? requestAnimationFrame(tick) : 0;
    };
    const show = (v) => { shown = v; stat.classList.toggle('is-live', v); if (v && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    stat.addEventListener('pointerenter', () => show(true));
    stat.addEventListener('pointerleave', () => show(false));
    on('art:route', () => {
      total += 1_200_000 + Math.random() * 900_000;
      stat.classList.remove('is-ping'); void stat.offsetWidth; stat.classList.add('is-ping');
    });
    // keep the total moving while hidden too, so the first look is current
    setInterval(() => { if (!shown) total += rate * 1.0; }, 1000);
  }

  // ---- scroll: the copy lifts away a touch slower than the page ----
  if (ScrollTrigger && gsap && fine) {
    gsap.to('.hero__copy', { yPercent: -10, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
}
