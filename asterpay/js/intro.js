// The way in. On a first visit: the mark turns in on dark, a count runs to 100, and the mark flies up into its
// place in the header. Then (and straight away on a repeat visit or a deep link) the hero assembles: the light
// rises like a sunrise, the frame draws itself, the rings close from their tops, the headline's words rise out
// of their lines, the figures switch on with their digits rolling, and the phones swing up into their V.

import { gsap, SplitText, calm, ready, lock, unlock, markReady, root, scrollToTarget } from './core.js';

export async function init({ horizon, ticks, odos = [] } = {}) {
  const hero = document.querySelector('.hero');
  if (calm || !gsap || !hero) {
    if (horizon) horizon.state.intro = 1;
    markReady();
    return;
  }
  const first = !root.classList.contains('is-repeat');
  const hash = location.hash.length > 1 ? location.hash : '';
  if (!hash) lock();
  await ready;

  const $ = (s) => hero.querySelectorAll(s);
  const navBits = document.querySelectorAll('.nav__link, .nav__actions > *');
  const brandWord = document.querySelector('.nav .brand__word');
  const title = hero.querySelector('.hero__title');
  let words = [];
  if (SplitText) {
    const split = new SplitText(title.querySelectorAll('.hero__line'), { type: 'words', mask: 'words', wordsClass: 'hero__word' });
    words = split.words;
  }
  const rings = [...$('.ring')];
  const ringDraw = rings.map(() => ({ p: 0 }));
  const setRing = (i) => { const p = ringDraw[i].p; rings[i].setAttribute('stroke-dasharray', `${p} ${1 - p + 0.002}`); rings[i].setAttribute('stroke-dashoffset', `${p / 2}`); };
  rings.forEach((_, i) => setRing(i));

  const tl = gsap.timeline({
    onComplete() {
      document.querySelector('.loader')?.remove();
      markReady();
      if (!hash) unlock();
    },
  });

  let H = 0; // when the hero starts
  if (first) {
    const loader = document.querySelector('.loader');
    const mark = loader.querySelector('.loader__mark');
    const count = loader.querySelector('[data-count]');
    const fill = loader.querySelector('.loader__line i');
    const brandMark = document.querySelector('.nav .brand__mark');
    const n = { v: 0 };
    gsap.set(brandMark, { opacity: 0 });
    tl.fromTo(mark, { rotation: -135, scale: 0.3, opacity: 0 }, { rotation: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out' }, 0)
      .to(n, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: () => { count.textContent = Math.round(n.v); } }, 0.1)
      .to(fill, { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0.1)
      .to([count.parentNode, fill.parentNode], { opacity: 0, y: 10, duration: 0.45, ease: 'power2.in' }, 1.65)
      .add(() => {
        // fly: from the middle of the screen to the header, turning a quarter on the way
        const a = mark.getBoundingClientRect(); const b = brandMark.getBoundingClientRect();
        gsap.to(mark, {
          x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: b.width / a.width, rotation: 90,
          duration: 1.15, ease: 'expo.inOut',
          onComplete: () => { gsap.set(brandMark, { opacity: 1, rotation: 0 }); gsap.set(mark, { opacity: 0 }); },
        });
      }, 1.75)
      .to(loader, { backgroundColor: 'rgba(12, 11, 14, 0)', duration: 1.1, ease: 'power2.inOut' }, 2.05);
    H = 2.05;
  }

  // ---- the hero ----
  if (horizon) { horizon.state.intro = 0; tl.to(horizon.state, { intro: 1, duration: first ? 2.8 : 2.2, ease: 'power2.inOut' }, H); }
  tl.fromTo($('.hero__rule'), { scaleX: 0 }, { scaleX: 1, opacity: 1, duration: 1.5, ease: 'expo.inOut' }, H)
    .fromTo($('.hero__frame .plus'), { opacity: 0, scale: 0, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(2)' }, H + 0.8)
    .fromTo($('.hero__rail'), { scaleY: 0 }, { scaleY: 1, opacity: 1, duration: 1.8, ease: 'expo.inOut' }, H + 0.35)
    .fromTo(navBits, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.05 }, H + 0.3)
    .fromTo(brandWord, { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, first ? H + 0.55 : H + 0.3)
    .fromTo($('.pill'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, H + 0.35)
    .set(title, { opacity: 1 }, H + 0.4)
    .fromTo(words.length ? words : title, { yPercent: 112 }, { yPercent: 0, duration: 1.25, stagger: 0.06, ease: 'expo.out' }, H + 0.45)
    .fromTo($('.hero__sub'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, H + 0.85)
    .fromTo($('.hero__ctas > *'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, H + 0.95)
    .set(rings, { opacity: 1 }, H + 0.5);
  ringDraw.forEach((r, i) => tl.to(r, { p: 1, duration: 2.4, ease: 'power2.inOut', onUpdate: () => setRing(i), onComplete: () => { rings[i].removeAttribute('stroke-dasharray'); rings[i].removeAttribute('stroke-dashoffset'); } }, H + 0.5 + i * 0.25));
  tl.fromTo($('.sats'), { opacity: 0 }, { opacity: 1, duration: 1.2 }, H + 2.2)
    .fromTo($('.tick'), { opacity: 0, scale: 0.86, transformOrigin: '0% 50%' }, {
      opacity: 1, scale: 1, duration: 1, stagger: { each: 0.09, from: 'random' }, ease: 'back.out(1.7)',
      onStart: () => ticks?.forEach((t) => { t.price.scramble(); t.chg?.scramble(); }),
    }, H + 1.25)
    .add(() => ticks?.forEach((t, i) => setTimeout(() => { t.price.set(t.dec ? Math.round(t.v * 10) / 10 : Math.round(t.v)); t.chg?.set(t.c); }, 120 + i * 70)), H + 1.4)
    .fromTo($('.phone--l'), { yPercent: 52, rotation: -2, rotationX: 40, opacity: 1 }, { yPercent: 0, rotation: -12, rotationX: 18, duration: 1.9, ease: 'expo.out' }, H + 0.7)
    .fromTo($('.phone--r'), { yPercent: 58, rotation: 2, rotationX: 40, opacity: 1 }, { yPercent: 0, rotation: 10, rotationX: 18, duration: 1.9, ease: 'expo.out' }, H + 0.8)
    .add(() => odos.forEach((o) => o.odo.scramble()), H + 0.7)
    .add(() => odos.forEach((o) => o.odo.set(o.value())), H + 1.5);
  if (!first) tl.fromTo(document.querySelector('.nav .brand__mark'), { opacity: 0, rotation: -90 }, { opacity: 1, rotation: 0, duration: 1 }, 0.2);
  if (!first) tl.timeScale(1.2);
  if (hash) { tl.progress(1); scrollToTarget(hash, { immediate: true }); }
}
