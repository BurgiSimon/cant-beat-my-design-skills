// The wind tunnel, in type. The helmet is the real one (a profile rendered by the stage, turned into characters by
// its own light), and the air is a few hundred particles that slide round its outline: a distance field from the
// silhouette pushes them along the shell, the wake behind it boils, more so with the stabiliser off. Each particle
// leaves a character for its heading (- / \ ~ =), fading behind it. The pointer stirs the air. Readouts follow the
// speed and the stabiliser.

import { calm, fine, whenVisible, stageReady, clamp } from './core.js';
import { scramble } from './ui.js';

const DENSE = ' .:-=+*#%@';

export async function init() {
  const cv = document.querySelector('[data-tunnel]');
  if (!cv) return;
  const g = cv.getContext('2d');
  const spoilerEl = document.querySelector('[data-t-spoiler]');
  const range = document.querySelector('[data-t-range]');
  const out = {
    speed: document.querySelector('[data-t-speed]'), cd: document.querySelector('[data-t-cd]'),
    lift: document.querySelector('[data-t-lift]'), db: document.querySelector('[data-t-db]'),
  };
  let speed = Number(range?.value || 130); let spoiler = spoilerEl ? spoilerEl.checked : true;

  // ---- the grid
  let W = 0, H = 0, dpr = 1, cw = 9, ch = 15, cols = 0, rows = 0;
  let mask = null, dist = null, shade = null, gx = null, gy = null, inten = null, glyph = null, hot = null;
  let helmetBox = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let atlas = null; const CHARS = ['·', '-', '=', '~', '/', '\\', '>', '+', '*', 'o'];
  const LEVELS = 6;

  function buildAtlas() {
    atlas = document.createElement('canvas');
    atlas.width = Math.ceil(cw * dpr) * CHARS.length; atlas.height = Math.ceil(ch * dpr) * LEVELS * 2;
    const a = atlas.getContext('2d');
    a.font = `400 ${Math.round(13 * dpr)}px "Roboto Mono", ui-monospace, monospace`; a.textAlign = 'center'; a.textBaseline = 'middle';
    for (let c = 0; c < 2; c++) for (let l = 0; l < LEVELS; l++) {
      const k = (l + 1) / LEVELS;
      a.fillStyle = c ? `rgba(252,233,27,${0.25 + 0.75 * k})` : `rgba(236,235,230,${0.12 + 0.88 * k * k})`;
      CHARS.forEach((chr, i) => a.fillText(chr, (i + 0.5) * Math.ceil(cw * dpr), (c * LEVELS + l + 0.5) * Math.ceil(ch * dpr)));
    }
  }

  // The helmet: a profile still → solid cells, their brightness, and the distance field round them.
  let layer = null;
  async function buildObstacle(stage) {
    cols = Math.max(40, Math.floor(W / cw)); rows = Math.max(20, Math.floor(H / ch));
    const n = cols * rows;
    mask = new Uint8Array(n); shade = new Float32Array(n); dist = new Float32Array(n).fill(1e3);
    inten = new Float32Array(n); glyph = new Uint8Array(n); hot = new Uint8Array(n);
    // the silhouette at grid resolution: a still at a third of the canvas, squeezed onto the grid of cells
    const sw = Math.round(cols * cw / 3), sh = Math.round(rows * ch / 3);
    const still = stage?.helmetStill?.('dust', sw, sh, { az: 0, el: 0, yaw: 180, fill: 0.8, ss: 1 });
    const hx = Math.floor(cols * 0.36);
    if (still) {
      const tmp = document.createElement('canvas'); tmp.width = cols; tmp.height = rows;
      const t = tmp.getContext('2d'); t.drawImage(still, -cols * 0.14, rows * 0.0, cols, rows * 1.0);
      const d = t.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < n; i++) { const a = d[i * 4 + 3] / 255; if (a > 0.45) { mask[i] = 1; shade[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765; } }
    } else {
      // no WebGL: an egg where the helmet would be
      const cx = hx, cy = rows * 0.5, rx = cols * 0.13, ry = rows * 0.33;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = ((x - cx) / rx) ** 2 + ((y - cy) / (ry * 0.62 * (ch / cw) * 0.6)) ** 2;
        if (v < 1) { mask[y * cols + x] = 1; shade[y * cols + x] = 0.5 + 0.4 * (1 - y / rows); }
      }
    }
    // bounds
    let x0 = cols, x1 = 0, y0 = rows, y1 = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (mask[y * cols + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    helmetBox = { x0, x1, y0, y1 };
    // chamfer distance (cells, y scaled to x by the cell's shape)
    const ry = ch / cw;
    for (let i = 0; i < n; i++) if (mask[i]) dist[i] = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) v = Math.min(v, dist[i - cols] + ry);
      if (x > 0 && y > 0) v = Math.min(v, dist[i - cols - 1] + Math.hypot(1, ry));
      if (x < cols - 1 && y > 0) v = Math.min(v, dist[i - cols + 1] + Math.hypot(1, ry));
      dist[i] = v;
    }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x; let v = dist[i];
      if (x < cols - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < rows - 1) v = Math.min(v, dist[i + cols] + ry);
      if (x < cols - 1 && y < rows - 1) v = Math.min(v, dist[i + cols + 1] + Math.hypot(1, ry));
      if (x > 0 && y < rows - 1) v = Math.min(v, dist[i + cols - 1] + Math.hypot(1, ry));
      dist[i] = v;
    }
    gx = new Float32Array(n); gy = new Float32Array(n);
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      const i = y * cols + x;
      const a = dist[i + 1] - dist[i - 1], b = (dist[i + cols] - dist[i - cols]) / ry;
      const l = Math.hypot(a, b) || 1; gx[i] = a / l; gy[i] = b / l;
    }
    // the helmet in characters, drawn once
    layer = document.createElement('canvas'); layer.width = Math.ceil(W * dpr); layer.height = Math.ceil(H * dpr);
    const lg = layer.getContext('2d');
    lg.font = `500 ${Math.round(13 * dpr)}px "Roboto Mono", ui-monospace, monospace`; lg.textAlign = 'center'; lg.textBaseline = 'middle';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; if (!mask[i]) continue;
      const s = shade[i];
      const edge = dist[i] === 0 && (mask[i - 1] === 0 || mask[i + 1] === 0 || mask[i - cols] === 0 || mask[i + cols] === 0);
      lg.fillStyle = edge ? 'rgba(255,255,255,0.95)' : `rgba(236,235,230,${0.25 + 0.75 * s})`;
      lg.fillText(edge ? '#' : DENSE[Math.min(DENSE.length - 1, 1 + Math.floor(s * (DENSE.length - 1)))], (x + 0.5) * cw * dpr, (y + 0.5) * ch * dpr);
    }
  }

  // ---- particles
  const N = 700;
  const P = new Float32Array(N * 4); // x, y (cells), age, seed
  const spawn = (k, anywhere) => { P[k * 4] = anywhere ? Math.random() * cols : -Math.random() * 6; P[k * 4 + 1] = Math.random() * rows; P[k * 4 + 2] = 0; P[k * 4 + 3] = Math.random(); };
  const ptr = { x: -1e3, y: -1e3, on: false, vx: 0, vy: 0 };

  function vel(x, y, t, out) {
    const U = speed / 130;
    let vx = U * 1.0, vy = 0;
    const xi = x | 0, yi = y | 0;
    if (xi >= 0 && yi >= 0 && xi < cols && yi < rows) {
      const i = yi * cols + xi; const d = dist[i];
      const R = 6;
      if (d < R) {
        // slide along the shell: take away what heads into it, add a little speed over the top
        const nx = gx[i], ny = gy[i];
        const into = vx * nx + vy * ny;
        const w = 1 - d / R;
        if (into < 0) { vx -= into * nx * (0.6 + 0.4 * w); vy -= into * ny * (0.6 + 0.4 * w); }
        vx *= 1 + 0.35 * w;
      }
      // the wake: behind the helmet, within its height, the air boils
      const { x0, x1, y0, y1 } = helmetBox;
      if (x > x1 - 2 && y > y0 - 2 && y < y1 + 4) {
        const span = (y1 - y0) || 1;
        const behind = clamp((x - x1) / (cols * 0.55), 0, 1);
        const core = 1 - Math.abs((y - (y0 + y1) / 2) / (span * (spoiler ? 0.45 : 0.62)));
        if (core > 0) {
          const strength = (spoiler ? 0.38 : 1.0) * core * (1 - behind * 0.7) * U;
          vx *= 1 - 0.45 * core * (1 - behind);
          vy += Math.sin(x * 0.55 - t * (spoiler ? 5 : 9) + y * 0.3) * strength * 0.9 + Math.sin(t * 13 + y * 1.7 + x) * strength * 0.25;
        }
      }
      // the front of the visor: stagnation
      if (x < x0 + 4 && x > x0 - 8 && y > y0 && y < y1) vx *= 0.75;
    }
    // the pointer stirs it
    if (ptr.on) {
      const dx = x - ptr.x, dy = (y - ptr.y) * (ch / cw);
      const r2 = dx * dx + dy * dy;
      if (r2 < 64) { const f = (1 - r2 / 64) * 1.6; vx += -dy * 0.18 * f + ptr.vx * 0.05 * f; vy += dx * 0.18 * f + ptr.vy * 0.05 * f; }
    }
    out[0] = vx; out[1] = vy;
  }

  function charFor(vx, vy, turb) {
    if (turb > 0.6) return 3;                        // ~
    const a = Math.atan2(vy, vx);
    if (Math.abs(a) < 0.22) return Math.hypot(vx, vy) > 1.25 ? 2 : 1; // = or -
    if (a > 0.22 && a < 1.3) return 5;               // \ (screen y grows down)
    if (a < -0.22 && a > -1.3) return 4;             // /
    return 7;                                        // +
  }

  // ---- loop
  let raf = 0, running = false, t = 0, last = 0;
  const v = [0, 0];
  function frame(now) {
    raf = 0; if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      for (let k = 0; k < N; k++) {
        let x = P[k * 4], y = P[k * 4 + 1];
        vel(x, y, t, v);
        const sp = 24 * dt / steps;
        const nx = x + v[0] * sp, ny = y + v[1] * sp * (cw / ch) * 1.6;
        const xi = nx | 0, yi = ny | 0;
        if (nx >= cols || ny < 0 || ny >= rows || (xi >= 0 && mask[yi * cols + xi])) { spawn(k, false); continue; }
        P[k * 4] = nx; P[k * 4 + 1] = ny; P[k * 4 + 2] += dt;
        if (xi >= 0) {
          const i = yi * cols + xi;
          const turb = Math.abs(v[1]) / (Math.abs(v[0]) + 0.2);
          inten[i] = Math.min(1, inten[i] + 0.34);
          glyph[i] = charFor(v[0], v[1], turb);
          hot[i] = (xi < helmetBox.x0 + 3 && xi > helmetBox.x0 - 6 && yi > helmetBox.y0 && yi < helmetBox.y1) || (turb > 0.9 && !spoiler) ? 1 : 0;
        }
      }
    }
    // draw
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050505'; g.fillRect(0, 0, cv.width, cv.height);
    const cwp = Math.ceil(cw * dpr), chp = Math.ceil(ch * dpr);
    const decay = Math.pow(0.9, dt * 60);
    for (let i = 0; i < inten.length; i++) {
      const it = inten[i]; if (it < 0.04) { inten[i] = 0; continue; }
      inten[i] = it * decay;
      const l = Math.min(LEVELS - 1, Math.floor(it * LEVELS));
      const x = (i % cols) * cw * dpr, y = ((i / cols) | 0) * ch * dpr;
      g.drawImage(atlas, glyph[i] * cwp, ((hot[i] ? LEVELS : 0) + l) * chp, cwp, chp, x, y, cwp, chp);
    }
    if (layer) g.drawImage(layer, 0, 0);
    // the pointer: a reticle
    if (ptr.on) {
      const px = (ptr.x + 0.5) * cw * dpr, py = (ptr.y + 0.5) * ch * dpr, s = 6 * dpr;
      g.strokeStyle = '#fce91b'; g.lineWidth = dpr; g.strokeRect(px - s, py - s, 2 * s, 2 * s);
      g.beginPath(); g.moveTo(px - s * 2.4, py); g.lineTo(px - s * 1.4, py); g.moveTo(px + s * 1.4, py); g.lineTo(px + s * 2.4, py);
      g.moveTo(px, py - s * 2.4); g.lineTo(px, py - s * 1.4); g.moveTo(px, py + s * 1.4); g.lineTo(px, py + s * 2.4); g.stroke();
      ptr.vx *= 0.9; ptr.vy *= 0.9;
    }
    raf = requestAnimationFrame(frame);
  }

  function readouts(animate = true) {
    const k = (speed / 130) ** 2;
    const cd = spoiler ? 0.29 : 0.33;
    const lift = (spoiler ? -1.8 : 4.6) * k;
    const db = Math.round(84 + 20 * Math.log10(speed / 130) * 1.6 + (spoiler ? 0 : 4));
    const set = (el, txt) => { if (!el) return; if (animate && !calm) scramble(el, txt, { duration: 360 }); else el.textContent = txt; };
    set(out.speed, String(speed));
    set(out.cd, cd.toFixed(2));
    set(out.lift, `${lift < 0 ? '−' : '+'}${Math.abs(lift).toFixed(1)}`);
    set(out.db, String(db));
    out.db?.closest('b')?.classList.toggle('is-warn', db >= 90);
    out.lift?.closest('b')?.classList.toggle('is-warn', lift > 0);
  }
  spoilerEl?.addEventListener('change', () => { spoiler = spoilerEl.checked; readouts(); });
  range?.addEventListener('input', () => { speed = Number(range.value); readouts(); });

  if (fine) {
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / cw, y = (e.clientY - r.top) / ch;
      if (ptr.on) { ptr.vx = (x - ptr.x) * 8; ptr.vy = (y - ptr.y) * 8; }
      ptr.x = x; ptr.y = y; ptr.on = true;
    });
    cv.addEventListener('pointerleave', () => { ptr.on = false; });
  }

  const stage = await Promise.race([stageReady, new Promise((r) => setTimeout(r, 4000))]);
  async function size() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cw = W < 600 ? 7 : 9; ch = W < 600 ? 12 : 15;
    buildAtlas();
    await buildObstacle(stage);
    for (let k = 0; k < N; k++) spawn(k, true);
    if (calm) { // one still frame: the air drawn as if it had run a while
      running = true; for (let i = 0; i < 40; i++) { last = 0; frame(i * 16); cancelAnimationFrame(raf); } running = false; raf = 0;
    }
  }
  await document.fonts?.ready;
  await size();
  readouts(false);
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 200); });
  if (!calm) whenVisible(cv, (vis) => { running = vis && !document.hidden; if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }, '50px');
}
