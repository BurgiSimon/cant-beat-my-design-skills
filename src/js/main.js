/**
 * Mist — site entry point (progressive enhancement; the site works without JS).
 *
 * Core behaviour runs on every page. Section behaviour is loaded on demand:
 * any element with data-module="name" gets ./modules/name.js imported and its
 * default export called with the element: `export default function init(el) {}`.
 */
import { initHeader } from "./core/header.js";
import { initReveal } from "./core/reveal.js";
import { initHeroParallax } from "./core/parallax.js";

initHeader();
initReveal();
initHeroParallax();

// Smooth anchor scrolling switches on after load (see 01-base.css), so a
// deep link from another page lands instantly.
const markLoaded = () => requestAnimationFrame(() => document.documentElement.classList.add("is-loaded"));
if (document.readyState === "complete") markLoaded();
else window.addEventListener("load", markLoaded, { once: true });

const loaded = new Map();
for (const el of document.querySelectorAll("[data-module]")) {
  for (const name of el.dataset.module.split(/\s+/).filter(Boolean)) {
    if (!loaded.has(name)) loaded.set(name, import(`./modules/${name}.js`));
    loaded
      .get(name)
      .then((mod) => mod.default?.(el))
      .catch((err) => console.error(`[mist] module "${name}" failed to load`, err));
  }
}
