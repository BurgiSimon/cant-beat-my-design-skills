// The Vault: every paint on the one shell. Each card is rendered by the stage; pointing across a card turns the
// helmet (frames are drawn as they are first needed, one per frame, and kept), letting go turns it back. A card
// puts its paint on the rider in the hero.

import { on, emit, fine, calm, stageReady, whenVisible } from './core.js';

const BASE = -30;
export async function init() {
  const cards = [...document.querySelectorAll('.card')];
  if (!cards.length) return;
  const stage = await stageReady;
  if (!stage?.rider) return;

  for (const card of cards) {
    const paint = card.dataset.card;
    const cv = card.querySelector('canvas');
    const g = cv.getContext('2d');
    if (card.classList.contains('card--archive')) { const t = document.createElement('span'); t.className = 'card__tag'; t.textContent = 'Archive'; card.querySelector('.card__btn').append(t); }
    let angle = BASE, want = BASE, raf = 0, drawn = null;
    const draw = (a) => {
      const q = Math.round(a / 10) * 10;
      if (q === drawn) return true;
      const still = stage.helmetStill(paint, 480, 440, { az: q, el: 10, fill: 0.7, ss: 1 });
      if (!still) return false;
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(still, 0, 0); drawn = q;
      return true;
    };
    // one new frame per animation frame, toward where the pointer wants it
    const loop = () => {
      raf = 0;
      const step = Math.sign(want - angle) * Math.min(10, Math.abs(want - angle));
      angle += step;
      draw(angle);
      if (Math.abs(want - angle) > 0.5) raf = requestAnimationFrame(loop);
    };
    const go = (a) => { want = a; if (!raf) raf = requestAnimationFrame(loop); };
    let shown = false;
    whenVisible(card, (v) => { if (v && !shown) { shown = true; setTimeout(() => draw(BASE), 30 * cards.indexOf(card)); } }, '200px');
    const btn = card.querySelector('.card__btn');
    if (fine && !calm) {
      btn.addEventListener('pointermove', (e) => { const r = btn.getBoundingClientRect(); go(BASE + ((e.clientX - r.left) / r.width - 0.5) * 160); });
      btn.addEventListener('pointerleave', () => go(BASE));
    }
    btn.addEventListener('click', () => emit('pick', paint));
  }
  on('paint', (p) => cards.forEach((c) => c.classList.toggle('is-chosen', c.dataset.card === p)));
}
