/* ==========================================================================
   fx/hero-gl — the hero picture, alive.

   A raw WebGL2 (WebGL1 fallback) canvas that redraws .hero's background —
   the same picture, pixel for pixel at rest — with depth and a pulse:

     • clouds breathe       slow 3D flow-noise displacement (≤ ~2 css px, ~9 s cycles)
     • depth parallax       the sky shifts/zooms toward the pointer, the torn
                            painting barely moves: a window in front of a deep sky
     • the eye follows you  the iris/pupil glance toward the cursor inside the
                            eyelids; when the pointer idles (or on touch) the
                            gaze wanders in slow, occasional saccades
     • film grain           zero-mean temporal grain, re-seeded at 24 fps
     • scroll depth         as the hero leaves, clouds outrun the painting, zoom ≤ 1.06
     • intro tear           driven by 'intro:hero' {progress}: the painting tears
                            open from its centre with a ragged, paper-fibre edge

   Composite:  mix(cloudLayer(uvCloud), photo(uvPhoto), mask(uvPhoto))
   The cloud UVs are a smooth *field*: inside the painting mask they equal the
   painting's UVs (so the torn hole moves rigidly, never seams), and they relax
   to the sky's own transform over ~50 css px outside it. No disocclusion, no
   ghosting of the loose mask, and at rest (idle pointer, scroll 0, reveal done)
   every sample lands exactly where CSS `background-size: cover` puts it — same
   buffer size as the composited box, same mip level the browser picks.
   During the intro the hole is covered by assets/hero-gl-plate.jpg (real cloud
   cloned into the hole; only the 794×747 crop around it) and torn open.

   Inputs: the CSS background URL of .hero (hero.jpg), assets/hero-mask.png,
   assets/hero-gl-plate.jpg (only fetched when an intro is running).
   Images must be same-origin for WebGL. Opened straight from disk (file://)
   every file is its own origin, so the module then loads byte-identical
   data: URI copies from assets/hero-gl-data.js (a classic script, which
   file:// allows); the standalone build already inlines data: URIs.

   Hard guarantees
     - prefers-reduced-motion → module does nothing (the CSS background IS the design)
     - no WebGL / shader error / tainted images that can't be replaced → quietly keeps the CSS background
     - canvas fades in only after a complete first frame; context loss → CSS background
     - render loop runs only while the hero is on screen and the tab is visible,
       and drops to the 24 fps grain cadence when nothing else is moving; the
       gaze is held while the eye itself is off screen, and an iris shift too
       small to see (< 1/20 device px) doesn't repaint
     - the frame is redrawn only when its content changes: a resize / refresh /
       return to the hero with the same geometry keeps the frame on the canvas;
       a buffer invalidated while paused hides the canvas (the CSS background,
       the same picture at rest, stands in) until the next draw
     - an ambient loop that can't hold ~28 fps → "lite": no grain/breathing, no
       idle eye wander (the gaze still follows the pointer), draws only on
       change (≤ ~16/s)
     - software GL (SwiftShader, llvmpipe…; a full-frame draw costs ~100 ms there)
       → "soft": one static frame (identical to the CSS), no parallax / scroll
       depth / tear; only the eye is repainted (scissored, preserved buffer), so
       the gaze still follows at full rate for a small part of the cost.
     - textures are decoded off the main thread (createImageBitmap) where available
       ?herogl=full | ?herogl=lite force full / soft mode (QA)
   Owns: the <canvas class="hero-gl"> it creates inside .hero. Nothing else.
   Hook: FX.heroGL { canvas, live, lite, soft, running, gl2, state, still(bool) } —
   still(true) freezes grain/breathing/idle gaze for deterministic pixel tests.
   ========================================================================== */
(() => {
  'use strict';
  const FX = window.FX;
  if (!FX) return;
  try { main(); } catch (err) { try { console.warn('[hero-gl] disabled:', err); } catch (_) { /* noop */ } }

  function main() {
    const hero = document.querySelector('.hero');
    if (!hero || FX.reduce || hero.querySelector(':scope > .hero-gl')) return;

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const rand = (a, b) => a + Math.random() * (b - a);
    const now = () => performance.now();

    /* ------------------------------------------------------------------
       Constants — all geometry in hero.jpg image pixels (2x of the design)
       ------------------------------------------------------------------ */
    const IMG_W = 2853, IMG_H = 1345;
    const EYE = { x: 1424, y: 572, rx: 80, ry: 31 };    // eye opening (iris ≈ 1426,568, r≈29)
    const GAZE = { x: 7, y: 3.2 };                        // max iris travel (image px)
    const PARALLAX = { cloud: [24, 16], paint: [8, 5], zoom: 0.018 }; // image px / zoom per unit pointer
    const SCROLL = { cloudZoom: 0.06, paintZoom: 0.035, cloudLift: 64, paintLift: 26 };   // zoom anchored at the hero's top edge
    const INTRO = { cloudZoom: 0.10, paintZoom: 0.035 };
    // crop of the hole region with real cloud Poisson-cloned in (assets/hero-gl-plate.jpg, made from hero.jpg's own sky)
    const PLATE_RECT = [1016, 318, 794, 747];
    const BREATH = 5.0;                                   // image px × noise (|n| ≲ 0.75) → ≤ ~1.9 css px, typically ~0.6
    const GRAIN = 0.032;                                  // triangular noise peak (±3.2%), ~1.3% rms in mid-tones
    const IDLE_MS = 4000;
    // DPR cap: 1.75 on desktop. On touch devices 1.25 is the floor, raised up to 2 while the buffer stays
    // under ~0.9 MP — a phone hero (≈ 380×440) at 1.25 would be upscaled 2.4× on a 3x screen and visibly
    // soften the painting the moment the canvas replaces the crisp CSS image; at 2x it is still fewer
    // pixels than the desktop hero at 1x. Tablets land on 1.25.
    const dprCap = (cw, ch) => (FX.finePointer ? 1.75 : clamp(Math.sqrt(9e5 / Math.max(1, cw * ch)), 1.25, 2));
    const fine = !!FX.finePointer;

    /* ------------------------------------------------------------------
       Canvas + context
       ------------------------------------------------------------------ */
    const ATTRS = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'default' };
    let isGL2 = false;
    const makeCanvas = () => {
      const c = document.createElement('canvas');
      c.className = 'hero-gl';
      c.setAttribute('aria-hidden', 'true');
      c.width = c.height = 1;
      return c;
    };
    const getGL = (c, attrs) => {
      let g = null;
      try { g = c.getContext('webgl2', attrs); isGL2 = !!g; if (!g) g = c.getContext('webgl', attrs) || c.getContext('experimental-webgl', attrs); } catch (_) { g = null; }
      return g;
    };
    const rendererName = g => {
      try {
        let r = String(g.getParameter(g.RENDERER) || '');
        if (/^webkit webgl$/i.test(r)) { const ext = g.getExtension('WEBGL_debug_renderer_info'); if (ext) r = String(g.getParameter(ext.UNMASKED_RENDERER_WEBGL) || r); }
        return r;
      } catch (_) { return ''; }
    };
    let canvas = makeCanvas();
    let gl = getGL(canvas, ATTRS);
    if (!gl) return;                                      // no WebGL → CSS background stays

    // Software GL (SwiftShader, llvmpipe…) can't afford even one full-bleed draw per frame (~100 ms each):
    // "soft" mode keeps a single static frame and repaints only the eye. Partial repaints need the previous
    // frame kept, so the context is recreated with a preserved drawing buffer (real GPUs don't pay for that).
    // ?herogl=full / ?herogl=lite force a mode (QA).
    const forced = ((/[?&]herogl=(full|lite)\b/i.exec(location.search) || [])[1] || '').toLowerCase();
    const soft = forced ? forced === 'lite' : /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rendererName(gl));
    if (soft) {
      try { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (_) { /* noop */ }
      canvas = makeCanvas();
      gl = getGL(canvas, Object.assign({}, ATTRS, { preserveDrawingBuffer: true }));
      if (!gl) return;
    }
    hero.insertBefore(canvas, hero.firstChild);
    // lite: no ambient grain/breathing (always in soft mode; the runtime governor can switch it on)
    let lite = soft;

    /* ------------------------------------------------------------------
       Shaders (GLSL ES 1.00 — valid in WebGL1 and WebGL2)
       ------------------------------------------------------------------ */
    const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

    const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uPhoto;   // hero.jpg (the design)
uniform sampler2D uPlate;   // hero-gl-plate.jpg: clouds that fill the torn hole (crop) — intro only
uniform vec4  uPlateR;      // plate crop rect in image px (x, y, w, h)
uniform sampler2D uAux;     // r: painting mask, g: depth field (1 on the mask, → 0 ~50 css px outside), b: intro cover
uniform vec2  uDev;         // drawing-buffer size (device px)
uniform vec2  uCss;         // canvas box (css px)
uniform vec3  uCover;       // xy: drawn image offset (css px), z: image px per css px  (== CSS cover)
uniform vec2  uImg;         // image size (px)
uniform vec3  uCloudX;      // cloud layer sample transform  p' = p*s + t   (s, tx, ty)
uniform vec3  uPaintX;      // painting layer sample transform
uniform vec2  uGaze;        // iris offset (image px)
uniform vec4  uEye;         // eye opening centre xy, radii zw (image px)
uniform vec4  uHole;        // tear origin xy, radii zw (image px)
uniform float uTime;        // s
uniform float uBreath;      // cloud breathing amplitude (image px)
uniform vec2  uSeed;        // grain seed offset
uniform float uGrain;       // grain amplitude
uniform float uReveal;      // intro tear 0..1 (eased);  >= 1 → rest
uniform float uBias;        // mip LOD bias: at rest it pins the exact mip level the browser uses for the CSS image

/* --- hashes & noise --- */
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0; }
float gnoise(vec3 p){                                   // 3D gradient noise, quintic fade (C2)
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash33(i), f);
  float b = dot(hash33(i + vec3(1.,0.,0.)), f - vec3(1.,0.,0.));
  float c = dot(hash33(i + vec3(0.,1.,0.)), f - vec3(0.,1.,0.));
  float d = dot(hash33(i + vec3(1.,1.,0.)), f - vec3(1.,1.,0.));
  float e = dot(hash33(i + vec3(0.,0.,1.)), f - vec3(0.,0.,1.));
  float g = dot(hash33(i + vec3(1.,0.,1.)), f - vec3(1.,0.,1.));
  float h = dot(hash33(i + vec3(0.,1.,1.)), f - vec3(0.,1.,1.));
  float k = dot(hash33(i + vec3(1.,1.,1.)), f - vec3(1.,1.,1.));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.,0.)), f.x), mix(hash12(i + vec2(0.,1.)), hash12(i + vec2(1.,1.)), f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(17.13, 9.71); a *= 0.5; } return s / 0.9375; }   // 4 octaves: finest ≈ 1/9 of the base scale

/* --- slow, organic flow: two octaves of evolving gradient noise --- */
vec2 breath(vec2 p){
  vec3 q = vec3(p / 560.0, uTime * 0.11);
  vec2 d = vec2(gnoise(q), gnoise(q + vec3(17.3, -9.1, 4.7)));
  q = vec3(p / 250.0, uTime * 0.17) + vec3(-5.2, 3.7, 11.1);
  d += 0.45 * vec2(gnoise(q), gnoise(q + vec3(8.4, 12.9, -6.3)));
  return d;
}

void main(){
  // fragment → hero css px (top-left origin) → image px exactly as CSS cover places it
  vec2 q = vec2(gl_FragCoord.x, uDev.y - gl_FragCoord.y) * (uCss / uDev);
  vec2 p = (q - uCover.xy) * uCover.z;

  // painting layer (the torn hole moves as one rigid sheet)
  vec2 pP = p * uPaintX.x + uPaintX.yz;
  vec4 aux = texture2D(uAux, pP / uImg);
  float D = aux.g;

  // sky layer: its own transform + breathing, relaxed onto the painting's inside the depth field
  vec2 pC = p * uCloudX.x + uCloudX.yz;
  if (uBreath > 0.0) {
    float edge = smoothstep(0.0, 64.0, min(min(p.x, uImg.x - p.x), min(p.y, uImg.y - p.y)));
    pC += breath(p) * (uBreath * (1.0 - D) * edge);
  }
  pC = mix(pC, pP, D);
  vec2 uvC = pC / uImg;

  // the eye: shift the iris inside the lids (flat over the iris, zero at the lids)
  vec2 e = (pP - uEye.xy) / uEye.zw;
  float wEye = 1.0 - smoothstep(0.42, 0.97, length(e));
  vec2 uvE = (pP - uGaze * wEye) / uImg;

  vec3 sky = texture2D(uPhoto, uvC, uBias).rgb;
  vec3 art = texture2D(uPhoto, uvE, uBias).rgb;
  float m = aux.r;
  vec3 col;

  if (uReveal >= 1.0) {
    col = mix(sky, art, m);
  } else {
    // intro: the cloud sheet over the painting tears open from the hole's centre outward.
    // Edge = distance field + large ragged lobes (fbm) + a torn-paper jag. Nothing finer than ~9 image px
    // touches the threshold (sub-pixel fibres alias into speckle); the edge is anti-aliased analytically
    // over ~1.5 device px (typical |grad dd| ≈ 0.0055 per image px).
    vec3 plate = texture2D(uPlate, (pC - uPlateR.xy) / uPlateR.zw, uBias).rgb;
    float d = length((pP - uHole.xy) / uHole.zw);
    float jag = vnoise(pP / 9.0);
    float dd = d + 0.32 * (fbm(pP / 68.0) - 0.5) + 0.05 * (jag - 0.5);
    float aa = 0.0045 * uCover.z * uCss.x / uDev.x;      // half-width: image px per device px × |grad dd|
    float thr = mix(-0.22, 1.45, uReveal);
    float open = 1.0 - smoothstep(thr - aa, thr + aa, dd);
    vec3 cloud = mix(sky, plate, aux.b * (1.0 - open));   // cover reaches past the mask feather: no stray paper
    col = mix(cloud, art, m * open);
    float fade = 1.0 - smoothstep(0.82, 1.0, uReveal);   // rim + shadow are gone before the rest state
    // a soft contact shadow on the painting just inside the edge (~10 css px)…
    float shade = open * smoothstep(thr - 0.11, thr, dd);
    col *= 1.0 - 0.26 * shade * shade * m * fade;
    // …and the torn sheet's white fibre rim on the cloud side (1–3 css px; fine fibres only tint it)
    float w = 0.012 + 0.02 * jag;
    float rim = (1.0 - open) * (1.0 - smoothstep(thr + w - aa, thr + w + aa, dd));
    float fib = vnoise(pP / 2.2);
    col = mix(col, vec3(0.948, 0.952, 0.962) * (0.92 + 0.08 * fib), rim * aux.b * fade * (0.78 + 0.22 * fib));
  }

  // temporal film grain — triangular, zero-mean, eased off in deep shadows and highlights
  if (uGrain > 0.0) {
    float g = hash12(gl_FragCoord.xy + uSeed) + hash12(gl_FragCoord.xy * 1.37 + uSeed.yx + 47.0) - 1.0;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col += g * uGrain * (0.3 + 2.8 * l * (1.0 - l));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

    /* ------------------------------------------------------------------
       State
       ------------------------------------------------------------------ */
    const S = {
      // smoothed values
      px: 0, py: 0, pz: 0,            // pointer parallax (-1..1) and hover-zoom weight
      ax: IMG_W / 2, ay: IMG_H / 2,   // zoom anchor (image px)
      gx: 0, gy: 0,                   // gaze (-1..1)
      motion: 0,                      // 0 at rest → 1 while the sky slides fast (filter steadiness)
      sp: 0, iz: 0,                   // last scroll depth / intro zoom seen by update() (their speed feeds `motion`)
      // targets
      gtx: 0, gty: 0,
      reveal: 1,                      // 0..1 raw intro progress
    };
    let still = false;                // test hook: no time-based noise (deterministic frame)
    let live = false, lost = false, dead = false, visible = true, running = false, dirty = true;
    let introStarted = false;         // the intro has begun uncovering the page
    let ptrOut = false;               // the mouse has left the window (core keeps pointer.active)
    let prog = null, buf = null, blank = null, U = {}, tex = { photo: null, plate: null, aux: null };
    let images = { photo: null, plate: null, mask: null };
    let aux = null;                   // { data, w, h, hole }
    let size = { dw: 1, dh: 1, cw: 1, ch: 1, bx: 0.5, by: 0.5 };
    const texSize = { w: IMG_W, h: IMG_H };
    let rect = { left: 0, top: 0, w: 1, h: 1 };           // hero box in document coords (transform-free)
    let lastT = now(), lastSeed = -1, lastScroll = -1, lastMove = -1e9, t0 = now();
    let sacc = { next: now() + rand(3500, 5500), away: false };
    let needReveal = false, sawProgress = false, revealTween = null;
    let liveAt = 0, slowFor = 0, lastDraw = 0;
    let blanked = false;              // the buffer was invalidated while paused: canvas hidden until the next full draw
    const drawnG = { x: 0, y: 0 };    // gaze in the frame on the canvas

    /* ------------------------------------------------------------------
       GL setup (re-runnable after context restore)
       ------------------------------------------------------------------ */
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
      return s;
    }
    function setupGL() {
      const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
      gl.deleteShader(vs); gl.deleteShader(fs);
      gl.useProgram(prog);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one full-screen triangle
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      U = {};
      ['uPhoto', 'uPlate', 'uAux', 'uDev', 'uCss', 'uCover', 'uImg', 'uCloudX', 'uPaintX', 'uGaze', 'uEye', 'uHole',
        'uTime', 'uBreath', 'uSeed', 'uGrain', 'uReveal', 'uBias', 'uPlateR'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(U.uPhoto, 0); gl.uniform1i(U.uPlate, 1); gl.uniform1i(U.uAux, 2);
      gl.uniform2f(U.uImg, IMG_W, IMG_H);
      gl.uniform4f(U.uEye, EYE.x, EYE.y, EYE.rx, EYE.ry);
      gl.uniform4f(U.uPlateR, PLATE_RECT[0], PLATE_RECT[1], PLATE_RECT[2], PLATE_RECT[3]);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      tex = { photo: null, plate: null, aux: null };
      // 1×1 stand-in on the plate unit, so the sampler is always complete (the plate only lives during the intro)
      blank = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    const isPOT = n => (n & (n - 1)) === 0;
    const nextPOT = n => { let p = 1; while (p < n) p <<= 1; return p; };

    /* photos: full-res + mip chain; draw() biases the LOD so that at rest the exact level the browser
       draws the CSS image from is sampled (bilinear, full res at 1440 — sharp, not box-blurred) */
    function uploadImage(unit, img) {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      let src = img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!isGL2 && !(isPOT(w) && isPOT(h))) {
        // WebGL1 can't mipmap NPOT textures: resample once into a power-of-two canvas
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
        const c = document.createElement('canvas');
        c.width = Math.min(max, nextPOT(w)); c.height = Math.min(max, nextPOT(h));
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
        src = c;
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);   // throws SecurityError on tainted (file://) images
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (unit === 0) { texSize.w = src.width || w; texSize.h = src.height || h; }
      return t;
    }
    function uploadAux() {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, aux.w, aux.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, aux.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform4f(U.uHole, aux.hole[0], aux.hole[1], aux.hole[2], aux.hole[3]);
      return t;
    }
    function dropPlate() {
      if (tex.plate && !gl.isContextLost()) {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blank);
        gl.deleteTexture(tex.plate);
      }
      tex.plate = null; images.plate = null;
    }

    /* ------------------------------------------------------------------
       Aux texture: painting mask (r) + depth field (g), built once on the CPU.
       The depth field is 1 wherever the mask is non-zero and eases to 0 over
       ~50 css px outside it (chamfer distance + smootherstep): the sky's
       transform relaxes onto the painting's there, so the hole never seams.
       ------------------------------------------------------------------ */
    function buildAux(mask) {
      const w = 713, h = 336, N = w * h;                  // ½ of the mask = 4 image px per texel
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingQuality = 'high';
      x.drawImage(mask, 0, 0, w, h);
      const src = x.getImageData(0, 0, w, h).data;
      const dist = new Float32Array(N), INF = 1e9;
      let sx = 0, sy = 0, sn = 0;
      for (let i = 0; i < N; i++) {
        const v = src[i * 4];
        if (v > 2) { dist[i] = 0; const px = i % w, py = (i / w) | 0; sx += px; sy += py; sn++; } else dist[i] = INF;
      }
      // two-pass 3-4 chamfer distance transform (units of 1/3 texel)
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        const i = y * w + xx; let d = dist[i]; if (!d) continue;
        if (xx > 0) d = Math.min(d, dist[i - 1] + 3);
        if (y > 0) {
          d = Math.min(d, dist[i - w] + 3);
          if (xx > 0) d = Math.min(d, dist[i - w - 1] + 4);
          if (xx < w - 1) d = Math.min(d, dist[i - w + 1] + 4);
        }
        dist[i] = d;
      }
      for (let y = h - 1; y >= 0; y--) for (let xx = w - 1; xx >= 0; xx--) {
        const i = y * w + xx; let d = dist[i]; if (!d) continue;
        if (xx < w - 1) d = Math.min(d, dist[i + 1] + 3);
        if (y < h - 1) {
          d = Math.min(d, dist[i + w] + 3);
          if (xx < w - 1) d = Math.min(d, dist[i + w + 1] + 4);
          if (xx > 0) d = Math.min(d, dist[i + w - 1] + 4);
        }
        dist[i] = d;
      }
      const R0 = 1.5, R = 26;                             // texels: hold 1 for 1.5 texels, then fall off over 26 (≈ 52 css px)
      const data = new Uint8Array(N * 4);
      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let i = 0; i < N; i++) {
        const d = dist[i] / 3;
        let k = 1;
        if (d > R0) { const t = Math.min(1, (d - R0) / R); k = 1 - t * t * t * (t * (t * 6 - 15) + 10); }
        data[i * 4] = src[i * 4];
        data[i * 4 + 1] = Math.round(k * 255);
        // intro cover: the mask grown by ~12 image px with a short feather, so no torn-paper fringe peeks out early
        const cvr = d <= 3 ? 1 : d >= 7 ? 0 : 1 - ((d - 3) / 4) * ((d - 3) / 4) * (3 - 2 * ((d - 3) / 4));
        data[i * 4 + 2] = Math.round(cvr * 255);
        data[i * 4 + 3] = 255;
        if (src[i * 4] > 2) { const px = i % w, py = (i / w) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
      }
      // tear origin: halfway between the mask's centroid and the eye, so the gaze is revealed first
      const k = IMG_W / w;
      const cx = sn ? (sx / sn + 0.5) * k : IMG_W / 2, cy = sn ? (sy / sn + 0.5) * (IMG_H / h) : IMG_H / 2;
      const ox = (cx + EYE.x) / 2, oy = (cy + EYE.y) / 2;
      const rx = Math.max(ox - minX * k, (maxX + 1) * k - ox, 40), ry = Math.max(oy - minY * (IMG_H / h), (maxY + 1) * (IMG_H / h) - oy, 40);
      aux = { data, w, h, hole: [ox, oy, rx, ry] };
    }

    /* ------------------------------------------------------------------
       Layout: canvas size (device px), CSS cover mapping, hero rect
       ------------------------------------------------------------------ */
    function parsePos(v, fallback) {
      if (!v) return fallback;
      v = v.trim();
      if (v.endsWith('%')) return parseFloat(v) / 100;
      if (v === 'left' || v === 'top') return 0;
      if (v === 'right' || v === 'bottom') return 1;
      if (v === 'center') return 0.5;
      return fallback;
    }
    function readBackground() {
      const cs = getComputedStyle(hero);
      const pos = (cs.backgroundPosition || '50% 50%').split(',')[0].trim().split(/\s+/);
      size.bx = parsePos(pos[0], 0.5); size.by = parsePos(pos[1] || pos[0], 0.5);
    }
    function measureRect() {
      // transform-free document position (the intro may be scaling .hero)
      let el = hero, top = 0, left = 0;
      while (el) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent; }
      rect = { left, top, w: hero.offsetWidth || 1, h: hero.offsetHeight || 1 };
    }
    function resize(entry) {
      if (dead) return;
      const dpr = window.devicePixelRatio || 1;
      const cs = getComputedStyle(canvas);
      const cw = parseFloat(cs.width) || (entry ? entry.contentRect.width : canvas.clientWidth);
      const ch = parseFloat(cs.height) || (entry ? entry.contentRect.height : canvas.clientHeight);
      let dw = 0, dh = 0;
      const cap = dprCap(cw, ch);
      if (dpr <= cap + 1e-3) {
        // 1 texel = 1 device pixel: size the buffer to the pixels the canvas is really composited into
        // (Chromium snaps both edges of the fractional box), so nothing gets resampled on screen.
        const hs = getComputedStyle(hero);
        // the intro scales .hero (a plain scale/translate matrix): undo it, so the buffer is sized for the box
        // at rest and the transform clearing doesn't reallocate (and fully redraw) it
        const m = /^matrix\(([^)]+)\)$/.exec(hs.transform), v = m ? m[1].split(',').map(parseFloat) : null;
        const plain = [hs.scale, hs.translate, hs.rotate].every(p => !p || p === 'none') &&
          (hs.transform === 'none' || (v && v.length === 6 && !v[1] && !v[2] && v[0] > 0 && v[3] > 0));
        if (plain) {
          const r = hero.getBoundingClientRect();
          let x = r.left + scrollX, y = r.top + scrollY, w = r.width, h = r.height;
          if (v) {
            const o = (hs.transformOrigin || '').split(' ').map(parseFloat);
            const ox = o[0] || 0, oy = o[1] || 0;
            x -= ox * (1 - v[0]) + v[4]; y -= oy * (1 - v[3]) + v[5]; w /= v[0]; h /= v[3];
          }
          dw = Math.round((x + w) * dpr) - Math.round(x * dpr);
          dh = Math.round((y + h) * dpr) - Math.round(y * dpr);
        } else {
          const dp = entry && entry.devicePixelContentBoxSize && entry.devicePixelContentBoxSize[0];
          if (dp) { dw = dp.inlineSize; dh = dp.blockSize; }
        }
      }
      if (!dw || !dh) { const k = Math.min(dpr, cap); dw = Math.round(cw * k); dh = Math.round(ch * k); }
      if (!cw || !ch || !dw || !dh) return;
      const bx = size.bx, by = size.by;
      readBackground();
      measureRect();
      const realloc = canvas.width !== dw || canvas.height !== dh;
      const changed = realloc || cw !== size.cw || ch !== size.ch || dw !== size.dw || dh !== size.dh || bx !== size.bx || by !== size.by;
      size.cw = cw; size.ch = ch;
      if (realloc) { canvas.width = dw; canvas.height = dh; }   // clears the drawing buffer…
      size.dw = dw; size.dh = dh;
      if (!changed) return;            // same geometry: the frame on the canvas is still right (no redraw)
      dirty = true;
      if (!live) return;
      // …so redraw right here while on screen: ResizeObserver / the debounced rAF can run after this frame's
      // tick, and a cleared buffer would composite as one black frame (otherwise the loop redraws this frame).
      // Paused (hero off screen / tab hidden): don't pay for a frame nobody sees — hide the stale canvas;
      // the next draw brings it back.
      if (running) { if (realloc) draw(now()); }
      else if (!blanked) { blanked = true; canvas.classList.remove('is-live'); }
    }

    /* ------------------------------------------------------------------
       Per-frame
       ------------------------------------------------------------------ */
    function cover() {
      const s = Math.max(size.cw / IMG_W, size.ch / IMG_H);
      const w = IMG_W * s, h = IMG_H * s;
      return { s, ox: (size.cw - w) * size.bx, oy: (size.ch - h) * size.by };
    }
    // affine sample transforms p' = p*s + t, composed in image px
    const ident = () => ({ s: 1, x: 0, y: 0 });
    const zoomAbout = (L, z, ax, ay) => { L.s /= z; L.x = ax + (L.x - ax) / z; L.y = ay + (L.y - ay) / z; return L; };
    const shift = (L, ox, oy) => { L.x -= ox; L.y -= oy; return L; };

    // 0 at the top → 1 once the hero has scrolled away (soft mode: none — the static frame just scrolls with the page)
    const scrollDepth = () => (soft ? 0 : clamp(FX.scroll.y / Math.max(1, rect.top + rect.h), 0, 1));
    // intro progress → sky zoom weight (1.1 → 1 as the hero opens)
    const introZoom = () => Math.pow(1 - clamp(S.reveal, 0, 1), 3);

    function update(t, dt, sp) {
      const P = FX.pointer;
      const ease = k => 1 - Math.pow(1 - k, dt * 60);    // frame-rate independent lerp factor
      const cv = cover();
      const heroTop = rect.top - FX.scroll.y;            // viewport position from the cached rect
      const ptrOn = fine && P.active && !ptrOut;

      // pointer parallax target (-1..1 around the hero centre)
      let tx = 0, ty = 0, tz = 0, ax = S.ax, ay = S.ay;
      if (ptrOn && !soft) {
        const lx = P.x - rect.left, ly = P.y - heroTop;
        tx = clamp((lx / rect.w) * 2 - 1, -1, 1); ty = clamp((ly / rect.h) * 2 - 1, -1, 1);
        tz = Math.max(Math.abs(tx), Math.abs(ty));
        ax = (clamp(lx, 0, rect.w) / rect.w * size.cw - cv.ox) / cv.s;
        ay = (clamp(ly, 0, rect.h) / rect.h * size.ch - cv.oy) / cv.s;
      }

      // gaze: follow the pointer; after IDLE_MS of stillness (or on touch) hold a beat, drift home,
      // then wander in occasional saccades — mostly sideways glances, always returning to centre.
      // Held while the eye itself is off screen (the rest of the hero may still be in view).
      const following = ptrOn && t - lastMove < IDLE_MS;
      const ey = heroTop + (EYE.y * cv.s + cv.oy) * (rect.h / size.ch), eyeR = EYE.ry * cv.s * 2;
      let kg;
      if (still) {
        S.gtx = S.gty = 0; kg = 1;
      } else if (ey < -eyeR || ey > innerHeight + eyeR) {
        kg = 0;
      } else if (following) {
        const ex = rect.left + (EYE.x * cv.s + cv.ox) * (rect.w / size.cw);
        const vx = P.x - ex, vy = P.y - ey, R = 170 * (size.cw / 1426);
        const inv = 1 / Math.sqrt(vx * vx + vy * vy + R * R);   // saturating: ~linear near the eye, 1 far away
        S.gtx = vx * inv; S.gty = vy * inv;
        sacc.away = true; sacc.next = t + 1200;
        kg = 0.14;
      } else {
        if (t > sacc.next) {
          // lite on a GPU (each glance = a full-frame repaint): no idle wander, the gaze just settles home
          if (sacc.away || (lite && !soft)) { S.gtx = S.gty = 0; sacc.away = false; sacc.next = t + rand(2600, 6000); }
          else {
            const a = Math.random() < 0.75 ? (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.55, 0.55) : rand(0, Math.PI * 2);
            const r = rand(0.35, 0.85);
            S.gtx = Math.cos(a) * r; S.gty = Math.sin(a) * r * 0.8;
            sacc.away = true; sacc.next = t + rand(700, 1700);
          }
        }
        kg = sacc.away ? 0.2 : 0.045;                      // quick saccade out, slow drift home
      }

      const kp = ease(0.07), kgE = kg ? ease(kg) : 0;
      const prev = [S.px, S.py, S.pz, S.ax * 1e-3, S.ay * 1e-3, S.motion];
      const ox = S.px, oy = S.py, oz = S.pz;
      S.px += (tx - S.px) * kp; S.py += (ty - S.py) * kp; S.pz += (tz - S.pz) * kp;
      if (ptrOn) { S.ax += (ax - S.ax) * kp; S.ay += (ay - S.ay) * kp; }
      S.gx += (S.gtx - S.gx) * kgE; S.gy += (S.gty - S.gy) * kgE;
      // how fast the sky slides (image px / frame) — pointer parallax, scroll depth and the intro zoom alike:
      // while it slides, a steadier trilinear mip blend keeps the fine grain from shimmering
      const iz = introZoom();
      const slide = (Math.abs(S.px - ox) * PARALLAX.cloud[0] + Math.abs(S.py - oy) * PARALLAX.cloud[1] + Math.abs(S.pz - oz) * 20 +
        Math.abs(sp - S.sp) * 110 + Math.abs(iz - S.iz) * 70) / (dt * 60);
      S.sp = sp; S.iz = iz;
      const mt = clamp((slide - 0.08) / 0.5, 0, 1);
      S.motion += (mt - S.motion) * ease(mt > S.motion ? 0.25 : 0.035);
      if (S.motion < 1e-3 && mt === 0) S.motion = 0;

      // snap tiny residues so the rest state is exact
      const snap = (k, v) => { if (Math.abs(S[k] - v) < 1e-4) S[k] = v; };
      snap('px', tx); snap('py', ty); snap('pz', tz); snap('gx', S.gtx); snap('gy', S.gty);
      const next = [S.px, S.py, S.pz, S.ax * 1e-3, S.ay * 1e-3, S.motion];
      for (let i = 0; i < next.length; i++) if (Math.abs(next[i] - prev[i]) > 1e-5) return true;
      // the gaze counts once the iris has moved ≥ 1/20 device px from the frame on the canvas, or has landed
      // (the long tail of the drift home doesn't repaint for shifts nobody can see; the rest state is exact)
      const gd = Math.max(Math.abs(S.gx - drawnG.x) * GAZE.x, Math.abs(S.gy - drawnG.y) * GAZE.y) * cv.s * (size.dw / size.cw);
      return gd >= 0.05 || (gd > 0 && S.gx === S.gtx && S.gy === S.gty);
    }

    function draw(t, eyeOnly) {
      if (!prog || lost) return;
      const cv = cover();
      const cx = (size.cw / 2 - cv.ox) / cv.s, cy = (size.ch / 2 - cv.oy) / cv.s;   // hero centre (image px)
      const top = -cv.oy / cv.s;                                                      // hero top edge (image px)
      const sp = scrollDepth();
      // intro tear. The intro drives `progress` with an in-out ease, which alone would rip the whole hole
      // open in ~10% of its duration (area ∝ threshold²) — a pop. Undo the in-out to recover time, then give
      // the rip its own gentle ease-out, timed so it is SEEN: with the full intro (tear 1.75 s from +0.25 s)
      // the first rip lands as the overlay clears the painting (~+0.6 s), 10 → 90% of the hole opens over
      // ~0.5 s, the last ragged fibres creep open until ~+1.4 s and the paper rim fades out by the end.
      const pr = clamp(S.reveal, 0, 1);
      const tl = pr < 0.5 ? Math.sqrt(pr / 2) : 1 - Math.sqrt((1 - pr) / 2);
      const rv = S.reveal >= 1 ? 1 : 1 - Math.pow(1 - clamp((tl - 0.10) / 0.88, 0, 1), 1.4);
      const intro = introZoom();
      const hole = aux ? aux.hole : [cx, cy];

      // sky: hover zoom toward the pointer + parallax shift, scroll depth, intro settle
      const C = ident();
      zoomAbout(C, 1 + PARALLAX.zoom * S.pz, S.ax, S.ay);
      shift(C, S.px * PARALLAX.cloud[0], S.py * PARALLAX.cloud[1]);
      // scroll: as the hero leaves, the sky grows (from the top edge, so the bottom never runs dry)
      // and rises a little faster than the painting
      zoomAbout(C, 1 + SCROLL.cloudZoom * sp, cx, top);
      shift(C, 0, -SCROLL.cloudLift * sp);
      zoomAbout(C, 1 + INTRO.cloudZoom * intro, cx, cy);
      // painting: a third of the sky's travel
      const Pt = ident();
      shift(Pt, S.px * PARALLAX.paint[0], S.py * PARALLAX.paint[1]);
      zoomAbout(Pt, 1 + SCROLL.paintZoom * sp, cx, top);
      shift(Pt, 0, -SCROLL.paintLift * sp);
      zoomAbout(Pt, 1 + INTRO.paintZoom * intro, hole[0], hole[1]);

      // Mip choice. Browsers draw the CSS image from the largest mip whose size still covers the
      // drawn size (bilinear on full res at 1440 → sharp). Pin exactly that level at rest; while the sky
      // slides, blend toward true trilinear so fine grain doesn't shimmer.
      const tgtW = Math.ceil(IMG_W * cv.s * (size.dw / size.cw)), tgtH = Math.ceil(IMG_H * cv.s * (size.dh / size.ch));
      let L = 0;
      while (L < 12 && Math.floor(texSize.w / Math.pow(2, L + 1)) >= tgtW && Math.floor(texSize.h / Math.pow(2, L + 1)) >= tgtH) L++;
      const lod0 = Math.log2(Math.max(texSize.w / Math.max(1, IMG_W * cv.s * (size.dw / size.cw)), 1e-3));
      const restBias = Math.min(0, L - lod0 - 0.005);
      const bias = restBias * (1 - S.motion);

      const seed = Math.floor(t / (1000 / 24));
      gl.viewport(0, 0, size.dw, size.dh);
      gl.uniform1f(U.uBias, bias);
      gl.uniform2f(U.uDev, size.dw, size.dh);
      gl.uniform2f(U.uCss, size.cw, size.ch);
      gl.uniform3f(U.uCover, cv.ox, cv.oy, 1 / cv.s);
      gl.uniform3f(U.uCloudX, C.s, C.x, C.y);
      gl.uniform3f(U.uPaintX, Pt.s, Pt.x, Pt.y);
      gl.uniform2f(U.uGaze, S.gx * GAZE.x, S.gy * GAZE.y);
      const ambient = !still && !lite;
      gl.uniform1f(U.uTime, ambient ? (t - t0) / 1000 : 0);
      gl.uniform1f(U.uBreath, ambient ? BREATH : 0);
      gl.uniform2f(U.uSeed, ((seed * 0.6180339887) % 1) * 517, ((seed * 0.7548776662) % 1) * 331);
      gl.uniform1f(U.uGrain, ambient ? GRAIN : 0);
      gl.uniform1f(U.uReveal, tex.plate && rv < 1 ? rv : 1);
      drawnG.x = S.gx; drawnG.y = S.gy;
      if (eyeOnly) {
        // soft mode: only the gaze changed — repaint just the eye opening's box (the gaze weight is 0 outside
        // the ellipse, so the preserved rest of the frame is still exact)
        const kx = size.dw / size.cw, ky = size.dh / size.ch;
        const dx = i => (((i - Pt.x) / Pt.s) * cv.s + cv.ox) * kx, dy = i => (((i - Pt.y) / Pt.s) * cv.s + cv.oy) * ky;
        const x0 = Math.max(0, Math.floor(dx(EYE.x - EYE.rx)) - 2), x1 = Math.min(size.dw, Math.ceil(dx(EYE.x + EYE.rx)) + 2);
        const y0 = Math.max(0, Math.floor(dy(EYE.y - EYE.ry)) - 2), y1 = Math.min(size.dh, Math.ceil(dy(EYE.y + EYE.ry)) + 2);
        if (x1 <= x0 || y1 <= y0) return;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x0, size.dh - y1, x1 - x0, y1 - y0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
        return;
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      lastScroll = sp; lastSeed = seed; dirty = false;
      if (blanked && live) { blanked = false; canvas.classList.add('is-live'); }   // (same frame: no flash)
    }

    function tick() {
      const t = now();
      const dt = clamp((t - lastT) / 1000, 0.001, 0.1); lastT = t;
      const sp = scrollDepth();
      const moving = update(t, dt, sp);
      if (soft) {                       // static frame: a full draw only when invalidated, else just the eye
        if (dirty) draw(t); else if (moving) draw(t, true);
        return;
      }
      const seed = Math.floor(t / (1000 / 24));
      const ambient = !still && !lite;
      // governor: if the ambient loop can't hold ~28 fps (after warm-up, intro done), go lite for good
      if (ambient && !forced && t - liveAt > 2500 && S.reveal >= 1) {
        slowFor = dt > 1 / 28 ? slowFor + dt : Math.max(0, slowFor - dt * 0.5);
        if (slowFor > 1.5) { lite = true; dirty = true; }
      }
      // full rate while anything moves; otherwise only on the 24 fps grain/breath cadence.
      // (Intro progress marks the frame dirty itself, so a waiting intro costs nothing behind the preloader.)
      if (!moving && !dirty && sp === lastScroll && (!ambient || seed === lastSeed)) return;
      if (lite && t - lastDraw < 60) { dirty = true; return; }   // slow GPU: ≤ ~16 draws/s, last state always lands
      lastDraw = t;
      draw(t);
    }

    /* ------------------------------------------------------------------
       Loop control: only while on screen, tab visible and the frame is live
       ------------------------------------------------------------------ */
    const ticker = FX.gsap && FX.gsap.ticker;
    let rafId = 0;
    const rafLoop = () => { rafId = requestAnimationFrame(rafLoop); tick(); };
    function sync() {
      const should = live && !lost && visible && !document.hidden;
      if (should === running) return;
      running = should;
      // (no redraw on resume: the canvas keeps its last frame; whatever changed while paused marked it dirty)
      if (should) { lastT = now(); ticker ? ticker.add(tick) : (rafId = requestAnimationFrame(rafLoop)); }
      else { ticker ? ticker.remove(tick) : cancelAnimationFrame(rafId); }
    }

    /* ------------------------------------------------------------------
       Intro coupling
       ------------------------------------------------------------------ */
    function finishReveal(animate) {
      if (S.reveal >= 1) { if (tex.plate) dropPlate(); return; }
      if (revealTween) revealTween.kill();
      if (animate && live && FX.gsap) {
        revealTween = FX.gsap.to(S, { reveal: 1, duration: 0.9, ease: 'power2.out', overwrite: true, onUpdate: () => { dirty = true; }, onComplete: () => { revealTween = null; dirty = true; dropPlate(); } });
      } else { S.reveal = 1; dirty = true; dropPlate(); }
    }
    function decideIntro() {
      FX.once('intro:start', () => { introStarted = true; });
      // (soft mode: a full-frame tear would run at a few fps and stall the intro — the painting simply shows)
      needReveal = !soft && !!(FX.introRunning && !FX.introDone);
      if (!needReveal) { S.reveal = 1; return; }
      S.reveal = 0;
      // safety net: never leave the hole closed (9 s overall, or 3 s after the last intro:hero tick)
      let safety = setTimeout(() => finishReveal(true), 9000);
      FX.on('intro:hero', d => {
        clearTimeout(safety); safety = setTimeout(() => finishReveal(true), 3000);
        const p = clamp(+(d && d.progress) || 0, 0, 1);
        if (!live) { if (p > 0) sawProgress = true; return; }
        if (revealTween || S.reveal >= 1) return;
        S.reveal = p; dirty = true;
        if (p >= 1) finishReveal(false);
      });
      FX.once('intro:done', () => { clearTimeout(safety); finishReveal(true); });
    }

    /* ------------------------------------------------------------------
       Loading → first frame → fade in
       ------------------------------------------------------------------ */
    const loadImage = src => new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(img));
      img.onerror = () => rej(new Error('image failed: ' + String(src).slice(0, 64)));   // (data: URIs are huge)
      img.src = src;
    });
    const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
    // texImage2D(<img>) decodes the image again, synchronously (~70 ms for hero.jpg on a fast CPU). An ImageBitmap
    // is decoded off the main thread; same default colour-space conversion, so the same pixels as the CSS image.
    // (Only for the upload: the <img> stays the source kept for a context restore.)
    const toBitmap = img => (typeof createImageBitmap === 'function'
      ? createImageBitmap(img, { premultiplyAlpha: 'none' }).catch(() => img) : Promise.resolve(img));
    const upload = (unit, src) => { try { return uploadImage(unit, src); } finally { if (src.close) src.close(); } };
    function heroImageURL() {
      // reuse the exact URL of the CSS background (cache hit; a data: URI in the standalone build)
      const m = /url\((['"]?)(.*?)\1\)/.exec(getComputedStyle(hero).backgroundImage || '');
      return m ? m[2] : null;
    }

    function goLive() {
      // the intro is already uncovering the page (the CSS painting may be on screen): never hide it again
      if ((sawProgress || introStarted) && S.reveal < 1) finishReveal(false);
      draw(now());
      // present this frame first, then reveal the canvas (cross-fade only when it's identical to the CSS)
      requestAnimationFrame(() => {
        if (lost) return;
        live = true; liveAt = now();
        const fade = S.reveal >= 1;
        canvas.classList.toggle('is-fading', fade);
        canvas.classList.add('is-live');
        if (fade) setTimeout(() => canvas.classList.remove('is-fading'), 800);
        sync();
      });
    }

    /* ---------- file:// pages ----------
       Every file:// URL is its own origin: images load and paint, but WebGL refuses their pixels. A classic
       <script> still loads from disk and data: URIs are same-origin, so assets/hero-gl-data.js carries
       byte-identical data: copies (same decode → same pixels). Its header has the one-step regenerator. */
    const tainted = img => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 1;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1);
        return false;
      } catch (_) { return true; }
    };
    const loadData = () => new Promise((res, rej) => {
      const s = document.createElement('script');
      const done = ok => {
        clearTimeout(timer); s.remove();
        const d = window.HERO_GL_DATA;
        try { delete window.HERO_GL_DATA; } catch (_) { window.HERO_GL_DATA = undefined; }
        if (ok && d && d.photo && d.mask) res(d); else rej(Object.assign(new Error('hero-gl data unavailable'), { name: 'SecurityError' }));
      };
      const timer = setTimeout(() => done(false), 6000);
      s.onload = () => done(true); s.onerror = () => done(false);
      s.src = 'assets/hero-gl-data.js';
      document.head.appendChild(s);
    });

    async function start() {
      const url = heroImageURL();
      if (!url) throw new Error('no hero background');
      setupGL();
      let pPhoto = loadImage(url);
      const pMask = loadImage('assets/hero-mask.png');
      await new Promise(r => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r, { once: true }) : r()));
      decideIntro();
      let plateURL = needReveal ? 'assets/hero-gl-plate.jpg' : null;

      images.mask = await pMask;
      if (tainted(images.mask)) {
        // only a page opened from disk can be helped; any other cross-origin setup keeps the CSS background
        if (location.protocol !== 'file:') throw Object.assign(new Error('cross-origin hero images'), { name: 'SecurityError' });
        const data = await loadData();
        const onDisk = await pPhoto;
        if (!/\/hero\.jpg([?#]|$)/i.test(url)) throw new Error('hero background is no longer hero.jpg');
        pPhoto = loadImage(data.photo).then(img => {
          // a stale copy would show a different picture than the CSS background: refuse it
          if (img.naturalWidth !== onDisk.naturalWidth || img.naturalHeight !== onDisk.naturalHeight) throw new Error('assets/hero-gl-data.js is stale');
          return img;
        });
        images.mask = await loadImage(data.mask);
        plateURL = plateURL && data.plate;
      }
      const pPlate = plateURL ? loadImage(plateURL).catch(() => null) : Promise.resolve(null);

      images.photo = await pPhoto;
      const photo = await toBitmap(images.photo);
      await nextFrame(); if (lost) { if (photo.close) photo.close(); return; }
      tex.photo = upload(0, photo);                      // anything still tainted throws a SecurityError here → CSS fallback
      await nextFrame(); if (lost) return;               // (the CPU-side aux build gets a frame of its own)
      buildAux(images.mask);
      tex.aux = uploadAux();
      images.plate = await pPlate;
      if (images.plate && S.reveal < 1 && !sawProgress) {
        const plate = await toBitmap(images.plate);
        await nextFrame(); if (lost) { if (plate.close) plate.close(); return; }
        tex.plate = upload(1, plate);
      } else { images.plate = null; if (S.reveal < 1) finishReveal(false); }

      // first correct size, then the first frame
      resize(null);
      goLive();
    }

    function fail(err) {
      dead = true;
      stopAll();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      // tainted canvases (file://) and missing WebGL are expected fallbacks — stay quiet about those
      if (err && err.name !== 'SecurityError') { try { console.warn('[hero-gl] falling back to CSS background:', err.message || err); } catch (_) { /* noop */ } }
    }
    function stopAll() { live = false; sync(); if (ro) ro.disconnect(); if (unVis) unVis(); }

    /* ------------------------------------------------------------------
       Wiring
       ------------------------------------------------------------------ */
    let ro = null, unVis = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(entries => { for (const e of entries) resize(e); });
      try { ro.observe(canvas, { box: 'device-pixel-content-box' }); } catch (_) { ro.observe(canvas); }
    }
    unVis = FX.whenVisible(hero, v => { visible = v; sync(); });
    FX.on('visibility', () => sync());
    if (fine) {
      FX.on('pointer', () => { lastMove = now(); ptrOut = false; });
      // the cursor left the window (address bar, another app): let the sky settle back instead of freezing
      // at the last offset — core's pointer.active doesn't see this in every browser
      // (update() sees it next frame; nothing to redraw until something actually moves)
      document.addEventListener('mouseout', e => { if (!e.relatedTarget) ptrOut = true; }, { passive: true });
    }
    // the hero's document position feeds the pointer mapping and scroll depth, which update()/tick() compare
    // themselves — a refresh alone never invalidates the frame
    const remeasure = () => { if (dead) return; measureRect(); };
    // re-snap whenever the hero may have moved without changing size (centring > 1440, intro transforms cleared)
    let rz = 0;
    const resizeSoon = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => resize(null)); };
    addEventListener('resize', resizeSoon, { passive: true });
    FX.on('load', resizeSoon);
    FX.once('intro:done', () => { resizeSoon(); setTimeout(resizeSoon, 120); setTimeout(resizeSoon, 1200); });
    if (FX.ScrollTrigger && FX.ScrollTrigger.addEventListener) FX.ScrollTrigger.addEventListener('refresh', remeasure);

    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      lost = true; live = false; blanked = false; sync();
      canvas.classList.remove('is-live', 'is-fading');        // instantly back to the CSS background
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      lost = false;
      try {
        setupGL();
        tex.photo = uploadImage(0, images.photo);
        tex.aux = uploadAux();
        if (S.reveal < 1) finishReveal(false);
        resize(null);
        goLive();
      } catch (err) { fail(err); }
    }, false);

    // test / integration hook (read-only state + a deterministic "still" switch)
    FX.heroGL = {
      canvas,
      get live() { return live; },
      get gl2() { return isGL2; },
      get lite() { return lite; },
      get soft() { return soft; },
      get running() { return running; },
      still(on) { still = !!on; dirty = true; S.gtx = S.gty = 0; if (still) { S.gx = S.gy = 0; } if (live && !running) draw(now()); },
      state: S,
    };

    start().catch(fail);
  }
})();
