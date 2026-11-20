/**
 * Testimonials — enhances the short-story rail below 1100px.
 *
 * The rail is a native scroll-snap container, so it already works with touch,
 * trackpads and the keyboard (it is a focusable region). This module only adds
 * what native scrolling can't show: a progress thumb, prev/next buttons that
 * step one card at a time, Home/End keys, and a swipe hint that fades after
 * the first move. On desktop the rail is a plain grid and the controls stay
 * hidden. The hint's nudge only runs while the section is on screen.
 */
import { clamp, onFrame, reducedMotion } from "../core/utils.js";

export default function init(root) {
  if (root.dataset.testimonialsReady) return;
  root.dataset.testimonialsReady = "true";

  const rail = root.querySelector("[data-t-rail]");
  const controls = root.querySelector("[data-t-controls]");
  if (!rail || !controls) return;

  const items = [...rail.querySelectorAll("[data-t-item]")];
  const prev = controls.querySelector("[data-t-prev]");
  const next = controls.querySelector("[data-t-next]");
  const thumb = controls.querySelector("[data-t-thumb]");
  const track = thumb?.parentElement;
  if (!items.length || !prev || !next) return;

  let scrollable = null;
  let target = null; // card index a button press is heading to (smooth scroll in flight)
  let settle = 0;

  const maxScroll = () => rail.scrollWidth - rail.clientWidth;
  const isDisabled = (btn) => btn.getAttribute("aria-disabled") === "true";
  const behavior = () => (reducedMotion() ? "auto" : "smooth");

  /** Distance between two neighbouring cards (card width + gap). */
  const stepSize = () => (items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : rail.clientWidth);
  /** Index of the card sitting at the rail's start. */
  const currentIndex = () => clamp(Math.round(rail.scrollLeft / stepSize()), 0, items.length - 1);

  function setScrollable(on) {
    if (on === scrollable) return;
    scrollable = on;
    controls.hidden = !on;
    root.classList.toggle("is-scrollable", on);
    // Only a scrolling rail needs to be a tab stop (arrow keys then scroll it)
    if (on) rail.tabIndex = 0;
    else rail.removeAttribute("tabindex");
  }

  function update() {
    const max = maxScroll();
    setScrollable(max > 2);
    if (!scrollable) return;

    const x = clamp(rail.scrollLeft, 0, max);
    prev.setAttribute("aria-disabled", String(x <= 2));
    next.setAttribute("aria-disabled", String(x >= max - 2));

    // the card sitting at the rail's start carries the keyboard focus ring
    const current = currentIndex();
    items.forEach((item, i) => item.classList.toggle("is-current", i === current));

    if (track && thumb) {
      const tw = track.clientWidth;
      const w = Math.max(24, Math.round(tw * (rail.clientWidth / rail.scrollWidth)));
      thumb.style.width = `${w}px`;
      thumb.style.transform = `translateX(${((tw - w) * x) / max}px)`;
    }
    if (x > 8) root.classList.add("has-scrolled");
  }

  /** Step one card; repeated presses during a smooth scroll keep counting from where it is heading. */
  function go(dir) {
    const from = target ?? currentIndex();
    target = clamp(from + dir, 0, items.length - 1);
    rail.scrollTo({ left: Math.min(target * stepSize(), maxScroll()), behavior: behavior() });
    clearTimeout(settle);
    settle = setTimeout(() => (target = null), 700); // fallback where `scrollend` is missing
  }
  rail.addEventListener("scrollend", () => (target = null));
  // a swipe or wheel takes over from any pending button step
  for (const type of ["pointerdown", "wheel", "touchstart"]) {
    rail.addEventListener(type, () => (target = null), { passive: true });
  }

  prev.addEventListener("click", () => !isDisabled(prev) && go(-1));
  next.addEventListener("click", () => !isDisabled(next) && go(1));

  rail.addEventListener("keydown", (e) => {
    if (!scrollable || e.target !== rail) return;
    if (e.key === "Home") rail.scrollTo({ left: 0, behavior: behavior() });
    else if (e.key === "End") rail.scrollTo({ left: maxScroll(), behavior: behavior() });
    else return;
    target = null;
    e.preventDefault();
  });

  onFrame(rail, ["scroll"], update);
  if ("ResizeObserver" in window) {
    // the track also resizes on its own when the swipe hint folds away
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    if (track) ro.observe(track);
  } else onFrame(window, ["resize"], update);
  document.fonts?.ready.then(update);
  update();

  // Ambient hint nudge: only while the section is visible
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const entry of entries) root.classList.toggle("is-inview", entry.isIntersecting);
    }).observe(rail);
  }
}
