// The hero in 3D: a mossy stone ring standing on a grass mound, a vault door hung inside it, wheat and daisies, rocks,
// and moss crumbling off the first letter of the word behind. All procedural (see gl/kit.js). The wheel can be
// dragged round; turn it far enough and the bolts draw back and the door swings open, which the threat card notices.

import { calm, motion, fine, gl, dpr, emit, on, once, pointer, whenVisible, loop, clamp, damp, lerp, seeded, scroll } from './core.js';

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
    key: 'ring', c1: '#74664d', c2: '#ab9b7c', c3: '#4f4334', pore: 34, pit: 0.85, bump: 0.016, tone: 2.0,
    ...RING_MOSS, mossA: '#2a2e05', mossB: '#6c7116',
  });
  const ring = new THREE.Mesh(ringG, stone); ring.castShadow = true; ring.receiveShadow = true;
  const ringGroup = new THREE.Group(); ringGroup.add(ring); world.add(ringGroup);
  ringGroup.rotation.set(0.05, -0.1, 0.02);
  await breathe();   // (the shells work their moss noise out once, per vertex: a slice of its own)
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
  const shells = [ringMoss, vault.shells].filter(Boolean);   // every moss shell, for the quality governor (see quality)
  for (const [x, y, z, r, sd] of [[-0.02, 0.62, 0.03, 0.1, 1], [-0.09, 0.53, 0.08, 0.09, 2], [0.05, 0.55, 0.05, 0.075, 5], [-0.07, 0.44, 0.11, 0.075, 3], [-0.15, 0.4, 0.09, 0.06, 4], [0.1, 0.6, 0.02, 0.06, 6], [-0.18, 0.58, 0.02, 0.06, 7]]) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    K.displace(g, (a, b, c) => noise3(a * 1.8 + sd * 3, b * 1.8, c * 1.8) * 0.25);
    const blob = new THREE.Mesh(g, blobMat); blob.scale.set(r * 1.2, r, r); blob.position.set(x, y, z); blob.castShadow = true;
    blob.renderOrder = 1;   // after its shells, as the mound below
    ringGroup.add(blob);
    const sh = K.mossShells(g, { layers: 12, thick: 0.22, density: [40, 40], fill: 0.85, moss: 1.4, mossUp: 0, seed: [5, 5, 5], mossA: '#22260a', mossB: '#646c14', tip: '#a6a845' });
    blob.add(sh); shells.push(sh);
  }

  await breathe();
  // ---- the mound ----
  const MOUND = { cx: 0, cy: -2.2, cz: -0.25, rx: 2.3, ry: 1.46, rz: 1.75 };   // an island: paper either side of it at the foot
  const moundG = new THREE.SphereGeometry(1, low ? 96 : 160, low ? 48 : 80, 0, Math.PI * 2, 0, Math.PI * 0.62);
  moundG.scale(MOUND.rx, MOUND.ry, MOUND.rz);
  K.displace(moundG, (x, y, z) => noise3(x * 1.4, y * 1.4, z * 1.4) * 0.05 + noise3(x * 5, y * 5, z * 5) * 0.012);
  const moundMat = K.surfaceMaterial({ key: 'mound', c1: '#3b4010', c2: '#555c17', c3: '#272b08', moss: 1.3, mossUp: 0, seed: [9, 1, 3], mossA: '#2c3108', mossB: '#5a6116', pit: 0.2, bump: 0.01 });
  const mound = new THREE.Mesh(moundG, moundMat);
  mound.position.set(MOUND.cx, MOUND.cy, MOUND.cz); mound.receiveShadow = true;
  // drawn after its shells and the plants on it: the moss covers most of it, and the depth test then skips the stone
  // shader (the heaviest on the page) wherever it does
  mound.renderOrder = 1;
  world.add(mound);
  const moundMoss = K.mossShells(moundG, {
    layers: low ? 10 : 16, thick: 0.05, density: [900, 260], fill: 0.85, moss: 1.3, mossUp: 0, seed: [9, 1, 3], droop: 0.0,
    mossA: '#1f2306', mossB: '#555d12', tip: '#929640', light: 1.0,
  });
  mound.add(moundMoss); shells.push(moundMoss);
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
  const clumps = [[-1.27, 0.39, 46, 0.55], [-0.96, 0.68, 22, 0.42], [1.34, -0.2, 40, 0.62], [1.73, -0.19, 18, 0.4], [-2.1, -0.15, 18, 0.38], [0.7, 0.87, 14, 0.3]];
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
    const x = -1.5 + r() * 0.72, z = 0.1 + r() * 0.5;
    const lean = (x + 1.1) * 0.9;
    return { x, y: moundY(x, z) - 0.02, z, h: 0.5 + r() * 0.36, w: 0.9 + r() * 0.4, yaw: Math.PI / 2 + lean * 0.6 + (r() - 0.5) * 0.5, bend: 0.15 + r() * 0.3 + Math.abs(lean) * 0.2, tint: [1, 0.97, 0.92] };
  }, rnd);
  world.add(wheat);

  // daisies
  const daisyMat = K.plantMaterial({ sway: 0.12, ao: 0.5, trans: 0.5 });
  const daisySpots = [[-1.6, 0.35, 0.3], [-1.41, 0.53, 0.22], [-1.74, 0.42, 0.18], [-1.24, 0.5, 0.26], [1.14, 0.1, 0.42], [1.36, -0.18, 0.36], [1.04, 0.22, 0.3], [-0.85, 0.77, 0.16], [1.55, 0.28, 0.2], [0.6, 0.76, 0.14]];
  const daisies = K.plantField(K.daisyGeometry({ radius: 0.11 }), daisyMat, daisySpots.length, (i, r) => {
    const [x, z, h] = daisySpots[i];
    return { x, y: moundY(x, z) - 0.02, z, h: h * (0.9 + r() * 0.3), w: 1 + r() * 0.35, yaw: (r() - 0.5) * 0.8, bend: 0.05 + r() * 0.1, tint: [1, 0.95 + r() * 0.05, 1] };
  }, rnd);
  world.add(daisies);

  await breathe();
  // ---- rocks along the foot ----
  const rockMat = K.surfaceMaterial({ key: 'rock', c1: '#8c8270', c2: '#cfc4ad', c3: '#5a5040', pore: 26, pit: 0.35, bump: 0.02, tone: 1.6, moss: -0.25, mossUp: 1.2, mossScale: 2.0, seed: [2, 7, 1], mossA: '#2a3610', mossB: '#6f8429' });
  const rocks = [];
  for (const [x, z, s, seed, rot] of [[-1.45, 0.45, 0.2, 2, 0.4], [0.3, 0.77, 0.26, 5, -0.3], [0.72, 0.68, 0.17, 4, 1.1], [1.27, 0.52, 0.2, 8, 0.9], [-0.62, 0.88, 0.13, 3, 1.4]]) {
    const g = K.rockGeometry({ seed, sx: 1.2, sy: 1.0, sz: 0.95, detail: low ? 4 : 5, rough: 0.28 });
    const rk = new THREE.Mesh(g, rockMat); rk.scale.setScalar(s); rk.position.set(x, moundY(x, z) - s * 0.08, z); rk.rotation.y = rot;
    rk.castShadow = true; rk.receiveShadow = true; world.add(rk); rocks.push(rk);
  }

  // ---- moss crumbling off the first letter ----
  const letter = document.querySelector('.hero__letters > span');
  const CLUMPS = low ? 2400 : 4000;
  const clumpG = new THREE.IcosahedronGeometry(1, 0);   // grains a few px across: twenty faces are plenty
  K.displace(clumpG, (x, y, z) => noise3(x * 2, y * 2, z * 2) * 0.25);
  const clumpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const clumpsMesh = new THREE.InstancedMesh(clumpG, clumpMat, CLUMPS);
  clumpsMesh.frustumCulled = false;
  world.add(clumpsMesh);
  const clumpState = [];
  const palette = ['#33380a', '#4d5414', '#676f1c', '#808a2a', '#9a9f3e', '#3d4410'].map((c) => new THREE.Color(c));
  for (let i = 0; i < CLUMPS; i++) {
    // most run along one band (s: 0 at its loose tail, 1 at its head); a few are strays (see placeClumps)
    const t = rnd(), group = t < 0.94 ? 0 : t < 0.97 ? 1 : 2, s = group ? 1 : Math.pow(t / 0.94, 0.8), loose = !group && s < 0.3;
    clumpState.push({ s, group, loose, side: rnd(), off: rnd(), size: (0.0031 + Math.pow(rnd(), 3) * 0.0085) * (loose ? 0.8 : 1), home: new THREE.Vector3(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: rnd() * 6, drift: rnd() });
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
    // the O's ink (Anton's O: 7% in from the left of its box, 93% wide; the box is the cap height). As in the shot, the
    // moss is one band: a loose spray off the O's upper left that thickens and runs down across its left stroke into
    // the counter (a diagonal from (-0.55w, 0.25h) to (0.55w, 0.685h)), with a few strays on the right stroke and up
    // between the first two letters.
    const w = lr.width * 0.93, x0 = lr.left + lr.width * 0.067, h = lr.height;
    const dx = 1.1 * w, dy = 0.435 * h, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;   // across the band
    const room = clamp((x0 - cr.left - 6) / (w * 0.8), 0.3, 1);   // on a narrow screen the spray draws in, on screen
    for (const c of clumpState) {
      let px, py;
      if (c.group === 0) {
        // across: wide and loose at the tail, tight on the letter; the tail spreads more up and down than sideways, so
        // it hugs the O's left edge and leaves the O above the band bare, as in the shot
        const a = (c.side + c.off - 1) * w * (0.13 + 0.3 * (1 - c.s) ** 2);
        px = x0 + w * (-0.55 + 1.1 * c.s) + nx * a * (0.4 + 0.6 * c.s); py = lr.top + h * (0.25 + 0.435 * c.s) + ny * a;
        if (px < x0) px = x0 - (x0 - px) * room;
      } else if (c.group === 1) { px = x0 + w * (0.65 + 0.22 * c.side); py = lr.top + h * (0.64 + 0.09 * c.off); }
      else { px = x0 + w * (0.94 + 0.16 * c.side); py = lr.top + h * (0.07 + 0.18 * c.off); }
      toWorld(px, py, cr, c.home);
      c.home.z += (c.drift - 0.5) * 0.06 + (c.loose ? 0.1 : 0.03);
      if (!c.pos.lengthSq() || calm || motion.paused) c.pos.copy(c.home);   // (nothing springs it home when nothing moves)
    }
  }

  // ---- fit: the ring sits on the anchor, whatever the screen ----
  let W = 1, H = 1;
  // the canvas's box as of the last fit, kept in page space (it sits in flow in the hero, untransformed, and is fitted
  // again whenever its size changes): the frame and the pointer read it without making the browser lay out again
  const cbox = { left: 0, top: 0, width: 1, height: 1 }; let boxY = 0;
  const rect = () => { cbox.top = boxY - scroll.y; return cbox; };
  // the cost follows the machine: start sharp and, while the hero's frames are what holds the page back, step down a
  // rung at a time: the pixel ratio to 1, then thinner moss and grass, then below 1, then a smaller shadow map. What
  // counts is what a frame costs, not the pace frames come at: a 30 fps cap (Low Power Mode, Energy Saver, a 30 Hz
  // screen) or a busy main thread spaces them out however light they are. So a spell of frames that come late (median
  // interval over 24 ms, or clearly over the pace the page was last found to keep anyway) is put to the test: six
  // frames skip the draw, six draw, and only if the bare ones came clearly sooner is the hero the cost; if not, that
  // pace is the page's own, and is left alone once a second test running says so (one may have caught a hitch). A
  // rung that costs detail waits for two slow spells in a row, and nothing counts until the intro has settled
  // (shaders warming up). The hero's own work (its script and the submission) counts at once when it fills most of a
  // 60 Hz frame, for the one rung that saves any of it, the thinning.
  // The test can't tell where in the draw the cost is: on a slow CPU with a capable GPU it is the submission, and
  // fewer pixels save nothing there. So a step a test took is checked on the two tests after it: the frames (the pace
  // of the spells before them, every frame drawn) and the hero's share of them (that less their bare frames, pooled)
  // must both come in a twentieth of a frame under what they were in the tests that pinned the step (that share taken
  // as at least the quarter of a frame a pin implies). A check asks for a test after every spell, but one after a
  // spell that wasn't late pins nothing. A run that paid is kept, and the next step is taken if the hero pinned the
  // second test, or the first with the second late all the same (a load arriving between them would hide the hero's
  // cost, and pass for the page's own pace). Unpaid, with both pinned, the next step is taken at once against the same
  // baseline: a GPU paced in whole frames may need more than one before a frame comes a vsync sooner (the thinning
  // saves GPU work too, the moss's layers most). If it pins one or neither, two more tests are taken, once (a build
  // or a hitch slows the page's own frames too), and then the run is kept as it stands: there is no telling what it
  // saves, and keeping it is what no check would do. If it pins both after the last step there is, the run hasn't
  // paid and the hero's own work fills a quarter of a frame or more, every GPU step of it is undone, back to the value
  // it had, and none is taken again (with less, the hero's script can't be the cost: a load landing on the tests reads
  // the same, and the run is kept). Either way a run that hasn't paid gives the thinning back (for good) unless a
  // spell after it came a hundredth sooner than the ones just before it: detail goes only for frames. An undo is
  // watched from then on: two spells in a row a tenth slower than the quicker of the run's last two say the GPU was
  // the cost after all (a step that pays saves a vsync on a screen paced in whole frames, less on one that isn't; a
  // spell's median strays by less than a tenth), and the run's end is put back, with no more checks from then on.
  // From the fifth spell it takes three in a row a fifth slower: a GPU that slows down later (heat, another app on
  // it) gets the steps back too. A new size voids what was measured at the old one: an open check
  // is kept, a watch ends, and retired GPU steps come back. Short of that, nothing see-saws: one undo at most, and one
  // putting back.
  const quality = { dpr: dpr(low ? 1.25 : 1.75), rung: 0, on: false, slow: 0, pins: [], at: 0, iv: [], sum: 0, work: [], testing: false, tested: [], pace: 0, free: false, late: 0, check: null, watch: null, gpu: true, checks: true, area: 0 };
  once('intro:done', () => setTimeout(() => { quality.on = true; }, 2500));
  const setDpr = (v) => { quality.dpr = v; fit(); };
  const setShadow = (n) => { sun.shadow.mapSize.set(n, n); sun.shadow.map?.dispose(); sun.shadow.map = null; };
  // (each rung returns its undo; a shadow map built at 1024 has no rung)
  const rungs = [
    () => {
      const was = [shells.map((m) => [m.geometry.instanceCount, m.userData.uniforms.uLayers.value]), grass.geometry.instanceCount, clumpsMesh.count];
      for (const m of shells) { const k = Math.max(6, Math.round(m.geometry.instanceCount * 0.65)); m.geometry.instanceCount = k; m.userData.uniforms.uLayers.value = k; }
      grass.geometry.instanceCount = Math.round(grass.geometry.instanceCount * 0.45);   // placed at random: thins evenly
      clumpsMesh.count = Math.round(CLUMPS * 0.6);
      return () => { shells.forEach((m, i) => { [m.geometry.instanceCount, m.userData.uniforms.uLayers.value] = was[0][i]; }); [, grass.geometry.instanceCount, clumpsMesh.count] = was; };
    },
    // (below 1 only for a cost the test has pinned on the hero, after the thinning: pixels are what the stone and
    // moss shaders cost most by, and the antialiasing keeps 0.75 clean)
    () => { const was = quality.dpr; setDpr(Math.min(was, 0.75)); return () => setDpr(was); },
    ...(low ? [] : [() => { const was = sun.shadow.mapSize.x; setShadow(1024); return () => setShadow(was); }]),
  ];
  const top = () => (quality.gpu ? rungs.length : 1);   // with the GPU steps retired, only the thinning is left
  const done = () => quality.rung >= top() && !quality.check && !quality.watch;
  const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  // slow: slow spells in a row (a test that pinned the hero, or its own work over 12 ms); pins: what each such test
  // saw (the pace of the spell before it, then its bare frames), a check's baseline. A step starts the run over
  const fresh = () => { quality.slow = 0; quality.pins.length = 0; };
  const paceOf = (seen) => mean(seen.map((t) => t[0]));
  const share = (seen) => paceOf(seen) - median(seen.flatMap((t) => t.slice(1)));   // (the bare frames pooled)
  // the next step down, if one is left (a rung waits for two slow spells); true if one was taken. It joins the open
  // check, or opens one on the tests that pinned it, while steps are still checked; the thinning keeps aside the pace
  // just before it
  const stepDown = () => {
    const ratio = renderer.getPixelRatio(); let undo, thin;
    if (ratio > 1 && quality.gpu) {
      const was = quality.dpr, d = Math.min(was, ratio) - 0.35;
      setDpr(d < 1.25 ? 1 : d); undo = () => setDpr(was);   // (no last step too small to check)
    } else if (quality.rung < top() && quality.slow >= 2) {
      const r = quality.rung++, u = rungs[r]();
      if (r) undo = () => { u(); quality.rung = r; }; else thin = { undo: u, pace: paceOf(quality.pins) };
    } else return false;
    if ((undo || thin) && quality.checks) {
      if (!quality.check) {
        // (what the run must come in under: the frame, and the hero's share of it, in the tests that pinned the step,
        // less a twentieth of that frame)
        const p = quality.pins, pace = paceOf(p), cut = pace / 20;
        quality.check = { frame: pace - cut, share: Math.max(share(p), pace / 4) - cut, undo: [], thin: null, after: [], again: false };
      }
      if (undo) quality.check.undo.push(undo); else quality.check.thin = thin;
    }
    fresh();
    return true;
  };
  const restart = () => { quality.at = 0; quality.iv.length = 0; quality.sum = 0; quality.work.length = 0; quality.testing = false; };
  // a new size (over a twentieth more or fewer pixels) voids what was measured at the old one: an open check is kept,
  // a watch ends, retired GPU steps come back (a pixel costs more, or less, now), and the spell or test under way
  // starts over
  const resized = () => {
    quality.area = W * H; quality.check = null; quality.watch = null; quality.gpu = true; fresh();
    quality.iv.length = 0; quality.sum = 0; quality.work.length = 0; quality.testing = false;
  };
  // a watched undo was a mistake: the run's end, exactly, and no more checks
  const putBack = (w) => {
    if (quality.dpr !== w.dpr) setDpr(w.dpr);
    if (sun.shadow.mapSize.x !== w.shadow) setShadow(w.shadow);
    if (w.thin) rungs[0]();
    quality.rung = w.rung; quality.gpu = true; quality.checks = false; quality.watch = null; fresh();
  };
  // asked at the start of each moving frame; true: skip this frame's draw (a test is on). Intervals are read off the
  // clock, not the loop's dt, which is capped at 50 ms (and smoothed by GSAP after a long gap).
  const watchFrame = (now) => {
    const iv = quality.at ? now - quality.at : 0; quality.at = now;
    if (calm || !quality.on || !iv || iv > 5000) return false;   // (a gap: the loop stopped)
    if (Math.abs(W * H / quality.area - 1) > 0.05) resized();
    if (done()) return false;
    if (quality.testing) {
      // the frame that began the test and the next five go bare, the next six draw: each half judged on its last
      // four intervals (the GPU may still be catching up at the switch), side by side, so a spell that has just
      // passed (a build, a hitch) reads as nothing
      const k = quality.tested.push(iv);
      if (k < 12) return k < 6;
      quality.testing = false;
      const bare = median(quality.tested.slice(2, 6)), full = median(quality.tested.slice(8)), c = quality.check;
      // due: the spell before was late, as a test without a check always follows; pinned: the hero is the cost
      const due = quality.late > Math.max(24, quality.pace * 1.25), pinned = due && full > 24 && bare < full * 0.75;
      const seen = [quality.late, ...quality.tested.slice(2, 6)];
      if (pinned) { quality.slow++; quality.pins.push(seen); } else fresh();
      let more = false;   // (a paid run: its first test's pin, when the second came late without one, still steps)
      if (c) {
        if (c.after.push(seen) < 2) { c.first = pinned; return false; }   // (a check is judged on two tests)
        const paid = paceOf(c.after) < c.frame && share(c.after) < c.share, quick = Math.min(c.after[0][0], c.after[1][0]);
        const thin = !paid && c.thin && quick > c.thin.pace * 0.99 ? c.thin.undo : null;   // (given back with an unpaid run)
        if (paid && c.first && !pinned && due) { more = true; quality.slow = 1; quality.pins.push(c.after[0]); }
        c.after.length = 0;
        if (paid) quality.check = null;   // the run paid: kept
        else if (quality.slow >= 2) {   // the hero pinned in both
          if (stepDown()) return false;   // the next step, against the same baseline
          if (quality.hw < quick / 4) { if (thin) thin(); quality.check = null; return false; }   // too little hero work to be the cost: kept
          // none left, and nothing paid: not the GPU. Undone, and watched (the run's end kept to put back)
          quality.watch = { dpr: quality.dpr, shadow: sun.shadow.mapSize.x, rung: quality.rung, thin: !!thin, bar: quick * 1.1, n: 0, over: 0 };
          for (const u of c.undo.reverse()) u();
          if (thin) thin();
          quality.check = null; quality.gpu = false; fresh(); return false;
        } else if (!c.again) { c.again = true; return false; }   // two more tests, once
        else { if (thin) thin(); quality.check = null; }   // still no telling: kept
      }
      // own: the second test running to find the page's own pace (a check's tests aside: they follow its steps)
      const own = !more && !pinned && due && full > 24 && quality.free;
      quality.free = !more && !pinned && due && full > 24;
      if (pinned) stepDown();
      else if (more && !stepDown()) fresh();
      else if (own) quality.pace = full;
      return false;
    }
    quality.iv.push(iv); quality.sum += iv;
    if (quality.iv.length < 45 && !(quality.iv.length >= 10 && quality.sum > 3000)) return false;   // 45 frames, or 3 s
    const late = median(quality.iv), work = quality.work.length ? median(quality.work) : 0, w = quality.watch;
    quality.hw = work;   // (the hero's own work in the last spell)
    quality.iv.length = 0; quality.sum = 0; quality.work.length = 0;
    if (quality.pace && late < quality.pace * 0.8) quality.pace = 0;   // the page is quicker again: forget its old pace
    if (w) {   // (an undo on watch: spells only, no tests)
      const long = w.n >= 4;   // (from the fifth spell on: three in a row a fifth slower, a slowdown that lasts)
      w.over = late > (long ? w.bar * 12 / 11 : w.bar) ? w.over + 1 : 0;
      if (w.over >= (long ? 3 : 2)) putBack(w); else w.n++;
      return false;
    }
    if (work > 12 && !quality.rung && !quality.check) { if (++quality.slow >= 2) { rungs[quality.rung++](); fresh(); } return false; }
    if ((quality.check || late > Math.max(24, quality.pace * 1.25)) && !wheel.dragging) { quality.testing = true; quality.tested.length = 0; quality.late = late; return true; }
    quality.free = false; fresh();
    return false;
  };
  const frameCost = (ms) => { if (quality.on && !quality.testing && !done() && !calm) quality.work.push(ms); };
  function fit() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cbox.left = r.left; cbox.width = r.width; cbox.height = r.height; boxY = r.top + scrollY;
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
    camera.updateMatrixWorld();   // placeClumps casts rays from it, and before the first render it is still unset
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
    const r = rect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (wheel.dragging) {
      const a = angleAt(x, y); let da = a - wheel.last; da = Math.atan2(Math.sin(da), Math.cos(da));
      wheel.last = a; wheel.a += da; wheel.v = da * 60; wheel.turned += Math.abs(da);
      return;
    }
    const over = !motion.paused && overWheel(x, y);   // paused, the wheel can't turn: no grab
    if (over !== hovering) { hovering = over; canvas.classList.toggle('is-grab', over); emit('cursor', over ? 'Drag to spin' : null); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (motion.paused || !overWheel(x, y)) return;   // (a turn nothing shows would open the vault on resume)
    wheel.dragging = true; wheel.last = angleAt(x, y); wheel.turned = 0;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-grabbing'); emit('cursor', 'Keep turning');
    e.preventDefault();
  });
  const release = () => { if (!wheel.dragging) return; wheel.dragging = false; canvas.classList.remove('is-grabbing'); emit('cursor', hovering ? 'Drag to spin' : null); };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { if (!wheel.dragging && hovering) { hovering = false; canvas.classList.remove('is-grab'); emit('cursor', null); } });
  // without a drag (keyboard, touch, or just curiosity): the face in the threat card gives the wheel a turn
  if (!calm) on('vault:spin', () => { wheel.v += 14; wheel.turned += 7.5; });

  // ---- scroll and pointer ----
  const look = { x: 0, y: 0 };
  const pushWorld = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6);
  const still = calm || motion.paused || /[?&]still/.test(location.search);   // paused: nothing would rise it
  let intro = still ? 1 : 0;
  once('hero:rise', () => { intro = 1; });
  const rise = { v: still ? 1 : 0 };

  let t = 0;
  function frame(dt) {
    const t0 = performance.now();
    const held = dt > 0 && watchFrame(t0);   // a test may hold this draw back (see quality); a still frame (dt 0) never
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
      const r = rect();
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
        pw = toWorld(pointer.x, pointer.y, rect(), new THREE.Vector3());
      }
      for (let i = 0; i < clumpsMesh.count; i++) {
        const c = clumpState[i];
        const home = c.home;
        const fx = Math.sin(t * (0.4 + c.drift) + c.spin) * (c.loose ? 0.02 : 0.003);
        const fy = Math.cos(t * (0.3 + c.drift * 0.5) + c.spin) * (c.loose ? 0.018 : 0.002);
        c.vel.x += (home.x + fx - c.pos.x) * 18 * dt; c.vel.y += (home.y + fy - c.pos.y) * 18 * dt; c.vel.z += (home.z - c.pos.z) * 18 * dt;
        if (pw) {
          const dx = c.pos.x - pw.x, dy = c.pos.y - pw.y; const d2 = dx * dx + dy * dy;
          if (d2 < 0.04) { const f = (0.04 - d2) * 60 * dt; c.vel.x += dx * f * 8; c.vel.y += dy * f * 8; c.vel.z += f * 0.5; }
        }
        c.vel.multiplyScalar(Math.exp(-5 * dt));
        c.pos.addScaledVector(c.vel, dt);
        e.set(c.spin + t * 0.2 * c.drift, c.spin * 2, 0); q.setFromEuler(e);
        const appear = clamp(rise.v * 1.6 - (c.group ? 0.3 : 1 - c.s) * 0.6, 0, 1);   // the band from its head out
        sc.setScalar(c.size * appear);
        m.compose(c.pos, q, sc); clumpsMesh.setMatrixAt(i, m);
      }
      clumpsMesh.instanceMatrix.needsUpdate = true;
    }

    if (held) return;
    renderer.render(scene, camera);
    if (dt > 0) frameCost(performance.now() - t0);
  }

  // the light inside the vault, seen when the door swings
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.44, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.8), transparent: true, opacity: 0, toneMapped: false }));
  glow.position.set(0, -0.11, -0.02); ringGroup.add(glow);

  // ---- run ----
  const run = loop(frame);
  fit();
  // warm the shaders up before the first frame is shown (in parallel where the browser can); only then may the
  // loop start, or its first frame would compile them all at once and stall the intro
  await breathe();
  if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  // refit on a real change of size or place: the canvas, and the anchor (in a short window the canvas holds at the
  // hero's min-height while the ring still moves). Scrolled away, the refit waits until the hero is back. A fit
  // clears the canvas, and an observer runs after the frame's loop has drawn (or with motion paused, none will): so
  // a still frame (dt 0) is drawn at once, or the frame would show the hero blank.
  let shown = false, stale = false;
  whenVisible(hero, (v) => {
    shown = v;
    if (v && stale) { stale = false; fit(); if (!calm) frame(0); }
    if (v && !run.on) restart();   // (the gap is no frame's interval)
    run.set(v && !calm);
    if (v && calm) frame(0.016);
  }, '0px');
  const ro = new ResizeObserver(() => { if (!shown) { stale = true; return; } fit(); frame(0); });
  ro.observe(canvas); ro.observe(anchor);
  // motion paused before the ring has risen (during the intro, or with the rise under way): nothing would rise it now,
  // so it stands risen, as the page's assembly does. Resumed: the pause is no frame's interval
  const settle = () => { if (motion.paused && intro && rise.v < 1) { rise.v = 1; if (shown) frame(0); } };
  once('hero:rise', settle);
  on('motion', (m) => {
    if (!m.paused) { restart(); return; }
    settle();
    if (hovering) { hovering = false; canvas.classList.remove('is-grab'); emit('cursor', null); }
  });
  // a lost context comes back without the sky's light (three cannot refill a render target): bake it again, and
  // redraw at once
  canvas.addEventListener('webglcontextrestored', () => { scene.environment = K.skyEnvironment(renderer); if (shown) frame(0); });
  frame(0.016);
  hero.classList.add('has-gl');
  canvas.classList.add('is-on');
  if (calm) { frame(0); }
  emit('hero:gl', { canvas });
  document.fonts?.ready.then(() => { fit(); if (shown || calm) frame(0); });
  once('intro:done', () => setTimeout(() => { placeClumps(); if (motion.paused && shown) frame(0); }, 1800));
  return { rise: () => emit('hero:rise') };
}
