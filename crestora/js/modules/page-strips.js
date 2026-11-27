// A helper the page modules share (not a page module of its own; nothing lists it in `modules:`).
// On a phone, a row of chips rides one line and scrolls sideways. The browser leaves a focused chip alone while any of
// it shows, so Tab could land on a chip cut off at the edge, or hidden under the strip's fade, its focus ring unseen.
// keepFocusInStrips() brings a chip the keyboard lands on fully into view, clear of the edges its strip declares with
// scroll-padding-inline (in px: the width of its fade or gutter). Only the strip scrolls; the page stays put.
import { calm } from '../core.js';

export function keepFocusInStrips(...strips) {
  for (const strip of strips) {
    if (!strip || strip._keepsFocus) continue;
    strip._keepsFocus = true;
    strip.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el === strip || !el.matches(':focus-visible')) return;
      if (strip.scrollWidth <= strip.clientWidth + 1) return;                // not scrolling at this width
      const cs = getComputedStyle(strip);
      const padL = parseFloat(cs.scrollPaddingLeft) || 0;
      const padR = parseFloat(cs.scrollPaddingRight) || 0;
      const s = strip.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      let dx = 0;
      if (r.left < s.left + padL) dx = r.left - (s.left + padL);
      else if (r.right > s.right - padR) dx = Math.min(r.right - (s.right - padR), r.left - (s.left + padL));
      if (Math.abs(dx) < 1) return;
      strip.scrollBy({ left: dx, behavior: calm ? 'auto' : 'smooth' });
    });
  }
}
