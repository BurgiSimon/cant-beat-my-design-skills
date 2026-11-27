// api.html: the code samples are lit in white light (a tiny tokenizer per language: keys, strings, numbers, keywords,
// comments, and a stage-coloured dot beside any stage name); the endpoint nav marks where you're reading (and keeps that
// link in sight); the nav is a <details> that stays open on wide screens and folds into "Endpoints" on narrower ones.
// The language tabs (kept in step and remembered) and the copy buttons are the generic tabs and copy modules'.
import { calm, lenis, $, $$ } from '../core.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const STAGE = /^(["'])(spark|shape|make|review|launch|afterglow)\1$/;

// each language: [token class, pattern] in priority order; patterns must not capture
const JSON_RULES = [
  ['key', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
  ['str', /"(?:[^"\\\n]|\\.)*"/],
  ['lit', /\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/],
];
const RULES = {
  json: JSON_RULES,
  http: [
    ['head', /^(?:HTTP\/[\d.]+ \d+.*|(?:GET|POST|PATCH|DELETE) \S+ HTTP\/[\d.]+)$/],
    ['key', /^[A-Za-z][\w-]*(?=:)/],
    ...JSON_RULES,
  ],
  js: [
    ['com', /\/\/[^\n]*/],
    ['str', /`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/],
    ['kw', /\b(?:const|let|await|async|function|return|if|new|import|from|do|while|of)\b/],
    ['lit', /\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b/],
    ['key', /\b[A-Za-z_$][\w$]*(?=: )/],
    ['fn', /\b[A-Za-z_$][\w$]*(?=\()/],
  ],
  py: [
    ['com', /#[^\n]*/],
    ['str', /(?:\bf)?"(?:[^"\\\n]|\\.)*"|(?:\bf)?'(?:[^'\\\n]|\\.)*'/],
    ['kw', /\b(?:import|from|def|return|if|not|and|or|while|for|in|break|True|False|None)\b/],
    ['lit', /\b\d+(?:\.\d+)?\b/],
    ['fn', /\b[A-Za-z_]\w*(?=\()/],
  ],
  shell: [
    ['com', /^#[^\n]*/],
    ['str', /'[^']*'|"(?:[^"\\\n]|\\.)*"/],
    ['kw', /\b(?:curl|openssl|printf|echo|sed|cat)\b/],
    ['flag', /(?<=\s)--?[A-Za-z][\w-]*/],
    ['var', /\$[A-Za-z_]\w*/],
  ],
};
const compiled = {};
function highlight(code) {
  const lang = code.dataset.lang;
  const rules = RULES[lang];
  if (!rules || code.dataset.lit) return;
  const re = compiled[lang] ||= new RegExp(rules.map(([, r]) => `(${r.source})`).join('|'), 'gm');
  const text = code.textContent;
  let out = '', last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const kind = rules[m.slice(1).findIndex((g) => g !== undefined)][0];
    const stage = kind === 'str' && STAGE.exec(m[0]);
    out += esc(text.slice(last, m.index)) + (stage
      ? `<span class="tk-str tk-stage" data-stage="${stage[2]}">${esc(m[0])}</span>`
      : `<span class="tk-${kind}">${esc(m[0])}</span>`);
    last = m.index + m[0].length;
  }
  code.innerHTML = out + esc(text.slice(last));
  code.dataset.lit = '1';
}

export default function init() {
  const page = $('[data-page="api"]');
  if (!page) return;

  for (const code of $$('code[data-lang]', page)) highlight(code);

  // the tabs' thumbs are placed once without sliding in, then slide from then on
  const live = () => setTimeout(() => page.classList.add('is-api-live'), 450);
  if (document.fonts?.ready) document.fonts.ready.then(live); else live();

  // a language switch changes every panel's height at once: keep the row you clicked in exactly where it was on screen
  let hold = null;
  page.addEventListener('tabs:change', (e) => {
    if (hold || !page.classList.contains('is-api-live')) return;
    const row = e.target.closest('.api-row, .api-hero');
    if (!row) return;
    hold = { row, top: row.getBoundingClientRect().top };
    queueMicrotask(() => {
      const d = hold.row.getBoundingClientRect().top - hold.top;
      hold = null;
      if (Math.abs(d) < 0.5) return;
      if (lenis) lenis.scrollTo(lenis.scroll + d, { immediate: true, force: true }); else scrollBy(0, d);
    });
  });

  // ---- the nav: open on wide screens, "Endpoints" on narrower ones ----
  const side = $('[data-api-side]', page);
  const nav = side && $('.api-nav', side);
  if (!nav) return;
  const wide = matchMedia('(min-width: 1360px)');
  const fit = () => { side.open = wide.matches; };
  fit();
  wide.addEventListener('change', fit);
  $('summary', side).addEventListener('click', (e) => { if (wide.matches) e.preventDefault(); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]') && !wide.matches) side.open = false; });
  const now = $('[data-api-now]', side);

  // ---- scrollspy: the section or endpoint you're reading ----
  const links = $$('a[href^="#"]', nav);
  const spots = links.map((a) => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) })).filter((x) => x.el);
  let current = null;
  const spy = (force = false) => {
    const line = Math.max(innerHeight * 0.32, 160);
    let pick = spots[0];
    for (const x of spots) { if (x.el.getBoundingClientRect().top <= line) pick = x; }
    if (!pick || (pick === current && !force)) return;
    current = pick;
    const parent = pick.a.closest('.api-nav__item')?.querySelector(':scope > .api-nav__link');
    for (const x of spots) {
      if (x === pick) x.a.setAttribute('aria-current', 'true'); else x.a.removeAttribute('aria-current');
    }
    for (const l of $$('.api-nav__link', nav)) l.classList.toggle('is-parent', l === parent && l !== pick.a);
    if (now) now.textContent = pick.a.querySelector('.api-nav__t')?.textContent || pick.a.textContent.trim();
    if (wide.matches && nav.scrollHeight > nav.clientHeight + 4) {
      const r = pick.a.getBoundingClientRect(), b = nav.getBoundingClientRect();
      if (r.top < b.top + 48 || r.bottom > b.bottom - 48) nav.scrollTo({ top: nav.scrollTop + (r.top - b.top) - b.height * 0.35, behavior: calm ? 'auto' : 'smooth' });
    }
  };
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy(); }); }, { passive: true });
  addEventListener('resize', () => spy(true), { passive: true });
  spy(true);
}
