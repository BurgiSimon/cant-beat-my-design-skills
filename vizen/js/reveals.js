// What happens as you read: headings rise out of their lines, the statement lights up word by word, the numbers roll
// up, the footer's wordmark draws itself.

import { gsap, ScrollTrigger, SplitText, calm, odometer, whenVisible, on } from './core.js';

export function init() {
  // headings: lines out of their masks
  if (gsap && ScrollTrigger && SplitText && !calm) {
    for (const h of document.querySelectorAll('.anatomy__head .h2, .tunnel .h2, .vaultgrid .h2')) {
      const split = new SplitText(h, { type: 'lines', mask: 'lines', linesClass: 'line-in' });
      gsap.from(split.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: h, start: 'top 85%' } });
    }
    for (const el of document.querySelectorAll('.eyebrow, .lede, .tunnel__rig, .cards, .stats, .foot__grid')) {
      if (el.closest('.hero')) continue;
      gsap.from(el, { opacity: 0, y: 24, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    }
  }

  // the statement: each word comes up as you read it
  const st = document.querySelector('[data-statement]');
  if (st && !calm) {
    const words = st.textContent.trim().split(/\s+/);
    st.setAttribute('aria-label', st.textContent.trim());
    st.innerHTML = words.map((w) => `<span class="w" aria-hidden="true">${w.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join(' ');
    const spans = [...st.querySelectorAll('.w')];
    const paint = () => {
      const r = st.getBoundingClientRect();
      const p = (innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.4);
      const k = p * spans.length * 1.15;
      spans.forEach((s, i) => s.style.setProperty('--o', String(Math.min(1, Math.max(0.16, k - i)))));
    };
    let live = false;
    whenVisible(st, (v) => { live = v; if (v) paint(); }, '0px');
    on('scroll', () => { if (live) paint(); });
  }

  // numbers that roll up when they arrive
  for (const el of document.querySelectorAll('[data-count-to]')) {
    const to = Number(el.dataset.countTo);
    const o = odometer(el, { value: calm ? to : 0 });
    if (calm) continue;
    let done = false;
    whenVisible(el, (v) => { if (v && !done) { done = true; o.scramble(); requestAnimationFrame(() => o.set(to)); } }, '-10% 0px');
  }

  // the wordmark: each letter's stroke draws in
  const word = document.querySelector('[data-word]');
  if (word && gsap && ScrollTrigger && !calm) {
    const paths = [...word.querySelectorAll('path')];
    for (const p of paths) { const l = p.getTotalLength(); p.style.strokeDasharray = `${l}`; p.style.strokeDashoffset = `${l}`; }
    gsap.to(paths, { strokeDashoffset: 0, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: word, start: 'top 98%', end: 'bottom 75%', scrub: 0.8 } });
  }
}
