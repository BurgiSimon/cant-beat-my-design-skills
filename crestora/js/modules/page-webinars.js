// webinars.html: every <time data-local> is rewritten into the visitor's own time zone (Intl); "Save a seat" ticks
// that session in the form below; the form needs at least one session (the last box turns required when none is
// ticked, so forms.js can say so); Play on a recording says plainly that this is a demo; and #rec-<id> opens that
// recording's dialog (a card puts its #rec-<id> in the address bar while its dialog is open, without the shared
// anchor glide scrolling to the closed dialog first). At rest the countdown drops its seconds and moves once a minute.
import { toast, odometer, $, $$ } from '../core.js';

function zone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export default function init({ calm }) {
  localTimes();
  seats();
  for (const b of $$('[data-wb-play]')) b.addEventListener('click', () => toast('Recordings aren’t hosted on this demo site.', 'Demo'));
  recordings();
  deepLink();
  if (calm) calmClock();
}

// a recording card is a link to its #rec-<id> (the details sit on the page without scripts); with scripts it opens the
// dialog, so the shared anchor glide must not scroll to the closed dialog or stack a history entry
function recordings() {
  const clean = () => history.replaceState(null, '', location.pathname + location.search);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-dialog-open^="rec-"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    history.replaceState(null, '', `#${a.dataset.dialogOpen}`);
  }, true);
  for (const d of $$('dialog.wb-dialog')) d.addEventListener('close', () => { if (location.hash === `#${d.id}`) clean(); });
}

// reduced motion: the shared countdown draws once and stops; keep days, hours and minutes true, once a minute
function calmClock() {
  for (const el of $$('[data-countdown]')) {
    const at = Date.parse(el.dataset.countdown);
    if (Number.isNaN(at)) continue;
    const draw = () => {
      const s = Math.max(0, Math.floor((at - Date.now()) / 1000));
      el.classList.toggle('is-live', s === 0);
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
      for (const [k, n] of Object.entries(v)) {
        const u = $(`[data-unit="${k}"]`, el);
        if (u) odometer(u, n, { prefix: n < 10 && k !== 'd' ? '0' : '' });
      }
    };
    draw();
    setInterval(draw, 30000);
  }
}

function localTimes() {
  const tz = zone();
  const utc = /^(Etc\/)?(UTC|GMT|Universal|Zulu)$/i.test(tz);
  const place = utc ? 'UTC' : (tz.split('/').pop() || tz).replace(/_/g, ' ');
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
  } catch { return; }
  const parts = (d) => Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));

  for (const t of $$('time[data-local]')) {
    const d = new Date(t.getAttribute('datetime'));
    if (Number.isNaN(d.getTime())) continue;
    const p = parts(d);
    const day = `${p.weekday} ${p.day} ${p.month}`;
    const clock = `${p.hour}:${p.minute}`;
    if (t.dataset.local === 'long') {
      t.textContent = utc ? `${day}, ${clock} (your clock is on UTC)` : `${day}, ${clock} in ${place} (${p.timeZoneName})`;
    } else if (t.classList.contains('wb-row__local')) {
      // the agenda already says it in UTC; only add the local time when it differs
      t.textContent = utc ? '' : `${day}, ${clock} in ${place}`;
    } else {
      t.textContent = `${day} · ${clock}`;
    }
  }
  const z = $('[data-wb-zone]');
  if (z) z.textContent = utc ? 'Times on this page are in UTC, which is your clock too.' : `Times are in UTC, and in your own time zone (${place}) beside them.`;
  for (const s of $$('[data-wb-zone-short]')) s.textContent = utc ? 'UTC' : `your time (${place})`;
}

function seats() {
  const form = $('.wb-form');
  if (!form) return;
  const boxes = $$('input[name="session"]', form);
  const err = $('.wb-sessions .field__error', form);
  const sync = () => {
    const any = boxes.some((b) => b.checked);
    // the last box carries the requirement: forms.js checks fields in order, so its message is the one that stays
    boxes.forEach((b, i) => { b.required = !any && i === boxes.length - 1; });
    if (any) {
      for (const b of boxes) b.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    }
  };
  for (const b of boxes) b.addEventListener('change', sync);
  form.addEventListener('reset', () => setTimeout(sync));
  sync();

  // "Save a seat" on a session ticks it in the form, then the form's first field takes the focus once it is there
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-wb-seat]');
    if (!a) return;
    const box = boxes.find((b) => b.value === a.dataset.wbSeat);
    if (box && !box.checked) { box.checked = true; sync(); }
    setTimeout(() => {
      const name = $('#wb-name', form);
      if (name && !form.contains(document.activeElement)) name.focus({ preventScroll: true });
    }, 1200);
  });
}

function deepLink() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!/^rec-[\w-]+$/.test(id)) return;
  const open = () => document.querySelector(`[data-dialog-open="${id}"]`)?.click();
  // after the dialog module has wired itself up
  if (document.readyState === 'complete') setTimeout(open, 300);
  else addEventListener('load', () => setTimeout(open, 300), { once: true });
}
