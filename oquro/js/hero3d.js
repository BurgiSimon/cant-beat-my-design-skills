// The hero in 3D: a mossy stone ring standing on a grass mound, a vault door hung inside it, wheat and daisies, rocks,
// and moss crumbling off the first letter of the word behind. All procedural (see gl/kit.js). The wheel can be
// dragged round; turn it far enough and the bolts draw back and the door swings open, which the threat card notices.

import { calm, fine, gl, dpr, emit, on, once, pointer, whenVisible, loop, clamp, damp, lerp, seeded, scroll } from './core.js';

export async function init() {
  const canvas = document.querySelector('[data-hero-gl]');
  const hero = document.querySelector('.hero');
  const anchor = document.querySelector('[data-anchor]');
  if (!canvas || !gl) { emit('hero:gl', null); return null; }
  const K = await import('./gl/kit.js');
  const { THREE, shared, noise3 } = K;
  // building all this is heavy: hand the main thread back between the big pieces, so the intro keeps turning
  const breathe = () => new Promise((r) => setTimeout(r, 0));
  const rnd = seeded(20261127);
  const low = gl.tier < 2;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]still/.test(location.search) });
  } catch (e) { emit('hero:gl', null); return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.environment = K.skyEnvironment(renderer);
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 60);

  // ---- light: a soft sky and a low sun from the upper left ----
  const hemi = new THREE.HemisphereLight(0xf6f8f4, 0x5d6640, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1de, 3.1);
  sun.position.copy(shared.uSunDir.value).multiplyScalar(8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -3.2, right: 3.2, top: 3, bottom: -3, near: 1, far: 20 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.5); fill.position.set(3, 1, 4); scene.add(fill);

  const world = new THREE.Group(); scene.add(world);

  // ---- the ring ----
  const ringG = K.ringGeometry({ outer: 1, inner: 0.63, depth: 0.36, corner: 0.17, segments: low ? 180 : 260, profile: low ? 56 : 80 });
  K.displace(ringG, (x, y, z) => noise3(x * 1.3, y * 1.3, z * 1.3) * 0.014 + noise3(x * 4.2 + 3, y * 4.2, z * 4.2) * 0.009 + noise3(x * 12, y * 12, z * 12) * 0.004);
  const RING_MOSS = { moss: -0.06, mossUp: 1.1, mossY: 0.25, mossScale: 2.3, mossDir: [0.1, 1, 0.4], seed: [1.3, 0.2, 0.7] };
  const stone = K.surfaceMaterial({
    key: 'ring', c1: '#988a70', c2: '#ddd1b6', c3: '#5c5040', pore: 34, pit: 0.85, bump: 0.016, tone: 2.0,
    ...RING_MOSS, mossA: '#2a2e05', mossB: '#6c7116',
  });
  const ring = new THREE.Mesh(ringG, stone); ring.castShadow = true; ring.receiveShadow = true;
  const ringGroup = new THREE.Group(); ringGroup.add(ring); world.add(ringGroup);
  ringGroup.rotation.set(0.05, -0.1, 0.02);
  const ringMoss = K.mossShells(ringG, {
    layers: low ? 12 : 18, thick: 0.034, density: [260, 260 * ringG.userData.perimeter / 5.1], fill: 0.7, ...RING_MOSS,
    mossA: '#22260a', mossB: '#646c14', tip: '#a6a845',
  });
  ring.add(ringMoss);

  await breathe();
  // ---- the vault door, hung in the ring ----
  const vault = K.vaultDoor({});
  vault.group.scale.setScalar(0.45);
  vault.group.position.set(0.0, -0.11, 0.0);
  ringGroup.add(vault.group);
  // moss hanging from the ring's inner top onto the door: a few lumpy blobs, all moss
  const blobMat = K.surfaceMaterial({ key: 'blob', moss: 1.4, mossUp: 0, seed: [5, 5, 5], mossA: '#2a2e07', mossB: '#5d6514', pit: 0.1 });
  for (const [x, y, z, r, sd] of [[-0.02, 0.62, 0.03, 0.1, 1], [-0.09, 0.53, 0.08, 0.09, 2], [0.05, 0.55, 0.05, 0.075, 5], [-0.07, 0.44, 0.11, 0.075, 3], [-0.15, 0.4, 0.09, 0.06, 4], [0.1, 0.6, 0.02, 0.06, 6], [-0.18, 0.58, 0.02, 0.06, 7]]) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    K.displace(g, (a, b, c) => noise3(a * 1.8 + sd * 3, b * 1.8, c * 1.8) * 0.25);
    const blob = new THREE.Mesh(g, blobMat); blob.scale.set(r * 1.2, r, r); blob.position.set(x, y, z); blob.castShadow = true;
    ringGroup.add(blob);
    blob.add(K.mossShells(g, { layers: 12, thick: 0.22, density: [40, 40], fill: 0.85, moss: 1.4, mossUp: 0, seed: [5, 5, 5], mossA: '#22260a', mossB: '#646c14', tip: '#a6a845' }));
  }

  await breathe();
  // ---- the mound ----
  const MOUND = { cx: 0, cy: -2.2, cz: -0.25, rx: 2.75, ry: 1.46, rz: 1.75 };
  const moundG = new THREE.SphereGeometry(1, low ? 96 : 160, low ? 48 : 80, 0, Math.PI * 2, 0, Math.PI * 0.62);
  moundG.scale(MOUND.rx, MOUND.ry, MOUND.rz);
  K.displace(moundG, (x, y, z) => noise3(x * 1.4, y * 1.4, z * 1.4) * 0.05 + noise3(x * 5, y * 5, z * 5) * 0.012);
  const moundMat = K.surfaceMaterial({ key: 'mound', c1: '#3b4010', c2: '#555c17', c3: '#272b08', moss: 1.3, mossUp: 0, seed: [9, 1, 3], mossA: '#2c3108', mossB: '#5a6116', pit: 0.2, bump: 0.01 });
  const mound = new THREE.Mesh(moundG, moundMat);
  mound.position.set(MOUND.cx, MOUND.cy, MOUND.cz); mound.receiveShadow = true;
  world.add(mound);
  const moundMoss = K.mossShells(moundG, {
    layers: low ? 10 : 16, thick: 0.05, density: [900, 260], fill: 0.85, moss: 1.3, mossUp: 0, seed: [9, 1, 3], droop: 0.0,
    mossA: '#1f2306', mossB: '#555d12', tip: '#929640', light: 1.0,
  });
  mound.add(moundMoss);
  const moundY = (x, z) => {
    const nx = (x - MOUND.cx) / MOUND.rx, nz = (z - MOUND.cz) / MOUND.rz;
    const q = 1 - nx * nx - nz * nz;
    return q <= 0 ? -9 : MOUND.cy + MOUND.ry * Math.sqrt(q);
  };

  await breathe();
  // ---- plants ----
  const grassMat = K.plantMaterial({ sway: 0.14, ao: 0.3, trans: 0.7 });
  const bladeG = K.bladeGeometry({ segs: 5, w: 0.026, curl: 0.06, root: '#1d2104', mid: '#4a520e', tip: '#8d9038' });
  const grass = K.plantField(bladeG, grassMat, low ? 5000 : 11000, (i, r) => {
    const a = r() * Math.PI * 2; const rr = Math.sqrt(r());
    const x = Math.cos(a) * rr * MOUND.rx * 0.98; const z = MOUND.cz + Math.sin(a) * rr * MOUND.rz * 0.98;
    if (z < -0.35 && Math.abs(x) < 1.05) return null;            // behind the ring: nobody sees it
    const y = moundY(x, z);
    if (y < -1.75) return null;
    const front = clamp((z + 0.2) / 1.6, 0, 1);
    return { x, y: y - 0.01, z, h: (0.07 + r() * 0.13) * (0.8 + front * 0.6), w: 0.8 + r() * 0.6, bend: 0.15 + r() * 0.35, tint: [0.85 + r() * 0.3, 0.9 + r() * 0.2, 0.8 + r() * 0.25] };
  }, rnd);
  world.add(grass);

  // tall leaves: left of the ring and right behind the card
  const leafG = K.bladeGeometry({ segs: 8, w: 0.045, curl: 0.18, root: '#273309', mid: '#4b6a1b', tip: '#8aa23a' });
  const leafMat = K.plantMaterial({ sway: 0.1, ao: 0.4, trans: 0.8 });
  const clumps = [[-1.25, 0.55, 46, 0.55], [-0.95, 0.75, 22, 0.42], [1.28, 0.2, 40, 0.62], [1.62, 0.4, 18, 0.4], [-1.95, 0.6, 18, 0.38], [0.7, 0.9, 14, 0.3]];
  const leafList = [];
  for (const [cx, cz, n, hh] of clumps) for (let i = 0; i < n; i++) leafList.push([cx, cz, hh]);
  const leaves = K.plantField(leafG, leafMat, leafList.length, (i, r) => {
    const [cx, cz, hh] = leafList[i];
    const x = cx + (r() - 0.5) * 0.18, z = cz + (r() - 0.5) * 0.18;
    const yaw = r() * Math.PI * 2;
    return { x, y: moundY(x, z) - 0.02, z, h: hh * (0.55 + r() * 0.6), w: 0.8 + r() * 0.5, yaw, bend: 0.35 + r() * 0.65, tint: [0.9 + r() * 0.2, 0.95 + r() * 0.15, 0.85 + r() * 0.2] };
  }, rnd);
  world.add(leaves);

  // wheat, left of the ring
  const wheatMat = K.plantMaterial({ sway: 0.11, ao: 0.55, trans: 0.9, kernels: 90 });
  const wheat = K.plantField(K.wheatGeometry({ stemW: 0.006, headW: 0.05, head: 0.36 }), wheatMat, 30, (i, r) => {
    const x = -1.5 + r() * 0.72, z = 0.3 + r() * 0.4;
    const lean = (x + 1.1) * 0.9;
    return { x, y: moundY(x, z) - 0.02, z, h: 0.5 + r() * 0.36, w: 0.9 + r() * 0.4, yaw: Math.PI / 2 + lean * 0.6 + (r() - 0.5) * 0.5, bend: 0.15 + r() * 0.3 + Math.abs(lean) * 0.2, tint: [1, 0.97, 0.92] };
  }, rnd);
  world.add(wheat);

  // daisies
  const daisyMat = K.plantMaterial({ sway: 0.12, ao: 0.5, trans: 0.5 });
  const daisySpots = [[-1.55, 0.62, 0.3], [-1.38, 0.7, 0.22], [-1.68, 0.72, 0.18], [-1.22, 0.64, 0.26], [1.12, 0.28, 0.42], [1.3, 0.22, 0.36], [1.02, 0.36, 0.3], [-0.85, 0.82, 0.16], [1.5, 0.55, 0.2], [0.6, 0.78, 0.14]];
  const daisies = K.plantField(K.daisyGeometry({ radius: 0.11 }), daisyMat, daisySpots.length, (i, r) => {
    const [x, z, h] = daisySpots[i];
    return { x, y: moundY(x, z) - 0.02, z, h: h * (0.9 + r() * 0.3), w: 1 + r() * 0.35, yaw: (r() - 0.5) * 0.8, bend: 0.05 + r() * 0.1, tint: [1, 0.95 + r() * 0.05, 1] };
  }, rnd);
  world.add(daisies);

  await breathe();
  // ---- rocks along the foot ----
  const rockMat = K.surfaceMaterial({ key: 'rock', c1: '#8c8270', c2: '#cfc4ad', c3: '#5a5040', pore: 26, pit: 0.35, bump: 0.02, tone: 1.6, moss: -0.25, mossUp: 1.2, mossScale: 2.0, seed: [2, 7, 1], mossA: '#2a3610', mossB: '#6f8429' });
  const rocks = [];
  for (const [x, z, s, seed, rot] of [[-1.45, 0.8, 0.2, 2, 0.4], [0.3, 0.78, 0.26, 5, -0.3], [0.72, 0.72, 0.17, 4, 1.1], [1.25, 0.66, 0.2, 8, 0.9], [-0.62, 0.9, 0.13, 3, 1.4]]) {
    const g = K.rockGeometry({ seed, sx: 1.2, sy: 1.0, sz: 0.95, detail: low ? 4 : 5, rough: 0.28 });
    const rk = new THREE.Mesh(g, rockMat); rk.scale.setScalar(s); rk.position.set(x, moundY(x, z) - s * 0.08, z); rk.rotation.y = rot;
    rk.castShadow = true; rk.receiveShadow = true; world.add(rk); rocks.push(rk);
  }

  // ---- moss crumbling off the first letter ----
  const letter = document.querySelector('.hero__letters > span');
  const CLUMPS = low ? 1400 : 2600;
  const clumpG = new THREE.IcosahedronGeometry(1, 1);
  K.displace(clumpG, (x, y, z) => noise3(x * 2, y * 2, z * 2) * 0.25);
  const clumpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const clumpsMesh = new THREE.InstancedMesh(clumpG, clumpMat, CLUMPS);
  clumpsMesh.frustumCulled = false;
  world.add(clumpsMesh);
  const clumpState = [];
  const palette = ['#33380a', '#4d5414', '#676f1c', '#808a2a', '#9a9f3e', '#3d4410'].map((c) => new THREE.Color(c));
  for (let i = 0; i < CLUMPS; i++) {
    const t = rnd();
    clumpState.push({ t, side: rnd(), off: rnd(), size: (0.0032 + Math.pow(rnd(), 3.2) * 0.013) * (t > 0.72 ? 0.7 : 1), home: new THREE.Vector3(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: rnd() * 6, drift: rnd() });
    clumpsMesh.setColorAt(i, palette[Math.floor(rnd() * palette.length)]);
  }
  const LETTER_Z = -0.55;
  const ray = new THREE.Raycaster(); const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -LETTER_Z);
  const ndc = new THREE.Vector2(); const hit = new THREE.Vector3();
  const toWorld = (px, py, rect, out) => {
    ndc.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(plane, out);
    return out;
  };
  function placeClumps() {
    if (!letter) return;
    clumpsMesh.visible = getComputedStyle(letter).visibility !== 'hidden';   // no word, no moss on it
    const cr = canvas.getBoundingClientRect(); const box = letter.getBoundingClientRect();
    // where the letter rests: its box, less any lift the intro has it in the middle of
    const lift = new DOMMatrixReadOnly(getComputedStyle(letter).transform === 'none' ? undefined : getComputedStyle(letter).transform).m42;
    const lr = { left: box.left, top: box.top - lift, width: box.width, height: box.height };
    // the O is a stadium: straight sides, round ends. Moss sits on its upper left and trails off up and left.
    const w = lr.width * 0.87, x0 = lr.left + (lr.width - w) / 2; const h = lr.height; const r = w / 2;
    for (const c of clumpState) {
      let px, py;
      if (c.t < 0.72) { // on the letter: a patch over its upper left, thick at the edge and thinning inwards
        const u = c.t / 0.72;
        const a = Math.PI * (0.42 + u * 0.62);            // round the top, from just right of 12 o'clock to 9
        const along = u < 0.7 ? 0 : (u - 0.7) / 0.3;      // then a little way down the left side
        const inset = Math.pow(c.side, 2.2) * w * 0.4;
        if (along === 0) { px = x0 + r + Math.cos(a) * (r - inset); py = lr.top + r - Math.sin(a) * (r - inset); }
        else { px = x0 + inset; py = lr.top + r + along * h * 0.22; }
      } else { // spilling off: a loose trail up and to the left of the letter
        const u = (c.t - 0.72) / 0.28;
        px = x0 + w * 0.15 - u * w * 0.55 + (c.side - 0.5) * w * 0.45 * u;
        py = lr.top + h * 0.05 + u * h * 0.32 - Math.sin(u * 3) * h * 0.06 + (c.off - 0.5) * h * 0.14;
      }
      toWorld(px, py, cr, c.home);
      c.home.z += (c.side - 0.5) * 0.06 + (c.t > 0.72 ? 0.1 : 0.03);
      if (!c.pos.lengthSq()) c.pos.copy(c.home);
    }
  }

  // ---- fit: the ring sits on the anchor, whatever the screen ----
  let W = 1, H = 1;
  // resolution follows the machine: start sharp, step down if the frames run long
  const quality = { dpr: dpr(low ? 1.25 : 1.75), n: 0, sum: 0 };
  const watchFrame = (ms) => {
    if (quality.dpr <= 1 || calm) return;
    quality.n++; quality.sum += ms;
    if (quality.n === 45) {
      if (quality.sum / quality.n > 24) { quality.dpr = Math.max(1, quality.dpr - 0.35); fit(); }
      quality.n = 0; quality.sum = 0;
    }
  };
  function fit() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(quality.dpr, Math.sqrt(3.2e6 / (W * H))));
    renderer.setSize(W, H, false);
    const a = anchor.getBoundingClientRect();
    const cx = a.left + a.width / 2 - r.left; const cy = a.top + a.height / 2 - r.top;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const d = H / (a.width * Math.tan(fov / 2));           // ring radius 1 ↦ half the anchor
    camera.position.set(0, 0.12, d);
    camera.lookAt(0, 0, 0);
    camera.aspect = W / H;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    placeClumps();
  }

  // ---- the wheel: drag it round; far enough and the vault opens ----
  const wheel = { a: 0, v: 0, dragging: false, last: 0, turned: 0, open: 0, openT: 0, cooldown: 0 };
  const wheelCenter = new THREE.Vector3();
  const screenOf = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]; };
  const angleAt = (x, y) => { vault.wheel.getWorldPosition(wheelCenter); const [sx, sy] = screenOf(wheelCenter); return Math.atan2(-(y - sy), x - sx); };
  const overWheel = (x, y) => {
    vault.wheel.getWorldPosition(wheelCenter);
    const [sx, sy] = screenOf(wheelCenter);
    const edge = screenOf(wheelCenter.clone().add(new THREE.Vector3(0.45 * 0.7, 0, 0)));
    return Math.hypot(x - sx, y - sy) < Math.abs(edge[0] - sx) * 1.15;
  };
  let hovering = false;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (wheel.dragging) {
      const a = angleAt(x, y); let da = a - wheel.last; da = Math.atan2(Math.sin(da), Math.cos(da));
      wheel.last = a; wheel.a += da; wheel.v = da * 60; wheel.turned += Math.abs(da);
      return;
    }
    const over = overWheel(x, y);
    if (over !== hovering) { hovering = over; canvas.classList.toggle('is-grab', over); emit('cursor', over ? 'Drag to spin' : null); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (!overWheel(x, y)) return;
    wheel.dragging = true; wheel.last = angleAt(x, y); wheel.turned = 0;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-grabbing'); emit('cursor', 'Keep turning');
    e.preventDefault();
  });
  const release = () => { if (!wheel.dragging) return; wheel.dragging = false; canvas.classList.remove('is-grabbing'); emit('cursor', hovering ? 'Drag to spin' : null); };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { if (!wheel.dragging && hovering) { hovering = false; canvas.classList.remove('is-grab'); emit('cursor', null); } });
  // without a drag (keyboard, touch, or just curiosity): the face in the threat card gives the wheel a turn
  on('vault:spin', () => { wheel.v += 14; wheel.turned += 7.5; });

  // ---- scroll and pointer ----
  const look = { x: 0, y: 0 };
  const pushWorld = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6);
  const still = calm || /[?&]still/.test(location.search);
  let intro = still ? 1 : 0;
  once('hero:rise', () => { intro = 1; });
  const rise = { v: still ? 1 : 0 };

  let t = 0;
  function frame(dt) {
    t += dt; shared.uTime.value = t;
    // the intro rises the ring and the plants up out of the mound
    rise.v = damp(rise.v, intro, 2.2, dt);
    world.position.y = (1 - rise.v) * -0.35;
    // parallax towards the pointer, and a slow breath
    const tx = fine && pointer.active ? pointer.nx : 0, ty = fine && pointer.active ? pointer.ny : 0;
    look.x = damp(look.x, tx, 2.5, dt); look.y = damp(look.y, ty, 2.5, dt);
    ringGroup.rotation.y = -0.1 + look.x * 0.12 + Math.sin(t * 0.35) * 0.02;
    ringGroup.rotation.x = 0.05 + look.y * 0.05;
    world.rotation.y = look.x * 0.03;
    // scroll: the scene sinks and the ring tips back a touch
    const sy = clamp(scroll.y / Math.max(1, H), 0, 1.2);
    world.position.y -= sy * 0.35; ringGroup.rotation.x += sy * 0.25;

    // the plants lean away from the pointer
    if (pointer.active && fine) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((pointer.x - r.left) / r.width) * 2 - 1, -((pointer.y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(groundPlane, pushWorld)) {
        pushWorld.y = moundY(pushWorld.x, 0.6) + 0.1 - world.position.y;
        shared.uPush.value.x = damp(shared.uPush.value.x, pushWorld.x, 10, dt);
        shared.uPush.value.y = pushWorld.y;
        shared.uPush.value.z = 0.6;
        shared.uPush.value.w = damp(shared.uPush.value.w, 1.1, 4, dt);
      }
    } else shared.uPush.value.w = damp(shared.uPush.value.w, 0, 3, dt);
    shared.uPushR.value = 0.45;

    // the wheel
    if (!wheel.dragging) { wheel.v = damp(wheel.v, 0, 1.6, dt); wheel.a += wheel.v * dt; }
    wheel.a += (calm ? 0 : 0.05) * dt;
    vault.wheel.rotation.z = wheel.a;
    wheel.cooldown = Math.max(0, wheel.cooldown - dt);
    if (wheel.turned > Math.PI * 2.2 && wheel.open === 0 && wheel.cooldown === 0) { wheel.open = 1; wheel.openT = 0; wheel.turned = 0; emit('vault:open'); }
    if (wheel.open) {
      wheel.openT += dt;
      if (wheel.openT > 4.2) { wheel.open = 0; wheel.cooldown = 2; emit('vault:close'); }
    }
    const opening = wheel.open ? clamp(wheel.openT / 0.6, 0, 1) : 0;
    for (const b of vault.bolts) { const k = (b.userData.k = damp(b.userData.k || 0, opening, 6, dt)); const rr = 0.78 - k * 0.12; b.position.x = Math.cos(b.userData.a) * rr; b.position.y = Math.sin(b.userData.a) * rr; }
    const swing = wheel.open ? clamp((wheel.openT - 0.5) / 0.8, 0, 1) : 0;
    vault.door.userData.s = damp(vault.door.userData.s || 0, swing, 3.5, dt);
    const s = vault.door.userData.s;
    vault.door.rotation.y = -s * 0.85; vault.door.position.x = -(1 - Math.cos(s * 0.85)) * 1.0; vault.door.position.z = Math.sin(s * 0.85) * 1.0;
    glow.material.opacity = s;

    // moss on the letter: springs home, scatters from the pointer, a few drift free
    if (letter) {
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const sc = new THREE.Vector3(); const e = new THREE.Euler();
      let pw = null;
      if (pointer.active && fine) {
        const r = canvas.getBoundingClientRect();
        pw = toWorld(pointer.x, pointer.y, r, new THREE.Vector3());
      }
      for (let i = 0; i < CLUMPS; i++) {
        const c = clumpState[i];
        const home = c.home;
        const fx = Math.sin(t * (0.4 + c.drift) + c.spin) * (c.t > 0.72 ? 0.02 : 0.003);
        const fy = Math.cos(t * (0.3 + c.drift * 0.5) + c.spin) * (c.t > 0.72 ? 0.018 : 0.002);
        c.vel.x += (home.x + fx - c.pos.x) * 18 * dt; c.vel.y += (home.y + fy - c.pos.y) * 18 * dt; c.vel.z += (home.z - c.pos.z) * 18 * dt;
        if (pw) {
          const dx = c.pos.x - pw.x, dy = c.pos.y - pw.y; const d2 = dx * dx + dy * dy;
          if (d2 < 0.04) { const f = (0.04 - d2) * 60 * dt; c.vel.x += dx * f * 8; c.vel.y += dy * f * 8; c.vel.z += f * 0.5; }
        }
        c.vel.multiplyScalar(Math.exp(-5 * dt));
        c.pos.addScaledVector(c.vel, dt);
        e.set(c.spin + t * 0.2 * c.drift, c.spin * 2, 0); q.setFromEuler(e);
        const appear = clamp(rise.v * 1.6 - c.t * 0.6, 0, 1);
        sc.setScalar(c.size * appear);
        m.compose(c.pos, q, sc); clumpsMesh.setMatrixAt(i, m);
      }
      clumpsMesh.instanceMatrix.needsUpdate = true;
    }

    const t0 = performance.now();
    renderer.render(scene, camera);
    if (dt > 0) watchFrame(Math.max(dt * 1000, performance.now() - t0));
  }

  // the light inside the vault, seen when the door swings
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.8), transparent: true, opacity: 0, toneMapped: false }));
  glow.position.set(0, -0.11, -0.02); ringGroup.add(glow);

  // ---- run ----
  const run = loop(frame);
  let visible = true;
  whenVisible(hero, (v) => { visible = v; run.set(v && !calm); if (v && calm) frame(0.016); }, '0px');
  const ro = new ResizeObserver(() => { fit(); if (calm || !run.on) frame(0); });
  ro.observe(canvas);
  addEventListener('resize', () => { fit(); if (calm || !run.on) frame(0); });
  fit();
  // warm the shaders up before the first frame is shown (in parallel where the browser can)
  await breathe();
  if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  frame(0.016);
  hero.classList.add('has-gl');
  canvas.classList.add('is-on');
  if (calm) { frame(0); }
  emit('hero:gl', { canvas });
  document.fonts?.ready.then(() => { fit(); if (calm) frame(0); });
  once('intro:done', () => setTimeout(placeClumps, 1800));
  return { rise: () => emit('hero:rise') };
}
