// Behind the call to action: the vault's wheel again, drawn in a grid of dots like the about card's display. It turns
// as you scroll, idles slowly otherwise, and the pointer is a lens that swells the dots under it.

import { calm, fine, whenVisible, loop, scroll, damp } from './core.js';

export function init() {
  const canvas = document.querySelector('[data-vault-field]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sec = canvas.closest('section');
  let W = 0, H = 0, D = 1, step = 14;
  const resize = () => {
    const r = canvas.getBoundingClientRect(); D = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
    step = W < 700 ? 11 : 14;
  };
  resize(); new ResizeObserver(resize).observe(canvas);
  const ptr = { x: -1e4, y: -1e4, k: 0, tk: 0 };
  if (fine && !calm) {
    sec.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.tk = 1; });
    sec.addEventListener('pointerleave', () => { ptr.tk = 0; });
  }

  // the wheel as a distance field: rim, inner ring, hub, eight spokes with knobs
  const sd = (x, y, a) => {
    const r = Math.hypot(x, y);
    let d = Math.abs(r - 1) - 0.035;                       // the door's rim
    d = Math.min(d, Math.abs(r - 0.62) - 0.02);            // the wheel's ring
    d = Math.min(d, r - 0.14);                             // hub
    const ang = Math.atan2(y, x) - a; const seg = Math.PI / 4;
    const k = Math.round(ang / seg) * seg; const c = Math.cos(k + a), s = Math.sin(k + a);
    const along = x * c + y * s, across = Math.abs(-x * s + y * c);
    d = Math.min(d, Math.max(across - 0.025, Math.max(along - 0.72, 0.14 - along)));  // spoke
    d = Math.min(d, Math.hypot(x - c * 0.74, y - s * 0.74) - 0.06);                  // knob
    for (let i = 0; i < 20; i++) { const b = (i / 20) * Math.PI * 2; d = Math.min(d, Math.hypot(x - Math.cos(b) * 0.88, y - Math.sin(b) * 0.88) - 0.025); } // rivets
    return d;
  };

  let t = 0; let a = 0;
  function draw() {
    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * 0.46; const cx = W / 2, cy = H / 2;
    ptr.k = damp(ptr.k, ptr.tk, 4, 1 / 60);
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const nx = (x - cx) / R, ny = (y - cy) / R;
        const d = sd(nx, ny, a);
        let v = d < 0 ? 1 : Math.max(0, 1 - d * 9);
        const lens = ptr.k * Math.max(0, 1 - Math.hypot(x - ptr.x, y - ptr.y) / 140);
        const base = 0.06 + 0.03 * Math.sin(x * 0.05 + y * 0.03 + t);
        const alpha = Math.min(1, base + v * (0.32 + lens * 0.5));
        const rad = 0.9 + v * 1.1 + lens * 1.6;
        ctx.fillStyle = v > 0.6 && lens > 0.3 ? `rgba(255,110,100,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
  }
  let lastY = scroll.y;
  const run = loop((dt) => {
    t += dt;
    a += dt * 0.08 + (scroll.y - lastY) * 0.0016; lastY = scroll.y;
    draw();
  });
  draw();
  if (calm) return;
  whenVisible(sec, (v) => run.set(v));
}
