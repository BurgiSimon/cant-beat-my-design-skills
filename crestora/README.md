# Crestora

A footer, recreated from one shot as close as it goes and set in motion: **Crestora**'s links over a night where a car
drifts down a road of light. On a landscape screen the footer *is* the shot (1597 × 985 design px, fitted to the screen
and set on its bottom edge); the night around it is WebGL and runs on past the frame to the screen's edges.

- **Live:** https://burgisimon.github.io/cant-beat-my-design-skills/crestora/
- No build step: plain HTML, CSS and ES modules. `build.mjs` at the repo root copies it to `/crestora/` and stamps the
  cache-busting version; `node build.mjs --serve` serves it with live reload.

## How close

The type was measured against the shot at its own size: the wordmark, the tagline, the four columns, the rule and the
bottom row land within a pixel or two of it. The wordmark is Michroma with a hairline of stroke to bring it up to the
shot's weight; everything else is Inter. The road of light was traced off the shot band by band (see
`js/geometry.js`), and its colours sampled from it.

## What moves

| Part | What it does |
| --- | --- |
| The road (`js/geometry.js`, `js/scene.js`) | One ribbon of 210 lanes lofted between 14 guides traced off the shot: it comes in from the left, pinches under the car and fans out to the right. Dashes run along every lane; their length is measured against the lanes around them, so they shrink and slow toward the car as if it were far away and race past at the edges. Under it, nested arches of road rise from the bottom edge, faint on the left |
| The car | Cut from the shot (`tools/cut_car.py`) and drawn in WebGL: the wheels turn (the rims spun inside their ellipses, motion-blurred), the road's colours slide back along the paint's highlights, a glint runs nose to tail now and then, it bobs on its springs |
| The dust | A plume behind the tail and a low cloud off the rear wheel, both rolling back with the road, plus puffs and bright specks flung off the tail where the shot's bodywork comes apart, simulated on the CPU |
| The stars | Three layers that twinkle and drift with the pointer |
| Intro (`js/intro.js`) | The night comes up, the road lights from under the car outward at warp speed and slows to a cruise as the car rolls in from behind, noses down and settles on its springs; the mark turns in, the name rises letter by letter, the columns follow, the rule draws itself |
| Over the road (`js/ui.js`) | The pointer is a lamp: lanes and paint brighten under it, the dust parts round it. **Hold** (mouse, finger or Space) and the throttle goes down: the road streams, the stars streak, the car squats and shakes, the tail lights burn and the hint reads out the speed |
| The details | Links roll up into a white copy of themselves; the social boxes lean toward the pointer and light a ring of the road's colours, with their name above; the mark's chrome turns to the pointer and it spins when the logo is touched; a glint rides the rule and waits under the pointer when it comes near; the heart beats, and a click sends hearts up |

## Quality

- Under `prefers-reduced-motion` (or `?reduced` in the URL) nothing animates: the night is drawn once, dust and all.
  Without WebGL (or without scripts) it is a still of the night (`assets/img/poster.jpg`) under the live type.
- On phones and upright tablets the footer flows (2 columns, 4 from 700 px) and the road is a window at its foot,
  fitted round the car; a finger holds it down. From 360 px to wide screens with no horizontal scroll.
- The scene only draws while the tab is visible; device pixels are capped at 2 (1.5 on very large screens); stars cost
  one cell lookup per layer until the throttle stretches them.

## Tools (not published)

- `python3 -I crestora/tools/cut_car.py <shot.png> <out-dir>` cuts the car out of the shot (an outline traced by hand,
  its edge refined by colour, the dust at its rear faded out). Encode `car-2x.png` to `assets/img/car.webp`.
- `node crestora/tools/share.mjs` renders `assets/img/og.jpg` and `assets/img/poster.jpg` (needs Playwright).

## Credits

- Design: recreated from a footer shot signed "Made with love by Pranav" (the line is kept as the shot has it). The car
  picture is cut from that shot; the car and its maker's lettering belong to their owners.
- Type: [Michroma](https://github.com/googlefonts/Michroma-font) and [Inter](https://github.com/rsms/inter), both under
  the SIL Open Font License (licences in `assets/fonts/`).
- [GSAP](https://gsap.com) 3.13 (GSAP standard license), vendored in `vendor/`.
- Crestora is fictional.
