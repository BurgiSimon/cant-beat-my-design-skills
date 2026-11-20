# Mist — marketing site

A complete marketing site for **Mist**, a (fictional) AI workflow-automation product, grown out of a
single hero design: a violet sky, magenta-lit peaks and glowing mist.

**Live:** https://burgisimon.github.io/cant-beat-my-design-skills/

## What's inside

| Page | Highlights |
| --- | --- |
| `index.html` | Hero · customer logos · platform mockup with live run log · how it works · features bento · use-case tabs · impact numbers · testimonials · pricing with billing toggle and comparison table · FAQ · final CTA |
| `signin.html`, `signup.html` | Split-screen auth with SSO disclosure, password reveal, reset flow, plan-aware sign-up (`?plan=starter\|team\|enterprise`) and a password strength meter |
| `privacy.html`, `terms.html` | Long-form legal pages with a sticky, scroll-aware table of contents |
| `404.html` | "Lost in the fog" — works at any URL depth on GitHub Pages |

All forms validate on the client and show success states; there is no backend.

## Also here: Nelson CRM

A second, separate project lives in [`nelson-crm/`](nelson-crm/): a 1:1 recreation of a CRM landing-page
design by [@uisabor](https://x.com/uisabor/status/2120804761528328263), then given a restrained,
premium motion layer.

| Page | What it is |
| --- | --- |
| [`/nelson-crm/`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/) | Final site with motion: preloader + hero reveal, WebGL torn-paper hero whose eye follows the cursor, Lenis smooth scroll, GSAP scroll reveals, ASCII night-cloud field, custom cursor with magnetic buttons, live dashboard details |
| [`/nelson-crm/recreation.html`](https://burgisimon.github.io/cant-beat-my-design-skills/nelson-crm/recreation.html) | The static recreation it started from: pixel-matched to the design at 1440px, no motion layer |

It is prebuilt (`python3 nelson-crm/src/build.py`); `build.mjs` only copies its runtime files into
`dist/nelson-crm/`. See [`nelson-crm/README.md`](nelson-crm/README.md).

## Develop

Requires Node 20+. No dependencies to install.

```bash
node build.mjs --serve        # http://localhost:4321 — rebuilds and live-reloads on change
node build.mjs                # production build into ./dist
```

`SITE_URL` (absolute URL, no trailing slash) and `BASE_PATH` (e.g. `/repo`) feed canonical URLs,
Open Graph tags, the sitemap and the 404 page's `<base>`; the GitHub Actions workflow sets both
automatically.

## Structure

```
build.mjs              zero-dependency build: includes, CSS bundle, sitemap, robots, dev server
DESIGN.md              design system, components, motion, a11y rules and product facts
src/
  pages/               one file per page; <!-- @include path --> pulls in partials
  partials/            head-common, header (+ mobile menu), footer, sections/*
  css/NN-name.css      concatenated in order into css/styles.css (tokens → base → header → sections → pages)
  js/main.js           entry; core/* runs everywhere, modules/<name>.js loads for [data-module="name"]
  assets/              self-hosted fonts, images, icons
  static/              copied to the site root (web manifest)
nelson-crm/            separate prebuilt project, published under /nelson-crm/
```

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`: it builds with Node and publishes `dist/` to
GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Quality

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

- Type: [Inter](https://github.com/rsms/inter) and [DM Sans](https://github.com/googlefonts/dm-fonts),
  both under the SIL Open Font License (licences in `src/assets/fonts/`).
- Landscape art: adapted from a wallpaper published on wallpapers.com (sky replaced, birds removed,
  mist added). Check its licence before using this site commercially.
- Mist, its customers, people, quotes and numbers are fictional. The investor line in the hero comes
  from the original design.
