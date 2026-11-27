// The rider, in one fragment shader: a full-face helmet and the shoulders under it, modelled as signed distance
// fields and raymarched. Nothing here is a picture: the shell, the visor on its hinge, the chin vent, the top scoops,
// the rear spoiler, the brake light, the mark on the side and the jacket's folds are all maths, so the camera can go
// round it, the visor can open and the paint can change.
//
// Helmet space: +x forward (out of the visor), +y up, +z to the rider's right. One unit is about 10 cm.
// World space: +y up, the camera starts on +z and the rider has his back to it, head turned to his left.
//
// Pass 1 (SCENE) draws the rider, tone-mapped, into a texture whose alpha is coverage. Pass 2 (POST) puts it on the
// page: the photograph's ghosting, the brake light's anamorphic streak, grain, a vignette, and an ASCII mode that
// the intro develops the picture out of.

export const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const SCENE = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uRes;        // target size, px
uniform vec2 uOrigin;     // where design (0,0) is in target px (from the top left)
uniform float uScale;     // target px per design px
uniform vec2 uPP;         // principal point, design px
uniform float uFocal;     // focal length, design px
uniform vec3 uCamPos;
uniform mat3 uCam;        // columns: right, up, forward
uniform mat3 uHeadInv;    // world → helmet
uniform vec3 uHeadPos;
uniform float uVisor;     // 0 shut … 1 open
uniform vec3 uPaint;      // shell colour (linear)
uniform vec3 uPaint2;     // the colour the scan is laying on
uniform float uScanY;     // design px: above it uPaint2, below uPaint; < -1e4 when idle
uniform float uBody;      // 1 with the rider's shoulders, 0 the helmet alone
uniform float uBodyDrop;  // how far the shoulders have sunk away (the helmet lifting off, between sections)
uniform vec3 uBg;         // background (linear)
uniform float uBgA;       // background alpha
uniform float uLed;       // brake light, 0 … 1+
uniform vec3 uKey;        // direction to the key light (world)
uniform float uRim;       // the yellow rim from behind
uniform float uQuality;   // 1 full, 0 fast

#define PI 3.14159265

float sdEllipsoid(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p, b - r) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float rbox2(vec2 q, float r){ return length(max(q + r, 0.0)) + min(max(q.x, q.y) + r, 0.0) - r; }

float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// ---------------------------------------------------------------- the helmet
// Three heights split the shell: above the brow line a glossy dome; under it the side panel, set in a little so the
// dome's edge overhangs it; under a line that climbs toward the back, the dark lower shell, set in again.
// (Fitted to the shot in profile: 1 unit ≈ 151 design px.)
float yBrow(vec3 p){ return 0.53 - 0.072 * p.x; }
float yLow(vec3 p){ return -0.84 - 0.52 * p.x; }
float yRim(vec3 p){ return -1.19 - 0.264 * p.x; }

// The eye port's outline as a 2D distance in profile: a wedge, tall at the front, its bottom edge sloping to the chin.
float portMask(vec3 p){
  float top = yBrow(p) - 0.03;
  float bot = -0.08 - 0.46 * p.x;
  float xr = -0.13 + 0.21 * (0.44 - p.y);
  vec2 q = vec2(xr - p.x, max(bot - p.y, p.y - top));
  return rbox2(q, 0.06);
}

// The shell's outline before it is split and cut.
float shellOuter(vec3 p){
  float d = sdEllipsoid(p - vec3(-0.15, 0.0, 0.0), vec3(1.55, 1.35, 1.24));
  d = smin(d, sdEllipsoid(p - vec3(0.55, -0.70, 0.0), vec3(1.10, 0.98, 1.04)), 0.45);
  d = smin(d, sdEllipsoid(p - vec3(-0.75, -0.30, 0.0), vec3(0.95, 0.80, 1.10)), 0.36);
  d = smax(d, abs(p.z) - 1.16, 0.32);                                                 // flat sides
  d = smax(d, dot(p, normalize(vec3(1.0, 0.06, 0.0))) - 1.52, 0.05);                 // the chin bar's face
  d = smax(d, dot(p, normalize(vec3(0.25, -1.0, 0.0))) - 1.72, 0.07);                // under the chin
  d = smax(d, dot(vec2(abs(p.z), p.x), normalize(vec2(1.0, 0.9))) - 1.72, 0.07);     // the chin's corners
  d = smax(d, yRim(p) - p.y, 0.05);                                                   // the rim
  return d;
}

float visorSd(vec3 p){
  vec3 v = p - vec3(-0.05, 0.3, 0.0);
  v.xy = rot(-uVisor * 1.05) * v.xy;
  v += vec3(-0.05, 0.3, 0.0);
  float S = shellOuter(v);
  float m = portMask(v) - 0.05;
  m = max(m, v.y - yBrow(v) + 0.008);                       // tucked under the brow
  return max(abs(S + 0.022) - 0.017, m);
}

float helmet(vec3 p, out float mat){
  mat = 1.0;
  float S = shellOuter(p);
  float yb = yBrow(p), yl = yLow(p);
  float dome = max(S, yb - p.y);
  float side = max(S + 0.065, max(p.y - yb, yl - p.y));
  float low = max(S + 0.085, p.y - yl);
  // the spoiler: a wedge rooted in the dome, its tail standing off the back
  vec3 sp = p - vec3(-1.2, 0.98, 0.0); sp.xy = rot(-0.5) * sp.xy;
  sp.z *= 1.0 + 0.5 * clamp(-sp.x / 0.6, 0.0, 1.0);          // narrower toward the tail
  float wing = sdEllipsoid(sp, vec3(0.66, 0.15, 0.46));
  wing = smax(wing, -sp.y - 0.05, 0.03);                      // a flat underside
  dome = smin(dome, wing, 0.16);
  float d = min(dome, min(side, low));
  // eye port: the outer 0.22 cut away inside the outline
  float m = portMask(p);
  d = max(d, -max(m, -(S + 0.22)));
  // neck opening
  d = smax(d, -sdEllipsoid(p - vec3(0.05, -1.25, 0.0), vec3(0.85, 0.42, 0.72)), 0.06);
  // chin vent: a grille in the chin bar's face
  d = smax(d, -sdRBox(p - vec3(1.53, -1.12, 0.0), vec3(0.1, 0.2, 0.26), 0.04), 0.02);
  // exhaust under the spoiler's tail
  d = smax(d, -sdRBox(p - vec3(-1.62, 0.5, 0.0), vec3(0.2, 0.045, 0.3), 0.03), 0.02);
  float led = sdCapsule(p, vec3(-1.62, 0.36, -0.26), vec3(-1.62, 0.36, 0.26), 0.03);
  float vis = visorSd(p);
  float r = min(min(d, led), vis);
  if (r == vis) mat = 2.0;
  else if (r == led) mat = 6.0;
  else {
    if (S < -0.12 && m < 0.01) mat = 4.0;                   // inside the eye port: the lining
    else if (p.y < yl + 0.004) mat = 3.0;                   // dark lower shell
    else if (p.y < yRim(p) + 0.06) mat = 3.0;               // the rim
    else if (S < -0.02 && p.x > 1.3 && p.y < -0.85) mat = 3.0; // the grille
    else if (S < -0.02 && p.x < -1.35 && p.y > 0.42 && p.y < 0.6) mat = 4.0; // exhaust
  }
  return r;
}

float helmetD(vec3 p){
  float b = length(p - vec3(-0.05, 0.0, 0.0)) - 2.1;
  if (b > 0.25) return b;
  float m; return helmet(p, m);
}

// ---------------------------------------------------------------- the rider (world space, helmet centre at 0)
float body(vec3 p){
  p.y += uBodyDrop;
  float b = sdBox(p - vec3(0.25, -4.9, -0.3), vec3(3.0, 3.8, 1.9));
  if (b > 0.3) return b;
  // the neck sits behind the helmet's centre (his head is turned to his left, so behind is to our right)
  float neck = sdCapsule(p, vec3(0.3, -0.7, -0.22), vec3(0.33, -2.3, -0.3), 0.41);
  float torso = sdEllipsoid(p - vec3(0.35, -5.1, -0.32), vec3(1.65, 2.9, 1.08));
  float sh = sdCapsule(p, vec3(-0.85, -2.95, -0.32), vec3(1.4, -2.75, -0.32), 0.62);
  // the slope from the collar out to each shoulder
  float trL = sdCapsule(p, vec3(0.25, -2.35, -0.38), vec3(-0.75, -2.95, -0.34), 0.4);
  float trR = sdCapsule(p, vec3(0.45, -2.35, -0.38), vec3(1.3, -2.75, -0.34), 0.4);
  float d = smin(torso, sh, 0.8);
  d = smin(d, min(trL, trR), 0.45);
  float armL = sdCapsule(p, vec3(-1.05, -3.2, -0.2), vec3(-1.35, -6.4, 0.15), 0.58);
  float armR = sdCapsule(p, vec3(1.6, -3.0, -0.2), vec3(1.85, -6.4, 0.15), 0.6);
  d = smin(d, min(armL, armR), 0.26);
  // the jacket's high collar hugs the neck and flows down into the shoulders
  d = smin(d, neck, 0.42);
  // folds: broad soft ridges stretched along the cloth
  float w = smoothstep(-2.0, -2.8, p.y);
  vec3 q = vec3(p.x * 0.7 + p.y * 0.3, p.y * 0.3, p.z * 0.7) * 1.25;
  float n = vnoise(q + 3.1);
  n = n * n * (3.0 - 2.0 * n);
  float n2 = vnoise(p * vec3(0.55, 0.35, 0.55) + 11.0);
  d -= (0.07 * n + 0.05 * n2) * w;
  return d;
}

float map(vec3 p){
  float h = helmetD(uHeadInv * (p - uHeadPos));
  if (uBody > 0.5 && uBodyDrop < 9.0) h = min(h, body(p));
  return h;
}

// Soft creases for the jacket: folds that run down and in from the shoulders, broken up by noise.
float creases(vec3 p){
  float n = vnoise(p * vec3(1.1, 0.5, 1.1) + 2.0);
  float a = sin(p.x * 2.2 + p.y * 1.1 + n * 2.6) * 0.5 + 0.5;
  float b = sin(p.x * -1.7 + p.y * 1.6 + n * 2.0 + 1.3) * 0.5 + 0.5;
  return a * a * 0.55 + b * b * 0.45 + vnoise(p * 2.0 + 5.0) * 0.2;
}

vec3 calcNormal(vec3 p, float t){
  vec2 e = vec2(1.0, -1.0) * 0.0009 * max(1.0, t * 0.12);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

float softShadow(vec3 ro, vec3 rd, float k){
  float res = 1.0; float t = 0.03;
  float n = uQuality > 0.5 ? 64.0 : 22.0;
  for (int i = 0; i < 64; i++){
    if (float(i) > n) break;
    float h = helmetD(uHeadInv * (ro + rd * t - uHeadPos));
    res = min(res, k * h / t);
    t += clamp(h, 0.015, uQuality > 0.5 ? 0.18 : 0.45);
    if (res < 0.002 || t > 7.0) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float calcAO(vec3 p, vec3 n){
  float occ = 0.0; float sca = 1.0;
  for (int i = 0; i < 5; i++){
    float h = 0.02 + 0.14 * float(i);
    occ += (h - map(p + n * h)) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.6 * occ, 0.0, 1.0);
}

// The studio: black, one big softbox up front-left, a long strip behind to the right (warm yellow), a faint top.
float softbox(vec3 r, vec3 c, vec2 size, float soft){
  vec3 cz = normalize(c); vec3 cx = normalize(cross(vec3(0.0, 1.0, 0.0), cz)); vec3 cy = cross(cz, cx);
  float k = dot(r, cz); if (k <= 0.0) return 0.0;
  vec2 uv = vec2(dot(r, cx), dot(r, cy)) / k;
  vec2 q = abs(uv) - size;
  float dd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return 1.0 - smoothstep(-soft, soft, dd);
}
vec3 env(vec3 r){
  vec3 c = vec3(0.004);
  c += vec3(3.2) * softbox(r, vec3(-0.55, 0.7, 0.5), vec2(0.75, 0.45), 0.18);
  c += vec3(1.4) * softbox(r, vec3(0.1, 1.0, 0.05), vec2(0.6, 0.35), 0.3);
  c += vec3(2.6, 2.0, 0.25) * uRim * softbox(r, vec3(0.9, 0.12, -0.55), vec2(0.12, 0.9), 0.08);
  c += vec3(0.5) * softbox(r, vec3(0.6, 0.3, 0.9), vec2(0.4, 0.5), 0.3);
  c += vec3(0.02) * smoothstep(0.0, -0.6, r.y);
  return c;
}

vec3 shade(vec3 p, vec3 rd, float t, out float isHit){
  isHit = 1.0;
  vec3 n = calcNormal(p, t);
  vec3 hp = uHeadInv * (p - uHeadPos);
  float mat;
  float dh = helmet(hp, mat);
  bool onBody = uBody > 0.5 && uBodyDrop < 9.0 && body(p) < dh;
  if (onBody){
    mat = 7.0;
    // fine creases, in the light only: a bumped normal from a field of soft folds
    vec3 e = vec3(0.012, 0.0, 0.0);
    float f0 = creases(p);
    vec3 g = vec3(creases(p + e.xyy), creases(p + e.yxy), creases(p + e.yyx)) - f0;
    n = normalize(n - g / e.x * 0.06);
  }
  vec3 hn = uHeadInv * n;                     // normal in helmet space

  vec3 key = normalize(uKey);
  vec3 rimL = normalize(vec3(0.85, 0.35, -0.6));
  float sh = softShadow(p + n * 0.01, key, 6.0);
  float ao = calcAO(p, n);
  vec3 v = -rd;
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 5.0);
  vec3 ref = reflect(rd, n);
  vec3 rimCol = vec3(1.0, 0.78, 0.12) * uRim;

  float dif = clamp(dot(n, key), 0.0, 1.0);
  float wrap = clamp((dot(n, key) + 0.35) / 1.35, 0.0, 1.0);
  float rim = pow(clamp(dot(n, rimL), 0.0, 1.0), 2.0) * pow(1.0 - ndv, 1.5);
  float amb = 0.5 + 0.5 * n.y;

  vec3 col;
  if (mat < 1.5){                              // painted shell, clear-coated
    vec3 alb = uPaint;
    float scan = 0.0;
    if (uScanY > -1e4){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
      float dy = (px.y - uOrigin.y) / uScale;
      alb = mix(uPaint2, uPaint, smoothstep(uScanY - 2.0, uScanY + 2.0, dy));
      scan = exp(-pow((dy - uScanY) / 2.5, 2.0));
    }
    float side = smoothstep(0.55, 0.8, abs(hn.z));
    float fw = 0.0035 * t + 0.002;
    // the mark on the side: three slanted bars, joined at the front like a 3
    vec2 sd = vec2(hp.x + 0.98, hp.y - 0.31);
    sd.x += sd.y * 0.75;
    float bars = 1e3;
    for (int i = 0; i < 3; i++){
      float y0 = 0.15 - 0.15 * float(i);
      bars = min(bars, rbox2(abs(sd - vec2(0.0, y0)) - vec2(0.27, 0.042), 0.008));
    }
    bars = min(bars, rbox2(abs(sd - vec2(-0.24, 0.0)) - vec2(0.05, 0.19), 0.008));
        float mark = (1.0 - smoothstep(-fw, fw, bars)) * side * step(hp.y, yBrow(hp) - 0.04);
    alb = mix(alb, vec3(0.03), mark);
    // a panel line from the bottom of the visor down to the chin
    float ln = dot(hp - vec3(-0.02, -0.08, 0.0), normalize(vec3(1.07, 0.32, 0.0)));
    float crease = (1.0 - smoothstep(0.0, fw * 1.5, abs(ln))) * step(hp.y, -0.1) * side;
    float cav = smoothstep(0.8, 0.3, ao);
    vec3 diff = alb * (vec3(1.05, 1.03, 1.0) * wrap * (0.2 + 0.8 * sh) * 1.2 + amb * 0.2 * ao + rimCol * rim * 1.6);
    vec3 spec = env(ref) * mix(0.05, 1.0, fres) * (0.3 + 0.7 * ao) * mix(1.0, 0.4, mark);
    spec += vec3(1.0) * pow(clamp(dot(ref, key), 0.0, 1.0), 80.0) * 1.6 * sh;
    col = diff + spec;
    col *= 1.0 - 0.7 * crease;
    col *= 1.0 - 0.35 * cav;
    col += vec3(1.0, 0.92, 0.35) * scan * 1.6;
  } else if (mat < 2.5){                       // the visor: smoked, mirror-dark
    float inner = 0.006 + 0.014 * smoothstep(-0.4, 0.3, hp.y);
    vec3 spec = env(ref) * mix(0.035, 0.9, fres) * 0.8;
    spec += vec3(1.0) * pow(clamp(dot(ref, key), 0.0, 1.0), 220.0) * 4.0 * sh;
    col = vec3(inner) * ao + spec + rimCol * rim * 0.5;
  } else if (mat < 3.5){                       // dark lower shell, trim: glossy black
    col = vec3(0.022) * (wrap + 0.25) * ao + env(ref) * mix(0.03, 0.7, fres) * 0.7 * ao + rimCol * rim * 0.35;
  } else if (mat < 4.5){                       // the lining inside the port: quilted, almost black
    float quilt = 0.5 + 0.5 * sin(hp.y * 38.0) * sin(atan(hp.z, hp.x) * 30.0);
    col = vec3(0.012 + 0.012 * quilt) * (0.4 + 0.6 * wrap) * ao + rimCol * rim * 0.15;
  } else if (mat < 6.5){                       // brake light
    col = vec3(3.0, 2.3, 0.35) * (0.25 + uLed);
  } else if (mat < 7.5){                       // jacket (and the dark neck under the helmet)
    p.y += uBodyDrop;
    vec3 alb = vec3(0.2, 0.2, 0.196);
    float fw = 0.004 * t + 0.008;
    // raglan seams from the collar down to the armpits
    float yy = clamp(-1.95 - p.y, 0.0, 1.6);
    float xl = -0.1 - 0.9 * pow(yy, 1.6);
    float xr = 0.75 + 0.8 * pow(yy, 1.6);
    float s1 = min(abs(p.x - xl), abs(p.x - xr));
    float seam = (1.0 - smoothstep(0.0, fw, s1)) * step(p.y, -1.95) * step(-3.3, p.y) * smoothstep(-0.1, 0.5, n.z);
    float sheen = pow(1.0 - ndv, 2.5);
    float fall = mix(0.12, 1.0, smoothstep(-6.8, -2.6, p.y)) * mix(1.0, 0.45, smoothstep(0.7, 2.1, p.x));
    col = alb * (wrap * (0.12 + 0.88 * sh) * 1.2 + amb * 0.1) * ao;
    col += vec3(0.04) * sheen * ao + rimCol * rim * 0.9 * alb;
    col *= fall;
    col *= 1.0 - 0.35 * seam;
    // above the collar's edge, the dark balaclava; the edge itself catches a line of light
    float edge = p.y + 1.46 + 0.05 * (p.x - 0.3);
    col *= mix(1.0, 0.1, smoothstep(-0.01, 0.02, edge));
    col += vec3(0.05) * exp(-pow(edge / 0.02, 2.0)) * wrap;
  } else {                                     // hinge plate: dark plastic
    col = vec3(0.03) * (wrap + 0.3) * ao + env(ref) * mix(0.04, 0.6, fres);
  }
  return col;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = (px - uOrigin) / uScale;
  vec3 rd = normalize(uCam * vec3(d.x - uPP.x, uPP.y - d.y, uFocal));
  vec3 ro = uCamPos;

  // where the rays can hit at all: a sphere round the helmet, and one round the shoulders
  float tmin = 1e9, tmax = -1.0;
  vec3 cs[2]; float rs[2];
  cs[0] = uHeadPos; rs[0] = 2.4;
  cs[1] = vec3(0.3, -4.4 - uBodyDrop, -0.2); rs[1] = uBody > 0.5 && uBodyDrop < 9.0 ? 4.7 : 0.0;
  for (int i = 0; i < 2; i++){
    vec3 oc = ro - cs[i]; float b = dot(oc, rd); float c = dot(oc, oc) - rs[i] * rs[i]; float h = b * b - c;
    if (h > 0.0 && rs[i] > 0.0){ h = sqrt(h); tmin = min(tmin, -b - h); tmax = max(tmax, -b + h); }
  }
  vec3 col = uBg; float alpha = uBgA;
  if (tmax > 0.0){
    float t = max(tmin, 0.01);
    bool hit = false;
    for (int i = 0; i < 160; i++){
      vec3 p = ro + rd * t;
      float h = map(p);
      if (h < 0.0007 * t){ hit = true; break; }
      t += h * 0.82;
      if (t > tmax) break;
    }
    if (hit){
      float isHit;
      col = shade(ro + rd * t, rd, t, isHit);
      alpha = 1.0;
    }
  }
  // filmic tone map, then gamma
  if (alpha > 0.99 || uBgA < 0.5){
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  }
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  fragColor = vec4(col, alpha);
}`;

export const POST = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uGlyphs;  // a row of glyphs, darkest to brightest
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uLed;          // brake light on screen: x, y (px from the bottom left), visibility
uniform float uFlare;       // its brightness
uniform float uGhost;       // the photograph's ghosting, 0 … 1
uniform float uSmear;       // extra motion smear while turning (signed px)
uniform float uGrain;
uniform float uAscii;       // 0 the picture … 1 type
uniform float uSweep;       // where the type gives way to the picture, 0 (top) … 1 (bottom)
uniform float uCell;        // ASCII cell, px
uniform float uGlyphN;
uniform float uFade;        // overall exposure, for the intro
uniform vec4 uLens;         // x, y (px from the bottom left), radius px, strength — type under the pointer

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 ascii(vec2 fc){
  vec2 cell = floor(fc / uCell);
  vec2 cuv = (cell + 0.5) * uCell / uRes;
  vec4 s = texture(uScene, cuv);
  float l = dot(s.rgb, vec3(0.299, 0.587, 0.114));
  float gi = floor(clamp(l * 1.15, 0.0, 0.999) * uGlyphN);
  vec2 inCell = fract(fc / uCell);
  vec2 guv = vec2((gi + inCell.x) / uGlyphN, 1.0 - inCell.y);
  float g = texture(uGlyphs, guv).r;
  vec3 tint = mix(vec3(0.85), s.rgb * 1.2 + 0.05, 0.5);
  return tint * g * (0.35 + 0.9 * l);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  vec4 s = texture(uScene, uv);
  vec3 c = s.rgb;

  // ghosting: faint copies trailing to the left, as in the photograph; more while the rider turns
  vec3 g = vec3(0.0);
  float px = 1.0 / uRes.x;
  for (int i = 1; i <= 6; i++){
    float fi = float(i);
    vec2 o = vec2((fi * 7.0 * uGhost + fi * uSmear) * px * (uRes.x / 1440.0), 0.0);
    g += texture(uScene, uv + o).rgb * (0.16 / fi);
  }
  float lum = dot(c, vec3(0.333));
  c += g * (1.0 - smoothstep(0.02, 0.22, lum)) * 0.42 * uGhost;
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);            // a little more bite, as the photograph has
  c = mix(c, (c + g) / 1.37, clamp(abs(uSmear) * 0.04, 0.0, 0.6));

  // the brake light's anamorphic streak and the haze it throws into the dark
  vec2 d = (fc - uLed.xy) / uRes.y;
  float streak = exp(-abs(d.y) * 160.0) * exp(-abs(d.x) * 2.6);
  float core = exp(-dot(d * vec2(14.0, 50.0), d * vec2(14.0, 50.0)));
  float haze = exp(-length(d * vec2(0.9, 2.6)) * 3.2);
  float side = mix(0.35, 1.0, smoothstep(-0.02, 0.06, d.x));
  vec3 yel = vec3(1.0, 0.86, 0.16);
  c += uLed.z * uFlare * yel * (streak * 0.9 * side + core * 1.2 + haze * 0.3 * side) * (1.0 - 0.4 * s.a * (1.0 - core));

  // type: the intro's ASCII, and a lens of it under the pointer
  float a = uAscii;
  float sweep = smoothstep(uSweep - 0.06, uSweep + 0.06, 1.0 - uv.y);
  a = max(a * sweep, 0.0);
  if (uLens.w > 0.0){
    float ld = length(fc - uLens.xy) / uLens.z;
    a = max(a, uLens.w * (1.0 - smoothstep(0.75, 1.0, ld)));
  }
  if (a > 0.001){
    vec3 t = ascii(fc);
    // a bright line where the picture develops
    float edge = exp(-pow((1.0 - uv.y - uSweep) * 60.0, 2.0)) * step(0.001, uAscii) * step(uSweep, 0.999);
    c = mix(c, t, a) + vec3(1.0, 0.9, 0.3) * edge * 0.25 * s.a;
  }

  // vignette, grain
  vec2 q = uv - vec2(0.5, 0.42);
  c *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length(q * vec2(1.0, 1.25)));
  float gr = hash(fc + fract(uTime * 7.31) * 113.0) - 0.5;
  c += gr * uGrain * (0.25 + 0.75 * (1.0 - lum));
  c *= uFade;
  fragColor = vec4(c, 1.0);
}`;
