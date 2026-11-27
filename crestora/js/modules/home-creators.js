// Home #creators: the expanding row. One card is open at a time (Amara's to begin with); pointing at, focusing or
// tapping another opens it, and it stays open when the pointer leaves. Opening a card fills its stage rail up to where
// the project is now, and (with motion allowed) its poster comes alive while the row is on screen. The layout itself
// is CSS: the row is an accordion from 1100 px up and stacks, fully open, below that and without scripts.
import { $, $$, whenVisible } from '../core.js';

export default function init({ calm, still }) {
  const row = $('#creators .cr-row');
  if (!row) return;
  const cards = $$('.cr-card', row);
  const wide = matchMedia('(min-width: 1100px)');
  const alive = !calm && !still;
  let current = Math.max(0, cards.findIndex((c) => c.classList.contains('is-open')));

  const fillRail = (card) => {
    const rail = $('.stage-rail', card);
    if (!rail || !alive) return;
    rail.dataset.n = '0';
    rail.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => { rail.dataset.n = rail.dataset.to; }));
  };

  const open = (i, { force = false } = {}) => {
    if (i === current && !force) return;
    current = i;
    row.dataset.open = String(i);
    cards.forEach((c, k) => c.classList.toggle('is-open', k === i));
    if (wide.matches) fillRail(cards[i]);
  };

  cards.forEach((card, i) => {
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && wide.matches) open(i); });
    card.addEventListener('focusin', () => open(i));
    card.addEventListener('click', () => open(i));
  });

  if (alive) row.classList.add('is-live');
  // the poster plays only while the row is on screen (and replays when you come back to it)
  let seen = false;
  whenVisible(row, (on) => {
    row.classList.toggle('is-inview', on);
    if (on && !seen) { seen = true; if (wide.matches) fillRail(cards[current]); }
  }, '0px');
}
