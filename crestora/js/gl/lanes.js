// The home page's one WebGL2 canvas (besides the footer's): the hero's loose threads and the #features flow ribbon.
//
// One canvas, two views. It sits in whichever of its sections is on screen (it is moved between them, so it scrolls
// with the page like any other element), draws only that view, and stops when neither is visible. Both views are drawn
// in the footer's hand: lanes of light with dashes and specks running along them, a pointer that is a lamp, stars
// behind. The geometry is lofted with the footer's own loft() and paletteStrip() (js/footer/geometry.js).
//
//   hero  six loose threads, one per stage colour, waving across the right of the screen with sparks along them.
//         Scrolling through the hero calms them into one tight ribbon that bends away to the bottom left.
//   flow  the footer ribbon's cross-section: six bands of 24 lanes in stage order, lit band by band as the pinned
//         section progresses (uBands = p × 6), with the footer's bright reveal front.
//
// The pure geometry (threadY, flowCentre) is exported so the page can ride DOM on it, and so the SVG fallback poster
// could be drawn from the same numbers.

import { loft, paletteStrip } from '../footer/geometry.js';

export const STAGE_RGB = [[58, 109, 255], [35, 211, 255], [32, 214, 155], [255, 177, 61], [255, 59, 59], [255, 122, 217]];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ================= the hero's threads, in design px of the hero's field (1000 × 900) =================
// Every thread follows the same rest path, fanned out from it by its index and waved by time. The numbers below are
// written once and used both here (to ride the chip on a thread) and in the vertex shader.
export const THREADS = { n: 6, lanes: 8, x0: -820, x1: 1240, fade: [-360, 170], reveal: [-520, 1160] };
const N = {
  rest: [742, 0.365, 30, 0.0024, 0.4],        // y = a - b x - c sin(d x + e)
  half: [2.2, 12, -420, 1100],                // half width = a + b smooth(c, d, x)
  spread: [5, 96, -380, 1050, 1.15],          // gap between neighbours = a + b smooth(c, d, x)^e
  wave: [52, -150, 760, 0.0052, 0.42, 0.0121, 0.31, 1.13], // amp, ramp, k1, w1, k2, w2, phase per thread
  pinch: [250, 900, -350],                    // calm: the left bends down by a × smooth(b, c, x)
};
export const restY = (x) => N.rest[0] - N.rest[1] * x - N.rest[2] * Math.sin(x * N.rest[3] + N.rest[4]);
export const halfW = (x) => N.half[0] + N.half[1] * smooth(N.half[2], N.half[3], x);
const spreadAt = (x) => N.spread[0] + N.spread[1] * Math.pow(smooth(N.spread[2], N.spread[3], x), N.spread[4]);
function waveAt(i, x, t) {
  const [amp, r0, r1, k1, w1, k2, w2, ph] = N.wave;
  const a = amp * smooth(r0, r1, x), p = i * ph;
  return a * (0.72 * Math.sin(x * k1 - t * w1 + p) + 0.28 * Math.sin(x * k2 + t * w2 + p * 1.9));
}
/** The centre of thread i at x, at time t, in the hero state k ({ spread, wave, pinch }). */
export function threadY(i, x, t, k) {
  return restY(x) + (i - 2.5) * spreadAt(x) * k.spread + waveAt(i, x, t) * k.wave + k.pinch * N.pinch[0] * smooth(N.pinch[1], N.pinch[2], x);
}
const f = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const THREAD_GLSL = `
float sstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float restY(float x) { return ${f(N.rest[0])} - ${f(N.rest[1])} * x - ${f(N.rest[2])} * sin(x * ${f(N.rest[3])} + ${f(N.rest[4])}); }
float spreadAt(float x) { return ${f(N.spread[0])} + ${f(N.spread[1])} * pow(sstep(${f(N.spread[2])}, ${f(N.spread[3])}, x), ${f(N.spread[4])}); }
float waveAt(float i, float x, float t) {
  float a = ${f(N.wave[0])} * sstep(${f(N.wave[1])}, ${f(N.wave[2])}, x), p = i * ${f(N.wave[7])};
  return a * (0.72 * sin(x * ${f(N.wave[3])} - t * ${f(N.wave[4])} + p) + 0.28 * sin(x * ${f(N.wave[5])} + t * ${f(N.wave[6])} + p * 1.9));
}
float threadShift(float i, float x, float t, vec3 k) {
  return (i - 2.5) * spreadAt(x) * k.x + waveAt(i, x, t) * k.y + k.z * ${f(N.pinch[0])} * sstep(${f(N.pinch[1])}, ${f(N.pinch[2])}, x);
}`;

// one thread, lofted round the rest path: v 0…1 is the bundle's lanes, the padding either side carries its glow
const THREAD_DEF = (() => {
  const xs = Array.from({ length: 22 }, (_, j) => THREADS.x0 + ((THREADS.x1 - THREADS.x0) * j) / 21);
  const edge = (a) => xs.map((x) => [x, restY(x) + a * halfW(x)]);
  return {
    lanes: THREADS.lanes,
    neck: 0,
    guides: [[-0.75, edge(-2.5)], [1.75, edge(2.5)]],
    // brightness across the bundle: the middle lanes carry the light, the edges fray out
    palette: [[0, [255, 255, 255], 0], [0.29, [255, 255, 255], 0.4], [0.5, [255, 255, 255], 1], [0.71, [255, 255, 255], 0.4], [1, [255, 255, 255], 0]],
  };
})();

// ================= the flow ribbon, in design px of the pinned stage (1600 × 900) =================
// It comes in from the left at mid-height, wide, and rises gently to the right like the footer's upper band,
// narrowing toward the right edge as a hint of the pinch under the car. Six bands, top to bottom in stage order.
const fc = (x) => { const t = x / 1600; return 640 - 262 * Math.sign(t) * Math.abs(t) ** 1.25; };
const fh = (x) => { const t = x / 1600; return 158 - 104 * Math.sign(t) * Math.abs(t) ** 1.5; };
export const FLOW = (() => {
  const xs = [-260, -80, 80, 240, 400, 560, 720, 880, 1040, 1200, 1360, 1520, 1680, 1900];
  const palette = [];
  STAGE_RGB.forEach((c, b) => {
    const deep = c.map((v) => Math.round(v * 0.82));
    palette.push([b + 0.03, deep, 0.3], [b + 0.32, c, 1], [b + 0.68, c, 1], [b + 0.97, deep, 0.3]);
  });
  palette.unshift([0, STAGE_RGB[0], 0.12]);
  palette.push([6, STAGE_RGB[5], 0.12]);
  return {
    lanes: 144,
    neck: 0,
    guides: Array.from({ length: 7 }, (_, k) => [k / 6, xs.map((x) => [x, fc(x) + (k / 3 - 1) * fh(x)])]),
    palette,
  };
})();
const FLOW_ROWS = 145, FLOW_COLS = 320;
// the ribbon lofted once (the mesh and the card's ride both read it)
let flowLoft = null;
const lofted = () => flowLoft || (flowLoft = loft(FLOW, { cols: FLOW_COLS, rows: FLOW_ROWS }));
const rowLines = {};
function rowAt(row, x) {
  const c = rowLines[row] || (rowLines[row] = (() => {
    const d = lofted().data;
    return Array.from({ length: FLOW_COLS }, (_, j) => [d[(row * FLOW_COLS + j) * 5], d[(row * FLOW_COLS + j) * 5 + 1]]);
  })());
  if (x <= c[0][0]) return c[0][1];
  let lo = 0, hi = c.length - 1;
  if (x >= c[hi][0]) return c[hi][1];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m][0] < x) lo = m; else hi = m; }
  return c[lo][1] + ((c[hi][1] - c[lo][1]) * (x - c[lo][0])) / (c[hi][0] - c[lo][0]);
}
/** The ribbon's centre line (v = 0.5, the middle row of its mesh) at design x, in design px: the card rides on it. */
export const flowCentre = (x) => rowAt((FLOW_ROWS - 1) / 2, x);
/** The ribbon's top (Spark's outer lane) and bottom (Afterglow's) edges at design x, in design px: the page keeps
 *  its type clear of them. */
export const flowEdges = (x) => ({ top: rowAt(0, x), bottom: rowAt(FLOW_ROWS - 1, x) });

// ================= shaders =================
const GLSL = '#version 300 es\nprecision highp float;\n';
const MAP = `
uniform vec2 uRes; uniform vec4 uFrame;   // where the design frame sits: x, y (device px), sx, sy (device px per design px)
vec4 toClip(vec2 p) { vec2 px = uFrame.xy + p * uFrame.zw; return vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0); }`;
const HASH = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p) { float n = h21(p); return vec2(n, h21(p + n + 17.17)); }`;

// the footer's star field, thinned out: two sparse layers that twinkle and lean away from the pointer
const STARS_VS = `${GLSL}
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
const STARS_FS = `${GLSL}
uniform vec2 uRes; uniform vec2 uPar; uniform float uTime, uDpr, uFade, uSeed; uniform vec4 uEdge;
out vec4 o;
${HASH}
float layer(vec2 px, float cell, float dens, float bright, float depth, float seed) {
  vec2 q = (px - uPar * depth * uDpr) / (cell * uDpr);
  vec2 id = floor(q), f = fract(q);
  if (h21(id + seed) > dens) return 0.0;
  vec2 at = 0.2 + 0.6 * h22(id * 1.31 + seed);
  vec2 d = (at - f) * cell * uDpr;
  float r = uDpr * (0.5 + 0.5 * h21(id + 7.1));
  float b = bright * (0.25 + 0.75 * pow(h21(id + 3.3), 2.2));
  b *= 0.6 + 0.4 * sin(uTime * (0.5 + 2.2 * at.x) + at.y * 31.0);
  return b * smoothstep(r + uDpr * 0.6, r * 0.2, length(d));
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float s = layer(px, 7.0, 0.16, 0.36, 0.2, uSeed) + layer(px, 16.0, 0.24, 0.7, 0.45, uSeed + 7.0) + layer(px, 44.0, 0.34, 1.0, 0.8, uSeed + 13.0);
  // the field thins out toward the section's edges, so the page never shows where the night stops
  float edge = smoothstep(uEdge.x, uEdge.y, px.y) * (1.0 - smoothstep(uEdge.z, uEdge.w, px.y));
  o = vec4(vec3(0.86, 0.92, 1.0) * s * uFade * edge, 1.0);
}`;

// ---- a thread: its lanes, dashes and specks, sparks running along it, a soft glow round it ----
const THREAD_VS = `${GLSL}
in vec2 aPos; in vec3 aData;
uniform float uI, uTime; uniform vec3 uK; uniform vec3 uPtr;
out float vV; out float vU; out vec2 vP;
${MAP}
${THREAD_GLSL}
void main() {
  float x = aPos.x;
  float yc = restY(x) + threadShift(uI, x, uTime, uK);
  // the pointer parts the threads gently round it
  vec2 d = vec2(x, yc) - uPtr.xy;
  float part = uPtr.z * 34.0 * exp(-dot(d, d) / 36000.0) * d.y / sqrt(d.y * d.y + 1600.0);
  float y = aPos.y + (yc - restY(x)) + part;
  vP = vec2(x, y); vV = aData.x; vU = aData.y;
  gl_Position = toClip(vP);
}`;
const THREAD_FS = `${GLSL}
in float vV; in float vU; in vec2 vP;
uniform sampler2D uPal; uniform vec2 uRange;
uniform vec3 uColor; uniform float uI, uLanes, uTravel, uDpr, uSeed, uReveal, uGain;
uniform vec2 uFadeX, uRevealX; uniform vec4 uEdgeY; uniform vec3 uPtr;
out vec4 o;
float h(float n) { return fract(sin(n * 91.3458 + uSeed) * 47453.5453); }
void main() {
  float prof = texture(uPal, vec2((vV - uRange.x) / (uRange.y - uRange.x), 0.5)).a;
  float inside = step(0.0, vV) * step(vV, 1.0);
  float fwv = max(fwidth(vV), 1e-5);
  float outside = max(max(-vV, vV - 1.0), 0.0) / fwv / uDpr;       // css px outside the bundle
  float across = abs(vV - 0.5) * 2.0;                               // 0 on its centre, 1 at its edge

  float L = clamp(vV, 0.0, 0.9999) * uLanes;
  float li = floor(L);
  float fw = max(fwidth(L), 1e-4);
  float d = abs(fract(L) - 0.5) / fw / uDpr;
  float r1 = h(li + uI * 13.0), r2 = h(li + 17.0 + uI * 5.0), r3 = h(li + 41.0 + uI * 3.0), r4 = h(li + 73.0 + uI), r5 = h(li + 101.0 + uI * 7.0);
  float lane = 0.35 + 0.8 * r1 * r1;
  float core = 1.0 - smoothstep(0.3, 0.95, d);
  float glow = exp(-d * 0.8) * 0.45;
  float fine = smoothstep(0.22, 0.6, fw * uDpr);
  float line = (0.32 + 0.2 * fine + mix((core + glow) * lane, 0.5, fine)) * inside;

  // dashes and specks run along the lanes, left to right, as on the footer's road
  float per = mix(14.0, 46.0, r3);
  float sp = mix(0.8, 1.3, r2);
  float sDash = (vU - uTravel * sp) / per + r4;
  float fs = max(fwidth(sDash), 1e-4);
  float duty = mix(0.03, 0.1, r5);
  float ph = fract(sDash);
  float dash = smoothstep(0.0, fs * 1.5, ph) * (1.0 - smoothstep(duty, duty + fs * 1.5, ph));
  dash = mix(dash, duty, smoothstep(0.3, 0.7, fs)) * step(0.3, r1 + 0.4 * r3);
  float sSp = (vU - uTravel * sp * 1.15) / (per * 0.37) + r2 * 3.0;
  float fs2 = max(fwidth(sSp), 1e-4);
  float speck = (1.0 - smoothstep(0.0, 0.025 + fs2 * 1.5, abs(fract(sSp) - 0.5))) * step(0.72, r4);
  speck = mix(speck, 0.02, smoothstep(0.3, 0.7, fs2));
  float hot = (core + glow * 0.6) * (1.0 - fine * 0.5) * inside;

  // sparks: a bright head with a short tail, riding the whole bundle
  float sk = (vU - uTravel * 2.4) / 210.0 + h(uI * 7.0 + 3.0);
  float t = fract(sk) - 0.5;
  float spark = (t < 0.0 ? exp(t * 70.0) * 0.55 : exp(-t * t * 9000.0)) * exp(-across * across * 0.9);
  spark *= 0.55 + 0.45 * h(floor(sk) + uI);

  // the pointer is a lamp
  float pd = length(vP - uPtr.xy);
  float lamp = uPtr.z * exp(-pd * pd / 30000.0);

  vec3 c = uColor;
  vec3 col = c * line * prof * (1.0 + 0.9 * lamp);
  col += mix(c, vec3(1.0), 0.72) * (dash * 0.85 + speck * 1.3) * hot * prof * (1.0 + 1.6 * lamp);
  col += c * exp(-outside / 7.0) * 0.16 * (1.0 - inside * 0.5) * (1.0 + lamp);          // the glow round the bundle
  col += mix(c, vec3(1.0), 0.55) * spark * 1.5;

  // threads come out of the dark behind the type, and draw in from the left with a bright front
  float xn = (vP.x - uRevealX.x) / (uRevealX.y - uRevealX.x);
  float lit = smoothstep(uReveal, uReveal - 0.06, xn);
  float front = exp(-pow((xn - uReveal) * 20.0, 2.0)) * step(0.001, uReveal) * (1.0 - smoothstep(0.9, 1.0, uReveal));
  float fade = smoothstep(uFadeX.x, uFadeX.y, vP.x) * smoothstep(uEdgeY.x, uEdgeY.y, vP.y) * (1.0 - smoothstep(uEdgeY.z, uEdgeY.w, vP.y));
  col = (col * lit + mix(c, vec3(1.0), 0.5) * front * (0.6 * prof + 0.25 * exp(-outside / 5.0))) * fade * uGain;
  o = vec4(col, 1.0);
}`;

// ---- the flow ribbon: the footer's road shader, its bands lit one by one ----
const RIBBON_VS = `${GLSL}
in vec2 aPos; in vec3 aData;
out float vV; out float vU; out vec2 vP;
${MAP}
void main() { gl_Position = toClip(aPos); vV = aData.x; vU = aData.y; vP = aPos; }`;
const RIBBON_FS = `${GLSL}
in float vV; in float vU; in vec2 vP;
uniform sampler2D uPal; uniform vec2 uRange;
uniform float uLanes, uTravel, uDpr, uBands, uFade, uBase; uniform vec2 uSpanX; uniform vec3 uPtr; uniform vec3 uCard;
out vec4 o;
float h(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
void main() {
  vec4 pal = texture(uPal, vec2((vV - uRange.x) / (uRange.y - uRange.x), 0.5));
  float L = vV * uLanes;
  float li = floor(L);
  float fw = max(fwidth(L), 1e-4);
  float d = abs(fract(L) - 0.5) / fw / uDpr;
  float r1 = h(li), r2 = h(li + 17.0), r3 = h(li + 41.0), r4 = h(li + 73.0), r5 = h(li + 101.0);
  float lane = 0.35 + 0.8 * r1 * r1;
  float core = 1.0 - smoothstep(0.3, 0.95, d);
  float glow = exp(-d * 0.8) * 0.45;
  float fine = smoothstep(0.22, 0.6, fw * uDpr);
  float line = 0.3 + 0.26 * fine + mix((core + glow * 0.8) * lane, 0.5, fine);

  float per = mix(14.0, 52.0, r3);
  float sp = mix(0.8, 1.3, r2);
  float sDash = (vU - uTravel * sp) / per + r4;
  float fs = max(fwidth(sDash), 1e-4);
  float duty = mix(0.025, 0.09, r5);
  float ph = fract(sDash);
  float dash = smoothstep(0.0, fs * 1.5, ph) * (1.0 - smoothstep(duty, duty + fs * 1.5, ph));
  dash = mix(dash, duty, smoothstep(0.3, 0.7, fs)) * step(0.35, r1 + 0.4 * r3);
  float sSp = (vU - uTravel * sp * 1.15) / (per * 0.37) + r2 * 3.0;
  float fs2 = max(fwidth(sSp), 1e-4);
  float speck = (1.0 - smoothstep(0.0, 0.025 + fs2 * 1.5, abs(fract(sSp) - 0.5))) * step(0.72, r4);
  speck = mix(speck, 0.02, smoothstep(0.3, 0.7, fs2));
  float hot = (core + glow * 0.6) * (1.0 - fine * 0.5);

  // band by band: band b's light runs along it, left to right, while uBands goes from b to b + 0.45
  float b = floor(clamp(vV, 0.0, 0.9999) * 6.0);
  float amt = clamp((uBands - b) / 0.45, 0.0, 1.0);
  float xn = (vP.x - uSpanX.x) / (uSpanX.y - uSpanX.x);
  float fr = amt * 1.22 - 0.08;
  float lit = smoothstep(fr, fr - 0.1, xn) * step(0.001, amt);
  float front = exp(-pow((xn - fr) * 13.0, 2.0)) * step(0.001, amt) * (1.0 - smoothstep(0.8, 1.0, amt));
  float now = step(b, uBands) * (1.0 - step(b + 1.0, uBands));     // the band the lane is in right now

  float pd = length(vP - uPtr.xy);
  float lamp = uPtr.z * exp(-pd * pd / 26000.0);
  float cd = length((vP - uCard.xy) * vec2(0.7, 1.0));
  float under = uCard.z * exp(-cd * cd / 60000.0);                // the card carries its own light along the lane

  float gain = mix(uBase, 1.0 + 0.18 * now, lit) * (1.0 + 0.7 * lamp + 0.55 * under * lit);
  vec3 col = pal.rgb * line * gain;
  col += mix(pal.rgb, vec3(1.0), 0.7) * (dash * 0.8 + speck * 1.3) * hot * pal.a * lit * (1.0 + 1.8 * lamp + 0.8 * under);
  col += pal.rgb * front * 0.95 * pal.a;
  // the ribbon trails off at its far ends
  float ends = smoothstep(uSpanX.x - 240.0, uSpanX.x + 40.0, vP.x) * (1.0 - smoothstep(uSpanX.y - 60.0, uSpanX.y + 200.0, vP.x) * 0.55);
  o = vec4(col * uFade * ends, 1.0);
}`;

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = new Proxy({}, { get: (c, k) => (k in c ? c[k] : (c[k] = gl.getUniformLocation(p, k))) });
  return { p, u };
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// ================= the renderer =================
function createLanes(canvas, { calm = false, velocity = () => 0 }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;

  const P = { stars: compile(gl, STARS_VS, STARS_FS), thread: compile(gl, THREAD_VS, THREAD_FS), ribbon: compile(gl, RIBBON_VS, RIBBON_FS) };
  const empty = gl.createVertexArray();

  function mesh(def, prog, m) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(prog.p, 'aPos'), ad = gl.getAttribLocation(prog.p, 'aData');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(ad); gl.vertexAttribPointer(ad, 3, gl.FLOAT, false, 20, 8);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const pal = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteStrip(def));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // the palette's v range (its first and last stop)
    const vs = def.guides.map((g) => g[0]);
    const at = (g) => { const i = Math.min(vs.length - 2, Math.floor(g)); return vs[i] + (vs[i + 1] - vs[i]) * (g - i); };
    return { vao, count: m.index.length, pal, range: [at(def.palette[0][0]), at(def.palette[def.palette.length - 1][0])], lanes: def.lanes };
  }
  const thread = mesh(THREAD_DEF, P.thread, loft(THREAD_DEF, { cols: 260, rows: 12 }));
  const ribbon = mesh(FLOW, P.ribbon, lofted());

  // ---- views: where the canvas can sit, what it draws there ----
  const views = {
    hero: { el: null, frame: null, ratio: 0, onFrame: null, state: { fade: calm ? 1 : 0, reveal: calm ? 1.2 : 0, spread: 1, wave: 1, pinch: 0, gain: 1 } },
    flow: { el: null, frame: null, ratio: 0, onFrame: null, state: { fade: 1, bands: calm ? 6 : 0, card: { x: -9999, y: 0, on: 0 } } },
  };
  let mounted = null;
  const ptr = { cx: -1e5, cy: -1e5, x: -1e5, y: -1e5, on: 0, want: 0, par: { x: 0, y: 0 } };

  // ---- size ----
  let W = 1, H = 1, dpr = 1, cw = 1, ch = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    cw = r.width; ch = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, r.width * r.height > 2.4e6 ? 1.5 : 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  // ---- loop ----
  let time = 0, travel = 0, running = false, last = 0, raf = 0, vel = 0;
  const ticker = window.gsap?.ticker;

  function update(dt) {
    time += dt;
    vel = damp(vel, Math.min(40, Math.abs(velocity() || 0)), 6, dt);
    travel += dt * 60 * (1 + vel * 0.12);           // dash speed: cruise + how fast the page is moving
    ptr.on = damp(ptr.on, ptr.want, 4, dt);
    ptr.par.x = damp(ptr.par.x, ptr.want ? (ptr.cx / Math.max(1, innerWidth) - 0.5) * -14 : 0, 2, dt);
    ptr.par.y = damp(ptr.par.y, ptr.want ? (ptr.cy / Math.max(1, innerHeight) - 0.5) * -8 : 0, 2, dt);
  }

  function frameOf(view) {
    const fr = view.frame();
    return { x: fr.x, y: fr.y, sx: fr.sx ?? fr.s, sy: fr.sy ?? fr.s };
  }

  function draw() {
    const view = mounted && views[mounted];
    if (!view) return;
    resize();
    const fr = frameOf(view);
    // the pointer, in this view's design px
    if (ptr.want || ptr.on > 0.001) {
      const r = canvas.getBoundingClientRect();
      ptr.x = (ptr.cx - r.left - fr.x) / fr.sx; ptr.y = (ptr.cy - r.top - fr.y) / fr.sy;
    }
    view.onFrame?.(api);

    gl.viewport(0, 0, W, H);
    const setMap = (prog) => { gl.uniform2f(prog.u.uRes, W, H); gl.uniform4f(prog.u.uFrame, fr.x * dpr, fr.y * dpr, fr.sx * dpr, fr.sy * dpr); };

    // stars
    gl.disable(gl.BLEND);
    gl.useProgram(P.stars.p);
    gl.uniform2f(P.stars.u.uRes, W, H); gl.uniform2f(P.stars.u.uPar, ptr.par.x, ptr.par.y);
    gl.uniform1f(P.stars.u.uTime, time); gl.uniform1f(P.stars.u.uDpr, dpr);
    const st = view.state;
    if (mounted === 'hero') {
      gl.uniform1f(P.stars.u.uFade, st.fade); gl.uniform1f(P.stars.u.uSeed, 1.0);
      gl.uniform4f(P.stars.u.uEdge, -1, 0, H * 0.82, H * 1.0);
    } else {
      gl.uniform1f(P.stars.u.uFade, 0.85 * st.fade); gl.uniform1f(P.stars.u.uSeed, 31.0);
      gl.uniform4f(P.stars.u.uEdge, 0, H * 0.16, H * 0.9, H * 1.02);
    }
    gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    if (mounted === 'hero') {
      const p = P.thread;
      gl.useProgram(p.p); setMap(p);
      gl.uniform1f(p.u.uTime, time); gl.uniform1f(p.u.uTravel, travel); gl.uniform1f(p.u.uDpr, dpr);
      gl.uniform3f(p.u.uK, st.spread, st.wave, st.pinch);
      gl.uniform3f(p.u.uPtr, ptr.x, ptr.y, ptr.on);
      gl.uniform2f(p.u.uRange, thread.range[0], thread.range[1]); gl.uniform1f(p.u.uLanes, thread.lanes);
      gl.uniform1f(p.u.uReveal, st.reveal); gl.uniform1f(p.u.uGain, st.gain);
      gl.uniform2f(p.u.uFadeX, ...THREADS.fade); gl.uniform2f(p.u.uRevealX, ...THREADS.reveal);
      // fade out toward the top and bottom of the hero (in design px)
      const top = -fr.y / fr.sy, bottom = (ch - fr.y) / fr.sy;
      gl.uniform4f(p.u.uEdgeY, top - 10, top + 50, bottom - (bottom - top) * 0.16, bottom);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, thread.pal); gl.uniform1i(p.u.uPal, 0);
      gl.bindVertexArray(thread.vao);
      for (let i = 0; i < THREADS.n; i++) {
        const c = STAGE_RGB[i];
        gl.uniform1f(p.u.uI, i); gl.uniform1f(p.u.uSeed, i * 3.17);
        gl.uniform3f(p.u.uColor, c[0] / 255, c[1] / 255, c[2] / 255);
        gl.drawElements(gl.TRIANGLES, thread.count, gl.UNSIGNED_INT, 0);
      }
    } else {
      const p = P.ribbon;
      gl.useProgram(p.p); setMap(p);
      gl.uniform1f(p.u.uTravel, travel); gl.uniform1f(p.u.uDpr, dpr);
      gl.uniform2f(p.u.uRange, ribbon.range[0], ribbon.range[1]); gl.uniform1f(p.u.uLanes, ribbon.lanes);
      gl.uniform1f(p.u.uBands, st.bands); gl.uniform1f(p.u.uFade, st.fade); gl.uniform1f(p.u.uBase, 0.16);
      gl.uniform2f(p.u.uSpanX, -fr.x / fr.sx, (cw - fr.x) / fr.sx);
      gl.uniform3f(p.u.uPtr, ptr.x, ptr.y, ptr.on);
      gl.uniform3f(p.u.uCard, st.card.x, st.card.y, st.card.on);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ribbon.pal); gl.uniform1i(p.u.uPal, 0);
      gl.bindVertexArray(ribbon.vao); gl.drawElements(gl.TRIANGLES, ribbon.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    if (!view.drawn) { view.drawn = true; view.el.classList.add('is-lit'); view.el.dispatchEvent(new CustomEvent('lanes:drawn')); }
  }

  function tick(t, dtMs) {
    if (!running) return;
    const dt = Math.min(0.05, (dtMs ?? 16) / 1000 || 0.016);
    update(dt);
    draw();
  }
  function rafTick(now) {
    raf = 0;
    if (!running) return;
    tick(now, now - last); last = now;
    raf = requestAnimationFrame(rafTick);
  }
  function start() {
    if (calm) { draw(); return; }
    if (running) return;
    running = true;
    if (ticker) ticker.add(tick); else { last = performance.now(); raf = requestAnimationFrame(rafTick); }
  }
  function stop() {
    running = false;
    if (ticker) ticker.remove(tick); else { cancelAnimationFrame(raf); raf = 0; }
  }

  // ---- mounting: the canvas goes where its view is on screen ----
  function choose() {
    let best = null;
    for (const [name, v] of Object.entries(views)) if (v.el && v.ratio > 0 && (!best || v.ratio > views[best].ratio)) best = name;
    if (best && best !== mounted) {
      if (mounted) views[mounted].el.classList.remove('has-lanes', 'is-lit');
      mounted = best;
      const v = views[best];
      v.drawn = false;
      (v.el.querySelector('[data-lanes-slot]') || v.el).prepend(canvas);
      v.el.classList.add('has-lanes');
    }
    if (best) start(); else stop();
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = Object.values(views).find((x) => x.el === e.target);
      if (v) v.ratio = e.isIntersecting ? Math.max(0.0001, e.intersectionRatio) : 0;
    }
    choose();
  }, { threshold: [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1] });

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    ptr.cx = e.clientX; ptr.cy = e.clientY;
    const v = mounted && views[mounted];
    if (!v) return;
    const r = v.el.getBoundingClientRect();
    ptr.want = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.want = 0; });
  addEventListener('resize', () => { if (!running && mounted) draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else choose(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); }, false);

  const api = {
    calm,
    get time() { return time; },
    get pointer() { return ptr; },
    views,
    /** Register a view: el is its section (the canvas goes in its [data-lanes-slot]); frame() gives where its design
     *  frame sits in the canvas, in css px ({ x, y, s } or { x, y, sx, sy }); onFrame(api) runs before each draw. */
    attach(name, el, { frame, onFrame } = {}) {
      const v = views[name];
      if (v.el) io.unobserve(v.el);
      Object.assign(v, { el, frame, onFrame, ratio: 0, drawn: false });
      io.observe(el);
    },
    detach(name) {
      const v = views[name];
      if (!v.el) return;
      io.unobserve(v.el);
      v.el.classList.remove('has-lanes', 'is-lit');
      v.el = null; v.ratio = 0;
      if (mounted === name) { mounted = null; choose(); }
    },
    /** css px (relative to the view's canvas) of thread i at design x, as drawn now */
    threadPoint(i, x) {
      const v = views.hero, fr = frameOf(v);
      const k = v.state;
      let y = threadY(i, x, time, k);
      const dx = x - ptr.x, dy = y - ptr.y;
      y += ptr.on * 34 * Math.exp(-(dx * dx + dy * dy) / 36000) * dy / Math.sqrt(dy * dy + 1600);
      return { x: fr.x + x * fr.sx, y: fr.y + y * fr.sy, s: fr.sx };
    },
    frameOf: (name) => frameOf(views[name]),
    get mounted() { return mounted; },
    draw, start, stop,
  };
  return api;
}

// ---- one shared instance, made after the page's first paint (the hero's headline is what paints first) ----
let shared = null;
export function getLanes(opts = {}) {
  if (!shared) {
    shared = new Promise((resolve) => {
      const go = () => requestAnimationFrame(() => setTimeout(() => {
        const canvas = document.querySelector('[data-lanes]');
        let lanes = null;
        try { lanes = canvas ? createLanes(canvas, opts) : null; } catch (e) { console.error('[crestora] lanes', e); }
        resolve(lanes);
      }, 0));
      if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => requestAnimationFrame(go), { once: true });
      else requestAnimationFrame(go);
    });
  }
  return shared;
}
