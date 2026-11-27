// The header: clear over the hero, frosted once the page moves, out of the way while reading down and back when
// scrolling up; the link of the section in view is underlined.

import { on, scroll } from './core.js';

export function init() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  let lastY = scrollY; let acc = 0;
  on('scroll', () => {
    const y = scroll.y;
    nav.classList.toggle('is-solid', y > 40);
    const d = y - lastY; lastY = y;
    acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
    if (y < innerHeight * 0.6) nav.classList.remove('is-hidden');
    else if (acc > 60) nav.classList.add('is-hidden');
    else if (acc < -30) nav.classList.remove('is-hidden');
  });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  const links = [...nav.querySelectorAll('.nav__links a[href^="#"]')];
  const map = new Map(links.map((a) => [document.querySelector(a.getAttribute('href')), a]).filter(([s]) => s));
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const a = map.get(e.target);
      if (!a) continue;
      a.classList.toggle('is-current', e.isIntersecting);
      if (e.isIntersecting) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const s of map.keys()) io.observe(s);
}
