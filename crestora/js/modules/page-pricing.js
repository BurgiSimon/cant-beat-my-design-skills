// pricing.html: what the generic billing module doesn't do.
//  - Crew's seat slider (2–50) adds up the crew's monthly total for the current billing period, in rolling digits.
//  - Screen-reader prices ([data-say-monthly]/[data-say-yearly]) follow the period the switch is on.
//  - The comparison table's lens: a hairline column that glides to the plan under the pointer or focus, and back to
//    Studio when it leaves.
//  - Deep links (#grants, #compare) land where they point with smooth scrolling on.
import { odometer, store, scrollToTarget, lenis, $, $$ } from '../core.js';

const SEAT = { monthly: 20, yearly: 16 };
const money = (n) => `$${n.toLocaleString('en-US')}`;

export default function init({ calm }) {
  const page = $('[data-page="pricing"]') || document.body;
  let period = store.get('billing', 'yearly') === 'monthly' ? 'monthly' : 'yearly';

  // ---- spoken prices follow the switch ----
  const say = () => { for (const el of $$('[data-say-monthly]', page)) el.textContent = el.dataset[period === 'yearly' ? 'sayYearly' : 'sayMonthly']; };

  // ---- the seat slider ----
  const range = $('#pr-seats');
  const out = $('#pr-seats-n');
  const sum = $('[data-seats-total]');
  const year = $('[data-seats-year]');
  const spoken = $('[data-seats-say]');
  let first = true;
  const seats = () => {
    if (!range) return;
    const n = Math.round(Number(range.value) || 5);
    const per = SEAT[period];
    const total = n * per;
    out.value = String(n);
    out.textContent = String(n);
    range.setAttribute('aria-valuetext', `${n} seats, ${money(total)} a month`);
    range.style.setProperty('--fill', `${((n - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100}%`);
    if (sum) {
      if (first) { odometer(sum, total, { hold: !calm }); if (!calm) requestAnimationFrame(() => odometer(sum, total)); first = false; }
      else odometer(sum, total);
    }
    const line = period === 'yearly' ? `Billed yearly as ${money(total * 12)}` : 'Billed monthly, per seat.';
    if (year) year.textContent = line;
    if (spoken) spoken.textContent = `${n} seats: ${money(total)} a month, ${period === 'yearly' ? `billed yearly as ${money(total * 12)}` : 'billed monthly'}.`;
  };
  // the slider says the seats and the sum itself (aria-valuetext), so nothing else needs to speak while it moves
  range?.addEventListener('input', seats);

  document.addEventListener('billing:change', (e) => {
    period = e.detail === 'monthly' ? 'monthly' : 'yearly';
    say();
    seats();
  });
  say();
  seats();

  // ---- the comparison table's lens ----
  lens();

  // ---- deep links ----
  landAgain();
}

function lens() {
  const wrap = $('.pr-table-wrap');
  const table = $('.pr-table', wrap || document);
  const glass = $('.pr-lens', wrap || document);
  if (!wrap || !table || !glass) return;
  const heads = $$('thead th', table);                  // the four plan columns, 1–4
  const REST = 2;                                       // Studio, where most creators ride
  let col = REST;
  const place = (c, instant = false) => {
    if (!wrap.offsetWidth) return;                     // the table is hidden on phones
    col = c;
    const th = heads[c - 1];
    if (!th) return;
    const x = th.offsetLeft, w = th.offsetWidth;
    if (instant) glass.style.transition = 'none';
    glass.style.transform = `translateX(${x}px)`;
    glass.style.width = `${w}px`;
    glass.style.height = `${table.offsetHeight}px`;
    glass.classList.add('is-on');
    table.dataset.col = String(c);
    if (instant) requestAnimationFrame(() => { glass.style.transition = ''; });
  };
  const colOf = (node) => {
    const cell = node?.closest?.('td, th');
    if (!cell || !table.contains(cell)) return 0;
    if (cell.colSpan > 1) return 0;                    // a group's heading row spans them all
    return cell.cellIndex;                             // 0 is the feature column
  };
  table.addEventListener('pointermove', (e) => { const c = colOf(e.target); if (c > 0 && c !== col) place(c); });
  table.addEventListener('pointerleave', () => { if (!table.contains(document.activeElement)) place(REST); });
  table.addEventListener('focusin', (e) => { const c = colOf(e.target); if (c > 0) place(c); });
  table.addEventListener('focusout', (e) => { if (!table.contains(e.relatedTarget)) place(REST); });
  place(REST, true);
  addEventListener('resize', () => place(col, true));
  document.fonts?.ready.then(() => place(col, true));
  addEventListener('load', () => place(col, true));
}

// With smooth scrolling on, the browser jumps to the #id before Lenis starts, so the shared landing scroll (core.js,
// on load) measures from a stale position and stops short. Once it has run, land again from where we are.
function landAgain() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  const land = () => setTimeout(() => { if (lenis) scrollToTarget(target, { immediate: true }); }, 140);
  if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
}
