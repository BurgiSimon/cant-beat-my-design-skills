// [data-ics] buttons download a calendar file: data-title, data-start / data-end (ISO, UTC), data-location,
// data-description.
import { toast, $$ } from '../core.js';

const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s = '') => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export default function init() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ics]');
    if (!b) return;
    const d = b.dataset;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Crestora//Demo//EN', 'BEGIN:VEVENT',
      `UID:${stamp(d.start)}-${(d.title || 'event').toLowerCase().replace(/\W+/g, '-')}@crestora.example`,
      `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(d.start)}`, `DTEND:${stamp(d.end || d.start)}`,
      `SUMMARY:${esc(d.title)}`, `LOCATION:${esc(d.location || 'Online')}`, `DESCRIPTION:${esc(d.description || 'Crestora (a fictional company) demo event.')}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `${(d.title || 'crestora-event').toLowerCase().replace(/\W+/g, '-')}.ics`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Calendar file downloaded', 'Added');
  });
  void $$;
}
