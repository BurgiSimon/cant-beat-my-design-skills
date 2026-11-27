// The hero, alive: the glow, the phone screens (a chart whose cursor glides along the curve, a balance that grows
// as payments land), the floating figures (they drift, lean away from the pointer and tick like a market), the
// little lights that orbit on the rings, and what scrolling does to all of it.

import { gsap, ScrollTrigger, calm, fine, on, once, pointer, scroll, odometer, smoothPath, seeded, damp, whenVisible } from './core.js';
import { createHorizon } from './glow.js';

const FLOW = '(max-width: 760px), (orientation: portrait) and (max-width: 1100px)';

export function init() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const stage = hero.querySelector('.hero__stage');
  const flow = () => matchMedia(FLOW).matches;

  // ---------------------------------------------------------------- the glow
  // Design px → screen: in the scaled stage it is the stage itself; in the flowing layout the horizon is set
  // just under the top of the phones, wider than the screen.
  const map = () => {
    const hr = hero.getBoundingClientRect();
    if (!flow()) {
      const sr = stage.getBoundingClientRect();
      return { s: sr.width / 1440, ox: sr.left - hr.left, oy: sr.top - hr.top };
    }
    const pr = hero.querySelector('.phones').getBoundingClientRect();
    const s = hr.width / 820;
    return { s, ox: hr.width / 2 - 720 * s, oy: pr.top - hr.top + 70 - 720 * s };
  };
  let horizon = null;
  try { horizon = createHorizon(hero.querySelector('.hero__gl'), { map, host: hero }); } catch (e) { console.warn('[asterpay] no WebGL glow:', e.message); }
  window.__asterHorizon = horizon;

  // ---------------------------------------------------------------- left phone: the chart and its cursor
  const inv = hero.querySelector('.scr-invest');
  const INV = [[0, 150], [34, 184], [74, 226], [116, 260], [164, 278], [204, 272], [226, 240], [242, 180], [256, 122], [268, 82], [280, 56], [296, 46], [318, 38], [340, 28], [360, 18]];
  const invLine = smoothPath(INV, 0.42);
  for (const sel of ['.inv__line', '.inv__glow']) inv.querySelector(sel).setAttribute('d', invLine);
  inv.querySelector('.inv__area').setAttribute('d', `${invLine}L360,260L0,260Z`);
  const lineEl = inv.querySelector('.inv__line');
  const dot = inv.querySelector('.inv__dot'); const drop = inv.querySelector('.inv__drop');
  // y on the curve at a given x, from a table
  const table = [];
  const len = lineEl.getTotalLength();
  for (let i = 0; i <= 240; i++) { const p = lineEl.getPointAtLength((len * i) / 240); table.push([p.x, p.y]); }
  const yAt = (x) => {
    for (let i = 1; i < table.length; i++) if (table[i][0] >= x) { const [x0, y0] = table[i - 1]; const [x1, y1] = table[i]; return y0 + ((y1 - y0) * (x - x0)) / Math.max(0.001, x1 - x0); }
    return table[table.length - 1][1];
  };
  const priceEl = inv.querySelector('.inv__price');
  priceEl.replaceChildren(document.createElement('span'));
  const invOdo = odometer(priceEl.firstChild, { value: 18450, prefix: '$', decimals: 2, dimDecimals: true });
  const cursor = { x: 275 };
  const placeCursor = () => {
    const y = yAt(cursor.x);
    dot.setAttribute('cx', cursor.x); dot.setAttribute('cy', y);
    drop.setAttribute('x1', cursor.x); drop.setAttribute('x2', cursor.x); drop.setAttribute('y1', y + 9);
  };
  placeCursor();
  const valueAt = (x) => 18450 + (56 - yAt(x)) * 9.37 + (x - 280) * 0.31;

  // ---------------------------------------------------------------- right phone: the balance and its line
  const wal = hero.querySelector('.scr-wallet');
  const WAL = [[0, 52], [32, 50], [64, 55], [96, 60], [130, 63], [164, 64], [198, 62], [230, 58], [262, 52], [292, 42], [314, 32], [330, 26]];
  const walLine = wal.querySelector('.wal__line'); const walArea = wal.querySelector('.wal__area'); const walDot = wal.querySelector('.wal__dot');
  const drawWallet = () => {
    const d = smoothPath(WAL, 0.45);
    walLine.setAttribute('d', d); walArea.setAttribute('d', `${d}L330,96L0,96Z`);
    const [lx, ly] = WAL[WAL.length - 1]; walDot.setAttribute('cx', lx); walDot.setAttribute('cy', ly);
  };
  drawWallet();
  const balEl = wal.querySelector('.wal__balance');
  balEl.replaceChildren(document.createElement('span'));
  let balance = 84250.8;
  const balOdo = odometer(balEl.firstChild, { value: balance, prefix: '$', decimals: 2, dimDecimals: true });

  // ---------------------------------------------------------------- the floating figures
  const ticks = [...hero.querySelectorAll('.tick')].map((el, i) => {
    const price = el.querySelector('.tick__price'); const chg = el.querySelector('.tick__chg');
    const t = {
      el, kind: el.dataset.tick, v: Number(el.dataset.price), c: Number(el.dataset.chg || 0), dec: Number(el.dataset.dec || 0),
      depth: Number(getComputedStyle(el).getPropertyValue('--d')) || 1, phase: i * 1.7, speed: 0.45 + (i % 3) * 0.12, px: 0, py: 0,
    };
    t.price = odometer(price, { value: t.v, prefix: '$', decimals: t.dec });
    if (chg) t.chg = odometer(chg, { value: t.c, suffix: '%', decimals: 1, signed: true });
    return t;
  });
  const rand = seeded(7);
  let flashTimer = 0;
  function marketTick() {
    const t = ticks[Math.floor(rand() * ticks.length)];
    if (!t) return;
    let delta;
    if (t.kind === 'stock') {
      delta = t.v * (rand() - 0.47) * 0.006; t.v += delta;
      t.c = Math.round((t.c + (delta / t.v) * 100 * 4) * 10) / 10;
      t.chg?.set(t.c);
    } else {
      delta = Math.round((5 + rand() * 60) * (t.el.querySelector('.tick__icon--minus') ? 1 : rand() < 0.8 ? 1 : -1));
      t.v += delta;
    }
    t.price.set(t.dec ? Math.round(t.v * 10) / 10 : Math.round(t.v));
    t.el.classList.remove('is-up', 'is-down');
    void t.el.offsetWidth;
    t.el.classList.add(delta >= 0 ? 'is-up' : 'is-down');
    clearTimeout(t.timer); t.timer = setTimeout(() => t.el.classList.remove('is-up', 'is-down'), 1300);
  }

  // ---------------------------------------------------------------- satellites on the rings
  const NS = 'http://www.w3.org/2000/svg';
  const satsG = hero.querySelector('.sats');
  const RINGS = [{ cx: 720, cy: 692, r: 501 }, { cx: 720, cy: 1061, r: 585 }];
  const sats = [
    { ring: 0, a: -2.1, w: 0.05 }, { ring: 0, a: -0.55, w: 0.035 }, { ring: 0, a: -1.35, w: -0.028 },
    { ring: 1, a: -1.2, w: 0.022 }, { ring: 1, a: -2.4, w: -0.03 },
  ].map((s) => {
    const g = document.createElementNS(NS, 'g');
    const trail = [...Array(7)].map((_, k) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', (1.5 - k * 0.15).toFixed(2)); c.setAttribute('fill', '#ffc9b5'); c.setAttribute('opacity', (0.5 - k * 0.07).toFixed(2)); g.append(c); return c; });
    const halo = document.createElementNS(NS, 'circle'); halo.setAttribute('r', '11'); halo.setAttribute('fill', 'url(#sat-glow)');
    const core = document.createElementNS(NS, 'circle'); core.setAttribute('r', '2'); core.setAttribute('fill', '#fff6f0');
    g.append(halo, core); satsG.append(g);
    return { ...s, g, trail, halo, core };
  });
  function placeSats(time) {
    for (const s of sats) {
      const R = RINGS[s.ring]; const a = s.a + s.w * time;
      // only on the upper part of a ring: below the horizon they fade out
      const pos = (ang) => [R.cx + R.r * Math.cos(ang), R.cy + R.r * Math.sin(ang)];
      const [x, y] = pos(a);
      const vis = Math.max(0, Math.min(1, (R.cy - y) / 120)) * Math.max(0, Math.min(1, (y - 150) / 80));
      s.g.setAttribute('opacity', vis.toFixed(3));
      s.halo.setAttribute('cx', x.toFixed(1)); s.halo.setAttribute('cy', y.toFixed(1));
      s.core.setAttribute('cx', x.toFixed(1)); s.core.setAttribute('cy', y.toFixed(1));
      s.trail.forEach((c, k) => { const [tx, ty] = pos(a - Math.sign(s.w || 1) * (k + 1) * 0.011); c.setAttribute('cx', tx.toFixed(1)); c.setAttribute('cy', ty.toFixed(1)); });
    }
  }
  placeSats(0);

  // ---------------------------------------------------------------- one loop for everything that drifts
  const phones = hero.querySelector('.phones');
  const par = { x: 0, y: 0 };
  let time = 0; let running = false; let inView = true;
  const u = () => (flow() ? 1 : stage.getBoundingClientRect().width / 1440);
  function loop(t, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    time += dt;
    const k = u();
    const want = pointer.active && fine ? [pointer.nx, pointer.ny] : [0, 0];
    par.x = damp(par.x, want[0], 2.4, dt); par.y = damp(par.y, want[1], 2.4, dt);
    for (const tk of ticks) {
      const bob = Math.sin(time * tk.speed + tk.phase) * 4 * k;
      const sway = Math.cos(time * tk.speed * 0.7 + tk.phase) * 2.5 * k;
      tk.el.style.translate = `${(sway - par.x * 16 * tk.depth * k).toFixed(2)}px ${(bob - par.y * 12 * tk.depth * k).toFixed(2)}px`;
    }
    phones.style.translate = `${(par.x * 10 * k).toFixed(2)}px ${(par.y * 6 * k).toFixed(2)}px`;
    placeSats(time);
  }
  const start = () => { if (!running && inView && !calm && gsap) { running = true; gsap.ticker.add(loop); } };
  const stop = () => { if (running) { running = false; gsap.ticker.remove(loop); } };
  whenVisible(hero, (v) => { inView = v; v ? start() : stop(); }, '0px');

  // the slower live things: a market tick, the chart cursor, a payment landing
  let timers = [];
  const every = (ms, fn) => { const id = setInterval(() => { if (inView && !document.hidden) fn(); }, ms); timers.push(id); };
  once('intro:done', () => {
    if (calm || !gsap) return;
    start();
    every(1700, marketTick);
    every(3100, () => {
      const to = 236 + rand() * 112;
      gsap.to(cursor, { x: to, duration: 1.3, ease: 'power2.inOut', onUpdate: placeCursor, onComplete: () => invOdo.set(Math.round(valueAt(to) * 100) / 100) });
    });
    every(5200, () => {
      const add = Math.round((12 + rand() * 180) * 100) / 100;
      balance += add; balOdo.set(balance);
      WAL.forEach((p, i) => { if (i > 7) p[1] = Math.max(8, p[1] - (i - 7) * 0.9); });
      const last = WAL[WAL.length - 1];
      gsap.fromTo(walDot, { attr: { r: 6.5 } }, { attr: { r: 10 }, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' });
      drawWallet(); void last;
    });
  });

  // ---------------------------------------------------------------- scroll: the copy lifts away, the phones rise
  if (gsap && ScrollTrigger) {
    const content = hero.querySelector('.hero__content');
    const L = hero.querySelector('.phone--l'); const R = hero.querySelector('.phone--r');
    gsap.set(L, { rotation: -12, rotationX: 18, transformOrigin: '50% 0' }); gsap.set(R, { rotation: 10, rotationX: 18, transformOrigin: '50% 0' });
    // only where the hero is one scaled picture (the matchMedia context undoes it when the layout changes), and
    // only once the intro has put the phones where they rest, so that is where scrolling starts them from
    once('intro:done', () => gsap.matchMedia().add('(min-width: 761px) and (orientation: landscape), (min-width: 1101px)', () => {
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .to(content, { y: () => -hero.offsetHeight * 0.32, opacity: 0, ease: 'power1.in' }, 0)
        .to(L, { y: () => -hero.offsetHeight * 0.3, rotation: -6, rotationX: 6, ease: 'power1.out' }, 0)
        .to(R, { y: () => -hero.offsetHeight * 0.36, rotation: 5, rotationX: 6, ease: 'power1.out' }, 0)
        .to('.ticks', { opacity: 0, scale: 1.08, ease: 'power1.in' }, 0)
        .to('.rings', { scale: 1.1, opacity: 0.4, transformOrigin: '50% 69%' }, 0);
    }));
  }

  addEventListener('resize', () => { horizon?.relayout(); });
  const odos = [{ odo: invOdo, value: () => 18450 }, { odo: balOdo, value: () => balance }];
  return { horizon, ticks, odos };
}
