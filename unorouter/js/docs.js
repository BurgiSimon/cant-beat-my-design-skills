// The quickstart: three languages, one changed line. When it comes into view the old base URL is struck out and the
// new one types itself in, then a request runs by itself; after that, pick a model and run it again. The reply
// streams in token by token, and the meta line says where it was routed, how fast and what it cost.

import { calm, copyText, toast, whenVisible } from './core.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const S = (s) => `<span class="s">${esc(s)}</span>`;
const K = (s) => `<span class="k">${s}</span>`;
const SLOT = (m, q = '"') => `<span class="s m" data-model-slot>${q}${m}${q}</span>`;

const CODE = {
  py: (m) => `${K('from')} openai ${K('import')} OpenAI

client = OpenAI(
<span class="diff diff--out">    base_url=${S('"https://api.openai.com/v1"')},</span><span class="diff diff--in">    base_url=${S('"https://api.unorouter.ai/v1"')},</span>    api_key=${S('"uno-sk-…"')},
)

reply = client.chat.completions.create(
    model=${SLOT(m)},
    messages=[{${S('"role"')}: ${S('"user"')}, ${S('"content"')}: ${S('"Say hi in five words."')}}],
    stream=${K('True')},
)`,
  ts: (m) => `${K('import')} OpenAI ${K('from')} ${S('"openai"')};

${K('const')} client = ${K('new')} OpenAI({
<span class="diff diff--out">  baseURL: ${S('"https://api.openai.com/v1"')},</span><span class="diff diff--in">  baseURL: ${S('"https://api.unorouter.ai/v1"')},</span>  apiKey: process.env.UNOROUTER_API_KEY,
});

${K('const')} stream = ${K('await')} client.chat.completions.create({
  model: ${SLOT(m)},
  messages: [{ role: ${S('"user"')}, content: ${S('"Say hi in five words."')} }],
  stream: ${K('true')},
});`,
  sh: (m) => `<span class="diff diff--out">curl ${S('https://api.openai.com/v1/chat/completions')} \\</span><span class="diff diff--in">curl ${S('https://api.unorouter.ai/v1/chat/completions')} \\</span>  -H ${S('"Authorization: Bearer $UNOROUTER_API_KEY"')} \\
  -H ${S('"Content-Type: application/json"')} \\
  -d ${S("'{")}
    ${S('"model":')} ${SLOT(m)},
    ${S('"messages": [{"role": "user", "content": "Say hi in five words."}],')}
    ${S('"stream": true')}
  ${S("}'")}`,
};
const CMD = { py: 'python hello.py', ts: 'npx tsx hello.ts', sh: 'sh hello.sh' };

const MODELS = {
  'deepseek/deepseek-v3.2:free': { reply: 'Hello there, nice to meet!', via: 'deepinfra', ttft: 214, tps: 61, cost: 0 },
  'openai/gpt-5': { reply: 'Hi! Great to meet you.', via: 'openai', ttft: 388, tps: 88, cost: 0.000094 },
  'google/gemini-2.5-flash': { reply: 'Hello! How can I help?', via: 'google-vertex', ttft: 172, tps: 184, cost: 0.000021 },
  'meta-llama/llama-4-maverick:free': { reply: 'Hey there, friend, welcome aboard!', via: 'groq', ttft: 96, tps: 412, cost: 0 },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function init() {
  const term = document.querySelector('[data-term]');
  if (!term) return;
  const code = term.querySelector('[data-code]');
  const panel = term.querySelector('#code-panel');
  const tabs = [...term.querySelectorAll('[role="tab"]')];
  const radios = [...term.querySelectorAll('[role="radio"]')];
  const runBtn = term.querySelector('[data-run]');
  const outCmd = term.querySelector('[data-out-cmd]');
  const outReply = term.querySelector('[data-out-reply]');
  const outMeta = term.querySelector('[data-out-meta]');
  const steps = [...document.querySelectorAll('.steps__item')];
  let lang = 'py'; let model = 'deepseek/deepseek-v3.2:free'; let busy = false; let shown = calm;

  const setStep = (n) => steps.forEach((s, i) => s.classList.toggle('is-on', i === n));
  const render = () => {
    code.innerHTML = CODE[lang](model);
    if (shown) code.querySelector('.diff--out')?.classList.add('is-striking');
    else code.querySelector('.diff--in')?.classList.add('is-pending');
    outCmd.textContent = CMD[lang];
  };

  // ---- tabs: arrow keys move between them (roving tabindex) ----
  const select = (tab, focus) => {
    tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tab.id);
    lang = tab.dataset.lang; render();
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
      e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  // ---- models: a radio group ----
  const pick = (r, focus) => {
    radios.forEach((x) => { const on = x === r; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
    model = r.dataset.model;
    const slot = code.querySelector('[data-model-slot]');
    if (slot) { slot.textContent = `"${model}"`; slot.classList.add('is-swap'); setTimeout(() => slot.classList.remove('is-swap'), 500); }
    if (focus) r.focus();
  };
  radios.forEach((r, i) => {
    r.addEventListener('click', () => pick(r));
    r.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
      e.preventDefault(); pick(radios[(i + d + radios.length) % radios.length], true);
    });
  });

  // ---- copy: the code as it should be pasted (the new line only) ----
  term.querySelector('[data-copy-code]')?.addEventListener('click', async () => {
    const tmp = document.createElement('div'); tmp.innerHTML = CODE[lang](model);
    tmp.querySelector('.diff--out')?.remove();
    const ok = await copyText(tmp.textContent.replace(/\n(?=\s*\n)/g, '\n'));
    toast(ok ? 'Copied to clipboard' : 'Copy failed: select the code instead');
  });

  // ---- run: a streamed reply ----
  async function run() {
    if (busy) return; busy = true; runBtn.setAttribute('aria-busy', 'true'); setStep(2);
    const live = outReply.parentElement; live.setAttribute('aria-busy', 'true'); // announce the reply once, whole
    const m = MODELS[model]; const free = model.endsWith(':free');
    outReply.innerHTML = '<span class="term__muted">routing…</span>'; outMeta.innerHTML = '';
    await wait(calm ? 0 : m.ttft + 120);
    outReply.textContent = '';
    const cur = document.createElement('span'); cur.className = 'cur';
    const words = m.reply.split(/(?<= )/);
    let n = 0;
    for (const w of words) {
      outReply.textContent += w; outReply.append(cur); n++;
      if (!calm) await wait(Math.max(28, 1000 / m.tps * 4 + Math.random() * 60));
    }
    cur.remove();
    const tokens = n + 3;
    outMeta.innerHTML = `<span class="ok">200 OK</span><span>routed → <b>${m.via}</b></span><span>ttft <b>${m.ttft}ms</b></span><span><b>${m.tps}</b> tok/s</span>` +
      `<span>${tokens} tokens</span><span class="${free ? 'free' : ''}">${free ? '$0.00 · free' : `$${m.cost.toFixed(6)}`}</span>`;
    busy = false; runBtn.removeAttribute('aria-busy'); live.removeAttribute('aria-busy');
  }
  runBtn?.addEventListener('click', run);
  term.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });

  render();
  // first time in view: strike the old line, type the new one, then run once by itself
  let played = false;
  whenVisible(term, async (v) => {
    if (!v || played) return; played = true;
    if (calm) return;
    await wait(500); setStep(1);
    const line = code.querySelector('.diff--in'); const out = code.querySelector('.diff--out');
    out?.classList.add('is-striking');
    await wait(450);
    shown = true; line?.classList.remove('is-pending'); line?.classList.add('is-typing');
    await wait(1300);
    if (!busy) run();
  }, '-20% 0px');
}
