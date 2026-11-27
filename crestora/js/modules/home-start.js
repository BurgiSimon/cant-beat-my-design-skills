// Home #plans and #start.
//
// #plans: the generic billing module rolls the prices; this keeps their spoken text in step with the period.
// #start: the finale. The Lane 001 card beside the form fills in as you type (the title from "What are you making?",
// your initials once an email is typed), the field's placeholder cycles through ideas while it is on screen, and when
// the generic forms module reports "form:success" the card's stage rail runs from Spark to Afterglow, the card opens
// in the spectrum ring, the footer launches (crestora:launch: it glides into view and plays) and the toast says so.
// Reduced motion: the rail is simply full and the toast shows; nothing scrolls, nothing launches.
//
// The Lane card's helpers are exported for start.html (js/modules/page-start.js).
import { $, $$, toast, whenVisible, store } from '../core.js';

export const STAGES = [['spark', 'Spark', 'Sparkboard'], ['shape', 'Shape', 'Blueprints'], ['make', 'Make', 'Workbench'], ['review', 'Review', 'Review Room'], ['launch', 'Launch', 'Countdown'], ['afterglow', 'Afterglow', 'Afterglow']];
export const OPEN_TOAST = 'Your lane is open. Check your inbox. (Demo: nothing was sent.)';
const DEFAULT_TITLE = 'Your next thing';

export const laneNo = (n) => `Lane ${String(n).padStart(3, '0')}`;

/** "a short film about my gran…" → "A short film about my gran" */
export function titleOf(text = '') {
  const t = String(text).replace(/\s+/g, ' ').trim().replace(/[\s.…]+$/, '');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

const words = (s) => s.split(/[\s._\-+]+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
/** initials from a name, or else from an email's local part ("mira.castell@…" → "MC", "jonah@…" → "J") */
export function initialsOf(name = '', email = '') {
  const parts = words(name.trim() || String(email).split('@')[0] || '');
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
/** "mira.castell@…" → "Mira Castell" */
export function nameFromEmail(email = '') {
  return words(String(email).split('@')[0] || '').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** The Lane card: [data-lane-card] with [data-lane-no|chip|title|started|rail|avatar|name|mail] parts. */
export function laneCard(card, { calm = false } = {}) {
  const q = (k) => card.querySelector(`[data-lane-${k}]`);
  const el = { no: q('no'), chip: q('chip'), title: q('title'), started: q('started'), tool: q('tool'), rail: q('rail'), avatar: q('avatar'), name: q('name'), mail: q('mail') };
  const names = $$('.lane-card__names li', card);
  const rows = $$('[data-lane-row]', card);
  const titleBox = el.title?.closest('.lane-card__title');
  const blank = { name: el.name?.textContent || '', mail: el.mail?.textContent || '' };
  let number = 1, timers = [];

  if (el.started) el.started.textContent = `Started today, ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  function stage(n) {
    const [key, label, tool] = STAGES[Math.max(1, Math.min(6, n)) - 1];
    if (el.rail) el.rail.dataset.n = String(n);
    card.dataset.stage = key;
    if (el.chip && !card.classList.contains('is-open')) el.chip.textContent = `Now in: ${label}`;
    if (el.tool && !card.classList.contains('is-open')) el.tool.textContent = `${tool} is open`;
    names.forEach((li, i) => { li.classList.toggle('is-lit', i < n); li.classList.toggle('is-now', i === n - 1); });
    rows.forEach((row, i) => { row.classList.toggle('is-lit', i < n); row.classList.toggle('is-now', i === n - 1); });
  }

  const api = {
    get number() { return number; },
    get label() { return laneNo(number); },
    stage,
    title(text) {
      const t = titleOf(text);
      if (el.title) el.title.textContent = t || DEFAULT_TITLE;
      titleBox?.classList.toggle('is-default', !t);
    },
    person({ name = '', email = '' } = {}) {
      const n = String(name).trim(), m = String(email).trim();
      const ini = initialsOf(n, m);
      if (el.avatar) { el.avatar.textContent = ini; el.avatar.classList.toggle('is-set', !!ini); }
      if (el.name) { el.name.textContent = n || nameFromEmail(m) || blank.name; el.name.classList.toggle('is-empty', !n && !m); }
      if (el.mail) el.mail.textContent = m || blank.mail;
    },
    typing(on) { card.classList.toggle('is-typing', !!on && !calm && !card.classList.contains('is-open')); },
    /** run the rail from where it is to Afterglow (0.8 s); resolves when it is full */
    fill() {
      timers.forEach(clearTimeout);
      if (calm) { stage(6); return Promise.resolve(); }
      const from = Number(el.rail?.dataset.n || 1);
      return new Promise((done) => {
        timers = [];
        for (let n = from + 1; n <= 6; n++) timers.push(setTimeout(() => stage(n), (n - from - 1) * 160));
        timers.push(setTimeout(done, (6 - from) * 160 + 140));
      });
    },
    /** the lane is open: the spectrum ring, and the chip says so */
    open() {
      card.classList.add('is-open');
      card.classList.remove('is-typing');
      if (el.chip) el.chip.textContent = 'Lane open';
      if (el.tool) el.tool.textContent = 'The whole road is open';
    },
    /** the next lane: Lane 002, back at Spark */
    next() {
      timers.forEach(clearTimeout);
      number += 1;
      if (el.no) el.no.textContent = laneNo(number);
      card.classList.remove('is-open');
      stage(1);
    },
  };
  stage(1);
  api.title('');
  return api;
}

/** cycle an input's placeholder through its data-ideas ("a|b|c") while it is on screen and empty */
export function cyclePlaceholder(input, { calm = false } = {}) {
  const ideas = (input?.dataset.ideas || '').split('|').filter(Boolean);
  if (!input || calm || ideas.length < 2) return;
  let i = Math.max(0, ideas.indexOf(input.placeholder)), on = false, t = 0;
  const tick = () => {
    if (!on) return;
    if (!input.value) {
      input.classList.add('is-swapping');
      setTimeout(() => { i = (i + 1) % ideas.length; input.placeholder = ideas[i]; input.classList.remove('is-swapping'); }, 280);
    }
    t = setTimeout(tick, 2600);
  };
  whenVisible(input, (v) => { on = v; clearTimeout(t); if (v) t = setTimeout(tick, 2200); }, '0px');
}

function plans() {
  const say = $$('#plans [data-plan-say]');
  if (!say.length) return;
  const set = (period) => { for (const el of say) if (el.dataset[period]) el.textContent = el.dataset[period]; };
  set(store.get('billing', 'yearly'));
  document.addEventListener('billing:change', (e) => set(e.detail));
}

function start({ calm }) {
  const section = $('#start');
  const form = section && $('.home-start__form', section);
  const cardEl = section && $('[data-lane-card]', section);
  if (!form || !cardEl) return;
  const lane = laneCard(cardEl, { calm });
  const idea = form.elements.namedItem('idea');
  const email = form.elements.namedItem('email');
  const fine = $('.home-start__fine', form);
  const done = $('.home-start__done', form);
  let opened = false;

  const sync = () => {
    // typing again after a launch starts the next lane
    if (opened && (idea.value || email.value)) {
      opened = false; lane.next(); section.classList.remove('is-launched');
      if (done) done.hidden = true;
      if (fine) fine.hidden = false;
    }
    if (opened) return;
    lane.title(idea.value);
    lane.person({ email: email.value });
  };
  idea.addEventListener('input', sync);
  email.addEventListener('input', sync);
  idea.addEventListener('focus', () => lane.typing(true));
  idea.addEventListener('blur', () => lane.typing(false));
  sync();
  cyclePlaceholder(idea, { calm });

  form.addEventListener('form:success', async (e) => {
    const data = e.detail;
    lane.title(data.get('idea'));
    lane.person({ email: data.get('email') });
    lane.typing(false);
    opened = true;               // the form resets now; the card keeps the lane until you type the next one
    const key = lane.label;
    await lane.fill();
    lane.open();
    if (done) {
      done.querySelector('[data-done-lane]').textContent = key;
      done.querySelector('[data-done-next]').textContent = laneNo(lane.number + 1);
      done.hidden = false;
      if (fine) fine.hidden = true;
    }
    if (calm) { toast(OPEN_TOAST, key); return; }
    section.classList.add('is-launched');
    window.dispatchEvent(new CustomEvent('crestora:launch'));
    toast(OPEN_TOAST, key);
  });
}

export default function init({ calm }) {
  plans();
  start({ calm });
}
