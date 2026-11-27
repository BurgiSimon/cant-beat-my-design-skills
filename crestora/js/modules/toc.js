// A .toc of links to headings follows the reading (aria-current="true" on the section in view); headings with
// data-copy-link get a small button that copies a link to them.
import { toast, lenis, $$ } from '../core.js';
import { copyText } from './copy.js';

// The section being read is the last heading above the reading line (45% down the screen). It is worked out from the
// scroll itself, once a frame at most, so a jump that skips a heading (a link, Home, End) never leaves it stale.
export default function init() {
  const tocs = [];
  for (const toc of $$('.toc')) {
    const links = $$('a[href^="#"]', toc);
    const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    if (targets.length) tocs.push({ links, targets, id: null });
  }
  if (tocs.length) {
    let queued = false;
    const update = () => {
      queued = false;
      const line = innerHeight * 0.45;
      for (const t of tocs) {
        const current = t.targets.filter((el) => el.getBoundingClientRect().top < line).pop() || t.targets[0];
        if (current.id === t.id) continue;
        t.id = current.id;
        for (const a of t.links) {
          if (decodeURIComponent(a.hash.slice(1)) === current.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        }
      }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    if (lenis) lenis.on('scroll', queue);
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    addEventListener('load', queue);
    update();
  }
  for (const h of $$('[data-copy-link]')) {
    if (!h.id) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-link'; b.setAttribute('aria-label', `Copy a link to “${h.textContent.trim()}”`);
    b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-link"/></svg>';
    b.addEventListener('click', async () => { await copyText(`${location.origin}${location.pathname}#${h.id}`); toast('Link copied', 'Copied'); });
    h.append(b);
  }
}
