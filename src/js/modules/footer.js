/**
 * Site footer (data-module="footer" on <footer class="site-footer">).
 *
 * - "Back to top" (a link to #main, so it works without JS): smooth scroll
 *   (instant under reduced motion), then focus lands on the header brand
 *   (or #main) so keyboard users start over at the top.
 * - Marks the footer link for the current page with aria-current="page".
 * - Newsletter: eases the height change when form.js swaps in its success panel.
 * - The live dot only pulses while the footer is on screen; the wordmark
 *   rises out of the ground (and the mist settles) the first time it shows.
 */
import { reducedMotion } from "../core/utils.js";

export default function init(root) {
  if (!root || root.dataset.footerReady) return;
  root.dataset.footerReady = "true";

  // An in-page link to #main (works without JS); enhanced to a smooth return.
  root.querySelector("[data-back-to-top]")?.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    backToTop();
  });
  markCurrentPage(root);
  smoothNewsletterSwap(root.querySelector(".site-footer__newsletter"));
  watchVisibility(root);
}

/* ── Back to top ──────────────────────────────────────────── */
function backToTop() {
  const target = document.querySelector("[data-header] .brand") || document.getElementById("main");
  const land = () => target?.focus({ preventScroll: true });

  if (reducedMotion() || window.scrollY < 2) {
    window.scrollTo({ top: 0, behavior: "instant" });
    land();
    return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("scrollend", finish);
    land();
  };
  window.addEventListener("scrollend", finish);
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Fallback for browsers without `scrollend`: settle when scrollY stops moving.
  const started = performance.now();
  let lastY = -1;
  let still = 0;
  const tick = () => {
    if (done) return;
    const y = window.scrollY;
    still = y === lastY ? still + 1 : 0;
    lastY = y;
    if (y <= 0 || still > 6 || performance.now() - started > 2500) finish();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── Current page ─────────────────────────────────────────── */
function markCurrentPage(root) {
  const here = normalize(location.pathname);
  const pageLinks = [...root.querySelectorAll(".site-footer__links a")].filter((a) => {
    const url = new URL(a.href, location.href);
    return !url.hash && url.origin === location.origin && normalize(url.pathname) === here;
  });
  if (!pageLinks.length) return;
  const mark = () => {
    // Match on the plan only (signup.html?plan=enterprise&billing=annual →
    // "Talk to sales"), otherwise the plain page link ("Start free trial").
    const plan = new URLSearchParams(location.search).get("plan");
    const planOf = (a) => new URL(a.href).searchParams.get("plan");
    const current = (plan && pageLinks.find((a) => planOf(a) === plan)) || pageLinks.find((a) => !planOf(a));
    for (const a of pageLinks) {
      if (a === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };
  mark();
  // The sign-up page switches plan in place (history.replaceState).
  document.addEventListener("mist:plan", mark);
}

function normalize(path) {
  return path.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
}

/* ── Newsletter success: no layout jump ───────────────────── */
function smoothNewsletterSwap(wrap) {
  if (!wrap) return;
  wrap.addEventListener("mist:submit", () => {
    const from = wrap.offsetHeight;
    wrap.style.height = `${from}px`;
    // form.js swaps the form for its success panel right after this event
    requestAnimationFrame(() => {
      const panel = wrap.querySelector(".form-success");
      const to = panel ? panel.offsetHeight : from;
      if (reducedMotion() || to === from) {
        wrap.style.height = "";
        return;
      }
      wrap.style.overflow = "hidden";
      wrap.style.transition = "height 600ms var(--ease-out)";
      requestAnimationFrame(() => {
        wrap.style.height = `${to}px`;
      });
      let timer = 0;
      const reset = () => {
        clearTimeout(timer);
        wrap.removeEventListener("transitionend", onEnd);
        wrap.style.height = wrap.style.transition = wrap.style.overflow = "";
      };
      // only the wrapper's own height transition (children's transitions bubble too)
      const onEnd = (e) => e.target === wrap && e.propertyName === "height" && reset();
      wrap.addEventListener("transitionend", onEnd);
      timer = setTimeout(reset, 900);
    });
  });
}

/* ── Ambient motion only while visible; one-time rise ─────── */
function watchVisibility(root) {
  if (!("IntersectionObserver" in window)) return;
  root.classList.add("is-armed");
  new IntersectionObserver(([entry]) => root.classList.toggle("is-inview", entry.isIntersecting)).observe(root);

  const ground = root.querySelector(".site-footer__ground");
  if (!ground || reducedMotion()) return;
  // Already on screen when the module loads (short pages): leave it standing.
  if (ground.getBoundingClientRect().top < window.innerHeight) return;
  root.classList.add("has-rise");
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      root.classList.add("is-risen");
    },
    { threshold: 0.25 }
  );
  io.observe(ground);
}
