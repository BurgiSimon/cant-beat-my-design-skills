// A .toc of links to headings follows the reading (aria-current="true" on the section in view), and one folded into a
// <details> folds away once a section is chosen; headings with data-copy-link get a small button that copies a link to
// them (the heading's accessible name stays its own words).
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
  // a contents list folded into a <details> (the legal pages' "On this page" on phones) closes once a section is chosen:
  // in the capture phase, so the kit's glide measures the page as it will be with the list folded away
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('.toc a[href^="#"]');
    const fold = a?.closest('.toc')?.closest('details');
    if (fold?.open && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.button) fold.open = false;
  }, true);

  for (const h of $$('[data-copy-link]')) {
    if (!h.id || h.querySelector(':scope > .copy-link')) continue;
    const name = h.textContent.trim();
    // the heading is named by its own words only, not by the button that sits at its end: its text is wrapped in a span
    // that names it (inline, so nothing moves)
    const label = document.createElement('span');
    let lid = `${h.id}-name`;
    for (let i = 2; document.getElementById(lid); i++) lid = `${h.id}-name-${i}`;
    label.id = lid;
    label.append(...h.childNodes);
    h.append(label);
    h.setAttribute('aria-labelledby', lid);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-link'; b.setAttribute('aria-label', `Copy a link to “${name}”`);
    b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-link"/></svg>';
    b.addEventListener('click', async () => { await copyText(`${location.origin}${location.pathname}#${h.id}`); toast('Link copied', 'Copied'); });
    h.append(b);
  }
}
