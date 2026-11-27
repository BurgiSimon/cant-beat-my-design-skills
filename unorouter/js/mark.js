// The hero's art: the mark as 52 × 48 cells, starting on the shot's own colours. The bands flow; the pointer is a
// halo that shifts the colours under it and pushes the cells aside; a press sends a ring across that moves every
// cell a colour on and routes a request: a glint runs down one of the bars, along its arm and out through one of
// the rays, which lights up as it lands. Left alone it routes one now and then by itself. Scrolling takes it apart.

import { calm, emit, on, once, loop, clamp, seeded, scroll, fine } from './core.js';
import { CellField } from './cells.js';

// The shot, cell by cell: '.' is empty, 0–3 are yellow, orange, pink, magenta.
const ART = [
  '111122....333300....................003332....221111',
  '111222....330000....................000033....222211',
  '122222....000011....................110000....222211',
  '112223....000111....................111100....222221',
  '222223....011111....................111100....222221',
  '222333....111111....................111111....322221',
  '223333....111111....................211111....332222',
  '223330....112222....................222111....032222',
  '223300....122222....................222211....003222',
  '333300....122222....................222211....003222',
  '333000....222222....................222222....000322',
  '333001....222333....................322222....100332',
  '330011....222333....................332222....110032',
  '330011....223333....................333222....110033',
  '300111....233330....................033322....110003',
  '301111....233300....................003332....111003',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '0011122222330011....................1110333222111100',
  '0011112222300011....................1110032222211100',
  '0011122223300111....................1110032222111100',
  '0011122222300011....................1100032222111100',
  '0011122222300111....................1100032222111100',
  '0111122223300011....................1100032222111000',
  '....................................................',
  '....................................................',
  '....................................................',
  '........22................................22........',
  '.......222........11............11........222.......',
  '.....112223......1111..........1111......222211.....',
  '...111122223.....111111......111111.....222211111...',
  '...111122222....00011111....11111000....222111110...',
  '...111112222....0000111......1110000....222111111...',
  '....1111222....3300000........0000033....2221111....',
  '.....1111.....23330000........00003322.....1111.....',
  '.....01.......2233330..........0333222.......11.....',
  '.............22223333..........33322222.............',
  '.............2222223............2222221.............',
  '............22222222...233322...22222111............',
  '............1112222....222222....2211111............',
  '...........1111122.....222222.....2111111...........',
  '..........01111111.....222222.....11111111..........',
  '...........011111......121222......111110...........',
  '.............0111......111111......1110.............',
  '...............1.......111111.......1...............',
  '.......................111111.......................',
].join('');

const COLS = 52; const ROWS = 48;

export function grid() {
  const cells = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const ch = ART[j * COLS + i];
    if (ch !== '.') cells.push({ i, j, ref: +ch });
  }
  return { cols: COLS, rows: ROWS, cells };
}

// Connected parts of the mark (4-neighbours): the four bars, the two arms, the five rays.
function parts(cells) {
  const at = new Map(cells.map((c, k) => [c.j * COLS + c.i, k]));
  const comp = new Int16Array(cells.length).fill(-1); const list = [];
  cells.forEach((c, k) => {
    if (comp[k] >= 0) return;
    const id = list.length; const members = []; const stack = [k]; comp[k] = id;
    while (stack.length) {
      const m = stack.pop(); members.push(m); const { i, j } = cells[m];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = at.get((j + dj) * COLS + i + di);
        if (q !== undefined && comp[q] < 0 && i + di >= 0 && i + di < COLS) { comp[q] = id; stack.push(q); }
      }
    }
    const xs = members.map((m) => cells[m].i); const ys = members.map((m) => cells[m].j);
    list.push({ members, x0: Math.min(...xs), x1: Math.max(...xs) + 1, y0: Math.min(...ys), y1: Math.max(...ys) + 1,
      cx: xs.reduce((a, b) => a + b, 0) / xs.length + 0.5, cy: ys.reduce((a, b) => a + b, 0) / ys.length + 0.5 });
  });
  return { comp, list };
}

export function init() {
  const canvas = document.querySelector('.art');
  const host = document.querySelector('.hero__art');
  if (!canvas || !host || !canvas.getContext) return;
  const g = grid();
  const art = new CellField(canvas, g, { gap: 0.125, flow: 0.1, scale: 0.055 });
  const { comp, list } = parts(g.cells);
  document.documentElement.classList.add('has-art');

  // Name the parts: bars are tall, arms are wide, rays are the rest, ordered left to right.
  const bars = list.filter((p) => p.y1 <= 17).sort((a, b) => a.cx - b.cx);
  const arms = list.filter((p) => p.y0 >= 19 && p.y1 <= 27).sort((a, b) => a.cx - b.cx);
  const rays = list.filter((p) => p.y0 >= 28).sort((a, b) => a.cx - b.cx);
  const FOCUS = { x: 26, y: 22 };
  for (const r of rays) { // where a request enters a ray (nearest the focus) and where it leaves (farthest)
    let nearD = 1e9; let farD = -1;
    for (const m of r.members) {
      const c = g.cells[m]; const d = Math.hypot(c.i + 0.5 - FOCUS.x, c.j + 0.5 - FOCUS.y);
      if (d < nearD) { nearD = d; r.in = { x: c.i + 0.5, y: c.j + 0.5 }; }
      if (d > farD) { farD = d; r.out = { x: c.i + 0.5, y: c.j + 0.5 }; }
    }
  }

  // ---- requests: a glint along a path of points (in cells) ----
  const rnd = seeded(11);
  const routes = [];
  function route(opts = {}) {
    if (bars.length < 4 || arms.length < 2 || rays.length < 1) return;
    const side = opts.side ?? (rnd() < 0.5 ? 0 : 1);
    const bar = bars[side * 2 + (rnd() < 0.5 ? 0 : 1)]; const arm = arms[side];
    const ray = opts.ray ?? rays[Math.floor(rnd() * rays.length)];
    const inner = side === 0 ? arm.x1 - 1 : arm.x0 + 1;
    const pts = [
      { x: bar.cx, y: -3 }, { x: bar.cx, y: arm.cy }, { x: inner, y: arm.cy },
      ray.in, ray.out, { x: ray.out.x + (ray.out.x - ray.in.x) * 0.4, y: ray.out.y + (ray.out.y - ray.in.y) * 0.4 },
    ];
    let len = 0; const seg = [];
    for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); seg.push(d); len += d; }
    routes.push({ pts, seg, len, s: 0, speed: 46, ray, landed: false });
  }
  const along = (r, s) => {
    let k = 0; s = clamp(s, 0, r.len);
    while (k < r.seg.length - 1 && s > r.seg[k]) { s -= r.seg[k]; k++; }
    const a = r.pts[k]; const b = r.pts[k + 1]; const f = r.seg[k] ? s / r.seg[k] : 0;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  function glints(dt) {
    art.glint.fill(0);
    for (let q = routes.length - 1; q >= 0; q--) {
      const r = routes[q]; r.s += r.speed * dt;
      const heads = [0, 2.2, 4.4, 6.6].map((back, n) => ({ p: along(r, r.s - back), w: [1, 0.55, 0.3, 0.14][n] }));
      for (const h of heads) {
        if (r.s - 0 < 0) continue;
        // only cells near the head; the field is small, a full pass is cheap
        for (let k = 0; k < g.cells.length; k++) {
          const c = g.cells[k]; const d2 = (c.i + 0.5 - h.p.x) ** 2 + (c.j + 0.5 - h.p.y) ** 2;
          if (d2 < 9) art.glint[k] = Math.max(art.glint[k], h.w * Math.exp(-d2 / 2.4) * 0.95);
        }
      }
      const toOut = r.len - Math.hypot(r.pts.at(-1).x - r.ray.out.x, r.pts.at(-1).y - r.ray.out.y);
      if (!r.landed && r.s >= toOut) { // delivered: the ray flashes and moves a colour on
        r.landed = true;
        for (const m of r.ray.members) { art.flash[m] = Math.max(art.flash[m], 0.85); art.extra[m] += 1; }
        emit('art:route', { ray: rays.indexOf(r.ray) });
      }
      if (r.s > r.len + 8) routes.splice(q, 1);
    }
  }

  // ---- the entrance: bars, then arms, then rays, each cell stepping in through white ----
  const delay = new Float32Array(g.cells.length);
  g.cells.forEach((c, k) => {
    const p = list[comp[k]];
    const order = bars.includes(p) ? 0 : arms.includes(p) ? 1 : 2;
    delay[k] = order * 0.16 + (c.j / ROWS) * 0.35 + rnd() * 0.22;
  });
  let intro = -1;                                   // seconds into the entrance; -1 before it starts
  if (calm) { art.step(0); art.draw(); return; }
  art.appear.fill(0);
  art.draw();
  once('hero:art', () => { intro = 0; });

  // ---- the loop ----
  let idle = 2.2;
  const hero = document.querySelector('.hero');
  loop(host, (dt) => {
    if (intro >= 0 && intro < 2) {
      intro += dt;
      for (let k = 0; k < delay.length; k++) art.appear[k] = clamp((intro - delay[k]) / 0.22, 0, 1);
    }
    const h = hero.offsetHeight || innerHeight;
    art.spread = clamp((scroll.y - h * 0.05) / (h * 0.8), 0, 1) ** 1.6;
    art.alpha = 1 - clamp((scroll.y - h * 0.35) / (h * 0.5), 0, 1);
    art.active = scroll.y < h * 0.4;
    if (intro > 1.2) {
      idle -= dt;
      if (idle <= 0) { route(); idle = 3.2 + rnd() * 3; }
      if (rnd() < dt * 7) { const k = Math.floor(rnd() * g.cells.length); art.flash[k] = Math.max(art.flash[k], 0.55); } // a twinkle
    }
    glints(dt);
    art.step(intro < 0 ? 0 : dt);                 // the field holds the shot's frame until the mark is shown
    art.draw();
  }, { margin: '0px' });

  // A press on the art: a ring from where it landed, and a request routed to the ray nearest it.
  canvas.addEventListener('pointerdown', (e) => {
    if (intro < 0.8) return;
    art.ripple(e.clientX, e.clientY);
    const c = art.toCell(e.clientX, e.clientY);
    const ray = rays.reduce((best, r) => (Math.hypot(r.cx - c.x, r.cy - c.y) < Math.hypot(best.cx - c.x, best.cy - c.y) ? r : best), rays[0]);
    route({ side: c.x < COLS / 2 ? 0 : 1, ray: c.y > 27 ? ray : undefined });
    idle = 4;
    emit('art:press');
  });
  // Keyboard: the art is not focusable, but Space/Enter on the hero CTA area should not be needed; touch gets the
  // same press as a mouse.
  if (!fine) canvas.style.cursor = 'default';
  on('art:poke', () => route());
}
