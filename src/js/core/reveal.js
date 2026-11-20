/**
 * Scroll reveal: elements with [data-reveal] fade/rise in once visible.
 * Children of [data-reveal-stagger] get an increasing --reveal-i delay.
 */
import { $$, reducedMotion } from "./utils.js";

export function initReveal() {
  for (const group of $$("[data-reveal-stagger]")) {
    $$("[data-reveal]", group).forEach((el, i) => {
      if (!el.style.getPropertyValue("--reveal-i")) el.style.setProperty("--reveal-i", String(i));
    });
  }
  const items = $$("[data-reveal]");
  if (!items.length) return;
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
  // Anything already above the fold when navigating to an anchor
  requestAnimationFrame(() => {
    for (const el of items) if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-revealed");
  });
}
