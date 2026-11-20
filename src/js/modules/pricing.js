/**
 * Pricing — progressive enhancement for #pricing.
 *
 * Without JS the billing radios still swap every price (CSS :has) and the
 * comparison table is simply shown. This module adds:
 *  - the sliding pill under the checked billing option (header-style),
 *  - a polite announcement of the new Team price,
 *  - the billing period on the Team sign-up links,
 *  - the animated "Compare all plans" disclosure (+ #compare-plans deep link),
 *  - sticky-head and sideways-scroll affordances for the comparison table.
 */
import { $, $$, onFrame, reducedMotion } from "../core/utils.js";

const TEAM = {
  annual: "Team: $24 per member per month, billed annually. Save 20%.",
  monthly: "Team: $30 per member per month, billed monthly.",
};

export default function init(root) {
  if (root.dataset.pricingReady) return;
  root.dataset.pricingReady = "true";
  initBilling(root);
  initCompare(root);
}

/* ── Billing toggle ─────────────────────────────────────────── */
function initBilling(root) {
  const sw = $("[data-pricing-switch]", root);
  if (!sw) return;
  const pill = $(".pricing__pill", sw);
  const radios = $$(".pricing__radio", sw);
  const live = $("[data-pricing-live]", root);
  const teamLinks = $$("[data-pricing-team-link]", root);
  teamLinks.forEach((a) => (a.dataset.baseHref = a.getAttribute("href")));

  const checked = () => radios.find((r) => r.checked) || radios[radios.length - 1];

  const place = () => {
    const label = checked()?.closest(".pricing__option");
    if (!label || !label.offsetWidth) return;
    sw.style.setProperty("--pill-x", `${label.offsetLeft}px`);
    sw.style.setProperty("--pill-w", `${label.offsetWidth}px`);
  };

  const sync = (announce) => {
    const billing = checked().value;
    root.dataset.billing = billing;
    for (const a of teamLinks) a.setAttribute("href", `${a.dataset.baseHref}&billing=${billing}`);
    place();
    if (announce && live) {
      // clear first so repeating the same choice is announced again
      live.textContent = "";
      requestAnimationFrame(() => (live.textContent = TEAM[billing] || ""));
    }
  };

  for (const r of radios) r.addEventListener("change", () => sync(true));

  // First paint: position without sliding, then enable the transition.
  pill.style.transition = "none";
  sync(false);
  requestAnimationFrame(() => {
    place();
    requestAnimationFrame(() => {
      pill.style.transition = "";
      sw.classList.add("is-ready");
    });
  });
  document.fonts?.ready.then(place);
  onFrame(window, ["resize"], place);
}

/* ── Compare all plans ──────────────────────────────────────── */
function initCompare(root) {
  const toggle = $("[data-compare-toggle]", root);
  const panel = $("[data-compare-panel]", root);
  const collapse = $("[data-compare-collapse]", root);
  const frame = $("[data-table-frame]", root);
  const scroller = $("[data-table-scroll]", root);
  if (!toggle || !panel) return;

  let open = false;
  let anim = null;

  // ── sideways scrolling (narrow screens) ──
  const updateScroll = () => {
    if (!scroller || panel.hidden) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const scrollable = max > 1;
    // only a scrollable region needs to be a tab stop
    if (scrollable) scroller.setAttribute("tabindex", "0");
    else scroller.removeAttribute("tabindex");
    frame.classList.toggle("is-scrolled", scrollable && scroller.scrollLeft > 1);
    frame.classList.toggle("can-scroll-end", scrollable && scroller.scrollLeft < max - 1);
  };
  if (scroller) onFrame(scroller, ["scroll"], updateScroll);

  // ── stuck head row (wide screens) ──
  const headCell = $("thead th", panel);
  const updateStuck = () => {
    if (!open || !headCell) return frame.classList.remove("is-stuck");
    const style = getComputedStyle(headCell);
    if (style.position !== "sticky") return frame.classList.remove("is-stuck");
    const top = parseFloat(style.top) || 0;
    const f = frame.getBoundingClientRect();
    const stuck = f.top < top - 1 && f.bottom > top + headCell.offsetHeight;
    frame.classList.toggle("is-stuck", stuck);
  };
  let unbindScroll = null;
  if ("IntersectionObserver" in window && frame) {
    new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !unbindScroll) {
        unbindScroll = onFrame(window, ["scroll"], updateStuck);
        updateStuck();
      } else if (!visible && unbindScroll) {
        unbindScroll();
        unbindScroll = null;
        frame.classList.remove("is-stuck");
      }
    }).observe(frame);
  }
  onFrame(window, ["resize"], () => {
    updateScroll();
    updateStuck();
  });

  // ── disclosure ──
  const finish = () => {
    panel.classList.remove("is-animating");
    if (!open) panel.hidden = true;
    // the animation holds its last frame (fill: forwards) until the panel is
    // hidden, so a closing panel never flashes back to full height for a frame
    anim?.cancel();
    anim = null;
  };

  const setOpen = (next, { animate = true } = {}) => {
    if (next === open) return;
    open = next;
    toggle.setAttribute("aria-expanded", String(open));

    const from = panel.hidden ? 0 : panel.getBoundingClientRect().height;
    anim?.cancel();
    panel.hidden = false;
    updateScroll();
    const to = open ? panel.getBoundingClientRect().height : 0;

    if (!animate || reducedMotion() || !panel.animate) {
      finish();
      updateStuck();
      return;
    }
    panel.classList.add("is-animating");
    anim = panel.animate(
      [
        { height: `${from}px`, opacity: from ? 1 : 0 },
        { height: `${to}px`, opacity: open ? 1 : 0 },
      ],
      {
        duration: open ? 640 : 420,
        easing: open ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      }
    );
    if (open && frame?.animate) {
      frame.animate([{ transform: "translateY(-16px)" }, { transform: "none" }], {
        duration: 720,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
    }
    anim.onfinish = () => {
      finish();
      updateStuck();
    };
  };

  // Enhance: collapsed by default, controls revealed.
  panel.hidden = true;
  toggle.hidden = false;
  toggle.setAttribute("aria-expanded", "false");
  if (collapse) collapse.hidden = false;

  toggle.addEventListener("click", () => setOpen(!open));

  collapse?.addEventListener("click", () => {
    const bar = toggle.parentElement;
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = bar.getBoundingClientRect().top;
    setOpen(false);
    toggle.focus({ preventScroll: true });
    if (top < offset) {
      window.scrollTo({ top: window.scrollY + top - offset, behavior: reducedMotion() ? "auto" : "smooth" });
    }
  });

  // Deep link: ./#compare-plans opens the table
  const fromHash = () => {
    if (location.hash !== `#${panel.id}`) return;
    setOpen(true, { animate: false });
    requestAnimationFrame(() => panel.scrollIntoView({ block: "start" }));
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
}
