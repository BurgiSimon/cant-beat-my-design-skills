// Small things everywhere: labels that roll on hover, magnetic buttons, anchors that glide (and set the shop's filter
// on the way), and a cursor that says what a click will do.
import { calm, fine, gsap, emit, scrollToTarget, pointer, on } from './core.js';

export function init() {
  // ---- text roll: the label twice, one under the other ----
  for (const el of document.querySelectorAll('[data-roll]')) {
    const a = document.createElement('span'); a.className = 'roll'; a.textContent = el.textContent;
    const b = a.cloneNode(true); b.setAttribute('aria-hidden', 'true');
    el.replaceChildren(a, b);
  }

  // ---- anchors: glide, move focus, and pass a filter to the shop ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.getElementById('top') : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    emit('nav:go', { id, filter: a.dataset.filter });
    if (a.dataset.filter) emit('shop:filter', a.dataset.filter);
    scrollToTarget(target);
    history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id);
    if (id !== '#top') {
      target.setAttribute('tabindex', '-1');
      setTimeout(() => target.focus({ preventScroll: true }), 50);
    }
  });

  if (calm || !fine || !gsap) return;

  // ---- magnetic buttons ----
  for (const el of document.querySelectorAll('[data-magnet]')) {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  }

  // ---- cursor ----
  const cur = document.querySelector('.cursor');
  const label = cur.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');
  const cx = gsap.quickTo(cur, 'x', { duration: 0.18, ease: 'power3.out' });
  const cy = gsap.quickTo(cur, 'y', { duration: 0.18, ease: 'power3.out' });
  on('pointer', (p) => { cx(p.x); cy(p.y); cur.classList.toggle('is-out', !p.active); });
  let current = '';
  const setLabel = (t) => {
    if (t === current) return;
    current = t;
    if (t) label.textContent = t;
    cur.classList.toggle('is-label', !!t);
  };
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const lab = t.closest('[data-cursor]');
    setLabel(lab ? lab.dataset.cursor : '');
    cur.classList.toggle('is-link', !lab && !!t.closest('a, button, [role="tab"], label'));
    cur.classList.toggle('is-text', !lab && !!t.closest('input'));
  });
  document.addEventListener('pointerdown', () => cur.classList.add('is-down'));
  document.addEventListener('pointerup', () => cur.classList.remove('is-down'));
  // a label can change while the pointer sits still (the rail starts dragging)
  on('cursor', (t) => setLabel(t));
  cx(pointer.x); cy(pointer.y);
}
