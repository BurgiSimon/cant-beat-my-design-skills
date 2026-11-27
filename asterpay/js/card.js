// Cards: a card you can hold. It tilts towards the pointer with light sliding over its metal, turns over when
// pressed, spins in from its back the first time it comes into view, and answers its controls: three finishes,
// freeze (frost over it), online payments (a flag on it), and a monthly limit against what has been spent.

import { gsap, ScrollTrigger, calm, fine, money, damp } from './core.js';

const FLOORS = {
  ember: 'radial-gradient(50% 50% at 50% 50%, rgb(246 80 47 / 0.55), rgb(160 30 10 / 0.18) 55%, transparent 75%)',
  onyx: 'radial-gradient(50% 50% at 50% 50%, rgb(246 80 47 / 0.3), rgb(80 20 10 / 0.12) 55%, transparent 75%)',
  steel: 'radial-gradient(50% 50% at 50% 50%, rgb(255 230 220 / 0.32), rgb(160 140 140 / 0.1) 55%, transparent 75%)',
};

export function init() {
  const card = document.querySelector('[data-card]');
  if (!card) return;
  const stage = document.querySelector('[data-card-stage]');
  const floor = stage.querySelector('.cards__floor');
  card.dataset.finish = 'ember';

  // ---- tilt and light ----
  const tilt = { rx: 0, ry: 0, mx: 50, my: 30, tx: 0, ty: 0, over: false };
  let raf = 0; let t0 = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    const time = now / 1000;
    const wantX = tilt.over ? tilt.tx : Math.sin(time * 0.7) * 4;     // left alone, it breathes
    const wantY = tilt.over ? tilt.ty : Math.cos(time * 0.5) * 7;
    tilt.rx = damp(tilt.rx, wantX, 6, dt); tilt.ry = damp(tilt.ry, wantY, 6, dt);
    card.style.setProperty('--rx', `${tilt.rx.toFixed(2)}deg`);
    card.style.setProperty('--ry', `${tilt.ry.toFixed(2)}deg`);
    // the light sits opposite the tilt
    card.style.setProperty('--mx', `${(50 + tilt.ry * 3.2).toFixed(1)}%`);
    card.style.setProperty('--my', `${(40 - tilt.rx * 3.2).toFixed(1)}%`);
    card.style.setProperty('--sx', `${(50 - tilt.ry * 4).toFixed(1)}%`);
    if (running) raf = requestAnimationFrame(frame);
  }
  let running = false;
  const io = new IntersectionObserver(([en]) => {
    running = en.isIntersecting && !calm;
    if (running && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(card);
  if (fine && !calm) {
    stage.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.over = true; tilt.ty = clamp(x, -0.8, 0.8) * 26; tilt.tx = clamp(-y, -0.8, 0.8) * 20;
    });
    stage.addEventListener('pointerleave', () => { tilt.over = false; });
  }

  // ---- turning it over ----
  let flipped = false;
  const flip = () => {
    flipped = !flipped;
    card.classList.add('is-flipping');
    card.style.setProperty('--flip', flipped ? '180deg' : '0deg');
    card.setAttribute('aria-pressed', String(flipped));
    card.setAttribute('aria-label', flipped ? 'AsterPay card, back. Press to turn it over.' : 'AsterPay card. Press to turn it over.');
    setTimeout(() => card.classList.remove('is-flipping'), 900);
  };
  card.addEventListener('click', flip);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });

  // ---- the first look: it spins in from its back ----
  if (gsap && ScrollTrigger) {
    gsap.fromTo(card, { '--flip': '-180deg', y: 60, scale: 0.9 }, {
      '--flip': '0deg', y: 0, scale: 1, duration: 1.8, ease: 'expo.out',
      scrollTrigger: { trigger: stage, start: 'top 75%', once: true },
      onComplete: () => card.style.setProperty('--flip', '0deg'),
    });
  }

  // ---- controls ----
  const swatches = [...document.querySelectorAll('[data-finish]')];
  const setFinish = (btn, focus) => {
    for (const b of swatches) { const on = b === btn; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    card.dataset.finish = btn.dataset.finish;
    floor.style.background = FLOORS[btn.dataset.finish];
    if (focus) btn.focus();
    if (gsap && !calm) gsap.fromTo(card, { scale: 0.97 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
  };
  swatches.forEach((b, i) => {
    b.addEventListener('click', () => setFinish(b));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      setFinish(swatches[(i + d + swatches.length) % swatches.length], true);
    });
  });

  const freeze = document.querySelector('[data-freeze]');
  freeze?.addEventListener('change', () => {
    card.classList.toggle('is-frozen', freeze.checked);
    if (freeze.checked && gsap && !calm) gsap.fromTo(card, { x: -6 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' });
  });
  const online = document.querySelector('[data-online]');
  online?.addEventListener('change', () => card.classList.toggle('is-offline', !online.checked));

  const limit = document.querySelector('[data-limit]');
  const out = document.querySelector('[data-limit-out]');
  const bar = document.querySelector('[data-spent-bar]');
  const note = document.querySelector('[data-spent-text]');
  const SPENT = 1840;
  const setLimit = () => {
    const v = Number(limit.value);
    out.textContent = `$${money(v, 0)}`;
    const pct = ((v - limit.min) / (limit.max - limit.min)) * 100;
    limit.style.setProperty('--v', `${pct}%`);
    bar.style.width = `${Math.min(100, (SPENT / v) * 100)}%`;
    const over = SPENT > v;
    bar.parentElement.classList.toggle('is-over', over);
    note.textContent = over ? `$${money(SPENT, 0)} spent: over your limit` : `$${money(SPENT, 0)} spent this month`;
  };
  limit?.addEventListener('input', setLimit);
  if (limit) setLimit();
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
