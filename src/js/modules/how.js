/**
 * How it works — plays the three-step demo along the timeline.
 *
 * The markup ships in its final state (all connected, prompt written, test
 * passed, workflow live), which is what no-JS and reduced-motion visitors see.
 * With motion allowed, this module "arms" the section: every demo goes back to
 * its starting state and then plays as three phases, one per step:
 *
 *   01  connectors sign in one by one and turn "Connected"
 *   02  the prompt types itself, Mist drafts, three step chips appear
 *   03  the test run ticks through four steps, then Publish turns "Live"
 *
 * Each phase starts once its card is on screen (so on phones, where the steps
 * stack, every step plays as you reach it) and its clock only runs while the
 * card is visible and the tab is in the foreground. The timeline's accent fill
 * travels from one marker to the next as each phase runs; the next marker
 * lights when its phase begins. A Replay node at the end of the line restarts it.
 */
import { reducedMotion } from "../core/utils.js";

const JITTER = [8, 0, 14, 3, 10, 1, 16, 5, 12, 6, 0, 10];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const headerOffset = () =>
  Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

function setState(el, value) {
  if (el && el.dataset.state !== value) el.dataset.state = value;
}
function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}
/** Layout offset of el inside ancestor (ignores transforms, e.g. reveal). */
function offsetWithin(el, ancestor) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== ancestor; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

/* ── Phase 1 · Connect ─────────────────────────────────────── */
function connectPhase(step) {
  const tiles = [...step.querySelectorAll("[data-how-tile]")];
  const count = step.querySelector("[data-how-count]");
  const START = 360;
  const GAP = 190;
  const AUTH = 320;
  return {
    duration: START + (tiles.length - 1) * GAP + AUTH + 440,
    render(t) {
      let done = 0;
      tiles.forEach((tile, i) => {
        const at = START + i * GAP;
        const state = t >= at + AUTH ? "done" : t >= at ? "pending" : "idle";
        if (state === "done") done += 1;
        setState(tile, state);
      });
      setText(count, String(done));
    },
  };
}

/* ── Phase 2 · Describe ────────────────────────────────────── */
function describePhase(step) {
  const prompt = step.querySelector("[data-how-prompt]");
  const typed = step.querySelector("[data-how-typed]");
  const rest = step.querySelector("[data-how-rest]");
  const draft = step.querySelector("[data-how-draft]");
  const chips = [...step.querySelectorAll("[data-how-chip]")];
  const sentence = (typed?.textContent || "").trim();

  // Per-character timestamps: a steady hand with a little jitter and a
  // breath after each comma.
  const TYPE_AT = 480;
  const times = [];
  let acc = 0;
  for (let i = 0; i < sentence.length; i++) {
    // U+2060 (word joiner, keeps "on-call" from breaking at the hyphen) is invisible: no keystroke
    if (sentence[i] !== "\u2060") acc += 19 + JITTER[i % JITTER.length] + (sentence[i - 1] === "," ? 150 : 0);
    times.push(acc);
  }
  const typedEnd = TYPE_AT + acc;
  const DRAFT_AT = typedEnd + 420;
  const CHIPS_AT = DRAFT_AT + 720;
  const CHIP_GAP = 140;
  const typedCount = (t) => {
    let n = 0;
    while (n < times.length && times[n] <= t) n += 1;
    return n;
  };

  return {
    duration: CHIPS_AT + (chips.length - 1) * CHIP_GAP + 480,
    render(t) {
      const n = t < 0 ? 0 : typedCount(t - TYPE_AT);
      setText(typed, sentence.slice(0, n));
      setText(rest, sentence.slice(n));
      setState(prompt, n ? "filled" : "empty");

      let caret = "off";
      if (t >= 0 && t < DRAFT_AT) caret = n > 0 && n < sentence.length ? "solid" : "blink";
      if (prompt && prompt.dataset.caret !== caret) prompt.dataset.caret = caret;

      setState(draft, t < typedEnd ? "disabled" : t < DRAFT_AT || t >= CHIPS_AT ? "ready" : "busy");
      chips.forEach((chip, i) => {
        const inAt = CHIPS_AT + i * CHIP_GAP;
        setState(chip, t >= inAt ? "in" : t >= DRAFT_AT ? "loading" : "ghost");
      });
    },
  };
}

/* ── Phase 3 · Test & publish ──────────────────────────────── */
function launchPhase(step) {
  const status = step.querySelector("[data-how-status]");
  const label = step.querySelector("[data-how-status-label]");
  const meta = step.querySelector("[data-how-status-meta]");
  const publish = step.querySelector("[data-how-publish]");
  const rows = [...step.querySelectorAll("[data-how-row]")].map((row) => ({
    row,
    time: row.querySelector("[data-how-time]"),
    ms: Number(row.dataset.ms) || 500,
  }));
  const passedLabel = label?.textContent || "";
  const passedMeta = meta?.textContent || "";
  const stepsMeta = passedMeta.split("·")[0].trim();

  let total = 0;
  for (const r of rows) {
    r.from = total;
    total += r.ms;
    r.to = total;
  }
  const RUN_AT = 360;
  const PASS_AT = RUN_AT + total;
  const PRESS_AT = PASS_AT + 600;
  const LIVE_AT = PRESS_AT + 220;

  return {
    duration: LIVE_AT + 420,
    render(t) {
      const running = t >= RUN_AT;
      const elapsed = running ? Math.min(t - RUN_AT, total) : 0;

      for (const r of rows) {
        const state = !running ? "idle" : elapsed >= r.to ? "done" : elapsed >= r.from ? "running" : "idle";
        setState(r.row, state);
        setText(r.time, state === "done" ? seconds(r.ms) : state === "running" ? seconds(elapsed - r.from) : "—");
      }

      if (!running) {
        setState(status, "idle");
        setText(label, "Ready to test");
        setText(meta, stepsMeta);
      } else if (t < PASS_AT) {
        setState(status, "running");
        setText(label, "Running test");
        setText(meta, seconds(elapsed));
      } else {
        setState(status, "passed");
        setText(label, passedLabel);
        setText(meta, passedMeta);
      }

      setState(publish, t < PASS_AT ? "disabled" : t < PRESS_AT ? "ready" : t < LIVE_AT ? "pressed" : "live");
    },
  };
}

/* ── Orchestration ─────────────────────────────────────────── */
export default function init(root) {
  if (root.dataset.howReady) return;
  root.dataset.howReady = "true";
  if (reducedMotion() || !("IntersectionObserver" in window)) return;

  const timeline = root.querySelector("[data-how-timeline]");
  const track = root.querySelector("[data-how-track]");
  const replay = root.querySelector("[data-how-replay]");
  const steps = [...root.querySelectorAll("[data-how-step]")];
  if (!timeline || !track || steps.length !== 3) return;

  const visuals = steps.map((s) => s.querySelector("[data-how-visual]") || s);
  const markers = steps.map((s) => s.querySelector(".how__marker") || s);
  const phases = [connectPhase(steps[0]), describePhase(steps[1]), launchPhase(steps[2])];

  const onScreen = steps.map(() => false);
  const ratio = steps.map(() => 0);
  const seen = steps.map(() => false);
  let stops = [0, 0.4, 0.8, 1];
  let phase = 0;
  let local = 0;
  let started = false;
  let finished = false;
  let fill = { k: 0, p: 0 };
  let last = 0;
  let raf = 0;
  let hold = 0; // Replay is scrolling back up to step 1: don't skip ahead meanwhile

  /* Fill: where each marker sits along the track (0–1) */
  function measure() {
    // Desktop: the line ends where the replay node begins (its width follows the label)
    if (replay) root.style.setProperty("--how-replay-w", `${replay.offsetWidth}px`);
    const vertical = track.offsetHeight > track.offsetWidth;
    const length = (vertical ? track.offsetHeight : track.offsetWidth) || 1;
    const start = vertical ? track.offsetTop : track.offsetLeft;
    stops = markers.map((m) => {
      const o = offsetWithin(m, timeline);
      const center = vertical ? o.y + m.offsetHeight / 2 : o.x + m.offsetWidth / 2;
      return clamp01((center - start) / length);
    });
    stops.push(1);
  }
  function setFill(k, p) {
    fill = { k, p };
    const from = stops[k] ?? 1;
    const to = stops[k + 1] ?? 1;
    track.style.setProperty("--how-fill", (from + (to - from) * easeInOut(clamp01(p))).toFixed(4));
  }

  function reset() {
    phases.forEach((p) => p.render(-1));
    steps.forEach((s) => s.classList.remove("is-lit"));
    root.classList.remove("is-playing", "is-done");
    phase = 0;
    local = 0;
    started = false;
    finished = false;
    last = 0;
    setFill(0, 0);
  }

  function finish() {
    finished = true;
    root.classList.remove("is-playing");
    root.classList.add("is-done");
    setFill(phases.length - 1, 1);
    if (replay) {
      replay.classList.remove("is-pending");
      replay.removeAttribute("aria-disabled");
    }
  }

  const canAdvance = () =>
    !finished && !document.hidden && onScreen[phase] && (started || seen[phase]);

  /* Stacked layouts: if the reader is already looking at a later step — the
     current card has scrolled away, or only a sliver of it shows (under 40%
     before it starts, under 20% once playing, e.g. after a smooth scroll swept
     past it) while a later card fills the screen — settle every step before
     that one, so nobody reads an idle card while the demo plays elsewhere. */
  function catchUp() {
    if (finished || hold) return;
    let ahead = -1;
    if (!onScreen[phase]) ahead = onScreen.findIndex((visible, i) => visible && i > phase);
    else if (ratio[phase] < (started ? 0.2 : 0.4)) ahead = ratio.findIndex((r, i) => r >= 0.4 && i > phase);
    if (ahead < 0) return;
    for (let k = phase; k < ahead; k++) {
      phases[k].render(Infinity);
      steps[k].classList.add("is-lit");
    }
    phase = ahead;
    local = 0;
    started = false;
    last = 0;
    setFill(ahead - 1, 1);
  }

  function frame(now) {
    raf = 0;
    catchUp();
    if (!canAdvance()) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(now - last, 50) : 16;
    last = now;
    if (!started) {
      started = true;
      steps[phase].classList.add("is-lit");
      root.classList.add("is-playing");
    }
    const current = phases[phase];
    local += dt;
    current.render(local);
    setFill(phase, local / current.duration);
    if (local >= current.duration) {
      phase += 1;
      local = 0;
      started = false;
      if (phase === phases.length) return finish();
    }
    raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    catchUp();
    if (!raf && canAdvance()) raf = requestAnimationFrame(frame);
  };

  /* Arm: back to the start, line empty, Replay waiting at the end */
  root.classList.add("is-armed");
  if (replay) {
    replay.hidden = false;
    replay.classList.add("is-pending");
  }
  reset();
  measure();
  setFill(0, 0);

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const i = visuals.indexOf(entry.target);
        if (i < 0) continue;
        onScreen[i] = entry.isIntersecting;
        ratio[i] = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (ratio[i] >= 0.4) seen[i] = true;
      }
      if (hold && ratio[0] >= 0.4) {
        clearTimeout(hold);
        hold = 0;
      }
      kick();
    },
    // the fixed header hides the top of the viewport: a card under it isn't "seen"
    { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1], rootMargin: `-${headerOffset()}px 0px 0px 0px` }
  );
  visuals.forEach((v) => io.observe(v));

  // Pause the "Live" pulse while the section is off screen
  new IntersectionObserver((entries) => {
    root.classList.toggle("is-inview", entries.some((e) => e.isIntersecting));
  }).observe(root);

  document.addEventListener("visibilitychange", kick);

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => {
      measure();
      setFill(fill.k, fill.p);
    });
    ro.observe(timeline);
    if (replay) ro.observe(replay); // the label's width settles once the webfont loads
  }

  replay?.addEventListener("click", () => {
    if (replay.getAttribute("aria-disabled") === "true") return;
    replay.setAttribute("aria-disabled", "true");
    reset();
    // On stacked layouts the first step may be far above: bring it back
    const first = visuals[0].getBoundingClientRect();
    if (first.top < 0 || first.bottom > innerHeight) {
      clearTimeout(hold);
      hold = setTimeout(() => {
        hold = 0;
        kick();
      }, 1600);
      steps[0].scrollIntoView({ behavior: "smooth", block: "start" });
    }
    kick();
  });
}
