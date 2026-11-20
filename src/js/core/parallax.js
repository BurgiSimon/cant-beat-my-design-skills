/** Gentle parallax on the hero landscape (desktop, motion allowed only). */
import { $, onFrame, reducedMotion } from "./utils.js";

export function initHeroParallax() {
  const img = $(".hero__land img");
  if (!img || reducedMotion()) return;
  const hero = img.closest(".hero");
  const update = () => {
    const y = window.scrollY;
    if (y > hero.offsetHeight) return;
    img.style.setProperty("--parallax", `${(y * 0.12).toFixed(1)}px`);
  };
  onFrame(window, ["scroll"], update);
  update();
}
