// Small things everywhere: labels that roll on hover, buttons that lean towards the pointer, cards that tilt with a
// light sliding over them, a cursor label over things you can drag, anchors that glide (and move focus), the sign-up
// form, back to top.

import { gsap, calm, fine, lenis, on, scrollToTarget, damp } from './core.js';

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

  if (fine && !calm && gsap) {
    // Magnetic: the button follows the pointer a little and springs back.
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

    // Tilt: cards lean towards the pointer, and the light on them follows it.
    for (const el of document.querySelectorAll('[data-tilt]')) {
      const st = { rx: 0, ry: 0, tx: 0, ty: 0, gx: 30, gy: 0, tgx: 30, tgy: 0, on: false, raf: 0 };
      const max = el.classList.contains('intel') || el.classList.contains('perf__card') ? 6 : 10;
      const step = () => {
        st.rx = damp(st.rx, st.tx, 8, 1 / 60); st.ry = damp(st.ry, st.ty, 8, 1 / 60);
        st.gx = damp(st.gx, st.tgx, 8, 1 / 60); st.gy = damp(st.gy, st.tgy, 8, 1 / 60);
        el.style.transform = `perspective(900px) rotateX(${st.rx.toFixed(3)}deg) rotateY(${st.ry.toFixed(3)}deg)`;
        el.style.setProperty('--gx', `${st.gx.toFixed(1)}%`); el.style.setProperty('--gy', `${st.gy.toFixed(1)}%`);
        el.style.setProperty('--glow', st.on ? 1 : 0.8);
        if (st.on || Math.abs(st.rx) + Math.abs(st.ry) > 0.02) st.raf = requestAnimationFrame(step);
        else { el.style.transform = ''; st.raf = 0; }
      };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        st.ty = (px - 0.5) * max; st.tx = -(py - 0.5) * max; st.tgx = px * 100; st.tgy = py * 100; st.on = true;
        if (!st.raf) st.raf = requestAnimationFrame(step);
      });
      el.addEventListener('pointerleave', () => { st.tx = st.ty = 0; st.tgx = 30; st.tgy = 0; st.on = false; if (!st.raf) st.raf = requestAnimationFrame(step); });
    }

    // The cursor label: something to drag says so.
    const cur = document.querySelector('[data-cursor]');
    const label = cur?.querySelector('[data-cursor-label]');
    if (cur) {
      let x = -100, y = -100, cx = -100, cy = -100, raf = 0;
      const move = () => { cx = damp(cx, x, 18, 1 / 60); cy = damp(cy, y, 18, 1 / 60); cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; raf = cur.classList.contains('is-on') ? requestAnimationFrame(move) : 0; };
      addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
      on('cursor', (text) => {
        if (text) { label.textContent = text; if (!cur.classList.contains('is-on')) { cx = x; cy = y; } cur.classList.add('is-on'); if (!raf) raf = requestAnimationFrame(move); }
        else cur.classList.remove('is-on');
      });
    }
  }

  // In-page links glide there; focus follows, so the keyboard carries on from the section it landed in.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const id = a.getAttribute('href');
    const target = id === '#top' || id === '#' ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -10 });
    history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id);
    if (target !== document.body) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      setTimeout(() => target.focus({ preventScroll: true }), lenis ? 1100 : 0);
    }
  });

  // The sign-up: honest about being a design study.
  const form = document.querySelector('[data-cta-form]');
  if (form) {
    const input = form.querySelector('input'); const msg = form.querySelector('[data-cta-msg]'); const btn = form.querySelector('button');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      msg.classList.remove('is-ok', 'is-err');
      const v = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        msg.textContent = 'That doesn’t look like an email address yet.'; msg.classList.add('is-err');
        input.setAttribute('aria-invalid', 'true'); input.focus();
        form.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 320 });
        return;
      }
      input.removeAttribute('aria-invalid');
      btn.disabled = true;
      msg.textContent = 'Securing your workspace…';
      setTimeout(() => {
        btn.disabled = false; input.value = '';
        msg.textContent = `You’re in. OQURO is a design study, so no email is coming to ${v.replace(/</g, '')}, but your vault would be ready.`;
        msg.classList.add('is-ok');
      }, 900);
    });
  }

  document.querySelector('[data-to-top]')?.addEventListener('click', () => {
    scrollToTarget(0);
    setTimeout(() => document.querySelector('.nav .brand')?.focus({ preventScroll: true }), lenis ? 1200 : 0);
  });
}
