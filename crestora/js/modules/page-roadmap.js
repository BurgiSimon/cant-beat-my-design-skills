// roadmap.html: votes, sorting, a stage filter and, on phones, the swipeable columns.
//   - each upvote is a toggle (aria-pressed); its count rolls one digit with core's odometer, the board's total in
//     the hero follows, and the visitor's votes are remembered with store ('roadmap-votes': a list of card ids);
//   - Most votes / Newest re-orders the cards inside each column (a short FLIP glide);
//   - stage chips show only the cards that touch that stage, with a count per column, an empty note where a column
//     has none, and an aria-live line for the whole board;
//   - under 900 px the columns scroll sideways with snap; the column buttons jump to a column and follow the swipe.
// Without scripts every card shows and nothing is pressed; under reduced motion nothing glides or rolls.
import { $, $$, gsap, odometer, store, whenVisible } from '../core.js';
import { placeThumb } from './tabs.js';
import { keepFocusInStrips } from './page-strips.js';

const KEY = 'roadmap-votes';
const fmt = (n) => n.toLocaleString('en-US');
const STAGE_NAMES = { spark: 'Spark', shape: 'Shape', make: 'Make', review: 'Review', launch: 'Launch', afterglow: 'Afterglow' };

export default function init({ calm }) {
  const board = $('[data-rm-board]');
  keepFocusInStrips($('.rm-stages'));
  if (!board) return;
  const items = $$('.rm-item', board);
  const cols = $$('.rm-col', board);
  const countEl = $('[data-rm-count]');
  const totalEl = $('[data-rm-total]');
  const voted = new Set((store.get(KEY, []) || []).filter((id) => items.some((it) => it.dataset.id === id)));
  const votes = (it) => Number(it.dataset.votes) + (voted.has(it.dataset.id) ? 1 : 0);
  const total = () => items.reduce((n, it) => n + votes(it), 0);

  // set an odometer at a value without rolling (for the first paint)
  const settle = (el, value) => {
    odometer(el, value);
    const cols = $$('.odo__d > span', el);
    for (const c of cols) c.style.transition = 'none';
    el.getBoundingClientRect();
    for (const c of cols) c.style.transition = '';
  };

  // ---- votes ----
  for (const it of items) {
    const btn = $('[data-vote]', it);
    const n = $('[data-vote-n]', it);
    if (!btn || !n) continue;
    btn.disabled = false;   // a real control only once scripts can count the vote
    btn.setAttribute('aria-pressed', String(voted.has(it.dataset.id)));
    settle(n, votes(it));
    btn.addEventListener('click', () => {
      const id = it.dataset.id;
      if (voted.has(id)) voted.delete(id); else voted.add(id);
      store.set(KEY, [...voted]);
      const on = voted.has(id);
      btn.setAttribute('aria-pressed', String(on));
      odometer(n, votes(it));
      if (totalEl) odometer(totalEl, total());
      if (on && !calm) { btn.classList.remove('is-bump'); void btn.offsetWidth; btn.classList.add('is-bump'); }
    });
  }

  // the board's total in the hero rolls up once when it is first seen
  if (totalEl) {
    if (calm || !gsap) settle(totalEl, total());
    else {
      odometer(totalEl, total(), { hold: true });
      const stop = whenVisible(totalEl, (v) => { if (v) { setTimeout(() => odometer(totalEl, total()), 350); stop(); } }, '0px');
    }
  }

  // ---- sorting ----
  const sortGroup = $('.rm-sort');
  const sortBtns = sortGroup ? $$('[data-sort]', sortGroup) : [];
  const sort = (by, animate = true) => {
    const before = animate && gsap && !calm ? new Map(items.filter((it) => !it.hidden).map((it) => [it, it.getBoundingClientRect()])) : null;
    for (const list of $$('[data-rm-list]', board)) {
      const kids = [...list.children];
      kids.sort((a, b) => (by === 'newest' ? b.dataset.added.localeCompare(a.dataset.added) : votes(b) - votes(a)));
      list.append(...kids);
    }
    if (before) {
      for (const [it, a] of before) {
        const b = it.getBoundingClientRect();
        if (Math.abs(a.top - b.top) > 1) gsap.fromTo(it, { y: a.top - b.top }, { y: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' });
      }
    }
  };
  for (const b of sortBtns) {
    b.addEventListener('click', () => {
      for (const x of sortBtns) x.setAttribute('aria-pressed', String(x === b));
      placeThumb(sortGroup);
      sort(b.dataset.sort);
    });
  }

  // ---- the stage filter ----
  const stageBtns = $$('[data-filter-stage]');
  const filter = (stage, animate = true) => {
    let shown = 0;
    for (const it of items) {
      const ok = stage === 'all' || it.dataset.stages.split(/\s+/).includes(stage);
      if (it.hidden === ok) {
        it.hidden = !ok;
        if (ok && animate && gsap && !calm) gsap.fromTo(it, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' });
      }
      if (ok) shown++;
    }
    for (const col of cols) {
      const n = $$('.rm-item', col).filter((it) => !it.hidden).length;
      for (const el of $$(`[data-col-n="${col.id}"]`)) el.textContent = String(n);
      const empty = $('.rm-col__empty', col);
      if (empty) empty.hidden = n > 0;
    }
    if (countEl) {
      countEl.textContent = stage === 'all'
        ? `${shown} ideas on the board`
        : `${shown} ${shown === 1 ? 'idea touches' : 'ideas touch'} ${STAGE_NAMES[stage]}`;
    }
  };
  for (const b of stageBtns) {
    b.addEventListener('click', () => {
      for (const x of stageBtns) x.setAttribute('aria-pressed', String(x === b));
      filter(b.dataset.filterStage);
    });
  }

  // ---- phones: the columns swipe, the buttons jump and follow ----
  const jump = $('.rm-jump');
  const jumpBtns = jump ? $$('[data-jump]', jump) : [];
  const setCurrent = (id) => {
    for (const b of jumpBtns) {
      if (b.dataset.jump === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
    if (jump) {
      // the thumb follows the current column (placeThumb looks for a selected or pressed button)
      const on = jumpBtns.find((b) => b.dataset.jump === id);
      const thumb = $('.segmented__thumb', jump);
      if (on && thumb) { thumb.style.width = `${on.offsetWidth}px`; thumb.style.transform = `translateX(${on.offsetLeft}px)`; }
    }
  };
  for (const b of jumpBtns) {
    b.addEventListener('click', () => {
      const col = document.getElementById(b.dataset.jump);
      if (!col) return;
      const pad = parseFloat(getComputedStyle(board).paddingLeft) || 0;
      board.scrollTo({ left: col.offsetLeft - board.offsetLeft - pad, behavior: calm ? 'auto' : 'smooth' });
      setCurrent(col.id);
    });
  }
  if ('IntersectionObserver' in window && jumpBtns.length) {
    const ratios = new Map();
    const io = new IntersectionObserver((entries) => {
      if (getComputedStyle(board).display !== 'flex') return;
      for (const e of entries) ratios.set(e.target.id, e.intersectionRatio);
      const best = [...ratios].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0) setCurrent(best[0]);
    }, { root: board, threshold: [0.25, 0.5, 0.75, 1] });
    cols.forEach((c) => io.observe(c));
  }

  // ---- first paint ----
  sort('votes', false);
  filter('all', false);
  const thumbs = () => { if (sortGroup) placeThumb(sortGroup); setCurrent(jumpBtns.find((b) => b.getAttribute('aria-current') === 'true')?.dataset.jump || 'rm-now'); };
  thumbs();
  document.fonts?.ready.then(thumbs);
  addEventListener('resize', thumbs, { passive: true });
}
