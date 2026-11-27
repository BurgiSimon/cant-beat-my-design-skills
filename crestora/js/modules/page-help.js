// help.html: instant search over every answer on the page, as a combobox. Typing ranks the answers (question first,
// then keywords, topic and body), shows them in a listbox with the matches highlighted and a snippet of the answer;
// the arrow keys move through them, Enter (or a click) scrolls to that answer and opens its <details>. With the field
// empty, the listbox offers the popular questions. "/" jumps to the search; the quick searches fill it. Links to an
// answer (popular, related, a #hash on arrival) open it too. Each answer's "Copy link" copies its address. The topic
// list beside the answers follows the reading position.
import { $, $$, scrollToTarget } from '../core.js';

const STOP = new Set(['a', 'an', 'the', 'i', 'my', 'me', 'do', 'does', 'how', 'can', 'what', 'is', 'to', 'of', 'and', 'in', 'it', 'for', 'on', 'with', 'why', 'where', 'when', 'or', 'be', 'are']);
const MAX = 7;

// lower-case, accents off, curly quotes straight: one character in, one character out, so indexes still line up
const fold = (s) => {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    let c = s[i].normalize('NFD')[0].toLowerCase();
    if (c.length !== 1) c = s[i];
    if (c === '’' || c === '‘') c = "'";
    o += c;
  }
  return o;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const words = (q) => {
  const all = fold(q).split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const kept = all.filter((w) => !STOP.has(w));
  return kept.length ? kept : all;
};
const startsWord = (text, i) => i === 0 || /[^\p{L}\p{N}]/u.test(text[i - 1]);

// wrap every occurrence of the terms in <mark> (one- and two-letter terms only at the start of a word)
function highlight(text, terms) {
  const f = fold(text);
  const ranges = [];
  for (const t of terms) {
    let i = f.indexOf(t);
    while (i !== -1) {
      if (t.length > 2 || startsWord(f, i)) ranges.push([i, i + t.length]);
      i = f.indexOf(t, i + t.length);
    }
  }
  if (!ranges.length) return esc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const r of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r);
  }
  let out = '', at = 0;
  for (const [a, b] of merged) { out += esc(text.slice(at, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; at = b; }
  return out + esc(text.slice(at));
}

// a line of the answer around the first match
function snippet(text, terms) {
  const f = fold(text);
  let first = -1;
  for (const t of terms) { const i = f.indexOf(t); if (i !== -1 && (first === -1 || i < first)) first = i; }
  if (first === -1) return esc(text.length > 150 ? `${text.slice(0, text.lastIndexOf(' ', 150))}…` : text);
  let a = Math.max(0, first - 48), b = Math.min(text.length, first + 120);
  if (a > 0) a = text.indexOf(' ', a) + 1;
  if (b < text.length) b = text.lastIndexOf(' ', b);
  return `${a > 0 ? '…' : ''}${highlight(text.slice(a, b), terms)}${b < text.length ? '…' : ''}`;
}

export default function init() {
  const answers = $$('details.hc-a');
  if (!answers.length) return;

  // ---- the index ----
  const index = answers.map((d, order) => {
    const topic = d.closest('.hc-topic');
    const q = $('summary', d).textContent.trim();
    const body = $('.hc-a__body', d).cloneNode(true);
    for (const x of $$('.hc-a__foot', body)) x.remove();
    for (const x of $$('p, li, dt, dd, li > *', body)) x.append(' '); // blocks read as separate words
    const text = body.textContent.replace(/\s+/g, ' ').trim();
    const cat = $('.hc-topic__title', topic)?.textContent.trim() || '';
    const icon = $('.hc-topic__head .icon use', topic)?.getAttribute('href') || '#i-help';
    return { id: d.id, d, order, q, text, cat, icon, fq: fold(q), fk: fold(d.dataset.keywords || ''), fc: fold(cat), ft: fold(text) };
  });
  const byId = new Map(index.map((it) => [it.id, it]));

  const rank = (terms, phrase) => {
    const out = [];
    for (const it of index) {
      let score = 0, ok = true;
      for (const t of terms) {
        const iq = it.fq.indexOf(t), ik = it.fk.indexOf(t), ic = it.fc.indexOf(t), ib = it.ft.indexOf(t);
        if (iq < 0 && ik < 0 && ic < 0 && ib < 0) { ok = false; break; }
        if (iq >= 0) score += startsWord(it.fq, iq) ? 12 : 7;
        if (ik >= 0) score += startsWord(it.fk, ik) ? 6 : 3;
        if (ic >= 0) score += 3;
        if (ib >= 0) score += 2 + Math.min(3, it.ft.split(t).length - 2);
      }
      if (!ok) continue;
      if (phrase.length > 3 && it.fq.includes(phrase)) score += 10;
      out.push({ it, score });
    }
    return out.sort((a, b) => b.score - a.score || a.it.order - b.it.order).map((r) => r.it);
  };

  // ---- opening an answer ----
  const flash = (d) => { d.classList.remove('is-found'); void d.offsetWidth; d.classList.add('is-found'); setTimeout(() => d.classList.remove('is-found'), 2400); };
  const openAnswer = (id, { scroll = false, focus = false } = {}) => {
    const it = byId.get(id);
    if (!it) return false;
    it.d.open = true;
    if (scroll) scrollToTarget(it.d);   // where a link to it lands
    if (focus) $('summary', it.d).focus({ preventScroll: true });
    flash(it.d);
    return true;
  };
  // links to an answer (popular, related, the topic list never points at one) open it on the way
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (byId.has(id)) openAnswer(id);
  });
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (byId.has(id)) byId.get(id).d.open = true; };
  fromHash();
  addEventListener('hashchange', fromHash);

  // ---- copy a link to an answer ----
  for (const b of $$('[data-copy-answer]')) {
    const d = b.closest('details.hc-a');
    if (!d) continue;
    b.dataset.copy = `${location.origin}${location.pathname}#${d.id}`;
    b.dataset.copyToast = 'Link to this answer copied';
    b.setAttribute('aria-label', `Copy a link to “${$('summary', d).textContent.trim()}”`);
  }

  // ---- the topic list follows the reading position ----
  const nav = $('.hc-nav');
  if (nav) {
    const links = new Map($$('a', nav).map((a) => [a.getAttribute('href').slice(1), a]));
    const set = (id) => { for (const [k, a] of links) a.setAttribute('aria-current', String(k === id)); };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) set(e.target.id);
    }, { rootMargin: '-30% 0px -60% 0px' });
    for (const s of $$('.hc-topic')) io.observe(s);
  }

  // ---- the search ----
  const form = $('.hc-search');
  const input = $('#hc-q');
  const pop = $('#hc-pop');
  const list = $('#hc-results');
  const head = $('#hc-pop-head');
  const empty = $('.hc-pop__empty', pop);
  const none = $('[data-hc-none]', pop);
  const clear = $('.hc-search__clear', form);
  const live = $('#hc-live');
  if (!form || !input || !list) return;

  const popular = $$('[data-hc-popular] a').map((a) => byId.get(a.getAttribute('href').slice(1))).filter(Boolean);
  let shown = [], active = -1, liveT = 0;

  const say = (text) => { clearTimeout(liveT); liveT = setTimeout(() => { live.textContent = text; }, 450); };
  const setActive = (i, { scroll = true } = {}) => {
    active = i;
    $$('[role="option"]', list).forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    const o = list.children[i];
    if (o) {
      input.setAttribute('aria-activedescendant', o.id);
      if (scroll) o.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const open = (v) => {
    pop.hidden = !v;
    input.setAttribute('aria-expanded', String(v && shown.length > 0));
    if (!v) setActive(-1);
  };
  const render = () => {
    const raw = input.value.trim();
    clear.hidden = !input.value;
    const terms = raw ? words(raw) : [];
    const ranked = terms.length ? rank(terms, fold(raw)) : [];
    shown = terms.length ? ranked.slice(0, MAX) : popular;
    const total = ranked.length;
    head.textContent = terms.length
      ? (total ? `${total} answer${total === 1 ? '' : 's'}${total > MAX ? `, the best ${MAX}` : ''}` : 'Nothing yet')
      : 'Popular this week';
    list.innerHTML = shown.map((it, i) => `
      <li class="hc-opt" role="option" id="hc-opt-${i}" aria-selected="false" data-id="${it.id}" aria-label="${esc(`${it.q} (${it.cat})`)}">
        <span class="hc-opt__cat"><svg class="icon" aria-hidden="true"><use href="${it.icon}"/></svg>${esc(it.cat)}</span>
        <span class="hc-opt__q">${terms.length ? highlight(it.q, terms) : esc(it.q)}</span>
        ${terms.length ? `<span class="hc-opt__s">${snippet(it.text, terms)}</span>` : ''}
        <span class="hc-opt__go" aria-hidden="true"><svg class="icon"><use href="#i-arrow"/></svg></span>
      </li>`).join('');
    empty.hidden = !(terms.length && !shown.length);
    if (none) none.textContent = raw;
    open(true);
    setActive(terms.length && shown.length ? 0 : -1, { scroll: false });
    if (terms.length) say(shown.length ? `${total} answer${total === 1 ? '' : 's'} for ${raw}. Use the arrow keys to choose one.` : `No answers for ${raw}.`);
  };
  const choose = (i) => {
    const it = shown[i];
    if (!it) return;
    open(false);
    history.replaceState(null, '', `#${it.id}`);
    openAnswer(it.id, { scroll: true, focus: true });
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', (e) => {
    const n = shown.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (pop.hidden) render();
      if (!n) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0 ? (step > 0 ? 0 : n - 1) : (active + step + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!pop.hidden && n) choose(active < 0 ? 0 : active);
    } else if (e.key === 'Escape') {
      if (!pop.hidden) { e.preventDefault(); open(false); }
      else if (input.value) { e.preventDefault(); input.value = ''; clear.hidden = true; }
    } else if (e.key === 'Tab') {
      open(false);
    }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (shown.length) choose(active < 0 ? 0 : active); });
  // the listbox keeps the focus in the field; a click chooses
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('pointermove', (e) => {
    const o = e.target.closest('[role="option"]');
    if (o) { const i = [...list.children].indexOf(o); if (i !== active) setActive(i, { scroll: false }); }
  });
  list.addEventListener('click', (e) => {
    const o = e.target.closest('[role="option"]');
    if (o) choose([...list.children].indexOf(o));
  });
  form.addEventListener('focusout', (e) => { if (!form.contains(e.relatedTarget)) open(false); });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !form.contains(e.target)) open(false); });
  clear.addEventListener('click', () => { input.value = ''; input.focus(); render(); });

  // quick searches
  for (const b of $$('[data-q]')) {
    b.addEventListener('click', () => { input.value = b.dataset.q; input.focus({ preventScroll: true }); render(); });
  }
  // "/" jumps to the search from anywhere on the page
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (form.getBoundingClientRect().top < 0) scrollToTarget(form, { offset: -140 });
    input.focus({ preventScroll: true });
  });
}
