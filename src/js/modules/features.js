/**
 * Features bento (home #features)
 *
 * 1. Spotlight — a soft light follows the cursor across the cards: the hovered
 *    card's surface brightens and every card's 1px border lights up near the
 *    pointer (CSS reads --mx / --my). Fine pointers only, off for reduced motion.
 * 2. Builder — when the card scrolls into view, the prompt is "submitted" and
 *    the generated steps tick off in sequence. Static (final state) otherwise.
 * 3. Runs chart — the line draws in once, left to right.
 * 4. Ambient glow (CSS) pauses while the section is off-screen.
 * 5. Reveal stagger follows the layout actually on screen (12-col, 2-col or
 *    1-col): cards cascade left to right within each visual row.
 */
import { $, $$, reducedMotion, whenVisible } from "../core/utils.js";

export default function init(root) {
  if (root.dataset.featuresReady) return;
  root.dataset.featuresReady = "true";

  trackVisibility(root);
  if (reducedMotion()) return;

  staggerByRow($$(".features__card", root));
  initSpotlight(root);
  initBuilder($("[data-builder]", root));
  initChart($("[data-runs]", root));
}

/** Toggle .is-inview so ambient CSS animation only runs while visible. */
function trackVisibility(root) {
  if (!("IntersectionObserver" in window)) {
    root.classList.add("is-inview");
    return;
  }
  new IntersectionObserver(
    (entries) => {
      for (const entry of entries) root.classList.toggle("is-inview", entry.isIntersecting);
    },
    { rootMargin: "120px 0px" }
  ).observe(root);
}

/** --reveal-i = position within the card's row (the markup defaults suit 12 columns). */
function staggerByRow(cards) {
  const rows = new Map();
  for (const card of cards) {
    const top = Math.round(card.offsetTop);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(card);
  }
  for (const row of rows.values()) {
    row
      .sort((a, b) => a.offsetLeft - b.offsetLeft)
      .forEach((card, i) => card.style.setProperty("--reveal-i", String(i)));
  }
}

function initSpotlight(root) {
  const grid = $("[data-features-grid]", root);
  if (!grid) return;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cards = $$(".features__card", grid);
  let frame = 0;
  let point = null;
  let hovered = null;

  const paint = () => {
    frame = 0;
    if (!point) return;
    // Read every rect first, then write — no layout thrash.
    const rects = cards.map((card) => card.getBoundingClientRect());
    cards.forEach((card, i) => {
      card.style.setProperty("--mx", `${(point.x - rects[i].left).toFixed(1)}px`);
      card.style.setProperty("--my", `${(point.y - rects[i].top).toFixed(1)}px`);
    });
  };
  const setHovered = (card) => {
    if (card === hovered) return;
    hovered?.classList.remove("is-hovered");
    hovered = card;
    hovered?.classList.add("is-hovered");
  };
  const reset = () => {
    point = null;
    grid.classList.remove("is-lit");
    setHovered(null);
  };

  grid.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch" || !fine.matches) return;
      point = { x: e.clientX, y: e.clientY };
      grid.classList.add("is-lit");
      setHovered(e.target.closest?.(".features__card") || null);
      if (!frame) frame = requestAnimationFrame(paint);
    },
    { passive: true }
  );
  grid.addEventListener("pointerleave", reset);
  // Wheel-scrolling under a resting cursor: keep the light pinned to it
  // (hit-test once per frame, not once per scroll event).
  let scrollFrame = 0;
  const onScroll = () => {
    scrollFrame = 0;
    if (!point) return;
    const under = document.elementFromPoint(point.x, point.y);
    if (!under || !grid.contains(under)) return reset();
    setHovered(under.closest(".features__card"));
    paint();
  };
  window.addEventListener(
    "scroll",
    () => {
      if (point && !scrollFrame) scrollFrame = requestAnimationFrame(onScroll);
    },
    { passive: true }
  );
  fine.addEventListener?.("change", () => !fine.matches && reset());
}

function initBuilder(el) {
  if (!el) return;
  const steps = $$("[data-step]", el);
  el.classList.add("is-armed", "is-typing");
  const at = (ms, fn) => setTimeout(fn, ms);

  whenVisible(
    el,
    () => {
      at(700, () => el.classList.add("is-pressing"));
      at(980, () => {
        el.classList.remove("is-pressing", "is-typing");
        el.classList.add("is-building");
      });
      steps.forEach((step, i) => {
        const start = 1180 + i * 520;
        at(start, () => step.classList.add("is-active"));
        at(start + 360, () => {
          step.classList.remove("is-active");
          step.classList.add("is-done");
        });
      });
      at(1180 + steps.length * 520 + 120, () => {
        el.classList.remove("is-building");
        el.classList.add("is-complete");
      });
    },
    { rootMargin: "0px 0px -20% 0px", threshold: 0.35 }
  );
}

function initChart(el) {
  if (!el) return;
  el.classList.add("is-armed");
  whenVisible(el, () => requestAnimationFrame(() => el.classList.add("is-drawn")), {
    rootMargin: "0px 0px -15% 0px",
    threshold: 0.4,
  });
}
