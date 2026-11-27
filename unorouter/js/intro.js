// First visit: a short boot log on black, then it wipes away in steps. Then the hero assembles: the header, the prompt
// typing itself out, the headline decoding line by line, the rest stepping in, the figures counting up, and the mark
// building itself bar by bar. A repeat visit in this tab (or a deep link) skips the log and plays a shorter hero.

import { calm, gsap, root, lock, unlock, emit, markReady, ready } from './core.js';
import { decode } from './type.js';

const LOG = [
  ['<b>unorouter</b> v2.6.0 · edge fra1', 0],
  ['resolving providers ', 46, ' ok'],
  ['warming models ', 253, ' ok'],
  ['free tier ', 114, ' models'],
  ['p50 overhead ', 18, ' ms'],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const box = document.querySelector('.boot');
  const pre = box?.querySelector('.boot__log');
  if (!box || !pre || getComputedStyle(box).display === 'none') return;
  lock();
  const lines = [];
  for (const [label, n, tail] of LOG) {
    const line = document.createElement('div'); pre.append(line); lines.push(line);
    if (!n) { line.innerHTML = `<span class="acc">▲</span> ${label}`; await wait(90); continue; }
    const dots = '.'.repeat(Math.max(3, 30 - label.length));
    for (let k = 0; k <= 3; k++) {
      line.innerHTML = `<span class="acc">&gt;</span> ${label}${dots.slice(0, Math.round((dots.length * k) / 3))}`;
      await wait(12);
    }
    line.innerHTML = `<span class="acc">&gt;</span> ${label}${dots} <b>${n}</b><span class="ok">${tail}</span>`;
    await wait(40);
  }
  const done = document.createElement('div'); done.innerHTML = '<b>ready</b><span class="acc">_</span>'; pre.append(done);
  await wait(180);
  // wipe it away in eight hard steps, top down
  if (gsap) await gsap.to(box, { clipPath: 'inset(100% 0 0 0)', duration: 0.42, ease: 'steps(8)' });
  box.remove();
  unlock();
}

export async function init() {
  const hero = document.querySelector('.hero');
  if (!hero) return markReady();
  const title = hero.querySelector('.hero__title');
  const lines = [...title.querySelectorAll('.line')];
  title.setAttribute('aria-label', lines.map((l) => l.textContent).join(' '));
  lines.forEach((l) => l.setAttribute('aria-hidden', 'true'));

  if (calm || !gsap) { markReady(); emit('hero:art'); emit('hero:stats'); return; }
  const repeat = root.classList.contains('is-repeat');
  try { sessionStorage.setItem('unorouter:booted', '1'); } catch {}

  await ready;
  if (!repeat) await boot();

  const bar = document.querySelector('.nav__bar');
  const prompt = hero.querySelector('.hero__prompt');
  const rest = ['.hero__lede', '.hero__ctas', '.stats', '.hero__note'].map((s) => hero.querySelector(s));
  lines.forEach((l) => { l.dataset.text ??= l.textContent; l.textContent = ' '; });
  gsap.set([bar, prompt, ...rest], { opacity: 0 });
  gsap.set(rest, { y: 14 });
  markReady();

  const k = repeat ? 0.6 : 1;
  gsap.to(bar, { opacity: 1, duration: 0.5, ease: 'steps(5)' });
  // the prompt types itself: its words appear a character at a time and the caret rides along
  const words = [...prompt.childNodes].filter((n) => n.nodeType === 1 && !n.classList.contains('caret'));
  const texts = words.map((w) => w.textContent); words.forEach((w) => { w.textContent = ''; });
  gsap.set(prompt, { opacity: 1 });
  emit('hero:art');
  for (let w = 0; w < words.length; w++) {
    for (let c = 1; c <= texts[w].length; c++) { words[w].textContent = texts[w].slice(0, c); await wait(16 * k); }
  }
  // the headline decodes, a line at a time
  lines.forEach((l, i) => decode(l, { duration: 0.75 * k, delay: i * 0.16 * k, from: 'blank' }));
  await wait(260 * k);
  gsap.to(rest, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09 * k, ease: 'power3.out' });
  await wait(160 * k);
  emit('hero:stats');
}
