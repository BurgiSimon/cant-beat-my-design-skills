// Run club: a countdown to the next session (London time), rows that fill with orange from the left as you pass with a
// photograph trailing the pointer, and a join that holds your place.
import { calm, fine, gsap, on, pointer, toast, loop, damp } from './core.js';

export function init() {
  const s = document.getElementById('club');
  if (!s) return;
  const rows = [...s.querySelectorAll('.club__row')];

  // ---- the next session, counted down ----
  const out = s.querySelector('[data-countdown]');
  const londonNow = () => {
    // the wall-clock time in London, as a Date whose UTC fields read like London's local ones
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second));
    } catch (e) { return new Date(); }
  };
  const sessions = rows.map((r) => ({ day: +r.dataset.day, h: +r.dataset.time.slice(0, 2), m: +r.dataset.time.slice(3, 5) }));
  const tick = () => {
    const now = londonNow();
    let best = Infinity;
    for (const x of sessions) {
      for (let add = 0; add <= 7; add++) {
        const d = new Date(now); d.setUTCDate(now.getUTCDate() + add); d.setUTCHours(x.h, x.m, 0, 0);
        if (d.getUTCDay() !== x.day || d <= now) continue;
        best = Math.min(best, d - now);
        break;
      }
    }
    if (!isFinite(best)) return;
    const sec = Math.floor(best / 1000);
    const dd = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    out.textContent = `${dd}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 1000);

  // ---- join ----
  s.addEventListener('click', (e) => {
    const b = e.target.closest('[data-join]');
    if (!b) return;
    const on_ = !b.classList.contains('is-joined');
    b.classList.toggle('is-joined', on_);
    b.querySelector('.roll') && b.querySelectorAll('.roll').forEach((r) => { r.textContent = on_ ? 'Joined' : 'Join'; });
    b.setAttribute('aria-pressed', String(on_));
    toast(on_ ? `You’re on the list for ${b.dataset.join}. Bring a light layer.` : `Taken off ${b.dataset.join}’s list.`);
  });
  for (const b of s.querySelectorAll('[data-join]')) b.setAttribute('aria-pressed', 'false');

  if (!fine || calm || !gsap) return;

  // ---- the photograph that trails the pointer ----
  const float = s.querySelector('.club__float');
  const imgs = [...float.querySelectorAll('img')];
  gsap.set(float, { xPercent: -50, yPercent: -50, scale: 0.6 });
  let active = null, x = pointer.x, y = pointer.y, rot = 0;
  const show = (row) => {
    active = row;
    float.classList.toggle('is-on', !!row);
    if (row) imgs.forEach((im) => im.classList.toggle('is-on', im.dataset.pic === row.dataset.pic));
    gsap.to(float, { scale: row ? 1 : 0.6, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
  };
  for (const r of rows) {
    r.addEventListener('pointerenter', () => show(r));
    r.addEventListener('pointerleave', () => show(null));
  }
  on('scroll', () => { if (active && !active.matches(':hover')) show(null); });
  loop(s, (dt) => {
    const vx = pointer.x - x;
    x = damp(x, pointer.x, 10, dt); y = damp(y, pointer.y, 10, dt);
    rot = damp(rot, Math.max(-12, Math.min(12, vx * 0.15)), 6, dt);
    float.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    float.style.rotate = `${rot.toFixed(2)}deg`;
  });
}
