// Home #integrations: the on-ramps. Redraws the roads to the diagram's real width (the markup carries a drawing for
// 1292 px that stretches without scripts), draws them in once when the diagram is first seen, and lights the ramp of
// whichever app is pointed at or focused: its ramp in its stage colour, a white dash running along it into the strip,
// its lane glowing, what it brings arriving at the lane's end, and the caption saying so. Nothing runs on its own:
// no idle pulse, nothing off screen. Under reduced motion the lighting still follows the pointer and focus, at rest.
import { $, $$ } from '../core.js';

// the geometry, in px (the generated partial and the CSS use the same numbers)
const TOP = 20, STEP = 38, BOX = 44, COLX = 196, STOP_W = 180, X1 = 400, SP = 30;
const H = TOP * 2 + 11 * STEP + BOX;
const HC = TOP + BOX / 2 + 5.5 * STEP;
const STAGES = ['spark', 'shape', 'make', 'review', 'launch', 'afterglow'];
const laneY = (i) => HC + (i - 2.5) * SP;
const stopY = (k) => TOP + BOX / 2 + k * STEP;
const startX0 = (k) => (k % 2) * COLX + STOP_W + 8;   // before the labels are measured
const stripX = (w) => Math.round(Math.min(Math.max(w * 0.58, X1 + 240), w - 260));
const r1 = (n) => Math.round(n * 10) / 10;

export default function init({ calm, still }) {
  const ramp = $('#integrations .ramp');
  if (!ramp) return;
  const svg = $('.ramp__roads', ramp);
  const apps = $$('.ramp__app', ramp);
  const ramps = $$('.ramp__ramps path', svg);
  const lanes = $$('.ramp__lanes path', svg);
  const glows = $$('.ramp__glows rect', svg);
  const nodes = $$('.ramp__nodes circle', svg);
  const keys = $$('.ramp__key li', ramp);
  const [dashGlow, dash] = $$('.ramp__dash', svg);
  const arrival = $('.ramp__arrival', ramp);
  const caption = $('.ramp__caption', ramp);
  const moving = !calm && !still;
  const laneOf = (k) => STAGES.indexOf(apps[k].closest('[data-stage]').dataset.stage);
  // each ramp leaves just after its app's name, like a leader line
  const starts = apps.map((a, k) => startX0(k));
  const measure = () => apps.forEach((a, k) => {
    const t = a.querySelector('.ramp__text');
    starts[k] = Math.round(a.parentElement.offsetLeft + a.offsetLeft + t.offsetLeft + t.offsetWidth + 14);
  });

  // ---- the roads, at the real width ----
  let W = 0, XS = 0;
  const drawn = () => getComputedStyle(svg).display !== 'none';
  const rampD = (k) => {
    const y = stopY(k), ly = laneY(laneOf(k)), m = (X1 + XS) / 2;
    return `M${starts[k]} ${y}H${X1}C${r1(m)} ${y} ${r1(m)} ${ly} ${XS} ${ly}`;
  };
  function layout(force) {
    if (!drawn()) return;
    const w = Math.round(ramp.clientWidth);
    if (w === W && !force) return;
    W = w; XS = stripX(W);
    measure();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ramp.style.setProperty('--xs', `${XS}px`);
    ramps.forEach((p, k) => p.setAttribute('d', rampD(k)));
    // the lanes stop just short of the edge, so a lit lane's glow never peeks out past its label
    lanes.forEach((p, i) => p.setAttribute('d', `M${XS} ${laneY(i)}H${W - 6}`));
    glows.forEach((r) => { r.setAttribute('x', XS); r.setAttribute('width', W - XS); });
    nodes.forEach((c) => c.setAttribute('cx', XS));
  }
  layout();
  new ResizeObserver(() => layout()).observe(ramp);
  document.fonts?.ready.then(() => layout(true));

  // ---- lighting a ramp ----
  let on = apps.findIndex((a) => a.classList.contains('is-on'));
  let runs = [];
  function run(k) {
    if (!moving || !drawn()) return;
    for (const a of runs) a.cancel();
    const d = `${rampD(k)}H${W - 6}`;
    dash.setAttribute('d', d); dashGlow.setAttribute('d', d);
    const len = dash.getTotalLength();
    const seg = 90;
    runs = [dash, dashGlow].map((p) => {
      p.style.strokeDasharray = `${seg} ${len + seg}`;
      p.style.opacity = '1';
      const a = p.animate([{ strokeDashoffset: seg }, { strokeDashoffset: -len }], { duration: 900 + len * 0.15, easing: 'cubic-bezier(0.55, 0, 0.3, 1)', fill: 'forwards' });
      a.onfinish = () => { p.style.opacity = '0'; };
      return a;
    });
  }
  function light(k, { dashed = true } = {}) {
    if (k < 0) return;
    const fresh = k !== on;
    const lane = laneOf(k);
    on = k;
    apps.forEach((a, i) => a.classList.toggle('is-on', i === k));
    ramps.forEach((p, i) => p.classList.toggle('is-on', i === k));
    for (const set of [lanes, glows, nodes, keys]) set.forEach((el, i) => el.classList.toggle('is-on', i === lane));
    if (dashed) run(k);
    if (!fresh) return;
    const a = apps[k];
    const stage = STAGES[lane];
    if (arrival) {
      arrival.dataset.stage = stage;
      arrival.style.setProperty('--ly', laneY(lane));
      arrival.firstElementChild.textContent = a.dataset.lands;
      if (moving) { arrival.classList.remove('is-new'); void arrival.offsetWidth; arrival.classList.add('is-new'); }
    }
    if (caption) {
      caption.querySelector('.ramp__caption-app').textContent = a.querySelector('.ramp__name').textContent;
      const ln = caption.querySelector('.ramp__caption-lane');
      ln.dataset.stage = stage;
      ln.textContent = `${a.dataset.lane} lane`;
      const says = a.dataset.says;
      caption.querySelector('.ramp__caption-says').textContent = `${says[0].toUpperCase()}${says.slice(1)}.`;
    }
  }
  apps.forEach((a, k) => {
    a.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') light(k); });
    a.addEventListener('focus', () => light(k));
  });

  // ---- the first look: the roads draw in from the apps, the lanes after them, then the lit one runs ----
  if (!moving) return;
  const draw = (p, delay, dur) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len} ${len}`;
    p.style.strokeDashoffset = `${len}`;
    return { p, len, delay, dur };
  };
  if (!drawn()) return;
  const plan = [
    ...ramps.map((p, k) => draw(p, k * 45, 1100)),
    ...lanes.map((p, i) => draw(p, 650 + i * 50, 1000)),
  ];
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    for (const { p, len, delay, dur } of plan) {
      const a = p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
      a.onfinish = () => { a.cancel(); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; };
    }
    setTimeout(() => run(on), 1500);
  }, { threshold: 0.4 });
  io.observe(ramp);
}
