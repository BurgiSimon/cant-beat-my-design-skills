// The footer's way in, played when it first comes into view. The night comes up first, then the road lights from under
// the car outward at warp speed and slows to a cruise as the car rolls in from behind and settles, shedding its dust.
// The type assembles over it: the mark turns in, the name rises letter by letter, the columns come in one after the
// other and the rule draws itself across. A repeat visit in the same tab gets a shorter version.

const root = document.documentElement;

function split(el) {
  // letters of the wordmark, each in its own box so it can rise on its own
  const text = el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    el.append(s);
  }
  return [...el.children];
}

const settle = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

export async function intro(scene, foot) {
  const gsap = window.gsap;
  const done = () => {
    foot.classList.add('is-armed');
    try { sessionStorage.setItem('crestora:seen', '1'); } catch (e) {}
  };
  if (!gsap) {
    if (scene) { Object.assign(scene.state, { fade: 1, reveal: 1.2, exposure: 1, dust: 1 }); scene.ready.then(() => scene.start()); }
    done();
    return;
  }

  const q = (s) => [...foot.querySelectorAll(s)];
  const letters = split(foot.querySelector('.wordmark'));
  const mark = foot.querySelector('.mark');
  const lines = q('.tagline .line');
  const socials = q('.social li');
  const heads = q('.col h2');
  const cols = q('.col');
  const rule = foot.querySelector('.rule');
  const base = q('.base > *');

  // the type waits where it will start from
  gsap.set(mark, { rotation: -140, scale: 0.55, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(letters, { yPercent: 115, opacity: 0 });
  gsap.set(lines, { y: 14, opacity: 0 });
  gsap.set(socials, { y: 16, opacity: 0, scale: 0.9 });
  gsap.set(heads, { y: 14, opacity: 0 });
  gsap.set(q('.col li'), { y: 12, opacity: 0 });
  gsap.set(rule, { scaleX: 0, transformOrigin: '0% 50%' });
  gsap.set(base, { y: 10, opacity: 0 });
  foot.classList.add('is-armed');

  // wait for the footer to come into view (most of it), then for the car's picture and the fonts
  await new Promise((go) => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { threshold: 0.35 });
    io.observe(foot);
  });
  await settle(Promise.all([document.fonts?.ready, scene?.ready].filter(Boolean)), 3000);

  foot.classList.add('is-introduced');
  const repeat = root.classList.contains('is-repeat');
  const k = repeat ? 0.55 : 1;                                 // a repeat visit: the same, quicker
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: done });

  if (scene) {
    const st = scene.state;
    Object.assign(st, { fade: 0, reveal: 0, exposure: 0, dust: 0, speed: 7, carX: 150, carY: -2, carA: 0.012 });
    scene.warm(2);
    scene.start();
    tl.to(st, { fade: 1, duration: 1.8 * k, ease: 'power2.out' }, 0)
      .to(st, { reveal: 1.25, duration: 2.3 * k, ease: 'power2.inOut' }, 0.15 * k)
      .to(st, { speed: 1, duration: 3.2 * k, ease: 'power3.out' }, 0.2 * k)
      .to(st, { exposure: 1, duration: 1.3 * k, ease: 'power2.out' }, 0.45 * k)
      .to(st, { carX: 0, duration: 2.2 * k, ease: 'expo.out' }, 0.45 * k)
      // it noses down as it arrives, then settles back on its springs
      .to(st, { carA: -0.008, carY: 0.6, duration: 0.9 * k, ease: 'power2.out' }, 1.0 * k)
      .to(st, { carA: 0, carY: 0, duration: 1.4 * k, ease: 'elastic.out(1, 0.45)' }, 1.9 * k)
      .to(st, { dust: 1, duration: 1.6 * k, ease: 'power2.out' }, 0.7 * k)
      .add(() => scene.glint(), 2.2 * k);
  }

  const T = repeat ? 0.35 : 0.9;
  tl.to(mark, { rotation: 0, scale: 1, opacity: 1, duration: 1.5 * k }, T)
    .to(letters, { yPercent: 0, opacity: 1, duration: 1.1 * k, stagger: 0.04 * k }, T + 0.12 * k)
    .to(lines, { y: 0, opacity: 1, duration: 1.1 * k, stagger: 0.09 * k }, T + 0.3 * k)
    .to(socials, { y: 0, opacity: 1, scale: 1, duration: 0.9 * k, stagger: 0.06 * k, ease: 'back.out(2.2)' }, T + 0.45 * k);
  cols.forEach((col, i) => {
    const at = T + (0.2 + i * 0.09) * k;
    tl.to(heads[i], { y: 0, opacity: 1, duration: 1 * k }, at)
      .to(col.querySelectorAll('li'), { y: 0, opacity: 1, duration: 0.9 * k, stagger: 0.035 * k }, at + 0.08 * k);
  });
  tl.to(rule, { scaleX: 1, duration: 1.5 * k, ease: 'expo.inOut' }, T + 0.5 * k)
    .add(() => rule.dispatchEvent(new CustomEvent('sweep')), T + 1.1 * k)
    .to(base, { y: 0, opacity: 1, duration: 1 * k, stagger: 0.08 * k }, T + 0.95 * k)
    .add(() => gsap.set([mark, ...letters, ...lines, ...socials, ...heads, ...q('.col li'), rule, ...base], { clearProps: 'transform,opacity' }));
}
