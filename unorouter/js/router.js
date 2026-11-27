// Fallbacks, live. Requests leave your app, reach the router and go to the fastest healthy upstream along paths of
// pixels; the answer comes back the same way. Switch an upstream off and whatever is on its way there bounces with
// a 503 and is sent on to the next one; after two failures the router stops trying it (and probes it now and then).
// Everything is counted and logged underneath.

import { calm, loop, PALETTE, clamp } from './core.js';

const CELL = 8;

export function init() {
  const box = document.querySelector('[data-router]');
  if (!box) return;
  const cv = box.querySelector('.router__canvas');
  const g = cv.getContext('2d');
  const app = box.querySelector('.router__app');
  const hub = box.querySelector('.router__hub');
  const ups = [...box.querySelectorAll('.up')].map((el, i) => ({
    el, i, name: el.querySelector('.up__name').textContent, ms: parseInt(el.querySelector('[data-ms]').textContent, 10),
    msEl: el.querySelector('[data-ms]'), on: true, fails: 0, open: false, probeAt: 0, load: 0,
  }));
  const served = box.querySelector('[data-r-served]'); const rerouted = box.querySelector('[data-r-rerouted]'); const failed = box.querySelector('[data-r-failed]');
  const logEl = box.querySelector('[data-r-log]');
  const stats = { served: 0, rerouted: 0, failed: 0 };

  // ---- geometry: anchor points from the boxes themselves, paths snapped to the grid ----
  let W = 0; let H = 0; let dpr = 1; let A = null; let paths = [];
  const snap = (v) => Math.round(v / CELL) * CELL;
  function route(a, b, vertical) { // an orthogonal path of grid points from a to b
    const pts = [];
    const push = (x, y) => { const last = pts.at(-1); if (!last || last.x !== x || last.y !== y) pts.push({ x, y }); };
    const line = (x0, y0, x1, y1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / CELL;
      for (let k = 0; k <= n; k++) push(snap(x0 + ((x1 - x0) * k) / n), snap(y0 + ((y1 - y0) * k) / n));
    };
    if (!vertical) { const mx = snap((a.x + b.x) / 2); line(a.x, a.y, mx, a.y); line(mx, a.y, mx, b.y); line(mx, b.y, b.x, b.y); }
    else { const my = snap((a.y + b.y) / 2); line(a.x, a.y, a.x, my); line(a.x, my, b.x, my); line(b.x, my, b.x, b.y); }
    return pts;
  }
  function layout() {
    const r = box.getBoundingClientRect(); const c = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); W = c.width; H = c.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const rel = (el) => { const b = el.getBoundingClientRect(); return { l: b.left - c.left, r: b.right - c.left, t: b.top - c.top, b: b.bottom - c.top, cx: (b.left + b.right) / 2 - c.left, cy: (b.top + b.bottom) / 2 - c.top }; };
    const pa = rel(app); const ph = rel(hub);
    const vertical = ph.t > pa.b; // stacked (small screens)
    A = {
      vertical,
      app: vertical ? { x: snap(pa.cx), y: snap(pa.b + 4) } : { x: snap(pa.r + 4), y: snap(pa.cy) },
      hubIn: vertical ? { x: snap(ph.cx), y: snap(ph.t - 4) } : { x: snap(ph.l - 4), y: snap(ph.cy) },
      hubOut: vertical ? { x: snap(ph.cx), y: snap(ph.b + 4) } : { x: snap(ph.r + 4), y: snap(ph.cy) },
    };
    A.main = route(A.app, A.hubIn, vertical);
    paths = ups.map((u) => {
      const pu = rel(u.el);
      const end = vertical ? { x: snap(pu.l - 12), y: snap(pu.cy) } : { x: snap(pu.l - 4), y: snap(pu.cy) };
      if (!vertical) return route(A.hubOut, end, false);
      // stacked: down from the hub, then across to the left of the list, then down its side
      const side = snap(Math.min(...ups.map((x) => rel(x.el).l)) - 20);
      const pts = route(A.hubOut, { x: side, y: snap(rel(ups[0].el).t - 8) }, true);
      const tail = route(pts.at(-1), { x: side, y: end.y }, true).slice(1);
      return [...pts, ...tail, ...route({ x: side, y: end.y }, end, false).slice(1)];
    });
    void r;
  }

  // ---- requests ----
  const packets = [];
  let colour = 0;
  function healthy() {
    const now = performance.now();
    return ups.filter((u) => !u.open || now > u.probeAt);
  }
  function choose(exclude = new Set()) {
    const list = healthy().filter((u) => !exclude.has(u));
    if (!list.length) return null;
    // weighted towards the fast ones, so most go to the quickest but not all
    const w = list.map((u) => 1 / (u.ms * (1 + u.load * 0.4)) ** 1.6);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < list.length; k++) { r -= w[k]; if (r <= 0) return list[k]; }
    return list.at(-1);
  }
  function spawn() {
    packets.push({ leg: 'main', path: A.main, s: 0, dir: 1, colour: PALETTE[colour++ % 4], tried: new Set(), t0: performance.now(), hops: [] });
  }
  const speed = 340; // px a second

  function arrive(p) {
    if (p.leg === 'main' && p.dir === 1) { // at the router: pick an upstream
      const u = choose(p.tried);
      if (!u) { p.dir = -1; p.status = 503; return; }
      p.leg = u.i; p.path = paths[u.i]; p.s = 0; p.dir = 1; p.u = u; u.load++;
      if (u.open) p.probe = true;
      return;
    }
    if (typeof p.leg === 'number' && p.dir === 1) { // at the upstream
      const u = p.u; u.el.classList.add('is-hit'); setTimeout(() => u.el.classList.remove('is-hit'), 160);
      if (!u.on) { // it fails: back to the router, then on to another
        u.fails++; p.tried.add(u); p.hops.push(`<span class="bad">${u.name} 503</span>`);
        if (u.fails >= 2 && !u.open) { u.open = true; log(`<span class="bad">circuit open</span> · ${u.name} · probing every 6s`); }
        u.probeAt = performance.now() + 6000;
        p.dir = -1; p.retry = true; p.flash = 1; return;
      }
      if (u.open) { u.open = false; u.fails = 0; log(`<span class="ok">circuit closed</span> · ${u.name} answered a probe`); }
      p.dir = -1; p.status = 200; p.hops.push(`${u.name}`); p.ms = Math.round(u.ms * (0.85 + Math.random() * 0.35)); return;
    }
    if (typeof p.leg === 'number' && p.dir === -1) { // back at the router
      p.u.load = Math.max(0, p.u.load - 1);
      if (p.retry) { p.retry = false; p.dir = 1; p.leg = 'main'; p.path = A.main; p.s = A.main.length - 1; stats.rerouted++; arrive(p); return; }
      p.leg = 'main'; p.path = A.main; p.s = A.main.length - 1; return;
    }
    // back at the app
    p.done = true;
    const ms = Math.round(performance.now() - p.t0);
    if (p.status === 200) {
      stats.served++;
      const via = p.hops.length > 1 ? `${p.hops.slice(0, -1).join(' → ')} → <span class="re">${p.hops.at(-1)}</span>` : p.hops[0];
      log(`POST /v1/chat → ${via} <span class="ok">200</span> ${p.ms ?? ms}ms`);
    } else {
      stats.failed++;
      log(`POST /v1/chat → <span class="bad">503 no healthy upstream</span>`);
    }
    paint();
  }

  // ---- the log and the counters ----
  const clock = () => new Date().toISOString().slice(11, 23);
  function log(html) {
    const li = document.createElement('li'); li.innerHTML = `<span class="t">${clock()}</span>  ${html}`;
    logEl.append(li);
    while (logEl.children.length > 4) logEl.firstElementChild.remove();
  }
  function paint() { served.textContent = stats.served.toLocaleString('en-US'); rerouted.textContent = stats.rerouted; failed.textContent = stats.failed; }

  // ---- switching upstreams ----
  for (const u of ups) {
    u.el.addEventListener('click', () => {
      u.on = !u.on; u.el.setAttribute('aria-pressed', u.on);
      u.msEl.textContent = u.on ? `${u.ms}ms` : 'down';
      if (u.on) { u.fails = 0; log(`${u.name} <span class="ok">back up</span>`); } else log(`${u.name} <span class="bad">down</span> · switched off`);
      u.el.setAttribute('aria-label', `${u.name}, ${u.on ? 'up' : 'down'}. Press to switch ${u.on ? 'off' : 'on'}.`);
      if (calm) draw();
    });
    u.el.setAttribute('aria-label', `${u.name}, up. Press to switch off.`);
  }

  // ---- drawing ----
  function dotPath(pts, colour, size = 2) {
    g.fillStyle = colour;
    for (const p of pts) g.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!A) return;
    dotPath(A.main, '#3a3a3a', 3);
    ups.forEach((u, i) => dotPath(paths[i], u.on ? (u.open ? '#5a3a1a' : '#2e2e2e') : '#4a1a1a', u.on ? 3 : 2));
    for (const p of packets) {
      const path = p.path; const k = Math.floor(p.s); const f = p.s - k;
      const at = (s) => { const a = path[clamp(Math.floor(s), 0, path.length - 1)]; const b = path[clamp(Math.floor(s) + 1, 0, path.length - 1)]; const t = s - Math.floor(s); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
      const col = p.status === 503 ? '#ff4545' : p.dir === -1 ? '#ffffff' : p.colour;
      for (let tr = 3; tr >= 1; tr--) { // a trail of cells behind it
        const q = path[clamp(k - tr * p.dir, 0, path.length - 1)];
        g.globalAlpha = 0.12 + 0.12 * (3 - tr); g.fillStyle = col; g.fillRect(q.x - 3, q.y - 3, 6, 6);
      }
      g.globalAlpha = 1;
      const h = at(p.s); g.fillStyle = col; g.fillRect(Math.round(h.x - 4), Math.round(h.y - 4), 8, 8);
      if (p.flash > 0) { g.globalAlpha = p.flash; g.strokeStyle = '#ff4545'; g.strokeRect(h.x - 9, h.y - 9, 18, 18); g.globalAlpha = 1; }
      void f;
    }
  }

  const ro = new ResizeObserver(() => { layout(); draw(); });
  ro.observe(box);
  layout(); paint();
  log('router ready · 5 upstreams · <span class="ok">all healthy</span>');
  if (calm) { draw(); return; }

  let next = 0.4;
  loop(box, (dt) => {
    next -= dt;
    if (next <= 0 && packets.length < 14) { spawn(); next = 0.42 + Math.random() * 0.5; }
    for (const p of packets) {
      p.s += (p.dir * speed * dt) / CELL;
      if (p.flash) p.flash = Math.max(0, p.flash - dt * 2.5);
      const end = p.dir === 1 ? p.path.length - 1 : 0;
      if ((p.dir === 1 && p.s >= end) || (p.dir === -1 && p.s <= 0)) { p.s = end; arrive(p); }
    }
    for (let k = packets.length - 1; k >= 0; k--) if (packets[k].done) packets.splice(k, 1);
    // latencies wander a little
    if (Math.random() < dt * 2) { const u = ups[Math.floor(Math.random() * ups.length)]; if (u.on) { const base = [212, 248, 176, 231, 94][u.i]; u.ms = Math.round(base * (0.9 + Math.random() * 0.22)); u.msEl.textContent = `${u.ms}ms`; } }
    draw();
  });
  document.fonts?.ready.then(() => { layout(); draw(); });
}
