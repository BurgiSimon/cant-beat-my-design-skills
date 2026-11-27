// The header: it frosts into a bar once the page moves, steps aside while you read down and comes back when you
// scroll up, turns light-on-dark over the dark sections, marks where you are, and carries a thin progress line.

import { on, scroll, clamp } from './core.js';

export function init() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const links = [...nav.querySelectorAll('[data-nav-link]')];
  const progress = nav.querySelector('[data-progress]');
  const hero = document.querySelector('.hero');
  const sections = [...document.querySelectorAll('main > section, .foot')];
  // which nav link each section belongs to
  const owner = { top: 'top', about: 'top', platform: 'platform', features: 'features', ahead: 'features' };
  let lastY = scroll.y; let travel = 0; let current = 'top';

  function update() {
    const y = scroll.y;
    nav.classList.toggle('is-stuck', y > 24);
    // hide on the way down (after the hero), show on the way up
    const d = y - lastY; lastY = y;
    travel = Math.sign(d) === Math.sign(travel) ? travel + d : d;
    if (y < (hero ? hero.offsetHeight * 0.7 : 400)) nav.classList.remove('is-hidden');
    else if (travel > 140) nav.classList.add('is-hidden');
    else if (travel < -60) nav.classList.remove('is-hidden');
    // the section under the bar decides its colours, and which link is lit
    const probe = 50;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        nav.classList.toggle('is-dark', s.dataset.theme === 'dark');
        const o = owner[s.id];
        if (o && o !== current) {
          current = o;
          links.forEach((l) => { const on = l.dataset.navLink === o; l.classList.toggle('is-current', on); if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current'); });
        }
        break;
      }
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${clamp(y / Math.max(1, max), 0, 1).toFixed(4)})`;
  }
  on('scroll', update);
  addEventListener('resize', update);
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  update();
}
