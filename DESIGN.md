# Mist — design system & content guide

The hero (`src/partials/sections/hero.html`) is the reference: a deep-violet sky, magenta-lit peaks rising
out of glowing mist, square glass boxes, light display type with a lavender→white gradient. Every other
part of the site should feel like it was cut from the same frame.

## 1. Principles

1. **Calm, atmospheric, precise.** Big quiet type, generous space, soft light. Detail lives in the
   small things — hover states, alignment, copy — not in decoration.
2. **Square corners, everywhere.** `border-radius: 0` on buttons, panels, inputs, avatars, chips,
   dots. (Spinners are the only round thing.)
3. **Light comes from the mist.** Backgrounds are near-black violet (`--bg`) lit by soft radial glows in
   the accent hues and horizontal mist bands — never flat colored boxes, never pure gray.
4. **Glass, not cards.** Surfaces are translucent (`.panel`, `--glass`) with 1px hairlines (`--line`).
5. **Motion is a breath.** Slow ease-out reveals (`[data-reveal]`), at most one ambient animation per
   viewport, everything off under `prefers-reduced-motion`.

## 2. Tokens (src/css/00-tokens.css)

| Group | Tokens |
| --- | --- |
| Sky (hero only) | `--sky-0 … --sky-6` (#26115a → #6a3db2) |
| Page | `--bg` #07050d, `--bg-elevated` #0e0a1c, `--bg-sunken` |
| Surfaces | `--surface` (3.5% white), `--surface-2` (6%), `--surface-3` (9%), `--glass` (10%), `--glass-hover` (16%) |
| Lines | `--line` (8%), `--line-strong` (16%), `--line-accent` (lilac 45%) |
| Text | `--text` #fff, `--text-soft` #c3b0e3 (body), `--text-muted` #9c8ebf (secondary), `--text-faint` #6c6190 (decorative only — fails AA for small text), `--text-nav` |
| Accents (from the lit peaks) | `--pink` #ff2e9a, `--hotpink` #da088b, `--magenta` #b410d8, `--violet` #902ce1, `--lilac` #b79cff, `--mist` #d9cffb, `--accent-gradient` |
| Status | `--success` #63e6b0, `--warning`, `--danger` |
| Type | `--font` Inter (UI/body), `--font-display` DM Sans (headings), `--font-mono` |
| Layout | `--container` 1296px, `--gutter` 16–72px, `--section-y` 96–168px, `--header-h` |
| Motion | `--ease-out`, `--ease-in-out`, `--dur-fast` 160ms, `--dur` 280ms, `--dur-slow` 800ms |

Use the accent gradient sparingly: one highlight per view (an active state, a featured border, a key number).

## 3. Type scale

| Class | Use | Spec |
| --- | --- | --- |
| `.display` | hero h1 only | DM Sans 300, 68/70, −0.014em, gradient |
| `.title-1` | page titles (sub-pages, final CTA) | DM Sans 300, 40–68px, gradient |
| `.title-2` | section titles (h2) | DM Sans 300, 34–52px, gradient |
| `.title-3` | card / feature titles (h3) | DM Sans 400, 22–28px, white |
| `.title-4` | small titles, labels | Inter 500, 18px, white |
| `.lede` | section intro | Inter 18–22px / 1.33, `--text-soft` |
| `.body-l`, `.body` | paragraphs | Inter 18 / 16px, `--text-soft` |
| `.small` | captions, meta | Inter 14px, `--text-muted` |
| `.eyebrow` | label above a title | Inter 500 13px, uppercase, +0.14em, 7px gradient square |
| `.mono` | IDs, code, timings | 13px monospace |

Write headings in sentence case. Numbers that matter are set large in DM Sans 300 with the gradient.

## 4. Layout

- Content sits in `.container` (1296px max + gutters) — the same frame as the header and hero.
- Sections: `<section class="section <name>" id="…" aria-labelledby="…">` with `--section-y` padding.
- Section header pattern `.section-head` mirrors the hero split: eyebrow + `.title-2` on the left,
  `.lede` + optional action in a 478px right column (`.section-head__aside`). `.section-head--center`
  for centered variants. Alternate between the two for rhythm.
- Spacing on an 8px scale (4 for hairline adjustments). Grids: 12 columns, 24–32px gaps.
- Breakpoints: 1100, 860, 720, 480. Must be flawless from 360px to 1920px wide, no horizontal scroll.

## 5. Components (src/css/01-base.css)

- Buttons: `.btn` + `.btn--primary` (white, the hero CTA), `.btn--glass`, `.btn--outline`; sizes
  `.btn--lg` (58px, hero), default 52px, `.btn--sm` 40px; `.btn--block`. Arrow icon gets
  `.icon--arrow` and nudges on hover. `aria-busy="true"` shows a spinner.
- `.link-arrow` — "Learn more →" text links.
- `.panel` (+ `.panel--hover`) — the glass surface. `.chip`, `.chip--accent`, `.dot`, `.dot--live`.
- `.glow` — absolutely positioned blurred blob (set size, position, background radial in the section CSS).
- `.mist-band` — a horizontal band of soft lavender mist for section transitions.
- Forms: `.field`, `.field__label`, `.input` (also select / textarea), `.field__hint`,
  `.field__error`, `.check`. Wire validation with `data-module="form"` (see `src/js/modules/form.js`).

### Icons

Inline SVG on a 24px grid, `class="icon"` (20px; `--sm` 16, `--lg` 24), 1.5px stroke, square caps,
miter joins, `aria-hidden="true"` unless meaningful. Shared paths:

```html
<svg class="icon icon--arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>  <!-- arrow -->
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>              <!-- check -->
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>                     <!-- plus -->
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>                 <!-- close -->
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>                         <!-- chevron -->
```

The Mist mark is a circle cut into four horizontal bars (see `header.html`).

## 6. Motion

- `data-reveal` on blocks (`="fade"` / `="scale"` variants); put `data-reveal-stagger` on a parent to
  cascade its children. Only reveal meaningful blocks — not every line.
- Hover: 160–280ms; reveals: 800ms `--ease-out`. Ambient loops slow (≥ 3s) and subtle.
- Under `prefers-reduced-motion: reduce` everything is static and fully visible; JS checks
  `reducedMotion()` before starting timers or counters.

## 7. Accessibility

- One `h1` per page; each section has an `h2` and `aria-labelledby`. Landmarks: header, main, footer.
- Body text ≥ 4.5:1 (`--text-soft` / `--text-muted` on `--bg` pass; `--text-faint` doesn't).
- Interactive widgets are keyboard-complete: tabs use `role="tablist"` + arrow keys + roving
  `tabindex`; disclosures use `<details>` or `aria-expanded`; toggles are radio groups or `role="switch"`.
- Visible focus everywhere (global `:focus-visible`). Never hover-only information.
- Decorative visuals `aria-hidden="true"`; mockups get a concise `aria-label` or visually hidden summary.

## 8. Files & conventions

```
src/pages/*.html           pages; include partials with <!-- @include path -->
src/partials/              header.html, footer.html, head-common.html, sections/*.html
src/css/NN-name.css        concatenated in filename order → css/styles.css
src/js/main.js             entry; core/* run everywhere; modules/<name>.js load for [data-module="name"]
src/assets/                fonts, images (webp), icons
src/static/                copied to the site root
```

- Section CSS is scoped under the section's root class (`.pricing`, `.pricing__card`, `.pricing__card--featured`).
- Modules: `export default function init(root) {}`; idempotent; no external libraries or CDNs.
- Links: home anchors as `./#pricing` (works from every page); pages as `signup.html`, `signin.html`.
  No dead links and no `href="#"`.

## 9. Product facts — the single source of truth for copy

Mist is an AI workflow automation platform: connect your tools and data, describe a workflow in plain
language, let AI steps (classify, extract, summarize, draft, decide) do the busywork, keep humans in the
loop for approvals, and watch every run.

| Fact | Value |
| --- | --- |
| Company | Mist Labs, Inc. (founded 2024) |
| Teams using Mist | 4,000+ |
| Tasks automated | 18M every month |
| Time saved | 11 hours per person, per week (customer average) |
| Integrations | 300+ connectors, plus webhooks, HTTP and custom code (JS / Python) |
| Time to first workflow | 12 minutes (median) |
| Uptime | 99.9% (Team), 99.99% SLA (Enterprise) |
| Trial | 14-day free trial of Team, no credit card required |
| Security | SOC 2 Type II, GDPR, AES-256 at rest, TLS 1.3 in transit, SSO/SAML + SCIM, audit logs, EU or US data residency. Your data is never used to train models. |
| AI | Model-agnostic: use Mist's hosted models or bring your own key |

### Pricing (USD)

| Plan | Price | Includes |
| --- | --- | --- |
| Starter | Free forever | Up to 3 members, 1,000 tasks / month, 5 active workflows, 50+ core integrations, AI steps (100 / month), 7-day run history, community support |
| Team — *most popular* | $30 / member / month billed monthly, **$24 billed annually (save 20%)** | 25,000 tasks / month (then $8 per extra 1,000), unlimited workflows, all 300+ integrations, unlimited AI steps, human-in-the-loop approvals, 90-day run history, roles & permissions, priority email support, 99.9% uptime |
| Enterprise | Custom | Everything in Team, plus SSO/SAML & SCIM, audit logs, EU/US data residency, private networking (VPC peering), custom retention, 99.99% SLA, dedicated success manager, security review & DPA |

CTAs: Starter → `signup.html?plan=starter` ("Start for free"); Team → `signup.html?plan=team`
("Start 14-day trial"); Enterprise → `signup.html?plan=enterprise` ("Talk to sales").

### Integration categories (no real brand names or logos)

Chat & messaging · Email · Calendar · Docs & wikis · Spreadsheets · CRM · Help desk · Issue tracking ·
Data warehouses · Databases · Payments & billing · HR systems · File storage · Webhooks & HTTP · Custom code

### Fictional customers (use only these)

Kestrel · Lumora · Oakbridge · Halden & Co · Northvale · Sorrel · Tidewell · Brightfold · Pinecrest ·
Quarry Labs · Verity Health · Altamira

### Fictional people

| Name | Role | Company |
| --- | --- | --- |
| Priya Raman | VP Customer Experience | Lumora |
| Marcus Feld | Head of Revenue Operations | Oakbridge |
| Elena Sørensen | COO | Tidewell |
| Daniel Okafor | Finance Systems Lead | Brightfold |
| Hannah Weiss | Director of People Operations | Northvale |
| Tomás Rivera | Staff Engineer | Quarry Labs |

### Voice

Plain, warm, confident; short sentences; concrete outcomes over adjectives. Mist metaphors are welcome
but light ("clear the fog", "calm", "focus") — never more than one per section. American English.
