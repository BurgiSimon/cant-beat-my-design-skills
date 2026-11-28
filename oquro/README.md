# OQURO

A cyber-security landing page recreated from one Dribbble-style shot: **OQURO**, "Protect your business with intelligent
security". The shot shows the page in two columns (the hero and "Building a safer digital future" on the left;
"Security across every layer", "Everything you need to stay protected" and "Security that moves ahead of threats" on
the right). Every part of it is here, measured against the shot at 1440 px, and the page carries on past where the
shot is cut off with a call to action and a footer in the same language.

The shot's pictures are 3D renders (a mossy stone ring with a vault door in it, a rocky outcrop, a laptop on a
boulder, a chain link in sand). Here they are real-time 3D, built entirely in code: no image files, no models.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/oquro/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/oquro/` and stamps the
  cache-busting version; `node build.mjs --serve` serves it with live reload.

## The 3D, and how it is made

All in `js/gl/kit.js`, on three.js:

| Piece | How |
| --- | --- |
| Stone, rock, sand, old steel | A standard material with noise painted in: tone and grime per vertex, grain, pits and scratches per pixel, bump-mapped from the same noise by screen-space derivatives |
| Moss | Shell texturing: the surface drawn again in up to 18 thin layers, pushed out along the normals in one instanced draw; each layer keeps only the little domes (and a finer fuzz) tall enough to reach it, so moss grows in cushions where a noise mask (more on top, less underneath) says |
| Grass, wheat, daisies, leaves | One instanced "plant" shader: geometry for a plant one unit tall, per-instance place, height, width, heading and lean; wind in the vertex shader, and blades leaning away from the pointer |
| The ring | A lathe of a rounded rectangle, resampled evenly so the moss cells stay square, displaced by noise |
| The vault door | A lathe of a grooved slab with rivets, a wheel of eight spokes, bolts, a handle and hinges |
| Light | A soft sky baked into an environment map, a low sun with shadows, ACES tone mapping |

The hero has its own renderer. The three smaller pictures share one renderer that draws off screen and copies each
picture into its own canvas, so the page holds two WebGL contexts (plus the water's) however many pictures it has.

## What moves, and where

| Module | What it adds |
| --- | --- |
| `intro.js` | First visit: a vault dial turns while the page loads and counts to 100, clicks a notch, and the screen lifts away; then the giant word rises out of its baseline, the garden grows up out of the mound, the copy and the threat card arrive. A repeat visit (or a deep link) skips the dial |
| `hero3d.js` | The stone ring and its vault door on a grass mound, wheat and daisies, rocks, moss crumbling off the first letter of the word behind (it scatters from the pointer and drifts home). **Drag the wheel** round (or click the face in the threat card) and, turned far enough, the bolts draw back and the door swings open on a light; the threat card notices and raises "Vault Tampering". The scene leans to the pointer and sinks as you scroll; the resolution, then the detail, steps down on a slow machine (a step that saves nothing is usually taken back) |
| `water.js` | The background: light at the bottom of a pool (animated Voronoi caustics, domain-warped), crisp under the hero and softer below, seen through every light section from one fixed canvas. The pointer drops rings into it |
| `live.js` + `viz.js` | The cards are live: the radar sweeps and its nodes ping, the gauge breathes, the spark chart runs, the glass timeline slides, the threat matrix flares, the traffic grid's red bar walks, the performance bars roll a day of data, the counters tick |
| `layers.js` | The accordion plays through the four layers on its own while on screen (a line fills under the open one) until you open one or press its pause button; the two cards turn over to each layer's numbers and colours, and the garden's camera moves to match (Data Protection finds a vault set in the rock) |
| `protect.js` | Tabs (arrow keys, roving focus) that play through too, with their own pause button; the copy, the panels and the laptop's screen change with them |
| `monitor.js` | The figure on their phone, as a security camera sees them: drawn pixel by pixel at 12 frames a second, film grain, pink zigzags that bulge round the pointer, a slice that glitches now and then |
| `scenes.js` | The garden behind the layer cards, the laptop on its rock (its screen is a canvas: the wordmark, a model of signals, a shield), the chain link in the sand |
| `reveals.js` | Headings rise word by word out of their lines, the statement lights as you read it (to the shot's white-then-grey), numbers count, the checklist ticks itself, the performance card's frame draws, the footer's word rises letter by letter and its letters lift under the pointer |
| `field.js` | Behind the call to action: the vault's wheel in a field of dots, turning with the scroll, the pointer a lens |
| `nav.js`, `ui.js` | A header that frosts once the page moves, steps aside while you read down, turns light over the dark sections and marks where you are; rolling labels, magnetic buttons, cards that tilt with a light across them, a cursor label over what you can drag, gliding anchors, an honest sign-up form, the Pause motion switch |

## Quality

- Every effect resolves to the resting design. Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing
  animates and the 3D is drawn once. Without WebGL (or with `?nogl`) the ring, the door and the mound are drawn in
  CSS gradients; without JavaScript the page reads in full. `?still` skips the hero's entrance.
- **Pause motion**, a switch by "Back to top" in the footer (and first in the tab order after the skip link), stops
  everything that moves on its own: the 3D, the water, the cards' live visuals and counters, the monitor, the CTA's
  field, the accordion's and the tabs' autoplay, the CSS loops (`html.is-paused`). Each canvas keeps its last frame,
  and draws a still one after a resize. The choice is remembered (`localStorage`), so the next visit arrives at rest,
  without the intro. Scrolling, the local time, and what answers a click or the pointer (hover effects, a tab or a
  layer someone picks) still work. Under reduced motion there is nothing to pause, and without JavaScript the CSS loops
  hold from the start; in both the switch is hidden. In code: `motion.paused`, `setPaused()` and the `motion` event
  in `core.js`; every endless loop goes through its `loop()`, which honours it.
- The 3D is built in slices, handing the main thread back between them, and its shaders compile in parallel where the
  browser can, so the intro keeps turning. The small scenes wait until the hero is built and has risen; where frames
  are too slow for slices (a software GPU, or frames over 200 ms apart), they are built in one go instead, a software
  GPU's as soon as the hero's first frame is out. Every canvas and loop runs only while on screen and the tab is visible.
- Keyboard-complete: skip link, then the Pause motion switch (shown when focused), a focus ring everywhere, an
  accordion and tabs with their ARIA and arrow keys (each holds while the pointer or focus is in it, and has its own
  pause button), and the vault can be opened without dragging (the face in the threat card; with motion paused it
  raises the alarm itself); screen readers hear the vault's alarm and the real numbers while the counters run.
  Without JavaScript all four accordion panels show, and their buttons say so.
- From 360 px to wide screens with no horizontal scroll: the hero is one scaled picture (1440 × 969 design px fitted
  to the screen) on landscape screens, with the copy and the threat card stepping into a row beneath it in short,
  narrow windows (761-1000 × 501-640 px, where a desktop zoomed to 150-200 % lands, so their text grows with zoom),
  and a column on phones and upright tablets; the 3D follows a CSS anchor, so CSS alone decides the composition.
  Past 1440 × 969 the copy and the threat card keep the shot's type size, as the nav does, so browser zoom still
  enlarges them on big screens; dense landscape windows up to 1300 × 820 (where a 1440p screen at 200 % lands) get a
  slightly higher type floor.

## Credits

- Design: recreated from an OQURO concept shot (cyber-security landing page); the call to action and the footer are
  extrapolated.
- Type: [Anton](https://github.com/googlefonts/AntonFont) for display, [Inter](https://github.com/rsms/inter) for text,
  [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) for labels, self-hosted, all under the SIL Open Font
  License (licences in `assets/fonts/`).
- [three.js](https://threejs.org) r187 (MIT), cut down to what the page uses by `tools/three-bundle.mjs`;
  [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
- Simplex noise in the shaders: "webgl-noise" by Ashima Arts and Stefan Gustavson (MIT); the hash after Dave Hoskins.
- OQURO, its numbers, threats and devices are fictional. It is a design study, not a security product.

`node oquro/tools/share.mjs` renders the share image (`assets/img/og.jpg`; needs Playwright).
`node oquro/tools/three-bundle.mjs` rebuilds `vendor/three.min.js` (needs esbuild and three where Node finds them).
