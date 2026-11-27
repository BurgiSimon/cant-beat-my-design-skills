// contact.html: the form follows its topic, and the four hubs keep their own time.
//   - the topic (radio pills) decides which fields exist: company and team size for Sales and Partnerships, role and
//     a link for Careers. Fields for other topics carry `hidden` (so they can't be focused or validated) and lose
//     `required`. The message's label, placeholder and hint, the send button and the "Goes to" card follow, and the
//     door the form is set to is outlined. ?topic= and ?role= preselect (a role slug that isn't an exact match is
//     matched by its words); picking a topic keeps ?topic= in the address so it can be shared.
//   - each hub shows its local time in Michroma digits (Intl, rolled with core's odometer once a minute), Open now or
//     Closed (Mon–Fri, 09:00–18:00 local), when that changes, and how far ahead or behind the visitor it is; a weekday
//     is drawn as four lanes in the visitor's own time with a line for now; the hero counts the hubs that are open.
// Without scripts every field shows (labelled with its topic) and the hubs show their hours; under reduced motion
// the digits are set, not rolled.
import { $, $$, gsap, odometer, whenVisible } from '../core.js';

const TOPICS = {
  '': { team: 'Whoever is awake', short: '', mail: 'hello@crestora.example', time: 'Within a working day', where: 'Read in all four hubs',
    ask: 'Message', placeholder: 'A few lines are plenty. Tell us what you’re making and where you’re stuck.', hint: 'The more specific, the faster the right person can help.' },
  sales: { team: 'Sales', short: 'Sales', mail: 'sales@crestora.example', time: 'Within 4 working hours', where: 'Read in Lisbon and Toronto',
    ask: 'Tell us about your team', placeholder: 'We’re a 12-person animation studio moving three productions off shared drives. We’d like SSO and EU hosting.', hint: 'What you make, how you work today, and anything you must have (SSO, residency, invoices).' },
  support: { team: 'Support', short: 'Support', mail: 'support@crestora.example', time: 'Under 2 hours on weekdays', where: 'Read in all four hubs',
    ask: 'What’s going on?', placeholder: 'Since this morning my lane “Night Bloom” won’t move from Review to Launch. The button spins and nothing happens.', hint: 'The lane’s name, what you expected and what happened instead. Screenshots can follow by email.' },
  press: { team: 'Press', short: 'Press', mail: 'press@crestora.example', time: 'The same working day', where: 'Read in Lisbon, Toronto and Seoul',
    ask: 'What are you working on?', placeholder: 'I’m writing about small studios and launch-day tools for Frame & Pixel, due Thursday. Could I speak to Mira?', hint: 'Your outlet, your deadline and who you’d like to talk to. The press kit has logos and facts.' },
  partners: { team: 'Partnerships', short: 'Partnerships', mail: 'partners@crestora.example', time: 'Within 2 working days', where: 'Read in Toronto and Nairobi',
    ask: 'What would you build, run or teach?', placeholder: 'We’re a post house in Porto and set up review workflows for about ten film clients a year.', hint: 'Integration, studio or education partner? A link to your work helps.' },
  careers: { team: 'Careers', short: 'Careers', mail: 'careers@crestora.example', time: 'Within 10 days, always', where: 'Read by the hiring crew',
    ask: 'Anything you’d like us to know?', placeholder: 'I’ve spent four years building WebGL tools for a mapping startup, and I’d love to talk about the footer.', hint: 'No cover letter needed. Tell us what you’ve made and what you’d like to make here.' },
  legal: { team: 'Legal & privacy', short: 'Legal', mail: 'privacy@crestora.example', time: 'Within 3 working days', where: 'Read in Lisbon',
    ask: 'What do you need?', placeholder: 'Please send your DPA for signature. We’re a Crew customer based in Germany.', hint: 'For a data request, use the email on your Crestora account so we can verify it’s you.' },
  grants: { team: 'Creator grants', short: 'Grants', mail: 'grants@crestora.example', time: 'A decision within 2 weeks', where: 'Read in Nairobi and Seoul',
    ask: 'Tell us about you and your project', placeholder: 'I’m a final-year film student in Accra making a 12-minute documentary about my grandmother’s fabric stall.', hint: 'Student, educator or first-time founder? Say which, and what you’ll make this year.' },
};
const ALIASES = { partner: 'partners', partnership: 'partners', partnerships: 'partners', privacy: 'legal', grant: 'grants', jobs: 'careers', career: 'careers', help: 'support' };

export default function init({ calm }) {
  form(calm);
  hubs(calm);
}

/* ---------------- the form ---------------- */
function form(calm) {
  const el = $('#ct-form');
  if (!el) return;
  const radios = $$('input[name="topic"]', el);
  const group = radios[0]?.closest('fieldset');
  const conds = $$('[data-show]', el);
  const msg = $('#ct-msg', el), msgLabel = $('#ct-msg-label', el), msgHint = $('#ct-msg-hint', el);
  const send = $('[data-submit-label]', el);
  const route = { team: $('[data-route-team]'), mail: $('[data-route-mail]'), time: $('[data-route-time]'), where: $('[data-route-where]') };
  const cards = $$('[data-topic-card]');
  let topic = '';

  const clearGroup = () => {
    for (const r of radios) r.removeAttribute('aria-invalid');
    const err = group?.querySelector('.field__error');
    if (err) err.textContent = '';
  };

  const apply = (t, { animate = false } = {}) => {
    topic = TOPICS[t] && t ? t : '';
    const d = TOPICS[topic];
    for (const g of conds) {
      const show = !!topic && g.dataset.show.split(/\s+/).includes(topic);
      const was = !g.hidden;
      g.hidden = !show;
      for (const f of $$('[data-required]', g)) {
        f.required = show;
        if (!show) { f.removeAttribute('aria-invalid'); const e = f.closest('.field')?.querySelector('.field__error'); if (e) e.textContent = ''; }
      }
      if (show && !was && animate && gsap && !calm) gsap.fromTo(g, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    if (msgLabel) msgLabel.textContent = d.ask;
    if (msg) msg.placeholder = d.placeholder;
    if (msgHint) msgHint.textContent = d.hint;
    if (send) send.textContent = topic ? `Send to ${d.short}` : 'Send message';
    if (route.team) route.team.textContent = d.team;
    if (route.mail) route.mail.textContent = d.mail;
    if (route.time) route.time.textContent = d.time;
    if (route.where) route.where.textContent = d.where;
    for (const c of cards) c.classList.toggle('is-on', !!topic && c.dataset.topicCard === topic);
  };

  const pick = (t, opts) => {
    const r = radios.find((x) => x.value === t);
    if (r) r.checked = true;
    clearGroup();
    apply(r ? t : '', opts);
  };

  // keep ?topic= in the address (and the hash), so a link to the form can be shared
  const remember = (t) => {
    const url = new URL(location.href);
    if (t) url.searchParams.set('topic', t); else url.searchParams.delete('topic');
    if (t !== 'careers') url.searchParams.delete('role');
    history.replaceState(history.state, '', url);
  };

  group?.addEventListener('change', (e) => {
    if (e.target.name !== 'topic') return;
    clearGroup();
    apply(e.target.value, { animate: true });
    remember(e.target.value);
  });
  // the doors' "Write to …" links set the topic; core glides to #write
  for (const a of $$('[data-topic-link]')) {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      pick(a.dataset.topicLink, { animate: true });
      remember(a.dataset.topicLink);
    });
  }
  // after a send, forms.js resets the form: keep the topic the visitor was writing about
  el.addEventListener('reset', () => setTimeout(() => pick(topic), 0));

  // ?topic= and ?role=
  const q = new URLSearchParams(location.search);
  const raw = (q.get('topic') || '').trim().toLowerCase();
  const t = TOPICS[raw] ? raw : ALIASES[raw] || '';
  pick(t);
  const role = q.get('role');
  if (role && (t === 'careers' || !t)) {
    if (!t) pick('careers');
    matchRole($('#ct-role', el), role);
  }
}

// an exact slug wins; otherwise the option sharing the most words with it (at least half of them)
function matchRole(select, slug) {
  if (!select) return;
  const want = slug.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best = null, score = 0;
  for (const o of select.options) {
    if (!o.value) continue;
    if (o.value === slug.toLowerCase()) { best = o; score = 1; break; }
    const have = new Set([...o.value.split('-'), ...o.textContent.toLowerCase().split(/[^a-z0-9]+/)]);
    const s = want.filter((w) => have.has(w)).length / Math.max(want.length, 1);
    if (s > score) { score = s; best = o; }
  }
  if (best && score >= 0.5) select.value = best.value;
}

/* ---------------- the hubs ---------------- */
const OPEN = 9 * 60, CLOSE = 18 * 60;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');
const dur = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const offsetLabel = (o) => `UTC${o < 0 ? '−' : '+'}${Math.floor(Math.abs(o) / 60)}${Math.abs(o) % 60 ? `:${pad(Math.abs(o) % 60)}` : ''}`;

// a time zone's wall clock and its offset from UTC (in minutes), from Intl
function zone(tz, now) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const h = Number(p.hour) % 24, m = Number(p.minute);
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, m);
  const offset = Math.round((wall - Math.floor(now.getTime() / 60000) * 60000) / 60000);
  return { h, m, mins: h * 60 + m, wd: SHORT.indexOf(p.weekday), offset };
}

function status({ wd, mins }) {
  const weekday = wd >= 1 && wd <= 5;
  if (weekday && mins >= OPEN && mins < CLOSE) return { open: true, next: `Closes in ${dur(CLOSE - mins)}` };
  if (weekday && mins < OPEN) return { open: false, next: `Opens in ${dur(OPEN - mins)}` };
  let d = 1;
  while ((wd + d) % 7 === 0 || (wd + d) % 7 === 6) d++;
  return { open: false, next: `Opens ${d === 1 ? 'tomorrow' : DAYS[(wd + d) % 7]} at 09:00` };
}

function relative(diff) {
  if (diff === 0) return 'Same time as you';
  const a = Math.abs(diff);
  const s = a % 60 ? `${Math.floor(a / 60)} h ${a % 60} min` : `${a / 60} h`;
  return `${s} ${diff > 0 ? 'ahead of' : 'behind'} you`;
}

function hubs(calm) {
  const cards = $$('[data-hub]');
  if (!cards.length) return;
  const sun = $('[data-sun]');
  const openCount = $('[data-open-count]');
  const cover = $('[data-cover]');
  const here = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
  const LEGACY = { Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh City', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu' };
  const city = here.includes('/') ? here.split('/').pop().replace(/_/g, ' ') : here;
  const hereName = LEGACY[city] || city;
  let rolled = calm;   // digits roll up from 00:00 the first time the hubs are seen; after that, each minute

  for (const c of cards) {
    for (const n of $$('[hidden]', c)) n.hidden = false;
    const h = $('[data-h]', c), m = $('[data-m]', c);
    odometer(h, 0, { prefix: '0', hold: true });
    odometer(m, 0, { prefix: '0', hold: true });
  }

  const tick = () => {
    const now = new Date();
    const mine = -now.getTimezoneOffset();
    let open = 0;
    const windows = [];
    for (const c of cards) {
      const z = zone(c.dataset.tz, now);
      const s = status(z);
      if (s.open) open++;
      c.classList.toggle('is-open', s.open);
      const state = $('[data-state]', c);
      state.textContent = s.open ? 'Open now' : 'Closed';
      state.classList.toggle('is-open', s.open);
      if (rolled) {
        odometer($('[data-h]', c), z.h, { prefix: z.h < 10 ? '0' : '' });
        odometer($('[data-m]', c), z.m, { prefix: z.m < 10 ? '0' : '' });
      }
      $('[data-clock-sr]', c).textContent = `Local time in ${c.dataset.city}: ${pad(z.h)}:${pad(z.m)}, ${DAYS[z.wd]}. `;
      $('[data-zone]', c).textContent = offsetLabel(z.offset);
      $('[data-rel]', c).textContent = relative(z.offset - mine);
      $('[data-next]', c).textContent = s.next;
      // this hub's weekday hours in the visitor's time (one or two pieces, if they cross midnight)
      const start = (((OPEN - z.offset + mine) % 1440) + 1440) % 1440;
      const pieces = start + (CLOSE - OPEN) <= 1440 ? [[start, start + CLOSE - OPEN]] : [[start, 1440], [0, start + CLOSE - OPEN - 1440]];
      windows.push(...pieces);
      const row = sun && $(`[data-sun-row="${c.dataset.hub}"]`, sun);
      if (row) {
        row.classList.toggle('is-open', s.open);
        const track = $('.ct-sun__track', row);
        const key = pieces.map((p) => p.join('-')).join(',');
        if (track.dataset.key !== key) {
          track.dataset.key = key;
          track.innerHTML = pieces.map(([a, b]) => `<i class="ct-sun__win" style="--a:${a};--b:${b}"></i>`).join('');
        }
      }
    }
    if (openCount) openCount.textContent = String(open);
    if (cover) {
      const covered = new Uint8Array(1440);
      for (const [a, b] of windows) covered.fill(1, a, b);
      cover.textContent = String(Math.round(covered.reduce((n, v) => n + v, 0) / 60));
    }
    if (sun) {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const line = $('[data-sun-line]', sun);
      line.hidden = false;
      line.style.setProperty('--t', (nowMins / 1440).toFixed(4));
      const label = $('[data-sun-label]', sun);
      label.hidden = false;
      $('[data-sun-now]', sun).textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      $('[data-sun-zone]', sun).textContent = hereName ? `your time (${hereName})` : 'your time';
    }
  };

  tick();
  if (!rolled) {
    const stop = whenVisible($('#hubs') || cards[0], (v) => { if (v) { stop(); rolled = true; setTimeout(tick, 200); } }, '-10% 0px');
  }
  // once a minute, on the minute (and straight away when the tab comes back)
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { tick(); schedule(); }, 60000 - (Date.now() % 60000) + 50); };
  schedule();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); schedule(); } });
}
