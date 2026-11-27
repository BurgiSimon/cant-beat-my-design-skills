// Field Notes (blog.html and blog/*.html).
//   - Covers lean toward the pointer: each night poster drifts a few pixels away from it (fine pointers only).
//   - On a post, the header's spectrum line measures the reading of the text (not the whole page), and the lane recap
//     lights its six stages one by one as the reader moves through the story (on narrow screens, where it sits after
//     the text, as it comes into view); the hairline between two stages fills in their colours as the second is reached.
//   - Copy-link buttons (hidden by CSS under html.no-js, so they take their place from the first paint) copy the
//     post's address and say so in the toast.
// Reduced motion: the covers stay still and the recap rests with every stage lit; the header line still follows the
// reading, without animating.
import { $, $$, toast, fine, lenis, clamp } from '../core.js';
import { copyText } from './copy.js';

export default function init({ calm, still }) {
  copyLinks();
  if (!calm && !still && fine) covers();
  reading({ calm: calm || still });
}

function copyLinks() {
  for (const b of $$('[data-fn-copy]')) {
    b.setAttribute('aria-label', 'Copy a link to this note');
    b.addEventListener('click', async () => {
      const ok = await copyText(`${location.origin}${location.pathname}`);
      toast(ok ? 'Link to this note copied' : 'Copy is blocked here', ok ? 'Copied' : 'Oops');
    });
  }
}

function covers() {
  for (const host of $$('.fn-card, .fn-feature, .fn-pager__item, .fn-cover')) {
    const art = $('.fn-art', host);
    if (!art) continue;
    let raf = 0;
    const set = (x, y) => { art.style.setProperty('--px', x.toFixed(3)); art.style.setProperty('--py', y.toFixed(3)); };
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = host.getBoundingClientRect();
      const x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      const y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => set(x, y));
    });
    host.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); set(0, 0); });
  }
}

function reading({ calm }) {
  const prose = $('.fn-post .fn-prose');
  if (!prose) return;
  const bar = $('.header');
  const recap = $('[data-fn-recap]');
  const stages = recap ? $$('.fn-recap__stage', recap) : [];
  const track = !!recap && !calm;
  const narrow = matchMedia('(max-width: 1023.98px)');
  if (track) recap.classList.add('is-tracking');
  let shown = -1;

  const update = () => {
    const r = prose.getBoundingClientRect();
    const line = innerHeight * 0.66;                       // where the eye reads: two thirds down the screen
    const p = clamp((line - r.top) / Math.max(1, r.height), 0, 1);
    // after core.js's own scroll handler (registered first), so the line measures the text, not the page
    bar?.style.setProperty('--progress', p.toFixed(4));
    if (!track) return;
    // beside the text, the recap follows the reading; below it (narrow screens), it fills as it comes into view
    let q = p;
    if (narrow.matches) { const rr = recap.getBoundingClientRect(); q = clamp((innerHeight * 0.92 - rr.top) / Math.max(1, rr.height * 0.85), 0, 1); }
    const n = q <= 0 ? 0 : Math.min(6, 1 + Math.floor(q * 6));
    if (n === shown) return;
    shown = n;
    stages.forEach((li, i) => {
      li.classList.toggle('is-lit', i < n);
      li.classList.toggle('is-passed', i < n - 1);
      li.classList.toggle('is-current', i === n - 1);
    });
  };
  if (lenis) lenis.on('scroll', update); else addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  addEventListener('load', update, { once: true });
  update();
}
