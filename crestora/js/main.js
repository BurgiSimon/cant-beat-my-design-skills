// Crestora: the entry on every page. The shared runtime first (smooth scroll, header, reveals), then the page's own
// modules (named in <body data-modules>, from js/modules/<name>.js, each exporting a default init), then the footer.
import { boot, calm } from './core.js';
import { initFooter } from './footer/index.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');                       // a still of the resting page (for stills and the poster)

boot();

const names = (document.body.dataset.modules || '').split(/\s+/).filter(Boolean);
for (const name of names) {
  import(`./modules/${name}.js`)
    .then((m) => m.default?.({ calm, still }))
    .catch((e) => console.error(`[crestora] module ${name}`, e));
}

initFooter(document.querySelector('.footer'), { calm, still });
