// The hero's light: a horizon of orange-red light with a dome rising over the headline and a streak that sweeps
// along it now and then, the way the design has one resting at its left edge. Raw WebGL, one full-screen
// triangle. Its shape is fitted to the design in design px (1440 × 1000), so it lines up with the stage at any
// size. The heat haze is slow fbm noise; the pointer lifts the light a little where it is; scrolling raises the
// horizon and the intro lets it rise like a sunrise. A film grain keeps the gradients from banding.

import { calm, on, pointer, damp, whenVisible, scroll } from './core.js';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;      // canvas, device px
uniform float uS;       // device px per design px
uniform vec2 uO;        // where design (0,0) is, device px from the top left
uniform float uT;       // seconds
uniform float uIntro;   // 0 → 1 as the page opens
uniform float uScroll;  // 0 → 1 as the hero leaves
uniform vec3 uPtr;      // pointer in design px, and how present it is
uniform float uStreak;  // head of the streak, design px (x)
uniform float uStreakA; // its brightness

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ return 0.62 * noise(p) + 0.38 * noise(p * 2.07 + 7.3); }

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = (px - uO) / uS;                                  // design px
  float bottom = (uRes.y - uO.y) / uS;                      // the canvas' foot, in design px

  float rise = (1.0 - uIntro) * 170.0 + uScroll * 90.0;
  float hy = 717.0 + 50.0 * pow(clamp((d.x - 150.0) / 1100.0, 0.0, 1.5), 1.6) + rise;   // a touch lower to the right, as drawn
  float dy = d.y - hy;

  // heat haze
  float n1 = fbm(vec2(d.x * 0.0042 - uT * 0.045, d.y * 0.011 + uT * 0.018));
  float n2 = fbm(vec2(d.x * 0.0021 + uT * 0.03, d.y * 0.0042 - uT * 0.01));

  // the band: tight above, long below; brighter on the left, as drawn
  float sUp = mix(76.0, 112.0, smoothstep(700.0, 1300.0, d.x)) * (0.86 + 0.28 * n1);
  float sDn = 161.0 * (0.86 + 0.28 * n2);
  float band = dy < 0.0 ? exp(-dy * dy / (2.0 * sUp * sUp)) : exp(-dy * dy / (2.0 * sDn * sDn));
  float xi = (1.0 - 0.34 * exp(-pow(d.x - 720.0, 2.0) / (2.0 * 240.0 * 240.0))) * mix(1.0, 0.86, smoothstep(300.0, 1440.0, d.x));
  xi *= mix(0.86, 1.0, smoothstep(-40.0, 190.0, d.x)) * mix(1.0, 0.76, smoothstep(1250.0, 1460.0, d.x));
  float edge = mix(0.55, 1.0, smoothstep(-80.0, 260.0, d.x)) * mix(1.0, 0.5, smoothstep(1180.0, 1480.0, d.x));
  float lowEdge = mix(1.0, edge, smoothstep(0.0, 140.0, dy));   // the light under the horizon thins out at the edges

  // the pointer lifts the light where it is
  vec2 pd = (d - uPtr.xy) / vec2(300.0, 210.0);
  float lift = 1.0 + 0.28 * uPtr.z * exp(-dot(pd, pd));

  // the dome over the headline, and the warm pool under the phones
  float cx = 720.0 + (uPtr.x - 720.0) * 0.1 * uPtr.z;
  float ddx = d.x - cx;
  float dyd = d.y - (560.0 + rise);
  float dome = 0.34 * exp(-ddx * ddx / (2.0 * 360.0 * 360.0)) * exp(-dyd * dyd / (2.0 * 170.0 * 170.0));
  dome *= 0.85 + 0.3 * n2;
  float dyl = dy - 260.0;
  float pool = 0.36 * exp(-ddx * ddx / (2.0 * 520.0 * 520.0)) * exp(-dyl * dyl / (2.0 * 190.0 * 190.0));

  vec3 bg = vec3(0.047, 0.043, 0.055);
  vec3 bandCol = mix(vec3(0.70, 0.13, 0.03), vec3(0.86, 0.245, 0.1), smoothstep(150.0, 0.0, abs(dy)));
  float k = smoothstep(0.0, 1.0, uIntro) * (1.0 + 0.18 * uScroll);
  vec3 col = bg;
  col += bandCol * band * xi * lowEdge * lift * 0.92 * k;
  col += vec3(0.86, 0.2, 0.05) * dome * lift * k;
  col += vec3(0.78, 0.16, 0.04) * pool * k;

  // the streak: a thin hot line along the horizon, its head bright, its tail long
  float sy = d.y - hy;
  float behind = d.x - uStreak;                               // it travels leftwards: the tail is on the right
  float tail = behind > 0.0 ? exp(-behind / 150.0) : exp(behind / 9.0);
  float core = exp(-sy * sy / (2.0 * 3.0 * 3.0));
  float halo = exp(-sy * sy / (2.0 * 16.0 * 16.0));
  col += (vec3(1.0, 0.72, 0.58) * core * 0.95 + vec3(1.0, 0.42, 0.25) * halo * 0.28) * tail * uStreakA * k;

  // fade out at the foot so the next section starts on plain dark
  float foot = smoothstep(bottom, bottom - 60.0, d.y);
  col = mix(bg, col, foot);

  // grain (and dither)
  float g = hash(px + fract(uT * 7.13) * 91.7) - 0.5;
  col += g * (0.022 + 0.05 * dot(col, vec3(0.33)));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createHorizon(canvas, { map, host, followScroll = true }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uRes', 'uS', 'uO', 'uT', 'uIntro', 'uScroll', 'uPtr', 'uStreak', 'uStreakA']) U[n] = gl.getUniformLocation(prog, n);

  const state = { intro: calm ? 1 : 0, scroll: 0, ptr: [720, 600, 0], streak: -400, streakA: 0 };
  let dpr = 1; let m = { s: 1, ox: 0, oy: 0 }; let W = 0; let H = 0;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    m = map();
  }

  // The streak: a sweep from beyond the right edge to rest near the left one, then it dims away; again a few
  // seconds later. Under reduced motion it simply rests where the design has it.
  const SWEEP = 2.3; const REST = 2.8; const GAP = 4.5;
  const streakAt = (t) => {
    const period = SWEEP + REST + GAP; const k = t % period;
    if (k < SWEEP) { const e = 1 - Math.pow(1 - k / SWEEP, 3); return [1700 - (1700 - 34) * e, Math.min(1, k / 0.25)]; }
    if (k < SWEEP + REST) return [34 - (k - SWEEP) * 6, 1 - 0.55 * ((k - SWEEP) / REST)];
    const f = (k - SWEEP - REST) / 0.9; return [34 - REST * 6, Math.max(0, 0.45 * (1 - f))];
  };

  let t0 = performance.now(); let last = t0; let raf = 0; let visible = true; let time = 0;
  const ptrNow = [720, 600, 0];
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    // pointer, in design px
    let want = [ptrNow[0], ptrNow[1], 0];
    if (pointer.active && host.matches(':hover')) { const rr = canvas.getBoundingClientRect(); want = [(pointer.x - rr.left - m.ox) / m.s, (pointer.y - rr.top - m.oy) / m.s, 1]; }
    ptrNow[0] = damp(ptrNow[0], want[0], 3, dt); ptrNow[1] = damp(ptrNow[1], want[1], 3, dt); ptrNow[2] = damp(ptrNow[2], want[2], 2, dt);
    const [sx, sa] = calm ? [34, 0.75] : streakAt(Math.max(0, time - 0.4));
    draw(calm ? 0 : time, sx, sa);
    if (!calm && visible) raf = requestAnimationFrame(frame);
  }
  function draw(t, sx, sa) {
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uS, m.s * dpr);
    gl.uniform2f(U.uO, m.ox * dpr, m.oy * dpr);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uIntro, state.intro);
    gl.uniform1f(U.uScroll, state.scroll);
    gl.uniform3f(U.uPtr, ptrNow[0], ptrNow[1], ptrNow[2]);
    gl.uniform1f(U.uStreak, sx);
    gl.uniform1f(U.uStreakA, sa * state.intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  resize();
  addEventListener('resize', () => { resize(); kick(); });
  new ResizeObserver(() => { resize(); kick(); }).observe(host);
  whenVisible(host, (v) => { visible = v && !document.hidden; kick(); }, '0px');
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; kick(); });
  if (followScroll) on('scroll', () => { const h = host.offsetHeight || 1; state.scroll = Math.min(1, Math.max(0, scroll.y / h)); if (calm) kick(); });
  canvas.classList.add('is-on');
  kick();
  return {
    state,
    relayout() { resize(); kick(); },
    redraw: kick,
  };
}
