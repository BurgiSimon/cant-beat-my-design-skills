// Rankings: the top ten by tokens served, as bars of cells in the four colours. The bars fill in steps as the board
// comes into view; switching the period moves rows to their new places (FLIP) and resizes the bars. Figures are
// illustrative.

import { calm, gsap, whenVisible } from './core.js';

// tokens (billions) and change versus the previous period, %
const DATA = {
  day: [
    ['x-ai/grok-code-fast-1', 'xAI', 182, 4], ['anthropic/claude-sonnet-4.5', 'Anthropic', 96, 2], ['deepseek/deepseek-v3.2:free', 'DeepSeek', 71, 18],
    ['google/gemini-2.5-flash', 'Google', 64, -3], ['openai/gpt-5', 'OpenAI', 47, 6], ['qwen/qwen3-coder:free', 'Qwen', 39, 22],
    ['openai/gpt-oss-120b:free', 'OpenAI', 31, 9], ['google/gemini-2.5-pro', 'Google', 28, -6], ['z-ai/glm-4.6', 'Z.ai', 22, 31], ['moonshotai/kimi-k2:free', 'Moonshot', 17, -8],
  ],
  week: [
    ['x-ai/grok-code-fast-1', 'xAI', 1210, 7], ['anthropic/claude-sonnet-4.5', 'Anthropic', 640, -2], ['google/gemini-2.5-flash', 'Google', 412, 5],
    ['deepseek/deepseek-v3.2:free', 'DeepSeek', 380, 41], ['openai/gpt-5', 'OpenAI', 301, 3], ['google/gemini-2.5-pro', 'Google', 214, -4],
    ['qwen/qwen3-coder:free', 'Qwen', 198, 27], ['openai/gpt-oss-120b:free', 'OpenAI', 156, 12], ['moonshotai/kimi-k2:free', 'Moonshot', 121, -11], ['z-ai/glm-4.6', 'Z.ai', 104, 19],
  ],
  month: [
    ['anthropic/claude-sonnet-4.5', 'Anthropic', 4820, 9], ['x-ai/grok-code-fast-1', 'xAI', 4410, 64], ['google/gemini-2.5-flash', 'Google', 1930, 2],
    ['openai/gpt-5', 'OpenAI', 1460, 14], ['deepseek/deepseek-v3.2:free', 'DeepSeek', 1290, 120], ['google/gemini-2.5-pro', 'Google', 1020, -7],
    ['moonshotai/kimi-k2:free', 'Moonshot', 702, -15], ['qwen/qwen3-coder:free', 'Qwen', 655, 48], ['openai/gpt-4.1-mini', 'OpenAI', 512, -21], ['openai/gpt-oss-120b:free', 'OpenAI', 498, 37],
  ],
};
const fmt = (b) => (b >= 1000 ? `${(b / 1000).toFixed(2)}T` : `${b}B`);

export function init() {
  const board = document.querySelector('[data-board]');
  const seg = document.querySelector('[data-period]');
  if (!board || !seg) return;
  const radios = [...seg.querySelectorAll('[role="radio"]')];
  let period = 'week'; let grown = calm;
  const rows = new Map(); // id → li

  function row(id) {
    if (rows.has(id)) return rows.get(id);
    const li = document.createElement('li'); li.className = 'board__row';
    li.innerHTML = '<span class="board__rank"></span><span class="board__name"><b></b><small></small></span><span class="board__bar"><i></i></span><span class="board__val"></span><span class="board__delta"></span>';
    rows.set(id, li); return li;
  }

  function render(animate) {
    const list = DATA[period]; const max = list[0][2];
    const first = new Map([...rows.values()].map((li) => [li, li.getBoundingClientRect().top]));
    const keep = new Set();
    list.forEach(([id, provider, v, d], k) => {
      const li = row(id); keep.add(li);
      li.querySelector('.board__rank').textContent = String(k + 1).padStart(2, '0');
      li.querySelector('b').textContent = id; li.querySelector('small').textContent = provider;
      li.querySelector('.board__val').textContent = fmt(v);
      const delta = li.querySelector('.board__delta');
      delta.textContent = `${d > 0 ? '+' : ''}${d}%`; delta.className = `board__delta ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`;
      li.style.setProperty('--w', grown ? (v / max).toFixed(3) : 0);
      li.dataset.w = (v / max).toFixed(3);
      li.setAttribute('aria-label', `${k + 1}. ${id}, ${fmt(v)} tokens, ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} percent`);
      board.append(li);
    });
    for (const [id, li] of rows) if (!keep.has(li)) { li.remove(); rows.delete(id); }
    // FLIP: from where each row was to where it is now
    if (animate && !calm && gsap) {
      for (const li of keep) {
        const was = first.get(li);
        if (was === undefined) { gsap.from(li, { opacity: 0, x: -10, duration: 0.5 }); continue; }
        const dy = was - li.getBoundingClientRect().top;
        if (dy) gsap.fromTo(li, { y: dy }, { y: 0, duration: 0.7, ease: 'power3.inOut' });
      }
    }
    track();
  }
  // the colours run along the whole track, so a longer bar shows more of them
  function track() {
    const bar = board.querySelector('.board__bar');
    if (bar) board.style.setProperty('--track', `${bar.clientWidth}px`);
  }
  addEventListener('resize', track);

  radios.forEach((r, i) => {
    const pick = (focus) => {
      radios.forEach((x) => { const on = x === r; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
      period = r.dataset.p; render(true);
      if (focus) r.focus();
    };
    r.addEventListener('click', () => pick(false));
    r.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
      e.preventDefault(); radios[(i + d + radios.length) % radios.length].click(); radios[(i + d + radios.length) % radios.length].focus();
    });
  });

  board.innerHTML = '';
  render(false);
  whenVisible(board, (v) => {
    if (!v || grown) return;
    grown = true;
    [...rows.values()].forEach((li, k) => setTimeout(() => li.style.setProperty('--w', li.dataset.w), 120 + k * 70));
  }, '-15% 0px');
}
