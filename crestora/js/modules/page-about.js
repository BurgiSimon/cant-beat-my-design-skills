// about.html: the road so far, and the crew's cards.
//
// The ribbon: six bands of four hairline lanes (the footer ribbon's cross-section, in stage order). It starts as one
// spark at 2021 and gains a band with each tool: Shape and Make merge in at 2022, Review at 2023, Launch at 2024 and
// Afterglow at 2025, each fanning out of the ribbon's lower edge like an on-ramp. It is drawn here in screen pixels
// (so hairlines stay hairlines) and redrawn on resize. On a desktop screen with motion allowed the section is held in
// place while the scroll draws it left to right, lighting each year as the front passes; otherwise it rests fully lit.
// Below 1024 px the CSS shows a vertical strip of lanes instead, and nothing here runs for it.
//
// The crew: a tap (or click) turns a card over and keeps it turned (aria-pressed); one card is turned at a time.
import { gsap, ScrollTrigger, clamp, $, $$ } from '../core.js';

const NS = 'http://www.w3.org/2000/svg';
const STAGES = ['spark', 'shape', 'make', 'review', 'launch', 'afterglow'];
const START_GATE = [0, 1, 1, 2, 3, 4];     // the milestone where each band joins the road
const LINES = 4;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export default function init({ calm }) {
  timeline(calm);
  crew();
}

function timeline(calm) {
  const section = $('[data-page="about"] .ab-time');
  const ribbon = section && $('.ab-ribbon', section);
  if (!section || !ribbon) return;
  const base = $('.ab-ribbon__base', ribbon);
  const lit = $('.ab-ribbon__lit', ribbon);
  const miles = $$('.ab-mile', section);
  const wide = matchMedia('(min-width: 1024px)');
  const tall = matchMedia('(min-height: 680px)');
  let drawnW = 0, drawnH = 0, trigger = null, tween = null;
  const state = { p: 1 };

  const draw = () => {
    if (!wide.matches) return;
    const r = ribbon.getBoundingClientRect();
    const W = Math.round(r.width), H = Math.round(r.height);
    if (!W || !H || (W === drawnW && H === drawnH)) return;
    drawnW = W; drawnH = H;
    const svg = ribbonMarkup(W, H);
    for (const el of [base, lit]) { el.setAttribute('viewBox', `0 0 ${W} ${H}`); el.innerHTML = svg; }
    ribbon.classList.add('is-drawn');
  };

  const apply = () => {
    const p = state.p;
    ribbon.style.setProperty('--p', p.toFixed(4));
    section.classList.toggle('is-drawing', p > 0.005 && p < 0.995);
    miles.forEach((m, i) => m.classList.toggle('is-lit', p >= i / 6 + 0.004));
  };

  const pin = () => {
    const on = !calm && gsap && ScrollTrigger && wide.matches && tall.matches;
    if (on && !trigger) {
      section.classList.add('ab-time--pin');
      state.p = 0.012;
      apply();
      // the road is fully drawn a little before the hold lets go, so 2026 has a moment in the light
      tween = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.8 } })
        .to(state, { p: 1, duration: 0.86, ease: 'none', onUpdate: apply })
        .to({}, { duration: 0.14 });
      trigger = tween.scrollTrigger;
      ScrollTrigger.refresh();
    } else if (!on && trigger) {
      tween.kill(); trigger.kill(); tween = trigger = null;
      section.classList.remove('ab-time--pin', 'is-drawing');
      state.p = 1;
      apply();
      ScrollTrigger?.refresh();
    }
  };

  draw();
  pin();
  if (!trigger) apply();
  let t = 0;
  new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 80); }).observe(ribbon);
  wide.addEventListener('change', () => { draw(); pin(); });
  tall.addEventListener('change', pin);
}

/** The ribbon's lanes, gates and merge points for a W × H box, as SVG markup. */
function ribbonMarkup(W, H) {
  const pitch = clamp(H * 0.019, 3, 4.6);                 // between two lanes
  const offset = (k, j) => pitch * (k * (LINES + 1) + j);  // a lane's depth below the ribbon's top edge
  const top = (x) => { const u = x / W; return H * (0.34 - 0.07 * u + 0.05 * Math.sin(u * Math.PI * 1.7 + 0.5)); };
  const gateX = (i) => (i * W) / 6;
  const ramp = W * 0.085;                                  // how far a merging band takes to find its own depth
  const step = 7;
  let lanes = '';
  const nodes = [];
  STAGES.forEach((stage, k) => {
    const g = START_GATE[k];
    const x0 = gateX(g);
    // a new band leaves the ribbon's lower edge as it stands at that gate (the first one leaves a single spark)
    // (bands that join at the same milestone fan out of the same point)
    const first = START_GATE.indexOf(g);
    const from = first === 0 ? 0 : offset(first - 1, LINES - 1) + pitch * 0.5;
    if (first === k) nodes.push([x0, top(x0) + from]);
    let band = '';
    for (let j = 0; j < LINES; j++) {
      const to = offset(k, j);
      let d = '';
      for (let x = x0; x <= W + step; x += step) {
        const xx = Math.min(x, W);
        const y = top(xx) + from + (to - from) * smooth((xx - x0) / ramp);
        d += `${d ? 'L' : 'M'}${xx.toFixed(1)} ${y.toFixed(1)}`;
        if (xx === W) break;
      }
      band += `<path d="${d}"/>`;
    }
    lanes += `<g style="stroke: var(--${stage})">${band}</g>`;
  });
  // 2026: the whole flow, a node at the middle of the full ribbon
  const x5 = gateX(5);
  nodes.push([x5, top(x5) + offset(5, LINES - 1) / 2]);
  let gates = '';
  for (let i = 0; i < 6; i++) { const x = Math.max(0.5, gateX(i) + 0.5); gates += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke-width="1" vector-effect="non-scaling-stroke"/>`; }
  const dots = nodes.map(([x, y]) => `<circle class="ab-ribbon__node" cx="${Math.max(3.5, x).toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`).join('');
  return `<g class="ab-ribbon__gates">${gates}</g><g class="ab-ribbon__lanes">${lanes}</g>${dots}`;
}

function crew() {
  const cards = $$('[data-page="about"] .ab-person__card');
  for (const card of cards) {
    card.addEventListener('click', () => {
      const on = card.getAttribute('aria-pressed') !== 'true';
      for (const c of cards) c.setAttribute('aria-pressed', String(c === card && on));
    });
  }
  // Escape turns a card back
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const c = cards.find((x) => x.getAttribute('aria-pressed') === 'true');
    if (c) c.setAttribute('aria-pressed', 'false');
  });
}
