/** Small shared helpers. */
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** rAF-throttled scroll/resize listener. Returns an unsubscribe function. */
export function onFrame(target, events, fn) {
  let ticking = false;
  const handler = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn();
    });
  };
  for (const e of events) target.addEventListener(e, handler, { passive: true });
  return () => events.forEach((e) => target.removeEventListener(e, handler));
}

/** Run once when the element first scrolls into view. */
export function whenVisible(el, fn, options = { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }) {
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, options);
  io.observe(el);
}

/** Format a number with thin grouping (12,400). */
export const formatNumber = (n, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
