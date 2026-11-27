# UnoRouter

A landing page for **UnoRouter**, "one API key for every AI model, free ones included", grown out of one hero shot.
The hero is recreated as close to the shot as it goes, measured against it at 1440 × 1080: the header's cells, the
dot-matrix headline, every grey, the figures, and the mark on the right cell by cell in the shot's own colours.
Everything under it is new, drawn in the hero's language: prompt lines over dot-matrix headings, hairline boxes on an
8 px dot grid, one red-orange for emphasis, and four hot colours (yellow, orange, pink, magenta) that only ever appear
as cells.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/unorouter/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/unorouter/` and stamps the
  cache-busting version; `node build.mjs --serve` serves it with live reload.

## The mark

The art is the mark as 52 × 48 cells. Its colours are banded: neighbouring cells step yellow → orange → pink → magenta
→ yellow. So each cell keeps the shot's colour as its start and adds a whole number of steps, taken from smooth fields:
one that drifts with time (the bands flow), one round the pointer (a halo that shifts the colours under it and pushes
the cells aside) and rings sent out by a press. At time zero every offset is zero, so the first frame is the shot
itself; under reduced motion it stays that frame.

## What moves, and where

| Module | What it adds |
| --- | --- |
| `intro.js` | First visit: a short boot log on black that wipes away in steps. Then the header, the prompt typing itself out, the headline decoding line by line, the figures counting up, and the mark building itself bar, arm, ray. A repeat visit or a deep link skips the log |
| `cells.js`, `mark.js` | The cell field (above). The art also routes requests: a glint runs down a bar, along its arm and out through a ray, which lights up and moves a colour on as it lands; a press sends a ring and routes one to the nearest ray. Scrolling takes the mark apart |
| `dots.js` | The page's dot grid in WebGL: a 1 px dot every 8 px that scrolls with the page, wakes and warms round the pointer, rings out from a press and twinkles now and then. CSS dots without WebGL |
| `type.js` | Headings sit as dim noise until they come into view, then decode; links and buttons scramble once under the pointer |
| `hero.js` | Count-ups; point at the tokens figure for the exact, running count (each routed request in the art adds to it) |
| `nav.js` | The header frosts once the page moves, a hairline of progress along its foot, the current section lit, anchors that glide, a menu that is a proper dialog on small screens |
| `marquee.js` | The providers strip drifts, runs faster and turns round with the scroll, and stops under the pointer |
| `docs.js` | Three languages, one changed line: the old base URL is struck and the new one types in, then a request runs; pick a model and run it again, the reply streams in with where it was routed, how fast and what it cost |
| `models.js` | Search (press <kbd>/</kbd> anywhere), filters with counts, sortable prices and speed, rows that copy their id |
| `router.js` | Fallbacks, live: requests travel app → router → the fastest healthy upstream on paths of pixels. Switch an upstream off and what is on its way bounces with a 503 and goes on to the next; after two failures the circuit opens, and a probe closes it again |
| `rankings.js` | Bars of cells that fill in steps; switching the period moves rows to their new places (FLIP) |
| `cta.js` | The mark again, large and dark, coloured only where the pointer is; a demo key generator that types out a key made in the browser |
| `ui.js` | Magnetic buttons, a favicon whose cells cycle through the colours while the tab is open, a signature in the console, the footer's UTC clock |

## Quality

- Every effect resolves to the resting design. Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing
  animates, the art is the shot's frame, and the page is complete. Without JavaScript the whole page reads, the art
  included (a 52 × 48 PNG of the shot's cells, cut into cells by a CSS mask).
- Keyboard-complete: skip link, a visible focus ring, roving-tabindex tabs and radio groups, rows that copy on Enter,
  the menu as a dialog, the FAQ on native `<details>`.
- From 360 px to wide screens with no horizontal scroll; canvases and loops run only while on screen and while the tab
  is visible; Lenis only where there is a wheel.

## Credits

- Design: the hero is recreated from a single shot of an UnoRouter page; everything below it is extrapolated.
- Type: [Doto](https://github.com/oliverlalan/Doto) (the dot matrix) and [Geist Mono and Geist](https://github.com/vercel/geist-font),
  all under the SIL Open Font License, self-hosted and subset to Latin (licences in `assets/fonts/`).
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
- The models, prices, speeds, rankings and figures are illustrative, and the routing, the requests and the keys are
  simulated in the browser. It is a design study, not a service.

`node unorouter/tools/og.mjs` renders the share image (`assets/img/og.jpg`; needs Playwright).
