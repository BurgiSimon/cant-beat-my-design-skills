# Crestora — the site spec

The whole site grows out of one design: the footer (`src/partials/footer.html`, `src/css/90-footer.css`, `js/footer/*`).
Everything must look cut from its frame. This file is the brief every builder works from. **Section 1 (decisions)
overrides anything below it**; sections 5 and 6 are the concept's detail, kept verbatim apart from those overrides.

## 1. Decisions (these win)

**Product.** Crestora is the creative workspace that carries a project from first spark to launch day, then shows how
it landed. Each project is a **lane** that moves through six **stages**, each with its tool and its colour (the footer
ribbon's own colour order, top to bottom):

| # | Stage | Tool | Colour | Token | Icon (self-drawn, 24 px grid, 1.6 stroke) |
|---|---|---|---|---|---|
| 01 | Spark | Sparkboard | blue `#3a6dff` | `--spark` | a four-point spark |
| 02 | Shape | Blueprints | cyan `#23d3ff` | `--shape` | a folded sheet with a corner |
| 03 | Make | Workbench | green `#20d69b` | `--make` | a pen nib crossed with a cursor |
| 04 | Review | **Review Room** (never "Pit Stop") | amber `#ffb13d` | `--review` | a speech bubble with a pin |
| 05 | Launch | Countdown | red `#ff3b3b` | `--launch` | an upward arrow leaving a horizon line (no chequered flag) |
| 06 | Afterglow | Afterglow | pink `#ff7ad9` | `--afterglow` | a half sun over a horizon line |

A colour always means its stage. `--rainbow` (the full spectrum) means "the whole flow" only: the header progress
line, a launch, the final CTA, the Studio plan ring. Spectrum ink (`.ink-spectrum`) on at most one word per view.
Colours appear as hairlines, 6–8 px dots, chip dots, chart strokes, soft radial glows at 10–18 % alpha, the conic ring
on hover. Never large flat fills, never small coloured text (blue fails contrast on black).

**Facts (fictional, use consistently).** Founded 2021 in Lisbon by Mira Castell (CEO, film editor), Jonah Feld (CTO,
engineer), Ama Boateng (Product, ceramicist). 64 people, 4 hubs (Lisbon, Toronto, Seoul, Nairobi), 19 countries.
38,000+ creators; 1.2M launches; 9.6 days median brief → launch; 71 % of reviews closed within a day; 120+ integrations;
99.97 % uptime over 12 months. Latest release v4.12 (20 Nov 2026). Today is late November 2026. Emails and URLs only on
`.example` (hello@crestora.example, api.crestora.example). Every stat block, the legal pages, security and the press
kit carry a quiet line: "Crestora is a fictional company; figures are illustrative." Integrations, partners and outlets
are invented names with self-drawn monogram icons — never a real logo or brand.

**Plans.** Solo: free (3 active lanes, 5 GB, Sparkboard & Blueprints, unlimited reviewers by link, 1 launch channel).
Studio: $12/mo, $10 billed yearly, "Most creators ride here" (unlimited lanes, 200 GB, Review Room on video & audio,
Countdown to 14 channels, Afterglow recaps, Share Pages on your domain). Crew: $20/seat/mo, $16 yearly, 2-seat minimum
(everything in Studio + shared lanes, Crew roles, client review portals, approvals with audit trail, 1 TB pooled,
priority support). Label: custom (SSO/SAML & SCIM, EU/US residency, 99.9 % SLA, success lead). The billing choice is
shared site-wide in `localStorage['crestora:billing']` = `monthly|yearly` (default yearly).

**Cuts (do not build).** The "Made in Crestora this week" marquee (its stat goes into #work). The left-gutter SVG
spine. Three hero chips (keep at most one). Traffic-light window dots on mocks. `data-tilt` on anything bigger than a
44 px box. The blurred glow on primary buttons. The fake collaborator cursor (the workspace mock has a scripted story
loop instead). Idle random pulses (at most one ambient animation per viewport, and none that runs off screen).
Password fields (sign-in is a magic link). `?app=` / `?f=` query deep links (use `#anchors`). Motorsport vocabulary
outside the footer (no pit wall, paddock, laps, chequered flags; "lane", "road", "ride", "launch" are fine). The
footer's own gags are not reused elsewhere (no km/h, no heart bursts outside the footer).

**WebGL.** The footer keeps its own scene, untouched. The home page gets **one** more WebGL2 canvas: `js/gl/lanes.js`
(hero threads + the #features flow ribbon). Sub-pages get no WebGL besides the footer (their heroes use the CSS
`.page-hero__lanes`). Every scene stops when off screen; DPR capped at 2.

**The finale.** The footer's intro plays once per page view, when it first comes into view (already built). The home
CTA (#start) can launch it: on submit it dispatches `window.dispatchEvent(new CustomEvent('crestora:launch'))`; the
footer glides into view and (if its intro has not played) plays it, or (if it has) replays the road's warp reveal and a
1.6 s boost. Built into `js/footer/index.js` by the lead; sections only dispatch the event.

**Later decisions (made in review; these win over anything below).**
- *Night Bloom* premiered at a rooftop screening in Yaba, Lagos, on Fri 30 Oct 2026, forty-one days after its spark
  (Sat 19 Sep); its day-7 recap was Fri 6 Nov and that lane is in Afterglow. Its **festival cut** (a new score by Tunde
  Bello) rides its own lane, Lane 014, from Sun 1 Nov: in Review now, launching online on Fri 11 Dec 2026. The home
  workspace mock and the home on-ramps show the festival cut.
- *Tidepool 1.1* (Theo ships on Fridays) is in Launch and launches Fri 4 Dec 2026; the "Launch day, live" webinar is
  that day at 17:00 UTC. Kiln & Co.'s spring drop is in Review. Webinars run on Thursdays, plus the odd launch-day special.
- Integrations whose names matched real products were renamed: Crosstalk (team chat), Postlark (newsletters),
  Stallfront (online store), Sketchloft (drawing).
- Anchors: `html { scroll-padding-top: var(--anchor-offset) }` is the one offset; a target's own `scroll-margin-top`
  adds to it only when a page wants a different landing. `core.js` mirrors the browser: `anchorOffset(el)`,
  `restingTop(el)` (ignores a reveal still in flight), `scrollToTarget(el | selector | y)` lands where a native
  #anchor would unless an offset is given, deep links land again as late layout settles (until the reader moves), and
  `landing(fn)` lets a module say where a link to its element lands (a pin's start, a card centred).

## 2. How the site is built

- **No build step for the site itself.** `crestora/tools/pages.mjs` assembles `src/pages/**/*.html` with the shared
  partials (`src/partials/head|header|footer|cta.html`) into `crestora/**/*.html`, and concatenates `src/css/*.css` (in
  filename order) into `css/site.css`. Run `node crestora/tools/pages.mjs` after every edit (from the repo root), then
  `node crestora/tools/links.mjs` (every href's file and #id must exist). The repo's dev server
  (`node build.mjs --serve 4321`, already running) rebuilds `dist/` when `crestora/` changes; view pages at
  `http://localhost:4321/crestora/<page>.html`.
- **Page source.** `src/pages/<name>.html` starts with
  ```
  <!--page
  title: Pricing — Crestora
  description: One sentence for search and link previews.
  modules: pricing filter forms
  nav: pricing.html
  -->
  <main id="main"> … </main>
  ```
  then the page's `<main id="main">`. Everything else (head, header, the pre-footer CTA, footer) is shared. Inside a
  page or partial: `{{ROOT}}` is the path to the site root ("" or "../" for blog posts) — prefix every local href and
  src with it; `{{> name}}` includes `src/partials/name.html` (e.g. `{{> cta}}` for the compact pre-footer CTA, or the
  home sections). `nav:` names the header item to mark current.
- **Ownership.** Each builder owns only the files named in its task: its `src/pages/*.html`, `src/partials/home/*.html`,
  its `src/css/NN-name.css` and its `js/modules/*.js`. **Never edit shared files** (`src/partials/head|header|footer|cta`,
  `src/css/00–10*.css`, `src/css/90-footer.css`, `js/core.js`, `js/main.js`, `js/footer/*`, `js/gl/*` unless it is
  yours, `tools/*`). If you need a shared change, put it in your report (`sharedRequests`) and work around it locally.
- **CSS.** Plain CSS, scoped under a class unique to your section/page (e.g. `.pricing-…`, `.work-…`); no bare element
  selectors at top level. Use the tokens in `00-tokens.css` and the kit in `03-components.css` before inventing.
- **JS.** ES modules in `js/modules/<name>.js`, each `export default function init({ calm, still }) {}`, listed in the
  page's `modules:` (they run in order). Import helpers from `../core.js` (gsap, ScrollTrigger, SplitText, lenis, calm,
  fine, $, $, whenVisible, scrollToTarget, lockScroll/unlockScroll, countTo, toast, odometer, store, and for anchors
  anchorOffset, restingTop and landing: see "Later decisions" in section 1) and generic
  modules can be listed per page. Everything must work without JS (content readable, forms submit somewhere sensible or
  are clearly demo) and under reduced motion (`.is-calm`, `calm` = true: no motion, final states shown).

## 3. The kit (already built; use it)

Tokens (`00-tokens.css`): `--ink #fff`, `--ink-soft rgb(220 228 237)`, `--ink-muted` (62 %), `--ink-faint` (decorative
only), `--bg #000`, `--bg-raised #07080c`, `--surface/-2/-3` (3.5/6/9 % white), `--line` (the footer's rule, 47 %),
`--line-soft` (12 %), `--line-faint` (7 %), `--box` (60 %, the footer's icon boxes), the spectrum `--blue --cyan --green
--amber --red --pink`, the stage tokens `--spark … --afterglow` (= the same six), `--rainbow`, `--font` (Inter),
`--font-brand` (Michroma), `--font-mono`, `--container 1440px`, `--gutter` (82 px at 1597 — every section's left edge
lines up with the footer's logo), `--section-y`, `--radius 9px` (boxes, buttons, inputs), `--radius-lg 16px` (panels,
mocks), `999px` (chips, pills, toasts), `--header-h 72px`, eases `--ease-out --ease-in-out --ease-spring`.

Classes (`03-components.css`): `.container`, `.container--narrow`, `.section`, `.section--tight`, `.hairline`;
type `.display` (hero H1 only), `.title-1` (page H1), `.title-2` (section H2), `.title-3` (card/stage titles),
`.title-4`, `.lede`, `.body-l`, `.body`, `.small`, `.mono`, `.ink-spectrum`, `.eyebrow`; `.section-head`
(+ `__aside`, `--center`); buttons `.btn` (+ `--primary --lg --sm --block`), `.btn-row`, `.link-arrow`; surfaces
`.panel`, `.panel--raised`, `[data-spotlight]`; `.chip` (+ `--live`: a white status dot, or its stage's with `data-stage`), `.dot` (`--c`), `.streak`, `.icon`, `.icon--lg`,
`.icon-box`; forms `.field __label __hint __error`, `.input` (input/select/textarea), `.check`, `.segmented`
(+ `__thumb`); `.page-hero` (+ `__inner`, `__lanes`), `.breadcrumb`; `.prose`, `.toc`, `.with-toc`; `.accordion`
(details/summary + `.accordion__body`); `.toast`; `.stage-rail` (`<div class="stage-rail" data-n="3"><i></i>×6</div>`: six dots on a hairline, the first n lit);
`.lane-chip` ("Now in: Review", uses `--stage`); `.odo` (odometer digits); `.mock` (an app window: `#07080c`, hairline,
16 px radius, a hairline top bar with a title — no traffic lights).

Michroma is display and numerals only: H1/H2, stage and plan names, prices, counters, stage indices "01–06", version
numbers. Headlines in Michroma stay ≤ 6 words (it is wide) and sentence case. Inter for everything human. Monospace
for code, IDs and file names.

Motion primitives (data attributes handled by `js/core.js`): `data-reveal[="up|fade|scale|left|right"]`,
`data-reveal-stagger` (children), `data-split` (heading lines rise from a mask), `data-count="1234"`
(+ `data-decimals data-prefix data-suffix`), `data-odometer="38000"` (Michroma digits roll up per digit; same
attributes), `data-marquee`, `data-magnetic`, `data-spotlight`, `data-roll` (rolling link text, the footer's links).
`toast('Copied')` shows the site's one toast (the footer's hint pill). `odometer(el, value)` rolls an element's digits
to a new value. `store.get/set(key, fallback)` wraps localStorage safely (keys prefixed `crestora:`).

Generic modules (`js/modules/`, list them in `modules:`): `filter` (chips + search filtering a list:
`[data-filter-list]` with items carrying `data-tags`; buttons `[data-filter="tag"]` with aria-pressed; an optional
`[data-filter-search]` input; an aria-live `[data-filter-count]` with `data-filter-noun`), `forms` (every
`form[data-form]`: inline validation with aria-invalid + `.field__error`, aria-busy on submit, then `toast(form.dataset.success)`
and reset; `data-demo` forms never send anything), `copy` (`[data-copy="text"]` buttons copy and toast), `tabs`
(`[role=tablist]` with `[role=tab][aria-controls]`, arrow keys, optional `data-tabs-store` key), `toc` (a `.toc` of
links to `.prose` headings gets scrollspy via aria-current; `[data-copy-link]` on headings), `countdown`
(`[data-countdown="2026-12-04T17:00:00Z"]` fills `[data-unit=d|h|m|s]` children with odometer digits), `ics`
(`[data-ics]` buttons download a calendar file from `data-title data-start data-end data-location`), `dialog`
(`[data-dialog-open="id"]` opens `<dialog id>`; Escape/backdrop closes), `billing` (the shared Monthly/Yearly
`.segmented[data-billing]`; prices in `[data-price-monthly][data-price-yearly]` roll).

## 4. Link map (every footer link is real)

Product: Features → `index.html#features` · Integrations → `integrations.html` · Pricing → `pricing.html` · Changelog →
`changelog.html` · Roadmap → `roadmap.html` · Security → `security.html`. Company: About Us → `about.html` · Careers →
`careers.html` · Press Kit → `press.html` · Partners → `partners.html` · Contact → `contact.html`. Resources: Blogs →
`blog.html` (Field Notes; posts in `blog/*.html`) · Documentation → `docs.html` · API Reference → `api.html` · Help
Center → `help.html` · Community → `community.html` · Tutorials → `tutorials.html` · Webinars → `webinars.html`.
Legal: Privacy Policy → `privacy.html` · Terms of Service → `terms.html` · Cookie Policy → `cookies.html` · Compliance →
`compliance.html` · Sitemap → `sitemap.html`. Social boxes → `community.html#elsewhere`. "Open a lane" → `start.html`;
"Sign in" → `start.html#signin`. Home anchors: `#top #creators #features #workspace #integrations #work #plans #start`.
Integration deep links: `integrations.html#<app-slug>`. Changelog entries: `changelog.html#v4-12`. Help answers:
`help.html#<slug>`. Docs sections: `docs.html#<slug>`. Contact topics: `contact.html?topic=sales|support|press|partners|careers|legal|grants`
(+ `&role=<slug>` for careers; read by the contact page, harmless without JS).

## 5. Home page (order: #top, #creators, #features, #workspace, #integrations, #work, #plans, #start, then the footer)

Overrides for this section: no marquee section; the hero has at most one chip riding a thread; the creators row stacks
under 1100 px; the workspace mock is drawn at fixed design px (1200 × 720) and scaled to fit (like the footer's --fu),
with a scripted story loop (a card waits in Review → toast "Lena approved frame 118" → its chip turns green → it moves
to Launch → back) instead of a cursor, paused off screen, static under reduced motion; the integrations diagram has no
idle pulse and its boxes link to `integrations.html#<slug>`; the work wall has no `?f=` (chips only); #start does not
reuse the footer's km/h hint or heart burst, it dispatches `crestora:launch` and shows a toast.

### #top — Hero: Every idea gets a lane

**Copy.** Eyebrow: "For creators, builders & dreamers". H1 (.display, 2 lines): "Every idea / gets a lane." with "lane" in spectrum ink. Lede: "Crestora carries your work from first spark to launch day: the brief, the files, the feedback and the release, flowing in one place instead of fifteen tabs." Buttons: [Open your first lane] (primary, start.html) and [Watch a launch, start to finish ↓] (to #features). Fine print: "Free for 3 lanes · No card · Export everything, always." Scroll cue at the bottom: a small vertical hairline with a running dash and the label "Follow the flow".

**Content.** Full viewport (100svh, min 720px). Text sits left in the container. Behind it, the WebGL "loose threads" canvas fills the screen over the star field (the same star shader as the footer, at a lower density). Six threads, one per stage colour, wave across the right 60%, each a few lanes wide with sparks along it. Three glass work chips (.panel--raised, 14px, with stage dot and stage rail) ride the threads: "Night Bloom · voice memo" (Spark, blue), "Tidepool 1.1 · build 214 passing" (Make, green) and "Kiln & Co. spring drop · 4 notes" (Review, amber). The no-WebGL and no-JS fallback is a lightweight SVG poster of the same threads.

**Interaction.** Intro (about 2.2s; shorter on a repeat visit through the existing is-repeat class): the stars fade up, the threads draw in from the left, the H1 lines rise out of a mask (SplitText through data-split), then the lede and buttons follow and the chips pop in one by one onto their threads. The pointer lamp brightens the threads near it and gently parts them. The chips drift along their lanes with slight pointer parallax and are data-tilt cards. Scrolling through the hero tightens the threads (uWave falls to 0) and pinches them into one thread at bottom-left, which becomes the spine's first lane. The scene pauses when off screen and the canvas initialises after first paint, so the LCP is the H1 text.

### #creators — Creators, builders and dreamers

**Copy.** Eyebrow: "The people in the tagline". H2: "Creators, builders and dreamers." Lede: "Thousands of them already ride with Crestora. Three let us follow one project from the first note to launch night." Three cards. CREATOR: Amara Okafor, animator, Lagos. Night Bloom, a seven-minute animated short. "I used to lose the thread between storyboard and render. In Crestora the thread is the whole point." Facts: 41 days from spark to premiere · 214 frames reviewed · 3 collaborators on 2 continents. Chip: Now in: Afterglow (pink). BUILDER: Theo Lindqvist, indie developer, Malmö. Tidepool, a tide-and-swell app. "Spec, tickets, beta notes and the launch post sit in one lane. I ship on Fridays now, on purpose." Facts: build 214 · 1,900 beta testers · ships Fri 09:00. Chip: Now in: Launch (red). DREAMER: Inés Navarro, potter and first-time founder, Valencia. Kiln & Co. spring drop, 60 hand-thrown pieces in one online sale. "I'm not a project manager. Crestora never asked me to become one." Facts: 60 pieces · 4 notes from her sister · last drop sold out in 3 hours. Chip: Now in: Review (amber). Each card has a link: "Read the launch story →" (to its Field Notes post).

**Content.** A three-column row of tall .panel cards. Each has a night-poster art panel on top drawn in SVG from lane lines in the person's stage colour: a flower of spectrum lines (Night Bloom), concentric swell lines (Tidepool), a pot turned from stacked lines (Kiln). Below the art: an initials avatar with a conic ring, the name, role and city, the quote in Inter 22px, three lane facts, a stage rail showing where the project is now, and the story link. A soft radial glow in the stage colour sits behind each card at 12%.

**Interaction.** On desktop the row is an expanding accordion. Hovering or focusing a card (focus-within, so the keyboard works) grows it from 1fr to 1.8fr with a 0.6s ease-out, the others narrow to art plus name, and the expanded card's poster animates: the flower blooms (stroke draw), the swell lines roll, the pot's lines slide as if turning. The stage rail fills to the current stage. With motion allowed, Amara's card starts expanded. On mobile it becomes a horizontal scroll-snap carousel with three hairline dots. Without JS, all three cards show fully expanded and stacked. Reduced motion: posters are static and the widths do not animate.

### #features — The flow: six lanes from first spark to launch night

**Copy.** Eyebrow: "How it flows". H2: "Six lanes from first spark to launch night." Lede: "Every project in Crestora rides one lane. As it moves, the right tools light up, and nothing gets left at the last stop." STAGES (number · stage · feature · headline · body · bullets): 01 Spark · Sparkboard · "Catch it before it fades." "Voice memos, screenshots, links and 2 a.m. sketches land on one board. Crestora groups them into constellations, so the good ones find each other." Capture from phone, browser or email / Auto-grouped constellations / Promote any spark to a lane. 02 Shape · Blueprints · "Give it a shape you can share." "Turn a spark into a one-page plan: what it is, who's riding along, what done looks like and when the lights go green." 40 templates by working creators / Milestones that know your calendar / Share a brief with one link. 03 Make · Workbench · "Make it without losing the thread." "Drop in a render, a build or a mix. Crestora keeps every version on the lane and tells you what changed." Unlimited version history / Side-by-side compare / 120+ tools connected. 04 Review · Review Room · "Feedback that doesn't stall the engine." "Pin a note to a frame, a pixel, a second of audio or a line of code. Reviewers need a link, not an account." Frame- and pixel-accurate notes / Review links without sign-up / One-click approvals, on the record. 05 Launch · Countdown · "Ship on the day you said." "A launch checklist built from your plan, a schedule for every channel and a launch room where the crew watches it go live together." Checklists that fill themselves / Schedule to 14 channels / A live launch room with a countdown. 06 Afterglow · Afterglow · "See how it landed. Start the next one." "Views, sales, replies and reviews from every channel in one recap on day 1, 7 and 30. The ideas it sparked go straight back to your board." Day 1 / 7 / 30 recaps / Every channel in one view / Next ideas back to the Sparkboard.

**Content.** Desktop with motion: a pinned stage of about 420vh. The flow ribbon canvas fills the lower 60% of the stage: six bands of 24 lanes in stage order from top to bottom (the footer ribbon's cross-section). It enters from the left at mid-height where the spine's thread turns horizontal, rises gently to the right like the footer's upper band, and narrows toward the right edge as a hint of the pinch under the car. At the top left: the stage panel (index in Michroma, stage icon in a 44px box, feature name, headline in .title-3, body, three bullets). At the top right: the stage rail, six labelled buttons "01 Spark" to "06 Afterglow" on a hairline. On the ribbon: the ride-along Night Bloom card (320px .panel--raised) in six states: a 3×2 moodboard of tiles; a brief with three milestones; a render progress bar at v7 with three version thumbnails; a frame with three comment pins and "Approved by Lena K."; a countdown 00:00:03 that flips to a "Live" chip; a recap reading 12.4k views, 318 comments and a sparkline in pink. Mobile, reduced motion and no-JS: a vertical list of six stage blocks, each with its colour streak, icon, copy and the card's static state; no canvas.

**Interaction.** ScrollTrigger pins the stage, and progress p from 0 to 1 drives everything. uBands = p×6 lights band by band with the footer's bright reveal front. The card is positioned on the ribbon's centreline at u = p (sampled from the same guides in JS) and crossfades its inner state at each stage boundary. The stage panel's text swaps with a short masked rise. The spine in the gutter gains the matching lane. Dash speed = cruise + |Lenis velocity|. The pointer lamp works on the ribbon. The rail buttons are a role=tablist: click or Enter scrolls to that stage's position (lenis.scrollTo), arrow keys move between them, and aria-selected follows progress. Deep links to #features land at the start of the pin. Under 1024px the section isn't pinned and the stacked blocks reveal with data-reveal-stagger.

### #workspace — Inside a lane: the product

**Copy.** Eyebrow: "Inside a lane". H2: "Your whole project on one road." Lede: "See every piece of work where it actually is, not buried in a folder, a thread or somebody's head." Three small features under the mock, each with an icon box: "Crew roles": Owner, Maker, Reviewer and Guest, so everyone sees what they need. "Share Pages": a public launch page on your own domain, live the moment you are. "Works offline on iOS": capture on the train; it syncs when you surface.

**Content.** A large HTML/CSS app-window mock on #07080c, not an image. Sidebar: the lanes Night Bloom (the festival cut, Lane 014), Tidepool 1.1 (in Launch), Kiln spring drop and Small Hours ep. 49, each with a stage dot. The main area has a segmented control [Lane | Board | Calendar]. LANE view: a horizontal six-segment stage track with work items as chips on their segments (storyboard_v3.pdf, render_v7.mov, frame 118 note, "Festival upload", "Press kit"). BOARD view: six narrow columns with cards. CALENDAR view: two weeks with milestones and a red-flagged launch day, "Fri 11 Dec" (the festival cut's online launch). Right rail: an activity feed ("Lena approved frame 118", "Theo pushed build 215", "Countdown: 2 days to launch") and avatars. (No collaborator cursor: cut, see section 1.)

**Interaction.** The segmented control is a real tablist (aria-controls) and switches views with a 0.4s crossfade and a slight lift; items keep their stage colour across views so the eye can follow them. Hovering an item shows a tooltip (file, version, who, when). The whole window uses data-tilt at 2° and data-spotlight. Lena's cursor follows a CSS motion path and pauses to drop a comment pin that pops; it is hidden under reduced motion. The mock is aria-hidden=false with sensible labels, and under 700px it becomes a horizontally scrollable window with a fade edge.

### #integrations — On-ramps: integrations

**Copy.** Eyebrow: "Integrations". H2: "Bring your tools along for the ride." Lede: "Crestora connects to the apps you already make with. Their work merges into your lane: renders, builds, mixes and orders arrive as versions and stats, not as another inbox." Link: "Browse all 120+ integrations →" (integrations.html). Caption line, live: "Framewright → Make lane · renders land as versions."

**Content.** An SVG on-ramp diagram. Twelve 44px icon boxes (self-drawn monograms) sit in two staggered rows on the left: Moodwell (moodboards, Spark), Inkwell (writing, Shape), Dayplan (calendar, Shape), Framewright (video editing, Make), Pixelmill (design, Make), Tapedeck (audio, Make), Gitloom (code, Make), Crosstalk (team chat, Review), Postlark (newsletters, Launch), Stallfront (online store, Launch), Clipdeck (social scheduling, Launch), Pulse (analytics, Afterglow). From each, a hairline on-ramp curves into a horizontal six-lane strip on the right, joining the lane of its stage. Mobile: a 3- or 4-column icon grid with captions under each.

**Interaction.** The icon boxes are links to integrations.html?app=<name> with data-magnetic, as the footer's social boxes are. On hover or focus, the icon's on-ramp lights in its stage colour, a white dash runs along it into the strip (stroke-dashoffset, 0.9s), the target lane glows, the box gets the conic spectrum ring and the caption updates (aria-live=polite). Idle state: one random ramp lights every 2.4s while the section is visible (paused when off screen or under reduced motion).

### #work — Made in Crestora: the wall and the mileage

**Copy.** Eyebrow: "Made in Crestora". H2: "The work is the point." Lede: "A few of the 1.2 million things launched from a Crestora lane." Mileage counters in Michroma: "38,000+" creators on the road · "1.2M" launches shipped · "9.6 days" median from brief to launch · "71%" of reviews closed within a day. Filters: All · Film · Apps · Music & audio · Writing · Objects. Result line (aria-live): "Showing 3 film projects."

**Content.** Twelve tiles in a CSS grid with mixed spans (two of them 2×2). Each tile has a night-poster artwork in the project's lane colours, the title, the maker and city, "Spark → launch in N days" and a mini six-lane bar. The tiles: Night Bloom (film, Amara Okafor, Lagos, 41 days); Northbound (film, docuseries, Ji-woo Han, Seoul, 63 days); Tidepool 1.0 (app, Theo Lindqvist, Malmö, 34 days); Orbit UI Kit (app, open source, Sam Adeyemi, Toronto, 12 days); Moth & Lamp (app, game demo, Rosa Vidal, Bogotá, 58 days); Saltwater EP (music, Kai Moana, Auckland, 27 days); Small Hours ep. 48 (audio, podcast, Lena Kowalski, Kraków, 3 days); Field Notes Vol. 4 (writing, zine, Priya Nair, Pune, 19 days); Paper Lanterns (writing, picture book, Mei Chen, Taipei, 88 days); Kiln & Co. spring drop (objects, Inés Navarro, Valencia, 22 days); Gridlock (objects, type family, Ola Berg, Oslo, 74 days); Long Table (objects/events, supper club, Tomás Ruiz, Lisbon, 9 days).

**Interaction.** Counters roll up like odometer digits when seen (data-count with a Michroma digit-roll variant). Filter chips are aria-pressed buttons; filtering does a manual FLIP: measure the rects, toggle hidden, then GSAP the transforms back over 0.6s, with leaving tiles fading out. The filter is also read from ?f= so marquee links can deep link. On tile hover the art shifts toward the pointer (parallax at 6px) and a conic spectrum ring lights the border. Tiles with a Field Notes story (Night Bloom, Tidepool, Kiln) link to it; the others are not links and expose their details on focus. Without JS all tiles show.

### #plans — Plans (pricing teaser)

**Copy.** Eyebrow: "Pricing". H2: "Free until it isn't. Fair after that." Three cards: SOLO, Free: 3 active lanes · 5 GB · Sparkboard & Blueprints · unlimited reviewers by link. STUDIO, $12/mo ($10 billed yearly), badge "Most creators ride here": unlimited lanes · 200 GB · Review Room for video & audio · Countdown & Afterglow. CREW, $20/seat/mo ($16 yearly): shared lanes & roles · client review portals · 1 TB pooled · priority support. Below: "Reviewers and guests are always free." · "Compare every plan →" (pricing.html) · "Students and first-time founders: Studio free for a year →" (pricing.html#grants).

**Content.** Three .panel cards. Each has a stage rail as an accent: Solo lights 2 lanes, Studio 6 and Crew 6 with a double hairline. The plan name is in .title-3 Michroma and the price in 56px Michroma digits. A Monthly/Yearly .segmented control sits above, the same component as on pricing.html. Studio is .panel--raised with a spectrum top hairline.

**Interaction.** The toggle moves the segmented thumb and rolls the price digits (odometer roll, 0.5s), and the choice is remembered in localStorage so pricing.html opens in the same mode. Cards use data-spotlight. The CTA in each card goes to start.html?plan=solo|studio|crew.

### #start — Your lane is open: the launch into the footer

**Copy.** Eyebrow: "Your turn". H2 (.display): "Your lane is open." with "open" in spectrum ink. Sub: "Bring one idea. Crestora brings the road." Field 1 label: "What are you making?". Its placeholder cycles through "a short film…", "an app…", "a pottery drop…", "your first podcast…", "a zine…". Field 2: "Email". Button: [Hit the green light]. Fine print: "Free for 3 lanes · No card · Export everything, always." Success toast: "Your lane is open. Check your inbox. (Demo: nothing was sent.)"

**Content.** A centred, tall section (about 90vh) on the darkest black, with the stars thinning. To the right of (or under, on mobile) the form sits a live "Lane 001" card: the stage rail at Spark, the title from field 1 (default "Your next thing"), "Started today" and the visitor's initials avatar once an email is typed. In the gutter, the spine's six lanes curve right and down under the form and leave at the bottom-left, where the footer road enters. A low arc of CSS lanes glows at the bottom edge, so the footer feels already lit before it arrives.

**Interaction.** The card updates live as the visitor types. Submit runs inline validation (aria-invalid and messages). On success: the stage rail fills 1→6 in 0.8s, the card shrinks and slides down the spine, lenis.scrollTo('#footer') glides the page, and window.dispatchEvent(new CustomEvent('crestora:launch')) is fired. The footer then replays its warp reveal from under the car plus a 1.6s boost, the hint reads "Launched · 248 km/h", a heart burst rises, and the toast appears. Under reduced motion: no scroll and no warp, only the toast and the filled rail. Without JS the form submits by GET to start.html?idea=…&email=…, which shows the welcome state. The header hides while this section and the footer are on screen.

## 6. Pages

Overrides: Review Room, not Pit Stop. start.html: magic-link sign-in only (email + "Email me a link"), no password.
Integration deep links are `#slug` anchors (each directory card has an id). No 404 page.

### integrations.html — Integrations

**Content.** Hero: eyebrow "Integrations", H1 "Bring your tools along for the ride.", lede "120+ apps merge into your lane. Their work arrives as versions, notes and stats, not one more inbox." A toolbar holds a search field and lane chips: All, Spark, Shape, Make, Review, Launch, Afterglow, Files & storage, Team. A featured row has three large cards (Framewright, Gitloom, Stallfront), each with a mini on-ramp diagram of what flows in ("renders → versions", "builds & PRs → versions + review", "orders → Afterglow"). The directory holds 24 cards; each has a monogram icon box, name, category, one line, lane chip, and an optional "Popular" or "New" badge. SPARK: Moodwell (moodboards), Snapjar (screenshots & clips), Murmur (voice memos). SHAPE: Inkwell (writing), Dayplan (calendar), Ledgerly (budgets & invoices). MAKE: Framewright (video editing), Pixelmill (design), Tapedeck (audio), Gitloom (code), Sketchloft (drawing), Cloudshelf (storage). REVIEW: Crosstalk (team chat), Redline (PDF proofing), Captionist (captions). LAUNCH: Postlark (newsletters), Stallfront (online store), Clipdeck (social scheduling), Onair (live streams), Shipyard (app-store builds). AFTERGLOW: Pulse (analytics), Tipjar (supporters), Starboard (ratings & reviews), Formfold (surveys). Then a section "How connecting works" in three steps (pick a lane, connect in 30 seconds, work flows in). A band "Build your own" links to api.html and partners.html. A "Request an integration" form takes app name, what it should send, and email.

**Interaction.** Live search plus chip filtering, combinable, with an aria-live count ("14 integrations") and an empty state that pre-fills the request form with the search term. ?lane=make and ?app=framewright preselect a filter or open that app's dialog. Clicking a card opens a native <dialog> with what flows in, the permissions requested, and a [Connect] button that shows the toast "Demo: connecting is off here." On card hover the top hairline lights in the lane colour with a running dash, and icon boxes are magnetic. The request form validates and shows a toast.

### pricing.html — Pricing

**Content.** Hero: H1 "Free until it isn't. Fair after that.", lede "Start with three lanes for free. Pay when your work outgrows them, and never for the people who only leave feedback." A Monthly/Yearly toggle with the note "2 months free". FOUR PLANS. SOLO, Free: 3 active lanes, 5 GB, Sparkboard & Blueprints, review links for unlimited guests, 1 launch channel. STUDIO, $12/mo or $10 yearly, "Most creators ride here": unlimited lanes, 200 GB, Review Room on video & audio, Countdown to 14 channels, Afterglow recaps, Share Pages on your domain. CREW, $20/seat/mo or $16 yearly, 2-seat minimum: everything in Studio plus shared lanes, Crew roles, client review portals with your logo, approvals with audit trail, 1 TB pooled, priority support. LABEL, custom, for studios, labels and agencies: SSO/SAML & SCIM, EU/US data residency, 99.9% SLA, dedicated success lead; links to contact.html?topic=sales. Then a full comparison table with rows grouped by the six stages plus "Crew & admin", "Security" and "Support". A Creator grants section (#grants): Studio free for a year for students, educators and first-time founders, three requirements and an apply link to contact.html?topic=grants. A FAQ accordion of 8 questions: Can I cancel anytime? What counts as an active lane? Do reviewers pay? What happens to my files if I downgrade? Refunds? Paying in my currency? Nonprofit discount? Who owns my work? Finally the pre-footer CTA.

**Interaction.** The billing toggle rolls the price digits and is shared through localStorage with the home teaser. The Crew card has a seat slider (2-50, input type=range with live output) that computes the monthly total. The comparison table has a sticky header row of plan names, a column highlight that follows the pointer or focus, and stage group rows marked by a dot in the stage colour. On mobile the table becomes a per-plan accordion. FAQ items are <details>, and #grants deep links land correctly.

### changelog.html — Changelog

**Content.** Hero: H1 "What's new on the road.", lede "A release every two weeks, give or take a review stop." An email subscribe form. Eight entries, each with version, date, title, a paragraph, New/Improved/Fixed tags and a stage colour: v4.12, 20 Nov 2026: "Review Room hears you" (waveform comments on audio, Review). v4.11, 6 Nov: "Afterglow recaps on day 1, 7 and 30" (Afterglow). v4.10, 23 Oct: "Lanes can merge" (Make). v4.9, 9 Oct: "Countdown launch rooms" (Launch). v4.8, 25 Sep: "Sparkboard works offline on iOS" (Spark). v4.7, 11 Sep: "40 Blueprint templates from working creators" (Shape). v4.6, 28 Aug: "Lanes open 2.3× faster" (Make). v4.5, 14 Aug: "Review links without accounts" (Review). Each entry also has 2-4 smaller Fixed items and a small HTML mock or poster where it helps.

**Interaction.** The page is a vertical lane timeline. A hairline rail on the left fills with the spectrum as you scroll (scrubbed), and each version node lights in its stage colour as it reaches the middle of the screen. Filter chips: All / New / Improved / Fixed. Every entry is an anchor (#v4-12) with a copy-link button and a toast. The subscribe form validates and shows a toast. The header's Changelog dropdown chip links to the latest entry.

### roadmap.html — Roadmap

**Content.** Hero: H1 "Where the road goes next.", lede "What we're building now, next and later, shaped by the people who ride with us. Vote for what matters to you." Three lane columns. NOW: Review Room for 3D files; Shared Sparkboards; Android app (beta). NEXT (H1 2027): Lane automations ("when a version is approved, move to Launch"); Share Pages in 12 languages; Budgets in Blueprints. LATER: Crestora for classrooms; Bring-your-own storage; Desktop offline mode. Each card has a title, a short "why", a stage chip, a vote count and a status. A "Recently shipped" strip links to changelog entries. A "Suggest something" form.

**Interaction.** Upvote buttons use aria-pressed; the count increments with a small digit roll, and the per-viewer vote is kept in localStorage. Sort by Most votes / Newest, and filter by stage chip. On mobile the columns become a horizontal scroll-snap with column tabs. The suggestion form validates and shows a toast.

### security.html — Security

**Content.** Hero: H1 "Security without speed bumps.", lede "Your unreleased work is the most valuable thing you own. Here's how we keep it that way." A fact band in Michroma numerals: AES-256 at rest · TLS 1.3 in transit · 99.97% uptime over 12 months · 24/7 on-call. A .with-toc layout with these sections: Your work stays yours (never used to train models; export any time); Data protection (encryption, backups every 6 h kept 30 days in a second region, per-lane keys on Label); Access (2FA, passkeys, SSO/SAML, roles, expiring and password-protected review links, watermarked review copies); Infrastructure (EU & US regions, isolated environments, least privilege); Application security (code review, dependency scanning, an annual independent penetration test); Incident response; Responsible disclosure (security@crestora.example, bounty up to $5,000, safe harbour); Status (#status). Links go to compliance.html and privacy.html. A note says Crestora is fictional.

**Interaction.** A TOC with scrollspy. #status has a live chip "All systems normal" and a 90-day uptime bar of 90 hairline ticks with a hover or focus tooltip per day (deterministic fictional data). A copy button for the security email shows a toast.

### about.html — About Us

**Content.** Hero: H1 "We build roads for people who make things." Story: in 2021 in Lisbon, a film editor (Mira Castell, CEO), an engineer (Jonah Feld, CTO) and a ceramicist (Ama Boateng, Product) kept losing projects between tools. Their first lane was Mira's documentary. Mission line: "Make the distance between an idea and its audience as short as a night drive." Four values: Makers first · Clear roads · Ship, then shine · Leave the light on (be kind, especially at 2 a.m.). A timeline: 2021 founded → 2022 public beta, 1,000 creators → 2023 Review Room → 2024 Countdown, 10,000 creators → 2025 Afterglow and iOS → 2026 38,000 creators and four hubs. Numbers: 64 people · 4 hubs (Lisbon, Toronto, Seoul, Nairobi) · 19 countries · 38,000+ creators. A team grid of 12 initials avatars with roles and a "currently making" side project ("a sourdough zine", "a synth"). CTAs link to careers.html and press.html.

**Interaction.** On desktop the timeline is a horizontal six-colour ribbon scrubbed by scroll, with milestones lighting as you reach them; on mobile it is a vertical list. Counters roll. Hovering or focusing a team avatar flips its card to show what that person is making, and its ring lights in their stage colour. Values reveal with a stagger.

### careers.html — Careers

**Content.** Hero: H1 "Come build the road.", lede "We're 64 people across four hubs, making tools for people who make things. Most of us make things too." How we work: remote-first, four hubs, 4 core overlap hours, Maker Fridays (one Friday a month for your own project). Perks: published pay bands · $1,500 yearly creative budget · 30 days off plus local holidays · home studio stipend · 20 weeks parental leave. Eight open roles: Senior Graphics Engineer, WebGL (Engineering, Remote EU, €84-104k) · Product Designer, Review (Design, Lisbon/Remote) · iOS Engineer (Engineering, Toronto/Remote) · Staff Backend Engineer, Sync (Engineering, Remote) · Community Lead, LATAM (Community, Remote) · Support Specialist, Korean & English (Support, Seoul) · Tutorial Producer (Content, Nairobi/Remote) · Security Engineer (Engineering, Remote). Hiring process in four steps drawn as lanes: Chat → Craft conversation → Paid trial day → Meet the crew. "We reply to every application within 10 days."

**Interaction.** Filter by team (chips) and location (select), with an aria-live count. Each role is a <details> row that expands to what you'll do, what you bring and the band. [Apply] links to contact.html?topic=careers&role=<slug>. The process lanes light on scroll.

### press.html — Press Kit

**Content.** Hero: H1 "Press kit.", lede "Words, marks, colours, faces and facts: everything you need to write about Crestora." Boilerplates: a short one (50 words) and a long one (120 words). Fast facts: founded 2021 in Lisbon, 64 people, 38,000+ creators, 1.2M launches, four hubs. Logo: the chrome C mark and the Michroma wordmark lockups on black and white, plus three don'ts (don't recolour the C, don't stretch it, don't set it on busy images). Colour: the six stage swatches plus black and white, with hex and RGB and the stage each one means. Type: Michroma and Inter specimens. Product screens: three HTML mocks. Founder bios. Recent coverage from fictional outlets (The Maker Weekly, Frame & Pixel, Indie Signal) with headlines. Press contact: press@crestora.example.

**Interaction.** Copy buttons on boilerplates and swatches show a toast ("#ff7ad9 copied"). Logo downloads are SVGs generated client-side through a Blob (mark, wordmark, lockup, in light and dark). A type tester lets you type a line and see it in Michroma. Swatches glow in their colour on hover.

### partners.html — Partners

**Content.** Hero: H1 "Partners who ride along.", lede "Studios, toolmakers and teachers who help creators get further." Three programs: Integration partners (API sandbox, directory listing, co-marketing) · Studio partners (certified agencies that set Crestora up for teams; 20% referral share for the first year) · Education partners (Studio free for classes, a curriculum kit). A tier ladder drawn as a lane: Registered → Certified → Premier, with benefits per tier. A directory of 8 fictional partners: Northlight Studio (Toronto, film post) · Paper Moon Collective (Lisbon, illustration) · Fieldwork Digital (Nairobi, apps) · Quiet Hours Audio (Seoul, podcasts) · Lanternfish (Berlin, games) · Common Thread (Mexico City, merch) · Brightwater School of Design (education) · Atlas & Ink (Melbourne, publishing). An apply form.

**Interaction.** The directory filters by program and region. Hovering or focusing a tier lights its segment and reveals its benefits. The apply form has program, company, website, email and message, validates inline and shows a toast.

### contact.html — Contact

**Content.** Hero: H1 "Talk to a human.", lede "Real people in four time zones. Replies within a working day." Topic cards, each with an email and typical reply time: Sales (Crew & Label) · Support · Press · Partnerships · Careers · Legal & privacy · Creator grants. The form has topic, name, email, company and team size (Sales/Partners only), role (Careers only), message and a consent checkbox. Four hubs with fictional street addresses and live local times: Lisbon, Toronto, Seoul, Nairobi.

**Interaction.** ?topic= and ?role= preselect the topic and role, and the fields change with the topic (hidden fields carry the hidden attribute so they are not focusable). Inline validation uses aria-invalid and messages. Submit sets aria-busy, then shows the toast "Thanks. A human will reply by tomorrow. (Demo: nothing was sent.)" Hub clocks use Intl, update every minute and show an "Open now" or "Closed" chip.

### blog.html (+ blog/*.html posts) — Blogs

**Content.** The blog is called Field Notes. H1 "Field notes from the road.", lede "Launch stories, craft notes and what we're building, written by creators and the Crestora crew." A featured post plus a grid of six, all of them real pages in blog/: forty-one-days-to-night-bloom.html (Launch stories, Amara) · why-theo-ships-on-fridays.html (Launch stories) · sixty-pots-in-three-hours.html (Launch stories, Inés) · designing-pit-stop.html (Product: "Feedback that doesn't stall the engine") · the-case-for-a-smaller-launch.html (Craft) · leave-the-light-on.html (Company: notes on working at 2 a.m.). A newsletter signup: "One email a fortnight." Post template: a night-poster cover in the post's stage colour, author avatar, date, reading time, 600-900 words of .prose with a pull quote, a "Lane recap" aside showing the project's six stages with dates, copy link, and next/previous posts.

**Interaction.** Category chips filter the grid (All / Launch stories / Craft / Product / Company). Card covers shift with the pointer. The newsletter form shows a toast. Posts use the header's rainbow progress line as a reading bar, and the lane recap fills its stages as the reader scrolls through the post.

### docs.html — Documentation

**Content.** H1 "Documentation.", lede "Everything about lanes, stages and the tools inside them." A three-part layout: sidebar nav, .prose content (one long page of anchored sections), and a right TOC. Sections: Getting started (your first lane in four steps) · Lanes (stages, moving, merging) · Sparkboard (capture shortcuts, constellations) · Blueprints (templates, milestones) · Workbench (versions, compare, supported files) · Review Room (note types, review links, approvals) · Countdown (checklists, channels, launch rooms) · Afterglow (recaps, metric definitions) · Crew & roles (a permissions table for Owner, Maker, Reviewer and Guest) · Integrations (connecting, permissions) · Keyboard shortcuts (a <kbd> table) · Import & export.

**Interaction.** The sidebar search filters headings live. TOC scrollspy. Copy-link buttons on headings. A "Was this helpful?" Yes/No under each section shows a toast. On mobile the sidebar collapses into a <details> labelled "Browse docs".

### api.html — API Reference

**Content.** H1 "API reference.", lede "A small REST API for lanes, versions, reviews and launches. JSON in, JSON out." Base URL https://api.crestora.example/v2. Sections: Authentication (Bearer tokens, scopes) · Rate limits (600 requests per minute) · Errors (a table of codes) · Pagination (cursor) · Lanes (GET /lanes, POST /lanes, GET /lanes/{id}, PATCH /lanes/{id} to move a stage) · Sparks (POST /sparks) · Versions (POST /lanes/{id}/versions) · Comments (GET and POST /versions/{id}/comments) · Launches (POST /lanes/{id}/launches) · Webhooks (lane.stage_changed, version.approved, launch.live, recap.ready, and signature verification). Each endpoint has a parameter table and a request and response sample.

**Interaction.** Three columns: endpoint nav, descriptions, and a sticky dark code panel. Language tabs (curl / JavaScript / Python) stay in sync across every block and are remembered in localStorage. Copy buttons. Method badges are coloured by stage (GET cyan, POST green, PATCH amber, DELETE red). Endpoint scrollspy. On mobile the code stacks under each description.

### help.html — Help Center

**Content.** H1 "How can we help?" with a large search field. Eight category cards: Getting started · Account & billing · Lanes & stages · Review & feedback · Launching · Integrations · Crews & roles · Troubleshooting. Each category has a section further down with 3-4 questions answered inline in <details>, around 30 answers in all. Six popular questions. A status chip "All systems normal" links to security.html#status. "Still stuck?" links to contact.html?topic=support (with a reply-time chip) and to "Ask the community" (community.html).

**Interaction.** Instant search runs over the answers on the page, with highlighted matches and a results listbox you can use with the arrow keys and Enter. Choosing a result scrolls to its answer and opens its <details>. Category cards jump to their sections.

### community.html — Community

**Content.** H1 "The crew is bigger than us.", lede "Thousands of creators, builders and dreamers trading notes, feedback and launch-night nerves." Spaces: Forum categories with fictional counts (Show your lane 12.4k posts, Feedback swaps, Launch stories, Templates, Help) · Creator Circles, local meetups in 30 cities with eight upcoming ones listed · Launch Night, a monthly live showcase, with the next date · Creator of the Month (Amara Okafor) · Feedback swaps (get paired for reviews). A code of conduct in four points. "Crestora elsewhere" (#elsewhere) explains the four social channels and what is posted on each; the footer's X, Instagram, LinkedIn and YouTube boxes link here. A join CTA.

**Interaction.** Event times are converted to the visitor's time zone. "Add to calendar" downloads a client-generated .ics file. The Launch Night countdown uses Michroma digits. The join form shows a toast. Forum category cards use data-spotlight.

### tutorials.html — Tutorials

**Content.** H1 "Learn the road.", lede "Short, practical lessons from people who ship." Three learning paths, one per persona: Creators: "From storyboard to screening" (5 lessons, 48 min) · Builders: "Spec to store" (6 lessons, 55 min) · Dreamers: "Your first launch, start to finish" (4 lessons, 35 min). A library of 12 cards, each with duration, level, stage colour and format: Your first lane in 10 minutes · Capture everything with Sparkboard · Write a one-page Blueprint · Versions and compare · Running a review with clients · Frame-accurate notes on video · Approvals that stick · Plan a launch checklist · Launch rooms · Reading your Afterglow · Crew roles explained · Connect your tools. A featured lesson shows a video-poster mock, chapters and a transcript excerpt.

**Interaction.** Filter by persona, level and stage. "Mark as done" checkboxes are saved in localStorage and fill each path's six-lane progress bar. Clicking a chapter moves a progress hairline on the poster mock to that point.

### webinars.html — Webinars

**Content.** H1 "Live on the road.", lede: live sessions on Thursdays, plus the odd launch-day special, with creators and the Crestora crew Next up, with a countdown: "Launch day, live: Theo ships Tidepool 1.1", Fri 4 Dec 2026, 17:00 UTC. Upcoming: "Feedback without the fear" (17 Dec) · "Plan 2027 in one Blueprint" (14 Jan 2027) · "Pricing your work" (28 Jan 2027), each with hosts as initials avatars. On demand (6): Forty-one days to Night Bloom (46 min) · Review Room deep dive (38) · Crew roles for small studios (29) · Afterglow: reading the numbers (33) · From Sparkboard to Blueprint (25) · Selling out a ceramics drop (41). A register form.

**Interaction.** The countdown shows days:hours:minutes:seconds in Michroma, and times appear in the visitor's local zone through Intl. "Add to calendar" downloads an .ics file. Registering takes name, email and session checkboxes and shows a toast. On-demand cards open a <dialog> with a summary and chapters.

### privacy.html — Privacy Policy

**Content.** "Last updated 1 November 2026". A "The short version" panel with lane-chip bullets: your work is yours; we collect what we need to run Crestora; we never sell data or train models on your files; export or delete everything any time; questions go to privacy@crestora.example. Sections: Who we are · What we collect · How we use it · Legal bases · Sharing & subprocessors (linking to compliance.html#subprocessors) · International transfers · Retention · Your rights and how to use them · Children · Security · Changes · Contact & DPO. A note that Crestora is fictional and this is sample text.

**Interaction.** A .with-toc layout with sticky TOC scrollspy, copy-link on headings and print-friendly styles.

### terms.html — Terms of Service

**Content.** The short version: "You own what you make. You let us store, process and show it only the way you ask. Be decent. Pay for what you use. Either of us can end this." Sections: Accepting these terms · Your account · Your content (ownership; a limited licence to host it) · Acceptable use · Plans, billing & refunds · Guests & review links · Third-party integrations · Availability · Termination · Disclaimers · Liability · Governing law (Portugal) · Changes · Contact. Fictional-company note.

**Interaction.** Same template as Privacy: TOC scrollspy and copy-link on headings.

### cookies.html — Cookie Policy

**Content.** The short version. What cookies and local storage are. A table with name, purpose, duration and category. It honestly lists what this demo site uses: crestora:seen (sessionStorage, shortens intros on repeat visits) and the preference keys in localStorage (billing period, code language, votes, tutorial progress, cookie choices). It also lists the product's fictional cookies: crestora_session (essential), crestora_prefs (preferences), cr_metrics (first-party analytics, off by default, 13 months). A preferences panel follows.

**Interaction.** Toggle switches (role=switch, aria-checked) for Preferences and Analytics, with Essential locked on. [Save choices] stores them in localStorage and shows a toast, and [Reset everything] clears this site's local storage.

### compliance.html — Compliance

**Content.** H1 "Compliance.", lede "The frameworks we follow and the paperwork your legal team will ask for." A status table: GDPR · UK GDPR · CCPA/CPRA · SOC 2 Type II (report under NDA) · ISO/IEC 27001 · WCAG 2.2 AA (product target, accessibility statement). A Data Processing Agreement summary with a link to request it (contact.html?topic=legal). Subprocessors (#subprocessors), named generically: cloud infrastructure (EU and US), email delivery, payments, error monitoring and support tooling, each with purpose and region. Data residency for Label (EU/US). A changelog of the subprocessor list. Fictional-company note.

**Interaction.** TOC scrollspy. On mobile the tables stack into cards. A "Subscribe to subprocessor changes" form shows a toast.

### sitemap.html — Sitemap

**Content.** H1 "Sitemap." Every page, grouped by the footer's four columns, plus a Home group listing the home anchors (Creators, How it flows, Inside a lane, Integrations, Made in Crestora, Plans, Your lane is open), Field Notes posts, and Get started (start.html, start.html#signin). There is also a schematic of the home page drawn as a vertical lane with a stop per section. tools/pages.mjs also generates a static sitemap.xml, linked from this page.

**Interaction.** Links use data-roll. Each stop on the home schematic is a link that lights in its stage colour on hover or focus. Group headings carry a short spectrum streak.

### start.html — (no footer link: the target of every "Open a lane" / "Sign in" CTA and the no-JS action of the home CTA form)

**Content.** Two tabs: "Open a lane" (name, email, what are you making, and a radio for Creator, Builder or Dreamer) and "Sign in" (#signin: email, password, and "Email me a link instead"). On the right is a live Lane 001 preview card. It reads ?idea=, ?email= and ?plan= from the home page or pricing. A demo note says nothing is stored or sent. The success state says "Your lane is open." with a link "Take it for a drive ↓" that scrolls to this page's footer and fires crestora:launch.

**Interaction.** Tabs are a tablist, and #signin opens the sign-in tab. The preview updates as you type, validation is inline, and the success state fills the stage rail and triggers the footer launch on click.

## 7. Done means

- At 1440 × 900, 1920 × 1080, 768 × 1024 and 390 × 844: nothing overflows horizontally, nothing overlaps, type is
  legible, every section looks finished and premium in the footer's language.
- No console errors or 404s. `node crestora/tools/links.mjs` passes.
- Keyboard: every control reachable, visible focus, menus/dialogs/tabs/accordions with correct ARIA.
- `?reduced` (and prefers-reduced-motion): everything at rest, nothing animating. Without JS: content readable.
- Copy is final, specific and human (no lorem ipsum, no "Feature 1"), consistent with the facts above.
