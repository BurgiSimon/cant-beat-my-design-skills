# Can't Beat My Design Skills

Websites built from a single design, each its own project, behind one picker.

**Live:** https://burgisimon.github.io/cant-beat-my-design-skills/

| Site | Where |
| --- | --- |
| **Mist**, a marketing site for an AI workflow-automation product | [`/mist/`](https://burgisimon.github.io/cant-beat-my-design-skills/mist/) |
| **Nelson**, a CRM landing page recreated 1:1 and given a motion layer | [`/nelson-crm/`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/) |
| **AsterPay**, a money app's hero recreated from one shot and grown into a full landing page | [`/asterpay/`](https://burgisimon.github.io/cant-beat-my-design-skills/asterpay/) |
| **Vizen**, a helmet store's product page recreated from one shot, its rider raymarched in WebGL | [`/vizen/`](https://burgisimon.github.io/cant-beat-my-design-skills/vizen/) |
| **UnoRouter**, an AI model router's hero recreated from one shot, in pixels, and grown into a full landing page | [`/unorouter/`](https://burgisimon.github.io/cant-beat-my-design-skills/unorouter/) |
| **OFFFORM**, a sportswear shop recreated from a two-artboard shot and given a motion layer | [`/offform/`](https://burgisimon.github.io/cant-beat-my-design-skills/offform/) |
| **OQURO**, a cyber-security page recreated from one shot, its 3D renders rebuilt as real-time 3D in code | [`/oquro/`](https://burgisimon.github.io/cant-beat-my-design-skills/oquro/) |
| **Crestora**, a footer recreated from one shot and set in motion (a car drifting down a road of light), grown into the whole 30-page website it belongs to | [`/crestora/`](https://burgisimon.github.io/cant-beat-my-design-skills/crestora/) |

## The picker

The front page ([`picker/`](picker/)) is a line of cards, one per site, each with a still of that site's hero.

- **Point at a card** and it lights up with a trace in its site's own manner: on Mist, wisps of mist drift
  across the foot and part around the pointer; on Nelson, a hole tears open in the clouds onto a night of
  drifting ASCII, the way its hero tears its paper; on AsterPay, an orbit of light closes round the pointer and a
  streak sweeps along its horizon, as in its hero; on Vizen, the hero's reticle locks onto the pointer with a streak
  of brake light through it; on UnoRouter, a halo of cells round the pointer steps through its four colours the way
  its mark does; on OFFFORM, the hero's two rules cross at the pointer, its ring closes round it with a light running
  it, and speed lines stream off behind a quick move; on OQURO, the vault dial of its preloader closes round the
  pointer while rings spread through the water under it; on Crestora, a fan of lanes in the road's colours streams
  back from the pointer, as the road streams from its car.
- **Choose one** and the card grows to fill the screen, its still giving way to the colour that site paints
  first: Mist's bare violet sky, Nelson's white preloader, AsterPay's dark one, the black of Vizen and of UnoRouter,
  OFFFORM's orange, OQURO's pale grey, Crestora's black.
  The site's own entrance then plays from there, so the move from picker to site has no seam.
- While the cards fit the screen they stand in the middle. With more sites than fit, the line becomes
  endless: it drifts when left alone, and the wheel, a drag or the arrow keys move it.
- On a phone the cards are a strip you swipe; the one in the middle is lit.
- Keyboard: the arrow keys go from card to card, and Enter opens one. With reduced motion there is no drift,
  no trace and no opening animation. Without JavaScript it is still a row of links.

To add a site: a link in `picker/index.html` with its own `data-id`, its `--still` and `--arrive` in
`picker/picker.css`, and its stills from `node picker/tools/stills.mjs` (which renders every still and the
share image, or only the named sites' stills: `node picker/tools/stills.mjs vizen offform`; it needs Playwright). A
trace of its own in `picker/picker.js` is optional.

## Mist

A complete marketing site for **Mist**, a (fictional) AI workflow-automation product, grown out of a
single hero design: a violet sky, magenta-lit peaks and glowing mist. It lived at the root of the site
until the picker took that place; its old addresses (`/signup.html` and so on) now forward to `/mist/`.

### What's inside

| Page | Highlights |
| --- | --- |
| `index.html` | Hero · customer logos · platform mockup with live run log · how it works · features bento · use-case tabs · impact numbers · testimonials · pricing with billing toggle and comparison table · FAQ · final CTA |
| `signin.html`, `signup.html` | Split-screen auth with SSO disclosure, password reveal, reset flow, plan-aware sign-up (`?plan=starter\|team\|enterprise`) and a password strength meter |
| `privacy.html`, `terms.html` | Long-form legal pages with a sticky, scroll-aware table of contents |
| `404.html` | "Lost in the fog" — works at any URL depth on GitHub Pages |

All forms validate on the client and show success states; there is no backend.

## Nelson CRM

A separate project lives in [`nelson-crm/`](nelson-crm/): a 1:1 recreation of a CRM landing-page
design by [@uisabor](https://x.com/uisabor/status/2120804761528328263), then given a restrained,
premium motion layer.

| Page | What it is |
| --- | --- |
| [`/nelson-crm/`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/) | Final site with motion: preloader + hero reveal, WebGL torn-paper hero whose eye follows the cursor, Lenis smooth scroll, GSAP scroll reveals, ASCII night-cloud field, custom cursor with magnetic buttons, live dashboard details |
| [`/nelson-crm/recreation.html`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/recreation.html) | The static recreation it started from: pixel-matched to the design at 1440px, no motion layer |

It is prebuilt (`python3 nelson-crm/src/build.py`); `build.mjs` only copies its runtime files into
`dist/nelson-crm/`. See [`nelson-crm/README.md`](nelson-crm/README.md).

## AsterPay

A third project lives in [`asterpay/`](asterpay/): a fintech hero recreated from a single concept shot (measured
against it at 1440px) and grown into a full landing page in the same language.

| Part | What it is |
| --- | --- |
| Hero | The shot, live: a raw-WebGL horizon of light fitted to the shot's colours, rings with orbiting lights, floating market figures that tick, two phones in perspective whose screens update |
| Sections | Payments (a dotted globe of transfers and a slide to send), Cards (a 3D card with live controls), Invest (a chart to scrub across assets and ranges), features, about, reviews, FAQ, and a call to action over a field of money in ASCII |
| Motion | Preloader into the header, Lenis smooth scroll, GSAP scroll reveals and SplitText, rolling digits, magnetic buttons |

No build step: plain HTML, CSS and ES modules, copied into `dist/asterpay/` by `build.mjs`. See
[`asterpay/README.md`](asterpay/README.md).

## Vizen

A fourth project lives in [`vizen/`](vizen/): a helmet store's product page recreated from one shot (measured against
it at 1440 × 960) and grown into a full page. The shot's rider is a photograph; here he is a model, raymarched in one
WebGL2 shader, so the camera can go round him, the visor opens and the paint changes.

| Part | What it is |
| --- | --- |
| Hero | The shot, live: the rider in WebGL with the photograph's ghosting and the brake light's streak; the views, arrows and a drag turn him, a click opens the visor, a colour is scanned onto the shell; sizes, quantity, an accordion, a cart the helmet flies into |
| Sections | An anatomy where the helmet lifts off his shoulders and turns to each part under leader lines from its 3D points, a wind tunnel drawn in ASCII round the helmet's own silhouette, the Vault of paints as turntables, about, a footer whose wordmark draws itself |
| Motion | A preloader whose reticle becomes the product frame and a rider who develops out of ASCII, Lenis smooth scroll, GSAP scroll reveals and SplitText, rolling digits, scrambled labels |

No build step either; copied into `dist/vizen/` by `build.mjs`. See [`vizen/README.md`](vizen/README.md).

## UnoRouter

A fifth project lives in [`unorouter/`](unorouter/): an AI model router's hero recreated from a single shot (measured
against it at 1440 × 1080, down to the colour of each cell in its mark) and grown into a full landing page in the same
pixel language.

| Part | What it is |
| --- | --- |
| Hero | The shot, live: the mark as 52 × 48 cells whose colour bands flow from the shot's own frame, part round the pointer, ring out from a press and route requests down its bars and out through its rays; a dot-matrix headline that decodes; figures that count and a token count that runs |
| Sections | A providers strip, a quickstart whose one changed line types itself and whose request streams back, a models explorer (search, filters, sorting, copy), a fallback simulator you can break, rankings in bars of cells, pricing, FAQ, and a key generator over the mark in the dark |
| Motion | A boot log into the hero, a WebGL dot grid that wakes round the pointer, Lenis smooth scroll, GSAP scroll reveals, magnetic buttons, a favicon that cycles colours |

No build step: plain HTML, CSS and ES modules, copied into `dist/unorouter/` by `build.mjs`. See
[`unorouter/README.md`](unorouter/README.md).

## OFFFORM

A sixth project lives in [`offform/`](offform/): a sportswear shop recreated from one shot of two artboards (the top
of the home page, and the sections after it), measured against it at 1440px, then carried on in the same language.

| Part | What it is |
| --- | --- |
| From the shot | Announcement, header, the orange hero with its ring and rules, the manifesto, the band with its 2026 badge, the latest edit (tabs and a product rail), After Hours, Find your own pace |
| Grown from it | A research dept. with a motion study drawn in type, a run club, a newsletter and a footer with the wordmark |
| Motion | A preloader that counts the collection in and hands its number to the hero; both hero photographs in raw WebGL (a streak entrance, a smear along the sprinter's run as you move, the man beside her standing still); Lenis, GSAP scroll reveals and SplitText; a draggable rail with in-place colour swatches and quick add to a bag; a torch on After Hours; an ASCII runner with motion-capture markers and chronophotographic echoes |

No build step either; copied into `dist/offform/` by `build.mjs`. The photographs are free-licence stand-ins graded
to the shot (see [`offform/CREDITS.md`](offform/CREDITS.md)). See [`offform/README.md`](offform/README.md).

## OQURO

A seventh project lives in [`oquro/`](oquro/): a cyber-security landing page recreated from one shot, every section of
it, with the shot's 3D renders (a mossy stone ring holding a vault door, a rocky outcrop, a laptop on a boulder, a
chain link in sand) rebuilt as real-time 3D, entirely in code.

| Part | What it is |
| --- | --- |
| Hero | The giant word with a three.js garden in front of it: procedural stone, moss grown by shell texturing, instanced grass, wheat and daisies in the wind, moss crumbling off the first letter. Drag the vault's wheel round and the door opens, and the threat card raises the alarm. Behind it all, animated pool caustics |
| Sections | A security-camera figure drawn pixel by pixel, a statement lit as you read, an accordion and tabs that play through with live cards (radar, gauge, spark chart, timeline, threat matrix), a garden and a laptop in 3D, a performance card, a call to action over the vault in dots |
| Motion | A vault-dial preloader into the hero, Lenis smooth scroll, GSAP scroll reveals and SplitText, magnetic buttons, tilting cards, a nav that adapts to each section |

No build step: plain HTML, CSS and ES modules, copied into `dist/oquro/` by `build.mjs`. See
[`oquro/README.md`](oquro/README.md).

## Crestora

An eighth project lives in [`crestora/`](crestora/): a footer recreated from a single shot (measured against it at its
own size) and set in motion, then grown into the whole website behind it. Crestora is a creative workspace whose idea
comes from the footer's road: *every idea gets a lane*, and each of the road's six colours is one stage of a project
(Spark, Shape, Make, Review Room, Countdown, Afterglow). Every page ends in the footer's night.

| Part | What it is |
| --- | --- |
| The footer | WebGL2: a road of light traced off the shot (210 lanes lofted between 14 guides, dashes streaming along them), the car cut from the shot with its wheels turning and the light sliding over its paint, dust off its tail, stars. An intro where the road lights from under the car at warp speed; the pointer is a lamp over the road, and holding it down floors the throttle |
| Home | Six light threads on the footer's own ribbon geometry that bend round the pointer and close into one ribbon on scroll; a pinned flow where the lanes light stage by stage; a working mock of the app; a filterable wall of work; plans; a finale form that launches the page into the footer, where the road's reveal replays |
| The rest | Every page the footer links to: integrations, pricing, changelog, roadmap, security, about, careers, press, partners, contact, Field Notes and six posts, docs, an API reference, help, community, tutorials, webinars, the legal pages and a sitemap, plus sign-up by magic link |
| Motion | Lenis smooth scroll, GSAP ScrollTrigger and SplitText, rolling Michroma digits, rolling links, spotlight panels; all of it resting under reduced motion and readable without scripts |

No build step to publish: plain HTML, CSS and ES modules, copied into `dist/crestora/` by `build.mjs`; its pages are
assembled from `crestora/src/` by `crestora/tools/pages.mjs`. See [`crestora/README.md`](crestora/README.md).

## Develop

Requires Node 20+. No dependencies to install.

```bash
node build.mjs --serve        # http://localhost:4321 — the picker and every site under it; rebuilds and live-reloads on change
node build.mjs                # production build into ./dist
```

`SITE_URL` (absolute URL, no trailing slash) and `BASE_PATH` (e.g. `/repo`) feed canonical URLs,
Open Graph tags, the sitemap and the 404 page's `<base>` (Mist's own get `/mist` added); the GitHub
Actions workflow sets both automatically.

## Structure

```
build.mjs              zero-dependency build of every site: includes, CSS bundle, sitemap, robots, dev server
picker/                the front page, published at the root
  index.html           one card per site
  picker.css, .js      the line of cards, the traces and the opening
  assets/              stills (wide + tall per site), fonts, favicon, share image
  tools/stills.mjs     renders the stills and the share image (Playwright; not published)
DESIGN.md              Mist: design system, components, motion, a11y rules and product facts
src/                   Mist, published under /mist/ (its 404 page answers for the whole site)
  pages/               one file per page; <!-- @include path --> pulls in partials
  partials/            head-common, header (+ mobile menu), footer, sections/*
  css/NN-name.css      concatenated in order into css/styles.css (tokens → base → header → sections → pages)
  js/main.js           entry; core/* runs everywhere, modules/<name>.js loads for [data-module="name"]
  assets/              self-hosted fonts, images, icons
  static/              copied to the root of Mist (web manifest)
nelson-crm/            separate prebuilt project, published under /nelson-crm/
asterpay/              separate project, no build step, published under /asterpay/ (its README and tools/ stay behind)
vizen/                 separate project, no build step, published under /vizen/ (its README and tools/ stay behind)
unorouter/             separate project, no build step, published under /unorouter/ (its README and tools/ stay behind)
offform/               separate project, no build step, published under /offform/ (its README, CREDITS and tools/ stay behind)
oquro/                 separate project, no build step, published under /oquro/ (its README and tools/ stay behind)
crestora/              separate project, published under /crestora/ (its README, src/ and tools/ stay behind)
```

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`: it builds with Node and publishes `dist/` to
GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Quality (Mist)

- Progressive enhancement: everything readable without JavaScript; widgets are keyboard-complete with
  correct ARIA; `prefers-reduced-motion` turns all motion off.
- Responsive from 360px to wide desktop; no horizontal overflow.
- Self-hosted variable fonts (subset to Latin plus arrows, ⌘ and tabular figures), responsive WebP
  art, preloaded hero image, minified and cache-busted CSS.
- Favicon (adapts to light/dark tabs), touch icons, web manifest, Open Graph image, sitemap, robots,
  FAQ and product structured data.
- Deep links land instantly (smooth scrolling switches on after load); print styles hide the fixed
  chrome and keep headings legible.

## Credits

- Type: [Inter](https://github.com/rsms/inter) and [DM Sans](https://github.com/googlefonts/dm-fonts) for
  Mist (licences in `src/assets/fonts/`); [Mona Sans](https://github.com/github/mona-sans) and
  [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) for the picker (licences in
  `picker/assets/fonts/`). All under the SIL Open Font License.
- Landscape art: adapted from a wallpaper published on wallpapers.com (sky replaced, birds removed,
  mist added). Check its licence before using this site commercially.
- AsterPay: [Satoshi](https://www.fontshare.com/fonts/satoshi) (ITF Free Font License), loaded from Fontshare's CDN
  rather than committed; land outlines from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
- Vizen: [Inter Tight](https://github.com/rsms/inter) and [Roboto Mono](https://github.com/googlefonts/robotomono)
  (SIL Open Font License, licences in `vizen/assets/fonts/`).
- UnoRouter: [Doto](https://github.com/oliverlalan/Doto) and [Geist Mono and Geist](https://github.com/vercel/geist-font)
  (SIL Open Font License, licences in `unorouter/assets/fonts/`).
- OFFFORM: [Barlow Condensed](https://github.com/jpt/barlow), JetBrains Mono and Inter (SIL Open Font License,
  licences in `offform/assets/fonts/`); photographs from Unsplash and Pexels under their licences, credited in
  `offform/CREDITS.md`.
- OQURO: [Anton](https://github.com/googlefonts/AntonFont), Inter and JetBrains Mono (SIL Open Font License, licences in
  `oquro/assets/fonts/`); [three.js](https://threejs.org) (MIT), cut down to what it uses.
- Crestora: recreated from a footer shot signed "Made with love by Pranav", and its car picture is cut from that shot;
  [Michroma](https://github.com/googlefonts/Michroma-font) and [Inter](https://github.com/rsms/inter) (SIL Open Font
  License, licences in `crestora/assets/fonts/`); GSAP with ScrollTrigger and SplitText, and Lenis (MIT), vendored.
- Mist, its customers, people, quotes and numbers are fictional. The investor line in the hero comes
  from the original design. AsterPay, its people, reviews and figures are fictional too, and so are Vizen and its
  helmets. UnoRouter's hero copy and figures come from its shot; its models list, prices, rankings and routing are
  illustrative and simulated. OFFFORM, its products, prices, people and run club are fictional too, and so are OQURO,
  its numbers and its threats. Crestora, its people, customers, apps, prices and numbers are fictional.
