// The entrance. First visit: the screen is the hero's own orange; the collection counts up (01 … 06) while the
// photographs load, then the number flies to its place in the hero, the orange draws back to uncover the header, and
// the hero assembles: rules draw, the ring closes, the sprinter streaks in, the man rises, the headline climbs out of
// its lines. A repeat visit (or a deep link) skips the count. Reduced motion: everything is simply there.
import { calm, gsap, ready, markReady, lock, unlock, root } from './core.js';

export async function init(hero) {
  const h = document.querySelector('.hero');
  const loader = document.querySelector('.loader');
  const repeat = root.classList.contains('is-repeat');
  hero = hero || { reveal: () => {}, ready: Promise.resolve(), set: () => {} };

  // masks for the headline's lines
  for (const line of h.querySelectorAll('.hero__title .line')) {
    const inner = document.createElement('span');
    inner.className = 'line__in';
    inner.append(...line.childNodes);
    line.append(inner);
    line.style.overflow = 'hidden';
    line.style.paddingTop = '0.06em';
    line.style.marginTop = '-0.06em';
    inner.style.display = 'block';
  }

  if (calm || !gsap) {
    hero.set(1);
    loader?.remove();
    markReady();
    return;
  }

  const ring = h.querySelector('.hero__ring circle');
  const q = (s) => h.querySelectorAll(s);
  hero.set(0);
  gsap.set(ring, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.set(q('.hero__vline'), { scaleY: 0 });
  gsap.set(q('.hero__hline'), { scaleX: 0 });
  gsap.set(q('.hero__orbit'), { opacity: 0 });
  gsap.set(q('.hero__tag, .hero__intro, .hero__meta, .hero__aside'), { opacity: 0, y: 14 });
  gsap.set(q('.hero__title .line__in'), { yPercent: 105 });

  const assemble = (delay = 0) => {
    const tl = gsap.timeline({ delay, onComplete: markReady });
    tl.add(() => root.classList.add('is-ready'), 0)
      .add(() => hero.reveal(1.7), 0)
      .to(q('.hero__vline'), { scaleY: 1, duration: 1.4, ease: 'expo.inOut' }, 0)
      .to(q('.hero__hline'), { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, 0.1)
      .to(ring, { strokeDashoffset: 0, duration: 2.2, ease: 'expo.inOut' }, 0.05)
      .to(q('.hero__orbit'), { opacity: 1, duration: 0.6 }, 1.6)
      .to(q('.hero__title .line__in'), { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.09 }, 0.55)
      .to(q('.hero__tag, .hero__intro, .hero__meta'), { opacity: 1, y: 0, duration: 0.9, stagger: 0.05 }, 0.8)
      .to(q('.hero__aside'), { opacity: 1, y: 0, duration: 0.9 }, 1.05);
    return tl;
  };

  // ---- repeat visit: the hero assembles on its own ----
  if (repeat || !loader) {
    loader?.remove();
    const num = h.querySelector('.hero__num');
    gsap.fromTo(num.children, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.25 });
    await Promise.race([hero.ready, new Promise((r) => setTimeout(r, 1500))]);
    assemble(0.05);
    return;
  }

  // ---- first visit: count the collections in while the photographs load ----
  lock();
  scrollTo(0, 0);
  const count = loader.querySelector('.loader__count');
  const bar = loader.querySelector('.loader__bar');
  const tag = loader.querySelector('.loader__tag');
  const state = { p: 0 };
  let loaded = false;
  Promise.all([hero.ready, ready]).then(() => { loaded = true; });
  const MIN = 1.6; // seconds: long enough to read, short enough not to wait on
  const started = performance.now();
  let last = started;
  await new Promise((done) => {
    const tick = (now) => {
      const t = (now - started) / 1000;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const goal = loaded ? 1 : Math.min(0.85, t / 4); // creeps while waiting, then runs home
      const cap = Math.min(1, t / MIN);
      const want = Math.min(goal, cap);
      state.p = Math.min(want, state.p + dt * (want - state.p > 0.2 ? 1.6 : 0.9)); // steady, never ahead of the load
      if (goal === 1 && cap === 1 && state.p > 0.985) state.p = 1;
      const n = Math.min(6, Math.floor(state.p * 6.999));
      const label = String(n).padStart(2, '0');
      if (count.textContent !== label) count.textContent = label;
      bar.style.setProperty('--p', state.p.toFixed(3));
      tag.textContent = `Offform research dept. — loading collection ${label} / 06`;
      if (state.p >= 1) done(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // ---- hand over: the number flies into the hero, the orange draws back to the hero's top edge ----
  const from = loader.querySelector('.loader__num');
  const to = h.querySelector('.hero__num');
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const heroTop = h.getBoundingClientRect().top;
  const tl = gsap.timeline({ onComplete: () => { loader.remove(); unlock(); } });
  tl.to(bar, { scaleX: 0, transformOrigin: 'right', duration: 0.5, ease: 'expo.in' }, 0)
    .to(tag, { opacity: 0, duration: 0.3 }, 0)
    .to(from, {
      x: b.right - a.right, y: b.bottom - a.bottom, scale: b.height / a.height, transformOrigin: '100% 100%',
      duration: 1.15, ease: 'expo.inOut',
    }, 0.1)
    .to(loader, { clipPath: `inset(${heroTop}px 0 0 0)`, duration: 1.15, ease: 'expo.inOut' }, 0.1)
    .add(() => { to.style.visibility = 'visible'; for (const s of to.children) s.style.visibility = 'visible'; }, 1.25)
    .to(loader, { opacity: 0, duration: 0.01 }, 1.26);
  assemble(0.75);
}
