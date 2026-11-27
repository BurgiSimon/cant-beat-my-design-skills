# Can't Beat My Design Skills

Websites built from a single design, each its own project, behind one picker.

**Live:** https://burgisimon.github.io/cant-beat-my-design-skills/

| Site | Where |
| --- | --- |
| **Mist**, a marketing site for an AI workflow-automation product | [`/mist/`](https://burgisimon.github.io/cant-beat-my-design-skills/mist/) |
| **Nelson**, a CRM landing page recreated 1:1 and given a motion layer | [`/nelson-crm/`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/) |
| **AsterPay**, a money app's hero recreated from one shot and grown into a full landing page | [`/asterpay/`](https://burgisimon.github.io/cant-beat-my-design-skills/asterpay/) |
| **OFFFORM**, a sportswear shop recreated from a two-artboard shot and given a motion layer | [`/offform/`](https://burgisimon.github.io/cant-beat-my-design-skills/offform/) |

## The picker

The front page ([`picker/`](picker/)) is a line of cards, one per site, each with a still of that site's hero.

- **Point at a card** and it lights up with a trace in its site's own manner: on Mist, wisps of mist drift
  across the foot and part around the pointer; on Nelson, a hole tears open in the clouds onto a night of
  drifting ASCII, the way its hero tears its paper; on AsterPay, an orbit of light closes round the pointer and a
  streak sweeps along its horizon, as in its hero; on OFFFORM, the hero's two rules cross at the pointer, its ring
  closes round it with a light running it, and speed lines stream off behind a quick move.
- **Choose one** and the card grows to fill the screen, its still giving way to the colour that site paints
  first: Mist's bare violet sky, Nelson's white preloader, AsterPay's dark one, OFFFORM's orange. The site's own
  entrance then plays from there, so the move from picker to site has no seam.
- While the cards fit the screen they stand in the middle. With more sites than fit, the line becomes
  endless: it drifts when left alone, and the wheel, a drag or the arrow keys move it.
- On a phone the cards are a strip you swipe; the one in the middle is lit.
- Keyboard: the arrow keys go from card to card, and Enter opens one. With reduced motion there is no drift,
  no trace and no opening animation. Without JavaScript it is still a row of links.

To add a site: a link in `picker/index.html` with its own `data-id`, its `--still` and `--arrive` in
`picker/picker.css`, and its stills from `node picker/tools/stills.mjs` (which renders every still and the
share image, or only the sites named, e.g. `node picker/tools/stills.mjs offform`; it needs Playwright). A trace of
its own in `picker/picker.js` is optional.

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

## OFFFORM

A fourth project lives in [`offform/`](offform/): a sportswear shop recreated from one shot of two artboards (the top
of the home page, and the sections after it), measured against it at 1440px, then carried on in the same language.

| Part | What it is |
| --- | --- |
| From the shot | Announcement, header, the orange hero with its ring and rules, the manifesto, the band with its 2026 badge, the latest edit (tabs and a product rail), After Hours, Find your own pace |
| Grown from it | A research dept. with a motion study drawn in type, a run club, a newsletter and a footer with the wordmark |
| Motion | A preloader that counts the collection in and hands its number to the hero; both hero photographs in raw WebGL (a streak entrance, a smear along the sprinter's run as you move, the man beside him standing still); Lenis, GSAP scroll reveals and SplitText; a draggable rail with in-place colour swatches and quick add to a bag; a torch on After Hours; an ASCII runner with motion-capture markers and chronophotographic echoes |

No build step: plain HTML, CSS and ES modules, copied into `dist/offform/` by `build.mjs`. The photographs are
free-licence stand-ins graded to the shot (see [`offform/CREDITS.md`](offform/CREDITS.md)). See
[`offform/README.md`](offform/README.md).

## Develop

Requires Node 20+. No dependencies to install.

```bash
node build.mjs --serve        # http://localhost:4321 — the picker, /mist/, /nelson-crm/, /asterpay/ and /offform/; rebuilds and live-reloads on change
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
offform/               separate project, no build step, published under /offform/ (its README, CREDITS and tools/ stay behind)
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
- OFFFORM: [Barlow Condensed](https://github.com/jpt/barlow), JetBrains Mono and Inter (SIL Open Font License,
  licences in `offform/assets/fonts/`); photographs from Unsplash and Pexels under their licences, credited in
  `offform/CREDITS.md`.
- Mist, its customers, people, quotes and numbers are fictional. The investor line in the hero comes
  from the original design. AsterPay, its people, reviews and figures are fictional too, and so are OFFFORM, its
  products, prices and run club.
