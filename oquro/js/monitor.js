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
  let W = 0, H = 0, S = 1, img = null, data = null, figA = null, strapA = null, phoneA = null;

  function layout() {
    const r = canvas.getBoundingClientRect();
    const q = Math.min(1.5, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * q)); H = Math.max(1, Math.round(r.height * q));
    canvas.width = W; canvas.height = H; S = W / 583;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const g = off.getContext('2d', { willReadFrequently: true });
    const read = (draw) => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(S, 0, 0, S, 0, 0); draw(g); return g.getImageData(0, 0, W, H).data; };
    figA = read(drawFigure); strapA = read(drawStrap); phoneA = read(drawPhone);
    img = ctx.createImageData(W, H); data = img.data;
  }

  // a fast xorshift for the grain
  let seed = 1234567;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) & 0xffff) / 0xffff; };

  let t = 0; let glitchAt = 2.5; let glitchY = 0, glitchH = 0, glitchDx = 0;
  const ptr = { x: -1e4, y: -1e4, k: 0 };
  if (fine) {
    fig.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) * (W / r.width); ptr.y = (e.clientY - r.top) * (H / r.height); });
    fig.addEventListener('pointerleave', () => { ptr.x = ptr.y = -1e4; });
  }

  function draw() {
    if (!data) return;
    const split = Math.round(W * 0.53);
    const rowH = 7.2 * S, amp = 2.3 * S, period = 6.2 * S, lineW = 1.15 * S;
    const phase = t * 7 * S;
    const scan = ((t * 0.22) % 1.4) * H;
    const R = 70 * S;
    for (let y = 0; y < H; y++) {
      const inGlitch = glitchH > 0 && y >= glitchY && y < glitchY + glitchH;
      const vy = y / H;
      for (let x = 0; x < W; x++) {
        const sx = inGlitch ? clamp(x - glitchDx, 0, W - 1) : x;
        const i = (y * W + x) * 4; const si = (y * W + sx) * 4;
        const n = rnd();
        let r, g, b;
        if (sx < split) {
          // zigzags over a dark plum, bulging round the pointer
          let a = amp;
          const dx = sx - ptr.x, dy = y - ptr.y; const d2 = dx * dx + dy * dy;
          if (d2 < R * R) a += (1 - Math.sqrt(d2) / R) * 4 * S;
          const tri = Math.abs(((sx + phase) / period) % 1 - 0.5) * 2;
          const yy = y + tri * a;
          const m = yy % rowH; const d = Math.min(m, rowH - m);
          const cov = clamp(1 - (d - lineW * 0.5) / (0.9 * S), 0, 1) * 0.9;
          r = 38 + (212 - 38) * cov; g = 31 + (114 - 31) * cov; b = 34 + (132 - 34) * cov;
        } else {
          // grey static, lighter towards the top right
          const base = 60 + (1 - vy) * 10 + (sx / W - 0.53) * 14;
          r = g = b = base;
        }
        const f = figA[si + 3] / 255;
        if (f > 0) {
          const st = strapA[si + 3] / 255; const ph = phoneA[si + 3] / 255;
          let v = 20 + (1 - vy) * 14 + st * 46;
          r = r * (1 - f) + v * f; g = g * (1 - f) + v * f; b = b * (1 - f) + v * f;
          if (ph > 0) { r += ph * 30; g += ph * 22; b += ph * 26; }
        }
        // grain, scanline, vignette
        const grain = (n - 0.5) * (sx < split ? 26 : 44);
        const sl = Math.max(0, 1 - Math.abs(y - scan) / (6 * S)) * 16;
        const vx = x / W - 0.5, vv = vy - 0.5; const vig = 1 - (vx * vx + vv * vv) * 0.5;
        data[i] = (r + grain + sl) * vig; data[i + 1] = (g + grain + sl) * vig; data[i + 2] = (b + grain + sl) * vig; data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let acc = 0;
  const run = loop((dt) => {
    t += dt; acc += dt;
    if (t > glitchAt) { glitchAt = t + 2.5 + Math.random() * 4; glitchY = Math.random() * H * 0.8; glitchH = (8 + Math.random() * 30) * S; glitchDx = Math.round((Math.random() - 0.5) * 40 * S); setTimeout(() => { glitchH = 0; }, 110); }
    if (acc < 1 / 12) return; acc = 0;
    draw();
  });
  layout(); draw();
  new ResizeObserver(() => { layout(); draw(); }).observe(canvas);
  if (calm) return;
  whenVisible(fig, (v) => run.set(v));
}
