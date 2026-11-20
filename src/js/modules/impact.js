/**
 * Impact — count-up numbers.
 *
 * Progressive enhancement: the HTML already holds the final values, so with
 * no JS or under reduced motion nothing changes. Otherwise, once the web
 * fonts are ready, each [data-count] is locked to its final width and reset to
 * its start (data-from, default 0). When the stats scroll into view they count
 * up — ease-out over 1.6s, staggered 120ms — formatted exactly like the final
 * string (grouping commas, fixed decimals). Each number settles (and gets
 * .is-done for its landing glow) as soon as it shows its final value, so
 * small counts like 11 don't hang on their last step. Runs once. Printing,
 * or switching reduced motion on mid-page, snaps straight to the final values.
 *
 * No layout shift: the locked width is in em (it scales with the clamp()ed
 * font size), the digits are right-aligned inside it and may spill left
 * (DM Sans figures are proportional), so the unit after them never moves.
 *
 * The values are aria-hidden; screen readers get a spelled-out sr-only copy
 * and never hear an in-between number. The mist drift only runs while the
 * band is on screen.
 */
import { $, $$, reducedMotion, whenVisible } from "../core/utils.js";

const DURATION = 1600;
const STAGGER = 120;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function parse(el, i) {
  const final = el.textContent.trim();
  const decimals = (final.split(".")[1] || "").length;
  const step = 10 ** decimals;
  const to = Number(final.replace(/,/g, ""));
  const from = Number(el.dataset.from || 0);
  const fmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: final.includes(","),
  });
  return {
    el,
    final,
    from,
    to,
    delay: i * STAGGER,
    stat: el.closest(".impact__stat"),
    format: (n) => fmt.format(Math.round(n * step) / step),
    valid: Number.isFinite(to) && Number.isFinite(from) && from < to,
  };
}

export default function init(root) {
  if (!root || root.dataset.impactReady) return;
  root.dataset.impactReady = "true";

  const stats = $("[data-impact-stats]", root);
  const counters = $$("[data-count]", root)
    .map(parse)
    .filter((c) => c.valid);
  if (!stats || !counters.length || reducedMotion()) return;

  // Ambient mist drift: only while the band is visible
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      root.classList.toggle("is-inview", entries.some((e) => e.isIntersecting));
    }).observe(root);
  }

  let raf = 0;
  let state = "idle"; // idle → primed → counting → done

  const settle = (c) => {
    c.settled = true;
    c.el.textContent = c.final;
    c.el.style.removeProperty("width");
    if (!c.el.getAttribute("style")) c.el.removeAttribute("style");
    c.stat?.classList.add("is-done");
  };

  const finish = () => {
    if (state === "done") return;
    state = "done";
    cancelAnimationFrame(raf);
    counters.filter((c) => !c.settled).forEach(settle);
    root.classList.replace("is-counting", "is-counted");
  };

  const prime = () => {
    if (state !== "idle") return;
    for (const c of counters) {
      c.el.textContent = c.final;
      const size = parseFloat(getComputedStyle(c.el).fontSize) || 16;
      c.el.style.width = `${(c.el.getBoundingClientRect().width / size).toFixed(4)}em`;
      c.el.textContent = c.format(c.from);
    }
    state = "primed";
  };

  const run = () => {
    if (state !== "primed") return;
    state = "counting";
    root.classList.add("is-counting");
    let start = 0;
    const tick = (now) => {
      start ||= now;
      let running = 0;
      for (const c of counters) {
        if (c.settled) continue;
        const t = Math.max(0, (now - start - c.delay) / DURATION);
        const text = t >= 1 ? c.final : c.format(c.from + (c.to - c.from) * easeOut(t));
        if (text === c.final) {
          settle(c);
          continue;
        }
        running++;
        c.el.textContent = text;
      }
      if (running) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
  };

  // Printing mid-count should never show an in-between number
  window.addEventListener("beforeprint", finish);
  // Turning on reduced motion (OS setting) mid-page snaps to the final values
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotionChange = (e) => e.matches && finish();
  motionQuery.addEventListener?.("change", onMotionChange);

  // Measure with the real font; until then the final values simply stay put
  const fontsReady = document.fonts?.status === "loaded" ? Promise.resolve() : document.fonts?.ready ?? Promise.resolve();
  fontsReady
    .catch(() => {})
    .then(() => {
      prime();
      whenVisible(stats, run, { rootMargin: "0px 0px -12% 0px", threshold: 0.35 });
    });
}
