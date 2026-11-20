/**
 * FAQ accordion — progressive enhancement over native <details name="faq">.
 *
 * Without JS the browser does everything (the shared `name` keeps one answer
 * open at a time). With JS:
 *  - opening and closing animate the panel's height (Web Animations API),
 *    including the answer that closes when another opens; clicks during an
 *    animation reverse it from wherever it is
 *  - exclusivity moves here (the `name` is dropped so the closing item can
 *    animate instead of vanishing), with a `toggle` safety net for items the
 *    browser opens itself (find-in-page)
 *  - #faq-… deep links open their answer, on load and on hashchange
 *  - ↑ / ↓ / Home / End move between questions (APG accordion keys)
 *  - "Copy link" buttons appear where the Clipboard API is available
 *  - every answer is expanded for printing
 * Reduced motion: same behaviour, no animation.
 */
import { reducedMotion } from "../core/utils.js";

const OPEN = { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
const CLOSE = { duration: 380, easing: "cubic-bezier(0.65, 0, 0.35, 1)" };

export default function init(root) {
  if (root.dataset.faqReady) return;
  root.dataset.faqReady = "true";

  const items = [...root.querySelectorAll("details.faq__item")];
  if (!items.length) return;

  const status = root.querySelector("[data-faq-status]");
  const running = new Map(); // item → [Animation, …]
  const closing = new Set();
  let printing = false;

  const parts = (item) => ({
    summary: item.querySelector(":scope > summary"),
    panel: item.querySelector(":scope > .faq__panel"),
    answer: item.querySelector(".faq__answer"),
  });
  const isOpen = (item) => item.open && !closing.has(item);

  // JS owns exclusivity from here on (see header comment)
  for (const item of items) item.removeAttribute("name");

  // While answers animate, the browser's own scroll anchoring would nudge the
  // page as padding and heights change; holdInPlace() does that job instead.
  const scroller = document.documentElement;
  const anchorBefore = scroller.style.overflowAnchor;
  let anchorFrame = 0;
  const syncAnchor = () => {
    cancelAnimationFrame(anchorFrame);
    if (running.size) scroller.style.overflowAnchor = "none";
    // restore a frame later, after the final layout change has been painted
    else anchorFrame = requestAnimationFrame(() => (scroller.style.overflowAnchor = anchorBefore));
  };

  function stop(item) {
    running.get(item)?.forEach((a) => a.cancel());
    running.delete(item);
  }

  function settle(item) {
    running.delete(item);
    closing.delete(item);
    item.classList.remove("is-animating", "is-closing");
    syncAnchor();
  }

  function setOpen(item, open, animate = !reducedMotion()) {
    if (open === isOpen(item)) return;
    const { panel, answer } = parts(item);

    // Where are we now? (mid-animation values included)
    const fromH = item.open ? panel.getBoundingClientRect().height : 0;
    const fromO = item.open ? Number(getComputedStyle(answer).opacity) : 0;
    stop(item);

    if (open) {
      settle(item);
      item.open = true;
      for (const other of items) if (other !== item && isOpen(other)) setOpen(other, false, animate);
      if (!animate) return;

      const toH = panel.getBoundingClientRect().height;
      item.classList.add("is-animating");
      const height = panel.animate({ height: [`${fromH}px`, `${toH}px`] }, OPEN);
      const fade = answer.animate(
        { opacity: [fromO, 1], transform: [fromH ? "none" : "translateY(-6px)", "none"] },
        { ...OPEN, delay: fromH ? 0 : 60, fill: "backwards" }
      );
      running.set(item, [height, fade]);
      syncAnchor();
      height.onfinish = () => settle(item);
      return;
    }

    if (!animate) {
      settle(item);
      item.open = false;
      return;
    }
    closing.add(item);
    item.classList.add("is-animating", "is-closing");
    const height = panel.animate({ height: [`${fromH}px`, "0px"] }, { ...CLOSE, fill: "forwards" });
    const fade = answer.animate({ opacity: [fromO, 0] }, { ...CLOSE, duration: CLOSE.duration * 0.6, fill: "forwards" });
    running.set(item, [height, fade]);
    syncAnchor();
    height.onfinish = () => {
      item.open = false;
      height.cancel();
      fade.cancel();
      settle(item);
    };
  }

  const headerBottom = () => document.querySelector("[data-header]")?.getBoundingClientRect().bottom ?? 0;
  const scrollByNow = (top) => window.scrollBy({ top, behavior: "instant" });

  /**
   * Keep the row the user clicked still while an answer above it collapses
   * (otherwise it slides up — often under the fixed header). Gives way as
   * soon as the user scrolls themselves.
   */
  function holdInPlace(el, start, until) {
    const correct = () => {
      const drift = el.getBoundingClientRect().top - start;
      if (Math.abs(drift) >= 0.5) scrollByNow(drift);
    };
    if (!until) return correct(); // nothing animating: one correction

    let active = true;
    const events = ["wheel", "touchstart", "keydown"];
    const release = () => {
      active = false;
      events.forEach((type) => window.removeEventListener(type, release));
    };
    events.forEach((type) => window.addEventListener(type, release, { passive: true }));
    const tick = () => {
      if (!active) return;
      correct();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    until.then(() => {
      if (active) correct();
      release();
    });
  }

  /** If the answer just opened ends below the fold, ease it into view (never pushing the question under the header). */
  function revealAnswer(item) {
    const { summary, panel } = parts(item);
    const overflow = panel.getBoundingClientRect().bottom - (window.innerHeight - 24);
    if (overflow <= 0) return;
    const room = summary.getBoundingClientRect().top - headerBottom() - 24;
    const by = Math.min(overflow, room);
    if (by > 0) window.scrollBy({ top: by, behavior: reducedMotion() ? "instant" : "smooth" });
  }

  for (const item of items) {
    const { summary } = parts(item);

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const open = !isOpen(item);
      const above = open && items.some((other) => other !== item && isOpen(other) && other.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING);
      // measure before anything moves
      const hold = above ? summary : null;
      const start = hold?.getBoundingClientRect().top;
      setOpen(item, open);
      if (!open) return;

      const done = running.size
        ? Promise.all([...running.values()].map((anims) => anims[0].finished.catch(() => {})))
        : null;
      if (hold) holdInPlace(hold, start, done);
      (done || Promise.resolve()).then(() => isOpen(item) && revealAnswer(item));
    });

    // Safety net: the browser opened this one itself (e.g. find-in-page)
    item.addEventListener("toggle", () => {
      if (printing || !isOpen(item)) return;
      for (const other of items) if (other !== item && isOpen(other)) setOpen(other, false);
    });
  }

  // ── Keyboard: arrows / Home / End move between questions ──
  const summaries = items.map((item) => parts(item).summary);
  const KEYS = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" };
  root.addEventListener("keydown", (event) => {
    const at = summaries.indexOf(event.target);
    const key = KEYS[event.key];
    if (at < 0 || key === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const n = summaries.length;
    const to = key === "first" ? 0 : key === "last" ? n - 1 : (at + key + n) % n;
    summaries[to].focus();
  });

  // ── Deep links: ./#faq-trial opens "What happens when my trial ends?" ──
  function openFromHash(initial) {
    let id = "";
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!id.startsWith("faq-")) return;
    const item = items.find((el) => el.id === id);
    if (!item) return;
    // Measure the final layout: settle the scroll reveals and skip the padding
    // transitions, otherwise the row lands 12–24px off once they finish.
    root.classList.add("is-instant");
    for (const el of items) el.classList.add("is-revealed");
    setOpen(item, true, false);
    void root.offsetHeight;
    requestAnimationFrame(() => {
      root.classList.remove("is-instant");
      item.scrollIntoView({ block: "start", behavior: initial || reducedMotion() ? "instant" : "smooth" });
      // On load the fragment already set the Tab starting point; a forced focus
      // would draw a ring nobody asked for. In-page jumps hand focus over.
      if (!initial) parts(item).summary.focus({ preventScroll: true });
    });
  }
  openFromHash(true);
  window.addEventListener("hashchange", () => openFromHash(false));

  // ── Copy link ──
  const canCopy = window.isSecureContext && typeof navigator.clipboard?.writeText === "function";
  const announce = (msg) => {
    if (!status) return;
    status.textContent = "";
    requestAnimationFrame(() => (status.textContent = msg));
  };
  if (canCopy) {
    for (const button of root.querySelectorAll("[data-faq-copy]")) {
      const item = button.closest(".faq__item");
      const label = button.querySelector(".faq__copy-label");
      if (!item?.id || !label) continue;
      const idle = label.textContent;
      let timer = 0;
      button.hidden = false;
      button.addEventListener("click", async () => {
        const url = new URL(location.href);
        url.hash = item.id;
        const question = parts(item).summary.querySelector(".faq__q")?.textContent.trim() || "this answer";
        let ok = true;
        try {
          await navigator.clipboard.writeText(url.href);
        } catch {
          ok = false;
        }
        clearTimeout(timer);
        button.classList.toggle("is-copied", ok);
        button.classList.toggle("is-failed", !ok);
        label.textContent = ok ? "Link copied" : "Couldn’t copy";
        announce(ok ? `Link to “${question}” copied.` : "Couldn’t copy the link. Your browser blocked clipboard access.");
        timer = setTimeout(() => {
          button.classList.remove("is-copied", "is-failed");
          label.textContent = idle;
        }, 2200);
      });
    }
  }

  // ── Print: expand every answer, then restore ──
  const openBeforePrint = new Set();
  window.addEventListener("beforeprint", () => {
    printing = true;
    for (const item of items) {
      if (isOpen(item)) openBeforePrint.add(item);
      stop(item);
      settle(item);
      item.open = true;
    }
  });
  window.addEventListener("afterprint", () => {
    for (const item of items) item.open = openBeforePrint.has(item);
    openBeforePrint.clear();
    setTimeout(() => (printing = false), 100);
  });
}
