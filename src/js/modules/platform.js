/**
 * Platform mockup — wires the workflow graph and runs a quiet live demo.
 *
 * Wires: SVG connectors are drawn from the nodes' real layout positions
 * (offsetLeft/Top, so reveal transforms don't skew them) and redrawn on
 * resize, so one markup serves the desktop, tablet and phone layouts.
 *
 * Demo (motion allowed, only while the window is on screen): every ~3s a
 * new run enters the log as "Running", a pulse carries it through the
 * graph, its category and route fill in as the matching steps complete,
 * and it flips to "Succeeded" when it reaches the CRM step.
 */
import { $, $$, formatNumber, reducedMotion } from "../core/utils.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ROWS = 4;

const EDGES = [
  { from: "trigger", to: "ai" },
  { from: "ai", to: "cond" },
  { from: "cond", to: "yes", label: "Yes" },
  { from: "cond", to: "no", label: "No" },
  { from: "yes", to: "log" },
  { from: "no", to: "log" },
];

// [subject, category, urgent]
// Subjects stay short enough to fit the tablet log without truncating.
const TICKETS = [
  ["Checkout fails with error 500", "bug", true],
  ["Can I change my billing email?", "billing", false],
  ["Export to CSV drops the last row", "bug", false],
  ["How do I invite a contractor?", "how-to", false],
  ["Team locked out after SSO change", "account", true],
  ["Invoice shows the wrong tax rate", "billing", false],
  ["Reset email never arrives", "account", false],
  ["Where are my past receipts?", "how-to", false],
  ["Webhooks arriving an hour late", "bug", true],
  ["Switch us to annual billing", "billing", false],
  ["Can we add a read-only role?", "how-to", false],
  ["Dashboard won’t load on mobile", "bug", false],
];

const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const rand = (min, max) => min + Math.random() * (max - min);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "Just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/* ── Wires ─────────────────────────────────────────────────── */
function createWires(flow, svg) {
  const nodes = Object.fromEntries($$("[data-node]", flow).map((n) => [n.dataset.node, n]));
  const edges = EDGES.filter((e) => nodes[e.from] && nodes[e.to]).map((e) => ({ ...e, key: `${e.from}>${e.to}` }));

  const gBase = el("g");
  const gLit = el("g");
  const gPorts = el("g");
  const gLabels = el("g");
  const pulse = el("rect", { class: "platform__pulse", width: 6, height: 6, x: -3, y: -3 });
  const defs = el("defs");
  const glow = el("filter", { id: "platform-glow", x: "-200%", y: "-200%", width: "500%", height: "500%" });
  glow.append(
    el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 3, result: "b" }),
    el("feFlood", { "flood-color": "#ff2e9a", "flood-opacity": 0.9 }),
    el("feComposite", { in2: "b", operator: "in", result: "g" })
  );
  const merge = el("feMerge");
  merge.append(el("feMergeNode", { in: "g" }), el("feMergeNode", { in: "SourceGraphic" }));
  glow.append(merge);
  defs.append(glow);
  pulse.setAttribute("filter", "url(#platform-glow)");
  gLit.setAttribute("filter", "url(#platform-glow)");
  svg.replaceChildren(defs, gBase, gLit, gPorts, gLabels, pulse);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const e of edges) {
    e.path = el("path", { class: "platform__wire" });
    e.lit = el("path", { class: "platform__wire-lit" });
    gBase.append(e.path);
    gLit.append(e.lit);
    if (e.label) {
      e.tag = el("g", { class: "platform__edge-label" });
      e.tag.append(el("rect", { x: -17.5, y: -10.5, width: 35, height: 21 }), el("text", { "text-anchor": "middle", y: 4 }));
      e.tag.lastChild.textContent = e.label;
      gLabels.append(e.tag);
    }
  }

  // Layout box of a node relative to the flow (ignores CSS transforms).
  const box = (n) => ({ x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight });
  const snap = (v) => Math.round(v) + 0.5;

  function draw() {
    const w = flow.clientWidth;
    const h = flow.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    gPorts.replaceChildren();
    const ports = new Set();
    for (const e of edges) {
      const a = box(nodes[e.from]);
      const b = box(nodes[e.to]);
      const x1 = snap(a.x + a.w / 2);
      const y1 = a.y + a.h;
      const x2 = snap(b.x + b.w / 2);
      const y2 = b.y;
      const dy = y2 - y1;
      const d =
        Math.abs(x1 - x2) < 1
          ? `M${x1} ${y1}V${y2}`
          : `M${x1} ${y1}C${x1} ${y1 + dy * 0.62} ${x2} ${y2 - dy * 0.62} ${x2} ${y2}`;
      e.path.setAttribute("d", d);
      e.lit.setAttribute("d", d);
      e.len = e.path.getTotalLength();
      ports.add(`${x1},${y1}`).add(`${x2},${y2}`);
      if (e.tag) {
        const p = e.path.getPointAtLength(e.len * 0.5);
        e.tag.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      }
    }
    for (const p of ports) {
      const [x, y] = p.split(",").map(Number);
      gPorts.append(el("rect", { class: "platform__port", x: x - 3, y: y - 3, width: 6, height: 6 }));
    }
    flow.classList.add("is-wired");
  }

  return {
    nodes,
    pulse,
    edge: (from, to) => edges.find((e) => e.from === from && e.to === to),
    draw,
  };
}

/* ── Live demo ─────────────────────────────────────────────── */
function createDemo(root, wires) {
  const list = $("[data-log]", root);
  const weekEls = $$("[data-runs-week]", root);
  const usageEl = $("[data-usage]", root);
  const usageBar = $("[data-usage-bar]", root);
  const usagePct = $("[data-usage-pct]", root);
  if (!list || !list.firstElementChild) return null;

  const template = list.firstElementChild.cloneNode(true);
  template.removeAttribute("data-ago");
  let week = 1284;
  let usage = 8412;
  let ticketNo = 48217;
  let ticketIdx = 0;

  // On first start, give the static rows real timestamps (relative to the moment
  // the window comes into view) so their "6s ago" labels keep ticking from there.
  let anchored = false;
  const anchor = () => {
    if (anchored) return;
    anchored = true;
    const now = performance.now();
    for (const row of list.children) row.dataset.t = String(now - Number(row.dataset.ago || 0) * 1000);
  };

  let running = false;
  let gen = 0; // bumps on stop() to cancel in-flight steps
  let clockTimer = 0;
  let nextTimer = 0;
  let raf = 0;
  const hotTimers = new Set();
  let current = null; // { row, started, ticket }

  const tickClock = () => {
    const t = performance.now();
    for (const row of list.children) {
      const cell = $(".platform__run-time", row);
      if (cell && row.dataset.t) cell.textContent = ago(t - Number(row.dataset.t));
    }
  };

  const wait = (ms, token) =>
    new Promise((resolve, reject) => {
      const id = setTimeout(() => {
        hotTimers.delete(id);
        if (token === gen) resolve();
        else reject(new Error("cancelled"));
      }, ms);
      hotTimers.add(id);
    });

  const flash = (name) => {
    const node = wires.nodes[name];
    if (!node) return;
    node.classList.add("is-hot");
    const id = setTimeout(() => {
      node.classList.remove("is-hot");
      hotTimers.delete(id);
    }, 520);
    hotTimers.add(id);
  };

  const travel = (edge, ms, token) =>
    new Promise((resolve, reject) => {
      if (!edge) return resolve();
      const { pulse } = wires;
      const start = performance.now();
      const COMET = 44;
      edge.path.classList.add("is-active");
      edge.lit.classList.add("is-on");
      pulse.classList.add("is-on");
      const frame = (t) => {
        if (token !== gen) return reject(new Error("cancelled"));
        const k = Math.min(1, (t - start) / ms);
        const len = edge.len || edge.path.getTotalLength();
        const at = len * ease(k);
        const p = edge.path.getPointAtLength(at);
        pulse.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
        // a short comet that trails the pulse
        const tail = Math.min(at, COMET);
        edge.lit.style.strokeDasharray = `0 ${(at - tail).toFixed(2)} ${tail.toFixed(2)} ${len + COMET}`;
        if (k < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          pulse.classList.remove("is-on");
          edge.lit.classList.remove("is-on");
          edge.path.classList.remove("is-active");
          resolve();
        }
      };
      raf = requestAnimationFrame(frame);
    });

  const fill = (row, sel, html, cls) => {
    const cell = $(sel, row);
    if (!cell) return;
    cell.innerHTML = html;
    if (cls) cell.className = cls;
    cell.firstElementChild?.classList.add("is-pop");
    if (!cell.firstElementChild) {
      cell.classList.remove("is-pop");
      void cell.offsetWidth;
      cell.classList.add("is-pop");
    }
  };

  const STATUS = {
    running: '<span class="platform__status platform__status--running"><span class="platform__status-mark"></span><span class="platform__status-label">Running</span></span>',
    ok: '<span class="platform__status platform__status--ok"><span class="platform__status-mark"></span><span class="platform__status-label">Succeeded</span></span>',
  };

  function addRow(ticket) {
    const row = template.cloneNode(true);
    const id = `run_${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
    $(".platform__run-id", row).textContent = id;
    const tCell = $(".platform__run-ticket", row);
    tCell.innerHTML = '<span class="platform__run-num"></span>';
    tCell.firstChild.textContent = `#${ticketNo++}`;
    tCell.append(` ${ticket[0]}`);
    $(".platform__run-cat", row).innerHTML = '<span class="platform__skel"></span>';
    const route = $(".platform__run-route", row);
    route.className = "platform__run-route";
    route.innerHTML = '<span class="platform__skel"></span>';
    $(".platform__run-status", row).innerHTML = STATUS.running;
    $(".platform__run-dur", row).textContent = "—";
    $(".platform__run-time", row).textContent = "Just now";
    row.dataset.t = String(performance.now());
    row.classList.add("is-new");

    // Slide the list down by one row; the oldest row exits under the edge.
    list.prepend(row);
    const h = row.offsetHeight;
    list.style.transition = "none";
    list.style.transform = `translateY(${-h}px)`;
    void list.offsetHeight;
    list.style.transition = "";
    list.style.transform = "";
    const id2 = setTimeout(() => {
      while (list.children.length > ROWS) list.lastElementChild.remove();
      hotTimers.delete(id2);
    }, 760);
    hotTimers.add(id2);
    return row;
  }

  function finish(state) {
    if (!state || state.done) return;
    state.done = true;
    const { row, ticket, started } = state;
    const secs = Math.max(0.8, (performance.now() - started) / 1000);
    if ($(".platform__skel", $(".platform__run-cat", row))) fill(row, ".platform__run-cat", `<span class="platform__cat">${ticket[1]}</span>`);
    if ($(".platform__skel", $(".platform__run-route", row))) routeFill(row, ticket);
    fill(row, ".platform__run-status", STATUS.ok);
    const dur = $(".platform__run-dur", row);
    dur.textContent = `${secs.toFixed(1)}s`;
    week += 1;
    usage += 5;
    for (const w of weekEls) w.textContent = formatNumber(week);
    if (usageEl) usageEl.textContent = formatNumber(usage);
    usageBar?.style.setProperty("--p", (usage / 25000).toFixed(4));
    if (usagePct) usagePct.textContent = `${Math.round((usage / 25000) * 100)}%`;
  }

  function routeFill(row, ticket) {
    fill(
      row,
      ".platform__run-route",
      ticket[2] ? "Paged on-call" : "Drafted reply",
      ticket[2] ? "platform__run-route platform__run-route--urgent" : "platform__run-route"
    );
  }

  async function cycle() {
    const token = gen;
    const ticket = TICKETS[ticketIdx++ % TICKETS.length];
    const row = addRow(ticket);
    const state = (current = { row, ticket, started: performance.now(), done: false });
    const branch = ticket[2] ? "yes" : "no";
    const route = ["trigger", "ai", "cond", branch, "log"];
    try {
      flash("trigger");
      await wait(180, token);
      for (let i = 0; i < route.length - 1; i++) {
        await travel(wires.edge(route[i], route[i + 1]), rand(360, 460), token);
        flash(route[i + 1]);
        if (route[i + 1] === "ai") {
          await wait(rand(220, 420), token); // the model takes a beat
          fill(row, ".platform__run-cat", `<span class="platform__cat">${ticket[1]}</span>`);
        } else if (route[i + 1] === branch) {
          await wait(140, token);
          routeFill(row, ticket);
        } else {
          await wait(100, token);
        }
      }
      finish(state);
      nextTimer = setTimeout(() => token === gen && cycle(), rand(600, 850));
    } catch {
      /* cancelled by stop() */
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      gen += 1;
      anchor();
      tickClock();
      clockTimer = setInterval(tickClock, 1000);
      nextTimer = setTimeout(cycle, 700);
    },
    stop() {
      if (!running) return;
      running = false;
      gen += 1;
      clearInterval(clockTimer);
      clearTimeout(nextTimer);
      cancelAnimationFrame(raf);
      for (const id of hotTimers) clearTimeout(id);
      hotTimers.clear();
      while (list.children.length > ROWS) list.lastElementChild.remove();
      list.style.transform = "";
      wires.pulse.classList.remove("is-on");
      for (const n of Object.values(wires.nodes)) n.classList.remove("is-hot");
      $$(".platform__wire-lit.is-on, .platform__wire.is-active", root).forEach((p) => p.classList.remove("is-on", "is-active"));
      finish(current); // never leave a run spinning
    },
  };
}

export default function init(root) {
  if (root.dataset.platformReady) return;
  root.dataset.platformReady = "true";

  const flow = $("[data-flow]", root);
  const svg = $("[data-wires]", root);
  const app = $("[data-platform-app]", root);
  if (!flow || !svg || !app) return;

  const wires = createWires(flow, svg);
  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      wires.draw();
    });
  };
  wires.draw();
  if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(flow);
  else window.addEventListener("resize", redraw, { passive: true });
  document.fonts?.ready.then(redraw);

  const demo = createDemo(root, wires);
  if (!demo || !("IntersectionObserver" in window)) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let inView = false;
  const sync = () => {
    if (inView && !document.hidden && !reducedMotion()) demo.start();
    else demo.stop();
  };
  // Run only while at least a fifth of the window is on screen. (isIntersecting
  // alone stays true down to the last visible pixel, even when the 0.2
  // threshold is crossed on the way out.)
  new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      inView = e.isIntersecting && e.intersectionRatio >= 0.2;
      sync();
    },
    { threshold: [0, 0.2] }
  ).observe(app);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener?.("change", sync);
}
