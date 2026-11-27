// Small things: buttons that lean towards the pointer, a favicon whose cells cycle through the colours while the tab
// is open, a signature in the console, and the footer's clock.

import { calm, fine, gsap, PALETTE } from './core.js';
import { grid } from './mark.js';

export function init() {
  // ---- magnetic buttons ----
  if (fine && !calm && gsap) {
    for (const el of document.querySelectorAll('[data-magnetic]')) {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x(((e.clientX - r.left) / r.width - 0.5) * Math.min(10, r.width * 0.06));
        y(((e.clientY - r.top) / r.height - 0.5) * 6);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    }
  }

  // ---- favicon: the mark, its cells stepping through the colours ----
  const link = document.querySelector('link[rel="icon"]');
  if (link && !calm) {
    const g = grid(); const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    let step = 0;
    const draw = () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 64);
      const s = 56 / 52;
      for (const cell of g.cells) {
        ctx.fillStyle = PALETTE[(cell.ref + step + Math.floor((cell.i + cell.j) / 18)) % 4];
        ctx.fillRect(4 + cell.i * s, 6 + cell.j * s, s + 0.15, s + 0.15);
      }
      link.href = c.toDataURL('image/png'); link.type = 'image/png';
      step++;
    };
    let timer = 0;
    const run = () => { clearInterval(timer); if (!document.hidden) { draw(); timer = setInterval(draw, 1600); } };
    document.addEventListener('visibilitychange', run);
    run();
  }

  // ---- the footer clock (UTC) ----
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const set = () => { clock.textContent = new Date().toISOString().slice(11, 19); };
    set(); setInterval(set, 1000);
  }

  // ---- console ----
  const m = grid(); const rows = [];
  for (let j = 0; j < m.rows; j += 3) {
    let s = '';
    for (let i = 0; i < m.cols; i += 1.5) s += m.cells.some((c) => c.j === j && c.i === Math.floor(i)) ? '█' : ' ';
    rows.push(s);
  }
  console.log(`%c${rows.join('\n')}\n\n%cUnoRouter%c · one key, every model. A design study.`, 'color:#ff3c0c;line-height:1', 'color:#fff;font-weight:600', 'color:#999');
}
