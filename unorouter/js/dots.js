// The dot grid the page sits on, in WebGL: a 1 px dot every 8 px that scrolls with the page, wakes round the pointer
// (warming towards the accent), sends a ring out from a press, and has the odd dot twinkle. Without WebGL, or with
// reduced motion, the CSS dots stay.

import { calm, fine, on, scroll } from './core.js';

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `
precision mediump float;
uniform vec2 uRes; uniform float uDpr; uniform float uScroll; uniform float uTime;
uniform vec3 uPtr;            // x, y (css px), presence 0..1
uniform vec4 uRing[4];        // x, y (page px), age (s), strength
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 world = vec2(css.x, css.y + uScroll - 3.0);
  vec2 cell = floor(world / 8.0);
  vec2 f = world - cell * 8.0;
  float on = step(f.x, 0.999) * step(f.y, 0.999);
  if (on < 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 c = cell * 8.0 + 0.5 - vec2(0.0, uScroll - 3.0);          // this dot, in css px on screen
  float b = 0.235;
  float d = distance(c, uPtr.xy);
  float glow = exp(-d * d / (2.0 * 110.0 * 110.0)) * uPtr.z;
  b += glow * 0.55;
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRing[i];
    if (r.w <= 0.0) continue;
    float rad = r.z * 520.0;
    float e = 1.0 - abs(distance(c, vec2(r.x, r.y - uScroll)) - rad) / 26.0;
    ring += max(e, 0.0) * r.w * (1.0 - clamp(r.z / 1.4, 0.0, 1.0));
  }
  b += ring * 0.7;
  float h = hash(cell + floor(uTime * 1.3 + hash(cell) * 7.0));
  b += step(0.9965, h) * 0.32;                                         // a twinkle
  vec3 col = mix(vec3(b), vec3(1.0, 0.235, 0.047) * (b + 0.25), clamp(glow * 0.55 + ring * 0.6, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

export function init() {
  if (calm) return;
  const cv = document.querySelector('.dots');
  const gl = cv?.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'); const uDpr = U('uDpr'); const uScroll = U('uScroll'); const uTime = U('uTime'); const uPtr = U('uPtr'); const uRing = U('uRing');

  let dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
  };
  size(); addEventListener('resize', size);
  document.documentElement.classList.add('has-gl');

  const ptr = { x: -1e4, y: -1e4, z: 0, tx: -1e4, ty: -1e4, on: false };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; ptr.tx = e.clientX; ptr.ty = e.clientY; if (!ptr.on) { ptr.x = ptr.tx; ptr.y = ptr.ty; } ptr.on = true; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.on = false; });
  const rings = [];
  const ring = (x, y, w = 1) => { rings.unshift({ x, y: y + scroll.y, t: 0, w }); rings.length = Math.min(rings.length, 4); };
  on('press', (p) => { if (!p.target.closest('input, textarea, select')) ring(p.x, p.y, p.target.closest('.art') ? 1 : 0.55); });

  let t = 0; let last = performance.now(); let raf = 0;
  const ringData = new Float32Array(16);
  const frame = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
    const k = 1 - Math.exp(-dt * 12);
    ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    ptr.z += ((ptr.on && fine ? 1 : 0) - ptr.z) * (1 - Math.exp(-dt * 4));
    ringData.fill(0);
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 1.4) rings.splice(i, 1); }
    rings.forEach((r, i) => ringData.set([r.x, r.y, r.t, r.w], i * 4));
    gl.uniform2f(uRes, cv.width, cv.height); gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uScroll, Math.round(scroll.y * dpr) / dpr); gl.uniform1f(uTime, t);
    gl.uniform3f(uPtr, ptr.x, ptr.y, ptr.z); gl.uniform4fv(uRing, ringData);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); document.documentElement.classList.remove('has-gl'); });
  start();
}
