// The way in. First visit: on black, four corners of a reticle and a count while the optics calibrate (the shader
// compiles). Then the corners fly out to become the product frame, the black lifts, and the rider develops out of
// type, top to bottom, as the camera settles; the page assembles round him. A repeat visit or a deep link gets the
// short version; reduced motion gets none.

import { gsap, calm, ready, lock, unlock, markReady, root, once, emit } from './core.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function init(stagePromise) {
  const loader = document.querySelector('.loader');
  if (calm || !gsap) { loader?.remove(); markReady(); return; }
  const first = !root.classList.contains('is-repeat');
  const deep = location.hash.length > 1;
  if (!deep) lock();

  const count = loader?.querySelector('[data-count]');
  const c = { v: 0 };
  const setCount = () => { if (count) count.textContent = String(Math.round(c.v)).padStart(3, '0'); };
  if (first && loader) gsap.to(c, { v: 86, duration: 1.3, ease: 'power2.out', onUpdate: setCount });

  const stage = await Promise.race([stagePromise, wait(7000)]);
  const rider = stage?.rider;
  await ready;
  // wait for the first full frame (or give up and show the picture)
  if (rider) await Promise.race([new Promise((r) => once('stage:drawn', r)), wait(first ? 6000 : 3000)]);

  const st = stage?.st;
  if (rider) {
    rider.post.ascii = 1; rider.post.sweep = 0; rider.post.fade = first ? 0 : 0.4;
    st.intro.dist = first ? 4.5 : 2; st.intro.el = first ? 6 : 3;
    stage.kick();
  }

  const ALL = '.title__in, .vault, .viewer, .buy, .side, .colors, .cam, .hero__horizon, .nav__logo, .nav__links > *, .nav__icons > *';
  const PARTS = '.reticle .ruler, .arrow, .rating__stars svg, .rating__num, .acc__item, .compare, .swatch, .buy .cta';
  gsap.set(ALL, { opacity: 1 });   // the stylesheet holds them back until now; the tweens below start them from nothing
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onUpdate: () => stage?.kick(),
    onComplete() {
      loader?.remove();
      markReady();
      gsap.set(`${ALL}, ${PARTS}`, { clearProps: 'all' });
      if (!deep) unlock();
    },
  });

  // ---- the loader hands over
  let t = 0;
  if (first && loader) {
    tl.to(c, { v: 100, duration: 0.35, ease: 'power1.in', onUpdate: setCount }, 0);
    tl.to(loader.querySelectorAll('.loader__logo, .loader__meta'), { opacity: 0, y: -6, duration: 0.4, ease: 'power2.in' }, 0.35);
    const fr = document.querySelector('[data-frame]').getBoundingClientRect();
    const box = loader.querySelector('.loader__frame');
    tl.to(box, { left: fr.left, top: fr.top, width: fr.width, height: fr.height, translate: '0 0', duration: 1.05, ease: 'expo.inOut' }, 0.45);
    tl.to(loader, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.8, ease: 'power2.inOut' }, 0.8);
    tl.to(box.querySelectorAll('.c'), { opacity: 0, duration: 0.4 }, 1.55);
    t = 0.9;
  } else if (loader) loader.remove();

  // ---- the picture develops out of type, top to bottom, as the camera settles
  if (rider) {
    tl.to(rider.post, { fade: 1, duration: first ? 1.1 : 0.6, ease: 'power2.out' }, t);
    tl.to(rider.post, { sweep: 1.08, duration: first ? 1.9 : 1.1, ease: 'power2.inOut' }, t + 0.15);
    tl.to(st.intro, { dist: 0, el: 0, duration: first ? 2.6 : 1.6, ease: 'expo.out' }, t);
    tl.set(rider.post, { ascii: 0, sweep: 1 }, t + (first ? 2.1 : 1.3));
  }

  // ---- the page assembles
  const a = t + (first ? 0.55 : 0.1);
  tl.from('.nav__logo', { opacity: 0, x: -10, duration: 0.8 }, a);
  tl.from('.nav__links > *', { opacity: 0, y: -8, duration: 0.7, stagger: 0.05 }, a + 0.05);
  tl.from('.nav__icons > *', { opacity: 0, y: -8, duration: 0.7, stagger: 0.06 }, a + 0.15);
  tl.from('.title__in', { yPercent: 105, duration: 1.15, ease: 'expo.out', stagger: 0.09 }, a + 0.1);
  tl.from('.vault', { opacity: 0, y: 14, duration: 0.9 }, a + 0.45);
  tl.from('.viewer', { opacity: 0, duration: 0.5 }, first ? 1.55 : a + 0.2);
  tl.from('.reticle .ruler', { scale: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, first ? 1.6 : a + 0.25);
  tl.from('.arrow', { opacity: 0, scale: 0.6, duration: 0.7, stagger: 0.08, ease: 'back.out(2)' }, first ? 1.75 : a + 0.35);
  tl.from('.buy', { opacity: 0, y: 18, duration: 0.9 }, a + 0.35);
  tl.from('.buy .cta', { clipPath: 'inset(0 100% 0 0)', duration: 0.9, ease: 'expo.inOut' }, a + 0.55);
  tl.from('.side', { opacity: 0, duration: 0.4 }, a + 0.25);
  tl.from('.rating__stars svg', { scale: 0, rotate: -90, duration: 0.6, stagger: 0.06, ease: 'back.out(2.5)' }, a + 0.3);
  tl.from('.rating__num', { opacity: 0, x: -6, duration: 0.6 }, a + 0.55);
  tl.call(() => emit('intro:roll'), null, a + 0.35);
  tl.from('.acc__item, .compare', { opacity: 0, x: 22, duration: 0.8, stagger: 0.07 }, a + 0.45);
  tl.from('.colors', { opacity: 0, y: 30, duration: 1 }, a + 0.5);
  tl.from('.swatch', { opacity: 0, y: 14, duration: 0.8, stagger: 0.07 }, a + 0.7);
  tl.from('.cam', { opacity: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.12, ease: 'power2.out' }, a + 0.6);
  tl.from('.hero__horizon', { scaleX: 0, duration: 1.6, ease: 'expo.inOut' }, a + 0.2);
}
