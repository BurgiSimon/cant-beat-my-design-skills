// The top of the page: the announcement that rolls through its messages, a header that steps out of the way while
// reading down and comes back on the way up (with a progress line), the Explore panel, search and the phone menu.
import { calm, fine, gsap, on, scroll, dialog, emit } from './core.js';

export function init() {
  announce();
  header();
  explore();
  search();
  menu();
}

function announce() {
  const items = [...document.querySelectorAll('.announce__list li')];
  if (items.length < 2 || calm) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    const prev = items[i];
    i = (i + 1) % items.length;
    prev.classList.remove('is-on'); prev.classList.add('is-off');
    items[i].classList.remove('is-off');
    void items[i].offsetWidth;
    items[i].classList.add('is-on');
    setTimeout(() => prev.classList.remove('is-off'), 900);
  }, 4200);
}

function header() {
  const head = document.querySelector('[data-head]');
  const bar = head.querySelector('.head__progress');
  const links = [...head.querySelectorAll('.head__link[href]')];
  let hidden = false, lastY = scroll.y, travel = 0;
  const update = (s) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--progress', max > 0 ? (s.y / max).toFixed(4) : 0);
    head.classList.toggle('is-stuck', s.y > 40);
    const dy = s.y - lastY; lastY = s.y;
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    const hide = s.y > 600 && travel > 60 && !head.classList.contains('is-open-explore');
    const show = travel < -40 || s.y < 300;
    if (hide && !hidden) { hidden = true; head.classList.add('is-hidden'); }
    else if (show && hidden) { hidden = false; head.classList.remove('is-hidden'); }
  };
  on('scroll', update);
  update(scroll);
  head.addEventListener('focusin', () => { hidden = false; head.classList.remove('is-hidden'); });

  // the current section, marked in the nav: "New arrivals" stays lit through the shop
  on('shop:filter', (f) => {
    for (const l of links) l.classList.toggle('is-current', l.dataset.filter === (f === 'accessories' ? 'all' : f));
  });
}

function explore() {
  const btn = document.querySelector('[data-explore]');
  const panel = document.getElementById('explore');
  const head = document.querySelector('[data-head]');
  if (!btn || !panel) return;
  const pics = [...panel.querySelectorAll('.explore__pic img')];
  const show = (key) => pics.forEach((p) => p.classList.toggle('is-on', p.dataset.pic === key));
  let open = false, closeTimer = 0;
  const set = (v) => {
    if (v === open) return;
    open = v;
    btn.setAttribute('aria-expanded', String(v));
    head.classList.toggle('is-open-explore', v);
    clearTimeout(closeTimer);
    if (v) {
      panel.hidden = false;
      show('after');
      if (gsap && !calm) {
        gsap.fromTo(panel, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'expo.out' });
        gsap.fromTo(panel.querySelectorAll('.explore__list a'), { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.045, delay: 0.05 });
      }
    } else if (gsap && !calm) {
      gsap.to(panel, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'expo.in', onComplete: () => { if (!open) panel.hidden = true; } });
    } else panel.hidden = true;
  };
  btn.addEventListener('click', () => set(!open));
  if (fine) {
    btn.addEventListener('pointerenter', () => set(true));
    head.addEventListener('pointerleave', () => { closeTimer = setTimeout(() => set(false), 180); });
    head.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  }
  for (const a of panel.querySelectorAll('a[data-pic]')) {
    a.addEventListener('pointerenter', () => show(a.dataset.pic));
    a.addEventListener('focus', () => show(a.dataset.pic));
    a.addEventListener('click', () => set(false));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); btn.focus(); } });
  document.addEventListener('click', (e) => { if (open && !head.contains(e.target)) set(false); });
  on('scroll', (s) => { if (open && Math.abs(s.v) > 2) set(false); });
}

function search() {
  const el = document.querySelector('[data-search]');
  const input = el.querySelector('[data-search-q]');
  const list = el.querySelector('[data-search-results]');
  const hint = el.querySelector('[data-search-hint]');
  const d = dialog(el, { onOpen: () => setTimeout(() => input.focus(), 80) });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-search-open]');
    if (t) { emit('menu:close'); d.open(t); }
    if (e.target.closest('[data-search-close]')) d.close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); d.open(); }
  });

  const products = () => [...document.querySelectorAll('.card')].map((c) => ({
    id: c.dataset.id, name: c.dataset.name, price: c.dataset.price, cat: c.dataset.cat,
    hay: `${c.dataset.name} ${c.dataset.cat} ${c.dataset.tags || ''} ${c.querySelector('.card__sub')?.textContent || ''}`.toLowerCase(),
    img: c.querySelector('.card__media img')?.getAttribute('src'),
  }));
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const mark = (name, q) => {
    const i = name.toLowerCase().indexOf(q);
    return i < 0 ? esc(name) : `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + q.length))}</mark>${esc(name.slice(i + q.length))}`;
  };
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.replaceChildren(); hint.textContent = 'Try “shell”, “orange” or “reflective”'; return; }
    const words = q.split(/\s+/);
    const found = products().filter((p) => words.every((w) => p.hay.includes(w)));
    hint.textContent = found.length ? `${found.length} result${found.length > 1 ? 's' : ''}` : `Nothing for “${input.value.trim()}” yet. Try “jacket”.`;
    list.innerHTML = found.map((p) => `<li><a href="#shop" data-filter="${p.cat}" data-goto="${p.id}"><img src="${p.img}" alt="" loading="lazy" /><b>${mark(p.name, q)}</b><span class="label">$${p.price}</span></a></li>`).join('');
  });
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-goto]');
    if (!a) return;
    d.close({ silent: true });
    setTimeout(() => emit('shop:show', a.dataset.goto), 50);
  });
}

function menu() {
  const btn = document.querySelector('[data-menu-open]');
  const el = document.querySelector('[data-menu]');
  if (!btn || !el) return;
  let open = false;
  const set = (v) => {
    open = v;
    btn.setAttribute('aria-expanded', String(v));
    if (v) {
      el.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
      document.documentElement.style.overflow = 'hidden';
      if (gsap && !calm) gsap.fromTo(el.querySelectorAll(':scope > a'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.7, delay: 0.15, ease: 'expo.out' });
    } else {
      el.classList.remove('is-on');
      document.documentElement.style.overflow = '';
      setTimeout(() => { if (!open) el.hidden = true; }, 700);
    }
  };
  btn.addEventListener('click', () => set(!open));
  el.addEventListener('click', (e) => { if (e.target.closest('a, button')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); btn.focus(); } });
  on('menu:close', () => open && set(false));
  addEventListener('resize', () => { if (open && innerWidth >= 1000) set(false); });
}
