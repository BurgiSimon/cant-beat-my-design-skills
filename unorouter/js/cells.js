// A field of square cells on a canvas, coloured from the four hot colours. The shot's art is banded: neighbouring
// cells step yellow → orange → pink → magenta → yellow. So a cell's colour is its own starting colour plus a whole
// number of steps, and the steps come from smooth fields: one that drifts with time (the bands flow), one round the
// pointer (a halo that shifts the colours under it), and rings sent out by a press. At time zero every offset is
// zero, so the first frame is exactly the starting colours: in the hero, the shot itself.

import { clamp, damp, mod, hash2, noise3, PALETTE_RGB, pointer } from './core.js';

const LEVELS = 16; // white mix, quantised

// Colour strings, prebuilt: 4 colours × 16 steps towards white, and the same towards black.
const LUT = []; const DIM = [];
for (const [r, g, b] of PALETTE_RGB) {
  for (let k = 0; k < LEVELS; k++) {
    const w = (k / (LEVELS - 1)) * 0.85;
    LUT.push(`rgb(${Math.round(r + (255 - r) * w)} ${Math.round(g + (255 - g) * w)} ${Math.round(b + (255 - b) * w)})`);
    const d = 1 - (k / (LEVELS - 1)) * 0.82;
    DIM.push(`rgb(${Math.round(r * d)} ${Math.round(g * d)} ${Math.round(b * d)})`);
  }
}

export class CellField {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{cols:number, rows:number, cells:{i:number,j:number,ref?:number}[]}} grid
   * @param {object} o  options: gap (0..1 of a cell), flow (steps a second), scale (field frequency), halo (cells),
   *                    haloSteps, repel (px), fit ('contain' | 'width')
   */
  constructor(canvas, grid, o = {}) {
    this.cv = canvas; this.g = canvas.getContext('2d', { alpha: true });
    this.cols = grid.cols; this.rows = grid.rows; this.cells = grid.cells;
    this.o = { gap: 0.125, flow: 0.15, scale: 0.06, halo: 4.6, haloSteps: 2.4, repel: 2.2, lift: 0.18, ...o };
    const n = this.cells.length;
    this.ref = new Int8Array(n); this.f0 = new Float32Array(n); this.infl = new Float32Array(n);
    this.flash = new Float32Array(n); this.extra = new Int16Array(n); this.appear = new Float32Array(n).fill(1);
    this.glint = new Float32Array(n); this.seed = new Float32Array(n); this.hidden = new Uint8Array(n);
    this.cells.forEach((c, k) => {
      this.ref[k] = c.ref ?? 0; this.f0[k] = this.field(c.i, c.j, 0); this.seed[k] = hash2(c.i * 7 + 3, c.j * 13 + 5);
    });
    this.t = 0; this.base = 0; this.ripples = []; this.spread = 0; this.alpha = 1; this.active = true; this.dimmed = 0;
    this.rect = null; this.dpr = 1; this.px = 1;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  // The smooth field the bands flow on (in steps). Its gradient sets how fast the fronts move.
  field(i, j, t) {
    const s = this.o.scale;
    return 2.4 * noise3(i * s, j * s, t * 0.025) + 0.7 * noise3(i * s * 2.6 + 9.1, j * s * 2.6 + 3.7, t * 0.045);
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(r.width * this.dpr); const H = Math.round(r.height * this.dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.px = Math.min(W / this.cols, H / this.rows);                       // a cell, in device px
    this.ox = (W - this.px * this.cols) / 2; this.oy = (H - this.px * this.rows) / 2;
    this.dirty = true;
  }

  // A press: a ring that runs out from (x, y) in client px, lights its front and moves every cell it passes one step on.
  ripple(x, y, speed = 34) {
    const c = this.toCell(x, y);
    this.ripples.push({ x: c.x, y: c.y, t0: this.t, speed });
  }
  toCell(x, y) {
    const r = this.rect || this.cv.getBoundingClientRect();
    const k = this.dpr / this.px;
    return { x: ((x - r.left) * this.dpr - this.ox) / this.px, y: ((y - r.top) * this.dpr - this.oy) / this.px, inside: x >= r.left && x <= r.right && y >= r.top && y <= r.bottom, k };
  }

  step(dt) {
    this.t += dt;
    const { o } = this; const n = this.cells.length; const t = this.t;
    this.rect = this.cv.getBoundingClientRect();
    // the pointer, in cells (anything outside a margin round the field counts as gone)
    const p = this.toCell(pointer.x, pointer.y);
    const near = pointer.active && this.active && p.x > -o.halo * 2 && p.x < this.cols + o.halo * 2 && p.y > -o.halo * 2 && p.y < this.rows + o.halo * 2;
    const inv = 1 / (2 * o.halo * o.halo);
    // ripples: retire the ones that have crossed the whole field (their step is baked into the base)
    const far = Math.hypot(this.cols, this.rows) + 4;
    for (let r = this.ripples.length - 1; r >= 0; r--) {
      const rp = this.ripples[r];
      if ((t - rp.t0) * rp.speed > far) { this.base += 1; this.ripples.splice(r, 1); }
    }
    this.idx = this.idx || new Int8Array(n); this.white = this.white || new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const c = this.cells[k];
      const d2 = near ? (c.i + 0.5 - p.x) ** 2 + (c.j + 0.5 - p.y) ** 2 : 1e9;
      this.infl[k] = damp(this.infl[k], near ? Math.exp(-d2 * inv) : 0, near ? 9 : 4, dt);
      let steps = Math.floor(this.field(c.i, c.j, t) + t * o.flow) - Math.floor(this.f0[k]) + Math.floor(this.infl[k] * o.haloSteps) + this.extra[k] + this.base;
      let w = this.flash[k] + this.glint[k];
      for (const rp of this.ripples) {
        const d = Math.hypot(c.i + 0.5 - rp.x, c.j + 0.5 - rp.y); const front = (t - rp.t0) * rp.speed;
        if (d < front) steps += 1;
        const e = 1 - Math.abs(d - front) / 2.2;
        if (e > 0) w += e * 0.75;
      }
      this.flash[k] = damp(this.flash[k], 0, 5, dt);
      this.idx[k] = mod(this.ref[k] + steps, 4);
      this.white[k] = clamp(w, 0, 1);
    }
  }

  draw() {
    const { g, o } = this; const n = this.cells.length;
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (this.alpha <= 0.001) return;
    g.globalAlpha = this.alpha;
    const px = this.px; const sz0 = px * (1 - o.gap); const pad = (px - sz0) / 2;
    const p = this.toCell(pointer.x, pointer.y); const sp = this.spread;
    const repel = o.repel * this.dpr; const cx = this.cols / 2; const cy = this.rows / 2;
    for (let k = 0; k < n; k++) {
      if (this.hidden[k]) continue;
      const c = this.cells[k]; const a = this.appear[k];
      if (a <= 0) continue;
      const q = a >= 1 ? 1 : Math.ceil(a * 4) / 4;                      // grows in four steps, like a pixel would
      const inf = this.infl[k];
      const sz = Math.max(1, sz0 * q * (1 + o.lift * inf));
      let x = this.ox + c.i * px + pad + (sz0 - sz) / 2; let y = this.oy + c.j * px + pad + (sz0 - sz) / 2;
      if (inf > 0.02) { // pushed out from under the pointer
        const dx = c.i + 0.5 - p.x; const dy = c.j + 0.5 - p.y; const d = Math.hypot(dx, dy) || 1;
        x += (dx / d) * repel * inf; y += (dy / d) * repel * inf;
      }
      if (sp > 0) { // the scroll takes the mark apart
        const h = this.seed[k];
        x += ((c.i - cx) * 0.5 + (h - 0.5) * 14) * sp * px;
        y += ((c.j - cy) * 0.3 - h * 10 * sp) * sp * px;
      }
      const wq = Math.round(clamp(this.white[k] + (1 - a) * 0.9, 0, 1) * (LEVELS - 1));
      const dim = this.dimmed * (this.dimMask ? this.dimMask[k] : 1);
      g.fillStyle = dim > 0.01 ? DIM[this.idx[k] * LEVELS + Math.round(dim * (LEVELS - 1))] : LUT[this.idx[k] * LEVELS + wq];
      g.fillRect(Math.round(x), Math.round(y), Math.round(sz), Math.round(sz));
    }
    g.globalAlpha = 1;
  }
}

// Turn a text string into cells by drawing it on a small canvas and keeping the lit pixels.
export function textToGrid(text, { font = '900 10px Doto', height = 11, pad = 1, threshold = 110 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d', { willReadFrequently: true });
  g.font = font; const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = height + pad * 2;
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  g.fillText(text, pad, pad + Math.round(height * 0.82));
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const cells = [];
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > threshold) cells.push({ i, j });
  return { cols: c.width, rows: c.height, cells };
}
