# Crestora

A footer, recreated from one shot as close as it goes and set in motion, and then the whole website it belongs to.
**Crestora** is a (fictional) creative workspace that carries a project from its first spark to launch night. Its
footer is the shot: links over a night where a car drifts down a road of light. Every page ends in that night, and
the site grows its design out of it.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/crestora/
- **No build step to publish:** plain HTML, CSS and ES modules. `build.mjs` at the repo root copies the site to
  `/crestora/` and stamps the tokens and the cache-busting version; `node build.mjs --serve` serves it with live reload.
  The pages themselves are assembled from `src/` by `tools/pages.mjs` (below); the assembled files are committed.

## The idea: every idea gets a lane

The road in the footer is six bands of light. The site gives each band a meaning: one stage of a creative project.
A colour always means its stage, and the full spectrum means the whole flow.

| Stage | Colour | What happens there |
| --- | --- | --- |
| Spark | blue `#3a6dff` | ideas, references, a moodboard |
| Shape | cyan `#23d3ff` | the brief, milestones, the plan |
| Make | green `#20d69b` | versions, renders, the work itself |
| Review Room | amber `#ffb13d` | notes pinned to frames, approvals |
| Countdown | red `#ff3b3b` | the launch checklist, the clock |
| Afterglow | pink `#ff7ad9` | what the launch did: views, comments, a recap |

The running example is Amara's short film *Night Bloom*, followed from its moodboard to launch day on Fri 11 Dec 2026.

## Pages

| | |
| --- | --- |
| **Home** (`index.html`) | A hero of six light threads (WebGL2, on the footer's own ribbon geometry) that bend round the pointer and close into one ribbon as you scroll; a pinned flow where six bands of lanes light stage by stage with the *Night Bloom* card riding the ribbon; three creators; the workspace (a working mock of the app: board, calendar, review); integrations as a road diagram; a filterable wall of work with rolling stats; plans with a billing switch; and a finale whose form launches the page into the footer, where the road's reveal replays at warp speed |
| **Product** | Integrations (a searchable directory of 24 invented apps, each with a details dialog), Pricing (plans, a seat slider, a comparison table with a lens that follows the pointer, creator grants, FAQ), Changelog (a lane timeline that lights as you read), Roadmap (votes, kept), Security |
| **Company** | About (the founding story on a pinned ribbon timeline), Careers (filterable roles with pay bands), Press (a type tester, logo downloads drawn from the wordmark), Partners, Contact (four hubs with live local hours) |
| **Resources** | Field Notes (a blog and six posts with a reading bar and a lane recap that fills as you read), Docs, an API reference (code in three languages, remembered), Help (search over the answers), Community, Tutorials (progress kept), Webinars (a countdown, calendar files) |
| **Legal** | Privacy, Terms, Cookies (whose Preferences switch every stored choice on the site obeys), Compliance, and a Sitemap page with `sitemap.xml` |
| **Start** (`start.html`) | Opening a lane, and signing in by magic link (no passwords anywhere) |

## The footer

On a landscape screen the footer *is* the shot (1597 × 985 design px, fitted to the screen and set on its bottom
edge); the night around it is WebGL and runs on past the frame to the screen's edges. The type was measured against
the shot at its own size: the wordmark, the tagline, the four columns, the rule and the bottom row land within a pixel
or two of it. The wordmark is Michroma with a hairline of stroke to bring it up to the shot's weight; everything else
is Inter. The road was traced off the shot band by band (`js/footer/geometry.js`) and its colours sampled from it.

| Part | What it does |
| --- | --- |
| The road (`js/footer/geometry.js`, `js/footer/scene.js`) | One ribbon of 210 lanes lofted between 14 guides traced off the shot: it comes in from the left, pinches under the car and fans out to the right. Dashes run along every lane, measured against the lanes around them, so they shrink and slow toward the car and race past at the edges. Under it, nested arches of road rise from the bottom edge |
| The car | Cut from the shot (`tools/cut_car.py`, its maker's lettering painted out) and drawn in WebGL: the wheels turn (motion-blurred), the road's colours slide along the paint, a glint runs nose to tail now and then, it bobs on its springs |
| The dust | A plume behind the tail and a low cloud off the rear wheel, rolling back with the road, plus puffs and specks flung off the tail, simulated on the CPU |
| The stars | Three layers that twinkle and drift with the pointer |
| Intro (`js/footer/intro.js`) | When the footer first comes into view: the night comes up, the road lights from under the car outward at warp speed and slows to a cruise as the car rolls in and settles; the mark turns in, the name rises letter by letter, the columns follow, the rule draws itself |
| Over the road (`js/footer/ui.js`) | The pointer is a lamp: lanes and paint brighten under it, the dust parts round it. **Hold** (mouse, finger or Space) and the throttle goes down: the road streams, the stars streak, the car squats, the hint reads out the speed |
| The details | Links roll up into a white copy of themselves; the social boxes lean toward the pointer and light a ring of the road's colours; the chrome mark turns to the pointer; a glint rides the rule; the heart beats, and a click sends hearts up |

The footer's scripts load only once it is within a screen and a half, and its night only draws while it is on screen.

## How it's made

```
src/pages/**.html        each page's <main>, with a header comment: title, description, modules, nav
src/partials/            head, header (with its mega-menus), icons (one SVG sprite), cta, footer, home/<section>
src/css/NN-name.css      concatenated in order into css/site.css: 00 tokens, 01 base, 02 brand, 03 the kit,
                         10 header, 20–27 home sections, 50–69 pages, 90 footer
js/main.js               the entry on every page: core, then the page's modules (js/modules/<name>.js), then the footer
js/core.js               Lenis smooth scrolling (where there is a wheel), the header, and the data-attribute motion kit:
                         data-reveal, data-split, data-odometer, data-count, data-roll, data-spotlight, data-magnetic …
js/modules/              generic (tabs, filter, forms, toc, copy, dialog, countdown, ics, billing) and per page
js/gl/lanes.js           the home page's one extra canvas (hero and flow), on the footer's geometry and shaders
js/footer/               the footer's scene, intro and details
```

- Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing animates: every section shows its resting design and
  the night is drawn once. Without scripts every page reads in full (controls that need scripts are hidden), and
  without WebGL the canvases give way to stills.
- From 360 px to wide screens with no horizontal scroll; the menu becomes a full-screen dialog under 1024 px.
- Keyboard: every control is reachable, menus and dialogs keep focus and close on Escape, tablists take arrow keys.
- Stored choices (billing period, code language, votes, tutorial progress …) live in `localStorage` under `crestora:`,
  and the cookie page's Preferences switch turns all of them off.

## Tools (not published)

- `node crestora/tools/pages.mjs [--watch]` assembles the pages, `css/site.css` and `sitemap.xml` from `src/`.
- `node crestora/tools/links.mjs` checks that every local `href`, `src` and `#id` on every page resolves.
- `node crestora/tools/shot.mjs <page> [--w --h --full --el --reduced --nojs --out]` photographs a page and reports
  console errors, failed requests and horizontal overflow.
- `node crestora/tools/share.mjs` renders `assets/img/og.jpg` (the home page's first screen) and
  `assets/img/poster.jpg` (the footer's night, its stand-in without WebGL). Needs Playwright.
- `python3 -I crestora/tools/cut_car.py <shot.png> <out-dir>` cuts the car out of the shot. Encode `car-2x.png` to
  `assets/img/car.webp`.
- `tools/SPEC.md` is the brief the site was built from.

## Credits

- Design: the footer is recreated from a shot signed "Made with love by Pranav" (the line is kept as the shot has it);
  the car picture is cut from that shot, and the car belongs to its maker. The rest of the site is designed from it.
- Type: [Michroma](https://github.com/googlefonts/Michroma-font) and [Inter](https://github.com/rsms/inter), both under
  the SIL Open Font License (licences in `assets/fonts/`).
- [GSAP](https://gsap.com) 3.13 with ScrollTrigger and SplitText (GSAP standard license) and
  [Lenis](https://github.com/darkroomengineering/lenis) (MIT), vendored in `vendor/`.
- Crestora, its people, customers, quotes, apps, prices and numbers are fictional.
