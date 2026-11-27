// The footer, at the end of every page: the night in WebGL behind its type, an intro when it first comes into view,
// and its details. The scene only draws while the footer is on screen.
import { createScene } from './scene.js';
import { intro } from './intro.js';
import { details } from './ui.js';

const root = document.documentElement;
export const wide = matchMedia('(min-width: 1100px) and (min-aspect-ratio: 6/5)');

export function initFooter(foot, { calm = false, still = false } = {}) {
  if (!foot) return null;
  const canvas = foot.querySelector('.scene');
  const stage = foot.querySelector('.stage');
  const road = foot.querySelector('.road');

  // Where the shot's design frame sits in the canvas (css px). On a landscape screen it is the stage itself; when the
  // footer flows, the road at its foot is a window onto the car, fitted round it and resting on its bottom edge.
  function frame() {
    const c = canvas.getBoundingClientRect();
    if (wide.matches) {
      const r = stage.getBoundingClientRect();
      return { x: r.left - c.left, y: r.top - c.top, s: r.width / 1597 };
    }
    const r = road.getBoundingClientRect();
    const s = Math.min(r.height / 560, (0.96 * r.width) / 610);
    return { x: r.left - c.left + r.width / 2 - 852 * s, y: r.bottom - c.top - 985 * s, s };
  }

  let scene = null;
  try {
    scene = createScene(canvas, { frame, calm: calm || still });
  } catch (e) {
    console.error('[crestora] no scene', e);
  }
  if (!scene) root.classList.add('no-webgl');

  const year = foot.querySelector('.year');
  if (year) year.textContent = String(new Date().getFullYear());

  if (scene && (calm || still)) {
    // a still: drawn once it is near the screen, and again when the layout changes
    let drawn = false;
    const paint = () => scene.ready.then(() => { if (!drawn) scene.warm(3); drawn = true; scene.draw(); root.classList.add('is-drawn'); });
    new IntersectionObserver(([e]) => { if (e.isIntersecting) paint(); }, { rootMargin: '200px' }).observe(foot);
    addEventListener('resize', () => { if (drawn) scene.draw(); });
    if (still) paint();
    foot.classList.add('is-armed');
  } else {
    intro(scene, foot);
    // the night only runs while the footer is on screen (and once the intro has started it)
    if (scene) {
      new IntersectionObserver(([e]) => {
        scene.onScreen = e.isIntersecting;
        if (!e.isIntersecting) scene.stop();
        else if (scene.state.fade > 0 || scene.state.reveal > 0) scene.start();
      }, { rootMargin: '80px' }).observe(foot);
    }
  }
  details(scene, { calm, wide, foot });
  return scene;
}
