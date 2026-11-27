// Things arriving as you read: headings climb out of their lines, the mono labels decode, the manifesto darkens
// word by word as you pass it, the band runs faster (and turns round) with the scroll and its badge swings, pictures
// open from a slit. Big headings lean with the speed of the scroll: nothing here stands still.
import { calm, gsap, ScrollTrigger, SplitText, scroll, loop, damp, clamp, fine } from './core.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#[]+-—';

export function init() {
  if (!gsap) return;
  band();
  if (calm || !ScrollTrigger) return;

  headings();
  decode();
  statement();
  pictures();
  lean();
  coords();
}

function headings() {
  const els = document.querySelectorAll('.shop__title, .pace__title, .lab__title, .club__title, .foot__title, .after__title .line');
  for (const el of els) {
    let lines;
    if (SplitText && !el.classList.contains('line')) {
      const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      lines = split.lines;
    } else {
      const wrap = document.createElement('span');
      wrap.style.display = 'block';
      wrap.append(...el.childNodes);
      el.append(wrap);
      el.style.overflow = 'hidden';
      el.style.paddingTop = '0.08em'; el.style.marginTop = '-0.08em';
      lines = [wrap];
    }
    gsap.from(lines, {
      yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  }
}

// mono labels resolve out of noise, left to right
function decode() {
  const els = document.querySelectorAll('.story__side > .label:first-child, .shop__head > .label, .after__tag, .after__clock, .pace__note, .pace__label, .lab__copy > .label, .club__head > .label, .foot__news > .label, .hero__meta');
  for (const el of els) {
    const nodes = [];
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3 && c.textContent.trim()) nodes.push({ n: c, text: c.textContent }); else if (c.nodeType === 1 && c.tagName !== 'TIME') walk(c); } };
    walk(el);
    if (!nodes.length) continue;
    const total = nodes.reduce((a, x) => a + x.text.length, 0);
    const run = () => {
      const st = { p: 0 };
      gsap.to(st, {
        p: 1, duration: Math.min(1.4, 0.45 + total * 0.02), ease: 'none',
        onUpdate() {
          let i = 0;
          for (const x of nodes) {
            let out = '';
            for (const ch of x.text) {
              const k = i++ / total;
              if (ch === ' ' || k < st.p - 0.12) out += ch;
              else if (k < st.p) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
              else out += ch === ' ' ? ' ' : ' ';
            }
            x.n.textContent = out;
          }
        },
        onComplete() { for (const x of nodes) x.n.textContent = x.text; },
      });
    };
    for (const x of nodes) x.n.textContent = x.text.replace(/\S/g, ' ');
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: run });
  }
}

// the manifesto: grey until read
function statement() {
  const el = document.querySelector('[data-statement]');
  if (!el) return;
  let words;
  if (SplitText) words = new SplitText(el, { type: 'words', wordsClass: 'w' }).words;
  else return;
  gsap.fromTo(words, { color: '#d3cfc6' }, {
    color: '#0f0f0e', ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 },
  });
  gsap.from('.story__pillars li', { opacity: 0, y: 16, duration: 0.9, stagger: 0.08, scrollTrigger: { trigger: '.story__pillars', start: 'top 92%', once: true } });
}

// pictures open from a slit and settle
function pictures() {
  for (const el of document.querySelectorAll('.pace__card')) {
    gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    const img = el.querySelector('img');
    gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, clearProps: 'scale' });
    gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  const cards = [...document.querySelectorAll('.card')].slice(0, 6);
  gsap.from(cards, { opacity: 0, y: 40, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '.shop__rail', start: 'top 88%', once: true } });
  gsap.from('.shop__tab', { opacity: 0, x: 30, duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '.shop__bar', start: 'top 90%', once: true } });
}

// big type leans with the speed of the scroll
function lean() {
  const els = [...document.querySelectorAll('.hero__title, .shop__title, .pace__title, .club__title, .foot__word')];
  if (!els.length) return;
  const setters = els.map((el) => gsap.quickSetter(el, 'skewX', 'deg'));
  let s = 0;
  loop(document.body, (dt) => {
    const want = clamp(-scroll.v * 0.12, -7, 7);
    s = damp(s, want, 7, dt);
    if (Math.abs(s) < 0.01 && Math.abs(want) < 0.01) return;
    for (const set of setters) set(s);
  }, '0px');
}

// the coordinates read like a live fix: the last digit hunts
function coords() {
  const el = document.querySelector('[data-coords]');
  if (!el) return;
  const base = el.textContent;
  setInterval(() => {
    if (document.hidden) return;
    const a = (26.4 + (Math.random() - 0.5) * 0.2).toFixed(1);
    const b = (39.6 + (Math.random() - 0.5) * 0.2).toFixed(1);
    el.textContent = base.replace('26.4', a).replace('39.6', b);
  }, 1800);
}

// the band: runs on its own, faster with the scroll and the other way when the scroll turns; the badge swings
function band() {
  const el = document.querySelector('.band');
  const run = el?.querySelector('.band__run');
  const badge = el?.querySelector('.band__badge');
  if (!run) return;
  if (calm) { run.style.animation = 'none'; return; }
  let x = 0, dir = -1, boost = 0, r = 0, half = run.scrollWidth / 2;
  new ResizeObserver(() => { half = run.scrollWidth / 2; }).observe(run);
  let hover = 0;
  if (fine) { el.addEventListener('pointerenter', () => { hover = 1; }); el.addEventListener('pointerleave', () => { hover = 0; }); }
  loop(el, (dt, t) => {
    if (Math.abs(scroll.v) > 0.5) dir = scroll.v > 0 ? -1 : 1;
    boost = damp(boost, Math.abs(scroll.v) * 1.4, 6, dt);
    const speed = (60 + boost * 40) * (hover ? 0.35 : 1);
    x += dir * speed * dt;
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    run.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    const want = clamp(scroll.v * 0.6, -14, 14) + Math.sin(t * 1.3) * 2.5;
    r = damp(r, want, 5, dt);
    badge.style.setProperty('--badge-r', `${r.toFixed(2)}deg`);
  });
}
