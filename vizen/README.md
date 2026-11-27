# Vizen

A helmet store's product page recreated from one shot: **Dust Nomadic**, a full-face touring helmet, $649. The hero is
laid out as close to the shot as it goes (measured against it at 1440 × 960: the type, the frame and its reticle, the
card, the button, the price, the accordion, the colours, the corner cameras), and everything under it is new, drawn
in the hero's own language: black, mono labels, crosshair rulers, the warm dark panels and one yellow.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/vizen/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/vizen/` and stamps the
  cache-busting version; `node build.mjs --serve` serves it with live reload.

## The rider is not a photograph

The shot is a photograph of a rider in a white helmet. There is no photograph here: the rider is modelled as signed
distance fields and raymarched in one WebGL2 fragment shader (`js/gl/shaders.js`), and lit like the shot (a big
softbox up front, a yellow strip behind, a black studio). The helmet is fitted to the shot in profile: the glossy dome
with its brow that overhangs the side panel, the eye port cut as a wedge, the visor on its hinge, the chin bar and its
grille, the dark lower shell climbing to the back, the spoiler, the three-bar mark, the brake light. A post pass adds
what the photograph has: the ghosting to the left, the brake light's anamorphic streak, grain, a vignette.

Because it is a model and not a picture, it can do what a picture cannot:

| | |
| --- | --- |
| **Turn** | The arrows go round him by an eighth, the two Vault views jump to the front and the profile, the corner cameras to their angles, and a drag in the frame turns him by hand (and lets go with a fling). The brake light flashes when the turn brakes |
| **Open the visor** | A click (or Enter) in the frame lifts it on its hinge; behind it is the dark, quilted lining |
| **Paint** | A colour is laid on by a scan line running down the shell; the name in the title and on the card scrambles to the new paint |
| **Lift off** | Scrolling on, his shoulders sink away and the helmet comes forward for the anatomy, turning to each part as it is read |
| **Every still** | The views, the colours, the corner cameras, the cart's pictures, the Vault's turntables and the wind tunnel's silhouette are all rendered by the same shader, on the visitor's machine |

The scene renders only when something changed (and at a lower resolution while it moves, then once more at full
resolution when it settles); between those frames only the cheap post pass runs, to keep the light breathing.
`assets/img/rider.jpg` is a render of the hero kept as a picture: it shows while the shader compiles, and stays where
there is no WebGL or no script.

## What moves, and where

| Module | What it adds |
| --- | --- |
| `intro.js` | First visit: four corners of a reticle and a count on black while the shader compiles; the corners fly out to become the product frame, the black lifts, and the rider develops out of ASCII from the top down as the camera settles. The page assembles round him: the name rises out of its lines, the price and weight roll, the stars turn in. Shorter on a repeat visit; skipped for a deep link |
| `stage.js` | The fixed canvas and the director: the camera, the pointer turning his head a little, drag and arrows, the visor, the paint scan, the hero-to-anatomy blend, and all the stills |
| `shop.js` | Paint, size (the weight rolls to it), quantity, an accordion that opens with its height, a ship-by date. Add to cart: the button fills, the helmet flies in an arc into the bag, the bag takes it, the cart opens (it keeps what is in it). Compare, reviews, search (`/` or ⌘K) and account as real dialogs |
| `anatomy.js` | Four parts, each with a leader line worked out from its 3D point every frame, ending in the hero's reticle |
| `tunnel.js` | The wind tunnel, in type: the helmet's own profile as a silhouette, a distance field round it, air that slides along the shell and boils in the wake (more with the stabiliser off); the pointer stirs it, and the readouts follow the speed |
| `vault.js` | Every paint on the one shell; pointing across a card turns it, frame by frame as it is needed; a card puts its paint on the rider |
| `reveals.js` | Headings out of their lines, a statement that lights word by word, rolling numbers, a wordmark that draws itself |
| `ui.js` | Letters that run through glyphs on hover, buttons that lean to the pointer, anchors that glide, a tag that follows the pointer where there is something to do |

## Quality

- Every effect resolves to the resting design. Under `prefers-reduced-motion` (or `?reduced` in the URL) there is no
  intro, no drift and no scan; the rider is drawn once and the page is complete. Without WebGL the picture stays and
  the stills are cut from it; without JavaScript the whole page reads.
- Keyboard-complete: skip link, focus on everything, roving tabindex in the views, colours and sizes, the frame turns
  with the arrow keys and opens the visor with Enter, panels trap focus and give it back.
- From 360 px to wide screens with no horizontal scroll: the hero is placed in design px from its left, middle and
  right (and its foot from the bottom), so a wide or tall screen opens the composition instead of letterboxing it; on
  phones and upright tablets it flows.
- The canvases only run while on screen and while the tab is visible; Lenis only where there is a wheel.

## Credits

- Design: the hero is recreated from a Vizen concept shot; everything below it is extrapolated, and the rider is
  modelled rather than photographed.
- Type: [Inter Tight](https://github.com/rsms/inter) and [Roboto Mono](https://github.com/googlefonts/robotomono), both
  under the SIL Open Font License (licences in `assets/fonts/`).
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
- Vizen, its helmets, people, reviews and numbers are fictional. It is a design study, not a shop.

`node vizen/tools/share.mjs` renders the poster (`assets/img/rider.jpg`) and the share image (`assets/img/og.jpg`);
it needs Playwright, and software WebGL will do.
