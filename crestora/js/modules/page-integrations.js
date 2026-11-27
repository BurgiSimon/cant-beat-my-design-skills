// integrations.html: what the generic modules (filter, dialog, forms) don't already do.
//  - A whole directory card opens its dialog (its Details button stays the real, focusable control).
//  - integrations.html#<slug> lands on that card and lights it (CSS :target does the lighting without scripts; this
//    keeps it lit after in-page navigation and clears any filter that would hide it).
//  - The empty state says what was searched and pre-fills the request form's app name with it; when a lane chip is
//    hiding an app that does exist in another lane, it says so and offers every lane instead.
//  - Connect buttons in the dialogs say it's a demo; "/" jumps to the search field.
import { toast, scrollToTarget, landing, restingTop, $, $$ } from '../core.js';

export default function init() {
  const scope = $('.ig-dir');
  if (!scope) return;
  const search = $('#ig-q', scope);
  const reqApp = $('#req-app');
  const reqWhat = $('#req-what');
  const cards = $$('.ig-card', scope);

  // ---- a card is one big target for its dialog ----
  for (const card of cards) {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input')) return;
      if (String(getSelection?.() || '').length) return;          // let people select text
      card.querySelector('[data-dialog-open]')?.click();
    });
  }

  // ---- Connect: a demo ----
  // (the kit's toast rides inside an open dialog, so it shows above the modal)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-ig-connect]')) toast('Connecting is off here.', 'Demo');
  });

  // ---- deep links: #framewright lands on the card and lights it ----
  const showAll = () => {
    const all = $('[data-filter="all"]', scope);
    if (search) search.value = '';
    if (all && all.getAttribute('aria-pressed') !== 'true') all.click();
    else search?.dispatchEvent(new Event('input'));
  };
  const mark = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const card = id ? document.getElementById(id) : null;
    if (!card || !card.classList.contains('ig-card')) return;
    for (const c of cards) c.classList.toggle('is-target', c === card);
    if (card.hidden) showAll();
  };
  mark();
  centreCards();
  addEventListener('hashchange', mark);
  addEventListener('popstate', mark);
  // once someone opens another card, the landing light has done its job
  scope.addEventListener('click', (e) => {
    const card = e.target.closest('.ig-card');
    if (card && !card.classList.contains('is-target')) for (const c of cards) c.classList.remove('is-target');
  });

  // ---- nothing matches: say so, and hand the name to the request form ----
  const qOut = $('[data-ig-empty-q]', scope);
  const whereOut = $('[data-ig-empty-where]', scope);
  const bodyOut = $('[data-ig-empty-body]', scope);
  const toRequest = $('[data-ig-request]', scope);
  const toAll = $('[data-ig-all]', scope);
  const note = $('.ig-status__note', scope);
  const yetOut = $('[data-ig-empty-yet]', scope);
  const pretty = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // the same match the filter module makes: every word of the query in the card's text or tags
  const words = new Map(cards.map((c) => [c, `${c.textContent} ${c.dataset.tags || ''}`.toLowerCase()]));
  const matches = (q) => { const ws = q.toLowerCase().split(/\s+/).filter(Boolean); return cards.filter((c) => ws.every((w) => words.get(c).includes(w))); };
  scope.addEventListener('filter:change', (e) => {
    const { shown, wanted } = e.detail || {};
    if (note) note.hidden = shown === 0;
    if (shown !== 0) return;
    const q = (search?.value || '').trim();
    if (qOut) qOut.textContent = q;
    const lane = wanted && wanted[0] !== 'all' ? $(`[data-filter="${wanted[0]}"]`, scope) : null;
    const laneName = lane ? lane.textContent.replace(/\d+\s*$/, '').trim() : '';
    if (whereOut) whereOut.textContent = lane ? `in ${laneName} ` : '';
    // a lane chip is hiding an app we do have: point at it rather than ask for it
    const elsewhere = lane && q ? matches(q) : [];
    if (toRequest) toRequest.hidden = elsewhere.length > 0;
    if (toAll) toAll.hidden = elsewhere.length === 0;
    if (yetOut) yetOut.hidden = elsewhere.length > 0;
    if (elsewhere.length) {
      const name = (c) => $('.ig-card__name', c)?.textContent || '';
      const laneOf = (c) => $(`[data-filter="${c.dataset.stage}"]`, scope)?.textContent.replace(/\d+\s*$/, '').trim();
      const names = elsewhere.slice(0, 2).map(name);
      const more = elsewhere.length > 2 ? ` and ${elsewhere.length - 2} more` : '';
      if (bodyOut) bodyOut.textContent = elsewhere.length === 1
        ? `${names[0]} rides the ${laneOf(elsewhere[0])} lane. Search every lane to see it.`
        : `${names.join(elsewhere.length > 2 ? ', ' : ' and ')}${more} ride other lanes. Search every lane to see them.`;
      return;
    }
    let filled = false;
    if (q && reqApp && (!reqApp.value || reqApp.dataset.auto)) {
      reqApp.value = pretty(q).slice(0, 60);
      reqApp.dataset.auto = '1';
      reqApp.classList.add('is-filled');
      if (reqApp.hasAttribute('aria-invalid')) reqApp.dispatchEvent(new Event('input'));
      filled = true;
    }
    if (bodyOut) bodyOut.textContent = filled || reqApp?.dataset.auto
      ? 'We’ve put it in the request form below. Tell us what it should send and we’ll take it from there.'
      : 'Ask for it in the request form below. Tell us what it should send and we’ll take it from there.';
  });
  toAll?.addEventListener('click', () => {
    const all = $('[data-filter="all"]', scope);
    all?.click();
    // the button is gone with the empty state: keep the keyboard where the results begin
    requestAnimationFrame(() => all?.focus());
  });
  reqApp?.addEventListener('input', (e) => { if (e.isTrusted) { delete reqApp.dataset.auto; reqApp.classList.remove('is-filled'); } });
  reqApp?.closest('form')?.addEventListener('form:success', () => { delete reqApp.dataset.auto; reqApp.classList.remove('is-filled'); });

  // "Request it" lands on the form with the name filled in: the next thing to write is what it should send
  $('.ig-empty a[href="#request"]', scope)?.addEventListener('click', () => {
    setTimeout(() => (reqApp?.value ? reqWhat : reqApp)?.focus({ preventScroll: true }), 60);
  });
  $('[data-ig-clear]', scope)?.addEventListener('click', () => {
    if (!search) return;
    search.value = '';
    search.dispatchEvent(new Event('input'));
    search.focus();
  });

  // ---- "/" to search ----
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (!search) return;
    search.focus({ preventScroll: true });
    const r = search.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 40) scrollToTarget(search, { offset: -Math.round(innerHeight * 0.3) });
  });
}

// Deep links (and in-page links) to a directory card: the kit lands an #id under the header; a card is better in the
// middle of the screen, where the eye is. The kit asks here first, so it lands there once, without a second jump.
function centreCards() {
  landing((t) => {
    if (!t.classList.contains('ig-card')) return undefined;
    return restingTop(t) + scrollY - Math.max(96, Math.round((innerHeight - t.offsetHeight) / 2));
  });
}
