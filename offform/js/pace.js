// Two systems: the card you point at takes the room; each reads out its own live figure, a pace that wanders around
// 4'10" a kilometre, a step count that keeps climbing.
import { calm, fine, whenVisible } from './core.js';

export function init() {
  const s = document.getElementById('pace');
  if (!s) return;
  const cards = s.querySelector('.pace__cards');
  const every = s.querySelector('.pace__card--every');
  if (fine) {
    every.addEventListener('pointerenter', () => cards.classList.add('is-hover-every'));
    every.addEventListener('pointerleave', () => cards.classList.remove('is-hover-every'));
    every.addEventListener('focus', () => cards.classList.add('is-hover-every'));
    every.addEventListener('blur', () => cards.classList.remove('is-hover-every'));
  }

  const paceEl = s.querySelector('[data-pace]');
  const stepsEl = s.querySelector('[data-steps]');
  if (calm) return;
  let sec = 252, steps = 8214, visible = false;
  whenVisible(s, (v) => { visible = v; });
  setInterval(() => {
    if (!visible || document.hidden) return;
    sec = Math.max(238, Math.min(266, sec + Math.round((Math.random() - 0.5) * 4)));
    paceEl.textContent = `${Math.floor(sec / 60)}′${String(sec % 60).padStart(2, '0')}″`;
    steps += 1 + Math.round(Math.random() * 2);
    stepsEl.textContent = steps.toLocaleString('en-GB');
  }, 900);
}
