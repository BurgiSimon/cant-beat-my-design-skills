/**
 * Use cases — team tabs (WAI-ARIA tabs pattern, automatic activation).
 *
 * Progressive enhancement: the markup is a jump-link nav plus stacked panels,
 * each with its own h3. This module turns it into a tablist:
 *   - roles, aria-selected / aria-controls / aria-labelledby, roving tabindex
 *   - ← → (wrapping), Home / End; Space / Enter select too
 *   - deep links (#use-cases-sales …) pick a tab on load and on hashchange;
 *     choosing a tab updates the hash with history.replaceState (no jump).
 *     The hash is the tab's id, so the browser's own fragment scroll lands
 *     on the (always visible) tab bar; panels are #use-cases-<team>-panel.
 *   - sliding pill (as in the header), horizontally scrolling bar on small
 *     screens with edge fades, the active tab kept in view
 *   - equal-height stage so switching never shifts the page below
 *   - 300ms crossfade + metric count-up (both off under reduced motion)
 *   - the connector pulse only runs while the section is on screen
 */
import { $, $$, clamp, formatNumber, onFrame, reducedMotion, whenVisible } from "../core/utils.js";

const LEAVE_MS = 220;
const COUNT_MS = 900;

export default function init(root) {
  if (!root || root.dataset.useCasesReady) return;

  const bar = $(".use-cases__tabbar", root);
  const list = $("[data-uc-tablist]", root);
  const pill = $(".use-cases__pill", root);
  const stage = $(".use-cases__stage", root);
  const tabs = $$("[data-uc-tab]", root);
  const panels = tabs.map((tab) => document.getElementById((tab.getAttribute("href") || "").slice(1)));
  if (!bar || !list || !pill || !stage || !tabs.length || panels.some((p) => !p)) return;
  root.dataset.useCasesReady = "true";

  // ── Semantics ────────────────────────────────────────────────
  list.setAttribute("role", "tablist");
  tabs.forEach((tab, i) => {
    const panel = panels[i];
    if (!tab.id) tab.id = panel.id.replace(/-panel$/, "");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = 0;
  });

  let current = -1;
  const leaveTimers = new Map();
  const counters = new Map();

  const hashId = () => decodeURIComponent(location.hash.slice(1));
  const indexFromHash = () => {
    const id = hashId();
    return id ? panels.findIndex((p, j) => p.id === id || tabs[j].id === id) : -1;
  };
  // A hash naming a panel (the no-JS jump links) can't be scrolled to while
  // that panel is hidden; bring the tab bar into view instead.
  // Layout position (ignores the reveal transform) minus the page's anchor offset
  const barScrollTop = () => {
    let y = 0;
    for (let n = bar; n; n = n.offsetParent) y += n.offsetTop;
    return y - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
  };
  const scrollToBar = (behavior) => window.scrollTo({ top: barScrollTop(), behavior });
  const landOnBar = (behavior) => {
    if (panels.some((p) => p.id === hashId())) scrollToBar(behavior);
  };

  // ── Panels ───────────────────────────────────────────────────
  const settle = (panel, hide) => {
    clearTimeout(leaveTimers.get(panel));
    leaveTimers.delete(panel);
    panel.classList.remove("is-leaving", "is-entering");
    panel.removeAttribute("aria-hidden");
    panel.inert = false;
    panel.hidden = hide;
    // a count interrupted by a switch must not linger half-way while hidden
    if (hide && valueOf(panel)) resetValue(valueOf(panel));
  };

  const show = (i, animate) => {
    const prev = current;
    current = i;
    tabs.forEach((tab, j) => {
      const on = j === i;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });

    const incoming = panels[i];
    const outgoing = prev >= 0 && prev !== i ? panels[prev] : null;
    panels.forEach((p) => p !== incoming && p !== outgoing && settle(p, true));
    settle(incoming, false);

    if (!outgoing) return;
    if (!animate) return settle(outgoing, true);

    // Crossfade: the old panel stays in the same grid cell, inert and
    // hidden from assistive tech, while it fades out under the new one.
    outgoing.classList.add("is-leaving");
    outgoing.setAttribute("aria-hidden", "true");
    outgoing.inert = true;
    leaveTimers.set(outgoing, setTimeout(() => settle(outgoing, true), LEAVE_MS));
    void incoming.offsetWidth; // restart the entrance animation
    incoming.classList.add("is-entering");
  };

  // ── Pill + scrolling tab bar ─────────────────────────────────
  const placePill = (instant = false) => {
    const tab = tabs[current];
    if (!tab) return;
    if (instant) pill.style.transition = "none";
    list.style.setProperty("--pill-x", `${tab.offsetLeft}px`);
    list.style.setProperty("--pill-w", `${tab.offsetWidth}px`);
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => (pill.style.transition = "")));
  };

  const updateFades = () => {
    const max = list.scrollWidth - list.clientWidth;
    bar.classList.toggle("is-scroll-start", max > 1 && list.scrollLeft > 1);
    bar.classList.toggle("is-scroll-end", max > 1 && list.scrollLeft < max - 1);
  };

  const keepTabInView = (smooth) => {
    const max = list.scrollWidth - list.clientWidth;
    if (max <= 1) return;
    const tab = tabs[current];
    const left = clamp(tab.offsetLeft + tab.offsetWidth / 2 - list.clientWidth / 2, 0, max);
    if (Math.abs(left - list.scrollLeft) < 1) return;
    list.scrollTo({ left, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  };

  // ── Equal-height stage: measure every panel once per width ───
  // In the single-column layout the copy lengths differ too much: panels
  // keep their natural height and the frame animates between them instead.
  const stacked = window.matchMedia("(max-width: 860px)");
  let measuredWidth = 0;
  const equalize = (force = false) => {
    const width = stage.clientWidth;
    if (!force && width === measuredWidth) return;
    measuredWidth = width;
    stage.style.removeProperty("--uc-h");
    if (stacked.matches) return;
    const wasHidden = panels.map((p) => p.hidden);
    panels.forEach((p) => (p.hidden = false));
    const tallest = Math.max(...panels.map((p) => p.offsetHeight));
    panels.forEach((p, j) => (p.hidden = wasHidden[j]));
    stage.style.setProperty("--uc-h", `${tallest}px`);
  };

  // ── Metric count-up ──────────────────────────────────────────
  // DM Sans has no tabular figures, so the whole number (digits + unit) is
  // locked to its final width while counting: the unit stays attached to
  // the digits and the caption beside it never moves.
  const valueOf = (panel) => $("[data-count]", panel);
  const boxOf = (el) => el.closest(".use-cases__num") || el;
  const lockWidth = (el) => {
    const box = boxOf(el);
    box.style.width = "";
    box.style.width = `${box.getBoundingClientRect().width}px`;
  };
  const resetValue = (el) => {
    cancelAnimationFrame(counters.get(el));
    boxOf(el).style.width = "";
    el.textContent = formatNumber(Number(el.dataset.count));
  };
  const countUp = (panel) => {
    const el = valueOf(panel);
    if (!el) return;
    counters.forEach((raf) => cancelAnimationFrame(raf));
    resetValue(el);
    if (reducedMotion()) return;
    const target = Number(el.dataset.count);
    lockWidth(el);
    el.textContent = "0";
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatNumber(Math.round(target * eased));
      if (t < 1) counters.set(el, requestAnimationFrame(tick));
      else boxOf(el).style.width = "";
    };
    counters.set(el, requestAnimationFrame(tick));
  };

  // ── Selection ────────────────────────────────────────────────
  let resizeTimer = 0;
  const endResize = () => {
    clearTimeout(resizeTimer);
    stage.classList.remove("is-resizing");
    stage.style.removeProperty("height");
  };
  // Ease the frame from its current height to the incoming panel's
  const resizeStage = (from, incoming) => {
    endResize();
    const to = incoming.offsetHeight + (stage.offsetHeight - stage.clientHeight);
    if (Math.abs(to - from) < 2) return;
    stage.style.height = `${from}px`;
    stage.classList.add("is-resizing");
    void stage.offsetHeight;
    stage.style.height = `${to}px`;
    resizeTimer = setTimeout(endResize, 340);
  };

  const select = (i, { focus = false, fromUser = false } = {}) => {
    if (i < 0 || i >= tabs.length) return;
    if (focus) tabs[i].focus({ preventScroll: true });
    if (i === current) return;
    const animate = !reducedMotion();
    const from = stage.offsetHeight;
    show(i, animate);
    if (animate && stacked.matches) resizeStage(from, panels[i]);
    placePill();
    keepTabInView(true);
    if (fromUser) history.replaceState(history.state, "", `#${tabs[i].id}`);
    countUp(panels[i]);
  };

  list.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // Safari doesn't focus links on click; focus explicitly so the arrow
    // keys work straight after a click everywhere
    select(tabs.indexOf(tab), { focus: true, fromUser: true });
  });

  list.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(e.target.closest('[role="tab"]'));
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const last = tabs.length - 1;
    const next = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
      " ": i,
      Enter: i,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next, { focus: true, fromUser: true });
  });

  // Deep links that arrive after load (e.g. a link elsewhere on the page)
  window.addEventListener("hashchange", () => {
    const i = indexFromHash();
    if (i < 0) return;
    select(i);
    landOnBar(reducedMotion() ? "instant" : "smooth");
  });

  // ── First paint ──────────────────────────────────────────────
  const fromHash = indexFromHash();
  show(Math.max(0, fromHash), false);
  root.classList.add("is-enhanced");
  equalize(true);

  placePill(true);
  keepTabInView(false);
  updateFades();

  if (fromHash >= 0) {
    // The browser focuses a focusable fragment target (the tab). Keep that
    // focus, so keyboard users can arrow straight away, but hold the ring
    // back until the visitor actually touches the keyboard.
    bar.classList.add("is-quiet");
    window.addEventListener("keydown", () => bar.classList.remove("is-quiet"), { once: true, capture: true });
    requestAnimationFrame(() => landOnBar("instant"));
    // Fonts and other sections settling during load (and the browser's own,
    // possibly smooth, fragment scroll) can leave the page a little off.
    // Once loaded and scrolling has gone idle, land the tab bar exactly —
    // unless the visitor has already started moving.
    let moved = false;
    const intents = ["wheel", "touchstart", "keydown", "pointerdown"];
    const onIntent = () => (moved = true);
    intents.forEach((t) => window.addEventListener(t, onIntent, { passive: true, once: true }));
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true }));
    Promise.all([loaded, document.fonts?.ready]).then(() => {
      let idle = 0;
      const check = () => {
        if (moved || indexFromHash() !== current) return stop();
        if (Math.abs(window.scrollY - barScrollTop()) > 2) scrollToBar(reducedMotion() ? "instant" : "smooth");
      };
      const poke = () => {
        clearTimeout(idle);
        idle = setTimeout(check, 180);
      };
      const ro = "ResizeObserver" in window ? new ResizeObserver(poke) : null;
      const stop = () => {
        clearTimeout(idle);
        ro?.disconnect();
        window.removeEventListener("scroll", poke);
        intents.forEach((t) => window.removeEventListener(t, onIntent));
      };
      window.addEventListener("scroll", poke, { passive: true });
      ro?.observe(document.body);
      poke();
      setTimeout(() => {
        check();
        stop();
      }, 1600);
    });
  }

  // Count the first metric up once the stage comes into view
  if (!reducedMotion()) {
    const first = valueOf(panels[current]);
    if (first) {
      lockWidth(first);
      first.textContent = "0";
    }
    whenVisible(stage, () => countUp(panels[current]));
  }

  // Ambient pulse only while on screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => root.classList.toggle("is-inview", entry.isIntersecting), {
      rootMargin: "80px 0px",
    }).observe(stage);
  } else {
    root.classList.add("is-inview");
  }

  onFrame(list, ["scroll"], updateFades);
  onFrame(window, ["resize"], () => {
    equalize();
    placePill(true);
    updateFades();
  });
  document.fonts?.ready.then(() => {
    equalize(true);
    placePill(true);
    keepTabInView(false);
    updateFades();
  });
}
