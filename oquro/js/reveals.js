// Scroll-driven reveals: headings rise out of their lines, the statement lights word by word as you read it, copy
// fades up, numbers count, the checklist ticks itself, the performance card's frame draws, the cards lift in, and the
// footer's word rises letter by letter. Everything rests at its designed state without scripts or with reduced motion.

import { calm, gsap, ScrollTrigger, SplitText, ready, fmt, clamp, on } from './core.js';

export async function init() {
  await ready;
  const fades = [...document.querySelectorAll('[data-fade]')];
  if (calm || !gsap || !ScrollTrigger) { fades.forEach((f) => f.classList.add('is-in')); return; }

  // ---- headings ----
  if (SplitText) {
    for (const h of document.querySelectorAll('h2[data-split]')) {
      const split = new SplitText(h, { type: 'lines,words', linesClass: 'line', autoSplit: true, onSplit(self) {
        return gsap.from(self.words, { yPercent: 115, rotate: 3, duration: 1.15, ease: 'expo.out', stagger: 0.045, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
      } });
      h.setAttribute('aria-label', h.textContent.trim().replace(/\s+/g, ' '));
      split.lines.forEach((l) => l.setAttribute('aria-hidden', 'true'));
    }
  }

  // ---- fades ----
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' });
  fades.forEach((f) => io.observe(f));

  // ---- the statement, lit word by word with the scroll (to the colours the shot has: white, then grey) ----
  const st = document.querySelector('[data-statement]');
  if (st) {
    const words = [];
    const wrap = (text, tail) => text.split(/(\s+)/).map((part) => {
      if (!part.trim()) return document.createTextNode(part);
      const w = document.createElement('span'); w.className = 'w'; w.textContent = part; w.dataset.tail = tail ? '1' : ''; words.push(w); return w;
    });
    const parts = [...st.childNodes].flatMap((n) => {
      if (n.nodeType === 3) return wrap(n.textContent, false);
      if (n.nodeName !== 'SPAN') return [n];
      const tail = n.cloneNode(false); tail.append(...wrap(n.textContent, true)); return [tail];
    });
    st.replaceChildren(...parts);
    const paint = (p) => {
      const lit = p * (words.length + 2);
      words.forEach((w, i) => {
        const k = clamp(lit - i, 0, 1); const to = w.dataset.tail ? 108 : 255;
        const c = Math.round(58 + (to - 58) * k);
        w.style.color = `rgb(${c},${c},${c})`;
      });
    };
    paint(0);
    ScrollTrigger.create({ trigger: st, start: 'top 85%', end: 'bottom 50%', scrub: 0.6, onUpdate: (self) => paint(self.progress) });
  }

  // ---- counters ----
  for (const el of document.querySelectorAll('[data-count]')) {
    const to = parseFloat(el.dataset.count); const dec = +el.dataset.dec || 0; const suf = el.dataset.suffix || '';
    const o = { v: 0 };
    el.textContent = `${fmt(0, dec)}${suf}`;
    gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = `${fmt(o.v, dec)}${suf}`; } });
  }

  // ---- 24/7: the digits run before they settle ----
  const tf = document.querySelector('[data-count-to]');
  if (tf) {
    const final = tf.textContent; let frames = 0;
    ScrollTrigger.create({ trigger: tf, start: 'top 90%', once: true, onEnter() {
      const id = setInterval(() => {
        frames++;
        tf.textContent = frames > 16 ? final : `${Math.floor(Math.random() * 90 + 10)}/${Math.floor(Math.random() * 9 + 1)}`;
        if (frames > 16) clearInterval(id);
      }, 55);
    } });
  }

  // ---- the checklist ticks itself ----
  const checks = document.querySelectorAll('[data-checks] li');
  if (checks.length) {
    gsap.from(checks, { opacity: 0, x: -14, duration: 0.8, stagger: 0.12, scrollTrigger: { trigger: checks[0].parentElement, start: 'top 85%', once: true } });
    gsap.from([...checks].map((c) => c.querySelector('.i')), { scale: 0, rotate: -90, duration: 0.7, ease: 'back.out(2)', stagger: 0.12, scrollTrigger: { trigger: checks[0].parentElement, start: 'top 85%', once: true } });
  }

  // ---- the performance card's frame ----
  const perf = document.querySelector('[data-perf]');
  if (perf) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: perf, start: 'top 80%', once: true } });
    tl.from(perf.querySelectorAll('.perf__line--h'), { scaleX: 0, duration: 1.2, ease: 'expo.inOut', stagger: 0.1 })
      .from(perf.querySelectorAll('.perf__line--v'), { scaleY: 0, duration: 1.2, ease: 'expo.inOut', stagger: 0.1 }, 0.1)
      .from(perf.querySelector('.perf__card'), { y: 40, opacity: 0, rotateX: -12, duration: 1.1, ease: 'expo.out' }, 0.35);
  }

  // ---- cards that lift in ----
  const lift = (els, trigger, o = {}) => gsap.from(els, { y: 60, opacity: 0, rotateX: -10, transformPerspective: 900, duration: 1.2, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger, start: 'top 82%', once: true }, ...o });
  lift(document.querySelectorAll('.layers__cards .widget'), '.layers__stage', { delay: 0.2 });
  lift(document.querySelector('.layers__media'), '.layers__stage', { y: 30, rotateX: 0, scale: 0.96 });
  lift(document.querySelectorAll('.protect__grid > *'), '.protect__grid');
  lift(document.querySelector('.monitor'), '.about__top', { y: 40, rotateX: 0, clipPath: 'inset(12% 12% 12% 12% round 10px)' });
  lift(document.querySelector('.intel'), '.about__bottom');
  lift(document.querySelectorAll('.stats > div'), '.stats', { y: 30, rotateX: 0 });
  lift(document.querySelectorAll('.tabs .tab'), '.tabs', { y: 16, rotateX: 0, stagger: 0.07 });
  lift(document.querySelectorAll('.acc__item'), '.acc', { y: 24, rotateX: 0, stagger: 0.08 });

  // ---- parallax: the about card and the garden drift against the scroll ----
  gsap.to('.monitor__canvas', { yPercent: 8, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.monitor', start: 'top bottom', end: 'bottom top', scrub: true } });

  // ---- the footer word, letter by letter, and letters that lift under the pointer ----
  const fw = document.querySelector('[data-foot-word]');
  if (fw) {
    const inner = document.createElement('span');
    inner.innerHTML = [...fw.textContent].map((c) => `<span class="ch">${c}</span>`).join('');
    fw.replaceChildren(inner);
    const chars = inner.querySelectorAll('.ch');
    gsap.from(chars, { yPercent: 100, duration: 1.4, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: fw, start: 'top 95%', once: true } });
    fw.style.overflow = 'hidden';
    chars.forEach((c) => {
      c.addEventListener('pointerenter', () => gsap.to(c, { yPercent: -8, duration: 0.5, ease: 'power3.out' }));
      c.addEventListener('pointerleave', () => gsap.to(c, { yPercent: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  on('intro:done', () => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}
