// The way in. First visit: a vault dial turns while the page loads, counting to 100; it clicks, the screen lifts
// away, and the hero assembles: the letters rise out of the baseline, the ring and its garden grow up out of the mound,
// the copy and the threat card arrive, the header drops in. A repeat visit (or a deep link) skips the dial.

import { root, calm, gsap, gl, lock, unlock, ready, markReady, emit, once, scrollToTarget } from './core.js';

export async function init() {
  const intro = document.querySelector('[data-intro]');
  const letters = document.querySelectorAll('.hero__letters > span');
  const copy = document.querySelectorAll('.hero__copy > *');
  const card = document.querySelector('.widget--threat');
  const navBits = document.querySelectorAll('.nav > *:not(.nav__progress)');
  if (calm || !gsap) { markReady(); emit('hero:rise'); return; }
  const repeat = root.classList.contains('is-repeat');

  // the hero's resting state is hidden by CSS until ready; GSAP takes over from here
  gsap.set(letters, { yPercent: 105 });
  gsap.set(copy, { y: 24, opacity: 0 });
  gsap.set(card, { x: 60, rotateY: -25, opacity: 0, transformPerspective: 900 });
  gsap.set(navBits, { y: -24, opacity: 0 });

  if (!repeat && intro) {
    lock();
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    // the dial: sixty ticks, every fifth long
    const svg = intro.querySelector('[data-intro-ticks]');
    let marks = '';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2; const long = i % 5 === 0;
      const r0 = long ? 72 : 80, r1 = 92;
      marks += `<line x1="${100 + Math.cos(a) * r0}" y1="${100 + Math.sin(a) * r0}" x2="${100 + Math.cos(a) * r1}" y2="${100 + Math.sin(a) * r1}" opacity="${long ? 1 : 0.45}"/>`;
    }
    svg.innerHTML = marks;
    const count = intro.querySelector('[data-intro-count]');
    const p = { v: 0 };
    // count to 100 no faster than 1.6 s, and not past 90 until the fonts and the 3D are in
    let glReady = !gl || !document.querySelector('[data-hero-gl]');
    once('hero:gl', () => { glReady = true; });
    setTimeout(() => { glReady = true; }, 4500); // a slow machine still gets in; the ring rises when it is ready
    const spin = gsap.to(svg, { rotate: 360, duration: 6, ease: 'none', repeat: -1 });
    gsap.from([svg, intro.querySelector('.intro__mark')], { scale: 0.8, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1 });
    await new Promise((res) => {
      const t = gsap.to(p, {
        v: 90, duration: 1.6, ease: 'power2.inOut',
        onUpdate: () => { count.textContent = String(Math.round(p.v)).padStart(3, '0'); },
        onComplete: async () => {
          await ready;
          const wait = () => (glReady ? 0 : new Promise((r) => { const id = setInterval(() => { if (glReady) { clearInterval(id); r(); } }, 60); }));
          await wait();
          gsap.to(p, { v: 100, duration: 0.45, ease: 'power2.out', onUpdate: () => { count.textContent = String(Math.round(p.v)).padStart(3, '0'); }, onComplete: res });
        },
      });
      void t;
    });
    // click: the dial snaps a notch, the mark turns, the screen lifts
    spin.kill();
    const out = gsap.timeline();
    out.to(svg, { rotate: '+=48', duration: 0.5, ease: 'back.out(3)' })
      .to(intro.querySelector('.intro__mark'), { rotate: 135, scale: 1.25, duration: 0.6, ease: 'expo.inOut' }, 0)
      .to([svg, intro.querySelector('.intro__mark'), intro.querySelector('.intro__count')], { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in' }, 0.45)
      .to(intro, { clipPath: 'inset(0 0 100% 0)', duration: 1.0, ease: 'expo.inOut' }, 0.6);
    await new Promise((r) => setTimeout(r, 900));
    intro.classList.add('is-leaving');   // still on screen while it lifts, though the page is now ready
    unlock();
    markReady();
    out.eventCallback('onComplete', () => intro.remove());
  } else {
    await ready;
    markReady();
    intro?.remove();
    if (location.hash.length > 1) { const t = document.querySelector(location.hash); if (t) setTimeout(() => scrollToTarget(t, { immediate: true }), 50); }
  }

  // the hero assembles
  emit('hero:rise');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(letters, { yPercent: 0, duration: 1.5, stagger: 0.07 }, 0)
    .to(navBits, { y: 0, opacity: 1, duration: 1.1, stagger: 0.06 }, 0.25)
    .to(copy, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.55)
    .to(card, { x: 0, rotateY: 0, opacity: 1, duration: 1.4 }, 0.6)
    .add(() => { gsap.set([...letters, ...copy, card, ...navBits], { clearProps: 'transform,opacity' }); });
}
