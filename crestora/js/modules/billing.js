// The Monthly/Yearly switch, shared by the home teaser and the pricing page (remembered in localStorage):
//   <div class="segmented" data-billing role="group" aria-label="Billing period">
//     <span class="segmented__thumb"></span>
//     <button type="button" data-period="monthly" aria-pressed="false">Monthly</button>
//     <button type="button" data-period="yearly" aria-pressed="true">Yearly</button>
//   </div>
//   <span data-price-monthly="12" data-price-yearly="10">10</span>      rolls like an odometer
//   <span data-billing-show="yearly">billed yearly</span>               shown only in that period
import { odometer, store, $$ } from '../core.js';
import { placeThumb } from './tabs.js';

export default function init() {
  const switches = $$('[data-billing]');
  if (!switches.length) return;
  const set = (period, first = false) => {
    store.set('billing', period);
    for (const s of switches) {
      for (const b of $$('[data-period]', s)) b.setAttribute('aria-pressed', String(b.dataset.period === period));
      placeThumb(s);
    }
    for (const el of $$('[data-price-monthly]')) {
      const v = parseFloat(period === 'yearly' ? el.dataset.priceYearly : el.dataset.priceMonthly);
      if (first) { odometer(el, v, { hold: true }); requestAnimationFrame(() => odometer(el, v)); } else odometer(el, v);
    }
    for (const el of $$('[data-billing-show]')) el.hidden = el.dataset.billingShow !== period;
    document.dispatchEvent(new CustomEvent('billing:change', { detail: period }));
  };
  for (const s of switches) s.addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (b) set(b.dataset.period); });
  set(store.get('billing', 'yearly'), true);
  addEventListener('resize', () => switches.forEach(placeThumb));
  document.fonts?.ready.then(() => switches.forEach(placeThumb));
}
