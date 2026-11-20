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
        if (entry.isIntersecting) reveal(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  const pending = new Set(items);
  const reveal = (el) => {
    el.classList.add("is-revealed");
    pending.delete(el);
    io.unobserve(el);
  };
  items.forEach((el) => io.observe(el));
  // Anything already above the fold when navigating to an anchor
  requestAnimationFrame(() => {
    for (const el of items) if (el.getBoundingClientRect().top < innerHeight) reveal(el);
  });
  // A jump (anchor link, End key, scrollIntoView) can carry blocks from below
  // the viewport to above it without ever intersecting: reveal those too, so
  // nothing stays invisible when the reader scrolls back up.
  let queued = false;
  const sweep = () => {
    queued = false;
    for (const el of pending) if (el.getBoundingClientRect().bottom < 0) reveal(el);
    if (!pending.size) window.removeEventListener("scroll", onScroll);
  };
  const onScroll = () => {
    if (!queued) (queued = true), requestAnimationFrame(sweep);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}
