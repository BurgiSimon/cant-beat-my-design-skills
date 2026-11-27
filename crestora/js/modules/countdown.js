// [data-countdown="2026-12-10T17:00:00Z"] counts down: its [data-unit="d|h|m|s"] children roll like odometers.
// When the moment passes, the element gets .is-live (show a "Live now" state with CSS).
import { odometer, whenVisible, $$ } from '../core.js';

export default function init({ calm } = {}) {
  for (const el of $$('[data-countdown]')) {
    const at = Date.parse(el.dataset.countdown);
    const units = Object.fromEntries($$('[data-unit]', el).map((u) => [u.dataset.unit, u]));
    let timer = 0;
    const tick = () => {
      let s = Math.max(0, Math.floor((at - Date.now()) / 1000));
      el.classList.toggle('is-live', s === 0);
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      for (const [k, u] of Object.entries(units)) odometer(u, v[k], { prefix: v[k] < 10 && k !== 'd' ? '0' : '' });
    };
    tick();
    if (!calm) whenVisible(el, (on) => { clearInterval(timer); if (on) timer = setInterval(tick, 1000); });
  }
}
