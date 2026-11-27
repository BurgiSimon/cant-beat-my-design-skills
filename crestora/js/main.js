// Crestora: the entry. Builds the scene behind the footer, plays the intro, wires the details.
import { createScene } from './scene.js';
import { intro } from './intro.js';
import { details } from './ui.js';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const calm = root.classList.contains('is-calm');
const still = params.has('still');                       // a still of the resting picture (for stills and the poster)

const canvas = document.querySelector('.scene');
const stage = document.querySelector('.stage');
const road = document.querySelector('.road');
export const wide = matchMedia('(min-width: 1100px) and (min-aspect-ratio: 6/5)');

// Where the shot's design frame sits in the canvas (css px). On a landscape screen it is the stage itself; when the page
// flows, the road at its foot is a window onto the car, fitted round it and resting on the window's bottom edge.
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

const year = document.querySelector('.year');
if (year) year.textContent = String(new Date().getFullYear());

if (scene && (calm || still)) {
  scene.ready.then(() => {
    scene.warm(3);                                       // the dust, as it lies after a few seconds' driving
    scene.draw();
    root.classList.add('is-ready', 'is-drawn');
  });
  addEventListener('scroll', () => scene.draw(), { passive: true });
} else {
  intro(scene);
}
details(scene, { calm, wide });
