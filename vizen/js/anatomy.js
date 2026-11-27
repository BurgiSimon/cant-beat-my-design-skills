// The anatomy: while the section is pinned the stage turns the helmet to each part in order (stage.js); here the
// part being read lights up, and a leader line runs from its letter to the very point on the helmet, with the hero's
// reticle at the end. The line is worked out from the 3D point every frame, so it stays on the part as it turns.

import { on, stageReady, scrollToTarget } from './core.js';

export async function init() {
  const sec = document.querySelector('.anatomy');
  const svg = document.querySelector('[data-leaders]');
  const items = [...document.querySelectorAll('.callout')];
  const bar = document.querySelector('[data-anatomy-bar]');
  if (!sec || !items.length) return;
  const stage = await stageReady;
  const anchors = items.map((li) => li.dataset.anchor.split(',').map(Number));
  let active = -1;

  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); svg?.append(e); return e; };
  const line = mk('path'); const tip = mk('path', 'tip'); const dot = mk('circle', 'dot'); const label = mk('text');
  dot.setAttribute('r', '2.2');

  function setActive(i) {
    if (i === active) return;
    active = i;
    items.forEach((li, k) => li.classList.toggle('is-on', k === i));
  }
  // a click on a part goes to its place in the scroll
  items.forEach((li, i) => li.addEventListener('click', () => {
    const len = sec.offsetHeight - innerHeight;
    scrollToTarget(sec.offsetTop + (i / (items.length - 1)) * len + 2);
  }));

  on('anatomy:pose', ({ step, p }) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(step)));
    setActive(i);
    bar?.parentElement.style.setProperty('--p', String(p));
    bar?.style.setProperty('--p', String(p));
    if (!svg) return;
    const r = sec.querySelector('.anatomy__pin').getBoundingClientRect();
    const pinned = r.top <= 1 && r.bottom >= innerHeight - 1;
    const pt = stage.toScreen(anchors[i]);
    // how settled the turn is: the line shows only when the part has (nearly) come round
    const settle = 1 - Math.min(1, Math.abs(step - i) * 3);
    const show = pinned && pt && settle > 0.05;
    svg.style.opacity = show ? String(settle) : '0';
    if (!show) return;
    const x1 = pt.x - r.left, y1 = pt.y - r.top;
    const n = items[i].querySelector('.callout__n').getBoundingClientRect();
    const mobile = innerWidth <= 820 || innerWidth / innerHeight <= 1;
    const box = items[i].getBoundingClientRect();
    const x0 = mobile ? x1 : box.right + 14 - r.left, y0 = mobile ? box.top - 16 - r.top : n.top + n.height / 2 - r.top;
    const elbow = mobile ? [x1, y0] : [x0 + Math.max(24, (x1 - x0) * 0.35), y0];
    line.setAttribute('d', mobile ? `M${x1},${y0}V${y1 + 14}` : `M${x0},${y0}H${elbow[0]}L${x1 - 14},${y1}`);
    const s = 9, g = 4;
    tip.setAttribute('d', `M${x1 - s / 2},${y1 - s / 2}h${s}v${s}h${-s}Z M${x1 - s / 2 - g - 6},${y1}h6 M${x1 + s / 2 + g},${y1}h6 M${x1},${y1 - s / 2 - g - 6}v6 M${x1},${y1 + s / 2 + g}v6`);
    dot.setAttribute('cx', String(mobile ? x1 : x0)); dot.setAttribute('cy', String(y0));
    label.setAttribute('x', String(x1 + 14)); label.setAttribute('y', String(y1 - 12));
    label.textContent = `${items[i].querySelector('.callout__n').textContent} · ${['0.62 KG', '210°', 'CL −0.04', '40 H'][i]}`;
  });
}
