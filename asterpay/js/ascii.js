// The last call to action stands on a field of money in type: digits and currency signs, brightest where the
// orange horizon rises at the foot, drifting upwards like heat. The pointer is a lens: under it the field wakes
// up and the glyphs scramble. With reduced motion it is drawn once and holds still.

import { calm, fine, pointer, whenVisible, seeded, on, clamp } from './core.js';
import { createHorizon } from './glow.js';

const RAMP = [' ', ' ', '.', '·', ':', '-', '=', '+', '*', '$', '%', '#'];
const SCRAMBLE = '0123456789$€£¥%#+';

export function init() {
  const section = document.querySelector('.cta');
  const cv = section?.querySelector('.cta__ascii');
  if (!cv) return;
  const g = cv.getContext('2d');

  // the hero's horizon again, low in the section; it rises as the section comes up the screen
  try {
    const gl = section.querySelector('.cta__gl');
    const hz = createHorizon(gl, {
      host: section, followScroll: false,
      map: () => { const w = section.clientWidth; const h = section.clientHeight; const s = Math.max(w / 1440, 0.62); return { s, ox: w / 2 - 720 * s, oy: h * 0.86 - 716 * s }; },
    });
    if (hz) {
      section.classList.add('has-gl');
      const rise = () => {
        const r = section.getBoundingClientRect();
        hz.state.intro = calm ? 1 : clamp((innerHeight - r.top) / (innerHeight * 0.85), 0, 1);
        if (calm) hz.redraw();
      };
      on('scroll', rise); rise();
      addEventListener('resize', () => hz.relayout());
    }
  } catch (e) { console.warn('[asterpay] no WebGL horizon in the CTA:', e.message); }

  const rand = seeded(5);
  const perm = Array.from({ length: 512 }, () => rand());
  const hash = (i, j) => perm[(i * 73 + j * 151) & 511];
  const sm = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const i = Math.floor(x); const j = Math.floor(y); const u = sm(x - i); const v = sm(y - j);
    const a = hash(i, j); const b = hash(i + 1, j); const c = hash(i, j + 1); const d = hash(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  let W = 0; let H = 0; let dpr = 1; const CW = 11; const CH = 18;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = section.clientWidth; H = section.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  };
  resize();
  new ResizeObserver(() => { resize(); if (calm) draw(0); }).observe(section);

  const lens = { x: -999, y: -999, a: 0 };
  function draw(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.font = '500 12px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cols = Math.ceil(W / CW); const rows = Math.ceil(H / CH);
    const tick = Math.floor(t * 12);
    // the copy sits in the middle: keep the field quiet behind it
    const qx = W / 2; const qy = H * 0.46; const qw = Math.min(W * 0.36, 420); const qh = H * 0.3;
    for (let j = 0; j < rows; j++) {
      const v = (j + 0.5) / rows;
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols;
        const x = i * CW + CW / 2; const y = j * CH + CH / 2;
        const du = (u - 0.5) / 0.42; const dv = (v - 1.02) / 0.34;
        const glow = Math.exp(-(du * du + dv * dv));
        const n = noise(i * 0.11 + t * 0.06, j * 0.16 + t * 0.32);
        const n2 = noise(i * 0.05 - t * 0.03, j * 0.07 + t * 0.12);
        let val = glow * (0.45 + 0.75 * n) + 0.2 * n2 * n2 * (1 - v * 0.3);
        const ldx = x - lens.x; const ldy = y - lens.y; const ld = Math.sqrt(ldx * ldx + ldy * ldy) / 170;
        const inLens = ld < 1 ? (1 - ld) ** 2 * lens.a : 0;
        val += inLens * 0.6;
        const qxd = (x - qx) / qw; const qyd = (y - qy) / qh;
        const quiet = Math.exp(-(qxd * qxd + qyd * qyd) * 1.4);
        val *= 1 - quiet * 0.7;
        let idx = Math.floor(Math.min(0.999, Math.max(0, val)) * RAMP.length);
        let ch = RAMP[idx];
        if (inLens > 0.15 && hash(i + tick, j) < 0.35) ch = SCRAMBLE[Math.floor(hash(i * 7 + tick, j * 3) * SCRAMBLE.length)];
        else if (ch !== ' ' && hash(i, j) < 0.05 && val > 0.35) ch = SCRAMBLE[Math.floor(hash(i + Math.floor(t * 2), j) * 10)];
        if (ch === ' ') continue;
        const k = Math.min(1, val);
        const r = Math.round(150 + 105 * k); const gg = Math.round(140 - 40 * k + 20 * (1 - k)); const b = Math.round(135 - 85 * k);
        g.fillStyle = `rgba(${r},${gg},${b},${(0.08 + 0.62 * k * k + inLens * 0.3).toFixed(3)})`;
        g.fillText(ch, x, y);
      }
    }
  }

  if (calm) { draw(3); return; }
  let raf = 0; let visible = false; let last = 0; let t = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (dt > 0) t += dt;
    const r = cv.getBoundingClientRect();
    const on = fine && pointer.active && pointer.y > r.top && pointer.y < r.bottom;
    if (on) { lens.x += (pointer.x - r.left - lens.x) * 0.2; lens.y += (pointer.y - r.top - lens.y) * 0.2; }
    lens.a += ((on ? 1 : 0) - lens.a) * 0.08;
    draw(t);
    if (visible && !document.hidden) raf = setTimeout(() => requestAnimationFrame(frame), 33); // ~30 fps is plenty for type
  };
  whenVisible(section, (v) => { visible = v; if (v && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(frame); });
}
