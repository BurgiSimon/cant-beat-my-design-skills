// The small things. Links roll up into a white copy of themselves; the social boxes lean toward the pointer and light
// a ring of the road's colours; the mark turns its chrome to the pointer and spins when the logo is touched; a glint of
// light rides the rule and waits under the pointer when it comes near; the heart beats, and a click sends a few hearts
// up. Over the road the pointer is a lamp (the lines brighten under it, the dust parts round it) and holding it down
// floors the throttle: the road streams, the stars streak, the car squats and shakes, the dust pours (Space too, once
// the footer is the screen).

export function details(scene, { calm, wide, foot }) {
  const gsap = window.gsap;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  // ---- links: the text in a box that rolls ----
  for (const a of foot.querySelectorAll('.col a')) {
    const t = a.textContent;
    a.innerHTML = `<span class="roll"><span>${t}</span></span>`;
  }

  // ---- the heart: a click sends a few hearts up, in the road's colours (at rest, it simply fills). It is disabled in
  // the markup, so without scripts it is no dead button in the Tab order; here it comes alive. ----
  const heart = foot.querySelector('.heart');
  if (heart) {
    const COLORS = ['#ff3b5c', '#ff7ad9', '#ffb13d', '#23d3ff', '#3a6dff', '#20d69b'];
    heart.disabled = false;
    heart.addEventListener('click', () => {
      heart.classList.add('is-loved');
      heart.setAttribute('aria-label', 'Love sent');
      if (calm || !gsap) return;
      gsap.fromTo(heart, { scale: 0.7 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.35)' });
      const r = heart.getBoundingClientRect();
      for (let i = 0; i < 12; i++) {
        const s = document.createElement('span');
        s.className = 'spark';
        s.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20s-7.6-4.5-7.6-10A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.6 2.4c0 5.5-7.6 10-7.6 10Z"/></svg>';
        s.querySelector('path').setAttribute('fill', COLORS[i % COLORS.length]);
        document.body.append(s);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const d = 40 + Math.random() * 70;
        const size = 7 + Math.random() * 9;
        gsap.set(s, { x: r.left + r.width / 2 - size / 2, y: r.top + r.height / 2 - size / 2, width: size, height: size, rotation: (Math.random() - 0.5) * 40 });
        gsap.timeline({ onComplete: () => s.remove() })
          .to(s, { x: `+=${Math.cos(a) * d}`, y: `+=${Math.sin(a) * d}`, duration: 0.9 + Math.random() * 0.5, ease: 'expo.out' }, 0)
          .to(s, { y: '-=24', opacity: 0, duration: 0.7, ease: 'power1.in' }, 0.5);
      }
    });
  }

  if (calm) return;

  // ---- the mark: its chrome turns to the pointer; the logo spins it ----
  const logo = foot.querySelector('.logo');
  const mark = foot.querySelector('.mark');
  if (fine && mark) {
    let ang = 0, want = 0;
    addEventListener('pointermove', (e) => {
      const r = mark.getBoundingClientRect();
      want = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
    }, { passive: true });
    const turn = () => {
      let d = ((want - ang + 540) % 360) - 180;
      ang += d * 0.06;
      mark.style.setProperty('--look', `${ang.toFixed(2)}deg`);
      requestAnimationFrame(turn);
    };
    requestAnimationFrame(turn);
  }
  if (gsap && logo) {
    const letters = () => logo.querySelectorAll('.wordmark .ch');
    let busy = false;
    logo.addEventListener('pointerenter', () => {
      if (busy) return;
      busy = true;
      gsap.timeline({ onComplete: () => { busy = false; } })
        .fromTo(mark, { rotation: 0 }, { rotation: 360, duration: 1.1, ease: 'expo.inOut' }, 0)
        .to(letters(), { yPercent: -18, duration: 0.28, stagger: 0.03, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.05);
    });
  }

  // ---- social boxes: magnetic ----
  if (fine && gsap) {
    for (const a of foot.querySelectorAll('.social a')) {
      const x = gsap.quickTo(a, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(a, 'y', { duration: 0.5, ease: 'power3.out' });
      a.addEventListener('pointermove', (e) => {
        const r = a.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.28);
        y((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      a.addEventListener('pointerleave', () => { gsap.to(a, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }); });
    }
  }

  // ---- the rule: a glint that sweeps along it now and then, and waits under the pointer when it is near ----
  const rule = foot.querySelector('.rule');
  if (rule && gsap) {
    const g = { x: -200, o: 0 };
    const apply = () => { rule.style.setProperty('--gx', `${g.x}px`); rule.style.setProperty('--go', g.o); };
    let near = false, sweeping = null;
    const sweep = () => {
      if (near) return;
      const w = rule.offsetWidth;
      sweeping = gsap.timeline({ onUpdate: apply })
        .set(g, { x: -120, o: 0 })
        .to(g, { o: 1, duration: 0.3 }, 0)
        .to(g, { x: w + 120, duration: 2.2, ease: 'power2.inOut' }, 0)
        .to(g, { o: 0, duration: 0.4 }, 1.8);
    };
    rule.addEventListener('sweep', sweep);
    // (it loops only beside the moving night, and rests with it: without WebGL, or paused, nothing here keeps moving)
    setInterval(() => { if (!document.hidden && scene && !scene.paused) sweep(); }, 9000);
    if (fine) {
      addEventListener('pointermove', (e) => {
        const r = rule.getBoundingClientRect();
        const was = near;
        near = Math.abs(e.clientY - r.top) < 70 && e.clientX > r.left - 40 && e.clientX < r.right + 40;
        if (near) {
          sweeping?.kill();
          gsap.to(g, { x: e.clientX - r.left, o: 1 - Math.abs(e.clientY - r.top) / 90, duration: 0.6, ease: 'power3.out', onUpdate: apply, overwrite: true });
        } else if (was) gsap.to(g, { o: 0, duration: 0.6, onUpdate: apply, overwrite: true });
      }, { passive: true });
    }
  }

  if (!scene) return;

  // ---- pause: the night moves for as long as it is on screen, so the reader can stop it (and play it again). It
  // rests on the frame it is on; putting the foot down (holding the road, or Space) plays it again. ----
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'pause';
  const PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.6" height="9" rx="0.8"/><rect x="7.4" y="1.5" width="2.6" height="9" rx="0.8"/></svg>';
  const PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L4.1 1.1a.6.6 0 0 0-.9.5Z"/></svg>';
  const showPaused = (on) => {
    pauseBtn.innerHTML = on ? PLAY : PAUSE;
    pauseBtn.setAttribute('aria-label', on ? 'Play the footer animation' : 'Pause the footer animation');
    pauseBtn.classList.toggle('is-paused', on);
  };
  const setPaused = (on) => { if (scene.paused === on) return; scene.pause(on); showPaused(on); };
  showPaused(false);
  pauseBtn.addEventListener('click', () => setPaused(!scene.paused));
  foot.append(pauseBtn);
  // a launch from the page (index.js launch()) is the reader asking for the night to move: it plays again
  addEventListener('crestora:launch', () => setPaused(false));

  // ---- the road: a lamp under the pointer, the throttle under a held button ----
  const road = foot.querySelector('.road');
  const hint = foot.querySelector('.hint');
  const hintText = hint.querySelector('.hint__text');
  let over = false, held = false;
  if (!fine) {
    // no pointer to follow: the hint sits in the road, saying what a finger can do
    road.append(hint);
    hint.classList.add('is-touch');
  }
  const hx = gsap ? gsap.quickTo(hint, 'x', { duration: 0.45, ease: 'power3.out' }) : (v) => { hint.style.left = `${v}px`; };
  const hy = gsap ? gsap.quickTo(hint, 'y', { duration: 0.45, ease: 'power3.out' }) : (v) => { hint.style.top = `${v}px`; };
  let placed = false;
  const onRoad = (e) => {
    if (e.pointerType === 'touch') return false;
    const r = road.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
    const top = document.elementFromPoint(e.clientX, e.clientY);
    return !!top && !top.closest('a, button');
  };
  addEventListener('pointermove', (e) => {
    const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
    scene.parallax(nx, ny);
    over = onRoad(e) || (held && e.pointerType !== 'touch');
    scene.pointer(e.clientX, e.clientY, over && e.pointerType !== 'touch');
    if (fine) {
      if (!placed && gsap) { gsap.set(hint, { x: e.clientX + 18, y: e.clientY + 18 }); placed = true; }
      hx(e.clientX + 18); hy(e.clientY + 18);
      hint.classList.toggle('is-on', over && foot.classList.contains('is-armed'));
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { scene.pointer(0, 0, false); hint.classList.remove('is-on'); scene.parallax(0, 0); });

  const press = (on) => {
    if (held === on) return;
    if (on) setPaused(false);
    held = on;
    scene.boost(on);
    hint.classList.toggle('is-held', on);
    root.classList.toggle('is-boosting', on);
  };
  road.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    press(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'blur']) addEventListener(type, () => press(false));
  road.addEventListener('contextmenu', (e) => e.preventDefault());
  // Space is the throttle too, on the picture layout (where it has no page to scroll)
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !wide.matches || e.target.closest?.('a, button, input, textarea, select, [contenteditable]')) return;
    if (foot.getBoundingClientRect().bottom > innerHeight + 4 || foot.getBoundingClientRect().top > innerHeight * 0.2) return;   // only once the footer is the screen
    e.preventDefault(); press(true);
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space') press(false); });

  // the hint reads out the speed while the throttle is down
  const IDLE = hintText.textContent;
  let shown = '';
  const read = () => {
    const b = scene.boosting;
    const txt = held || b > 0.04 ? `${Math.round(96 + 214 * b)} km/h` : IDLE;
    if (txt !== shown) { hintText.textContent = txt; shown = txt; }
    requestAnimationFrame(read);
  };
  requestAnimationFrame(read);
}
