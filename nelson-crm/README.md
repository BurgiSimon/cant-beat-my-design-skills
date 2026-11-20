# Nelson CRM

A 1:1 recreation of a CRM landing-page design by [@uisabor](https://x.com/uisabor/status/2120804761528328263)
("Nelson" / "Sendoq"), matched to the designer's screenshots at 1440px, then given a restrained motion layer.

- **Live (with motion):** https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/
- **Live (static recreation):** https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/recreation.html

## Motion layer

Every effect resolves to the exact resting state of the design. Each one is turned off under
`prefers-reduced-motion`, limited to a mouse or trackpad where it is pointer-driven, and the page still
works if it fails. Smooth scrolling (Lenis) runs only with a mouse or trackpad; touch devices keep native scrolling.

The final pass was an adversarial audit (performance, accessibility, cross-module state, touch, art direction)
followed by fixes: skip link and `<main>` landmark, roving-tabindex tabs and segmented control, announced
newsletter errors, forced-colors selection states, no redundant WebGL redraws, and no idle loops under reduced motion.

| Module | What it adds |
| --- | --- |
| `intro` | Preloader tied to real loading (mark draw, 0→100 counter), overlay wipe, hero opens from an inset, headline lines rise; shorter on repeat visits |
| `hero-gl` | Raw WebGL hero: torn-paper reveal, the painted eye follows the cursor with idle saccades, layered sky parallax, scroll depth, film grain |
| `nav` | Floating nav that hides on scroll down and returns on scroll up, frosted contrast on photos, scroll-progress line, active section in the menu, smooth anchors |
| `reveals` | Masked line reveals, clip reveals on imagery, counters, timeline draw, word-by-word statement scrub |
| `cursor` | Blend-mode cursor, hover disc, magnetic buttons, text-roll labels, subtle 3D tilt on the chart and dashboard |
| `marquee` | Logo strip that speeds up and reverses with scroll velocity, slows on hover |
| `live` | One auto-advance tour of the feature tabs (mouse only, pauses on hover/focus), chart bar hover, live lead ticker, export and newsletter micro-flows, link and focus polish |
| `ascii` | Canvas ASCII night-cloud field behind "How it works", with a decode sweep and a pointer lens |

## Build

```bash
python3 src/build.py           # → index.html (+ nelson-standalone.html, a single self-contained file)
python3 src/build.py --only none --out plain.html --no-standalone   # without the motion modules
```

Sources: `src/index.html` (template), `src/style.css` (design units `Nu` = px at 1440, scaled with the
viewport), `src/app.js` (interactions), `src/fx/core.js` (shared runtime: GSAP ticker, Lenis, event bus) and
one file pair per module in `src/fx/`. `assets/hero-gl-data.js` is only loaded when the page is opened
from `file://`, where WebGL can't read local images.

## Credits

- Design: [@uisabor](https://x.com/uisabor). Imagery is cropped from the published design shots.
- Type: Gambetta ([Fontshare](https://www.fontshare.com/fonts/gambetta), ITF Free Font License),
  Inter and Poppins (SIL Open Font License).
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
