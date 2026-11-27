# AsterPay

A fintech landing page grown out of one hero shot: **AsterPay**, "All your money. One simple app." The hero is
recreated as close to the shot as it goes (measured against it at 1440 px: type, buttons, the floating figures, the
rings, the two phones in perspective, the colour of the light), and everything under it is new, drawn in the hero's
own language: hairline rails with crosshairs, the pill labels, and one orange horizon of light.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/asterpay/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/asterpay/` and stamps
  the cache-busting version; `node build.mjs --serve` serves it with live reload.

## What moves, and where

| Module | What it adds |
| --- | --- |
| `intro.js` | First visit: the mark turns in on dark, a count runs to 100, the mark flies into the header. Then the hero assembles: the light rises like a sunrise, the frame draws itself, the rings close from their tops, the headline's words rise, the figures switch on with rolling digits, the phones swing up into their V. Shorter on a repeat visit; skipped for a deep link |
| `glow.js` | The hero's light in raw WebGL: a horizon band fitted to the shot's colours point by point, a dome over the headline, heat haze, a streak that sweeps along the horizon and rests where the shot has it, the pointer lifting the light, grain against banding. Reused, low and rising with the scroll, behind the final call to action |
| `hero.js` | The phone screens are live: the chart's cursor glides along the curve and the price rolls to match, payments land on the balance. The floating figures drift, lean away from the pointer and tick like a market. Lights orbit on the rings. Scrolling lifts the copy away and raises the phones |
| `nav.js` | Product dropdown, a burger panel that is a real dialog (focus kept inside, Escape, scroll locked), a frosted bar once the page moves, hidden while reading down, a progress line, the current section marked |
| `reveals.js` | Headings rise out of their lines, the statement lights word by word as you read, numbers count up, the market tape and the reviews drift faster (and with you) when you scroll, the footer's wordmark rises letter by letter |
| `payments.js` | A dotted globe from Natural Earth's land outline: transfers arc out of New York and land with a ping; drag it to spin it. Pick an amount and slide to send: it turns to face the Atlantic and fires a bright arc to Lisbon with the amount on it |
| `card.js` | A card to hold: it tilts to the pointer with light sliding over the metal, flips when pressed, spins in from its back. Three finishes, freeze (frost over it), online payments (a flag on it), a monthly limit against what is spent |
| `invest.js` | The left phone's chart, grown up: four assets, five ranges, the line morphs between them, a crosshair reads any day's price, the last price keeps ticking |
| `bento.js` | A light that follows the pointer across the feature tiles and catches their edges; each tile works: the budget ring, round-ups filling a goal, the week's bars, a live exchange rate, alerts that keep arriving |
| `ascii.js` | A field of money in type (digits and currency signs) brightest over the horizon, drifting up like heat; the pointer is a lens that wakes and scrambles it |
| `ui.js` | Labels that roll on hover, magnetic buttons, anchors that glide and move focus, an FAQ that opens with its height |

## Quality

- Every effect resolves to the resting design. Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing
  animates, the WebGL light is drawn once, and the page is complete. Without JavaScript the whole page reads,
  phone charts included.
- Keyboard-complete: skip link, a focus ring on everything, the dropdown, the menu dialog, roving-tabindex tabs and
  swatches, switches and a range for the card controls, and the slide to send works as a button (Enter or Space).
- From 360 px to wide screens with no horizontal scroll: the hero is one scaled picture (1440 × 1000 design px fitted
  to the screen) on landscape screens and flows on phones and upright tablets.
- Canvases and loops only run while on screen and while the tab is visible; Lenis only where there is a wheel.

## Credits

- Design: the hero is recreated from an AsterPay concept shot; everything below it is extrapolated.
- Type: [Satoshi](https://www.fontshare.com/fonts/satoshi) by Indian Type Foundry, loaded from Fontshare's own
  CDN. Its licence (ITF Free Font License) allows self-hosting for your own site but not redistributing the font
  file through a repository, so it is not committed here.
- Land: [Natural Earth](https://www.naturalearthdata.com/) 1:110m (public domain), via
  [world-atlas](https://github.com/topojson/world-atlas) (ISC), rasterised into a 240 × 120 bitmap in `js/payments.js`.
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) 1.3 (MIT), vendored in `vendor/`.
- AsterPay, its people, reviews and numbers are fictional; market figures are made up. It is a design study, not a
  financial product.

`node asterpay/tools/share.mjs` renders the share image (`assets/img/og.jpg`; needs Playwright).
