// [role=tablist] with [role=tab][aria-controls] tabs: click, arrow keys, Home/End. Panels are hidden/unhidden.
// data-tabs-store="key" remembers the choice; data-tabs-sync="name" keeps every tablist with that name in step (the
// API page's language tabs). Inside a .segmented, its thumb slides to the chosen tab.
import { store, $$ } from '../core.js';

export function placeThumb(seg) {
  const thumb = seg.querySelector('.segmented__thumb');
  const on = seg.querySelector('[aria-selected="true"], [aria-pressed="true"]');
  if (!thumb || !on) return;
  thumb.style.width = `${on.offsetWidth}px`;
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
}

function select(list, tab, { focus = false, sync = true } = {}) {
  const tabs = $$('[role="tab"]', list);
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    if (panel) panel.hidden = !on;
  }
  if (focus) tab.focus();
  const seg = list.closest('.segmented') || (list.classList.contains('segmented') ? list : null);
  if (seg) placeThumb(seg);
  if (list.dataset.tabsStore) store.set(list.dataset.tabsStore, tab.dataset.value || tab.textContent.trim());
  list.dispatchEvent(new CustomEvent('tabs:change', { detail: { tab, value: tab.dataset.value || tab.textContent.trim() }, bubbles: true }));
  if (sync && list.dataset.tabsSync) {
    const v = tab.dataset.value || tab.textContent.trim();
    for (const other of $$(`[role="tablist"][data-tabs-sync="${list.dataset.tabsSync}"]`)) {
      if (other === list) continue;
      const match = $$('[role="tab"]', other).find((t) => (t.dataset.value || t.textContent.trim()) === v);
      if (match) select(other, match, { sync: false });
    }
  }
}

export default function init() {
  for (const list of $$('[role="tablist"]')) {
    const tabs = $$('[role="tab"]', list);
    if (!tabs.length) continue;
    const saved = list.dataset.tabsStore ? store.get(list.dataset.tabsStore) : null;
    const hashed = tabs.find((t) => location.hash && t.getAttribute('aria-controls') === location.hash.slice(1));
    const first = hashed || tabs.find((t) => saved && (t.dataset.value || t.textContent.trim()) === saved) || tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    select(list, first, { sync: false });
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(list, t); });
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const horizontal = list.getAttribute('aria-orientation') !== 'vertical';
      const next = { [horizontal ? 'ArrowRight' : 'ArrowDown']: i + 1, [horizontal ? 'ArrowLeft' : 'ArrowUp']: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(list, tabs[(next + tabs.length) % tabs.length], { focus: true });
    });
  }
  addEventListener('resize', () => { for (const s of $$('.segmented')) placeThumb(s); });
  document.fonts?.ready.then(() => { for (const s of $$('.segmented')) placeThumb(s); });
}
