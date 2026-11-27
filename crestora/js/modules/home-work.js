// Home #work: what the generic filter module leaves to the section. The result line ("Showing 2 film projects."),
// the tiles that leave fading out where they stood (the filter itself glides the ones that stay), the posters leaning
// toward the pointer, the live chip's pulse resting while it is off screen, and keyboard focus that brings a tile (or
// a chip) fully into view, also inside the strips that scroll sideways on a phone.
import { $, $$, gsap, fine, whenVisible } from '../core.js';

// how the result line names what is showing: [one, many]
const NOUN = { all: ['project', 'projects'], film: ['film project', 'film projects'], apps: ['app', 'apps'], audio: ['music & audio project', 'music & audio projects'], writing: ['writing project', 'writing projects'], objects: ['object', 'objects'] };

export default function init({ calm, still }) {
  const section = $('#work');
  if (!section) return;
  const wall = $('.work-wall', section);
  const grid = $('.work-grid', section);
  const group = $('[data-filter-group]', section);
  const count = $('[data-work-count]', section);
  const tiles = $$('.work-tile', grid);
  const moving = !calm && !still;

  // the result line, read out politely
  const say = () => {
    const f = group?.querySelector('[aria-pressed="true"]')?.dataset.filter || 'all';
    const n = tiles.filter((t) => !t.hidden).length;
    const [one, many] = NOUN[f] || [`${f} project`, `${f} projects`];
    count.textContent = f === 'all' ? `Showing all ${n} ${many}.` : `Showing ${n} ${n === 1 ? one : many}.`;
  };

  // the tiles that leave: note where everything stood just before the filter runs (capture phase), then fade a copy
  // of each leaving tile out on that spot. The wall eases to its new height rather than snapping the page up.
  let before = null, h0 = 0;
  group?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-filter]') || !moving || !gsap) return;
    gsap.killTweensOf(grid);
    grid.style.minHeight = '';
    h0 = grid.offsetHeight;
    before = tiles.filter((t) => !t.hidden).map((t) => [t, t.getBoundingClientRect()]);
  }, true);
  wall?.addEventListener('filter:change', () => {
    if (count) say();
    if (!before) return;
    const box = grid.getBoundingClientRect();
    for (const [t, r] of before) if (t.hidden) ghost(t, r, box);
    before = null;
    const h1 = grid.offsetHeight;
    if (h1 < h0) {
      grid.style.minHeight = `${h0}px`;
      gsap.to(grid, { minHeight: h1, duration: 0.8, delay: 0.2, ease: 'expo.inOut', onComplete: () => { grid.style.minHeight = ''; } });
    }
  });
  const ghost = (tile, r, box) => {
    const g = tile.cloneNode(true);
    g.hidden = false;
    g.removeAttribute('data-tags');
    g.removeAttribute('style');
    g.classList.add('work-ghost');
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    for (const n of g.querySelectorAll('[id]')) n.removeAttribute('id');
    Object.assign(g.style, { left: `${r.left - box.left + grid.scrollLeft}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    grid.append(g);
    gsap.to(g, { opacity: 0, scale: 0.94, duration: 0.42, ease: 'power2.out', onComplete: () => g.remove() });
  };
  if (count) say();

  // the poster leans toward the pointer (6 px at most)
  if (fine && moving) {
    for (const card of $$('.work-card', grid)) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        card.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--px', 0); card.style.setProperty('--py', 0); });
    }
  }

  // keyboard focus brings what it lands on fully into view. The browser leaves a tile alone while any of it shows, so
  // at the foot of the screen, or one swipe along the phone's strip, the focused tile (or chip) was half hidden.
  section.addEventListener('focusin', (e) => {
    const el = e.target.closest('.work-tile, .work-chip');
    if (!el || !e.target.matches(':focus-visible')) return;
    const r = el.getBoundingClientRect();
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72) + 8;
    const scroller = el.closest('.work-grid, .work-chips');
    const box = scroller && scroller.scrollWidth > scroller.clientWidth + 1 ? scroller.getBoundingClientRect() : { left: 0, right: innerWidth };
    if (r.top >= top && r.bottom <= innerHeight && r.left >= box.left - 1 && r.right <= box.right + 1) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: moving ? 'smooth' : 'auto' });
  });

  // the live chip pulses only while it can be seen
  const live = $('.work-live', section);
  if (live && moving) whenVisible(live, (on) => live.classList.toggle('is-on', on), '0px');
}
