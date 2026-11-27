// The providers strip: an endless line that drifts, runs faster (and turns round) with the scroll, and slows to a
// stop under the pointer so a name can be read.

import { calm, loop, on, damp, fine } from './core.js';

export function init() {
  const track = document.querySelector('[data-marquee]');
  const list = track?.querySelector('.strip__list');
  if (!track || !list || calm) return;
  // copies until two lists' worth is wider than the screen; the copies are decoration
  const original = [...list.children];
  const fill = () => {
    while (list.scrollWidth < track.clientWidth * 2 + 400) {
      for (const li of original) { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); list.append(c); }
    }
  };
  fill(); addEventListener('resize', fill);
  // one copy of the original set is the period of the loop
  const period = () => original.reduce((w, li) => w + li.getBoundingClientRect().width, 0);
  let P = period(); addEventListener('resize', () => { P = period(); });
  let x = 0; let speed = 1; let boost = 0; let dir = -1; let hover = false;
  on('scroll', (s) => { boost = Math.min(9, boost + Math.abs(s.v) * 0.03); if (s.v) dir = s.v > 0 ? -1 : 1; });
  if (fine) { track.addEventListener('pointerenter', () => { hover = true; }); track.addEventListener('pointerleave', () => { hover = false; }); }
  loop(track, (dt) => {
    boost = damp(boost, 0, 2.2, dt);
    speed = damp(speed, hover ? 0 : 1, 4, dt);
    x += dir * (38 + boost * 60) * speed * dt;
    if (x <= -P) x += P; if (x > 0) x -= P;
    list.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  });
}
