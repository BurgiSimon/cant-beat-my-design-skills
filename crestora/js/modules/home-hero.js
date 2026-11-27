// Home #top: the hero's night. The headline paints first (core.js lifts its lines out of their mask); then the shared
// lanes canvas (js/gl/lanes.js) comes up behind it: the stars fade in, six threads draw in from the left with a bright
// front, and Night Bloom's chip pops onto the Spark thread and rides it. The pointer is a lamp that parts the threads;
// scrolling through the hero calms them into one tight ribbon that bends away to the bottom left.
// Without WebGL the hero keeps its SVG poster (the chip sits on the poster's thread); under reduced motion the night
// is drawn once, at rest.
import { gsap, lenis, clamp } from '../core.js';
import { getLanes } from '../gl/lanes.js';

const CHIP_X = 640;   // where the chip rides, in the threads' design px

export default async function init({ calm, still }) {
  const hero = document.getElementById('top');
  if (!hero) return;
  const quiet = calm || still;
  const night = hero.querySelector('.home-hero__night');
  const field = hero.querySelector('.home-hero__field');
  const chip = hero.querySelector('.home-hero__chip');
  const card = chip?.querySelector('.home-hero__chip-card');

  const lanes = await getLanes({ calm: quiet, velocity: () => lenis?.velocity || 0 });
  if (!lanes) { hero.classList.add('no-gl'); return; }
  // if the night never gets drawn (a lost context, a GPU that gives up), the poster stands in
  // (only judged while the hero is on screen: off screen it is simply not drawn yet)
  let safety = 0;
  const check = () => {
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { safety = setTimeout(check, 1500); return; }
    if (!hero.classList.contains('is-lit')) hero.classList.add('no-gl');
  };
  safety = setTimeout(check, 4500);
  hero.addEventListener('lanes:drawn', () => { clearTimeout(safety); hero.classList.remove('no-gl'); }, { once: true });

  const st = lanes.views.hero.state;
  const narrow = matchMedia('(max-width: 700px)');   // the chip sits this out on a phone
  let riding = false;

  // the threads' field (1000 × 900 design px) covers the hero's right side (its lower part on a phone)
  function frame() {
    const n = night.getBoundingClientRect(), f = field.getBoundingClientRect();
    const s = Math.max(f.width / 1000, f.height / 900);
    return { x: f.left - n.left, y: f.top - n.top + (f.height - 900 * s) / 2, s };
  }

  function onFrame(api) {
    const r = hero.getBoundingClientRect();
    // scrolling through the hero calms the threads: the waves settle, they close up and bend away to the bottom left
    const p = quiet ? 0 : clamp(-r.top / (r.height * 0.8), 0, 1);
    const e = p * p * (3 - 2 * p);
    st.wave = 1 - e;
    st.spread = 1 - 0.86 * e;
    st.pinch = e;
    st.gain = 1 - 0.3 * e;

    if (!chip || !riding || narrow.matches) return;
    // it rides at CHIP_X, or further back along its thread where the screen is too narrow to hold it there
    const fr = frame();
    const room = (inner.getBoundingClientRect().right - r.left - chipW / 2 - 30 - fr.x) / fr.s;
    const x = Math.min(CHIP_X, room - 26) + (quiet ? 0 : 26 * Math.sin(api.time * 0.19));
    const pt = api.threadPoint(0, x);
    const ptr = api.pointer;
    // a touch of parallax toward the pointer
    const px = ptr.on * clamp((ptr.cx - (r.left + r.width / 2)) / r.width, -0.5, 0.5) * 12;
    const py = ptr.on * clamp((ptr.cy - (r.top + r.height / 2)) / r.height, -0.5, 0.5) * 8;
    chip.style.transform = `translate3d(${(pt.x + px).toFixed(1)}px, ${(pt.y + py).toFixed(1)}px, 0) translate(-50%, -50%)`;
    chip.style.opacity = String(clamp(1 - e * 2.2, 0, 1));
  }

  const inner = hero.querySelector('.home-hero__inner');
  let chipW = 0;
  const measure = () => { chipW = card?.offsetWidth || 0; };
  addEventListener('resize', measure);
  const ride = () => { riding = true; chip?.classList.add('is-riding', 'is-on'); measure(); };
  lanes.attach('hero', hero, { frame, onFrame });

  if (quiet || !gsap) {
    Object.assign(st, { fade: 1, reveal: 1.2 });
    ride();
    lanes.draw();
    return;
  }

  // the intro: the night comes up, the threads draw in from the left, the chip pops onto its thread as the light
  // reaches it (the headline, lede and buttons rise on their own, through data-split and data-reveal)
  const k = document.documentElement.classList.contains('is-repeat') ? 0.55 : 1;
  Object.assign(st, { fade: 0, reveal: 0 });
  gsap.timeline({ delay: 0.05 })
    .to(st, { fade: 1, duration: 1.6 * k, ease: 'power2.out' }, 0)
    .to(st, { reveal: 1.14, duration: 2.2 * k, ease: 'power2.inOut' }, 0.1 * k)
    .add(() => {
      ride();
      if (card) gsap.fromTo(card, { scale: 0.7, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 1, ease: 'back.out(1.7)', clearProps: 'transform,opacity' });
    }, 1.35 * k);
}
