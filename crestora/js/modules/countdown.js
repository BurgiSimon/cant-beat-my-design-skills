// [data-countdown="2026-12-04T17:00:00Z"] counts down: its [data-unit="d|h|m|s"] children roll like odometers.
// When the moment passes, the element gets .is-live (show a "Live now" state with CSS). It ticks on the second while it
// is on screen; under reduced motion the digits change in place without rolling (the clock stays true either way).
import { odometer, whenVisible, $$ } from '../core.js';

export default function init() {
  for (const el of $$('[data-countdown]')) {
    const at = Date.parse(el.dataset.countdown);
    if (Number.isNaN(at)) continue;
    const units = Object.fromEntries($$('[data-unit]', el).map((u) => [u.dataset.unit, u]));
    let timer = 0;
    const tick = () => {
      const s = Math.max(0, Math.floor((at - Date.now()) / 1000));
      el.classList.toggle('is-live', s === 0);
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      for (const [k, u] of Object.entries(units)) if (k in v) odometer(u, v[k], { prefix: v[k] < 10 && k !== 'd' ? '0' : '' });
      return s;
    };
    // the next tick lands just after the clock's next whole second, so a minute turns over when it should
    const run = () => { if (tick() > 0) timer = setTimeout(run, 1000 - (Date.now() % 1000) + 20); };
    tick();
    whenVisible(el, (on) => { clearTimeout(timer); if (on) run(); });
  }
}
