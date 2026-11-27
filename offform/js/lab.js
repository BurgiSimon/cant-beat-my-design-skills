// Research dept.: a motion study drawn in type. A runner (a procedural gait: walk, run or sprint) is rasterised into
// a grid of characters every frame, its core spelled in the brand's own letters, with orange motion-capture markers
// on the joints and fading echoes of earlier poses behind it, as in a chronophotograph. Point at a joint and it
// reads its angle. Each spec row lights the part of the body it is about: the shell on the torso, the seams along the
// arms and sides, the reflective hits flashing on the forearms and heels, the stretch in the legs.
import { calm, fine, loop, lerp, clamp, whenVisible } from './core.js';

const MODES = [
  { name: 'Walk', hz: 0.93, thigh: 0.42, tOff: 0.02, kMax: 0.95, kMin: 0.08, arm: 0.36, elbow: 0.4, lean: 0.04, bob: 0.012, fly: 0, pace: 580, cad: 112, stride: 0.78 },
  { name: 'Run', hz: 1.42, thigh: 0.62, tOff: 0.1, kMax: 1.75, kMin: 0.22, arm: 0.62, elbow: 1.45, lean: 0.14, bob: 0.024, fly: 0.03, pace: 288, cad: 172, stride: 1.21 },
  { name: 'Sprint', hz: 1.66, thigh: 0.86, tOff: 0.16, kMax: 2.25, kMin: 0.3, arm: 0.98, elbow: 1.35, lean: 0.27, bob: 0.03, fly: 0.05, pace: 175, cad: 196, stride: 1.92 },
];
const KEYS = Object.keys(MODES[0]).filter((k) => typeof MODES[0][k] === 'number');
const WORD = 'OFFFORM';
const RAMP = ' .:-=+*#';

export function init() {
  const s = document.getElementById('lab');
  const pre = s?.querySelector('[data-ascii]');
  if (!pre) return;
  const screen = s.querySelector('.lab__screen');
  const modeEl = s.querySelector('[data-mode]');
  const read = { pace: s.querySelector('[data-read="pace"]'), cad: s.querySelector('[data-read="cad"]'), stride: s.querySelector('[data-read="stride"]') };
  const buttons = [...s.querySelectorAll('[data-speed]')];
  const specs = [...s.querySelectorAll('.lab__specs li')];

  // live parameters ease toward the chosen mode
  let mode = 1;
  const P = { ...MODES[1] };
  let zone = '';

  // ---- grid ----
  let cols = 0, rows = 0, cw = 7, ch = 11.67, W = 0, H = 0;
  let dens, kind;
  function size() {
    const r = screen.getBoundingClientRect();
    W = r.width; H = r.height;
    const target = W < 520 ? 5.2 : 6.6;            // px per column
    cols = Math.max(40, Math.floor(W / target));
    cw = W / cols; ch = cw / 0.6;                    // a mono cell is 0.6em wide, 1em tall
    rows = Math.max(20, Math.floor(H / ch));
    pre.style.fontSize = `${ch.toFixed(3)}px`;
    pre.style.lineHeight = `${ch.toFixed(3)}px`;
    dens = new Float32Array(cols * rows);
    kind = new Uint8Array(cols * rows);
  }
  size();
  new ResizeObserver(() => { size(); if (calm) draw(0); }).observe(screen);

  // ---- the body: segments as capsules, in px ----
  function pose(phase, p, cx, ground) {
    const S = H * 0.6;                                // body height in px
    const L = { thigh: 0.25 * S, shin: 0.25 * S, foot: 0.075 * S, torso: 0.3 * S, upper: 0.165 * S, fore: 0.155 * S, neck: 0.075 * S, head: 0.066 * S };
    const leg = (ph) => {
      const t = p.thigh * Math.sin(ph) + p.tOff;
      const k = p.kMin + (p.kMax - p.kMin) * Math.pow(Math.max(0, Math.cos(ph + Math.PI / 4)), 1.4);
      return { t, k };
    };
    const lean = p.lean;
    const bob = -p.bob * S * Math.cos(phase * 2);
    const lift = p.fly * S * Math.max(0, Math.sin(phase * 2 - 0.6));
    const hip = [cx, 0];
    const parts = [];
    const joints = {};
    const seg = (a, b, r, z, name) => { parts.push({ a, b, r, z, name }); };
    const dir = (th, len, from) => [from[0] + Math.sin(th) * len, from[1] + Math.cos(th) * len];
    const sh = [hip[0] + Math.sin(lean) * L.torso, hip[1] - Math.cos(lean) * L.torso];
    // legs (far one first, so the near one wins where they cross)
    for (const [side, off] of [['L', Math.PI], ['R', 0]]) {
      const g = leg(phase + off);
      const knee = dir(g.t, L.thigh, hip);
      const shinA = g.t - g.k;
      const ankle = dir(shinA, L.shin, knee);
      const toe = dir(shinA + Math.PI / 2 + 0.25 * Math.min(1, g.k), L.foot, ankle);
      const heel = dir(shinA - Math.PI / 2, L.foot * 0.25, ankle);
      const far = side === 'L';
      parts.push({ a: hip, b: knee, r: 0.046 * S, z: 'legs', far });
      parts.push({ a: knee, b: ankle, r: 0.034 * S, z: 'legs', far });
      parts.push({ a: heel, b: toe, r: 0.022 * S, z: 'foot', far });
      joints[`${side} hip`] = { at: hip, angle: Math.round(180 - Math.abs(g.t - lean) * 57.3) };
      joints[`${side} knee`] = { at: knee, angle: Math.round(180 - g.k * 57.3) };
      joints[`${side} ankle`] = { at: ankle, angle: Math.round(90 + (g.k - g.t) * 20) };
      if (side === 'L') parts.farLegEnd = parts.length;
    }
    // torso and head
    seg(hip, sh, 0.062 * S, 'torso', 'spine');
    const neck = [sh[0] + Math.sin(lean) * L.neck, sh[1] - Math.cos(lean) * L.neck];
    parts.push({ a: [neck[0] + L.head * 0.3, neck[1] - L.head * 0.8], b: [neck[0] + L.head * 0.3, neck[1] - L.head * 0.8], r: L.head, z: 'head' });
    joints.shoulder = { at: sh, angle: 0 };
    // arms, opposite to the legs
    for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
      const a = -p.arm * Math.sin(phase + off) + 0.05;
      const elbow = dir(a, L.upper, sh);
      const bend = p.elbow * (0.85 + 0.25 * Math.sin(phase + off + 0.6));
      const wrist = dir(a + bend, L.fore, elbow);
      parts.push({ a: sh, b: elbow, r: 0.029 * S, z: 'arm', far: side === 'L' });
      parts.push({ a: elbow, b: wrist, r: 0.025 * S, z: 'fore', far: side === 'L' });
      joints[`${side} shoulder`] = { at: sh, angle: Math.round(Math.abs(a) * 57.3) };
      joints[`${side} elbow`] = { at: elbow, angle: Math.round(180 - bend * 57.3) };
      joints[`${side} wrist`] = { at: wrist, angle: 0 };
    }
    // stand it on the ground (in flight it leaves it)
    let low = -Infinity;
    for (const q of parts) low = Math.max(low, q.a[1] + q.r, q.b[1] + q.r);
    const dy = ground - low - lift + bob * 0.25;
    for (const q of parts) { q.a = [q.a[0], q.a[1] + dy]; q.b = [q.b[0], q.b[1] + dy]; }
    for (const j of Object.values(joints)) j.at = [j.at[0], j.at[1] + dy];
    // the far arm is drawn first, behind the body
    parts.sort((x, y) => (y.far ? 1 : 0) - (x.far ? 1 : 0));
    return { parts, joints };
  }

  // a capsule into the grid, keeping the strongest value per cell
  function stamp(q, weight, k) {
    const pad = q.r + 2;
    const c0 = Math.max(0, Math.floor((Math.min(q.a[0], q.b[0]) - pad) / cw)), c1 = Math.min(cols - 1, Math.ceil((Math.max(q.a[0], q.b[0]) + pad) / cw));
    const r0 = Math.max(0, Math.floor((Math.min(q.a[1], q.b[1]) - pad) / ch)), r1 = Math.min(rows - 1, Math.ceil((Math.max(q.a[1], q.b[1]) + pad) / ch));
    const ax = q.a[0], ay = q.a[1], bx = q.b[0] - ax, by = q.b[1] - ay;
    const bb = bx * bx + by * by || 1;
    for (let r = r0; r <= r1; r++) {
      const py = (r + 0.5) * ch - ay;
      for (let c = c0; c <= c1; c++) {
        const px = (c + 0.5) * cw - ax;
        const t = clamp((px * bx + py * by) / bb, 0, 1);
        const dx = px - bx * t, dy = py - by * t;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = clamp((q.r - d) / (cw * 1.6) + 0.5, 0, 1) * weight;
        const i = r * cols + c;
        const rank = (x) => (x === 1 ? 1 : x === 10 ? 2 : x >= 2 && x <= 7 ? 3 : 0);
        if ((rank(k) > rank(kind[i]) && v > 0.25) || (rank(k) === rank(kind[i]) && v > dens[i]) || (!kind[i] && v > 0)) {
          dens[i] = v;
          kind[i] = k;
          if (k >= 2) seam[i] = d < Math.max(cw * 0.7, q.r * 0.25) ? 1 : 0;
        }
      }
    }
  }
  let seam = new Uint8Array(0);

  // ---- echoes of earlier poses ----
  const echoes = [];
  let echoClock = 0;

  // ---- pointer: the nearest joint reads out ----
  const tip = document.createElement('span');
  tip.className = 'lab__tip label';
  tip.setAttribute('aria-hidden', 'true');
  screen.append(tip);
  let px = -1, py = -1;
  if (fine) {
    screen.addEventListener('pointermove', (e) => { const r = screen.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; });
    screen.addEventListener('pointerleave', () => { px = py = -1; tip.classList.remove('is-on'); });
  }

  let phase = 0, groundShift = 0, flash = 0;
  function draw(t) {
    if (seam.length !== cols * rows) seam = new Uint8Array(cols * rows);
    dens.fill(0); kind.fill(0); seam.fill(0);
    const ground = Math.floor(rows * 0.8) * ch;
    const cx = W * 0.64;
    const now = pose(phase, P, cx, ground);

    // the ground runs under the runner
    const gr = Math.floor(rows * 0.8);
    for (let c = 0; c < cols; c++) { const i = gr * cols + c; dens[i] = 0.5; kind[i] = 5; }
    const tickGap = 9;
    const shift = ((groundShift % (tickGap * cw)) + tickGap * cw) % (tickGap * cw);
    for (let x = -shift; x < W; x += tickGap * cw) {
      const c = Math.round(x / cw);
      if (c >= 0 && c < cols && gr + 1 < rows) { const i = (gr + 1) * cols + c; dens[i] = 0.45; kind[i] = 6; }
    }
    // a shadow under the body
    const sw = W * 0.09;
    for (let c = Math.max(0, Math.floor((cx - sw) / cw)); c <= Math.min(cols - 1, Math.ceil((cx + sw) / cw)); c++) {
      const i = (gr - 1) * cols + c;
      const v = 0.3 * (1 - Math.abs(((c + 0.5) * cw - cx) / sw));
      if (v > 0) { dens[i] = v; kind[i] = 1; }
    }

    // echoes: earlier exposures, each a step further back, as on a chronophotographic plate
    echoes.forEach((e, k) => {
      const back = (k + 1) * W * 0.16;
      const w = 0.85 - k * 0.18;
      for (const q of e.parts) stamp({ a: [q.a[0] - back, q.a[1]], b: [q.b[0] - back, q.b[1]], r: q.r * 0.9 }, w, 1);
    });

    // the runner: 2 body, 3 the zone the spec is about, 10 the far limbs (behind, in thinner type)
    for (const q of now.parts) {
      const hot = (zone === 'torso' && (q.z === 'torso' || q.z === 'arm')) || (zone === 'legs' && q.z === 'legs');
      stamp(q, 1, hot ? 3 : q.far ? 10 : 2);
      if (zone === 'reflect' && (q.z === 'fore' || q.z === 'foot')) stamp({ ...q, r: q.r * 0.55 }, 1, 7);
      if (zone === 'seams' && (q.z === 'torso' || q.z === 'arm' || q.z === 'fore')) markSeam(q);
    }

    // motion-capture markers on the joints
    const marks = [];
    for (const [name, j] of Object.entries(now.joints)) {
      if (name.endsWith('wrist') || name === 'shoulder') continue;
      const c = Math.round(j.at[0] / cw - 0.5), r = Math.round(j.at[1] / ch - 0.5);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      kind[r * cols + c] = 4; dens[r * cols + c] = 1;
      marks.push({ name, c, r, x: j.at[0], y: j.at[1], angle: j.angle });
    }

    // the pointer's joint
    if (px >= 0) {
      let best = null, bd = 60 * 60;
      for (const m of marks) { const d = (m.x - px) ** 2 + (m.y - py) ** 2; if (d < bd) { bd = d; best = m; } }
      if (best) {
        tip.textContent = `${best.name} ${best.angle}°`;
        tip.style.transform = `translate(${(best.x + 14).toFixed(0)}px, ${(best.y - 10).toFixed(0)}px)`;
        tip.classList.add('is-on');
        // a crosshair through it
        for (let c = 0; c < cols; c++) { const i = best.r * cols + c; if (!kind[i]) { kind[i] = 8; dens[i] = 0.3; } }
        for (let r = 0; r < rows; r++) { const i = r * cols + best.c; if (!kind[i]) { kind[i] = 9; dens[i] = 0.3; } }
      } else tip.classList.remove('is-on');
    }

    // ---- to text ----
    let html = '';
    let open = '';
    const close = () => { if (open) { html += `</${open}>`; open = ''; } };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, k = kind[i], d = dens[i];
        let ch_ = ' ', tag = '';
        if (k === 1) { ch_ = d < 0.3 ? ' ' : d < 0.55 ? '.' : ':'; if (ch_ !== ' ') tag = 'i'; }
        else if (k === 10) { ch_ = d < 0.2 ? ' ' : d < 0.5 ? '.' : d < 0.8 ? ':' : '='; if (ch_ !== ' ') tag = 'i'; }
        else if (k === 2 || k === 3 || k === 7) {
          if (d < 0.12) ch_ = ' ';
          else if (d < 0.6) ch_ = RAMP[1 + Math.min(RAMP.length - 2, Math.floor(d * 1.66 * (RAMP.length - 1)))];
          else ch_ = WORD[(c + r * 2) % WORD.length];
          if (k === 3) tag = 'b';
          if (k === 7 && d > 0.3) { tag = flash > 0.5 ? 'em' : 'b'; ch_ = flash > 0.5 ? '#' : ch_; }
          if (k !== 7 && seam[i] === 2 && d > 0.3) { tag = 'b'; ch_ = '|'; }
        } else if (k === 4) { ch_ = '+'; tag = 'b'; }
        else if (k === 5) ch_ = '_';
        else if (k === 6) ch_ = ':';
        else if (k === 8) ch_ = '-';
        else if (k === 9) ch_ = ':';
        if (tag !== open) { close(); if (tag) { html += `<${tag}>`; open = tag; } }
        html += ch_;
      }
      close();
      if (r < rows - 1) html += '\n';
    }
    pre.innerHTML = html;
    void t;
  }
  // a seam: the cells along the middle of a segment, picked out
  function markSeam(q) {
    const n = Math.ceil(Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) / (ch * 0.6));
    for (let k = 0; k <= n; k++) {
      const x = lerp(q.a[0], q.b[0], k / n), y = lerp(q.a[1], q.b[1], k / n);
      const c = Math.floor(x / cw), r = Math.floor(y / ch);
      if (c >= 0 && c < cols && r >= 0 && r < rows) seam[r * cols + c] = 2;
    }
  }

  // ---- readouts ----
  const fmtPace = (sec) => `${Math.floor(sec / 60)}′${String(Math.round(sec % 60)).padStart(2, '0')}″`;
  function readout(jitter = 0) {
    const m = MODES[mode];
    read.pace.textContent = fmtPace(m.pace + jitter * 3);
    read.cad.textContent = String(m.cad + Math.round(jitter));
    read.stride.textContent = `${(m.stride + jitter * 0.01).toFixed(2)} m`;
    modeEl.textContent = m.name;
  }

  // ---- controls ----
  const choose = (i, focus = false) => {
    mode = i;
    buttons.forEach((b, k) => { b.setAttribute('aria-checked', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    if (focus) buttons[i].focus();
    readout();
    if (calm) { Object.assign(P, MODES[i]); draw(0); }
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => choose(i)));
  s.querySelector('.lab__ctrl').addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (k) { e.preventDefault(); choose((mode + k + buttons.length) % buttons.length, true); }
  });
  buttons.forEach((b, k) => { b.tabIndex = k === mode ? 0 : -1; });

  // ---- spec rows: the zone they are about ----
  let touched = 0;
  const setZone = (li) => {
    zone = li ? li.dataset.zone : '';
    for (const x of specs) x.classList.toggle('is-on', x === li);
    if (calm) draw(0);
  };
  for (const li of specs) {
    li.tabIndex = 0;
    li.addEventListener('pointerenter', () => { touched = performance.now(); setZone(li); });
    li.addEventListener('focus', () => { touched = performance.now(); setZone(li); });
    li.addEventListener('click', () => { touched = performance.now(); setZone(zone === li.dataset.zone ? null : li); });
  }
  s.querySelector('.lab__specs').addEventListener('pointerleave', () => { touched = performance.now(); });

  readout();
  if (calm) { draw(0); return; }

  // nobody pointing at the specs: walk through them on its own
  let visible = false;
  whenVisible(s, (v) => { visible = v; });
  let auto = -1;
  setInterval(() => {
    if (!visible || document.hidden || performance.now() - touched < 9000 || document.activeElement?.closest?.('.lab__specs')) return;
    auto = (auto + 1) % (specs.length + 1);
    setZone(specs[auto] || null);
  }, 3200);
  setInterval(() => { if (visible) readout((Math.random() - 0.5) * 2); }, 1100);

  // ---- run at ~30 fps: type reads better a little stepped ----
  let acc = 0;
  loop(screen, (dt, t) => {
    for (const k of KEYS) P[k] = lerp(P[k], MODES[mode][k], 1 - Math.exp(-dt * 3));
    phase += dt * P.hz * Math.PI * 2;
    groundShift += dt * W * 0.18 * P.hz * (0.4 + P.thigh);
    flash = (Math.sin(t * 9) + 1) / 2;
    echoClock += dt;
    acc += dt;
    if (echoClock > 0.13) {
      echoClock = 0;
      echoes.unshift(pose(phase, P, W * 0.64, Math.floor(rows * 0.8) * ch));
      if (echoes.length > 3) echoes.pop();
    }
    if (acc < 1 / 30) return;
    acc = 0;
    draw(t);
  });
}
