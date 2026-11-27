// Features: each tile shows its feature working. A light follows the pointer across the grid and catches the
// tiles' edges; the budget ring fills by category; the goal fills and round-ups keep landing; the week's bars grow
// and each one tells its day when you point at it; the exchange rate ticks; alerts keep arriving.

import { gsap, ScrollTrigger, calm, fine, odometer, whenVisible, money } from './core.js';

export function init() {
  const bento = document.querySelector('[data-bento]');
  if (!bento) return;
  const tiles = [...bento.querySelectorAll('[data-tile]')];

  // ---- the light ----
  if (fine && !calm) {
    bento.addEventListener('pointermove', (e) => {
      bento.classList.add('is-lit');
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    });
    bento.addEventListener('pointerleave', () => bento.classList.remove('is-lit'));
  }

  const onEnter = (el, fn) => {
    if (calm || !ScrollTrigger) { fn(true); return; }
    ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => fn(false) });
  };

  // ---- budget ring ----
  const donut = bento.querySelector('[data-donut]');
  if (donut) {
    const segs = [...donut.querySelectorAll('.donut__seg')];
    const C = 2 * Math.PI * 48; const GAP = 6;
    let at = 0;
    const plan = segs.map((s) => { const v = Number(s.dataset.v); const p = { s, len: v * C - GAP, off: -at * C }; at += v; return p; });
    for (const p of plan) { p.s.style.strokeDasharray = `0 ${C}`; p.s.style.strokeDashoffset = `${p.off}`; }
    onEnter(donut, (instant) => plan.forEach((p, i) => {
      if (instant || !gsap) { p.s.style.strokeDasharray = `${p.len} ${C}`; return; }
      const o = { l: 0 };
      gsap.to(o, { l: p.len, duration: 1.2, delay: 0.15 + i * 0.18, ease: 'power3.out', onUpdate: () => { p.s.style.strokeDasharray = `${o.l} ${C}`; } });
    }));
  }

  // ---- the goal ----
  const bar = bento.querySelector('[data-goal-bar]');
  const pctEl = bento.querySelector('[data-goal-pct]'); const amtEl = bento.querySelector('[data-goal-amt]'); const roundEl = bento.querySelector('[data-roundup]');
  let saved = 2160;
  if (bar) {
    const amt = odometer(amtEl, { value: saved, decimals: 0 });
    const pct = odometer(pctEl, { value: 72, decimals: 0 });
    onEnter(bar, (instant) => {
      if (instant || !gsap) return;
      gsap.fromTo(bar, { width: '0%' }, { width: '72%', duration: 1.6, ease: 'expo.out', delay: 0.2 });
    });
    if (!calm) {
      let visible = false;
      whenVisible(bar, (v) => { visible = v; });
      setInterval(() => {
        if (!visible || document.hidden) return;
        const r = Math.round((0.1 + Math.random() * 0.9) * 100) / 100;
        roundEl.textContent = `+$${r.toFixed(2)}`;
        gsap?.fromTo(roundEl.parentElement, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
        saved += r * 6;
        const p = Math.min(99, (saved / 3000) * 100);
        amt.set(Math.round(saved)); pct.set(Math.round(p));
        bar.style.width = `${p}%`;
      }, 2600);
    }
  }

  // ---- the week ----
  const cols = [...bento.querySelectorAll('.bars__cols span')];
  if (cols.length) {
    const total = bento.querySelector('.bars__total');
    const sum = total.querySelector('b'); const lbl = total.querySelector('small');
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const amounts = cols.map((c) => Number(getComputedStyle(c).getPropertyValue('--h')) * 118);
    onEnter(cols[0].parentElement, (instant) => { if (!instant && gsap) gsap.from(cols.map((c) => c.querySelector('i')), { scaleY: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out' }); });
    cols.forEach((c, i) => {
      c.addEventListener('pointerenter', () => { sum.textContent = `$${money(amounts[i])}`; lbl.textContent = DAYS[i]; });
      c.addEventListener('pointerleave', () => { sum.textContent = '$412.60'; lbl.textContent = 'this week'; });
    });
  }

  // ---- the exchange rate ----
  const rateEl = bento.querySelector('[data-fx-rate]'); const outEl = bento.querySelector('[data-fx-out]');
  if (rateEl) {
    let rate = 0.9231;
    const rOdo = odometer(rateEl, { value: rate, decimals: 4 });
    const oOdo = odometer(outEl, { value: rate * 1000, decimals: 2 });
    if (!calm) {
      let visible = false;
      whenVisible(rateEl, (v) => { visible = v; });
      setInterval(() => {
        if (!visible || document.hidden) return;
        rate = Math.min(0.9299, Math.max(0.9171, rate + (Math.random() - 0.5) * 0.0012));
        rOdo.set(rate); oOdo.set(rate * 1000);
      }, 2200);
    }
  }

  // ---- alerts keep arriving: the oldest leaves at the top, a new one slides in below ----
  const stack = bento.querySelector('[data-alerts]');
  if (stack && !calm && gsap) {
    let visible = false;
    whenVisible(stack, (v) => { visible = v; });
    setInterval(() => {
      if (!visible || document.hidden) return;
      const items = [...stack.children];
      const first = items[0];
      const before = items.map((el) => el.getBoundingClientRect().top);
      gsap.to(first, {
        opacity: 0, y: -16, scale: 0.96, duration: 0.45, ease: 'power2.in',
        onComplete: () => {
          stack.append(first);
          const after = [...stack.children].map((el) => el.getBoundingClientRect().top);
          [...stack.children].forEach((el, i) => {
            if (el === first) gsap.fromTo(el, { opacity: 0, y: 24, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'expo.out' });
            else gsap.fromTo(el, { y: before[items.indexOf(el)] - after[i] }, { y: 0, duration: 0.7, ease: 'expo.out' });
          });
        },
      });
    }, 2800);
  }
}
