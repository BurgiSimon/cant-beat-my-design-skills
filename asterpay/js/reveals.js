// How the page arrives as you scroll: headings rise out of their lines, copy fades up, the statement lights word
// by word as you read it, numbers count up, the market tape and the reviews drift (faster, and with you, when you
// scroll), and the giant wordmark at the foot rises letter by letter.

import { gsap, ScrollTrigger, SplitText, calm, on, scroll, whenVisible, ready, once } from './core.js';

export async function init() {
  await ready;

  // ---- fade-ups: a stagger among siblings that arrive together ----
  const fades = [...document.querySelectorAll('[data-fade]')];
  if (calm) fades.forEach((el) => el.classList.add('is-in'));
  else {
    const io = new IntersectionObserver((entries) => {
      const arriving = entries.filter((e) => e.isIntersecting).map((e) => e.target);
      arriving.forEach((el, i) => { el.style.transitionDelay = `${i * 70}ms`; el.classList.add('is-in'); io.unobserve(el); });
    }, { rootMargin: '0px 0px -8% 0px' });
    fades.forEach((el) => io.observe(el));
  }

  // ---- headings: lines rise out of a mask ----
  if (gsap && SplitText && ScrollTrigger) {
    for (const el of document.querySelectorAll('[data-split]')) {
      const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
      gsap.from(split.lines, {
        yPercent: 110, duration: 1.2, stagger: 0.09, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    }

    // ---- the statement: each word lights as the reading line passes it ----
    const st = document.querySelector('[data-scrub]');
    if (st) {
      const split = new SplitText(st, { type: 'words', wordsClass: 'w' });
      gsap.fromTo(split.words, { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: st, start: 'top 78%', end: 'bottom 42%', scrub: 0.4 },
      });
    }

    // ---- the giant wordmark ----
    const word = document.querySelector('[data-word]');
    if (word) {
      const split = new SplitText(word, { type: 'chars', charsClass: 'ch' });
      gsap.from(split.chars, { yPercent: 100, duration: 1.4, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: word, start: 'top 98%', once: true } });
    }
  }

  // ---- numbers count up ----
  const counters = [...document.querySelectorAll('[data-count-to]')];
  if (!calm && gsap) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target; io.unobserve(el);
        const to = Number(el.dataset.countTo); const dec = Number(el.dataset.decimals || 0);
        const n = { v: 0 };
        gsap.to(n, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = n.v.toFixed(dec); } });
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    counters.forEach((el) => { el.textContent = (0).toFixed(Number(el.dataset.decimals || 0)); io.observe(el); });
  }

  // ---- drifting rows: the tape and the reviews ----
  const rows = [
    ...[...document.querySelectorAll('[data-tape]')].map((el) => ({ el, speed: 46, dir: 1 })),
    ...[...document.querySelectorAll('[data-reviews]')].map((el) => ({ el, speed: 30, dir: Number(el.dataset.reviews) })),
  ];
  for (const r of rows) {
    const set = r.el.firstElementChild;
    // copies until the row is at least two screens long; the copies are for the eye only
    const need = Math.ceil((innerWidth * 2) / Math.max(1, set.offsetWidth)) + 1;
    for (let i = 0; i < need; i++) { const c = set.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('a, button').forEach((x) => x.setAttribute('tabindex', '-1')); r.el.append(c); }
    r.w = set.offsetWidth; r.x = r.dir > 0 ? 0 : -r.w; r.boost = 0; r.hover = false; r.visible = false; r.slow = 1;
    r.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') r.hover = true; });
    r.el.addEventListener('pointerleave', () => { r.hover = false; });
    whenVisible(r.el, (v) => { r.visible = v; });
    addEventListener('resize', () => { r.w = set.offsetWidth; });
  }
  if (!calm && gsap && rows.length) {
    let sv = 0;
    on('scroll', () => { sv = scroll.v; });
    gsap.ticker.add((t, dtMs) => {
      const dt = Math.min(0.05, dtMs / 1000);
      sv *= 0.9;
      for (const r of rows) {
        if (!r.visible) continue;
        r.boost += (Math.min(6, Math.abs(sv) * 0.12) - r.boost) * 0.08;
        r.slow += ((r.hover ? 0.15 : 1) - r.slow) * 0.06;
        const way = r.dir * (scroll.dir || 1);
        r.x -= way * r.speed * (1 + r.boost) * r.slow * dt;
        r.x = ((r.x % r.w) + r.w) % r.w - r.w;   // always in [-w, 0)
        r.el.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0)`;
      }
    });
  }

  // ---- the tape ticks too ----
  if (!calm) {
    const cells = [...document.querySelectorAll('.tape__set li')];
    once('intro:done', () => setInterval(() => {
      if (document.hidden) return;
      const sym = cells[Math.floor(Math.random() * Math.min(10, cells.length))]?.querySelector('b')?.textContent;
      if (!sym) return;
      const up = Math.random() > 0.42;
      const delta = (Math.random() * 0.4 + 0.02) * (up ? 1 : -1);
      for (const li of cells) {
        if (li.querySelector('b').textContent !== sym) continue;
        const em = li.querySelector('em'); const span = li.querySelector('span');
        const pct = parseFloat(em.textContent.replace('−', '-')) + delta;
        em.textContent = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
        em.className = pct >= 0 ? 'up' : 'down';
        const raw = span.textContent; const num = parseFloat(raw.replace(/[$,]/g, ''));
        const dec = raw.includes('.') ? raw.split('.')[1].length : 0;
        const next = num * (1 + delta / 100);
        span.textContent = (raw.startsWith('$') ? '$' : '') + next.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      }
    }, 1400));
  }
  ScrollTrigger?.refresh();
}
