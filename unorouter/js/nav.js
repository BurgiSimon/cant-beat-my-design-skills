// The header: a frosted bar once the page moves, a hairline of progress along its foot, the current section's link
// lit (Models while in the hero, as the shot has it), anchors that glide, and on small screens a menu that is a
// proper dialog (focus kept inside, Escape, scroll locked).

import { on, scroll, scrollToTarget, lock, unlock, calm } from './core.js';

export function init() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const bar = nav.querySelector('.nav__bar');
  const links = [...nav.querySelectorAll('.nav__links a')];
  const byHash = new Map(links.map((a) => [a.getAttribute('href'), a]));
  const sections = ['#docs', '#models', '#routing', '#rankings', '#pricing', '#faq', '#key']
    .map((id) => document.querySelector(id)).filter(Boolean);
  const linkFor = { '#routing': '#models', '#faq': '#pricing', '#key': null };

  let current = null;
  const setCurrent = (hash) => {
    const a = byHash.get(hash) || null;
    if (a === current) return;
    current?.classList.remove('is-current'); current?.removeAttribute('aria-current');
    current = a;
    a?.classList.add('is-current'); a?.setAttribute('aria-current', 'location');
  };
  current = links.find((a) => a.classList.contains('is-current')) || null;

  const update = () => {
    const y = scroll.y;
    nav.classList.toggle('is-scrolled', y > 12);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    // the section whose top has passed a line a third of the way down
    const line = innerHeight * 0.33;
    let hit = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) hit = s;
    if (!hit) setCurrent('#models');                       // the hero: Models, as in the shot
    else {
      const id = `#${hit.id}`;
      setCurrent(id in linkFor ? linkFor[id] : id);
    }
  };
  on('scroll', update); addEventListener('resize', update); update();

  // ---- anchors ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const hash = a.getAttribute('href');
    const target = hash === '#top' ? document.querySelector('#top') : document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) closeMenu(false);
    scrollToTarget(target);
    // move focus for keyboard and screen-reader users, without jumping
    if (hash !== '#top') {
      const focusable = target.matches('section') ? target.querySelector('h1, h2') : target;
      if (focusable) { focusable.setAttribute('tabindex', '-1'); focusable.focus({ preventScroll: true }); }
    }
    history.replaceState(null, '', hash === '#top' ? location.pathname + location.search : hash);
  });

  // ---- menu (small screens) ----
  const burger = nav.querySelector('.nav__burger');
  const menu = nav.querySelector('#menu');
  let menuOpen = false;
  const focusables = () => [burger, ...menu.querySelectorAll('a')];
  function openMenu() {
    menuOpen = true; menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
    lock();
    if (!calm) menu.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 360, easing: 'steps(6)' });
    menu.querySelector('a')?.focus();
  }
  function closeMenu(refocus = true) {
    menuOpen = false; menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
    unlock();
    if (refocus) burger.focus();
  }
  burger?.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'Tab') {
      const f = focusables(); const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (m) => { if (m.matches && menuOpen) closeMenu(false); });
}
