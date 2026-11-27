// integrations.html: what the generic modules (filter, dialog, forms) don't already do.
//  - A whole directory card opens its dialog (its Details button stays the real, focusable control).
//  - integrations.html#<slug> lands on that card and lights it (CSS :target does the lighting without scripts; this
//    keeps it lit after in-page navigation and clears any filter that would hide it).
//  - The empty state says what was searched and pre-fills the request form's app name with it.
//  - Connect buttons in the dialogs say it's a demo; "/" jumps to the search field.
import { toast, scrollToTarget, lenis, $, $$ } from '../core.js';

export default function init() {
  const scope = $('#directory');
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
  // (a modal dialog sits in the top layer, above the page's toast: the toast rides inside the dialog while it is open)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ig-connect]');
    if (!btn) return;
    toast('Connecting is off here.', 'Demo');
    const pill = document.querySelector('.toast');
    const dialog = btn.closest('dialog');
    if (pill && dialog?.open && pill.parentElement !== dialog) {
      dialog.append(pill);
      dialog.addEventListener('close', () => document.body.append(pill), { once: true });
    }
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
  landAgain();
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
  const pretty = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  scope.addEventListener('filter:change', (e) => {
    const { shown, wanted } = e.detail || {};
    if (shown !== 0) return;
    const q = (search?.value || '').trim();
    if (qOut) qOut.textContent = q;
    const lane = wanted && wanted[0] !== 'all' ? $(`[data-filter="${wanted[0]}"]`, scope) : null;
    if (whereOut) whereOut.textContent = lane ? `in ${lane.textContent.replace(/\d+\s*$/, '').trim()} ` : '';
    if (q && reqApp && (!reqApp.value || reqApp.dataset.auto)) {
      reqApp.value = pretty(q).slice(0, 60);
      reqApp.dataset.auto = '1';
      reqApp.classList.add('is-filled');
      if (reqApp.hasAttribute('aria-invalid')) reqApp.dispatchEvent(new Event('input'));
    }
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

// Deep links with smooth scrolling on: the browser jumps to the #id before Lenis starts, so the shared landing scroll
// (core.js, on load) measures from a stale position and stops short. Once it has run, land again from where we are.
function landAgain() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  // a directory card lands in the middle of the screen, where the eye is; anything else under the header
  const offset = () => (target.classList.contains('ig-card') ? -Math.max(96, Math.round((innerHeight - target.offsetHeight) / 2)) : -84);
  const land = () => setTimeout(() => {
    if (lenis) scrollToTarget(target, { immediate: true, offset: offset() });
    else if (target.classList.contains('ig-card')) scrollTo({ top: target.getBoundingClientRect().top + scrollY + offset(), behavior: 'auto' });
  }, 140);
  if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
}
