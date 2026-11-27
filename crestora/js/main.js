// Crestora: the entry on every page. The shared runtime first (smooth scroll, header, reveals), then the page's own
// modules (named in <body data-modules>, from js/modules/<name>.js, each exporting a default init), then the footer.
import { boot, calm } from './core.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');                       // a still of the resting page (for stills and the poster)

boot();

// fetched together, started in the order the page lists them
const names = (document.body.dataset.modules || '').split(/\s+/).filter(Boolean);
const loads = names.map((name) => import(`./modules/${name}.js`).catch((e) => { console.error(`[crestora] module ${name}`, e); return null; }));
(async () => {
  for (const [i, load] of loads.entries()) {
    const m = await load;
    try { m?.default?.({ calm, still }); } catch (e) { console.error(`[crestora] module ${names[i]}`, e); }
  }
})();

// The footer (its WebGL night, the car's picture) loads once it is within a screen and a half, so a long page's first
// paint is its own; a launch from the page (crestora:launch) loads it at once.
const foot = document.querySelector('.footer');
if (foot) {
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    io.disconnect();
    import('./footer/index.js').then((m) => m.initFooter(foot, { calm, still })).catch((e) => console.error('[crestora] footer', e));
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: '150% 0px' });
  io.observe(foot);
  addEventListener('crestora:launch', () => { window.__crestoraLaunched = true; load(); });
  if (still) load();
}
