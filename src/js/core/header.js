/**
 * Header: scrolled state, sliding active pill + scrollspy, mobile menu.
 * Sections opt into the scrollspy with data-nav-section="platform|features|use-cases|pricing".
 */
import { $, $$, onFrame } from "./utils.js";

export function initHeader() {
  const header = $("[data-header]");
  if (!header) return;

  // ── Scrolled state ────────────────────────────────────────────
  const setScrolled = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  onFrame(window, ["scroll"], setScrolled);
  setScrolled();

  // Mark the Sign in box on the sign-in page
  if (document.body.dataset.page === "signin") $(".signin", header)?.setAttribute("aria-current", "page");

  initPill(header);
  initMenu();
}

function initPill(header) {
  const nav = $("[data-nav]", header);
  if (!nav) return;
  const pill = $(".links__pill", nav);
  const links = $$("a[data-nav]", nav);
  const menuLinks = $$(".mobile-menu a[data-nav]");
  let active = document.body.dataset.navCurrent || null;

  const place = (key) => {
    const link = links.find((l) => l.dataset.nav === key);
    nav.classList.toggle("no-active", !link);
    if (!link) return;
    nav.style.setProperty("--pill-x", `${link.offsetLeft}px`);
    nav.style.setProperty("--pill-w", `${link.offsetWidth}px`);
  };
  const setActive = (key) => {
    active = key;
    for (const l of [...links, ...menuLinks]) {
      if (l.dataset.nav === key) l.setAttribute("aria-current", "true");
      else l.removeAttribute("aria-current");
    }
    place(key);
  };

  // Hover preview: the pill follows the pointer, then returns.
  for (const l of links) l.addEventListener("pointerenter", () => place(l.dataset.nav));
  nav.addEventListener("pointerleave", () => place(active));

  setActive(active);
  // Position without animating on first paint, then enable transitions.
  pill.style.transition = "none";
  requestAnimationFrame(() => {
    place(active);
    requestAnimationFrame(() => {
      pill.style.transition = "";
      nav.classList.add("is-ready");
    });
  });
  document.fonts?.ready.then(() => place(active));
  onFrame(window, ["resize"], () => place(active));

  // Scrollspy (home page only)
  const sections = $$("[data-nav-section]");
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const visible = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      // Nothing under the probe band (e.g. the footer fills it): fall back to
      // the last section that starts above the band.
      const current =
        sections.find((s) => visible.get(s)) ||
        sections.filter((s) => s.getBoundingClientRect().top < innerHeight * 0.42).pop();
      if (current && current.dataset.navSection !== active) setActive(current.dataset.navSection);
    },
    { rootMargin: "-38% 0px -58% 0px" }
  );
  sections.forEach((s) => io.observe(s));
}

function initMenu() {
  const dialog = $("[data-menu]");
  const openBtn = $("[data-menu-open]");
  if (!dialog || !openBtn || typeof dialog.showModal !== "function") return;

  const open = () => {
    dialog.showModal();
    openBtn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("has-menu-open");
  };
  const close = () => dialog.open && dialog.close();

  openBtn.addEventListener("click", open);
  $$("[data-menu-close]", dialog).forEach((b) => b.addEventListener("click", close));
  dialog.addEventListener("close", () => {
    openBtn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("has-menu-open");
    openBtn.focus({ preventScroll: true });
  });
  // Close after choosing a link (same-page anchors keep the scroll smooth)
  $$("a", dialog).forEach((a) => a.addEventListener("click", close));
  // Click on the backdrop area closes
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  // Leaving the mobile breakpoint closes the menu
  window.matchMedia("(min-width: 721px)").addEventListener("change", (e) => e.matches && close());
}
