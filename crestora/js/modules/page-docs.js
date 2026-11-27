// docs.html: the sidebar. It is a <details> ("Browse docs") that stays open on wide screens and folds on narrow ones;
// its search filters every heading live (titles plus a few keywords each), marks the matches and says how many there
// are; "/" jumps into it from anywhere on the page. As you read, the sidebar marks the heading you're in and opens that
// section's sub-headings. Under each section, "Was this helpful?" remembers the answer and says thanks in the toast.
// The right-hand "On this page" list and the copy-link buttons on headings are the generic toc module's.
import { store, toast, calm, scrollToTarget, $, $$ } from '../core.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default function init() {
  const page = $('[data-page="docs"]');
  const side = page && $('[data-docs-side]', page);
  if (!side) return;
  const nav = $('.docs-nav', side);
  const body = $('.docs-side__body', side);
  const input = $('#docs-q', side);
  const count = $('[data-docs-count]', side);
  const empty = $('[data-docs-empty]', side);
  const now = $('[data-docs-now]', side);

  // ---- open on wide screens, folded on narrow ones ----
  const wide = matchMedia('(min-width: 960px)');
  const fit = () => { side.open = wide.matches; };
  fit();
  wide.addEventListener('change', fit);
  $('summary', side).addEventListener('click', (e) => { if (wide.matches) e.preventDefault(); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a') && !wide.matches) side.open = false; });

  // ---- the headings, in reading order ----
  const items = $$('.docs-nav__item', nav).map((li) => ({
    li,
    link: $(':scope > a', li),
    subs: $$('.docs-nav__sub li', li).map((sub) => ({ li: sub, link: $('a', sub) })),
  }));
  const links = items.flatMap((it) => [it.link, ...it.subs.map((s) => s.link)]);
  for (const a of links) a.dataset.text = a.textContent;
  const groups = $$('.docs-nav__group', nav);

  // ---- search ----
  const paint = (a, words) => {
    const text = a.dataset.text;
    if (!words.length) { if (a.firstElementChild) a.textContent = text; return; }
    const low = norm(text);
    const ranges = words.map((w) => { const i = low.indexOf(w); return i < 0 ? null : [i, i + w.length]; }).filter(Boolean).sort((x, y) => x[0] - y[0]);
    let html = '', at = 0;
    for (const [s, e] of ranges) {
      if (s < at) continue;
      html += `${esc(text.slice(at, s))}<mark>${esc(text.slice(s, e))}</mark>`;
      at = e;
    }
    a.innerHTML = html + esc(text.slice(at));
  };
  const hit = (a, words) => { const hay = norm(`${a.dataset.text} ${a.dataset.k || ''}`); return words.every((w) => hay.includes(w)); };
  let first = null;
  const run = () => {
    const words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    const searching = words.length > 0;
    nav.classList.toggle('is-searching', searching);
    let n = 0;
    first = null;
    for (const it of items) {
      const self = !searching || hit(it.link, words);
      let any = false;
      if (searching && self) { n++; first ||= it.link; }
      paint(it.link, searching && self ? words : []);
      for (const s of it.subs) {
        const h = !searching || hit(s.link, words);
        s.li.hidden = !h;
        any ||= h;
        if (searching && h) { n++; first ||= s.link; }
        paint(s.link, searching && h ? words : []);
      }
      it.li.hidden = !(self || any);
      it.li.classList.toggle('is-dim', searching && !self);
    }
    for (const g of groups) g.hidden = !$$('.docs-nav__item', g).some((li) => !li.hidden);
    count.textContent = !searching ? '' : n === 0 ? 'No headings match' : `${n} ${n === 1 ? 'heading matches' : 'headings match'}`;
    empty.hidden = !searching || n > 0;
    if (!searching) spy(true);
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); first?.click(); }
    if (e.key === 'Escape') {
      if (input.value) { e.preventDefault(); input.value = ''; run(); } else input.blur();
    }
  });
  // "/" searches the docs from anywhere on the page (as the shortcuts table promises)
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (!wide.matches) { side.open = true; scrollToTarget(side, { immediate: calm }); }
    input.focus({ preventScroll: true });
    input.select();
  });

  // ---- the heading you're reading, marked in the sidebar ----
  const heads = links.map((a) => ({ a, h: document.getElementById(decodeURIComponent(a.hash.slice(1))) })).filter((x) => x.h);
  let current = null;
  const spy = (force = false) => {
    const line = innerHeight * 0.45;   // the same reading line as the "On this page" list
    let pick = heads[0];
    for (const x of heads) { if (x.h.getBoundingClientRect().top <= line) pick = x; else break; }
    if (!pick || (pick === current && !force)) return;
    current = pick;
    for (const x of heads) {
      if (x === pick) x.a.setAttribute('aria-current', 'true'); else x.a.removeAttribute('aria-current');
    }
    const item = pick.a.closest('.docs-nav__item');
    for (const it of items) {
      it.li.classList.toggle('is-open', it.li === item);
      it.link.classList.toggle('is-active', it.li === item);
    }
    if (now) now.textContent = $(':scope > a', item)?.dataset.text || '';
    // keep it in sight when the sidebar scrolls on its own
    if (wide.matches && body.scrollHeight > body.clientHeight + 4) {
      const r = pick.a.getBoundingClientRect(), b = body.getBoundingClientRect();
      if (r.top < b.top + 48 || r.bottom > b.bottom - 48) body.scrollTo({ top: body.scrollTop + (r.top - b.top) - b.height * 0.35, behavior: calm ? 'auto' : 'smooth' });
    }
  };
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy(); }); }, { passive: true });
  addEventListener('resize', () => spy(true), { passive: true });
  spy(true);

  // ---- was this helpful? ----
  const votes = store.get('docs-helpful', {}) || {};
  for (const row of $$('.docs-helpful', page)) {
    const slug = row.dataset.helpful;
    const title = row.dataset.title || 'this section';
    const buttons = $$('[data-vote]', row);
    const show = (v) => { for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.vote === v)); };
    show(votes[slug]);
    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vote]');
      if (!b) return;
      const v = b.dataset.vote;
      votes[slug] = v;
      store.set('docs-helpful', votes);
      show(v);
      toast(v === 'yes' ? `Glad “${title}” helped. Thanks for saying so.` : `Thanks. We’ll make “${title}” clearer.`, 'Noted');
    });
  }
}
