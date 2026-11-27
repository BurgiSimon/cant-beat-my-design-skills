// The models explorer: search (press / anywhere to jump to it), filters with live counts, sortable price and speed
// columns, and every row copies its model id. Rows step in as the list changes. Prices are per million tokens and,
// like the models list itself, illustrative.

import { calm, gsap, copyText, toast, PALETTE, scrollToTarget } from './core.js';

// id, provider, context, $ in, $ out, tokens/s, capabilities
const M = [
  ['deepseek/deepseek-v3.2:free', 'DeepSeek', '164K', 0, 0, 62, 'reasoning code tools'],
  ['openai/gpt-5', 'OpenAI', '400K', 1.25, 10, 88, 'reasoning vision code tools'],
  ['anthropic/claude-sonnet-4.5', 'Anthropic', '1M', 3, 15, 74, 'reasoning vision code tools'],
  ['google/gemini-2.5-flash', 'Google', '1M', 0.3, 2.5, 184, 'vision code tools'],
  ['x-ai/grok-code-fast-1', 'xAI', '256K', 0.2, 1.5, 190, 'reasoning code tools'],
  ['meta-llama/llama-4-maverick:free', 'Meta', '1M', 0, 0, 132, 'vision tools'],
  ['qwen/qwen3-coder:free', 'Qwen', '262K', 0, 0, 96, 'code tools'],
  ['google/gemini-2.5-pro', 'Google', '1M', 1.25, 10, 92, 'reasoning vision code tools'],
  ['openai/gpt-5-mini', 'OpenAI', '400K', 0.25, 2, 141, 'reasoning vision code tools'],
  ['moonshotai/kimi-k2:free', 'Moonshot', '128K', 0, 0, 48, 'code tools'],
  ['anthropic/claude-haiku-4.5', 'Anthropic', '200K', 1, 5, 152, 'vision code tools'],
  ['openai/gpt-oss-120b:free', 'OpenAI', '131K', 0, 0, 260, 'reasoning tools'],
  ['mistralai/mistral-medium-3.1', 'Mistral', '131K', 0.4, 2, 104, 'vision code tools'],
  ['z-ai/glm-4.6', 'Z.ai', '200K', 0.6, 2.2, 71, 'reasoning code tools'],
  ['deepseek/deepseek-r1', 'DeepSeek', '164K', 0.4, 1.75, 44, 'reasoning'],
  ['google/gemma-3-27b:free', 'Google', '128K', 0, 0, 118, 'vision'],
  ['x-ai/grok-4', 'xAI', '256K', 3, 15, 58, 'reasoning vision tools'],
  ['qwen/qwen3-235b-a22b:free', 'Qwen', '131K', 0, 0, 77, 'reasoning tools'],
  ['mistralai/mistral-small-3.2:free', 'Mistral', '128K', 0, 0, 166, 'vision tools'],
  ['cohere/command-a', 'Cohere', '256K', 2.5, 10, 81, 'tools'],
  ['meta-llama/llama-4-scout', 'Meta', '328K', 0.08, 0.3, 214, 'vision tools'],
  ['moonshotai/kimi-k2-thinking', 'Moonshot', '262K', 0.6, 2.5, 39, 'reasoning code tools'],
  ['z-ai/glm-4.5-air:free', 'Z.ai', '128K', 0, 0, 102, 'reasoning code tools'],
  ['nvidia/nemotron-nano-9b-v2:free', 'NVIDIA', '128K', 0, 0, 228, 'reasoning'],
  ['qwen/qwen3-max', 'Qwen', '256K', 1.2, 6, 66, 'reasoning code tools'],
  ['perplexity/sonar-pro', 'Perplexity', '200K', 3, 15, 70, 'tools'],
  ['ai21/jamba-large-1.7', 'AI21', '256K', 2, 8, 63, 'tools'],
  ['nousresearch/hermes-4-70b', 'Nous', '131K', 0.11, 0.38, 98, 'reasoning tools'],
].map(([id, provider, ctx, inp, out, tps, caps], usage) => ({ id, provider, ctx, inp, out, tps, caps: caps.split(' '), free: id.endsWith(':free'), usage }));

const PAGE = 10;
const price = (v, free) => (free ? '<span class="tag tag--free">free</span>' : `$${v.toFixed(2)}`);

export function init() {
  const root = document.querySelector('[data-explorer]');
  if (!root) return;
  const body = root.querySelector('[data-rows]');
  const input = root.querySelector('[data-search]');
  const chips = [...root.querySelectorAll('[data-filter]')];
  const sorts = [...root.querySelectorAll('[data-sort]')];
  const count = root.querySelector('[data-count-label]');
  let filter = 'all'; let q = ''; let sort = null; let dir = 1; let limit = PAGE;

  // counts on the chips
  const tally = { all: M.length, free: M.filter((m) => m.free).length, reasoning: 0, vision: 0, code: 0 };
  for (const m of M) for (const c of m.caps) if (c in tally) tally[c]++;
  chips.forEach((c) => { c.insertAdjacentHTML('beforeend', `<span class="n">${tally[c.dataset.filter]}</span>`); });

  const match = (m) => (filter === 'all' || (filter === 'free' ? m.free : m.caps.includes(filter))) &&
    (!q || `${m.id} ${m.provider}`.toLowerCase().includes(q));

  function rowHTML(m) {
    const on = Math.max(1, Math.min(8, Math.round(m.tps / 32)));
    const cells = Array.from({ length: 8 }, (_, k) => `<i class="${k < on ? 'on' : ''}" style="--c:${PALETTE[Math.min(3, k >> 1)]}"></i>`).join('');
    const caps = m.caps.filter((c) => c !== 'tools').map((c) => `<span class="cap">${c}</span>`).join('');
    const id = m.free ? `${m.id.replace(':free', '')}<span class="free">:free</span>` : m.id;
    return `<div class="row" role="row" tabindex="0" data-id="${m.id}" aria-label="${m.id}, ${m.provider}. Press Enter to copy the id.">` +
      `<span role="cell"><b>${id}</b><small>${m.provider}${caps}</small></span>` +
      `<span role="cell" class="num">${m.ctx}</span>` +
      `<span role="cell" class="num">${price(m.inp, m.free)}</span>` +
      `<span role="cell" class="num">${price(m.out, m.free)}</span>` +
      `<span role="cell" class="speed"><span class="speed__cells" aria-hidden="true">${cells}</span><span class="num">${m.tps} t/s</span></span></div>`;
  }

  function render(animate = true) {
    let list = M.filter(match);
    if (sort) list = [...list].sort((a, b) => (a[sort] - b[sort]) * dir);
    const total = list.length; const shown = list.slice(0, limit);
    body.innerHTML = shown.length ? shown.map(rowHTML).join('') :
      `<div class="table__empty" role="row"><span role="cell">No model matches <b>“${q.replace(/</g, '&lt;')}”</b>. Try a provider, like <b>google</b>.</span></div>`;
    if (total > shown.length) {
      body.insertAdjacentHTML('beforeend', `<div class="row row--more" role="row"><span role="cell"><button type="button" class="btn btn--line btn--sm" data-more>Show ${Math.min(PAGE, total - shown.length)} more</button></span></div>`);
    }
    count.textContent = `${shown.length} of ${total} listed · 253 routable`;
    if (animate && !calm && gsap) gsap.from(body.querySelectorAll('.row'), { opacity: 0, x: -8, duration: 0.45, stagger: 0.025, ease: 'power2.out', clearProps: 'all' });
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    filter = c.dataset.filter; limit = PAGE;
    chips.forEach((x) => x.setAttribute('aria-pressed', x === c));
    render();
  }));
  let timer = 0;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { q = input.value.trim().toLowerCase(); limit = PAGE; render(); }, 90); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { input.value = ''; q = ''; render(); } });
  sorts.forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const key = { in: 'inp', out: 'out', tps: 'tps' }[b.dataset.sort];
      if (sort === key) dir = -dir; else { sort = key; dir = key === 'tps' ? -1 : 1; }
      sorts.forEach((x) => { const on = x === b; x.setAttribute('aria-pressed', on); if (on) x.dataset.dir = dir > 0 ? 'asc' : 'desc'; else delete x.dataset.dir; });
      render();
    });
  });

  // copy a row's id (click, or Enter / Space on a focused row); "show more"
  const copyRow = async (row) => {
    const ok = await copyText(row.dataset.id);
    row.classList.remove('is-flash'); void row.offsetWidth; row.classList.add('is-flash');
    toast(ok ? `Copied ${row.dataset.id}` : 'Copy failed');
  };
  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) { limit += PAGE; render(false); return; }
    const row = e.target.closest('.row[data-id]'); if (row) copyRow(row);
  });
  body.addEventListener('keydown', (e) => {
    const row = e.target.closest('.row[data-id]'); if (!row) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyRow(row); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...body.querySelectorAll('.row[data-id]')]; const i = rows.indexOf(row);
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    }
  });

  // "/" jumps to the search, from anywhere that is not already a field
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    input.focus({ preventScroll: true });
    const r = root.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * 0.6) scrollToTarget(root, { offset: -120 });
  });

  render(false);
}
