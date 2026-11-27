// The garden kit: everything the 3D scenes are built from, all procedural. Stone and metal (a standard material with
// noise painted and bumped in), moss (shell texturing: the surface drawn again in thin layers, each keeping only the
// little domes that reach it), plants (instanced blades, wheat and daisies that bend in the wind and lean away from
// the pointer), rocks, the vault door, a chain link, a laptop and a soft sky to light them.

import * as THREE from '../../vendor/three.min.js';
import { GLSL_NOISE, GLSL_BUMP, makeNoise3, fbmJS, fbm3JS } from './noise.js';

export { THREE };
export const noise3 = makeNoise3(11);

// Uniforms every scene shares: time, wind, and the pointer's push on the plants (xyz on the ground, w strength).
export const shared = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uPush: { value: new THREE.Vector4(0, -10, 0, 0) },
  uPushR: { value: 0.32 },
  uSunDir: { value: new THREE.Vector3(-0.62, 0.7, 0.5).normalize() },
  uSunCol: { value: new THREE.Color(1.0, 0.95, 0.86).multiplyScalar(1.25) },
  uSkyCol: { value: new THREE.Color(0.94, 0.97, 1.0) },
  uGroundCol: { value: new THREE.Color(0.42, 0.45, 0.3) },
};

const col = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));

// ─────────────────────────── surfaces ───────────────────────────
// The moss mask is one function, used by the surface (to paint moss green under the shells) and by the shells. Its
// noise n = fbm3(obj * uMossScale + 3.7) the surface works out per pixel; the shells have it baked (see mossNoise).
const GLSL_MOSS_N = /* glsl */ `
uniform float uMoss; uniform float uMossUp; uniform float uMossY; uniform float uMossScale; uniform vec3 uMossDir;
float mossMaskN(float n, vec3 obj, vec3 wn){
  float facing = dot(wn, normalize(uMossDir));
  return smoothstep(-0.05, 0.4, n + (facing - 0.2) * uMossUp + obj.y * uMossY + uMoss - 0.5);
}
`;
const GLSL_MOSS = /* glsl */ `${GLSL_MOSS_N}
float mossMask(vec3 obj, vec3 wn){ return mossMaskN(fbm3(obj * uMossScale + 3.7), obj, wn); }
`;

const mossUniforms = (o = {}) => ({
  uMoss: { value: o.moss ?? 0.0 },
  uMossUp: { value: o.mossUp ?? 0.6 },
  uMossY: { value: o.mossY ?? 0.0 },
  uMossScale: { value: o.mossScale ?? 2.4 },
  uMossDir: { value: new THREE.Vector3(...(o.mossDir || [0, 1, 0.25])) },
  uSeed: { value: new THREE.Vector3(...(o.seed || [0, 0, 0])) },
  uScale: { value: o.scale ?? 1 },
});

/** A rough natural surface: stone (or with metalness, old steel), noise-painted and bumped, mossy where asked. */
export function surfaceMaterial(o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.roughness ?? 0.95, metalness: o.metalness ?? 0 });
  const u = {
    ...mossUniforms(o),
    uC1: { value: col(o.c1 ?? '#9b907c') },
    uC2: { value: col(o.c2 ?? '#d6ccb6') },
    uC3: { value: col(o.c3 ?? '#5f5547') },      // the dark of pits, rust, grime
    uMossA: { value: col(o.mossA ?? '#2f3d12') },
    uMossB: { value: col(o.mossB ?? '#7b8d2a') },
    uPore: { value: o.pore ?? 26 },
    uPit: { value: o.pit ?? 0.8 },
    uGrain: { value: o.grain ?? 1 },
    uBump: { value: o.bump ?? 0.012 },
    uTone: { value: o.tone ?? 2.2 },
    uStreak: { value: o.streak ?? 0 },         // stretched scratches (metal)
  };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    // the slow fields (tone, grime, where the moss is) per vertex; the fine ones (grain, pits, scratches) per pixel
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vObj; varying vec3 vWN; varying vec4 vField; uniform vec3 uSeed; uniform float uScale; uniform float uTone;
${GLSL_NOISE}`)
      // (three runs defaultnormal_vertex before begin_vertex: the normal first, then the fields that need both)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vWN = normalize(mat3(modelMatrix) * objectNormal);
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vObj = position * uScale + uSeed;
#ifdef USE_INSTANCING
vObj += instanceMatrix[3].xyz * 1.7;
#endif
vField = vec4(fbm3(vObj * uTone), snoise(vObj * 1.7 + 4.0), 0.0, snoise(vObj * 7.0 + 2.0));   // (z free: the moss is per pixel)`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vObj; varying vec3 vWN; varying vec4 vField;
uniform vec3 uC1, uC2, uC3, uMossA, uMossB; uniform float uPore, uPit, uGrain, uBump, uStreak;
${GLSL_NOISE}
${GLSL_BUMP}
${GLSL_MOSS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float sTone = vField.x;
float sGrain = snoise(vObj * 31.0) * 0.6 + snoise(vObj * 77.0) * 0.4;
float sCell = cells3(vObj * uPore);
float sPit = (1.0 - smoothstep(0.07, 0.27, sCell)) * step(0.15, snoise(vObj * 5.0) + 0.6);
float sStreak = uStreak > 0.0 ? snoise(vec3(vObj.x * 1.5, vObj.y * 60.0, vObj.z * 1.5)) : 0.0;
vec3 sCol = mix(uC1, uC2, smoothstep(-0.55, 0.65, sTone));
sCol *= 0.93 + 0.09 * sGrain * uGrain;
sCol = mix(sCol, uC3, sPit * uPit);
sCol = mix(sCol, uC3, smoothstep(0.35, 0.9, vField.y) * 0.35);
sCol *= 1.0 + sStreak * uStreak * 0.12;
float sMoss = uMoss > -0.9 ? mossMask(vObj, normalize(vWN)) : 0.0;   // per pixel: no facets on a coarse mesh
vec3 sMossCol = mix(uMossA, uMossB, smoothstep(-0.4, 0.7, vField.w));
diffuseColor.rgb = mix(sCol, sMossCol * 0.6, sMoss);
float sH = (-sPit * 0.9 + sGrain * 0.22 * uGrain + sTone * 0.35 + sStreak * uStreak * 0.3) * (1.0 - sMoss * 0.7);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, sMoss) + sPit * 0.05;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor *= (1.0 - sMoss) * (1.0 - sPit * 0.6);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = bumpFrom(-vViewPosition, normal, sH * uBump, faceDirection);`);
  };
  m.customProgramCacheKey = () => `surface-${o.key || 'x'}`;
  return m;
}

// The moss mask's noise at every vertex, as GLSL_MOSS works it out: it is the same for every layer, so the shells
// look it up instead of working it out again per layer (from the geometry as it is now, and seed, scale, mossScale).
function mossNoise(geometry, o) {
  const pos = geometry.attributes.position, n = new Float32Array(pos.count);
  const [sx, sy, sz] = o.seed || [0, 0, 0], s = o.scale ?? 1, k = o.mossScale ?? 2.4;
  for (let i = 0; i < pos.count; i++) n[i] = fbm3JS((pos.getX(i) * s + sx) * k + 3.7, (pos.getY(i) * s + sy) * k + 3.7, (pos.getZ(i) * s + sz) * k + 3.7);
  return new THREE.Float32BufferAttribute(n, 1);
}

/** Moss as shells over a mesh's geometry: `layers` thin copies pushed out along the normals, drawn in one instanced call.
 *  Shape the geometry first: its moss noise is worked out here (seed, scale and mossScale are fixed from then on). */
export function mossShells(geometry, o = {}) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = geometry.index;
  for (const k of ['position', 'normal', 'uv']) if (geometry.attributes[k]) g.setAttribute(k, geometry.attributes[k]);
  g.setAttribute('aMossN', mossNoise(geometry, o));   // on the shells only: the source's attributes are shared
  g.instanceCount = o.layers ?? 18;
  g.boundingSphere = geometry.boundingSphere?.clone() || null;
  if (!g.boundingSphere) { geometry.computeBoundingSphere(); g.boundingSphere = geometry.boundingSphere.clone(); }
  g.boundingSphere.radius += o.thick ?? 0.04;
  const u = {
    ...mossUniforms(o),
    uLayers: { value: o.layers ?? 18 },
    uThick: { value: o.thick ?? 0.035 },
    uDroop: { value: o.droop ?? 0.004 },
    uDensity: { value: new THREE.Vector2(...(o.density || [400, 100])) },
    uMossA: { value: col(o.mossA ?? '#26330d') },
    uMossB: { value: col(o.mossB ?? '#7f9230') },
    uTip: { value: col(o.tip ?? '#b7c15a') },
    uFill: { value: o.fill ?? 0.5 },            // how full the domes are (0 sparse … 1 a carpet)
    uLight: { value: o.light ?? 1 },
    uTime: shared.uTime, uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uSkyCol: shared.uSkyCol, uGroundCol: shared.uGroundCol,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      uniform float uLayers, uThick, uDroop, uScale; uniform vec3 uSeed;
      attribute float aMossN;
      varying vec3 vWN; varying vec2 vUv; varying float vLayer; varying float vMask;
      ${GLSL_MOSS_N}
      void main(){
        float layer = (float(gl_InstanceID) + 1.0) / uLayers;
        vec3 n = normalize(normal);
        vec3 p = position + n * uThick * layer;
        vUv = uv; vLayer = layer;
        vWN = normalize(mat3(modelMatrix) * n);
        vMask = mossMaskN(aMossN, position * uScale + uSeed, vWN);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        wp.y -= uDroop * layer * layer;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMossA, uMossB, uTip, uSunDir, uSunCol, uSkyCol, uGroundCol; uniform vec2 uDensity; uniform float uFill, uLight;
      varying vec3 vWN; varying vec2 vUv; varying float vLayer; varying float vMask;
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
      void main(){
        float m = vMask;
        if (m < 0.03) discard;
        vec2 q = vUv * uDensity;
        vec2 ci = floor(q); vec2 f = fract(q) - 0.5;
        vec2 jit = (hash22(ci) - 0.5) * 0.45;
        float hgt = m * mix(0.35, 1.0, hash12(ci + 7.1)) * mix(0.75, 1.0, uFill);
        // the fine fuzz: a grid three times as dense, its own heights, over the top of each cushion
        vec2 q2 = q * 3.0 + 0.37; vec2 c2 = floor(q2); vec2 f2 = fract(q2) - 0.5;
        float h2 = m * mix(0.2, 1.05, hash12(c2 + 1.7));
        float rel = vLayer / max(hgt, 1e-3);
        float r = length(f - jit);
        float radius = mix(0.32, 0.62, uFill) * sqrt(max(0.0, 1.0 - rel * rel));
        bool cushion = vLayer <= hgt && r <= radius;
        bool fuzz = vLayer <= h2 && length(f2 - (hash22(c2) - 0.5) * 0.4) < 0.36 * (1.0 - vLayer / max(h2, 1e-3));
        if (!cushion && !fuzz) discard;
        if (!cushion) rel = vLayer / max(h2, 1e-3) * 0.8;
        vec3 c = mix(uMossA, uMossB, smoothstep(0.0, 1.0, rel) * mix(0.6, 1.0, hash12(ci + 3.3)));
        c = mix(c, uTip, smoothstep(0.7, 1.0, rel) * 0.55 * hash12(ci + 9.9));
        float ao = mix(0.32, 1.0, pow(vLayer, 0.6));
        vec3 wn = normalize(vWN);
        float nl = clamp(dot(wn, uSunDir) * 0.7 + 0.3, 0.0, 1.0);
        vec3 light = mix(uGroundCol, uSkyCol, wn.y * 0.5 + 0.5) * 0.6 + uSunCol * nl * 0.75;
        gl_FragColor = vec4(c * light * ao * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.userData.uniforms = u;
  return mesh;
}

// ─────────────────────────── geometry helpers ───────────────────────────
/** Push every vertex along its normal by f(x, y, z); recompute normals; weld the seams lathes and spheres leave. */
export function displace(geometry, f) {
  const pos = geometry.attributes.position; const nor = geometry.attributes.normal;
  const v = new THREE.Vector3(); const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    const d = f(v.x, v.y, v.z, n);
    pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  weldNormals(geometry);
  geometry.computeBoundingSphere();
  return geometry;
}
export function weldNormals(geometry) {
  const pos = geometry.attributes.position; const nor = geometry.attributes.normal;
  const map = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) { const k = key(i); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  const n = new THREE.Vector3(); const t = new THREE.Vector3();
  for (const list of map.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.add(t.fromBufferAttribute(nor, i));
    n.normalize();
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
}

/** A ring with a rounded-rectangle cross-section, facing +z: outer and inner radius, depth, corner radius. The profile
 *  is resampled evenly along its length, so the lathe's v coordinate runs at an even pace (the moss cells need it). */
export function ringGeometry({ outer = 1, inner = 0.63, depth = 0.34, corner = 0.12, segments = 220, profile = 72 } = {}) {
  const hw = (outer - inner) / 2; const cx = (outer + inner) / 2; const hd = depth / 2;
  const c = Math.min(corner, hw - 0.001, hd - 0.001);
  const raw = [];
  const arc = (x, y, a0) => { for (let s = 0; s <= 24; s++) { const a = a0 + (s / 24) * (Math.PI / 2); raw.push(new THREE.Vector2(x + Math.cos(a) * c, y + Math.sin(a) * c)); } };
  arc(cx + hw - c, -hd + c, -Math.PI / 2);
  arc(cx + hw - c, hd - c, 0);
  arc(cx - hw + c, hd - c, Math.PI / 2);
  arc(cx - hw + c, -hd + c, Math.PI);
  raw.push(raw[0].clone());
  const pts = resample(raw, profile);
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);   // the lathe's axis (y) becomes z: the ring faces the camera
  g.userData.perimeter = perimeterOf(raw);
  return g;
}
function perimeterOf(p) { let L = 0; for (let i = 1; i < p.length; i++) L += p[i].distanceTo(p[i - 1]); return L; }
function resample(p, n) {
  const L = perimeterOf(p); const out = []; let seg = 1; let acc = 0;
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * L;
    while (seg < p.length - 1 && acc + p[seg].distanceTo(p[seg - 1]) < target) { acc += p[seg].distanceTo(p[seg - 1]); seg++; }
    const len = p[seg].distanceTo(p[seg - 1]) || 1;
    out.push(p[seg - 1].clone().lerp(p[seg], Math.min(1, (target - acc) / len)));
  }
  out[out.length - 1].copy(out[0]);
  return out;
}
/** Planar uv from x and y (for things that face +z, like the door). */
export function planarUV(g, scale = 0.5) {
  const pos = g.attributes.position; const uv = [];
  for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) * scale + 0.5, pos.getY(i) * scale + 0.5);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ─────────────────────────── plants ───────────────────────────
// One shader for every plant. Geometry is drawn for a plant 1 unit tall (y), with aT the bend weight (0 at the root,
// 1 at the tip; a flower's whole head has 1). Per instance: where, how tall, how wide, which way, how bent, a tint.
const PLANT_VS = /* glsl */ `
  attribute float aT; attribute vec3 aOffset; attribute vec4 aParams; attribute vec4 aTint;
  uniform float uTime, uWind, uPushR, uSway; uniform vec4 uPush;
  varying float vT; varying vec3 vCol; varying vec3 vWN; varying float vRnd; varying float vY;
  void main(){
    float H = aParams.x, W = aParams.y, yaw = aParams.z, bend = aParams.w;
    float c = cos(yaw), s = sin(yaw);
    vec3 lp = vec3(position.x * W, position.y * H, position.z * W);
    vec3 rp = vec3(lp.x * c + lp.z * s, lp.y, -lp.x * s + lp.z * c);
    vec2 dir = vec2(s, c);
    float ph = aOffset.x * 1.7 + aOffset.z * 1.1 + aTint.w * 6.28;
    float gust = sin(uTime * 0.6 + aOffset.x * 0.8) * 0.5 + 0.5;
    float w = (sin(uTime * 1.5 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.25) * (0.55 + gust * 0.6);
    vec2 sway = vec2(w, w * 0.35 + sin(uTime * 1.1 + ph) * 0.2) * uWind * uSway;
    vec2 d = aOffset.xz - uPush.xz;
    float fall = exp(-dot(d, d) / (uPushR * uPushR)) * step(abs(aOffset.y - uPush.y), 1.5);
    vec2 away = normalize(d + 1e-4) * uPush.w * fall;
    vec2 lean = (dir * bend + sway + away);
    float k = aT * aT;
    rp.xz += lean * H * k;
    rp.y -= min(length(lean), 1.2) * H * k * 0.38;
    vec3 wpos = (modelMatrix * vec4(aOffset + rp, 1.0)).xyz;
    vT = aT; vCol = color * aTint.rgb; vRnd = aTint.w; vY = position.y;
    vec3 n = normal; vec3 rn = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    vWN = normalize(mat3(modelMatrix) * rn);
    gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
  }`;
const PLANT_FS = /* glsl */ `
  uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol; uniform float uAO, uTrans, uKernels;
  varying float vT; varying vec3 vCol; varying vec3 vWN; varying float vRnd; varying float vY;
  void main(){
    vec3 n = normalize(vWN) * (gl_FrontFacing ? 1.0 : -1.0);
    float nl = dot(n, uSunDir);
    float diff = clamp(nl * 0.6 + 0.4, 0.0, 1.0);
    float trans = clamp(-nl, 0.0, 1.0) * uTrans;
    vec3 light = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5) * 0.62 + uSunCol * (diff * 0.7 + trans * 0.5);
    float ao = mix(uAO, 1.0, smoothstep(0.0, 0.55, vT));
    vec3 c = vCol * (0.86 + vRnd * 0.28);
    if (uKernels > 0.0) c *= 0.9 + 0.14 * smoothstep(0.2, 0.9, sin(vY * uKernels) * 0.5 + 0.5);
    gl_FragColor = vec4(c * light * ao, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function plantMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime, uWind: shared.uWind, uPush: shared.uPush, uPushR: shared.uPushR,
      uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uSkyCol: shared.uSkyCol, uGroundCol: shared.uGroundCol,
      uSway: { value: o.sway ?? 0.16 }, uAO: { value: o.ao ?? 0.35 }, uTrans: { value: o.trans ?? 0.6 }, uKernels: { value: o.kernels ?? 0 },
    },
    vertexShader: PLANT_VS, fragmentShader: PLANT_FS, side: THREE.DoubleSide, vertexColors: true,
  });
}

// Build a geometry from strips: each strip a list of [x, y, z, t, r, g, b, nx, ny, nz] rows, paired left/right.
function stripsGeometry(strips) {
  const P = []; const T = []; const C = []; const N = []; const I = [];
  let base = 0;
  for (const rows of strips) {
    for (const r of rows) { P.push(r[0], r[1], r[2]); T.push(r[3]); C.push(r[4], r[5], r[6]); N.push(r[7], r[8], r[9]); }
    const pairs = rows.length / 2;
    for (let k = 0; k < pairs - 1; k++) {
      const a = base + k * 2;
      I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    base += rows.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex(I);
  return g;
}
const lin = (c) => col(c).clone(); // three keeps colours linear; vertex colours are read as linear

/** A blade: tapering to a point, curled a little forward. Colours from root to tip. */
export function bladeGeometry({ segs = 6, w = 0.05, curl = 0.12, root = '#2f4313', mid = '#5f7d22', tip = '#a9b856', crossed = false } = {}) {
  const c0 = lin(root), c1 = lin(mid), c2 = lin(tip);
  const strip = (rot) => {
    const rows = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const width = w * Math.pow(1 - t, 0.75) * (k === segs ? 0 : 1);
      const z = curl * t * t;
      const cc = t < 0.5 ? c0.clone().lerp(c1, t * 2) : c1.clone().lerp(c2, (t - 0.5) * 2);
      const ca = Math.cos(rot), sa = Math.sin(rot);
      for (const side of [-0.5, 0.5]) {
        const x = side * width;
        rows.push([x * ca, t, x * sa + z, t, cc.r, cc.g, cc.b, -sa * 0.6, 0.35, ca * 0.6 + 0.25]);
      }
    }
    return rows;
  };
  return stripsGeometry(crossed ? [strip(0), strip(Math.PI / 2)] : [strip(0)]);
}

/** Wheat: a thin stem and a long, kernelled head. */
export function wheatGeometry({ segs = 16, stemW = 0.008, headW = 0.034, head = 0.3 } = {}) {
  const stem = lin('#7d7a3a'), straw = lin('#bfa262'), headC = lin('#d2b272'), headD = lin('#9a7a40');
  const strip = (rot) => {
    const rows = []; const ca = Math.cos(rot), sa = Math.sin(rot);
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const inHead = t > 1 - head;
      const ht = inHead ? (t - (1 - head)) / head : 0;
      const width = inHead ? headW * Math.pow(Math.sin(Math.PI * Math.min(1, ht * 0.92 + 0.08)), 0.6) : stemW;
      const cc = inHead ? headD.clone().lerp(headC, Math.sin(ht * Math.PI)) : stem.clone().lerp(straw, t / (1 - head));
      for (const side of [-0.5, 0.5]) {
        const x = side * (k === segs ? 0.002 : width);
        rows.push([x * ca, t, x * sa, t, cc.r, cc.g, cc.b, -sa, 0.3, ca]);
      }
    }
    return rows;
  };
  return stripsGeometry([strip(0), strip(Math.PI / 3), strip((2 * Math.PI) / 3)]);
}

/** A daisy: a stem, a ring of petals, a domed centre. The head is tilted towards the camera (+z). */
export function daisyGeometry({ petals = 13, radius = 0.075, tilt = 0.9 } = {}) {
  const strips = [];
  const stemC = lin('#4f6a1d'), petalC = lin('#f2c21d'), petalT = lin('#ffd84a'), centerC = lin('#b0681a');
  const rows = [];
  for (let k = 0; k <= 6; k++) { const t = (k / 6) * 0.94; for (const side of [-0.5, 0.5]) rows.push([side * 0.012, t, 0, t, stemC.r, stemC.g, stemC.b, 0, 0.3, 1]); }
  strips.push(rows);
  const head = new THREE.Vector3(0, 0.96, 0);
  const rot = new THREE.Matrix4().makeRotationX(tilt);
  const P = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(rot).add(head);
  const nrm = new THREE.Vector3(0, 1, 0).applyMatrix4(rot);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + (i % 2) * 0.1;
    const ca = Math.cos(a), sa = Math.sin(a);
    const pr = [];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3; const r = radius * (0.18 + t * 0.82); const wdt = radius * 0.2 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) * (k === 3 ? 0.4 : 1);
      const lift = -t * t * radius * 0.25;
      const cc = petalC.clone().lerp(petalT, t);
      for (const side of [-1, 1]) {
        const v = P(ca * r - sa * wdt * side, lift, sa * r + ca * wdt * side);
        pr.push([v.x, v.y, v.z, 1, cc.r, cc.g, cc.b, nrm.x, nrm.y, nrm.z]);
      }
    }
    strips.push(pr);
  }
  // centre: a little fan of rings
  for (let ring = 0; ring < 2; ring++) {
    const cr = [];
    const r0 = ring === 0 ? 0 : radius * 0.12, r1 = ring === 0 ? radius * 0.12 : radius * 0.24;
    const y0 = ring === 0 ? radius * 0.14 : radius * 0.1, y1 = ring === 0 ? radius * 0.1 : 0.0;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const v0 = P(Math.cos(a) * r0, y0, Math.sin(a) * r0); const v1 = P(Math.cos(a) * r1, y1, Math.sin(a) * r1);
      const cc = centerC.clone().multiplyScalar(ring === 0 ? 0.85 : 1.1);
      cr.push([v0.x, v0.y, v0.z, 1, cc.r, cc.g, cc.b, nrm.x, nrm.y, nrm.z], [v1.x, v1.y, v1.z, 1, cc.r, cc.g, cc.b, nrm.x, nrm.y, nrm.z]);
    }
    strips.push(cr);
  }
  return stripsGeometry(strips);
}

/** An instanced patch of plants. place(i, rnd) → { x, y, z, h, w, yaw, bend, tint: [r, g, b], or null to skip }. */
export function plantField(geometry, material, count, place, rnd = Math.random) {
  const off = []; const par = []; const tint = [];
  for (let i = 0; i < count; i++) {
    const p = place(i, rnd);
    if (!p) continue;
    off.push(p.x, p.y, p.z);
    par.push(p.h, p.w ?? 1, p.yaw ?? rnd() * Math.PI * 2, p.bend ?? 0.1);
    tint.push(...(p.tint || [1, 1, 1]), rnd());
  }
  const g = new THREE.InstancedBufferGeometry();
  g.index = geometry.index;
  for (const k of Object.keys(geometry.attributes)) g.setAttribute(k, geometry.attributes[k]);
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(off), 3));
  g.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(par), 4));
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 4));
  g.instanceCount = off.length / 3;
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return mesh;
}

// ─────────────────────────── rocks, light ───────────────────────────
export function rockGeometry({ detail = 5, seed = 1, sx = 1, sy = 0.7, sz = 0.9, rough = 0.22 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbmJS(noise3, x * 1.1 + seed * 7, y * 1.1, z * 1.1 + seed, 4);
    const facet = Math.abs(noise3(x * 1.7 + seed, y * 1.7, z * 1.7));
    const r = 1 + n * rough - facet * 0.05;
    pos.setXYZ(i, x * r * sx, Math.max(y * r * sy, -0.35 * sy), z * r * sz);
  }
  g.computeVertexNormals();
  weldNormals(g);   // an icosahedron's faces share no vertices: without this every face is flat
  // a planar uv for the moss cells, from above
  const uv = [];
  for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) * 0.5 + 0.5, pos.getZ(i) * 0.5 + 0.5 + pos.getY(i) * 0.3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** A soft studio sky for image-based light: white above, warm haze at the horizon, green earth below. */
export function skyEnvironment(renderer, { top = '#ffffff', horizon = '#e9eef0', bottom = '#5d6a45' } = {}) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const c0 = col(top), c1 = col(horizon), c2 = col(bottom);
  const cs = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const c = y > 0 ? c1.clone().lerp(c0, Math.pow(y, 0.6)) : c1.clone().lerp(c2, Math.pow(-y, 0.5));
    cs.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.9, 2.7) }));
  sun.position.set(-4.5, 7, 5);
  scene.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, 0.04).texture;
  pm.dispose();
  return env;
}

// ─────────────────────────── the vault door ───────────────────────────
/** The door, facing +z, radius 1. Returns { group, wheel, bolts, door, materials }. The wheel turns about z. */
export function vaultDoor({ metal, moss = true } = {}) {
  const group = new THREE.Group();
  const door = new THREE.Group(); group.add(door);
  const MOSS = { moss: -0.42, mossUp: 0.5, mossY: 0.62, mossDir: [-0.6, 1, 0.3], mossScale: 2.6, seed: [3, 1, 2] };
  const m = metal || surfaceMaterial({
    key: 'steel', c1: '#6c7563', c2: '#9ca291', c3: '#4f4c3a', metalness: 0.55, roughness: 0.5, pore: 9, pit: 0.3, grain: 0.6, bump: 0.005, tone: 1.6, streak: 0.35,
    ...MOSS, mossA: '#2a3510', mossB: '#6f8128',
  });
  const bright = surfaceMaterial({ key: 'steel2', c1: '#8a928a', c2: '#c3c9c0', c3: '#5a5e55', metalness: 0.78, roughness: 0.36, pore: 12, pit: 0.2, grain: 0.5, bump: 0.004, tone: 2.2, streak: 0.6, moss: -1 });
  // the slab: a lathe of rings and grooves
  // the face is subdivided (every 0.04 across the flats) so the moss, worked out per vertex, follows smoothly
  const key = [[0, 0.13], [0.2, 0.13], [0.24, 0.115], [0.6, 0.115], [0.62, 0.1], [0.64, 0.1], [0.66, 0.115], [0.8, 0.115], [0.84, 0.15], [0.94, 0.15], [0.98, 0.13], [1.0, 0.08], [1.0, -0.08], [0, -0.08]];
  const prof = [];
  for (let i = 0; i < key.length; i++) {
    const [r, y] = key[i]; prof.push(new THREE.Vector2(r, y));
    const nx = key[i + 1];
    if (nx && nx[1] === y && Math.abs(nx[0] - r) > 0.05) { const n = Math.ceil(Math.abs(nx[0] - r) / 0.04); for (let k = 1; k < n; k++) prof.push(new THREE.Vector2(r + ((nx[0] - r) * k) / n, y)); }
  }
  const slabG = new THREE.LatheGeometry(prof, 128);
  slabG.rotateX(Math.PI / 2);
  displace(slabG, (x, y, z) => noise3(x * 4, y * 4, z * 4) * 0.004);
  planarUV(slabG, 0.5);
  const slab = new THREE.Mesh(slabG, m); slab.castShadow = true; slab.receiveShadow = true; door.add(slab);
  // rivets round the rim
  const rivetG = new THREE.SphereGeometry(0.032, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); rivetG.rotateX(Math.PI / 2);
  const rivets = new THREE.InstancedMesh(rivetG, m, 20);
  const mx = new THREE.Matrix4();
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; mx.makeTranslation(Math.cos(a) * 0.89, Math.sin(a) * 0.89, 0.145); rivets.setMatrixAt(i, mx); }
  rivets.castShadow = true; door.add(rivets);
  // the wheel: hub, dome, eight spokes, four long arms with blocks
  const wheel = new THREE.Group(); wheel.position.z = 0.13; door.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 48).rotateX(Math.PI / 2), bright); hub.position.z = 0.05; wheel.add(hub);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), bright); dome.position.z = 0.1; dome.scale.z = 0.7; wheel.add(dome);
  const ringW = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 12, 96), bright); ringW.position.z = 0.09; wheel.add(ringW);
  const spokeG = new THREE.CylinderGeometry(0.024, 0.026, 1, 12); spokeG.translate(0, 0.5, 0);
  const knobG = new THREE.SphereGeometry(0.046, 16, 12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const long = i % 2 === 0;
    const len = long ? 0.66 : 0.6;
    const sp = new THREE.Mesh(spokeG, bright); sp.scale.y = len - 0.15; sp.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.08); sp.rotation.z = a - Math.PI / 2; sp.castShadow = true; wheel.add(sp);
    const k = new THREE.Mesh(knobG, bright); k.position.set(Math.cos(a) * len, Math.sin(a) * len, 0.08); k.castShadow = true; wheel.add(k);
  }
  // the four bolts at the edge (they slide out when it opens)
  const bolts = [];
  const boltG = new THREE.BoxGeometry(0.2, 0.07, 0.06);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = new THREE.Mesh(boltG, bright); b.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0.14); b.rotation.z = a; b.castShadow = true;
    b.userData.a = a; door.add(b); bolts.push(b);
  }
  // a handle on the right and hinges on the left
  const hcurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.82, 0.22, 0.1), new THREE.Vector3(0.95, 0.2, 0.22), new THREE.Vector3(1.05, 0, 0.24), new THREE.Vector3(0.95, -0.2, 0.22), new THREE.Vector3(0.82, -0.22, 0.1)]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hcurve, 40, 0.032, 10), bright); handle.castShadow = true; door.add(handle);
  for (const y of [-0.42, 0.42]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 20), m); h.position.set(-0.98, y, 0.0); h.castShadow = true; door.add(h);
  }
  let shells = null;
  if (moss) {
    shells = mossShells(slabG, {
      layers: 14, thick: 0.05, density: [60, 60], fill: 0.7, ...MOSS,
      mossA: '#22260a', mossB: '#646c14', tip: '#a6a845',
    });
    door.add(shells);
  }
  return { group, door, wheel, bolts, material: m, bright, shells };
}

// ─────────────────────────── a chain link, a laptop ───────────────────────────
export function chainLinkGeometry({ len = 1.0, r = 0.42, tube = 0.13 } = {}) {
  // a stadium path, swept with a circle
  const pts = [];
  const N = 96;
  const straight = len - 2 * r;
  const per = 2 * straight + 2 * Math.PI * r;
  for (let i = 0; i < N; i++) {
    const s = (i / N) * per;
    let p;
    if (s < straight) p = new THREE.Vector3(-straight / 2 + s, r, 0);
    else if (s < straight + Math.PI * r) { const a = (s - straight) / r; p = new THREE.Vector3(straight / 2 + Math.sin(a) * r, Math.cos(a) * r, 0); }
    else if (s < 2 * straight + Math.PI * r) { const k = s - straight - Math.PI * r; p = new THREE.Vector3(straight / 2 - k, -r, 0); }
    else { const a = (s - 2 * straight - Math.PI * r) / r; p = new THREE.Vector3(-straight / 2 - Math.sin(a) * r, -Math.cos(a) * r, 0); }
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.TubeGeometry(curve, 160, tube, 20, true);
  displace(g, (x, y, z) => fbmJS(noise3, x * 5, y * 5, z * 5, 3) * 0.012);
  return g;
}

export function laptopScreenTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas: c, ctx: c.getContext('2d'), tex };
}
