// The header: the Product dropdown (hover with a mouse, click or keys otherwise), the burger's panel (a real
// dialog: focus kept inside, Escape closes, scroll locked), a frosted strip once the page moves, hidden while
// reading down and back on the way up, a progress line, and the link of the section you are in.

import { gsap, calm, fine, on, scroll, lock, unlock } from './core.js';

export function init() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const root = document.documentElement;

  // ---- Product dropdown ----
  const drop = nav.querySelector('[data-drop]');
  const toggle = drop?.querySelector('.drop__toggle');
  let closeTimer = 0;
  const setDrop = (open) => {
    if (!drop) return;
    clearTimeout(closeTimer);
    drop.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  if (drop) {
    toggle.addEventListener('click', () => setDrop(!drop.classList.contains('is-open')));
    if (fine) {
      drop.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setDrop(true); });
      drop.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') closeTimer = setTimeout(() => setDrop(false), 180); });
    }
    drop.addEventListener('focusout', (e) => { if (!drop.contains(e.relatedTarget)) setDrop(false); });
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drop.classList.contains('is-open')) { setDrop(false); toggle.focus(); }
      if (e.key === 'ArrowDown' && document.activeElement === toggle) { e.preventDefault(); setDrop(true); drop.querySelector('.drop__panel a')?.focus(); }
    });
    drop.querySelectorAll('.drop__panel a').forEach((a) => a.addEventListener('click', () => setDrop(false)));
  }

  // ---- the burger's panel ----
  const burger = nav.querySelector('[data-burger]');
  const menu = document.getElementById('menu');
  let lastFocus = null;
  const items = menu ? [...menu.querySelectorAll('.menu__list li, .menu__foot > *')] : [];
  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    root.classList.add('is-menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    lock();
    if (gsap && !calm) gsap.fromTo(items, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.045, delay: 0.15, ease: 'expo.out' });
    setTimeout(() => menu.querySelector('a')?.focus(), 60);
  }
  function closeMenu({ restore = true } = {}) {
    if (menu.hidden) return;
    menu.classList.remove('is-open');
    root.classList.remove('is-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Menu');
    unlock();
    setTimeout(() => { menu.hidden = true; }, calm ? 0 : 600);
    if (restore) (lastFocus || burger).focus({ preventScroll: true });
  }
  if (burger && menu) {
    burger.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu-close]')) closeMenu();
      else if (e.target.closest('a')) closeMenu({ restore: false }); // the link's own glide takes over
    });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'Tab') { // keep focus inside: the panel and the burger that closes it
        const f = [burger, ...menu.querySelectorAll('a, button')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // ---- scrolled, hidden, progress ----
  const bar = nav.querySelector('.nav__progress');
  let travel = 0;
  const onScroll = () => {
    const y = scroll.y;
    nav.classList.toggle('is-scrolled', y > 40);
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.setProperty('--p', (y / max).toFixed(4));
    if (calm || !root.classList.contains('is-ready')) return;
    travel = scroll.dir > 0 ? Math.max(0, travel) + Math.abs(scroll.v) : Math.min(0, travel) - Math.abs(scroll.v);
    if (y < innerHeight * 0.6 || travel < -40) nav.classList.remove('is-hidden');
    else if (travel > 120 && !drop?.classList.contains('is-open') && menu?.hidden !== false) nav.classList.add('is-hidden');
  };
  on('scroll', onScroll);
  onScroll();

  // ---- the section you are in ----
  const links = [...nav.querySelectorAll('.nav__link[href^="#"]')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      links.forEach((a) => a.classList.remove('is-current'));
      byId.get(en.target.id)?.classList.add('is-current');
      if (en.target.id === 'top' || !byId.has(en.target.id)) links.forEach((a) => a.classList.remove('is-current'));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const id of ['top', 'payments', 'cards', 'invest', 'features', 'about', 'faq', 'download']) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}
