// Security across every layer: an accordion that walks itself through the four layers while it is on screen (a line
// under the open one fills as it waits), and two live cards that turn over to show each layer's numbers. The garden
// behind them moves its camera to match (scenes.js listens for "layer").

import { calm, gsap, emit, whenVisible, loop, fmt } from './core.js';
import * as V from './viz.js';

const LAYERS = [
  {
    a: { tone: 'green', title: 'Firewall Protection', big: 1284, bigLabel: 'Blocked Requests', row1: 'Login Attempts', row1v: '36', chip: 'Secured', gauge: 0.74 },
    b: { tone: 'purple', title: 'Network Security', row1: 'Connected Devices', row1v: '24', row2: 'Threats Blocked', row2v: '128', seed: 3 },
  },
  {
    a: { tone: 'blue', title: 'Cloud Posture', big: 96, bigSuffix: '/100', bigLabel: 'Posture Score', row1: 'Misconfigurations', row1v: '3', chip: 'Auto-fixed', gauge: 0.96 },
    b: { tone: 'teal', title: 'Workloads', row1: 'Protected Instances', row1v: '342', row2: 'Regions', row2v: '12', seed: 8 },
  },
  {
    a: { tone: 'purple', title: 'Anomaly Engine', big: 4.2, bigDec: 1, bigSuffix: 'M', bigLabel: 'Signals Analysed', row1: 'Model Accuracy', row1v: '99.2%', chip: 'Learning', gauge: 0.88 },
    b: { tone: 'red', title: 'Threat Forecast', row1: 'Predicted Attacks', row1v: '57', row2: 'Prevented', row2v: '54', seed: 14 },
  },
  {
    a: { tone: 'amber', title: 'Encryption', big: 100, bigSuffix: '%', bigLabel: 'Data Encrypted', row1: 'Keys Rotated', row1v: '2,048', chip: 'AES-256', gauge: 1 },
    b: { tone: 'green', title: 'Backups', row1: 'Restore Points', row1v: '48', row2: 'Last Backup', row2v: '02:45', seed: 21 },
  },
];
const TONES = ['green', 'purple', 'blue', 'teal', 'red', 'amber'];
const DWELL = 6.5; // seconds on each layer

export function init() {
  const root = document.querySelector('[data-acc]');
  const stage = document.querySelector('[data-layers-stage]');
  if (!root || !stage) return;
  const items = [...root.querySelectorAll('.acc__item')];
  const cards = { a: stage.querySelector('[data-card="a"]'), b: stage.querySelector('[data-card="b"]') };
  const g = V.gauge(cards.a.querySelector('[data-gauge]'));
  const sp = V.spark(cards.b.querySelector('[data-spark]'), { seed: 3 });
  g.set(LAYERS[0].a.gauge);

  let current = 0; let wait = 0; let paused = false; let visible = false; let swapping = false;
  let big = LAYERS[0].a.big;

  const fill = (card, data) => {
    for (const f of card.querySelectorAll('[data-f]')) {
      const k = f.dataset.f;
      if (k === 'big') f.textContent = `${fmt(data.big, data.bigDec || 0)}${data.bigSuffix || ''}`;
      else if (k === 'chip' && f.hasAttribute('data-clock') && !data.chip) f.textContent = f.textContent;
      else if (data[k] != null) f.textContent = data[k];
    }
    card.classList.remove(...TONES.map((t) => `widget--${t}`));
    card.classList.add(`widget--${data.tone}`);
  };

  function open(i) {
    if (i === current) { wait = 0; return; }
    const prev = current; current = i; wait = 0;
    items.forEach((it, k) => {
      const on = k === i;
      const btn = it.querySelector('.acc__btn'); const panel = it.querySelector('.acc__panel');
      btn.setAttribute('aria-expanded', String(on));
      it.classList.toggle('is-open', on);
      const bar = it.querySelector('.acc__bar'); bar.style.transform = 'scaleX(0)';
      if (on) {
        panel.hidden = false;
        if (!calm && panel.animate) panel.animate([{ height: '0px', opacity: 0 }, { height: `${panel.scrollHeight}px`, opacity: 1 }], { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      } else if (!panel.hidden) {
        if (!calm && panel.animate) {
          const a = panel.animate([{ height: `${panel.offsetHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
          a.onfinish = () => { if (!it.classList.contains('is-open')) panel.hidden = true; };
        } else panel.hidden = true;
      }
    });
    if (prev !== i) swap(i);
    emit('layer', { index: i });
  }

  function swap(i) {
    const d = LAYERS[i];
    if (calm || !gsap) { fill(cards.a, d.a); fill(cards.b, d.b); g.set(d.a.gauge); sp.reseed(d.b.seed); big = d.a.big; return; }
    swapping = true;
    const tl = gsap.timeline({ onComplete: () => { swapping = false; } });
    tl.to([cards.a, cards.b], { rotateY: -70, opacity: 0, y: 14, duration: 0.42, ease: 'power2.in', stagger: 0.08 })
      .add(() => { fill(cards.a, d.a); fill(cards.b, d.b); g.set(d.a.gauge); sp.reseed(d.b.seed); big = d.a.big; })
      .fromTo([cards.a, cards.b], { rotateY: 70, opacity: 0, y: 14 }, { rotateY: 0, opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 })
      .fromTo(cards.a.querySelector('[data-f="big"]'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.5');
  }

  items.forEach((it, i) => {
    const btn = it.querySelector('.acc__btn');
    btn.addEventListener('click', () => open(i));
    btn.addEventListener('keydown', (e) => {
      const k = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      items[(i + k + items.length) % items.length].querySelector('.acc__btn').focus();
    });
  });
  const section = root.closest('section');
  section.addEventListener('pointerenter', () => { paused = true; });
  section.addEventListener('pointerleave', () => { paused = false; });
  section.addEventListener('focusin', () => { paused = true; });
  section.addEventListener('focusout', () => { paused = false; });

  // the firewall keeps counting
  let tickAcc = 0;
  const run = loop((dt) => {
    g.tick(dt); sp.tick(dt);
    tickAcc += dt;
    if (tickAcc > 1.1 && current === 0 && !swapping) {
      tickAcc = 0; big += 1 + Math.floor(Math.random() * 3);
      cards.a.querySelector('[data-f="big"]').textContent = fmt(big);
    }
    if (!paused && visible) {
      wait += dt;
      items[current].querySelector('.acc__bar').style.transform = `scaleX(${Math.min(1, wait / DWELL).toFixed(4)})`;
      if (wait >= DWELL) open((current + 1) % items.length);
    }
  });
  if (calm) { g.tick(1); return; }
  whenVisible(stage, (v) => { visible = v; run.set(v); }, '0px');
}
