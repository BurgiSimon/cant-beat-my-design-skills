// The night behind the footer, in WebGL2: a field of stars, the road of light (js/geometry.js) streaming past, the car
// on it with its wheels turning and the light sliding over its paint, and the dust it throws behind it.
//
// Everything is placed in the shot's design px (1597 × 985) and mapped onto the screen through the frame the page
// gives it (frame()), so the picture lines up with the type wherever the layout puts it. The scene can be steered
// through `state` (the intro tweens it) and `boost` (holding the road down).

import { MAIN, ROAD, loft, paletteStrip } from './geometry.js';

export const CAR = { x0: 566, y0: 562, x1: 1140, y1: 752, src: 'assets/img/car.webp' };
// The wheels in the car picture, as ellipses in its own px (1148 × 380, twice the shot): centre, radii, tilt.
const WHEELS = [
  { x: 122, y: 274, rx: 41, ry: 72, a: -0.04 },
  { x: 642, y: 276, rx: 62, ry: 86, a: 0.03 },
];

const GLSL = '#version 300 es\nprecision highp float;\n';
const MAP = `
uniform vec2 uRes; uniform vec3 uFrame; uniform vec2 uPar;
vec4 toClip(vec2 p, float depth) {
  vec2 px = uFrame.xy + p * uFrame.z + uPar * depth;
  return vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const HASH = `
float h11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p) { float n = h21(p); return vec2(n, h21(p + n + 17.17)); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }`;

// ---- stars: three layers of points on hashed cells, twinkling; under boost they stretch into streaks ----
const STARS_VS = `${GLSL}
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
const STARS_FS = `${GLSL}
uniform vec2 uRes; uniform vec3 uFrame; uniform vec2 uPar; uniform float uTime, uBoost, uDpr, uFade;
out vec4 o;
${HASH}
float layer(vec2 px, float cell, float dens, float bright, float depth, float seed, float streak) {
  vec2 q = (px - uFrame.xy - uPar * depth) / uFrame.z / cell;   // in cells of the design grid
  vec2 id = floor(q), f = fract(q);
  float st = 1.0 + uBoost * streak;                               // under boost a star is a streak, this many times long
  // stars sit in the middle of their cells, so a cell's neighbours only matter once its star is stretched into them
  int reach = int(ceil(clamp(st * uDpr * 1.7 / (cell * uFrame.z) - 0.2, 0.0, 3.0)));
  float s = 0.0;
  for (int i = -reach; i <= reach; i++) {
    vec2 c = id + vec2(i, 0);
    if (h21(c + seed) > dens) continue;
    vec2 at = 0.2 + 0.6 * h22(c * 1.31 + seed);
    vec2 d = (vec2(i, 0) + at - f) * cell * uFrame.z;             // device px to the star
    d.x /= st;
    float r = uDpr * (0.55 + 0.5 * h21(c + 7.1));
    float b = bright * (0.25 + 0.75 * pow(h21(c + 3.3), 2.2));
    b *= 0.6 + 0.4 * sin(uTime * (0.6 + 2.6 * at.x) + at.y * 31.0);
    b /= 1.0 + 0.35 * (st - 1.0);
    s += b * smoothstep(r + uDpr * 0.6, r * 0.2, length(d));
  }
  return s;
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float s = layer(px, 5.5, 0.4, 0.5 * (1.0 - 0.7 * uBoost), 0.15, 1.0, 0.0)
          + layer(px, 12.0, 0.36, 0.8, 0.3, 7.0, 7.0)
          + layer(px, 40.0, 0.45, 1.0, 0.55, 13.0, 3.5);
  vec3 c = vec3(0.86, 0.92, 1.0) * s * uFade;
  o = vec4(c, 1.0);
}`;

// ---- the ribbons: lanes of light with dashes running along them ----
const RIBBON_VS = `${GLSL}
in vec2 aPos; in vec3 aData;
out float vV; out float vU; out float vS; out vec2 vP;
uniform float uDepth;
${MAP}
void main() { gl_Position = toClip(aPos, uDepth); vV = aData.x; vU = aData.y; vS = aData.z; vP = aPos; }`;
const RIBBON_FS = `${GLSL}
in float vV; in float vU; in float vS; in vec2 vP;
uniform sampler2D uPal; uniform vec2 uRange;
uniform float uLanes, uTravel, uTime, uBoost, uGain, uDashes, uSeed, uNeck, uReveal, uSpan, uDpr; uniform vec3 uDim;
uniform vec3 uPtr;
out vec4 o;
float h(float n) { return fract(sin(n * 91.3458 + uSeed) * 47453.5453); }
void main() {
  vec4 pal = texture(uPal, vec2((vV - uRange.x) / (uRange.y - uRange.x), 0.5));
  float L = vV * uLanes;
  float li = floor(L);
  float fw = max(fwidth(L), 1e-4);                     // lanes per device px
  float d = abs(fract(L) - 0.5) / fw / uDpr;           // css px from the lane's centre line
  float r1 = h(li), r2 = h(li + 17.0), r3 = h(li + 41.0), r4 = h(li + 73.0), r5 = h(li + 101.0);
  float lane = 0.35 + 0.8 * r1 * r1;
  float core = 1.0 - smoothstep(0.3, 0.95, d);
  float glow = exp(-d * 0.8) * 0.45;
  float fine = smoothstep(0.22, 0.6, fw * uDpr);       // lanes finer than a css px: show their average
  // the light between the lanes: brightest where they crowd together
  float fill = 0.42 + 0.2 * fine;
  float line = fill + mix((core + glow) * lane, 0.5, fine);

  // dashes: a few per lane, running with the road; finer than a pixel, they average out
  float per = mix(14.0, 52.0, r3);                     // period, in lane spacings
  float sp = mix(0.8, 1.3, r2);
  float sDash = (vU - uTravel * sp) / per + r4;
  float fs = max(fwidth(sDash), 1e-4);
  float duty = mix(0.025, 0.09, r5) * (1.0 + 3.0 * uBoost);
  float ph = fract(sDash);
  float dash = smoothstep(0.0, fs * 1.5, ph) * (1.0 - smoothstep(duty, duty + fs * 1.5, ph));
  dash = mix(dash, duty, smoothstep(0.3, 0.7, fs)) * step(0.35, r1 + 0.4 * r3) * uDashes;
  // specks: tiny bright points, sparser
  float sSp = (vU - uTravel * sp * 1.15) / (per * 0.37) + r2 * 3.0;
  float fs2 = max(fwidth(sSp), 1e-4);
  float ph2 = fract(sSp);
  float speck = (1.0 - smoothstep(0.0, 0.025 + fs2 * 1.5, abs(ph2 - 0.5))) * step(0.72, r4);
  speck = mix(speck, 0.02, smoothstep(0.3, 0.7, fs2)) * uDashes;

  // the pointer is a lamp held over the road
  float pd = length(vP - uPtr.xy);
  float lamp = uPtr.z * exp(-pd * pd / 26000.0);

  float hot = (core + glow * 0.6) * (1.0 - fine * 0.5);
  float side = mix(uDim.x, 1.0, smoothstep(uDim.y, uDim.z, vP.x));
  vec3 col = pal.rgb * line * uGain * side * (1.0 + 0.35 * uBoost + 0.7 * lamp);
  col += mix(pal.rgb, vec3(1.0), 0.7) * (dash * 0.8 + speck * 1.3) * hot * pal.a * side * (1.0 + 1.8 * lamp);

  // the intro: the road lights from under the car outward, with a bright front
  float far = abs(vS - uNeck) / uSpan;
  float lit = smoothstep(uReveal, uReveal - 0.12, far);
  float front = exp(-pow((far - uReveal) * 14.0, 2.0)) * step(0.001, uReveal) * (1.0 - smoothstep(0.85, 1.0, uReveal));
  col = col * lit + pal.rgb * front * 0.9 * pal.a;
  o = vec4(col, 1.0);
}`;

// ---- the car: its picture, the wheels turned, the road's light sliding over the paint ----
const CAR_VS = `${GLSL}
in vec2 aCorner;
uniform vec4 uRect; uniform vec4 uXf; // offset x, y, angle, unused
uniform vec2 uPivot;
out vec2 vUv; out vec2 vP;
${MAP}
void main() {
  vec2 p = uRect.xy + aCorner * (uRect.zw - uRect.xy);
  float c = cos(uXf.z), s = sin(uXf.z);
  p = uPivot + mat2(c, s, -s, c) * (p - uPivot) + uXf.xy;
  vUv = aCorner; vP = p;
  gl_Position = toClip(p, 1.0);
}`;
const CAR_FS = `${GLSL}
in vec2 vUv; in vec2 vP;
uniform sampler2D uTex; uniform sampler2D uPal;
uniform vec2 uTexSize; uniform float uSpin, uBlur, uTime, uTravel, uExposure, uGlint, uBoost;
uniform vec4 uW0; uniform vec4 uW1; uniform float uWa0, uWa1;
uniform vec3 uPtr;
out vec4 o;
vec4 wheel(vec2 px, vec4 w, float tilt, inout float inside) {
  float c = cos(tilt), s = sin(tilt);
  vec2 d = mat2(c, -s, s, c) * (px - w.xy);
  vec2 q = d / w.zw;
  float r = length(q);
  inside = 1.0 - smoothstep(0.8, 0.9, r);
  if (inside <= 0.0) return vec4(0.0);
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 12; k++) {
    float a = uSpin + uBlur * (float(k) / 11.0 - 0.5);
    float ca = cos(a), sa = sin(a);
    vec2 qq = mat2(ca, sa, -sa, ca) * q;
    vec2 dd = mat2(c, s, -s, c) * (qq * w.zw);
    acc += texture(uTex, (w.xy + dd) / uTexSize);
  }
  return acc / 12.0;
}
void main() {
  vec2 px = vUv * uTexSize;
  vec4 t = texture(uTex, vUv);
  float in0 = 0.0, in1 = 0.0;
  vec4 w0 = wheel(px, uW0, uWa0, in0);
  vec4 w1 = wheel(px, uW1, uWa1, in1);
  t = mix(t, w0, in0 * t.a);
  t = mix(t, w1, in1 * t.a);
  vec3 rgb = t.a > 0.0 ? t.rgb / t.a : vec3(0.0);
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  // the paint's own highlights catch the light that streams past: bands of the road's colours slide back along them
  float gloss = smoothstep(0.16, 0.55, luma) * (1.0 - in0) * (1.0 - in1);
  float band = fract(vUv.x * 2.6 + vUv.y * 0.8 - uTravel * 0.0021);
  vec3 tint = texture(uPal, vec2(0.08 + 0.84 * band, 0.5)).rgb;
  rgb += tint * gloss * 0.28 * (0.6 + 0.4 * sin(vUv.x * 40.0 - uTravel * 0.05));
  // a glint that runs over the body from nose to tail now and then
  float g = vUv.x - uGlint + (1.0 - vUv.y) * 0.18;
  rgb += vec3(1.0, 0.97, 0.95) * exp(-g * g * 900.0) * smoothstep(0.1, 0.4, luma) * 0.9;
  // the pointer's lamp on the paint
  float pd = length(vP - uPtr.xy);
  rgb += vec3(0.75, 0.85, 1.0) * uPtr.z * exp(-pd * pd / 9000.0) * gloss * 0.6;
  // the tail lights burn brighter on the throttle
  float tail = smoothstep(0.35, 0.8, rgb.r - max(rgb.g, rgb.b)) * step(0.78, vUv.x);
  rgb += vec3(1.0, 0.15, 0.1) * tail * uBoost * 0.8;
  rgb *= uExposure;
  o = vec4(rgb * t.a, t.a) * min(1.0, uExposure * 3.0);
}`;

// ---- soft quads: the car's shadow on the road, and the haze of dust behind it ----
const QUAD_VS = `${GLSL}
in vec2 aCorner;
uniform vec4 uRect;
out vec2 vUv; out vec2 vP;
${MAP}
void main() { vec2 p = uRect.xy + aCorner * (uRect.zw - uRect.xy); vUv = aCorner; vP = p; gl_Position = toClip(p, 1.0); }`;
const SHADOW_FS = `${GLSL}
in vec2 vUv; uniform float uAlpha; out vec4 o;
void main() { vec2 q = (vUv - 0.5) * 2.0; float a = exp(-dot(q * vec2(1.0, 1.0), q) * 3.2) * uAlpha; o = vec4(0.0, 0.0, 0.0, a); }`;
const HAZE_FS = `${GLSL}
in vec2 vUv; in vec2 vP;
uniform float uTime, uTravel, uAmount, uBoost; uniform vec3 uPtr;
out vec4 o;
${HASH}
void main() {
  // a plume: thick at the tail, rising a little and thinning to the right; the dust in it rolls back with the road
  float x = (vP.x - 1060.0) / 640.0;                    // 0 at the tail, 1 far behind
  float yc = 694.0 + 4.0 * x, spread = 30.0 + 34.0 * max(x, 0.0);
  float prof = exp(-pow((vP.y - yc) / spread, 2.0));
  float along = smoothstep(-0.03, 0.09, x) * pow(clamp(1.0 - x, 0.0, 1.0), 2.1);
  vec2 q = vec2(vP.x * 0.012 - uTravel * 0.0045, vP.y * 0.02);
  float n = fbm(q + vec2(0.0, uTime * 0.05));
  float n2 = fbm(q * 2.7 - vec2(uTime * 0.12, 0.0));
  float d = prof * along * (0.45 + 0.75 * n * n2 * 2.0) * uAmount * (1.0 + 0.5 * uBoost);
  float pd = length(vP - uPtr.xy);
  d *= 1.0 - 0.6 * uPtr.z * exp(-pd * pd / 6000.0);
  vec3 c = mix(vec3(1.0, 0.95, 0.94), vec3(1.0, 0.62, 0.66), smoothstep(0.15, 0.85, x));
  // the wheel's own dust, low along the road
  vec2 wq = (vP - vec2(900.0, 748.0)) / vec2(260.0, 26.0);
  float wd = exp(-dot(wq, wq) * 1.2) * smoothstep(-0.2, 0.3, wq.x) * (0.5 + 0.8 * n2) * uAmount * 0.8;
  d += wd;
  c = mix(c, vec3(1.0, 0.9, 0.92), wd / max(d, 1e-3));
  o = vec4(c * d * 0.95, d * 0.55);
}`;

// ---- dust: puffs and bright specks kicked off the tail and the rear wheel (simulated on the CPU) ----
const DUST_VS = `${GLSL}
in vec2 aCorner; in vec4 aP; in vec2 aQ; // aP: x, y, size, alpha; aQ: kind, seed
out vec2 vUv; out float vA; out float vK; out float vSeed;
${MAP}
void main() {
  vec2 p = aP.xy + (aCorner - 0.5) * aP.z * vec2(aQ.x > 0.5 ? 2.6 : 1.0, 1.0);
  vUv = aCorner; vA = aP.w; vK = aQ.x; vSeed = aQ.y;
  gl_Position = toClip(p, 1.0);
}`;
const DUST_FS = `${GLSL}
in vec2 vUv; in float vA; in float vK; in float vSeed;
uniform float uTime;
out vec4 o;
${HASH}
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  if (vK > 0.5) {                                       // a speck: a short bright streak
    float a = exp(-(q.x * q.x * 1.2 + q.y * q.y * 9.0) * 2.5) * vA;
    o = vec4(vec3(1.0, 0.96, 0.92) * a, a * 0.4);
    return;
  }
  float r = length(q);
  float n = fbm(q * 1.6 + vSeed * 13.0 + vec2(uTime * 0.2, 0.0));
  float a = smoothstep(1.0, 0.1, r + (n - 0.5) * 0.6) * vA;
  vec3 c = mix(vec3(1.0, 0.92, 0.9), vec3(1.0, 0.7, 0.72), vSeed);
  o = vec4(c * a * 0.8, a * 0.6);
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

const rand = (() => { let t = 0x2f6b9a1; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; })();

/**
 * createScene(canvas, { frame, calm }) → scene | null (no WebGL2).
 * frame() returns where the design frame sits in the canvas, in css px: { x, y, s } (design px → css px).
 */
export function createScene(canvas, { frame, calm = false }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;

  const state = {
    fade: calm ? 1 : 0,          // stars
    reveal: calm ? 1.2 : 0,      // the road lights from the car outward (> 1: all lit)
    exposure: calm ? 1 : 0,      // the car
    carX: 0, carY: 0, carA: 0,   // the car's offset (design px) and lean
    dust: calm ? 1 : 0,          // how much dust
    speed: 1,                    // the road's speed, before boost
    glint: -1,                   // where the glint is on the car (0..1 across it), off when outside
    gain: 1,
  };
  const input = { boost: 0, want: 0, ptr: { x: -9999, y: -9999, on: 0, want: 0 }, par: { x: 0, y: 0, tx: 0, ty: 0 } };

  // ---- programs and buffers ----
  const P = {
    stars: compile(gl, STARS_VS, STARS_FS),
    ribbon: compile(gl, RIBBON_VS, RIBBON_FS),
    car: compile(gl, CAR_VS, CAR_FS),
    shadow: compile(gl, QUAD_VS, SHADOW_FS),
    haze: compile(gl, QUAD_VS, HAZE_FS),
    dust: compile(gl, DUST_VS, DUST_FS),
  };
  const emptyVao = gl.createVertexArray();

  function ribbonMesh(def, opts) {
    const m = loft(def, opts);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(P.ribbon.p, 'aPos'), ad = gl.getAttribLocation(P.ribbon.p, 'aData');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(ad); gl.vertexAttribPointer(ad, 3, gl.FLOAT, false, 20, 8);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const pal = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteStrip(def));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { vao, count: m.index.length, pal, range: m.range, lanes: m.lanes, neck: m.neck, dim: def.dim || [1, -1e5, -1e5 + 1], span: Math.max(m.neck, m.stations - 1 - m.neck) };
  }
  const main = ribbonMesh(MAIN, { cols: 380, rows: 150 });
  const road = ribbonMesh(ROAD, { cols: 260, rows: 60 });

  const quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao);
  const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  for (const prog of [P.car, P.shadow, P.haze]) {
    const a = gl.getAttribLocation(prog.p, 'aCorner');
    if (a >= 0) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); }
  }
  gl.bindVertexArray(null);

  // dust: instanced quads
  const MAX = 900;
  const dustData = new Float32Array(MAX * 6);
  const dustVao = gl.createVertexArray(); gl.bindVertexArray(dustVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  const dc = gl.getAttribLocation(P.dust.p, 'aCorner'); gl.enableVertexAttribArray(dc); gl.vertexAttribPointer(dc, 2, gl.FLOAT, false, 0, 0);
  const dustBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferData(gl.ARRAY_BUFFER, dustData.byteLength, gl.DYNAMIC_DRAW);
  const dp = gl.getAttribLocation(P.dust.p, 'aP'), dq = gl.getAttribLocation(P.dust.p, 'aQ');
  gl.enableVertexAttribArray(dp); gl.vertexAttribPointer(dp, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(dp, 1);
  gl.enableVertexAttribArray(dq); gl.vertexAttribPointer(dq, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(dq, 1);
  gl.bindVertexArray(null);

  // the car's picture
  const carTex = gl.createTexture();
  let carSize = [1148, 380];
  const carReady = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, carTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      carSize = [img.naturalWidth, img.naturalHeight];
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = new URL(`../../${CAR.src}`, import.meta.url).href;
  });
  let carLoaded = false;
  carReady.then((ok) => { carLoaded = ok; draw(); });

  // ---- dust simulation (design px) ----
  const dust = [];
  let emitPuff = 0, emitSpeck = 0;
  function spawn(kind) {
    if (dust.length >= MAX) return;
    if (kind === 0) {
      // puffs roll off the tail and from under the rear wheel
      const fromWheel = rand() < 0.35;
      const x = fromWheel ? 900 + rand() * 40 : 1060 + rand() * 70;
      const y = fromWheel ? 735 + rand() * 12 : 668 + rand() * 62;
      dust.push({ k: 0, x, y, vx: 110 + rand() * 170, vy: -14 + rand() * 26 - (fromWheel ? 10 : 0), size: 26 + rand() * 30, grow: 60 + rand() * 90, life: 0, max: 1.6 + rand() * 1.8, a: 0.1 + rand() * 0.16, seed: rand() });
    } else {
      // specks: bright grains flung off the tail (where the shot's bodywork comes apart) and the tyre
      const fromWheel = rand() < 0.4;
      const x = fromWheel ? 890 + rand() * 50 : 980 + rand() * 150;
      const y = fromWheel ? 738 + rand() * 10 : 640 + rand() * 95;
      dust.push({ k: 1, x, y, vx: 240 + rand() * 420, vy: -40 + rand() * 60, size: 2.2 + rand() * 3.2, grow: 0, life: 0, max: 0.5 + rand() * 1.1, a: 0.5 + rand() * 0.5, seed: rand() });
    }
  }
  function stepDust(dt, travelRate) {
    const pace = 0.65 + 0.35 * travelRate;
    emitPuff += dt * 34 * state.dust * pace * (1 + 1.6 * input.boost);
    emitSpeck += dt * 150 * state.dust * pace * (1 + 2.5 * input.boost);
    while (emitPuff > 1) { spawn(0); emitPuff--; }
    while (emitSpeck > 1) { spawn(1); emitSpeck--; }
    const p = input.ptr;
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life += dt;
      if (d.life > d.max) { dust[i] = dust[dust.length - 1]; dust.pop(); continue; }
      // the pointer pushes dust aside
      if (p.on > 0.01) {
        const dx = d.x - p.x, dy = d.y - p.y, r2 = dx * dx + dy * dy;
        if (r2 < 22000) { const f = (1 - r2 / 22000) * 900 * p.on * dt; const r = Math.sqrt(r2) || 1; d.vx += (dx / r) * f; d.vy += (dy / r) * f; }
      }
      const drag = d.k === 0 ? 0.55 : 0.25;
      d.vx *= Math.exp(-drag * dt); d.vy *= Math.exp(-drag * dt);
      d.vx += (d.k === 0 ? 40 : 90) * dt * (1 + input.boost);
      d.vy += (d.k === 0 ? -6 : 12) * dt;
      d.x += d.vx * dt * pace; d.y += d.vy * dt * pace;
      d.size += d.grow * dt;
    }
    let n = 0;
    for (const d of dust) {
      const t = d.life / d.max;
      const a = d.a * Math.min(1, t * 6) * (1 - t) ** 1.4;
      dustData.set([d.x, d.y, d.size, a, d.k, d.seed], n * 6);
      n++;
    }
    return n;
  }

  // ---- size and frame ----
  let W = 1, H = 1, dpr = 1, F = { x: 0, y: 0, s: 1 };
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, r.width * r.height > 2.4e6 ? 1.5 : 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  // ---- loop ----
  let raf = 0, last = 0, time = 0, travel = 0, spin = 0, running = false, visible = true;
  let glintClock = 5;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  function update(dt) {
    input.boost = damp(input.boost, input.want, input.want > input.boost ? 2.2 : 1.4, dt);
    input.ptr.on = damp(input.ptr.on, input.ptr.want, 5, dt);
    input.par.x = damp(input.par.x, input.par.tx, 2.5, dt); input.par.y = damp(input.par.y, input.par.ty, 2.5, dt);
    const rate = state.speed * (1 + 3.2 * input.boost);
    travel += dt * 95 * rate;
    spin += dt * (14 + 46 * input.boost) * Math.min(1, state.speed);
    time += dt;
    // the glint: every few seconds it runs over the car, nose to tail
    glintClock += dt;
    if (glintClock > 9) glintClock = 0;
    state.glint = glintClock < 1.4 ? -0.15 + (glintClock / 1.4) * 1.4 : -1;
    return rate;
  }

  function draw(dt = 0, rate = 1) {
    resize();
    const f = frame();
    const s = f.s * dpr;
    gl.viewport(0, 0, W, H);
    const shake = input.boost * (0.9 + 0.5 * Math.sin(time * 61)) ;
    const parX = input.par.x * dpr, parY = input.par.y * dpr;
    const setMap = (prog) => {
      gl.uniform2f(prog.u.uRes, W, H);
      gl.uniform3f(prog.u.uFrame, f.x * dpr, f.y * dpr, s);
      gl.uniform2f(prog.u.uPar, parX, parY);
    };
    const ptr = input.ptr;

    // stars
    gl.disable(gl.BLEND);
    gl.useProgram(P.stars.p);
    setMap(P.stars);
    gl.uniform1f(P.stars.u.uTime, time); gl.uniform1f(P.stars.u.uBoost, input.boost); gl.uniform1f(P.stars.u.uDpr, dpr); gl.uniform1f(P.stars.u.uFade, state.fade);
    gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the road and the ribbon of light, added on
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(P.ribbon.p);
    gl.uniform1f(P.ribbon.u.uTravel, travel); gl.uniform1f(P.ribbon.u.uTime, time); gl.uniform1f(P.ribbon.u.uBoost, input.boost);
    gl.uniform1f(P.ribbon.u.uDpr, dpr); gl.uniform3f(P.ribbon.u.uPtr, ptr.x, ptr.y, ptr.on); gl.uniform1i(P.ribbon.u.uPal, 0);
    for (const [m, gain, dashes, seed, depth] of [[road, 1.15, 0.9, 3.7, 0.75], [main, state.gain, 1, 0.0, 0.6]]) {
      setMap(P.ribbon);
      gl.uniform1f(P.ribbon.u.uDepth, depth);
      gl.uniform2f(P.ribbon.u.uRange, m.range[0], m.range[1]); gl.uniform1f(P.ribbon.u.uLanes, m.lanes);
      gl.uniform1f(P.ribbon.u.uGain, gain); gl.uniform1f(P.ribbon.u.uDashes, dashes); gl.uniform1f(P.ribbon.u.uSeed, seed);
      gl.uniform1f(P.ribbon.u.uNeck, m.neck); gl.uniform3f(P.ribbon.u.uDim, ...m.dim); gl.uniform1f(P.ribbon.u.uSpan, m.span); gl.uniform1f(P.ribbon.u.uReveal, state.reveal);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.pal);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }

    // the car's shadow on the road
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.shadow.p); setMap(P.shadow);
    gl.uniform4f(P.shadow.u.uRect, 560 + state.carX, 712 + state.carY, 1150 + state.carX, 778 + state.carY);
    gl.uniform1f(P.shadow.u.uAlpha, 0.85 * Math.min(1, state.exposure * 1.5));
    gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // the car
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (carLoaded && state.exposure > 0.001) {
      gl.useProgram(P.car.p); setMap(P.car);
      gl.uniform4f(P.car.u.uRect, CAR.x0, CAR.y0, CAR.x1, CAR.y1);
      const bob = calm ? 0 : Math.sin(time * 7.3) * 0.35 + Math.sin(time * 3.1) * 0.25;
      const sx = shake * Math.sin(time * 47) * 0.9, sy = shake * Math.sin(time * 53 + 1) * 0.7;
      gl.uniform4f(P.car.u.uXf, state.carX + sx, state.carY + bob + sy, state.carA - input.boost * 0.012, 0);
      gl.uniform2f(P.car.u.uPivot, 893, 745);
      gl.uniform2f(P.car.u.uTexSize, carSize[0], carSize[1]);
      gl.uniform1f(P.car.u.uSpin, spin); gl.uniform1f(P.car.u.uBlur, calm ? 0 : Math.min(1.26, 0.85 + 0.6 * input.boost)); // at most one spoke's turn: past that it is a blur anyway
      gl.uniform1f(P.car.u.uTime, time); gl.uniform1f(P.car.u.uTravel, travel); gl.uniform1f(P.car.u.uExposure, state.exposure);
      gl.uniform1f(P.car.u.uGlint, state.glint); gl.uniform1f(P.car.u.uBoost, input.boost);
      gl.uniform3f(P.car.u.uPtr, ptr.x, ptr.y, ptr.on);
      const k = carSize[0] / 1148;
      gl.uniform4f(P.car.u.uW0, WHEELS[0].x * k, WHEELS[0].y * k, WHEELS[0].rx * k, WHEELS[0].ry * k); gl.uniform1f(P.car.u.uWa0, WHEELS[0].a);
      gl.uniform4f(P.car.u.uW1, WHEELS[1].x * k, WHEELS[1].y * k, WHEELS[1].rx * k, WHEELS[1].ry * k); gl.uniform1f(P.car.u.uWa1, WHEELS[1].a);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, carTex); gl.uniform1i(P.car.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, main.pal); gl.uniform1i(P.car.u.uPal, 1);
      gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);
    }

    // the haze of dust behind it, and the dust
    if (state.dust > 0.001) {
      gl.useProgram(P.haze.p); setMap(P.haze);
      gl.uniform4f(P.haze.u.uRect, 860 + state.carX, 580 + state.carY, 1780 + state.carX, 820 + state.carY);
      gl.uniform1f(P.haze.u.uTime, time); gl.uniform1f(P.haze.u.uTravel, travel); gl.uniform1f(P.haze.u.uAmount, state.dust); gl.uniform1f(P.haze.u.uBoost, input.boost);
      gl.uniform3f(P.haze.u.uPtr, ptr.x, ptr.y, ptr.on);
      gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const n = stepDust(calm ? 0 : dt, rate);
      if (n) {
        gl.useProgram(P.dust.p); setMap(P.dust);
        gl.uniform1f(P.dust.u.uTime, time);
        gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dustData, 0, n * 6);
        gl.bindVertexArray(dustVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      }
    }
    gl.bindVertexArray(null);
  }

  function tick(now) {
    raf = 0;
    if (!running || !visible) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    const rate = update(dt);
    draw(dt, rate);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (calm || paused) { draw(); return; } running = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  // the page pauses it while the footer is off screen
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  // the reader can pause it (the footer's pause button): it rests on the frame it is on until they play it again
  let paused = false;
  function pause(on) {
    paused = on;
    if (on) { stop(); draw(); } else if (onScreen) start();
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
  addEventListener('resize', () => { if (!running && onScreen) draw(); });
  let onScreen = true;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); }, false);
  canvas.addEventListener('webglcontextrestored', () => location.reload(), false);

  // pre-warm the dust so the plume is already there when the car arrives
  function warm(seconds = 2.5) { const d0 = state.dust; state.dust = 1; for (let t = 0; t < seconds; t += 1 / 30) stepDust(1 / 30, 1); state.dust = d0; }

  return {
    state,
    ready: carReady,
    start, stop, draw, warm, pause,
    get running() { return running; },
    get paused() { return paused; },
    set onScreen(v) { onScreen = v; },
    /** design px of a point on the page (css px, viewport) */
    toDesign(x, y) { const f = frame(); const r = canvas.getBoundingClientRect(); return { x: (x - r.left - f.x) / f.s, y: (y - r.top - f.y) / f.s }; },
    pointer(x, y, on) { if (on) { const p = this.toDesign(x, y); input.ptr.x = p.x; input.ptr.y = p.y; } input.ptr.want = on ? 1 : 0; },
    parallax(nx, ny) { input.par.tx = nx * -10; input.par.ty = ny * -6; },
    boost(on) { input.want = on ? 1 : 0; },
    glint() { glintClock = 0; },
    get boosting() { return input.boost; },
  };
}
