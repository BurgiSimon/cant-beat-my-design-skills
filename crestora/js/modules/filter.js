// Filtering a list by chips and/or a search field, with a live count and an empty state.
//
//   <div data-filter-scope>
//     <div data-filter-group>  <button data-filter="all" aria-pressed="true">All</button> <button data-filter="film">Film</button> … </div>
//     <input data-filter-search type="search">                       (optional; matches an item's text and data-tags)
//     <p data-filter-count data-filter-noun="integration" aria-live="polite"></p>
//     <ul data-filter-list> <li data-tags="film make">…</li> … </ul>
//     <p data-filter-empty hidden>Nothing matches.</p>
//   </div>
// Several groups combine (an item must match every group). Without a scope, the whole page is one scope.
import { gsap, calm, $$ } from '../core.js';

export default function init() {
  const scopes = $$('[data-filter-scope]');
  if (!scopes.length && document.querySelector('[data-filter-list]')) scopes.push(document.body);
  for (const scope of scopes) setup(scope);
}

function setup(scope) {
  const list = scope.querySelector('[data-filter-list]');
  if (!list) return;
  const items = [...list.children];
  const groups = $$('[data-filter-group]', scope);
  const search = scope.querySelector('[data-filter-search]');
  const count = scope.querySelector('[data-filter-count]');
  const empty = scope.querySelector('[data-filter-empty]');
  const noun = count?.dataset.filterNoun || 'item';
  const text = new Map(items.map((it) => [it, `${it.textContent} ${it.dataset.tags || ''}`.toLowerCase()]));

  const apply = (animate = true) => {
    const wanted = groups.map((g) => g.querySelector('[data-filter][aria-pressed="true"]')?.dataset.filter || 'all');
    const q = (search?.value || '').trim().toLowerCase();
    const before = animate && gsap && !calm ? new Map(items.map((it) => [it, it.getBoundingClientRect()])) : null;
    let shown = 0;
    for (const it of items) {
      const tags = (it.dataset.tags || '').split(/\s+/);
      const ok = wanted.every((w) => w === 'all' || tags.includes(w)) && (!q || q.split(/\s+/).every((w) => text.get(it).includes(w)));
      it.hidden = !ok;
      if (ok) shown++;
    }
    if (count) count.textContent = `${shown} ${noun}${shown === 1 ? '' : 's'}`;
    if (empty) empty.hidden = shown > 0;
    // FLIP: the items that stay glide to their new places, the ones that arrive fade up
    if (before) {
      for (const it of items) {
        if (it.hidden) continue;
        const a = before.get(it), b = it.getBoundingClientRect();
        if (a.width === 0) gsap.fromTo(it, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' });
        else if (a.left !== b.left || a.top !== b.top) gsap.fromTo(it, { x: a.left - b.left, y: a.top - b.top }, { x: 0, y: 0, duration: 0.6, ease: 'expo.out', clearProps: 'transform' });
      }
    }
    scope.dispatchEvent(new CustomEvent('filter:change', { detail: { shown, query: q, wanted } }));
  };

  for (const g of groups) {
    g.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      for (const x of g.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
      apply();
    });
  }
  search?.addEventListener('input', () => apply(false));
  scope.filterApply = apply;
  apply(false);
}
