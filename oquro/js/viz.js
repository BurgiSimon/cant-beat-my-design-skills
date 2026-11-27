// The little live visuals inside the cards, as builders: each draws into its element and returns a controller with
// tick(dt) for while it is on screen and set(...) for new data. No module state; the callers decide when to run them.

import { calm, motion, seeded, smoothPath, clamp, fmt } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; };

/** The threat card's radar: ticks round the edge, a sweep, nodes on orbits that ping when the sweep finds them. */
export function radar(svg) {
  const ticks = svg.querySelector('[data-radar-ticks]');
  const links = svg.querySelector('[data-radar-links]');
  const nodesG = svg.querySelector('[data-radar-nodes]');
  const sweep = svg.querySelector('[data-radar-sweep]');
  const halo = svg.querySelector('.radar__halo');
  const C = 110;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2; const major = i % 6 === 0;
    const r0 = major ? 92 : 95, r1 = 100;
    el('line', { x1: C + Math.cos(a) * r0, y1: C + Math.sin(a) * r0, x2: C + Math.cos(a) * r1, y2: C + Math.sin(a) * r1, class: major ? 'is-major' : '' }, ticks);
  }
  // [angle, orbit, radius]: dotted discs the shot's size round its r=31 core; the second sits low enough to clear the Risk chip
  const spec = [[-0.95, 62, 12.5], [-0.1, 74, 10.5], [0.55, 52, 10], [1.5, 70, 12], [2.35, 46, 8.5], [3.3, 80, 10], [4.15, 58, 11]];
  const nodes = spec.map(([a, r, s]) => {
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
    const line = el('line', { x1: C, y1: C, x2: x, y2: y }, links);
    const ping = el('circle', { cx: x, cy: y, r: s, class: 'ping', opacity: 0 }, nodesG);
    const node = el('circle', { cx: x, cy: y, r: s, class: 'node' }, nodesG);
    return { a: ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), r, s, x, y, line, ping, node, t: 9 };
  });
  let ang = -Math.PI / 2; let t = 0; let alarm = 0;
  function tick(dt) {
    t += dt; ang += dt * (alarm > 0 ? 3.2 : 1.1);
    const deg = (ang * 180) / Math.PI + 90;
    sweep.style.transform = `rotate(${deg}deg)`;
    const head = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (const n of nodes) {
      let d = head - n.a; d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (d < dt * 3.3) n.t = 0;
      n.t += dt;
      const k = clamp(n.t / 1.1, 0, 1);
      n.ping.setAttribute('r', (n.s + k * 10).toFixed(2));
      n.ping.setAttribute('opacity', (1 - k).toFixed(3));
      n.line.style.opacity = (0.35 + (1 - k) * 0.65).toFixed(3);
    }
    halo.style.transform = `scale(${1 + Math.sin(t * 3) * 0.12 + (alarm > 0 ? 0.25 : 0)})`;
    alarm = Math.max(0, alarm - dt);
  }
  return { tick, alarm(s = 3) { alarm = s; } };
}

/** A gauge: a fan of even ticks round the top, lit up to the value. Wide and flat, as in the shot (the CSS draws it at 1.5x). */
export function gauge(host, { ticks = 22, from = 216, to = 324 } = {}) {
  const svg = el('svg', { viewBox: '0 0 220 115' }, host);
  const lines = [];
  for (let i = 0; i < ticks; i++) {
    const a = ((from + ((to - from) * i) / (ticks - 1)) * Math.PI) / 180;
    const r0 = 83, r1 = 98;
    lines.push(el('line', { x1: 110 + Math.cos(a) * r0, y1: 108 + Math.sin(a) * r0, x2: 110 + Math.cos(a) * r1, y2: 108 + Math.sin(a) * r1 }, svg));
  }
  let shown = 0; let target = 0.7; let t = 0;
  const draw = () => { const n = Math.round(shown * ticks); lines.forEach((l, i) => l.classList.toggle('is-on', i < n)); };
  return {
    set(v) { target = clamp(v, 0, 1); if (calm || motion.paused) { shown = target; draw(); } },   // nothing to ease it there
    tick(dt) { t += dt; const wob = Math.sin(t * 1.7) * 0.02 + Math.sin(t * 4.3) * 0.01; shown += (target + wob - shown) * Math.min(1, dt * 3); draw(); },
  };
}

/** A spark chart: a dotted line and a quieter one, a crosshair with a knob that walks along the dotted one. */
export function spark(svg, { seed = 3 } = {}) {
  const W = 200, H = 90;
  const defs = el('defs', {}, svg);
  const lg = el('linearGradient', { id: `spark-fill-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.35 }, lg); el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, lg);
  for (let i = 1; i < 4; i++) el('line', { x1: 0, x2: W, y1: (H / 4) * i, y2: (H / 4) * i, class: 'grid' }, svg);
  const area = el('path', { class: 'area', fill: `url(#spark-fill-${seed})` }, svg);
  const l2 = el('path', { class: 'l2' }, svg);
  const l1 = el('path', { class: 'l1' }, svg);
  const cross = el('line', { class: 'cross', y1: 4, y2: H }, svg);
  const knob = el('circle', { class: 'knob', r: 4.2 }, svg);
  let rnd = seeded(seed);
  const N = 14;
  let a = [], b = [];
  const fresh = () => { rnd = seeded(seed); a = Array.from({ length: N + 1 }, (_, i) => 0.5 + Math.sin(i * 0.9) * 0.18 + (rnd() - 0.5) * 0.3); b = Array.from({ length: N + 1 }, (_, i) => 0.55 + Math.cos(i * 0.6) * 0.12 + (rnd() - 0.5) * 0.2); };
  fresh();
  let shift = 0; let cx = 0.5; let t = 0;
  const yOf = (v) => 8 + (1 - v) * (H - 16);
  function draw() {
    const step = W / (N - 1);
    const pa = a.map((v, i) => [i * step - shift * step, yOf(v)]);
    const pb = b.map((v, i) => [i * step - shift * step, yOf(v)]);
    const da = smoothPath(pa, 0.6);
    l1.setAttribute('d', da); l2.setAttribute('d', smoothPath(pb, 0.6));
    area.setAttribute('d', `${da}L${pa[pa.length - 1][0]},${H}L${pa[0][0]},${H}Z`);
    // knob on the dotted line at cx
    const x = cx * W; const fi = x / step + shift; const i0 = Math.floor(fi); const f = fi - i0;
    const v = (a[i0] ?? a[a.length - 1]) * (1 - f) + (a[i0 + 1] ?? a[a.length - 1]) * f;
    cross.setAttribute('x1', x.toFixed(2)); cross.setAttribute('x2', x.toFixed(2));
    knob.setAttribute('cx', x.toFixed(2)); knob.setAttribute('cy', yOf(v).toFixed(2));
  }
  draw();
  return {
    tick(dt) {
      t += dt; shift += dt * 0.55;
      if (shift >= 1) { shift -= 1; a.shift(); b.shift(); a.push(clamp(a[a.length - 1] + (rnd() - 0.5) * 0.45, 0.12, 0.92)); b.push(clamp(b[b.length - 1] + (rnd() - 0.5) * 0.25, 0.2, 0.85)); }
      cx = 0.52 + Math.sin(t * 0.45) * 0.24;
      draw();
    },
    reseed(s) { seed = s; fresh(); draw(); },
  };
}

/** The glass timeline: dashed ticks with times sliding left, the red flag holding still. */
export function timeline(track) {
  const ticks = [];
  let base = 14 * 60 + 27; // 14:27
  const label = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`;
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div'); d.className = 'timeline__tick';
    const s = document.createElement('span'); d.append(s); track.append(d); ticks.push({ d, s, i });
  }
  let x = 0; // 0..1: one tick spacing
  const layout = () => {
    ticks.forEach((k) => {
      const pos = (k.i - 1 + 0.5 - x) / 3; // three spaces across
      k.d.style.left = `${(pos * 100).toFixed(3)}%`;
      k.s.textContent = label(base + (k.i - 1) * 2);
      k.d.style.opacity = clamp(1 - Math.abs(pos - 0.5) * 1.6 + 0.4, 0, 1).toFixed(3);
    });
  };
  layout();
  return {
    tick(dt) { x += dt * 0.08; if (x >= 1) { x -= 1; base += 2; } layout(); },
    start(m) { base = m; layout(); },
  };
}

/** The matrix: columns of dots filling and flaring like a level meter, a few red. */
export function matrix(host, { cols = 16, rows = 10, seed = 5 } = {}) {
  const rnd = seeded(seed);
  const C = [];
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div'); col.className = 'matrix__col';
    const dots = [];
    for (let r = 0; r < rows; r++) { const i = document.createElement('i'); col.append(i); dots.push(i); }
    host.append(col);
    C.push({ col, dots, level: 2 + rnd() * 6, target: 2 + rnd() * 6, hot: rnd() < 0.18 });
  }
  let t = 0; let scan = 0; let acc = 0;
  function draw() {
    C.forEach((c, ci) => {
      const n = Math.round(c.level);
      c.dots.forEach((d, r) => {
        const fromBottom = c.dots.length - 1 - r;
        d.className = fromBottom < n ? (c.hot && fromBottom >= n - 2 ? 'hot' : fromBottom === n - 1 ? 'on' : '') : '';
      });
      c.col.classList.toggle('is-scan', ci === scan);
    });
  }
  draw();
  return {
    tick(dt) {
      t += dt; acc += dt;
      for (const c of C) c.level += (c.target - c.level) * Math.min(1, dt * 6);
      if (acc > 0.16) {
        acc = 0; scan = (scan + 1) % C.length;
        for (const c of C) if (rnd() < 0.3) { c.target = 1 + rnd() * (c.hot ? 9 : 7); if (rnd() < 0.05) c.hot = !c.hot; }
        draw();
      }
    },
    heat() { for (const c of C) { if (rnd() < 0.4) c.hot = true; c.target = 6 + rnd() * 4; } draw(); },
    calm() { for (const c of C) c.hot = rnd() < 0.15; },
  };
}

/** The traffic grid: rows of dots and a red bar that walks across them, lighting its column. */
export function dotgrid(host, { cols = 17, rows = 4 } = {}) {
  const dots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = document.createElement('i'); host.append(i); dots.push({ i, c, r }); }
  const bar = document.createElement('span'); bar.className = 'dotgrid__bar'; host.append(bar);
  let col = 9; let acc = 0; let t = 0;
  const draw = () => {
    bar.style.left = `${((col + 0.5) / cols) * 100}%`;
    for (const d of dots) { d.i.className = d.c === col ? 'hot' : (Math.sin(d.c * 1.3 + d.r * 2.1 + t) > 0.75 ? 'dim' : ''); }
  };
  draw();
  return {
    tick(dt) { t += dt; acc += dt; if (acc > 1.6) { acc = 0; col = (col + 1 + Math.floor(Math.random() * 3)) % cols; } if (Math.random() < dt * 4) draw(); },
    jump() { col = Math.floor(Math.random() * cols); draw(); },
  };
}

/** Performance bars: a day of detection, hour by hour, the newest at the right. */
export function bars(host, { n = 28, seed = 9 } = {}) {
  const rnd = seeded(seed);
  const B = [];
  for (let i = 0; i < n; i++) { const b = document.createElement('i'); host.append(b); B.push({ b, v: 0.4 + rnd() * 0.5 }); }
  const draw = (k = 1) => B.forEach((x, i) => { x.b.style.transform = `scaleY(${(x.v * k).toFixed(3)})`; x.b.classList.toggle('is-peak', x.v > 0.88); });
  draw(calm ? 1 : 0);
  let acc = 0;
  return {
    grow() { draw(1); },
    tick(dt) { acc += dt; if (acc > 1.4) { acc = 0; B.push(B.shift()); B[B.length - 1].v = 0.35 + rnd() * 0.62; B.forEach((x) => host.append(x.b)); draw(1); } },
  };
}

/** The about card's dot-matrix display: 3 × 3-dot cells that flicker in and out like data. */
export function dotMatrix(host, { cols = 11, rows = 3, seed = 4 } = {}) {
  const rnd = seeded(seed);
  const cells = [];
  // the shot's own pattern, then it drifts from there
  const start = ['10010011111', '00101100001', '10110110111'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = document.createElement('i');
    for (let k = 0; k < 9; k++) i.append(document.createElement('b'));
    host.append(i);
    const on = start[r]?.[c] === '1';
    i.className = on ? 'on' : rnd() < 0.3 ? 'half' : '';
    cells.push(i);
  }
  let acc = 0;
  return {
    tick(dt) {
      acc += dt; if (acc < 0.22) return; acc = 0;
      for (let k = 0; k < 3; k++) {
        const c = cells[Math.floor(rnd() * cells.length)];
        c.className = rnd() < 0.45 ? 'on' : rnd() < 0.5 ? 'half' : '';
      }
    },
  };
}

export const clock = (m) => { const h = Math.floor(m / 60) % 24; const mm = m % 60; const h12 = ((h + 11) % 12) + 1; return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export { fmt };
