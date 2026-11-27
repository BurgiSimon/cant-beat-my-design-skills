// The about card: a figure on their phone, as a security camera sees them. A dark silhouette with film grain over a
// field of pink zigzags on the left and grey static on the right, drawn pixel by pixel at a camera's 12 frames a second.
// The zigzags drift, bulge round the pointer, and every few seconds a slice of the picture glitches sideways.

import { calm, fine, whenVisible, loop, clamp } from './core.js';

// The figure, in the card's design px (583 × 366): head bowed to the phone, arm up, a bag strap across the back.
function drawFigure(g) {
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  // head, bowed
  g.save(); g.translate(176, 98); g.rotate(-0.38); g.beginPath(); g.ellipse(0, 0, 26, 31, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.beginPath(); g.moveTo(152, 98); g.quadraticCurveTo(140, 112, 147, 118); g.quadraticCurveTo(152, 124, 160, 128); g.lineTo(172, 118); g.fill(); // nose, mouth, chin
  // hood folds at the back of the head
  g.beginPath(); g.moveTo(186, 70); g.quadraticCurveTo(214, 84, 210, 118); g.quadraticCurveTo(206, 136, 190, 140); g.lineTo(178, 112); g.fill();
  // body
  g.beginPath();
  g.moveTo(184, 124);
  g.bezierCurveTo(205, 136, 228, 144, 242, 162);
  g.bezierCurveTo(256, 182, 262, 220, 265, 262);
  g.bezierCurveTo(268, 302, 272, 338, 276, 370);
  g.lineTo(140, 370);
  g.bezierCurveTo(144, 332, 148, 300, 152, 268);
  g.bezierCurveTo(155, 236, 157, 202, 161, 174);
  g.bezierCurveTo(162, 156, 165, 140, 172, 128);
  g.closePath(); g.fill();
  // arm: upper, fore, hands (out in front of the body, holding the phone up)
  g.lineWidth = 30; g.beginPath(); g.moveTo(212, 168); g.quadraticCurveTo(196, 214, 182, 250); g.stroke();
  g.lineWidth = 22; g.beginPath(); g.moveTo(182, 250); g.quadraticCurveTo(140, 250, 104, 230); g.stroke();
  g.beginPath(); g.ellipse(100, 226, 13, 10, -0.5, 0, Math.PI * 2); g.fill();
}
function drawStrap(g) {
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.lineWidth = 8; g.beginPath(); g.moveTo(228, 150); g.quadraticCurveTo(262, 250, 300, 372); g.stroke();
}
function drawPhone(g) {
  g.fillStyle = '#fff'; g.save(); g.translate(92, 214); g.rotate(-0.55); g.fillRect(-5, -10, 10, 19); g.restore();
}

export function init() {
  const fig = document.querySelector('[data-monitor]');
  const canvas = document.querySelector('[data-monitor-canvas]');
  if (!fig || !canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  // per size: the figure's, the strap's and the phone's coverage (a byte a pixel) and the terms that only change by
  // column, so a frame does as little as it can per pixel
  let W = 0, H = 0, S = 1, img = null, data = null, figA = null, strapA = null, phoneA = null, colG = null, colV = null, tri = null;

  function layout() {
    // the box's own size: getBoundingClientRect would also count the parallax's scale on the canvas
    const q = Math.min(1.5, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * q)), h = Math.max(1, Math.round(canvas.clientHeight * q));
    if (img && w === W && h === H) return false;
    W = w; H = h; canvas.width = W; canvas.height = H; S = W / 583;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const g = off.getContext('2d', { willReadFrequently: true });
    const read = (draw) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(S, 0, 0, S, 0, 0); draw(g);
      const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
      for (let p = 0; p < a.length; p++) a[p] = d[p * 4 + 3];
      return a;
    };
    figA = read(drawFigure); strapA = read(drawStrap); phoneA = read(drawPhone);
    colG = new Float64Array(W); colV = new Float64Array(W); tri = new Float64Array(W);
    for (let x = 0; x < W; x++) { colG[x] = (x / W - 0.53) * 14; const vx = x / W - 0.5; colV[x] = vx * vx; }
    img = ctx.createImageData(W, H); data = img.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    return true;
  }

  // a fast xorshift for the grain
  let seed = 1234567;

  let t = 0; let glitchAt = 2.5; let glitchY = 0, glitchH = 0, glitchDx = 0;
  const ptr = { x: -1e4, y: -1e4, k: 0 };
  if (fine) {
    fig.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) * (W / r.width); ptr.y = (e.clientY - r.top) * (H / r.height); });
    fig.addEventListener('pointerleave', () => { ptr.x = ptr.y = -1e4; });
  }

  // a frame is fixed when it starts (time, pointer, glitch) and then painted in bands of rows
  const fr = { t: 0, x: -1e4, y: -1e4, gy: 0, gh: 0, gdx: 0 };
  function begin() {
    fr.t = t; fr.x = ptr.x; fr.y = ptr.y; fr.gy = glitchY; fr.gh = glitchH; fr.gdx = glitchDx;
    const split = Math.round(W * 0.53), period = 6.2 * S, phase = t * 7 * S;
    for (let x = 0; x < split; x++) tri[x] = Math.abs(((x + phase) / period) % 1 - 0.5) * 2;  // the zigzag, by column
  }
  function paint(y0, y1) {
    const split = Math.round(W * 0.53);
    const rowH = 7.2 * S, amp = 2.3 * S, lineW = 1.15 * S;
    const scan = ((fr.t * 0.22) % 1.4) * H;
    const R = 70 * S, RR = R * R, soft = 0.9 * S, half = lineW * 0.5, sw = 6 * S;
    const px = fr.x, py = fr.y, gy = fr.gy, gh = fr.gh, gdx = fr.gdx;
    let sd = seed;
    for (let y = y0, i = y0 * W * 4; y < y1; y++) {
      const inGlitch = gh > 0 && y >= gy && y < gy + gh;
      const vy = y / H, rowG = 60 + (1 - vy) * 10, figV = 20 + (1 - vy) * 14, vv = (vy - 0.5) * (vy - 0.5);
      const sl = Math.max(0, 1 - Math.abs(y - scan) / sw) * 16;
      const dy = y - py, near = dy * dy < RR, row = y * W;
      for (let x = 0; x < W; x++, i += 4) {
        const sx = inGlitch ? clamp(x - gdx, 0, W - 1) : x, si = row + sx;
        sd ^= sd << 13; sd ^= sd >>> 17; sd ^= sd << 5; const n = ((sd >>> 0) & 0xffff) / 0xffff;
        let r, g, b, grain;
        if (sx < split) {
          // zigzags over a dark plum, bulging round the pointer
          let a = amp;
          if (near) { const dx = sx - px; const d2 = dx * dx + dy * dy; if (d2 < RR) a += (1 - Math.sqrt(d2) / R) * 4 * S; }
          const yy = y + tri[sx] * a;
          const m = yy - Math.floor(yy / rowH) * rowH; const d = Math.min(m, rowH - m);
          let cov = 1 - (d - half) / soft; cov = (cov < 0 ? 0 : cov > 1 ? 1 : cov) * 0.9;
          r = 38 + (212 - 38) * cov; g = 31 + (114 - 31) * cov; b = 34 + (132 - 34) * cov;
          grain = (n - 0.5) * 26;
        } else {
          // grey static, lighter towards the top right
          r = g = b = rowG + colG[sx];
          grain = (n - 0.5) * 44;
        }
        const fa = figA[si];
        if (fa > 0) {
          const f = fa / 255, st = strapA[si] / 255, ph = phoneA[si] / 255;
          const v = figV + st * 46;
          r = r * (1 - f) + v * f; g = g * (1 - f) + v * f; b = b * (1 - f) + v * f;
          if (ph > 0) { r += ph * 30; g += ph * 22; b += ph * 26; }
        }
        // grain, scanline, vignette
        const vig = 1 - (colV[x] + vv) * 0.5;
        data[i] = (r + grain + sl) * vig; data[i + 1] = (g + grain + sl) * vig; data[i + 2] = (b + grain + sl) * vig;
      }
    }
    seed = sd;
  }
  let next = Infinity; // the next row of the frame in hand
  function draw() { if (!data) return; begin(); paint(0, H); next = Infinity; ctx.putImageData(img, 0, 0); }

  // 12 frames a second, each spread over the ticks of its twelfth (done in about four fifths of it), so no one tick
  // carries a whole frame
  let acc = 0;
  const run = loop((dt) => {
    t += dt; acc += dt;
    if (t > glitchAt) { glitchAt = t + 2.5 + Math.random() * 4; glitchY = Math.random() * H * 0.8; glitchH = (8 + Math.random() * 30) * S; glitchDx = Math.round((Math.random() - 0.5) * 40 * S); setTimeout(() => { glitchH = 0; }, 110); }
    if (next >= H) { if (acc < 1 / 12) return; acc = 0; begin(); next = 0; }
    const y1 = Math.min(H, next + Math.ceil(H * dt * 15)); paint(next, y1); next = y1;
    if (next >= H) ctx.putImageData(img, 0, 0);
  });
  layout(); draw();
  new ResizeObserver(() => { if (layout()) draw(); }).observe(canvas);
  if (calm) return;
  whenVisible(fig, (v) => run.set(v));
}
