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

// Keyboard: the switch is a group of toggle buttons, and it behaves as one: each period is a stop in the Tab order and
// Enter or Space chooses it. Left/Right (and Home/End) also move to the other period and choose it.
export default function init() {
  const switches = $$('[data-billing]');
  if (!switches.length) return;
  const set = (period, first = false) => {
    store.set('billing', period);
    for (const s of switches) {
      for (const b of $$('[data-period]', s)) {
        const on = b.dataset.period === period;
        b.setAttribute('aria-pressed', String(on));
      }
      placeThumb(s);
    }
    for (const el of $$('[data-price-monthly]')) {
      const v = parseFloat(period === 'yearly' ? el.dataset.priceYearly : el.dataset.priceMonthly);
      if (first) { odometer(el, v, { hold: true }); requestAnimationFrame(() => odometer(el, v)); } else odometer(el, v);
    }
    for (const el of $$('[data-billing-show]')) el.hidden = el.dataset.billingShow !== period;
    document.dispatchEvent(new CustomEvent('billing:change', { detail: period }));
  };
  for (const s of switches) {
    s.addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (b) set(b.dataset.period); });
    s.addEventListener('keydown', (e) => {
      const opts = $$('[data-period]', s);
      const i = opts.indexOf(document.activeElement);
      if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: opts.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const b = opts[(next + opts.length) % opts.length];
      if (b.getAttribute('aria-pressed') !== 'true') set(b.dataset.period);
      b.focus();
    });
  }
  // a stored value this switch doesn't offer (an old or hand-edited one) falls back to yearly, so one option is always
  // chosen
  const saved = store.get('billing', 'yearly');
  set($$('[data-period]').some((b) => b.dataset.period === saved) ? saved : 'yearly', true);
  addEventListener('resize', () => switches.forEach(placeThumb));
  document.fonts?.ready.then(() => switches.forEach(placeThumb));
}
