// The hero's photographs, live, in raw WebGL. One quad draws both halves the way the CSS would (cover, with the same
// focal points), then: the sprinter enters on a streak of stretched pixels and the man rises into his half; moving
// (the pointer, the scroll) smears the sprinter along his run while the man beside him stands still; the pointer
// warms the wall where it passes; the photo melts into the flat orange under the line. If WebGL is missing, the
// <img>s underneath are the hero.
import { calm, on, scroll, pointer, loop, damp, clamp, gsap, ScrollTrigger } from './core.js';

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uA, uB;
uniform vec4 uMapA, uMapB;     // texture = rect uv * xy + zw
uniform vec2 uSize;            // device px
uniform float uTime, uRevA, uRevB, uBlur, uHeat, uFade0, uFade1, uHalves;
uniform vec2 uMouse;           // device px, top-left origin
uniform vec3 uOrange;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 tapA(vec2 uv) { return texture2D(uA, clamp(uv * uMapA.xy + uMapA.zw, 0.001, 0.999)).rgb; }
vec3 tapB(vec2 uv) { return texture2D(uB, clamp(uv * uMapB.xy + uMapB.zw, 0.001, 0.999)).rgb; }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 uv = px / uSize;                     // whole canvas, top-left origin
  float side = step(0.5, uv.x) * uHalves;   // 0: sprinter, 1: standing man (a phone shows the sprinter alone)
  vec2 h = uHalves > 0.5 ? vec2(fract(uv.x * 2.0), uv.y) : uv;   // uv inside its half

  // the pointer: a lens that pulls the wall a little toward it, and warmth
  vec2 m = uMouse / uSize;
  vec2 dm = (uv - m) * vec2(uSize.x / uSize.y, 1.0);
  float near = exp(-dot(dm, dm) * 9.0) * uHeat;
  h -= (uv - m) * vec2(1.0 + uHalves, 1.0) * near * 0.025;

  vec3 col;
  if (side < 0.5) {
    // enter on a streak: beyond the front, every column repeats the front's pixels
    float front = uRevA * 1.35 - 0.1;
    float beyond = h.x - front;
    vec2 q = h;
    if (beyond > 0.0) q.x = front;
    // a smear along the run, wider for faster moves, with the channels pulled apart
    float b = uBlur * 0.045;
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 12; i++) {
      float t = float(i) / 11.0 - 0.75;
      float w = 1.0 - abs(t) * 0.6;
      vec2 o = vec2(t * b, 0.0);
      acc.r += tapA(q + o * 1.25).r * w;
      acc.g += tapA(q + o).g * w;
      acc.b += tapA(q + o * 0.8).b * w;
      wsum += w;
    }
    col = acc / wsum;
    float streak = smoothstep(0.0, 0.35, beyond);
    col = mix(col, uOrange, streak);
  } else {
    // rise into place: below the front the photo is drawn up out of the floor
    float front = 1.0 - (uRevB * 1.3 - 0.15);
    float before = front - h.y;
    vec2 q = h;
    if (before > 0.0) q.y = front;
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float b = uBlur * 0.008;
    for (int i = 0; i < 5; i++) {
      float t = float(i) / 4.0 - 0.5;
      acc += tapB(q + vec2(t * b, 0.0)); wsum += 1.0;
    }
    col = acc / wsum;
    col = mix(col, uOrange, smoothstep(0.0, 0.3, before));
  }

  // warmth under the pointer
  col += vec3(0.16, 0.05, 0.0) * near * (1.0 - dot(col, vec3(0.333)));

  // melt into the flat orange under the line
  col = mix(col, uOrange, smoothstep(uFade0, uFade1, uv.y));

  // grain against banding
  col += (hash(px + fract(uTime) * 91.7) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function init() {
  const hero = document.querySelector('.hero');
  const canvas = hero?.querySelector('.hero__gl');
  const imgs = [...hero.querySelectorAll('.hero__photo img')];
  const api = { reveal: () => {}, ready: Promise.resolve(), gl: false, set: () => {} };
  if (!canvas || imgs.length < 2) return api;

  // the static parts can move without WebGL: the ring's runner, scroll parallax on the type
  orbit(hero);

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return api;

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
  for (const n of ['uA', 'uB', 'uMapA', 'uMapB', 'uSize', 'uTime', 'uRevA', 'uRevB', 'uBlur', 'uHeat', 'uMouse', 'uOrange', 'uFade0', 'uFade1', 'uHalves']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform3f(U.uOrange, 254 / 255, 75 / 255, 31 / 255);
  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);

  const decode = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }))
    .then(() => (img.decode ? img.decode().catch(() => {}) : null));
  const textures = imgs.map((img, i) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([254, 75, 31]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  });
  const size = imgs.map(() => [1, 1]);
  api.ready = Promise.all(imgs.map((img, i) => decode(img).then(() => {
    if (!img.naturalWidth) return;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, textures[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    size[i] = [img.naturalWidth, img.naturalHeight];
    fit();
  })));

  // the focal points the CSS uses (object-position), read back so the two always agree
  const focal = imgs.map((img) => {
    const pos = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    return [isNaN(pos[0]) ? 0.5 : pos[0], isNaN(pos[1]) ? 0.5 : pos[1]];
  });

  const state = { revA: 0, revB: 0, blur: 0, heat: 0, mx: -9999, my: -9999, zoom: 0 };
  let W = 1, H = 1, dpr = 1, heroH = 1;
  function fit() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    heroH = r.height;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
    gl.uniform2f(U.uSize, W, H);
    // the photo is drawn to the line and melts away just under it (as the CSS does)
    const line = hero.querySelector('.hero__hline');
    const ly = line && innerWidth >= 1000 ? (line.getBoundingClientRect().top - r.top) / r.height : 0.82;
    gl.uniform1f(U.uFade0, ly - 0.14); gl.uniform1f(U.uFade1, ly + 0.03);
    maps();
    if (calm && drawOnce) drawOnce(); // a resized canvas is blank, and nothing else will paint it again
  }
  let drawOnce = null;
  function maps() {
    const halves = innerWidth >= 700;
    gl.uniform1f(U.uHalves, halves ? 1 : 0);
    imgs.forEach((img, i) => {
      const rw = halves ? W / 2 : W, rh = H;
      const zoom = 1 + state.zoom;
      const k = Math.max(rw / size[i][0], rh / size[i][1]) * zoom;
      const dw = size[i][0] * k, dh = size[i][1] * k;
      const ox = (rw - dw) * focal[i][0], oy = (rh - dh) * focal[i][1] + state.zoom * rh * 0.6;
      const v = [rw / dw, rh / dh, -ox / dw, -oy / dh];
      gl.uniform4f(i ? U.uMapB : U.uMapA, ...v);
    });
  }
  fit();
  new ResizeObserver(fit).observe(canvas);
  hero.classList.add('has-gl');
  api.gl = true;

  // ---- inputs ----
  let lastPX = pointer.x;
  on('pointer', (p) => {
    const r = canvas.getBoundingClientRect();
    state.mx = (p.x - r.left) * dpr; state.my = (p.y - r.top) * dpr;
    state.inside = p.active && p.y >= r.top && p.y <= r.bottom;
  });

  let reveal = calm ? 1 : 0;
  state.revA = state.revB = reveal;
  api.set = (v) => { state.revA = state.revB = v; };
  api.reveal = (dur = 1.5) => {
    if (calm || !gsap) { state.revA = state.revB = 1; return; }
    gsap.to(state, { revA: 1, duration: dur, ease: 'power3.inOut' });
    gsap.to(state, { revB: 1, duration: dur * 1.05, delay: dur * 0.22, ease: 'power3.inOut' });
  };

  const render = (time) => {
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uRevA, state.revA);
    gl.uniform1f(U.uRevB, state.revB);
    gl.uniform1f(U.uBlur, state.blur);
    gl.uniform1f(U.uHeat, state.heat);
    gl.uniform2f(U.uMouse, state.mx, state.my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (calm) { drawOnce = () => render(0); api.ready.then(drawOnce); return api; }

  let drewHidden = false;
  loop(canvas, (dt, t) => {
    // nothing to show yet (under the loader): one orange frame is enough
    if (state.revA === 0 && state.revB === 0) { if (!drewHidden) { render(t); drewHidden = true; } return; }
    drewHidden = false;
    // pointer speed and scroll speed both read as movement
    const pv = Math.abs(pointer.x - lastPX); lastPX = pointer.x;
    const want = clamp(pv * 0.035 + Math.abs(scroll.v) * 0.05, 0, 1.4);
    state.blur = damp(state.blur, want, want > state.blur ? 10 : 3.2, dt);
    state.heat = damp(state.heat, state.inside ? 1 : 0, 4, dt);
    const z = clamp(scroll.y / Math.max(1, heroH), 0, 1) * 0.08;
    if (Math.abs(z - state.zoom) > 0.0005) { state.zoom = z; maps(); }
    render(t);
  });
  return api;
}

// The ring's runner: a light that laps the ring, quicker while the page moves; the vertical rule and the big number
// drift a little with the scroll.
function orbit(hero) {
  const o = hero.querySelector('.hero__orbit');
  const num = hero.querySelector('.hero__num');
  if (!o || calm) return;
  let a = -38, v = 0;
  loop(hero, (dt) => {
    v = damp(v, Math.abs(scroll.v) * 2.2, 4, dt);
    a += (6 + v) * dt;
    o.style.setProperty('--orbit', `${a.toFixed(2)}deg`);
  });
  if (num && gsap && ScrollTrigger) {
    gsap.to(num, { yPercent: -28, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(hero.querySelector('.hero__intro'), { y: -60, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
}
