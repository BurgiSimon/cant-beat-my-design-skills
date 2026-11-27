// start.html: open a lane, or sign in with an emailed link (no passwords). The generic tabs module runs the two tabs
// (start.html#signin opens Sign in) and the generic forms module validates both forms; this fills in the rest:
//   - ?idea= ?email= ?name= ?persona= ?plan= arrive from the home page and pricing and prefill the form;
//   - the Lane 001 card follows what you type (title, initials, who you are, the plan);
//   - on success the card's six stages light from Spark to Afterglow and the success state offers
//     "Take it for a drive", which launches the footer (crestora:launch); "Open another lane" starts Lane 002;
//   - a sent sign-in link is confirmed in place, and links to #signin on this page switch the tab.
// Reduced motion: the stages are simply lit; the drive link just goes to the footer.
import { $, $$, store } from '../core.js';
import { laneCard, cyclePlaceholder, titleOf } from './home-start.js';

const PLANS = {
  solo: { name: 'Solo', price: () => 'Free for 3 lanes' },
  studio: { name: 'Studio', price: (p) => (p === 'monthly' ? '$12 a month, billed monthly' : '$10 a month, billed yearly') },
  crew: { name: 'Crew', price: (p) => (p === 'monthly' ? '$20 a seat a month, billed monthly' : '$16 a seat a month, billed yearly') },
};
const PERSONAS = { creator: 'Creator', builder: 'Builder', dreamer: 'Dreamer' };
const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

export default function init({ calm }) {
  const hero = $('.start-hero');
  const form = $('#open-form');
  const signin = $('#signin-form');
  const cardEl = hero && $('[data-lane-card]', hero);
  if (!form || !cardEl) return;
  const lane = laneCard(cardEl, { calm });
  const field = (f, n) => f?.elements.namedItem(n);
  const name = field(form, 'name'), email = field(form, 'email'), idea = field(form, 'idea');
  const done = $('#open-done');
  const personaTag = $('[data-lane-persona]', cardEl);
  const planTag = $('[data-lane-plan]', cardEl);

  // ---- what the visitor brought with them ----
  const params = new URLSearchParams(location.search);
  if (params.get('idea')) idea.value = clip(params.get('idea'), 60);
  if (params.get('name')) name.value = clip(params.get('name'), 60);
  if (params.get('email')) {
    email.value = clip(params.get('email'), 120);
    if (field(signin, 'email')) field(signin, 'email').value = email.value;
  }
  const persona = params.get('persona');
  if (PERSONAS[persona]) { const r = form.querySelector(`input[name="persona"][value="${persona}"]`); if (r) r.checked = true; }

  // the plan (from pricing or the home teaser), priced in the billing period the visitor last chose
  const planKey = PLANS[params.get('plan')] ? params.get('plan') : 'solo';
  const plan = PLANS[planKey];
  const period = store.get('billing', 'yearly') === 'monthly' ? 'monthly' : 'yearly';
  field(form, 'plan').value = planKey;
  $('[data-plan-name]', form).textContent = plan.name;
  $('[data-plan-price]', form).textContent = plan.price(period);
  if (planTag) planTag.textContent = plan.name;

  // ---- the card follows the form ----
  const sync = () => {
    lane.title(idea.value);
    lane.person({ name: name.value, email: email.value });
    const who = form.querySelector('input[name="persona"]:checked');
    if (personaTag) { personaTag.textContent = who ? PERSONAS[who.value] : ''; personaTag.hidden = !who; }
  };
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  idea.addEventListener('focus', () => lane.typing(true));
  idea.addEventListener('blur', () => lane.typing(false));
  sync();
  cyclePlaceholder(idea, { calm });

  // ---- success: the lane opens ----
  form.addEventListener('form:success', async (e) => {
    const data = e.detail;
    lane.typing(false);
    $('[data-done-lane]', done).textContent = lane.label;
    $('[data-done-email]', done).textContent = clip(data.get('email'), 120);
    $('[data-done-idea]', done).textContent = titleOf(data.get('idea')) || 'your next thing';
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    if (done.getBoundingClientRect().top < 80) done.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    await lane.fill();
    lane.open();
  });

  // another lane: Lane 002, back at Spark
  $('[data-again]', done)?.addEventListener('click', () => {
    form.reset();
    field(form, 'plan').value = planKey;
    lane.next();
    form.dataset.successKey = lane.label;
    sync();
    done.hidden = true;
    form.hidden = false;
    idea.focus();
  });

  // "Take it for a drive": the footer launches (under reduced motion the link simply goes there)
  $('[data-launch]', done)?.addEventListener('click', (e) => {
    if (calm) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('crestora:launch'));
  });

  // ---- sign in: the link is confirmed in place ----
  const sent = signin && $('[data-signin-sent]', signin);
  signin?.addEventListener('form:success', (e) => {
    if (!sent) return;
    sent.textContent = '';
    const b = document.createElement('strong');
    b.textContent = clip(e.detail.get('email'), 120);
    sent.append('A sign-in link is on its way to ', b, '. It works once, for the next 15 minutes. (Demo: nothing was sent.)');
    sent.hidden = false;
  });
  signin?.addEventListener('input', () => { if (sent) sent.hidden = true; });

  // ---- the tabs: buttons and links that switch them, and the address that follows ----
  const choose = (id) => { const tab = document.getElementById(id); if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click(); return tab; };
  for (const b of $$('[data-goto-tab]')) b.addEventListener('click', () => choose(b.dataset.gotoTab)?.focus());
  for (const a of $$('a[href*="#signin"]')) {
    a.addEventListener('click', () => {
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname) choose('tab-signin');
    });
  }
  $('.start-tabs')?.addEventListener('tabs:change', (e) => {
    const toSignin = e.detail.tab.id === 'tab-signin';
    if (toSignin === (location.hash === '#signin')) return;
    history.replaceState(null, '', toSignin ? '#signin' : location.pathname + location.search);
  });
}
