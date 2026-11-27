// The stage: the rider in one fixed WebGL canvas behind the hero and the anatomy, and the director that decides where
// the camera is. In the hero the camera sits where the shot has it; the arrows, the two views, the corner cameras and
// a drag go round him; the pointer turns his head a little; a click in the frame opens the visor; a paint is laid on
// by a scan line. Scrolling on, his shoulders sink away and the helmet comes forward for the anatomy, turning to
// each part as it is read. The same renderer makes every still on the page: the views, the paints, the corner
// cameras, the cart's pictures and the Vault's turntables.

import { calm, fine, on, emit, pointer, damp, clamp, lerp, root, ready } from './core.js';
import { Rider } from './gl/rider.js';

export const PAINTS = {
  dust: { name: 'Dust', hex: '#e9e8e4' },
  sage: { name: 'Sage', hex: '#a6b09b' },
  haze: { name: 'Haze', hex: '#c2c6e0' },
  ash: { name: 'Ash', hex: '#47484a' },
  volt: { name: 'Volt', hex: '#e6d52c' },
};
export const VIEWS = { front: -82, profile: 0, rear: 100 };
const HERO = { az: 0, el: 7, dist: 13.2, focal: 1925, pp: [732, 352], yaw: 187, pitch: 0 };
// The anatomy: one pose per part, read in order. The helmet sits to the right of the text (on a phone, above it).
const ANAT = [
  { az: -42, el: 24, dist: 10.6, yaw: 187, pitch: 0, visor: 0, led: 0.45 },
  { az: -74, el: 5, dist: 9.8, yaw: 187, pitch: 0, visor: 1, led: 0.35 },
  { az: 38, el: 22, dist: 10.6, yaw: 187, pitch: 0, visor: 0, led: 0.7 },
  { az: 104, el: 9, dist: 10.4, yaw: 187, pitch: 0, visor: 0, led: 1.7 },
];
const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;

export async function init() {
  const host = document.querySelector('.stagebg');
  const canvas = host?.querySelector('canvas');
  const poster = host?.querySelector('.stagebg__poster');
  const hero = document.querySelector('.hero');
  const anatomy = document.querySelector('.anatomy');
  const viewer = document.querySelector('[data-viewer]');
  const frameEl = document.querySelector('[data-frame]');
  if (!canvas || !hero) return null;

  let rider = null;
  try {
    rider = new Rider(canvas, { onLost: () => { root.classList.remove('has-gl'); rider = null; } });
    await rider.ready;
  } catch (e) {
    console.warn('[vizen] no WebGL rider, the picture stays:', e.message);
    rider = null;
  }

  // ---------------------------------------------------------------- layout: design px → screen
  const map = { W: 0, H: 0, u: 1, ox: 0, oy: 0, mobile: false, dpr: 1 };
  function layout() {
    const W = innerWidth, H = innerHeight;
    const mobile = W <= 820 || W / H <= 1;
    let u, ox, oy;
    if (!mobile) { u = Math.min(W / 1440, H / 960); ox = W / 2 - 720 * u; oy = 0; }
    else { u = Math.min(W / 690, H / 760); ox = W / 2 - HERO.pp[0] * u; oy = Math.min(60 + 0.33 * W, H * 0.46) - HERO.pp[1] * u; }
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 2 : 1.5);
    Object.assign(map, { W, H, u, ox, oy, mobile, dpr });
    if (poster) Object.assign(poster.style, { left: `${ox}px`, top: `${oy}px`, width: `${1440 * u}px`, height: `${960 * u}px`, translate: 'none' });
    if (rider) rider.resize(Math.round(W * dpr), Math.round(H * dpr), [ox * dpr, oy * dpr], u * dpr);
    readScroll();
    kick();
  }

  // ---------------------------------------------------------------- the director's inputs
  const st = {
    az: HERO.az, azT: HERO.az, azV: 0,        // orbit, degrees: now, target, velocity (deg/s)
    visor: 0, visorT: 0,
    px: 0, py: 0,                              // pointer parallax, smoothed, -1…1
    heroT: 0, anat: 0, anatOn: 0,              // scroll: how far the hero has gone, the anatomy's progress
    intro: { el: 0, dist: 0, led: 1 },        // the intro's dolly
    paint: 'dust', scan: null,                 // { from, to, t0 }
    flash: 0,                                  // brake light flash
    lastChange: 0, dragging: false,
  };

  function readScroll() {
    const y = scrollY;
    const h = hero.offsetHeight;
    st.heroT = clamp(y / Math.max(1, h * 0.9), 0, 1);
    if (anatomy) {
      const top = anatomy.offsetTop; const len = anatomy.offsetHeight - innerHeight;
      st.anat = clamp((y - top) / Math.max(1, len), 0, 1);
      st.anatOn = y > top + anatomy.offsetHeight ? 0 : 1;
    }
  }
  on('scroll', () => { readScroll(); kick(); });

  // ---------------------------------------------------------------- poses
  function anatPose(p) {
    const s = p * (ANAT.length - 1);
    const i = Math.min(ANAT.length - 2, Math.floor(s));
    const f = smooth(clamp((s - i - 0.2) / 0.6, 0, 1));
    const a = ANAT[i], b = ANAT[i + 1];
    const o = {};
    for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], f);
    // where it sits on screen: right of the text on a wide screen, above it on a phone
    const sx = map.mobile ? map.W * 0.5 : map.W * 0.66;
    const sy = map.mobile ? map.H * 0.47 : map.H * 0.52;
    o.pp = [(sx - map.ox) / map.u, (sy - map.oy) / map.u];
    o.focal = map.mobile ? HERO.focal * Math.min(0.62, (map.W / 390) * 0.62 * (map.H / 844) / map.u * 0.6) : HERO.focal * Math.min(1.05, (map.H / 960) / map.u);
    o.step = s;
    return o;
  }

  function compose() {
    const hT = smooth(st.heroT);
    const parX = st.px * (1 - hT), parY = st.py * (1 - hT);
    const heroPose = {
      az: st.az + parX * 2.5,
      el: HERO.el - parY * 2 + st.intro.el,
      dist: HERO.dist + st.intro.dist,
      focal: HERO.focal, pp: HERO.pp,
      yaw: HERO.yaw + parX * 6, pitch: -parY * 3,
      visor: st.visor, led: 0.6 * st.intro.led, bodyDrop: 0,
    };
    let pose = heroPose;
    if (hT > 0 && anatomy) {
      const a = anatPose(st.anat);
      const k = hT;
      // the orbit the visitor left the hero at blends into the first pose by the shortest way round
      const az0 = heroPose.az; const az1 = az0 + wrap(a.az - az0);
      pose = {
        az: lerp(az0, az1, k), el: lerp(heroPose.el, a.el, k), dist: lerp(heroPose.dist, a.dist, k),
        focal: lerp(heroPose.focal, a.focal, k), pp: [lerp(heroPose.pp[0], a.pp[0], k), lerp(heroPose.pp[1], a.pp[1], k)],
        yaw: lerp(heroPose.yaw, a.yaw, k), pitch: lerp(heroPose.pitch, a.pitch, k),
        visor: Math.max(heroPose.visor * (1 - k), a.visor * k), led: lerp(heroPose.led, a.led, k),
        bodyDrop: smooth(clamp(k * 1.25, 0, 1)) * 9.5,
      };
      emit('anatomy:pose', { step: a.step, p: st.anat });
    }
    return pose;
  }

  // ---------------------------------------------------------------- loop
  let raf = 0; let last = 0; let active = true; let visible = !document.hidden; let firstHQ = false;
  let sceneBusy = 0;
  function frame(now) {
    raf = 0;
    if (!rider || !active || !visible) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;

    // orbit: springs toward its target unless a drag holds it
    if (!st.dragging) {
      const prev = st.az;
      st.az = calm ? st.azT : damp(st.az, st.azT, 5.5, dt);
      const v = (st.az - prev) / dt;
      if (Math.abs(st.azV) > 40 && Math.abs(v) < Math.abs(st.azV) * 0.6) st.flash = Math.min(1.6, st.flash + 0.8); // braking
      st.azV = v;
    }
    st.flash = damp(st.flash, 0, 3.5, dt);
    st.visor = calm ? st.visorT : damp(st.visor, st.visorT, 6, dt);
    const tx = pointer.active && fine ? pointer.nx : 0; const ty = pointer.active && fine ? pointer.ny : 0;
    st.px = calm ? 0 : damp(st.px, tx, 2.4, dt); st.py = calm ? 0 : damp(st.py, ty, 2.4, dt);

    // a paint being scanned on, top to bottom over the helmet
    let paint = PAINTS[st.paint].hex, paint2 = paint, scanY = -1e5;
    if (st.scan) {
      const k = clamp((now - st.scan.t0) / 1100, 0, 1);
      paint = PAINTS[st.scan.from].hex; paint2 = PAINTS[st.scan.to].hex;
      scanY = lerp(120, 600, 1 - Math.pow(1 - k, 2.2));
      if (k >= 1) { st.scan = null; paint = paint2; scanY = -1e5; }
    }

    const pose = compose();
    rider.set({ ...pose, paint, paint2, scanY });
    const sceneChanged = rider.dirty;
    if (sceneChanged) st.lastChange = now;
    // the brake light breathes, and flashes when the orbit brakes: only the post pass, no new raymarch
    rider.post.flare = (0.88 + 0.12 * Math.sin(now / 1000 * 2.1)) * (calm ? 1 : 1) + st.flash;
    const moving = now - st.lastChange < 140 || st.dragging;
    rider.post.time = now / 1000;
    rider.post.smear = clamp(-st.azV * 0.05, -14, 14) * (calm ? 0 : 1);
    rider.post.grain = 0.045;
    const t0 = performance.now();
    rider.render({ moving });
    if (sceneChanged) {
      // adapt the moving resolution to what the machine can do
      sceneBusy = lerp(sceneBusy, performance.now() - t0, 0.2);
      if (moving) rider.quality = clamp(rider.quality * (sceneBusy > 14 ? 0.96 : sceneBusy < 6 ? 1.03 : 1), 0.55, 1.25);
    }
    if (!firstHQ && rider.hq) { firstHQ = true; root.classList.add('has-gl'); emit('stage:drawn'); }
    readout(pose);
    const busy = moving || st.scan || Math.abs(st.az - st.azT) > 0.01 || Math.abs(st.visor - st.visorT) > 0.001 || Math.abs(st.px - tx) > 0.001 || Math.abs(st.py - ty) > 0.001 || st.flash > 0.01;
    // still frames keep the light breathing and the grain alive, at a gentler rate
    if (busy) raf = requestAnimationFrame(frame);
    else if (!calm) { raf = -1; idle = setTimeout(() => { raf = requestAnimationFrame(frame); }, 40); }
  }
  let idle = 0;
  function kick() {
    if (!rider || !active || !visible) return;
    if (raf === -1) { clearTimeout(idle); raf = 0; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; kick(); });
  // only while the hero or the anatomy is on screen
  const seen = new Set();
  const io = new IntersectionObserver((es) => {
    for (const e of es) (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target));
    active = seen.size > 0; host.style.visibility = active ? '' : 'hidden';
    kick();
  }, { rootMargin: '10% 0px' });
  io.observe(hero); if (anatomy) io.observe(anatomy);
  on('pointer', kick);

  // ---------------------------------------------------------------- the viewer: drag, arrows, views, visor, reticle
  const reticle = viewer?.querySelector('.reticle');
  const readAz = viewer?.querySelector('[data-read-az]');
  const readVis = viewer?.querySelector('[data-read-vis]');
  function readout(pose) {
    if (!readAz) return;
    const a = Math.round(((wrap(pose.az) + 360) % 360));
    readAz.textContent = `AZ ${String(a).padStart(3, '0')}°`;
    readVis.textContent = st.visorT > 0.5 ? 'VISOR OPEN' : 'VISOR SHUT';
    syncViews();
  }
  const thumbs = [...document.querySelectorAll('.thumb')];
  const mark = document.querySelector('.thumb__mark');
  let lastView = '';
  function syncViews() {
    const a = wrap(st.azT);
    let on = '';
    for (const [k, v] of Object.entries(VIEWS)) if (Math.abs(wrap(a - v)) < 12) on = k;
    if (on === lastView) return; lastView = on;
    thumbs.forEach((b, i) => {
      const yes = b.dataset.view === on;
      b.setAttribute('aria-checked', String(yes));
      if (yes && mark) mark.style.setProperty('--mx', `${b.offsetLeft}px`);
    });
    mark?.classList.toggle('is-off', !thumbs.some((b) => b.dataset.view === on));
  }
  const goTo = (az) => { st.azT = st.az + wrap(az - st.az); viewer?.classList.add('is-moved'); kick(); };
  const turn = (d) => { st.azT = Math.round((st.azT + d * 45) / 45) * 45; viewer?.classList.add('is-moved'); kick(); };
  thumbs.forEach((b) => b.addEventListener('click', () => goTo(VIEWS[b.dataset.view])));
  // the radio group's arrow keys
  thumbs.forEach((b, i) => b.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return; e.preventDefault();
    const n = thumbs[(i + d + thumbs.length) % thumbs.length]; n.focus(); n.click();
  }));
  document.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => turn(Number(b.dataset.turn))));
  document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.cam === 'front' ? VIEWS.front : VIEWS.rear)));

  if (frameEl) {
    let down = null;
    frameEl.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      down = { x: e.clientX, y: e.clientY, t: e.timeStamp, az: st.az, moved: false, id: e.pointerId };
    });
    addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 5) { down.moved = true; st.dragging = true; frameEl.classList.add('is-drag'); frameEl.setPointerCapture?.(e.pointerId); }
      if (down.moved) {
        const az = down.az - dx * 0.4;
        const dtm = Math.max(1, e.timeStamp - (down.lt || down.t));
        st.azV = (az - st.az) / (dtm / 1000);
        st.az = st.azT = az; down.lt = e.timeStamp;
        viewer.classList.add('is-moved');
        kick();
      }
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (down.moved) {
        // let it run on, then settle on the nearest eighth
        const fling = clamp(st.azV, -900, 900) * 0.18;
        st.azT = Math.round((st.az + fling) / 45) * 45;
        st.dragging = false; frameEl.classList.remove('is-drag');
      } else if (e.type === 'pointerup') toggleVisor();
      down = null; kick();
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    frameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVisor(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
    });
    // the reticle follows the pointer inside the frame
    if (fine && reticle) {
      frameEl.addEventListener('pointerenter', () => viewer.classList.add('is-aim'));
      frameEl.addEventListener('pointerleave', () => { viewer.classList.remove('is-aim'); reticle.style.setProperty('--rx', '0px'); reticle.style.setProperty('--ry', '0px'); });
      frameEl.addEventListener('pointermove', (e) => {
        const r = frameEl.getBoundingClientRect();
        reticle.style.setProperty('--rx', `${(e.clientX - (r.left + r.width / 2)) * 0.35}px`);
        reticle.style.setProperty('--ry', `${(e.clientY - (r.top + r.height / 2)) * 0.35}px`);
      });
      reticle.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
  }
  function toggleVisor() { st.visorT = st.visorT > 0.5 ? 0 : 1; viewer?.classList.add('is-moved'); emit('visor', st.visorT); kick(); }

  // ---------------------------------------------------------------- paints
  function setPaint(name) {
    if (!PAINTS[name] || name === st.paint && !st.scan) return;
    const from = st.scan ? st.scan.to : st.paint;
    if (from === name) return;
    st.scan = calm ? null : { from, to: name, t0: performance.now() };
    st.paint = name;
    kick();
  }
  on('paint', setPaint);

  // ---------------------------------------------------------------- stills
  const cache = new Map();
  const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2)); };
  // A picture of the helmet alone: view in degrees of orbit, size in px.
  function helmetStill(paint, w, h, { az = -28, el = 10, fill = 0.78, yaw = HERO.yaw, visor = 0, ss = 2, bg = null } = {}) {
    if (!rider) return null;
    const key = [paint, w, h, az, el, fill, yaw, visor, bg].join('|');
    if (cache.has(key)) return cache.get(key);
    const dist = 13.2;
    const focal = (Math.min(w, h * 1.15) * fill * dist) / 3.4;
    const c = rider.still(w, h, { az, el, dist, focal, pp: [w / 2, h * 0.52], yaw, pitch: 0, visor, body: 0, bodyDrop: 0, led: 0.5, paint: PAINTS[paint].hex, paint2: PAINTS[paint].hex }, bg ? { bg: lin(bg), bgA: 1, ss } : { ss });
    cache.set(key, c);
    return c;
  }
  function riderStill(w, h, patch, bg = '#000000') {
    if (!rider) return null;
    return rider.still(w, h, { dist: 13.2, el: 5, pitch: 0, visor: 0, body: 1, bodyDrop: 0, led: 0.9, paint: PAINTS[st.paint].hex, ...patch }, { bg: lin(bg), bgA: 1, ss: 1.5 });
  }
  const paintInto = (cv, src) => { if (!cv || !src) return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(src, 0, 0, cv.width, cv.height); cv.classList.add('is-drawn'); };

  // The page's own pictures, a few per frame so the intro does not stutter.
  async function drawStills() {
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    for (const b of thumbs) {
      paintInto(b.querySelector('canvas'), helmetStill(st.paint, 128, 130, b.dataset.view === 'front' ? { az: -84, el: 9, fill: 0.62 } : { az: 0, el: 6, fill: 0.86 }));
      await nextFrame();
    }
    for (const b of document.querySelectorAll('.swatch')) {
      const cv = b.querySelector('canvas'); cv.width = 160; cv.height = 144;
      paintInto(cv, helmetStill(b.dataset.paint, 160, 144, { az: -30, el: 10, fill: 0.74 }));
      await nextFrame();
    }
    const camL = document.querySelector('.cam--l canvas'); const camR = document.querySelector('.cam--r canvas');
    if (camL) { paintInto(camL, riderStill(camL.width, camL.height, { az: 180, yaw: 90, el: 4, pp: [camL.width / 2, camL.height * 0.3], focal: camL.width * 2.55 })); await nextFrame(); }
    if (camR) { paintInto(camR, riderStill(camR.width, camR.height, { az: 90, yaw: 90, el: 4, pp: [camR.width * 0.56, camR.height * 0.3], focal: camR.width * 2.3 })); }
    emit('stills:drawn');
  }

  addEventListener('resize', () => { lastView = ''; mark?.style.removeProperty('--mx'); layout(); });
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', layout);
  layout();

  const stage = {
    rider, st, map, PAINTS, VIEWS, kick, setPaint, goTo, turn, toggleVisor, helmetStill, riderStill,
    get paint() { return st.paint; },
    // the 3D point (helmet space) → screen px, for the anatomy's leader lines
    toScreen(local) {
      if (!rider) return null;
      const s = rider.s;
      const D = Math.PI / 180;
      const c = Math.cos(s.yaw * D), sn = Math.sin(s.yaw * D);
      const p = [c * local[0] + sn * local[2], local[1], -sn * local[0] + c * local[2]];
      const [x, y, z] = rider.project(p);
      return { x: map.ox + x * map.u, y: map.oy + y * map.u, z };
    },
  };
  if (rider) {
    kick();
    ready.then(() => setTimeout(drawStills, 60));
  } else {
    root.classList.add('no-gl');
    fallbackStills(poster);
  }
  emit('stage', stage);
  return stage;
}

// Without WebGL: the views and the paints are cut from the picture of the hero, the paints tinted.
function fallbackStills(poster) {
  if (!poster) return;
  const go = () => {
    const crop = (cv, sx, sy, sw, sh, tint) => {
      const g = cv.getContext('2d');
      g.drawImage(poster, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      if (tint) { g.globalCompositeOperation = 'multiply'; g.fillStyle = tint; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(poster, sx, sy, sw, sh, 0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; }
    };
    document.querySelectorAll('.thumb canvas').forEach((cv) => crop(cv, 480, 120, 520, 520));
    document.querySelectorAll('.swatch').forEach((b) => crop(b.querySelector('canvas'), 480, 120, 540, 480, PAINTS[b.dataset.paint]?.hex));
  };
  if (poster.complete) go(); else poster.addEventListener('load', go, { once: true });
}
