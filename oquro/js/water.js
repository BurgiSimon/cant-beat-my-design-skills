// The water: light at the bottom of a pool, as the shot's background has it. One fixed canvas behind the page, seen
// through every light section (the dark ones cover it). Crisp under the hero, softer and paler lower down; the pointer
// sends rings across it. Drawn at half resolution (the blur is part of the look) and only while some of it shows.

import { calm, motion, fine, gl, on, pointer, scroll, loop, clamp, damp } from './core.js';

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uSoft; uniform float uScroll; uniform float uScale; uniform vec4 uRip[8];
out vec4 o;
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec2 site(vec2 c, float t){ vec2 h = hash22(c); return 0.5 + 0.4 * sin(t * (0.45 + 0.5 * h) + 6.2831 * h.yx); }
vec2 worley(vec2 p, float t){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 r = g + site(i + g, t) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
float caustic(vec2 p, float t, float sharp){ vec2 w = worley(p, t); return exp(-(w.y - w.x) * sharp); }
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 css = vec2(frag.x, uRes.y - frag.y) / uScale;           // CSS px from the top left
  vec2 off = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 r = uRip[i]; float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 3.0) continue;
    vec2 d = css - r.xy; float dist = length(d);
    float front = age * 260.0;
    float q = (dist - front) / 70.0;
    float ring = exp(-q * q);
    off += normalize(d + 0.001) * sin((dist - front) * 0.09) * ring * (1.0 - age / 3.0) * r.w;
  }
  vec2 uv = (css + vec2(0.0, uScroll * 0.35)) / 640.0;
  uv += off * 0.022;
  float t = uTime;
  vec2 q = uv * 2.2 + 0.34 * vec2(sin(uv.y * 4.3 + uv.x * 1.7 + t * 0.27), cos(uv.x * 3.9 - uv.y * 1.3 - t * 0.23));
  float sharp = mix(7.5, 3.0, uSoft);
  float c1 = caustic(q, t * 0.55, sharp);
  float c2 = caustic(q * 1.63 + vec2(3.1, 1.7), t * 0.7 + 4.0, sharp * 1.15);
  float c = c1 * 0.62 + c2 * 0.48;
  c = c * c * (3.0 - 2.0 * min(c, 1.0));
  // the pool floor: light grey, a slow swell of light across it, caustics on top
  float swell = 0.5 + 0.5 * sin(uv.x * 1.3 + uv.y * 0.9 + t * 0.12);
  float base = mix(0.938, 0.948, uSoft) + swell * 0.012;
  float lift = mix(0.062, 0.045, uSoft);
  float v = base + c * lift;
  v += (fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // dither against banding
  o = vec4(vec3(v * 0.997, v * 0.998, v), 1.0);
}`;

export function init() {
  const canvas = document.querySelector('[data-water]');
  if (!canvas || !gl) return;
  const ctx = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!ctx) return;
  // built again when a lost context comes back (iOS drops them in the background, GPUs reset)
  let uRes, uTime, uSoft, uScroll, uScale, uRip;
  const sh = (type, src) => { const s = ctx.createShader(type); ctx.shaderSource(s, src); ctx.compileShader(s); if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) throw new Error(ctx.getShaderInfoLog(s)); return s; };
  const setup = () => {
    const prog = ctx.createProgram();
    ctx.attachShader(prog, sh(ctx.VERTEX_SHADER, VS)); ctx.attachShader(prog, sh(ctx.FRAGMENT_SHADER, FS));
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) throw new Error(ctx.getProgramInfoLog(prog));
    ctx.useProgram(prog);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer());
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, 'p'); ctx.enableVertexAttribArray(loc); ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const U = (n) => ctx.getUniformLocation(prog, n);
    uRes = U('uRes'); uTime = U('uTime'); uSoft = U('uSoft'); uScroll = U('uScroll'); uScale = U('uScale'); uRip = U('uRip');
  };
  setup();

  const SCALE = 0.5;
  let w = 0, h = 0;
  const resize = () => {
    w = Math.max(1, Math.round(innerWidth * SCALE)); h = Math.max(1, Math.round(innerHeight * SCALE));
    canvas.width = w; canvas.height = h; ctx.viewport(0, 0, w, h);
  };
  // a new size clears the canvas and the loop may skip (or not run) this frame: paint now, or a phone's toolbar
  // sliding away flashes it black
  resize(); addEventListener('resize', () => { resize(); draw(); });

  // what shows: the light sections are see-through, so the water runs only while one is on screen. Watched, not
  // measured every frame. One about to come in (within a quarter screen) gets the water painted as the page scrolls,
  // its clock held, so it never comes in over a frame from somewhere else.
  const lights = document.querySelectorAll('[data-theme="light"]');
  const shown = new Set(), near = new Set(); let lost = false;
  const want = () => !calm && !lost && shown.size > 0 && !document.hidden;
  const hero = document.querySelector('.hero');
  let hh = hero ? hero.offsetHeight : innerHeight;
  if (hero) new ResizeObserver(() => { hh = hero.offsetHeight; }).observe(hero);

  // ripples: where the pointer goes, the water rings (only while it runs: its clock stops with it, and rings dropped
  // under a dark section, or with motion paused, would wait there and play out later)
  const rip = new Float32Array(32); let ri = 0; let lastX = -1e3, lastY = -1e3, lastT = 0;
  let time = 0, beat = 0;
  const live = () => run.on && !motion.paused && performance.now() - beat < 1000;   // on, and ticking (not held by a pause)
  const addRipple = (x, y, k) => { rip.set([x, y, time, k], ri * 4); ri = (ri + 1) % 8; };
  if (fine && !calm) on('pointer', (p) => {
    if (!p.active || !live()) return;
    const d = Math.hypot(p.x - lastX, p.y - lastY);
    if (d > 90 && time - lastT > 0.12) { addRipple(p.x, p.y, clamp(d / 400, 0.25, 1)); lastX = p.x; lastY = p.y; lastT = time; }
  });
  addEventListener('pointerdown', (e) => { if (live()) addRipple(e.clientX, e.clientY, 1.4); }, { passive: true });

  let soft = 0, drawnY = 0;
  function draw() {
    if (lost) return;
    soft = clamp(scroll.y / (hh * 0.9), 0, 1); drawnY = scroll.y;
    ctx.uniform2f(uRes, w, h); ctx.uniform1f(uTime, time); ctx.uniform1f(uSoft, soft); ctx.uniform1f(uScroll, scroll.y); ctx.uniform1f(uScale, SCALE);
    ctx.uniform4fv(uRip, rip);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  }
  let skip = 0, ticked = false;
  const run = loop((dt) => {
    time += dt; if (dt) { ticked = true; beat = performance.now(); }
    // a low-end machine draws every other frame while the page is still: the water moves slowly enough not to show
    // it (but a page that scrolled, or a still frame, dt 0, is drawn at once)
    if (dt && gl.tier < 2 && scroll.y === drawnY && (skip ^= 1)) return;
    draw();
  });
  canvas.classList.add('is-on');
  draw();
  const watch = (set, rootMargin, fn) => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) { if (e.isIntersecting) set.add(e.target); else set.delete(e.target); }
      fn();
    }, { rootMargin });
    lights.forEach((el) => io.observe(el));
  };
  // on screen: fresh at once (after a jump nothing painted it on the way), whatever the loop's skip; then the loop
  watch(shown, '0px', () => { if (shown.size && !run.on) draw(); run.set(want()); });
  watch(near, '25% 0px', () => {});
  document.addEventListener('visibilitychange', () => run.set(want()));
  // a light section near and the loop not running (reduced motion, nothing light on screen yet, motion paused): paint
  // where the page is, the clock held. (Running, it draws the scroll itself: it ticked since the last scroll.)
  on('scroll', () => { if (near.size && !ticked) draw(); ticked = false; });
  // a lost context comes back only if asked to; meanwhile the plain sheen under the canvas shows
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; run.set(false); canvas.classList.remove('is-on'); });
  canvas.addEventListener('webglcontextrestored', () => {
    try { setup(); } catch (e) { return; }   // lost again while rebuilding: the next restore tries again
    lost = false; resize(); draw(); canvas.classList.add('is-on'); run.set(want());
  });
}
