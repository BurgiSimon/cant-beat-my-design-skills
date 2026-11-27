# OFFFORM

A sportswear landing page recreated from one design shot: **OFFFORM**, "Not made to stand still." The shot shows two
artboards: the top of the home page (announcement, header, the orange hero, the manifesto, the band with its 2026
badge) and the sections after it (the latest edit, After Hours, Find your own pace). Both are rebuilt as close to the
shot as it goes, measured against it at 1440 px, and the page then carries on in the same language: a research
department with a motion study drawn in type, a run club and a footer.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/offform/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/offform/` and stamps the
  cache-busting version; `node build.mjs --serve` serves it with live reload.
- Sizes are the shot's own, in design pixels (`--u`, 1 px at 1440 wide), so the page keeps its proportions from a
  laptop to a wide screen; under 1000 px each section has a layout of its own.

## What moves, and where

| Module | What it adds |
| --- | --- |
| `intro.js` | First visit: the screen is the hero's orange and the collection counts up, 01 … 06, while the photographs load; the number then flies to its place in the hero, the orange draws back to uncover the header, and the hero assembles: the rules draw, the ring closes, the sprinter streaks in, the man rises, the headline climbs out of its lines. A repeat visit or a deep link skips the count |
| `hero.js` | Both hero photographs in one raw-WebGL quad, fitted like the CSS (`cover`, same focal points): the sprinter enters on a streak of stretched pixels, moving the pointer or the page smears him along his run (channels pulled apart) while the man beside him stands still, the wall warms under the pointer, the photo melts into the flat orange under the line. A light laps the ring, quicker while scrolling |
| `nav.js` | The announcement rolls through its messages; the header steps aside while reading down and returns on the way up, with a progress rule; Explore drops a panel with a picture per story; search (also on `/`) filters the products as you type; the phone menu |
| `shop.js` | Tabs filter the rail and the count rolls to the new number; drag and throw the rail, step it with the arrows, swipe it on a phone; quick add by size; swatches recolour the product in place (a canvas finds the garment against its background and repaints it, keeping its light and shade; shoes repaint only their coloured parts) |
| `bag.js` | A dot flies from the size you picked to the bag's count; a drawer with quantities and a meter toward the complimentary delivery the announcement promises |
| `reveals.js` | Headings climb out of their lines, the mono labels decode out of noise, the manifesto darkens word by word as you read it, the band runs faster with the scroll and turns with it while its badge swings, big type leans with the speed of the scroll, the coordinates hunt like a live fix |
| `after.js` | London's time, live, on every clock; the pointer is a torch the glossy jacket catches; the runner drifts slower than the type; the drop date rolls in |
| `pace.js` | The card you point at takes the room; each card reads out a live figure (a pace, a step count) |
| `lab.js` | A motion study in type: a procedural runner (walk, run, sprint) rasterised into characters every frame, its core spelled in the brand's letters, orange motion-capture markers on its joints, earlier exposures fading behind it as on a chronophotographic plate. Point at a joint and it reads its angle; each spec row lights the part of the body it is about |
| `club.js` | A countdown to the next session, rows that fill with orange as you pass with a photograph trailing the pointer, a join that holds your place |
| `foot.js` | The newsletter checks its address and answers; the wordmark rises letter by letter and stretches toward the pointer |
| `ui.js` | Labels that roll on hover, magnetic buttons, anchors that glide (and set the shop's filter), a cursor that says what a click will do |

## Quality

- Every effect resolves to the resting design. Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing
  animates, the WebGL hero is drawn once, and the page is complete. Without JavaScript the whole page reads: the hero
  photographs are plain images and the products are in the HTML.
- Keyboard: skip link, a focus ring on everything, roving-tabindex tabs and pace control, dialogs (bag, search) that
  keep focus inside and give it back, Escape closes every overlay.
- From 360 px to wide screens with no horizontal scroll. Canvases and loops only run while on screen and while the tab
  is visible; Lenis only where there is a wheel.

## Credits

- Design: recreated from an OFFFORM concept shot; the research dept., run club and footer are extrapolated.
- Type: [Barlow Condensed](https://github.com/jpt/barlow) (SIL OFL), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono)
  (SIL OFL) and [Inter](https://github.com/rsms/inter) (SIL OFL), self-hosted; licences in `assets/fonts/`.
- Photographs: see [`CREDITS.md`](CREDITS.md). They are stand-ins for the shot's own pictures, graded to its palette.
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
- OFFFORM, its products, prices, people and run club are fictional. It is a design study, not a shop.

`python3 offform/tools/cards.py` writes the product cards into `index.html`; `python3 offform/tools/photos.py` grades
and crops the photographs into `assets/img/`.
