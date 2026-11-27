// A .toc of links to headings follows the reading (aria-current="true" on the section in view); headings with
// data-copy-link get a small button that copies a link to them.
import { toast, $$ } from '../core.js';
import { copyText } from './copy.js';

export default function init() {
  for (const toc of $$('.toc')) {
    const links = $$('a[href^="#"]', toc);
    const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    if (!targets.length) continue;
    const set = (id) => { for (const a of links) a.toggleAttribute('aria-current', a.hash.slice(1) === id); for (const a of links) if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); };
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
      const visible = targets.filter((t) => seen.get(t.id) !== null && seen.get(t.id) !== undefined);
      const current = visible[0] || targets.filter((t) => t.getBoundingClientRect().top < innerHeight * 0.3).pop() || targets[0];
      set(current.id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    targets.forEach((t) => io.observe(t));
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
