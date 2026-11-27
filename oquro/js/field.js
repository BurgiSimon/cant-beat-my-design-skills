// Behind the call to action: the vault's wheel again, drawn in a grid of dots like the about card's display. It turns
// as you scroll, idles slowly otherwise, and the pointer is a lens that swells the dots under it.

import { calm, fine, whenVisible, loop, scroll, damp } from './core.js';

const SEG = Math.PI / 4, RIV = Math.PI / 10;

// the wheel as a distance field. The parts that don't turn (rim, inner ring, hub, twenty rivets) are worked out once
// per dot when the canvas is sized; a frame only adds the eight spokes with their knobs, and only near the middle
function fixed(x, y, r) {
  let d = Math.abs(r - 1) - 0.035;                       // the door's rim
  d = Math.min(d, Math.abs(r - 0.62) - 0.02);            // the wheel's ring
  d = Math.min(d, r - 0.14);                             // hub
  const b = Math.round(Math.atan2(y, x) / RIV) * RIV;    // rivets: the nearest is the one nearest in angle
  return Math.min(d, Math.hypot(x - Math.cos(b) * 0.88, y - Math.sin(b) * 0.88) - 0.025);
}

export function init() {
  const canvas = document.querySelector('[data-vault-field]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sec = canvas.closest('section');
  let W = 0, H = 0, D = 1, step = 14;
  // per dot: its place in px and around the wheel, its shimmer's phase (as sin and cos), the fixed parts' distance
  let n = 0, px, py, nx, ny, nr, th, ps, pc, fd;
  const sc = new Float64Array(8), ss = new Float64Array(8);
  const resize = () => {
    const r = canvas.getBoundingClientRect(); D = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
    step = W < 700 ? 11 : 14;
    const R = Math.min(W, H) * 0.46; const cx = W / 2, cy = H / 2;
    const max = Math.ceil(W / step + 1) * Math.ceil(H / step + 1);
    [px, py, nx, ny, nr, th, ps, pc, fd] = Array.from({ length: 9 }, () => new Float64Array(max)); n = 0;
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const u = (x - cx) / R, v = (y - cy) / R, ur = Math.hypot(u, v), p = x * 0.05 + y * 0.03;
        px[n] = x; py[n] = y; nx[n] = u; ny[n] = v; nr[n] = ur; th[n] = Math.atan2(v, u);
        ps[n] = Math.sin(p); pc[n] = Math.cos(p); fd[n] = fixed(u, v, ur); n++;
      }
    }
  };
  resize(); new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
  const ptr = { x: -1e4, y: -1e4, k: 0, tk: 0 };
  if (fine && !calm) {
    sec.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.tk = 1; });
    sec.addEventListener('pointerleave', () => { ptr.tk = 0; });
  }

  let t = 0; let a = 0;
  function draw() {
    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ptr.k = damp(ptr.k, ptr.tk, 4, 1 / 60);
    const pk = ptr.k, st = Math.sin(t), ct = Math.cos(t);
    for (let j = 0; j < 8; j++) { sc[j] = Math.cos(j * SEG + a); ss[j] = Math.sin(j * SEG + a); }  // the spokes' headings
    let red = false; ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      let d = fd[i];
      // past 0.92 the spokes and knobs are too far to light a dot (the glow reaches 1/9 out)
      if (nr[i] < 0.92) {
        const j = Math.round((th[i] - a) / SEG) & 7, c = sc[j], s = ss[j], x = nx[i], y = ny[i];
        const along = x * c + y * s, across = Math.abs(-x * s + y * c);
        d = Math.min(d, Math.max(across - 0.025, Math.max(along - 0.72, 0.14 - along)));  // spoke
        d = Math.min(d, Math.hypot(x - c * 0.74, y - s * 0.74) - 0.06);                  // knob
      }
      const v = d < 0 ? 1 : Math.max(0, 1 - d * 9);
      let lens = 0;
      if (pk > 0) { const dx = px[i] - ptr.x, dy = py[i] - ptr.y, q = dx * dx + dy * dy; if (q < 19600) lens = pk * (1 - Math.sqrt(q) / 140); }
      const base = 0.06 + 0.03 * (ps[i] * ct + pc[i] * st);  // sin(x * 0.05 + y * 0.03 + t)
      const r = 0.9 + v * 1.1 + lens * 1.6;
      // two colours, the alpha as globalAlpha: no colour string to build and parse for every dot
      if ((v > 0.6 && lens > 0.3) !== red) { red = !red; ctx.fillStyle = red ? '#ff6e64' : '#fff'; }
      ctx.globalAlpha = Math.min(1, base + v * (0.32 + lens * 0.5));
      ctx.fillRect(px[i] - r, py[i] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  let lastY = scroll.y;
  const run = loop((dt) => {
    t += dt;
    a += dt * 0.08 + (scroll.y - lastY) * 0.0016; lastY = scroll.y;
    draw();
  });
  draw();
  if (calm) return;
  whenVisible(sec, (v) => run.set(v), '0px'); // only while the section itself is on screen, not the footer below it
}
