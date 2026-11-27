// careers.html: the location select drives a hidden [data-filter-group] (so the generic filter combines hub and team,
// keeps the live count and the empty line), a #role-slug link opens that role, and the hiring lanes light one by one
// as they come into view (at rest, all lit, under reduced motion or without scripts).
import { ScrollTrigger, $, $$ } from '../core.js';

export default function init({ calm }) {
  const page = $('[data-page="careers"]');
  if (!page) return;

  // location → the hidden group's buttons (the filter listens for their clicks)
  const select = $('#cr-loc', page);
  const group = $('.cr-locgroup', page);
  const pick = () => group?.querySelector(`[data-filter="${select.value}"]`)?.click();
  if (select && group) {
    select.addEventListener('change', pick);
    if (select.value !== 'all') pick();   // a value the browser restored on the way back
  }

  // filtering and opening a role move everything below: the reveals further down need to know where they are now
  let t = 0;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger?.refresh(), 120); };
  $('[data-filter-scope]', page)?.addEventListener('filter:change', refresh);
  for (const d of $$('.cr-role', page)) d.addEventListener('toggle', refresh);

  // a deep link to a role opens it
  const openFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const li = id ? document.getElementById(id) : null;
    const d = li?.closest('.cr-roles > li')?.querySelector('details');
    if (d) d.open = true;
  };
  openFromHash();
  addEventListener('hashchange', openFromHash);

  // the process lanes light in order as each one reaches the lower third of the screen
  const lanes = $$('.cr-lane', page);
  const list = $('.cr-lanes', page);
  if (calm || !list || !('IntersectionObserver' in window)) return;
  list.classList.add('cr-lanes--wait');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-lit');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -22% 0px' });
  for (const l of lanes) io.observe(l);
}
