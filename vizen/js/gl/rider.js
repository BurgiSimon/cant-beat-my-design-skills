// The renderer behind the hero: compiles the two passes in shaders.js, keeps the camera and the rider's pose, and
// draws only when something changed. The scene pass (the expensive one, a raymarch) runs at a lower resolution while
// things move and once more at full resolution when they settle; the post pass is cheap and runs every frame that
// shows grain or a flare. The same context also renders stills on request (the thumbnails, the colours, the corner
// cameras) into a framebuffer and hands them back as 2D canvases.

import { VERT, SCENE, POST } from './shaders.js';

const D2R = Math.PI / 180;

// ---- small linear algebra (3×3 as column arrays) ----
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// row-major 3×3 multiply
const mul = (A, B) => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return r;
};
const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const apply = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
// GL wants column-major; a row-major M passed as-is is its transpose — exactly the inverse for a rotation.
const transpose = (M) => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];

export const srgbToLinear = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
};

// The poses and the cameras the page uses. Angles in degrees.
export const DEFAULTS = {
  // camera: orbit round the helmet's centre
  az: 0, el: 7, dist: 13.2, focal: 1925, target: [0, 0, 0],
  // where the helmet sits in the hero, design px (1440 × 960)
  pp: [732, 352],
  // the head: turned to his left, a little toward us, chin a touch down
  yaw: 180 + 7, pitch: 0, roll: 0,
  visor: 0, body: 1, bodyDrop: 0, led: 0.6, rim: 1, key: [-0.55, 0.75, 0.55],
  paint: '#e9e8e4',
};

export class Rider {
  constructor(canvas, { onLost } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.s = { ...DEFAULTS, paint2: DEFAULTS.paint, scanY: -1e5 };
    this.post = { time: 0, ghost: 1, smear: 0, grain: 0.05, ascii: 0, sweep: 1, cell: 9, fade: 1, flare: 1, lens: [0, 0, 1, 0] };
    this.view = { origin: [0, 0], scale: 1 }; // design → canvas px (set by layout)
    this.quality = 1;                          // scene resolution, of the canvas'
    this.dirty = true;
    this.hq = false;                            // the last scene render was at full quality
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost?.(); });

    const tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.ready = this.#compile();
  }

  async #compile() {
    const gl = this.gl;
    const par = gl.getExtension('KHR_parallel_shader_compile');
    const make = (fs) => {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); gl.attachShader(p, sh);
      }
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      return p;
    };
    const progs = [make(SCENE), make(POST)];
    if (par) {
      // let the driver compile off the main thread; look in on it between frames
      await new Promise((res) => {
        const poll = () => (progs.every((p) => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR)) ? res() : setTimeout(poll, 30));
        poll();
      });
    }
    for (const p of progs) {
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const shs = gl.getAttachedShaders(p);
        throw new Error(shs.map((s) => gl.getShaderInfoLog(s)).join('\n') || gl.getProgramInfoLog(p));
      }
    }
    [this.pScene, this.pPost] = progs;
    this.u = {};
    for (const [name, p] of [['scene', this.pScene], ['post', this.pPost]]) {
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      this.u[name] = {};
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); this.u[name][info.name] = gl.getUniformLocation(p, info.name); }
    }
    this.#glyphs();
    return this;
  }

  // A strip of glyphs ordered by how much ink they carry.
  #glyphs() {
    const gl = this.gl;
    const chars = [...' .·:-=+*<>/vizen%#@VZN'];
    const S = 32;
    const c = document.createElement('canvas'); c.width = S * chars.length; c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    const font = `500 ${S * 0.8}px "JetBrains Mono Variable", ui-monospace, monospace`;
    const ink = chars.map((ch) => {
      g.clearRect(0, 0, S, S); g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, S / 2, S / 2 + 1);
      const d = g.getImageData(0, 0, S, S).data; let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i];
      return { ch, sum };
    }).sort((a, b) => a.sum - b.sum);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    ink.forEach(({ ch }, i) => g.fillText(ch, i * S + S / 2, S / 2 + 1));
    this.glyphN = ink.length;
    this.tGlyph = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tGlyph);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  set(patch) {
    for (const k in patch) {
      const v = patch[k]; const o = this.s[k];
      if (Array.isArray(v)) {
        if (!Array.isArray(o) || v.length !== o.length || v.some((x, i) => Math.abs(x - o[i]) > 1e-5)) { this.s[k] = v.slice(); this.dirty = true; }
      } else if (typeof v === 'number' ? Math.abs(v - o) > 1e-5 || typeof o !== 'number' : v !== o) { this.s[k] = v; this.dirty = true; }
    }
  }

  // The canvas' size in px and where the 1440 × 960 design sits on it.
  resize(w, h, origin, scale) {
    const c = this.canvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; this.dirty = true; }
    if (origin[0] !== this.view.origin[0] || origin[1] !== this.view.origin[1] || scale !== this.view.scale) {
      this.view = { origin, scale }; this.dirty = true;
    }
  }

  #fbo(w, h) {
    const gl = this.gl;
    if (this.fb && this.fb.w === w && this.fb.h === h) return this.fb;
    if (this.fb) { gl.deleteTexture(this.fb.tex); gl.deleteFramebuffer(this.fb.fb); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.fb = { fb, tex, w, h };
    return this.fb;
  }

  // Everything the scene pass needs, from a state and a view.
  #frame(s, view) {
    const camR = this.cam(s);
    const head = mul(Ry(s.yaw * D2R), mul(Rz(s.pitch * D2R), Rx(s.roll * D2R)));
    return { ...camR, head, view };
  }

  cam(s) {
    const az = s.az * D2R, el = s.el * D2R;
    const pos = add(s.target, scale([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], s.dist));
    const fwd = norm(sub(s.target, pos));
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    return { pos, fwd, right, up };
  }

  // A point in the world → design px (and how far it is in front of the camera).
  project(p, s = this.s) {
    const { pos, fwd, right, up } = this.cam(s);
    const v = sub(p, pos); const z = dot(v, fwd);
    return [s.pp[0] + (dot(v, right) / z) * s.focal, s.pp[1] - (dot(v, up) / z) * s.focal, z];
  }

  // The brake light, on screen: canvas px from the bottom left, and how much of it faces us.
  led(s = this.s) {
    const head = mul(Ry(s.yaw * D2R), mul(Rz(s.pitch * D2R), Rx(s.roll * D2R)));
    const p = apply(head, [-1.68, 0.36, 0]);
    const n = apply(head, [-1, 0, 0.0]);
    const [x, y] = this.project(p, s);
    const { pos } = this.cam(s);
    const facing = dot(n, norm(sub(pos, p)));
    const vis = Math.max(0, Math.min(1, (facing + 0.55) / 0.6));
    const { origin, scale: k } = this.view;
    return [origin[0] + x * k, this.canvas.height - (origin[1] + y * k), vis];
  }

  #drawScene(s, w, h, view, fb, bg = [0, 0, 0], bgA = 1) {
    const gl = this.gl; const u = this.u.scene;
    const f = this.#frame(s, view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.pScene);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform2f(u.uOrigin, view.origin[0], view.origin[1]);
    gl.uniform1f(u.uScale, view.scale);
    gl.uniform2f(u.uPP, s.pp[0], s.pp[1]);
    gl.uniform1f(u.uFocal, s.focal);
    gl.uniform3fv(u.uCamPos, f.pos);
    gl.uniformMatrix3fv(u.uCam, false, [...f.right, ...f.up, ...f.fwd]);
    gl.uniformMatrix3fv(u.uHeadInv, false, f.head); // row-major read as column-major = transpose = inverse
    gl.uniform3f(u.uHeadPos, 0, 0, 0);
    gl.uniform1f(u.uVisor, s.visor);
    gl.uniform3fv(u.uPaint, srgbToLinear(s.paint));
    gl.uniform3fv(u.uPaint2, srgbToLinear(s.paint2 || s.paint));
    gl.uniform1f(u.uScanY, s.scanY ?? -1e5);
    gl.uniform1f(u.uBody, s.body);
    gl.uniform1f(u.uBodyDrop, s.bodyDrop || 0);
    gl.uniform3fv(u.uBg, bg);
    gl.uniform1f(u.uBgA, bgA);
    gl.uniform1f(u.uLed, s.led);
    gl.uniform3fv(u.uKey, s.key);
    gl.uniform1f(u.uRim, s.rim);
    gl.uniform1f(u.uQuality, this.hqPass ? 1 : 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Draw: the scene if it changed (fast while moving, full once it settles), then the post pass.
  render({ moving = false } = {}) {
    if (!this.pScene) return;
    const gl = this.gl; const c = this.canvas;
    const q = moving ? this.quality * 0.6 : 1;
    const needHQ = !moving && !this.hq;
    if (this.dirty || needHQ) {
      const w = Math.max(2, Math.round(c.width * q)); const h = Math.max(2, Math.round(c.height * q));
      const fb = this.#fbo(w, h);
      this.hqPass = !moving;
      const v = { origin: [this.view.origin[0] * (w / c.width), this.view.origin[1] * (h / c.height)], scale: this.view.scale * (w / c.width) };
      this.#drawScene(this.s, w, h, v, fb.fb);
      this.dirty = false; this.hq = !moving;
    }
    // post
    const u = this.u.post; const p = this.post;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, c.width, c.height);
    gl.useProgram(this.pPost);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fb.tex); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tGlyph); gl.uniform1i(u.uGlyphs, 1);
    gl.uniform2f(u.uRes, c.width, c.height);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform3fv(u.uLed, this.led());
    gl.uniform1f(u.uFlare, p.flare * this.s.led);
    gl.uniform1f(u.uGhost, p.ghost);
    gl.uniform1f(u.uSmear, p.smear);
    gl.uniform1f(u.uGrain, p.grain);
    gl.uniform1f(u.uAscii, p.ascii);
    gl.uniform1f(u.uSweep, p.sweep);
    gl.uniform1f(u.uCell, p.cell * Math.max(1, c.width / 1600));
    gl.uniform1f(u.uGlyphN, this.glyphN);
    gl.uniform1f(u.uFade, p.fade);
    gl.uniform4fv(u.uLens, p.lens);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // A still, w × h px, of the given pose, as a 2D canvas (rendered at ss× and scaled down, for clean edges).
  // bg: linear rgb, bgA 0 for transparent.
  still(w, h, patch, { bg = [0, 0, 0], bgA = 0, ss = 2 } = {}) {
    if (!this.pScene) return null;
    const gl = this.gl;
    const W = Math.round(w * ss), H = Math.round(h * ss);
    const s = { ...this.s, scanY: -1e5, ...patch };
    s.pp = [s.pp[0] * ss, s.pp[1] * ss]; s.focal *= ss;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.hqPass = true;
    this.#drawScene(s, W, H, { origin: [0, 0], scale: 1 }, fb, bg, bgA);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
    const big = document.createElement('canvas'); big.width = W; big.height = H;
    const g = big.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); // flip
    g.putImageData(img, 0, 0);
    if (ss === 1) return big;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const o = out.getContext('2d'); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(big, 0, 0, w, h);
    return out;
  }
}
