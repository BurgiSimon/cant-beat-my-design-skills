// community.html: every Circle and Launch Night time in the visitor's own time zone (through Intl), with the city's
// own time kept beside it; the "Start a Circle", "Remind me" and "Get paired" links tick the matching box in the join
// form on their way down; and the Night Bloom poster draws itself once when it comes into view. The countdown, the
// calendar files and the form are the generic countdown, ics and forms modules.
import { $, $$, whenVisible, ScrollTrigger } from '../core.js';

const ZONE = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();

// the zone's short name in the visitor's own English ("EST" in the US, "CET" in Europe), the rest in en-GB order
const NAMES = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en-GB';
function parts(date, timeZone, opts = {}) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...opts, timeZone });
    const out = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
    const z = new Intl.DateTimeFormat(NAMES, { timeZone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName');
    out.timeZoneName = z ? z.value : timeZone;
    return out;
  } catch { return null; }
}
const place = (zone) => zone.split('/').pop().replace(/_/g, ' ');

export default function init({ calm, still }) {
  // ---- times, in the visitor's zone ----
  const now = parts(new Date(), ZONE);
  const note = $('[data-zone-note]');
  if (note && now) {
    const name = place(ZONE) === now.timeZoneName ? now.timeZoneName : `${place(ZONE)} (${now.timeZoneName})`;
    note.innerHTML = `Times are in your time zone, <strong>${name}</strong>, with each city’s own time beside it.`;
  }

  for (const when of $$('[data-when]')) {
    const row = when.closest('.cm-meet');
    const t = $('time', when);
    const start = new Date(t.getAttribute('datetime'));
    const endIso = $('[data-ics]', row)?.dataset.end;
    const end = endIso ? new Date(endIso) : null;
    const you = parts(start, ZONE);
    const there = parts(start, when.dataset.tz);
    const thereEnd = end ? parts(end, when.dataset.tz) : null;
    if (!you || !there) continue;
    const same = you.hour === there.hour && you.minute === there.minute && you.day === there.day;
    // the date tile follows the visitor's calendar
    const set = (k, v) => { const el = $(`[data-part="${k}"]`, row); if (el) el.textContent = v; };
    set('day', you.day); set('month', you.month); set('weekday', you.weekday);
    t.textContent = `${you.hour}:${you.minute}`;
    $('.cm-meet__zone', when).textContent = `your time · ${you.timeZoneName}`;
    const span = thereEnd ? `${there.hour}:${there.minute}–${thereEnd.hour}:${thereEnd.minute}` : `${there.hour}:${there.minute}`;
    $('.cm-meet__there', when).textContent = same
      ? `${there.weekday} ${there.day} ${there.month}, ${span}, the same in ${when.dataset.city}`
      : `${there.weekday} ${there.day} ${there.month}, ${span} in ${when.dataset.city}`;
  }

  const night = $('[data-night-time]');
  if (night) {
    const p = parts(new Date(night.getAttribute('datetime')), ZONE, { weekday: 'long', month: 'long' });
    if (p) night.textContent = `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} your time (${p.timeZoneName})`;
  }

  // ---- links that sign you up for something tick its box in the join form ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-interest]');
    if (!a) return;
    const box = document.getElementById(`cm-i-${a.dataset.interest}`);
    if (box) box.checked = true;
  });

  // ---- counters near the fold: their triggers were measured while the hero was still rising into place, so a number
  // sitting low on a short screen (the third stat at 1024 × 768) never rolled. Measure again once the reveals have
  // settled; anything already on screen then rolls up as it should ----
  if (!calm && ScrollTrigger) {
    const settle = () => setTimeout(() => ScrollTrigger.refresh(), 1600);
    if (document.readyState === 'complete') settle(); else addEventListener('load', settle, { once: true });
  }

  // ---- the Night Bloom poster draws once, when seen ----
  const art = $('.cm-art');
  if (art && !calm && !still) {
    art.classList.add('is-armed');
    const stop = whenVisible(art, (on) => {
      if (!on) return;
      requestAnimationFrame(() => art.classList.add('is-bloom'));
      stop();
    }, '0px 0px -20% 0px');
  }
}
