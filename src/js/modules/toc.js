/**
 * Table of contents for long documents (legal pages).
 *
 * <nav class="legal-toc" aria-label="On this page" data-module="toc">
 *   <details class="legal-toc__details">
 *     <summary>On this page <span data-toc-current></span></summary>
 *     … <a class="legal-toc__link" href="#section-id">…</a> …
 *     <span class="legal-toc__indicator"></span>
 *     <button data-toc-print hidden>Print</button>
 *   </details>
 * </nav>
 *
 * - Desktop (> 860px): the list is always open; a marker slides to the
 *   section being read. Mobile: a sticky <details> bar that names the
 *   current section and closes after you pick one (or on Esc / outside tap).
 * - The active section is tracked with an IntersectionObserver over the
 *   sections ([data-toc-section] around each target heading) and exposed
 *   as aria-current="true" on its link.
 * - Picking a link moves focus to the heading, so keyboard and screen
 *   reader users continue reading from there.
 */
import { $, $$, reducedMotion } from "../core/utils.js";

const MOBILE = "(max-width: 860px)";

export default function initToc(root) {
  if (root.dataset.tocReady) return;
  root.dataset.tocReady = "true";

  const details = $("details", root);
  const summary = details && $("summary", details);
  const current = $("[data-toc-current]", root);
  const indicator = $(".legal-toc__indicator", root);
  const track = indicator?.parentElement;
  const mq = window.matchMedia(MOBILE);

  // Links → their headings → the sections that contain them
  const items = $$('a[href^="#"]', root)
    .map((link) => {
      const id = decodeURIComponent(link.hash.slice(1));
      const heading = id && document.getElementById(id);
      if (!heading || link.closest(".legal-toc__foot")) return null;
      return { link, heading, section: heading.closest("[data-toc-section]") || heading, label: heading.textContent.replace(/^\s*\d+\s*/, "").trim() };
    })
    .filter(Boolean);
  if (!items.length) return;

  // ── Open / closed by breakpoint ───────────────────────────────
  const syncLayout = () => {
    if (!details) return;
    details.open = !mq.matches;
    if (summary) summary.tabIndex = mq.matches ? 0 : -1;
  };
  syncLayout();
  mq.addEventListener("change", () => {
    syncLayout();
    place(true);
  });
  // On desktop the list can't be collapsed
  summary?.addEventListener("click", (e) => {
    if (!mq.matches) e.preventDefault();
  });

  const close = (focusSummary = false) => {
    if (!details?.open || !mq.matches) return;
    details.open = false;
    if (focusSummary) summary?.focus();
  };
  details?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && details.open && mq.matches) {
      e.preventDefault();
      close(true);
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (details?.open && mq.matches && !root.contains(e.target)) close();
  });

  // ── Stuck state (mobile bar): lets CSS fade in a scrim behind the header
  let stuckIo;
  const watchStuck = () => {
    stuckIo?.disconnect();
    root.classList.remove("is-stuck");
    if (!mq.matches || !("IntersectionObserver" in window)) return;
    const top = parseFloat(getComputedStyle(root).top) || 0;
    stuckIo = new IntersectionObserver(
      ([e]) => root.classList.toggle("is-stuck", e.intersectionRatio < 1 && e.boundingClientRect.top <= top + 1),
      { rootMargin: `-${Math.ceil(top) + 1}px 0px 0px 0px`, threshold: [0, 1] }
    );
    stuckIo.observe(root);
  };
  watchStuck();
  mq.addEventListener("change", watchStuck);

  // ── Active section ────────────────────────────────────────────
  // The current section is the last one whose top has passed a reading
  // line 18% down the screen — never above the spot where a jumped-to
  // heading lands (scroll-padding + its scroll-margin), so picking any link,
  // even the first one on a short screen, always makes that section current.
  // Sections are contiguous (spacing is padding), so the line is always
  // covered by exactly one of them.
  const LINE = 0.18;
  let active = null;
  let locked = false;

  const readingLine = () => {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const margin = parseFloat(getComputedStyle(items[0].heading).scrollMarginTop) || 0;
    return Math.round(Math.max(window.innerHeight * LINE, pad + margin + 2));
  };

  function place(instant = false) {
    if (!indicator || !track) return;
    root.classList.toggle("has-active", Boolean(active) && !mq.matches);
    if (!active) return;
    if (instant) root.classList.add("is-instant");
    track.style.setProperty("--toc-y", `${active.link.offsetTop}px`);
    track.style.setProperty("--toc-h", `${active.link.offsetHeight}px`);
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("is-instant")));
  }

  // Keep the active link inside the TOC's own scroll box (short desktop screens)
  const reveal = (link) => {
    if (mq.matches || root.scrollHeight <= root.clientHeight) return;
    const box = root.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    const pad = 48;
    let delta = 0;
    if (r.top < box.top + pad) delta = r.top - box.top - pad;
    else if (r.bottom > box.bottom - pad) delta = r.bottom - box.bottom + pad;
    if (delta) root.scrollBy({ top: delta, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const setActive = (item, instant = false) => {
    if (item === active) return;
    const appearing = active === null;
    active = item;
    for (const i of items) {
      if (i === item) i.link.setAttribute("aria-current", "true");
      else i.link.removeAttribute("aria-current");
    }
    if (current) current.textContent = item ? item.label : "";
    place(instant || appearing);
    if (item) reveal(item.link);
  };

  let line = readingLine();
  const recompute = () => {
    if (locked) return;
    let next = null;
    for (const i of items) {
      if (i.section.getBoundingClientRect().top <= line) next = i;
      else break;
    }
    setActive(next);
  };

  if ("IntersectionObserver" in window) {
    // Precise: a 2px band at the reading line. Every section boundary that
    // crosses the line changes which section covers the band.
    let band;
    const observeBand = () => {
      band?.disconnect();
      line = readingLine();
      const bottom = Math.max(0, window.innerHeight - line - 2);
      band = new IntersectionObserver(recompute, { rootMargin: `-${line}px 0px -${bottom}px 0px` });
      for (const i of items) band.observe(i.section);
    };
    observeBand();
    // The line depends on the viewport height and the breakpoint's offsets
    let resizeTimer;
    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(observeBand, 150);
      },
      { passive: true }
    );
    // Catch-all for jumps (Home / End, find-in-page) that skip the band:
    // they always move some section in or out of this three-screen window.
    const view = new IntersectionObserver(recompute, { rootMargin: "100% 0px 100% 0px" });
    for (const i of items) view.observe(i.section);
  } else {
    // No observers: follow scroll directly (throttled to a frame)
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          recompute();
        });
      },
      { passive: true }
    );
    recompute();
  }

  // ── Picking a link ────────────────────────────────────────────
  const unlockAfterScroll = () => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scrollend", finish);
      locked = false;
      recompute();
    };
    if ("onscrollend" in window) window.addEventListener("scrollend", finish, { once: true });
    setTimeout(finish, reducedMotion() ? 120 : 1200);
  };

  for (const item of items) {
    item.link.addEventListener("click", () => {
      // Let the browser scroll to the anchor (and update the URL); just
      // reflect the choice right away and hand focus to the heading.
      setActive(item);
      locked = true;
      unlockAfterScroll();
      close();
      if (!item.heading.hasAttribute("tabindex")) item.heading.setAttribute("tabindex", "-1");
      requestAnimationFrame(() => item.heading.focus({ preventScroll: true }));
    });
  }

  // Back to top: close the mobile bar too
  $$(".legal-toc__foot a", root).forEach((a) => a.addEventListener("click", () => close()));

  // Print (needs JS, so it starts hidden)
  const print = $("[data-toc-print]", root);
  if (print && typeof window.print === "function") {
    print.hidden = false;
    print.addEventListener("click", () => window.print());
  }

  // Arriving with a hash (e.g. privacy.html#cookies): start on that section
  const fromHash = items.find((i) => i.heading.id === decodeURIComponent(location.hash.slice(1)));
  if (fromHash) setActive(fromHash, true);

  window.addEventListener("resize", () => place(true), { passive: true });
  document.fonts?.ready.then(() => place(true));
}
