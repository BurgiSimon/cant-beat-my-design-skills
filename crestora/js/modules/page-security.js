// security.html: the 90-day status bar. Each hairline is a day (fixed, fictional data in the markup: data-d, and on
// the three days with an incident data-stage, data-tool, data-min and data-note). With scripts the bar becomes a
// group of days you can hover, tap or reach with the keyboard (one tab stop; the arrow keys, Home and End move
// between days), and a tooltip shows the day. When the bar first comes into view its days rise in one quick sweep.
// Without scripts the bar is a picture with a summary, and the incidents are listed under it.
import { $, $$, gsap, whenVisible } from '../core.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

export default function init({ calm }) {
  const bar = $('[data-uptime]');
  if (!bar) return;
  const ticks = $$('i', bar);
  if (!ticks.length) return;
  const wrap = bar.closest('.sec-uptime');

  // what each day says, for its label and its tooltip
  const info = ticks.map((t, i) => {
    const date = day(t.dataset.d);
    const today = i === ticks.length - 1;
    if (t.dataset.tool) {
      return { title: `${date} · ${t.dataset.tool}`, line: `${t.dataset.note} Resolved in ${t.dataset.min} minutes.`, stage: getComputedStyle(t).getPropertyValue('--stage').trim() };
    }
    return { title: today ? `Today · ${date}` : date, line: today ? 'No incidents so far today.' : 'No incidents. Every tool up all day.', stage: '' };
  });

  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Daily status, last 90 days. Use the arrow keys to move between days.');
  ticks.forEach((t, i) => {
    t.setAttribute('role', 'img');
    t.setAttribute('aria-label', `${info[i].title}. ${info[i].line}`);
    t.tabIndex = i === ticks.length - 1 ? 0 : -1;
  });

  const tip = document.createElement('div');
  tip.className = 'sec-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.innerHTML = '<strong><i></i><b></b></strong><span></span>';
  wrap.append(tip);

  let current = -1;
  const show = (i) => {
    if (i < 0) { tip.classList.remove('is-on'); ticks[current]?.classList.remove('is-on'); current = -1; return; }
    ticks[current]?.classList.remove('is-on');
    current = i;
    const t = ticks[i];
    t.classList.add('is-on');
    $('b', tip).textContent = info[i].title;
    $('span', tip).textContent = info[i].line;
    const dot = $('strong i', tip);
    dot.style.display = info[i].stage ? '' : 'none';
    tip.style.setProperty('--stage', info[i].stage || '#fff');
    // above the day, kept inside the panel
    const w = wrap.getBoundingClientRect(), r = t.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const x = Math.min(Math.max(r.left + r.width / 2 - w.left - tw / 2, 0), w.width - tw);
    tip.style.left = `${x}px`;
    tip.classList.add('is-on');
  };

  bar.addEventListener('pointerover', (e) => { const i = ticks.indexOf(e.target); if (i >= 0) show(i); });
  bar.addEventListener('pointerleave', () => { if (!bar.contains(document.activeElement)) show(-1); });
  bar.addEventListener('focusin', (e) => { const i = ticks.indexOf(e.target); if (i >= 0) show(i); });
  bar.addEventListener('focusout', (e) => { if (!bar.contains(e.relatedTarget)) show(-1); });
  bar.addEventListener('keydown', (e) => {
    const i = ticks.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowUp: i + 1, ArrowDown: i - 1, Home: 0, End: ticks.length - 1, PageUp: i + 7, PageDown: i - 7 }[e.key];
    if (next === undefined) { if (e.key === 'Escape') show(-1); return; }
    e.preventDefault();
    const n = Math.min(Math.max(next, 0), ticks.length - 1);
    ticks[i].tabIndex = -1;
    ticks[n].tabIndex = 0;
    ticks[n].focus();
  });
  addEventListener('resize', () => { if (current >= 0) show(current); }, { passive: true });

  // the days rise once, left to right, when the bar is first seen
  if (calm || !gsap) return;
  const lines = ticks.map((t) => t);
  gsap.set(lines, { '--rise': 0 });
  bar.classList.add('is-rising');
  const stop = whenVisible(bar, (v) => {
    if (!v) return;
    stop();
    gsap.to(lines, { '--rise': 1, duration: 0.7, ease: 'expo.out', stagger: 0.008, onComplete: () => bar.classList.remove('is-rising') });
  }, '-10% 0px');
}
