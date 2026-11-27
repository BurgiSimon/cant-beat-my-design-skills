// The smaller 3D pictures: the garden behind the layer cards, the laptop on its mossy rock, the chain link in the
// sand. One renderer draws them all, off screen, and each picture is copied into its own canvas, so the page holds
// one extra WebGL context however many pictures it has. Each draws only while on screen.

import { calm, gl, dpr, on, last, whenVisible, loop, damp, clamp, seeded, fine } from './core.js';

// asked for as soon as this module is here (main.js fetches it after starting the hero, which loads the kit too), so
// that starting the build takes no turn of its own
const kit = gl ? import('./gl/kit.js') : null;
kit?.catch(() => {});   // (a failure is reported when init awaits it)

export async function init({ hurry: rush = false } = {}) {
  const hosts = [...document.querySelectorAll('canvas[data-scene]')];
  if (!hosts.length || !gl) return;
  const K = await kit;
  const { THREE, shared, noise3 } = K;
  const low = gl.tier < 2;
  // the build hands the main thread back between its slices, so frames and scrolling keep running. A timer, as in
  // hero3d, lets a frame in between; scheduler.yield's turn would come first and run slices back to back for 100 ms
  // and more. A turn of over a quarter second, or turns adding up to 1.5 s, mean frames that slow (a weak or software
  // GPU), where waiting only starves the build: the rest is built in one go, as without slices (all of it when main.js
  // says so)
  let hurry = rush, waited = 0;
  const late = (t0, ms = 0) => { const d = performance.now() - t0 - ms; waited += d; if (d > 250 || waited > 1500) hurry = true; };
  const breathe = async () => {
    if (hurry) return;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 0));
    late(t0);
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(1);
  const sky = () => K.skyEnvironment(renderer, { top: '#ffffff', horizon: '#dde8ec', bottom: '#5d6a45' });
  let env = sky();
  await breathe();
  let bufW = 0, bufH = 0;
  const Q = dpr(low ? 1.25 : 1.6);

  const lights = (scene, { sun = 3, hemi = 0.85, dir = [-0.55, 0.75, 0.45], size = 3 } = {}) => {
    scene.environment = env; scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight(0xf4f8fa, 0x5b6440, hemi));
    const s = new THREE.DirectionalLight(0xfff1de, sun);
    s.position.set(...dir).normalize().multiplyScalar(8);
    s.castShadow = true; s.shadow.mapSize.set(1024, 1024);
    Object.assign(s.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 20 });
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.02;
    scene.add(s);
    return s;
  };
  const rockMat = (o = {}) => K.surfaceMaterial({ key: 'rock2', c1: '#8a8475', c2: '#d2cab6', c3: '#5a5241', pore: 22, pit: 0.3, bump: 0.018, tone: 1.2, moss: 0.05, mossUp: 1.3, mossScale: 1.8, seed: [4, 2, 9], mossA: '#2a2e07', mossB: '#5f6a16', ...o });
  const addRock = (parent, { x, y, z, s, sx = 1.2, sy = 0.8, sz = 1, seed = 1, ry = 0, rx = 0, mat, moss = true }) => {
    const g = K.rockGeometry({ seed, sx, sy, sz, detail: (low ? 4 : 5) + (s > 0.6 ? 1 : 0), rough: 0.2 });   // big ones closer to the camera get more faces
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(rx, ry, 0);
    m.castShadow = true; m.receiveShadow = true; parent.add(m);
    if (moss) m.add(K.mossShells(g, { layers: low ? 8 : 12, thick: 0.06, density: [150, 150], fill: 0.7, moss: 0.05, mossUp: 1.3, mossScale: 1.8, seed: [4, 2, 9], mossA: '#22260a', mossB: '#5f6814', tip: '#a3a443' }));
    return m;
  };
  const bladeG = K.bladeGeometry({ segs: 5, w: 0.03, curl: 0.08, root: '#1d2104', mid: '#4a520e', tip: '#8d9038' });
  const leafG = K.bladeGeometry({ segs: 7, w: 0.05, curl: 0.2, root: '#273309', mid: '#4b6a1b', tip: '#8aa23a' });
  const grassMat = K.plantMaterial({ sway: 0.12, ao: 0.32, trans: 0.7 });
  const leafMat = K.plantMaterial({ sway: 0.1, ao: 0.4, trans: 0.8 });
  const wheatMat = K.plantMaterial({ sway: 0.1, ao: 0.55, trans: 0.9, kernels: 90 });
  const daisyMat = K.plantMaterial({ sway: 0.1, ao: 0.5, trans: 0.5 });
  const wheatG = K.wheatGeometry({ stemW: 0.007, headW: 0.05, head: 0.36 });
  const daisyG = K.daisyGeometry({ radius: 0.11, tilt: 0.7 });
  // a tuft of plants on a surface y(x, z)
  const tuft = (parent, rnd, { x0, x1, z0, z1, y, n = 600, h = [0.08, 0.2], wheat = 0, daisies = 0, leaves = 0 }) => {
    const at = (r) => { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); return { x, z, y: y(x, z) }; };
    parent.add(K.plantField(bladeG, grassMat, n, (i, r) => { const p = at(r); return p.y < -8 ? null : { ...p, y: p.y - 0.01, h: h[0] + r() * (h[1] - h[0]), w: 0.8 + r() * 0.6, bend: 0.15 + r() * 0.35, tint: [0.85 + r() * 0.3, 0.9 + r() * 0.2, 0.8 + r() * 0.25] }; }, rnd));
    if (leaves) parent.add(K.plantField(leafG, leafMat, leaves, (i, r) => { const p = at(r); return p.y < -8 ? null : { ...p, y: p.y - 0.02, h: 0.25 + r() * 0.35, w: 0.9 + r() * 0.5, bend: 0.4 + r() * 0.6 }; }, rnd));
    if (wheat) parent.add(K.plantField(wheatG, wheatMat, wheat, (i, r) => { const p = at(r); return p.y < -8 ? null : { ...p, y: p.y - 0.02, h: 0.45 + r() * 0.35, w: 1 + r() * 0.3, yaw: r() * Math.PI * 2, bend: 0.1 + r() * 0.35 }; }, rnd));
    if (daisies) parent.add(K.plantField(daisyG, daisyMat, daisies, (i, r) => { const p = at(r); return p.y < -8 ? null : { ...p, y: p.y - 0.02, h: 0.2 + r() * 0.2, w: 1 + r() * 0.3, yaw: (r() - 0.5) * 0.6, bend: 0.05 }; }, rnd));
  };
  const domeY = (cx, cy, cz, rx, ry, rz) => (x, z) => { const nx = (x - cx) / rx, nz = (z - cz) / rz; const q = 1 - nx * nx - nz * nz; return q <= 0 ? -9 : cy + ry * Math.sqrt(q); };

  const views = [];
  // a change that should show at once even when nothing is looping (reduced motion)
  let redraw = () => {};

  // ───────── the garden: a mossy outcrop against the sky, with a camera for each layer ─────────
  async function garden() {
    const rnd = seeded(77);
    const scene = new THREE.Scene(); lights(scene, { size: 3.5 });
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const root = new THREE.Group(); scene.add(root);
    const rm = rockMat();
    // the outcrop: a shelf of rocks up on the right, stepping down to the left
    const rocks = [
      { x: 0.9, y: 0.55, z: 0, s: 0.75, sx: 1.4, sy: 0.7, seed: 3, ry: 0.3 },
      { x: 0.2, y: 0.42, z: 0.25, s: 0.55, sx: 1.3, sy: 0.8, seed: 5, ry: -0.4 },
      { x: 1.55, y: 0.75, z: -0.3, s: 0.6, sx: 1.1, sy: 0.9, seed: 7, ry: 1.2 },
      { x: -0.45, y: 0.1, z: 0.35, s: 0.42, sx: 1.2, sy: 0.9, seed: 9, ry: 0.8 },
      { x: -0.95, y: -0.25, z: 0.3, s: 0.36, sx: 1.1, sy: 1.0, seed: 11, ry: 0.2 },
      { x: 0.55, y: 0.05, z: 0.55, s: 0.38, sx: 1.0, sy: 1.1, seed: 13, ry: 2.2 },
      { x: 1.3, y: 0.2, z: 0.4, s: 0.42, sx: 1.2, sy: 1.0, seed: 17, ry: 0.6 },
    ];
    for (const r of rocks) { addRock(root, { ...r, mat: rm }); await breathe(); }
    // a cap of turf over the shelf
    const cap = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI * 0.5);
    cap.scale(1.25, 0.3, 0.75);
    K.displace(cap, (x, y, z) => noise3(x * 2, y * 2, z * 2) * 0.05);
    const turfMat = K.surfaceMaterial({ key: 'turf', c1: '#3b4010', c2: '#555c17', c3: '#272b08', moss: 1.3, mossUp: 0, seed: [9, 1, 3], mossA: '#2c3108', mossB: '#5a6116', pit: 0.2 });
    const turf = new THREE.Mesh(cap, turfMat); turf.position.set(0.95, 0.82, -0.05); turf.receiveShadow = true; root.add(turf);
    turf.renderOrder = 1;   // after its shells: the moss covers it, so the depth test skips its stone shader there
    turf.add(K.mossShells(cap, { layers: low ? 8 : 12, thick: 0.05, density: [500, 140], fill: 0.85, moss: 1.3, mossUp: 0, seed: [9, 1, 3], mossA: '#1f2306', mossB: '#555d12', tip: '#929640' }));
    await breathe();
    const top = domeY(0.95, 0.82, -0.05, 1.25, 0.3, 0.75);
    tuft(root, rnd, { x0: -0.3, x1: 2.2, z0: -0.8, z1: 0.7, y: top, n: low ? 900 : 1800, h: [0.08, 0.22], wheat: 26, daisies: 14, leaves: 40 });
    // a lower ledge on the left
    const ledgeY = domeY(-0.55, 0.28, 0.35, 0.65, 0.18, 0.45);
    const ledgeG = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.5); ledgeG.scale(0.65, 0.18, 0.45);
    const ledge = new THREE.Mesh(ledgeG, turfMat); ledge.position.set(-0.55, 0.28, 0.35); root.add(ledge);
    tuft(root, rnd, { x0: -1.2, x1: 0.1, z0: 0, z1: 0.8, y: ledgeY, n: low ? 300 : 600, h: [0.07, 0.18], daisies: 6, leaves: 16 });
    // and the vault, set in the rock face, for "Data Protection"
    const v = K.vaultDoor({ moss: false });
    v.group.scale.setScalar(0.26); v.group.position.set(0.62, 0.22, 0.88); v.group.rotation.y = -0.35;
    root.add(v.group);
    // cameras: [position, target, fov] per layer
    const shots = [
      [[-1.1, -1.0, 5.6], [-0.05, 0.05, 0], 32],
      [[-2.0, -2.4, 4.6], [0.35, 0.6, -0.3], 36],
      [[0.3, 1.5, 2.6], [1.0, 0.95, -0.1], 28],
      [[-0.35, 0.3, 2.4], [0.6, 0.25, 0.8], 30],
    ];
    let shot = last('layer')?.index ?? 0;
    const cur = { p: new THREE.Vector3(...shots[shot][0]), t: new THREE.Vector3(...shots[shot][1]), f: shots[shot][2] };
    on('layer', ({ index }) => { shot = index; redraw(); });
    const tp = new THREE.Vector3(), tt = new THREE.Vector3();
    return {
      scene, camera,
      update(dt, t, aspect, hover) {
        const [p, tg, f] = shots[shot];
        tp.set(...p); tt.set(...tg);
        const k = calm || !dt ? 1 : 1 - Math.exp(-2.2 * dt);   // a still (dt 0) shows the layer's own view
        cur.p.lerp(tp, k); cur.t.lerp(tt, k); cur.f += (f - cur.f) * k;
        camera.position.copy(cur.p);
        camera.position.x += Math.sin(t * 0.25) * 0.06 + hover.x * 0.15; camera.position.y += hover.y * -0.1;
        camera.fov = cur.f; camera.aspect = aspect; camera.updateProjectionMatrix();
        camera.lookAt(cur.t);
        v.wheel.rotation.z = t * 0.35;
      },
    };
  }

  // ───────── the laptop on its mossy rock ─────────
  function laptop(canvas) {
    const rnd = seeded(31);
    const scene = new THREE.Scene(); lights(scene, { size: 2.2, dir: [-0.4, 0.8, 0.6] });
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    const root = new THREE.Group(); scene.add(root);
    const rm = rockMat({ c1: '#8a8576', c2: '#d4ccba' });
    addRock(root, { x: -0.75, y: -0.52, z: -0.75, s: 0.78, sx: 0.95, sy: 1.35, sz: 0.85, seed: 21, ry: 0.4, mat: rm });
    addRock(root, { x: 0.05, y: -0.7, z: 0.45, s: 0.62, sx: 1.4, sy: 0.75, seed: 23, ry: -0.6, mat: rm });
    addRock(root, { x: -1.0, y: -0.85, z: 0.3, s: 0.4, sx: 1.2, sy: 0.8, seed: 25, ry: 1.1, mat: rm });
    // the laptop, open on the flat rock
    const lap = new THREE.Group(); lap.position.set(-0.02, -0.16, 0.5); lap.rotation.set(-0.04, -0.32, 0.03); lap.scale.setScalar(0.92); root.add(lap);
    const alu = new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.8, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.3, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.68), alu); base.castShadow = true; base.receiveShadow = true; lap.add(base);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.3), new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.8 }));
    keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.021, -0.1); lap.add(keys);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.18), new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.6, roughness: 0.4 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.021, 0.18); lap.add(pad);
    const hinge = new THREE.Group(); hinge.position.set(0, 0.02, -0.33); lap.add(hinge);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.66, 0.025), alu); lid.position.set(0, 0.33, -0.012); lid.castShadow = true; hinge.add(lid);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 0.63), dark); bezel.position.set(0, 0.33, 0.0015); hinge.add(bezel);
    const scr = K.laptopScreenTexture();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.position.set(0, 0.335, 0.002); hinge.add(screen);
    hinge.rotation.x = -0.32;
    // grass round the foot and on the rock
    tuft(root, rnd, { x0: -1.6, x1: 1.6, z0: -0.2, z1: 1.3, y: (x, z) => -0.95 + noise3(x * 2, 0, z * 2) * 0.04, n: low ? 700 : 1400, h: [0.1, 0.3], leaves: 34, daisies: 10, wheat: 8 });
    // screen content per tab
    let tab = last('tab')?.key ?? 'live'; let st = calm ? 1 : 0;
    on('tab', ({ key }) => { tab = key; st = calm ? 1 : 0; paint(st); redraw(); });
    const { ctx: g, canvas: cv, tex } = scr;
    function paint(t) {
      const W = cv.width, H = cv.height;
      if (tab === 'live') {
        const gr = g.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.5, W * 0.7);
        gr.addColorStop(0, '#e1262b'); gr.addColorStop(1, '#7c0d12'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.fillStyle = '#fff'; g.font = `${H * 0.5}px Anton, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.translate(W / 2, H * 0.52); g.scale(0.87, 1); g.fillText('OQURO', 0, 0); g.restore();
        // a scan line
        const y = ((t * 0.35) % 1) * H; g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y, W, 3);
      } else if (tab === 'ai') {
        g.fillStyle = '#17121f'; g.fillRect(0, 0, W, H);
        const r = seeded(5);
        const pts = Array.from({ length: 26 }, (_, i) => [W * (0.1 + r() * 0.8) + Math.sin(t + i) * 6, H * (0.12 + r() * 0.76) + Math.cos(t * 0.8 + i) * 6]);
        g.lineWidth = 1.2;
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
          if (d < 110) { g.strokeStyle = `rgba(190,140,255,${(1 - d / 110) * 0.6})`; g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[j]); g.stroke(); }
        }
        pts.forEach((p, i) => { const hot = i === Math.floor(t * 1.5) % pts.length; g.fillStyle = hot ? '#ff5048' : '#d6b8ff'; g.beginPath(); g.arc(p[0], p[1], hot ? 6 : 3.5, 0, Math.PI * 2); g.fill(); });
      } else {
        g.fillStyle = '#0d2a17'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(90,230,140,0.9)'; g.lineWidth = 6;
        const cx = W / 2, cy = H * 0.44, s = H * 0.22;
        g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.8, cy - s * 0.65); g.lineTo(cx + s * 0.8, cy + s * 0.05); g.quadraticCurveTo(cx + s * 0.7, cy + s * 0.8, cx, cy + s * 1.05); g.quadraticCurveTo(cx - s * 0.7, cy + s * 0.8, cx - s * 0.8, cy + s * 0.05); g.lineTo(cx - s * 0.8, cy - s * 0.65); g.closePath(); g.stroke();
        const k = clamp(st / 0.8, 0, 1);
        g.beginPath(); g.moveTo(cx - s * 0.35, cy); g.lineTo(cx - s * 0.35 + s * 0.25 * k, cy + s * 0.28 * k); if (k > 0.5) g.lineTo(cx - s * 0.1 + s * 0.5 * (k - 0.5) * 2, cy + s * 0.28 - s * 0.55 * (k - 0.5) * 2); g.stroke();
        g.fillStyle = 'rgba(160,255,190,0.95)'; g.font = `600 ${H * 0.08}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText('DEVICE ISOLATED', cx, H * 0.86);
      }
      tex.needsUpdate = true;
    }
    paint(0);
    // the glass panel over the picture's foot: the laptop is framed in the room above it, smaller where the panel
    // takes more of the picture (phones); measured again whenever the picture changes shape
    const glass = canvas.parentElement.querySelector('.netact');
    let room = 0.54, shape = 0;
    // fonts still on their way (reduced motion gets here before they are in): paint the screen again once they are
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { paint(st); redraw(); });
    let acc = 0;
    return {
      scene, camera,
      update(dt, t, aspect, hover) {
        st += dt; acc += dt;
        if (acc > 1 / 20) { acc = 0; paint(t); }
        else if (!dt && st < 1) { st = 1; paint(t); }   // a still shows the tab's screen as it settles
        if (aspect !== shape) { shape = aspect; room = glass?.offsetParent ? glass.offsetTop / glass.offsetParent.clientHeight : 0.54; }
        const k = Math.min(1, room / 0.54);
        camera.fov = (2 * Math.atan(0.2867 / k) * 180) / Math.PI; camera.aspect = aspect; camera.updateProjectionMatrix();   // 32 degrees with room enough
        camera.position.set(0.2 + hover.x * 0.25 + Math.sin(t * 0.3) * 0.05, 1.9 - hover.y * 0.15, 4.6);
        camera.lookAt(-0.05, -0.02, 0.2);
        // the laptop's view offset: frame it in the upper part, above the glass card
        camera.setViewOffset(1000, 1000 / aspect, 0, (1000 / aspect) * (0.5 - 0.34 * k), 1000, 1000 / aspect);
      },
    };
  }

  // ───────── a chain link half sunk in sand, moss in its gaps ─────────
  async function chain() {
    const scene = new THREE.Scene(); lights(scene, { size: 1.6, dir: [-0.6, 0.9, 0.3], sun: 3.4, hemi: 0.7 });
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    const sandG = new THREE.PlaneGeometry(4, 4, 140, 140); sandG.rotateX(-Math.PI / 2);
    const pos = sandG.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // ripples, a few footprints of wind, and a rim pushed up round the link
      const d = Math.hypot(x / 1.0, z / 0.36);
      const rim = Math.exp(-Math.pow((d - 0.78) / 0.12, 2)) * 0.035;
      pos.setY(i, noise3(x * 1.6, 0, z * 1.6) * 0.04 + Math.sin(x * 7 + noise3(x, 1, z) * 2) * 0.006 + rim);
    }
    sandG.computeVertexNormals();
    const sand = new THREE.Mesh(sandG, K.surfaceMaterial({ key: 'sand', c1: '#cbbd9e', c2: '#ece2cc', c3: '#a8987a', pore: 70, pit: 0.25, bump: 0.01, tone: 2.5, grain: 1.6, moss: -1 }));
    sand.receiveShadow = true; scene.add(sand);
    await breathe();
    // a long, slim link of near-black iron, the moss only in patches
    const linkG = K.chainLinkGeometry({ len: 1.4, r: 0.2, tube: 0.08 });
    const iron = (moss) => K.surfaceMaterial({ key: 'iron', c1: '#2a221c', c2: '#40342a', c3: '#1a130c', metalness: 0.45, roughness: 0.62, pore: 18, pit: 0.6, bump: 0.02, tone: 3, moss, mossUp: 1.2, mossScale: 3.2, seed: [1, 9, 4], mossA: '#2a3608', mossB: '#6a8a20' });
    const link = new THREE.Mesh(linkG, iron(-0.4));
    link.rotation.x = -Math.PI / 2; link.position.y = 0.01; link.castShadow = true; link.receiveShadow = true; scene.add(link);
    link.add(K.mossShells(linkG, { layers: 10, thick: 0.04, density: [420, 50], fill: 0.8, moss: -0.4, mossUp: 1.2, mossScale: 3.2, seed: [1, 9, 4], mossA: '#22300a', mossB: '#6a8a20', tip: '#b4c25a' }));
    // the next link, bare: only its end shows, curling up out of the sand in the hole by the far bar. Stood on end
    // across the link, then leant well over to the side so that from above its end reads as a crescent
    const next = new THREE.Mesh(K.chainLinkGeometry({ len: 1.0, r: 0.14, tube: 0.07 }), iron(-1));
    next.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI / 2 + 1.2, 'ZYX')).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1));
    next.position.set(0.1, -0.02, -0.08).addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(next.quaternion), -0.36);   // its end's centre there
    next.castShadow = true; next.receiveShadow = true; scene.add(next);
    return {
      scene, camera,
      update(dt, t, aspect, hover) {
        camera.fov = 28; camera.aspect = aspect; camera.updateProjectionMatrix();
        camera.position.set(Math.sin(t * 0.2) * 0.25 + hover.x * 0.4, 3.4, 0.9 + hover.y * 0.3);
        camera.lookAt(0, 0, 0.05);
        link.rotation.z = Math.sin(t * 0.3) * 0.03;
      },
    };
  }

  function size(v) {
    const r = v.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * Q)), h = Math.max(1, Math.round(r.height * Q));
    if (w !== v.w || h !== v.h) { v.w = w; v.h = h; v.canvas.width = w; v.canvas.height = h; }
    if (w > bufW || h > bufH) { bufW = Math.max(bufW, w); bufH = Math.max(bufH, h); renderer.setSize(bufW, bufH, false); }
  }
  let t = 0, ticks = 0;
  function draw(v, dt) {
    size(v);
    v.hover.x = damp(v.hover.x, v.hover.tx, 3, dt); v.hover.y = damp(v.hover.y, v.hover.ty, 3, dt);
    v.update(dt, t, v.w / v.h, v.hover);
    renderer.setViewport(0, 0, v.w, v.h); renderer.setScissor(0, 0, v.w, v.h); renderer.setScissorTest(true);
    // the plants here sway on this loop's clock, not the hero's (which stops once it is scrolled away), and the
    // hero's pointer does not reach them
    const pw = shared.uPush.value.w, pt = shared.uTime.value;
    shared.uPush.value.w = 0; shared.uTime.value = t;
    renderer.render(v.scene, v.camera);
    shared.uPush.value.w = pw; shared.uTime.value = pt;
    v.ctx.clearRect(0, 0, v.w, v.h);
    v.ctx.drawImage(renderer.domElement, 0, bufH - v.h, v.w, v.h, 0, 0, v.w, v.h);
    v.box.classList.add('has-gl');
  }
  const run = loop((dt) => {
    t += dt; ticks++;
    for (const v of views) if (v.visible) draw(v, dt);
  });
  function sync() { run.set(!calm && views.some((v) => v.visible)); }
  // under reduced motion at once; otherwise a still (dt 0) unless the loop draws within two frames (it may be paused)
  let asked = 0;
  redraw = () => {
    if (calm) { for (const v of views) draw(v, 0); return; }
    const n = ticks;
    cancelAnimationFrame(asked);
    asked = requestAnimationFrame(() => { asked = requestAnimationFrame(() => { if (ticks === n) for (const v of views) if (v.visible) draw(v, 0); }); });
  };
  // a lost context comes back without the sky's light (three cannot refill a render target): bake it again
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    env = sky();
    for (const v of views) v.scene.environment = env;
    redraw();
  });
  addEventListener('resize', () => { if (calm) for (const v of views) draw(v, 0); });

  // each picture in its own slices: the scene, its shaders (in parallel where the browser can), its first frame (with
  // the shadow pass's shaders), so nothing waits for a scroll to have a picture. It joins the loop once it has one.
  const makers = { garden, laptop, chain };
  const parallel = renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile');
  // the driver's compile can take its time; only a starved check (its polls are timers too) stops the wait, and the
  // first draw then waits for the link instead
  const compile = async (v) => {
    if (!parallel || hurry) { renderer.compile(v.scene, v.camera); return; }
    let done = false;
    const job = renderer.compileAsync(v.scene, v.camera).then(() => { done = true; });
    while (!done && !hurry) {
      const t0 = performance.now();
      await Promise.race([job, new Promise((r) => setTimeout(r, 100))]);
      if (!done) late(t0, 100);
    }
  };
  for (const canvas of hosts) {
    const make = makers[canvas.dataset.scene];
    if (!make) continue;
    await breathe();
    const v = await make(canvas);
    await breathe();
    await compile(v);
    await breathe();
    const hover = { x: 0, y: 0, tx: 0, ty: 0 };
    const box = canvas.parentElement;
    if (fine && !calm) {
      box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); hover.tx = ((e.clientX - r.left) / r.width) * 2 - 1; hover.ty = ((e.clientY - r.top) / r.height) * 2 - 1; });
      box.addEventListener('pointerleave', () => { hover.tx = hover.ty = 0; });
    }
    const view = { ...v, canvas, ctx: canvas.getContext('2d'), hover, visible: calm, w: 0, h: 0, box };
    draw(view, 0.016);
    views.push(view);
    if (!calm) whenVisible(box, (on) => { view.visible = on; sync(); });
  }
}
