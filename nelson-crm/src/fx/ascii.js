/* ==========================================================================
   fx/ascii — "night clouds" ASCII field behind the black How-it-works section

   A slowly evolving, domain-warped simplex fbm rendered as dim monospace
   characters on an 8x14 grid, with sparse twinkling stars in the clear sky,
   calm zones behind every text block, a pointer "decoding lens" (fine pointer
   only) and a one-time left-to-right decode sweep on first entrance.

   - owns ONLY: the <canvas class="fx-ascii"> it inserts as the first child of
     .process, html.fx-ascii, and the z-index / isolation rules in ascii.css;
   - glyphs are pre-rendered to an atlas (glyph x tint) and blitted with
     drawImage, only for cells whose (glyph, tint, alpha) actually changed;
   - ~30fps, runs only while the section is near the viewport and the tab is
     visible; no layout reads in the frame loop (rects cached on resize /
     ScrollTrigger refresh / load);
   - reduced motion: one static frame, no decode, no pointer, no loop.
   ========================================================================== */
(() => {
  'use strict';
  const FX = window.FX;
  if (!FX) return;
  const fail = (where, e) => console.error('[fx:ascii]', where, e);

  /* ---------------- configuration ---------------- */
  const CW = 8, CH = 14;                 // cell size, css px
  const FONT_PX = 11;
  const FONT = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Roboto Mono", "Liberation Mono", "DejaVu Sans Mono", monospace';
  const FPS = FX.finePointer ? 30 : 24;   // touch devices: the slow drift doesn't need more
  // glyph table (index 0 = empty). Every density level offers a few look-alike
  // variants picked per cell, so low densities scatter at different heights
  // inside their cells instead of forming a rigid dot-matrix.
  const GLYPHS = ' .\u00b7,\'`:-~=+*#%@/\\|<>^';   // < 64 glyphs (6 bits)
  const gi = ch => GLYPHS.indexOf(ch);
  const LEVELS = ['', '.\u00b7.,\'', '\u00b7:.-', ':-~:', '-=~+', '=+*~', '+*=#', '*#+%', '#%*@'].map(str => Array.from(str).map(gi));
  const NLEV = LEVELS.length - 1;
  const G_DOT = gi('\u00b7'), G_PLUS = gi('+'), G_STAR = gi('*');
  const SCRAMBLE = Array.from(':-~=+*#%/\\|<>^').map(gi);   // decode / pointer scramble glyphs
  // tints: 0 = neutral; 1..7 = neutral -> brand blue #2894f9 -> light blue #8cc4fb
  const TINTS = [[255, 255, 255], [190, 216, 245], [120, 180, 250], [40, 148, 249], [69, 160, 249], [98, 172, 250], [120, 184, 251], [140, 196, 251]];
  const A_SCALE = 80;                    // alpha level = round(alpha * A_SCALE), 6 bits (max .79)
  const A_MIN = 0.112, A_MAX = 0.29;     // #1d1d1d .. #4a4a4a over black
  const CALM_MIN = 0.12, CALM_PAD = 14, CALM_FEATHER = 70;
  const POINTER_R = 150;
  const DECODE_DUR = 1.4, DECODE_BAND = 220, DECODE_JIT = 70;
  const STATIC_T = 41.7;                 // field time used for the reduced-motion frame

  /* ---------------- tiny deterministic helpers ---------------- */
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = n => {            // int -> [0,1)
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const hash2 = (a, b) => hash(Math.imul(a, 0x27d4eb2d) ^ Math.imul(b + 0x165667b1, 0x9e3779b1));

  /* ---------------- 3D simplex noise (Gustavson), seeded ---------------- */
  function makeNoise(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(hash2(seed, i) * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = (perm[i] % 12) * 3; }
    const G = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    const F3 = 1 / 3, G3 = 1 / 6;
    return (x, y, z) => {
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, q, g;
      q = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (q > 0) { g = pm[ii + perm[jj + perm[kk]]]; q *= q; n += q * q * (G[g] * x0 + G[g + 1] * y0 + G[g + 2] * z0); }
      q = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (q > 0) { g = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]; q *= q; n += q * q * (G[g] * x1 + G[g + 1] * y1 + G[g + 2] * z1); }
      q = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (q > 0) { g = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]; q *= q; n += q * q * (G[g] * x2 + G[g + 1] * y2 + G[g + 2] * z2); }
      q = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (q > 0) { g = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]]; q *= q; n += q * q * (G[g] * x3 + G[g + 1] * y3 + G[g + 2] * z3); }
      return 32 * n;   // ~[-1, 1]
    };
  }

  function init() {
    const sec = document.querySelector('.process');
    if (!sec) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    canvas.className = 'fx-ascii';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    sec.insertBefore(canvas, sec.firstChild);

    const reduce = !!FX.reduce;
    const pointerOn = !!FX.finePointer && !reduce;
    const noise = makeNoise(1931);

    /* ---------------- state ---------------- */
    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, n = 0, sw = 0, sh = 0, oxd = 0, oyd = 0;
    let cx = null, cy = null;            // cell centres (css px, section-local)
    let calm = null, star = null, jit = null, dith = null, vari = null, V = null, E = null, prev = null;
    let atlas = null, atlasKey = '';
    let secLeft = 0, secDocTop = 0;      // cached section position (client x, document y)
    let visible = false, pageVisible = !document.hidden, raf = 0, last = 0, time = STATIC_T;
    let frameNo = 0, curAlpha = -1, ready = false;
    // decode: -1 = waiting for first entrance, >= 0 = start time, Infinity = done
    let decodeAt = reduce ? Infinity : -1;
    let decodeDone = reduce;
    let spx = 0, spy = 0, hasPtr = false, pAmt = 0, eLive = false;
    let broken = false;
    const stats = { frames: 0, ms: 0, drawn: 0, cells: 0 };

    /* ---------------- glyph atlas: one row per tint, one column per glyph ---------------- */
    function buildAtlas() {
      const key = sw + 'x' + sh + '@' + dpr;
      if (atlas && atlasKey === key) return;
      atlas = atlas || document.createElement('canvas');
      atlas.width = sw * GLYPHS.length; atlas.height = sh * TINTS.length;
      const a = atlas.getContext('2d');
      a.clearRect(0, 0, atlas.width, atlas.height);
      a.font = `400 ${FONT_PX * dpr}px ${FONT}`;
      a.textAlign = 'center'; a.textBaseline = 'middle';
      for (let t = 0; t < TINTS.length; t++) {
        a.fillStyle = `rgb(${TINTS[t][0]},${TINTS[t][1]},${TINTS[t][2]})`;
        for (let g = 1; g < GLYPHS.length; g++) a.fillText(GLYPHS[g], g * sw + sw / 2, t * sh + sh / 2 + 0.5 * dpr);
      }
      atlasKey = key;
    }

    /* ---------------- layout cache (never read inside the frame loop) ---------------- */
    const BLOCKS = '.eyebrow, h2, .aside, .step';
    let blocks = [];
    function measurePos() {
      const r = sec.getBoundingClientRect();
      secLeft = r.left; secDocTop = r.top + (window.scrollY || window.pageYOffset || 0);
      return r;
    }
    // returns true when the zones differ from the cached ones (so callers can skip a full redraw)
    function measureBlocks(r) {
      const range = document.createRange();
      const next = Array.from(sec.querySelectorAll(BLOCKS)).map(el => {
        // a .step's own box has the same extent as its contents (block children span the column)
        // but, unlike a Range over them, it ignores the children's entrance transforms
        // (reveals scales the icon and offsets the copy until the step enters)
        let b;
        if (el.classList.contains('step')) b = el.getBoundingClientRect();
        else { range.selectNodeContents(el); b = range.getBoundingClientRect(); }
        if (!b.width || !b.height) b = el.getBoundingClientRect();
        return [b.left - r.left - CALM_PAD, b.top - r.top - CALM_PAD, b.right - r.left + CALM_PAD, b.bottom - r.top + CALM_PAD];
      }).filter(b => b[2] > b[0] && b[3] > b[1]);
      const same = next.length === blocks.length && next.every((b, k) => b.every((v, j) => Math.abs(v - blocks[k][j]) < 0.75));
      blocks = next;
      return !same;
    }
    function computeCalm() {
      if (!calm) return;
      for (let i = 0; i < n; i++) {
        const x = cx[i], y = cy[i];
        let m = 1;
        for (let k = 0; k < blocks.length; k++) {
          const b = blocks[k];
          const dx = x < b[0] ? b[0] - x : x > b[2] ? x - b[2] : 0;
          const dy = y < b[1] ? b[1] - y : y > b[3] ? y - b[3] : 0;
          const d = Math.sqrt(dx * dx + dy * dy);
          const v = CALM_MIN + (1 - CALM_MIN) * smooth(0, CALM_FEATHER, d);
          if (v < m) m = v;
        }
        // a whisper of falloff toward the section edges so the field never looks cropped
        const ex = Math.min(x, W - x), ey = Math.min(y, H - y);
        m *= 0.55 + 0.45 * smooth(0, 56, Math.min(ex, ey));
        calm[i] = m;
      }
    }
    // force: the grid was rebuilt (fresh calm buffer). Otherwise the calm map and the full
    // clear + redraw are only redone when a text block actually moved, so frequent triggers
    // (mobile toolbar 'resize' while scrolling, ScrollTrigger refreshes) stay cheap.
    function remeasure(force) {
      if (!n) return false;
      try {
        const r = measurePos();
        if (measureBlocks(r) || force === true) { computeCalm(); prevReset(); return true; }
      } catch (e) { fail('measure', e); }
      return false;
    }
    let needFull = true;
    function prevReset() { needFull = true; }   // next render clears the canvas once and redraws every glyph

    /* ---------------- (re)build grid for the current size ---------------- */
    function rebuild(w, h) {
      W = w; H = h;
      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      sw = Math.round(CW * dpr); sh = Math.round(CH * dpr);
      const bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr));
      canvas.width = bw; canvas.height = bh; curAlpha = -1;
      cols = Math.max(0, Math.floor(bw / sw)); rows = Math.max(0, Math.floor(bh / sh));
      oxd = Math.floor((bw - cols * sw) / 2); oyd = Math.floor((bh - rows * sh) / 2);
      n = cols * rows;
      cx = new Float32Array(n); cy = new Float32Array(n);
      calm = new Float32Array(n); star = new Float32Array(n); jit = new Float32Array(n); dith = new Float32Array(n); vari = new Float32Array(n);
      V = new Float32Array(n); E = new Float32Array(n); prev = new Uint16Array(n);
      eLive = false;
      for (let r = 0, i = 0; r < rows; r++) {
        const rowJ = noise(r * 0.11, 4.7, 9.1) * DECODE_JIT;
        for (let c = 0; c < cols; c++, i++) {
          cx[i] = (oxd + c * sw + sw / 2) / dpr; cy[i] = (oyd + r * sh + sh / 2) / dpr;
          const hs = hash2(c + 7, r + 131);
          // stars: ~1.3% of cells; value encodes kind (int part) + phase (fraction)
          if (hs < 0.013) {
            const k = hash2(r * 31 + 5, c * 17 + 3);
            star[i] = (k < 0.68 ? 1 : k < 0.9 ? 2 : 3) + hash2(c, r * 7 + 11) * 0.999;
          }
          jit[i] = rowJ + (hash2(c * 3 + 1, r * 5 + 2) - 0.5) * 36;
          dith[i] = (hash2(c, r) - 0.5) * 0.07;
          vari[i] = hash2(r * 13 + 7, c * 29 + 1);
        }
      }
      buildAtlas();
      remeasure(true);
      prevReset();
      ready = n > 0;
    }

    /* ---------------- the field ---------------- */
    // cumulus-ish: a smooth base octave plus two 'billow' octaves (|n|) for puffy, rounded edges
    const SX = 1 / 340, SY = 1 / 300;
    function field(i, t) {
      const x = cx[i] * SX, y = cy[i] * SY, z = t * 0.011;
      const w = noise(x * 0.45 + 7.1, y * 0.45 - 3.3, z * 0.6);
      const X = x + w * 0.9 + t * 0.0065, Y = y + w * 0.5;   // ~2px/s drift to the right
      const n2 = noise(X * 2.1 + 11.7, Y * 2.1 - 5.1, z * 1.15), n3 = noise(X * 4.4 - 3.4, Y * 4.4 + 9.2, z * 1.3);
      const f = noise(X, Y, z) * 0.62 + (Math.abs(n2) * 2 - 0.7) * 0.24 + (Math.abs(n3) * 2 - 0.7) * 0.12;
      return smooth(-0.12, 0.6, f) * (0.8 + 0.2 * w);   // the warp field doubles as soft 'moonlight' variation
    }

    // a 'scrambling' glyph: mostly density-ramp glyphs around the requested density
    // (so lens and decode read as light passing through cloud), now and then a stroke glyph
    function shimmer(i, slot, dens) {
      const h = hash2(i + 13, slot);
      if (h < 0.18) return SCRAMBLE[(hash2(i + 29, slot) * SCRAMBLE.length) | 0];
      const lvl = Math.max(1, Math.min(NLEV, 1 + ((dens + (hash2(i + 5, slot) - 0.5) * 0.45) * NLEV) | 0));
      const lv = LEVELS[lvl];
      return lv[(h * 977 % 1 * lv.length) | 0];
    }

    /* ---------------- render one frame ---------------- */
    function render(dt, full) {
      if (!ready) return;
      const t0 = performance.now();
      const t = time;
      frameNo++;
      if (full) needFull = true;

      // decode progress (front position in css px)
      let decoding = false, front = 0;
      if (!decodeDone) {
        if (decodeAt < 0) {
          // not entered yet: keep the canvas empty (the design's pure black)
          if (needFull) { ctx.clearRect(0, 0, canvas.width, canvas.height); prev.fill(0); needFull = false; }
          return;
        }
        const p = clamp01((t - decodeAt) / DECODE_DUR);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // cubic in-out
        front = -DECODE_JIT + (W + DECODE_BAND + DECODE_JIT * 2) * e;
        decoding = p < 1;
        if (!decoding) decodeDone = true;
      }

      // pointer lens -> per-cell energy with a soft trailing decay
      if (pointerOn) {
        const P = FX.pointer;
        const lx = P.x - secLeft, ly = P.y - (secDocTop - FX.scroll.y);
        const inside = P.active && lx >= -40 && ly >= -40 && lx <= W + 40 && ly <= H + 40;
        if (inside) {
          if (!hasPtr) { spx = lx; spy = ly; hasPtr = true; }
          const k = 1 - Math.pow(0.0008, dt);   // frame-rate independent smoothing
          spx += (lx - spx) * k; spy += (ly - spy) * k;
        } else hasPtr = false;
        pAmt += ((inside ? 1 : 0) - pAmt) * (1 - Math.pow(inside ? 0.02 : 0.004, dt));
        if (pAmt < 0.002) pAmt = 0;
        if (eLive) {
          const decay = Math.pow(0.06, dt);   // ~0.5s trail
          let any = false;
          for (let i = 0; i < n; i++) { const e = E[i]; if (e) { const d = e * decay; E[i] = d < 0.004 ? 0 : d; any = true; } }
          eLive = any;
        }
        if (pAmt > 0 && hasPtr && decodeDone) {
          const R = POINTER_R, R2 = R * R;
          const c0 = Math.max(0, Math.floor(((spx - R) * dpr - oxd) / sw)), c1 = Math.min(cols - 1, Math.ceil(((spx + R) * dpr - oxd) / sw));
          const r0 = Math.max(0, Math.floor(((spy - R) * dpr - oyd) / sh)), r1 = Math.min(rows - 1, Math.ceil(((spy + R) * dpr - oyd) / sh));
          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
              const i = r * cols + c, dx = cx[i] - spx, dy = cy[i] - spy, d2 = dx * dx + dy * dy;
              if (d2 >= R2) continue;
              const s = 1 - Math.sqrt(d2) / R;
              const f = s * s * (3 - 2 * s) * pAmt;
              if (f > E[i]) { E[i] = f; eLive = true; }
            }
          }
        }
      }

      if (needFull) { ctx.clearRect(0, 0, canvas.width, canvas.height); prev.fill(0); needFull = false; full = true; }

      // field: refresh half of the rows per frame (interleaved) — the drift is slow enough
      const parity = full ? -1 : frameNo & 1;
      const twT = t;
      let drawn = 0;
      for (let r = 0, i = 0; r < rows; r++) {
        const refresh = parity < 0 || (r & 1) === parity;
        const y = oyd + r * sh;
        for (let c = 0; c < cols; c++, i++) {
          if (refresh) V[i] = field(i, t);
          const cm = calm[i];
          // moonlit rims: density here minus density two rows above -> brighter cloud tops
          const rim = r > 1 ? clamp01((V[i] - V[i - 2 * cols]) * 2.2) : 0;
          let v = (V[i] + rim * 0.07) * cm;
          // ordered-ish dither so the ramp never bands into contour lines
          v += dith[i];
          const vg = v <= 0.1 ? 0 : Math.pow((v - 0.1) / 0.9, 1.25);
          let g = 0;
          if (v > 0.1) { const lv = LEVELS[Math.min(NLEV, 1 + Math.floor(vg * NLEV))]; g = lv[(vari[i] * lv.length) | 0]; }
          let a = g ? (A_MIN + (A_MAX - A_MIN) * Math.pow(Math.min(1, vg * 1.05 + rim * 0.4), 0.85)) * (0.5 + 0.5 * cm) : 0;
          let tint = 0;
          const quiet = 0.25 + 0.75 * cm;   // decode/lens attenuation: just a whisper behind the copy

          // stars in the clear sky
          const st = star[i];
          if (st && V[i] < 0.42) {
            const kind = st | 0, ph = st - kind;
            const sky = 1 - V[i] / 0.42;
            const tw = Math.pow(0.5 + 0.5 * Math.sin(twT * (0.6 + ph * 1.3) + ph * 40), 6);
            const sa = (0.24 + 0.3 * tw + (kind === 3 ? 0.06 : 0)) * sky * (0.35 + 0.65 * cm);
            if (sa > a) { a = sa; g = kind === 1 ? G_DOT : kind === 2 ? (tw > 0.55 ? G_STAR : G_PLUS) : (tw > 0.4 ? G_STAR : G_PLUS); }
          }

          // decode sweep: empty ahead of the front, shimmering glyphs inside the band, field behind
          if (decoding) {
            const d = front - cx[i] - jit[i];
            if (d < 0) { g = 0; a = 0; }
            else if (d < DECODE_BAND) {
              const k = d / DECODE_BAND;                     // 0 at the leading edge -> 1 behind
              const slot = Math.floor(t * 18 + jit[i] * 0.37);
              if (hash2(i, slot) < (1 - k) * 0.95 && hash2(i * 7 + 3, 17) < 0.86 - 0.3 * k) {
                g = shimmer(i, slot, 0.15 + 0.42 * (1 - k) + V[i] * 0.35);
                a = Math.max(a * k, (0.12 + 0.34 * (1 - k) * (1 - k)) * quiet);
              }
            }
          }

          // pointer lens: glyphs scramble and brighten toward light brand blue
          const e = E[i];
          if (e) {
            const slot = Math.floor(t * 10 + hash2(i, 3) * 10);
            const ee = Math.pow(e, 0.85);
            if (hash2(i, slot) < ee * 0.9) {
              g = shimmer(i, slot, 0.15 + e * 0.75);
              a = Math.max(a, (0.1 + 0.62 * ee) * quiet);
            } else if (g) a = a + (0.6 - a) * ee * 0.7 * quiet;
            tint = Math.min(7, Math.round(ee * 7.4));
          }

          let L = g ? Math.round(a * A_SCALE) : 0;
          if (L < 2) { L = 0; g = 0; } else if (L > 63) L = 63;
          const key = g ? (g | (tint << 6) | (L << 9)) : 0;
          if (key === prev[i]) continue;
          prev[i] = key;
          const x = oxd + c * sw;
          ctx.clearRect(x, y, sw, sh);
          if (g) {
            const al = L / A_SCALE;
            if (al !== curAlpha) { ctx.globalAlpha = al; curAlpha = al; }
            ctx.drawImage(atlas, g * sw, tint * sh, sw, sh, x, y, sw, sh);
          }
          drawn++;
        }
      }
      stats.frames++; stats.ms += performance.now() - t0; stats.drawn = drawn; stats.cells = n;
    }

    /* ---------------- loop control ---------------- */
    const FRAME_MS = 1000 / FPS;
    function tick(now) {
      raf = 0;
      if (!shouldRun()) return;
      raf = requestAnimationFrame(tick);
      const el = now - last;
      if (el < FRAME_MS - 2) return;
      last = now;
      const dt = Math.min(el, 100) / 1000;
      time += dt;
      try { render(dt, false); } catch (e) { broken = true; fail('render', e); stop(); }
    }
    const shouldRun = () => !broken && !reduce && ready && visible && pageVisible && decodeAt >= 0;
    function start() { if (!raf && shouldRun()) { last = performance.now() - FRAME_MS; raf = requestAnimationFrame(tick); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    const update = () => (shouldRun() ? start() : stop());

    function drawStatic() {   // reduced motion (and resize while paused): one complete frame
      if (!ready || broken) return;
      try { prevReset(); render(0, true); } catch (e) { broken = true; fail('static', e); }
    }

    /* ---------------- sizing ---------------- */
    let pend = 0;
    function onSize() {
      if (pend) return;
      pend = requestAnimationFrame(() => {
        pend = 0;
        try {
          const w = sec.clientWidth, h = sec.clientHeight;
          const d = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
          if (w === W && h === H && d === dpr && n) { resync(); return; }
          rebuild(w, h);
          drawStatic();
          update();
        } catch (e) { broken = true; fail('resize', e); }
      });
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onSize).observe(sec);
    addEventListener('resize', onSize, { passive: true });
    // re-sync the cached geometry; repaint right away only when the loop isn't running to do it
    function resync() { if (remeasure() && !raf) drawStatic(); }
    FX.on('load', resync);
    if (FX.ready && FX.ready.then) FX.ready.then(resync);
    if (FX.ScrollTrigger && FX.ScrollTrigger.addEventListener) FX.ScrollTrigger.addEventListener('refresh', resync);
    if (pointerOn) sec.addEventListener('pointerenter', () => { try { measurePos(); } catch (e) { /* noop */ } }, { passive: true });

    /* ---------------- visibility ---------------- */
    // entering view also re-syncs the cached section position used by the lens (one rect read
    // per visibility change, never per frame), in case content above it changed height
    FX.whenVisible(sec, v => { visible = v; if (v && pointerOn) { try { measurePos(); } catch (e) { /* noop */ } } update(); }, '160px');
    FX.on('visibility', v => { pageVisible = !!v; update(); });

    /* ---------------- entrance: decode sweep once, when the section is really in view ---------------- */
    if (!reduce) {
      let armed = false;
      const arm = () => {
        if (armed) return;
        armed = true;
        const go = () => {
          if (decodeAt >= 0) return;
          // re-measure text blocks now (reveals may have moved them while hidden) and again once settled
          remeasure();
          prevReset();   // first decode frame computes the whole field (it was never sampled before)
          setTimeout(resync, 1800);
          decodeAt = time;
          update();
        };
        if (typeof IntersectionObserver === 'undefined') { go(); return; }
        const io = new IntersectionObserver(entries => {
          if (!entries.some(en => en.isIntersecting)) return;
          io.disconnect();
          go();
        }, { rootMargin: '0px 0px -28% 0px', threshold: 0 });
        io.observe(sec);
      };
      FX.once('intro:done', arm);
      setTimeout(arm, 7000);   // safety net: an intro that never reports done must not keep the field hidden
    }

    rebuild(sec.clientWidth, sec.clientHeight);
    drawStatic();
    update();

    document.documentElement.classList.add('fx-ascii');   // stacking rules in ascii.css apply from here
    FX.ascii = { stats, canvas, redraw: drawStatic };
  }

  const boot = () => {
    try { init(); } catch (e) {
      fail('init', e);
      // leave the section exactly as designed
      document.querySelectorAll('canvas.fx-ascii').forEach(c => c.remove());
      document.documentElement.classList.remove('fx-ascii');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
