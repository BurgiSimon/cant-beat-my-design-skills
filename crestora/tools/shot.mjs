#!/usr/bin/env node
/**
 * Photographs a Crestora page and reports what's wrong with it: console errors, page errors, failed requests, and
 * anything wider than the screen. It serves crestora/ itself (on a free port), so it never races a rebuild; run
 * node crestora/tools/pages.mjs first so the page is assembled.
 *
 *   node crestora/tools/shot.mjs <page> [options]
 *     <page>          e.g. pricing.html, blog/leave-the-light-on.html, index.html
 *     --w 1440 --h 900 --dpr 1     viewport (default 1440 × 900 @1)
 *     --full                       the whole page (scrolled through first, so every reveal has played)
 *     --el "#features"             just this element (scrolled to; the fixed header and skip link are hidden)
 *     --reduced                    with prefers-reduced-motion
 *     --nojs                       with scripts off (the page's no-JS fallback)
 *     --wait 1200                  ms to wait after arriving (default 1200)
 *     --out shot.png               where to write (default /tmp/crestora-shot.png)
 *
 * Software WebGL is slow: pages with canvases take a few seconds. Needs Playwright (preinstalled here).
 */
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".ics": "text/calendar", ".xml": "application/xml" };
const server = http.createServer(async (req, res) => {
  let file = path.join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(SITE)) return res.writeHead(403).end();
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  try {
    let body = await fs.readFile(file);
    if (file.endsWith(".html")) body = Buffer.from(body.toString().replace(/\{\{SITE_URL\}\}/g, `http://127.0.0.1:${server.address().port}`).replace(/\{\{VERSION\}\}/g, "dev"));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const page = argv.find((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--")) || "index.html";
const W = +opt("w", 1440), H = +opt("h", 900), DPR = +opt("dpr", 1), WAIT = +opt("wait", 1200);
const out = opt("out", "/tmp/crestora-shot.png");
const el = opt("el", null);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, reducedMotion: flag("reduced") ? "reduce" : "no-preference", hasTouch: W < 800, isMobile: W < 800, javaScriptEnabled: !flag("nojs") });
const p = await ctx.newPage();
const problems = [];
p.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 400)}`); });
p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
p.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
p.on("requestfailed", (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText || ""}`));

await p.goto(`${ORIGIN}/${page}`, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);

// scroll through, so ScrollTrigger reveals and lazy modules run, then settle where asked
const height = await p.evaluate(() => document.documentElement.scrollHeight);
if (flag("full") || el) {
  for (let y = 0; y < height; y += Math.round(H * 0.7)) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(140); }
  await p.waitForTimeout(500);
}
if (el) {
  await p.evaluate((s) => { const t = document.querySelector(s); if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 80); }, el);
} else if (flag("full")) {
  await p.evaluate(() => window.scrollTo(0, 0));
}
await p.waitForTimeout(WAIT);

// anything wider than the screen
const overflow = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  if (document.documentElement.scrollWidth > vw + 1) {
    for (const n of document.querySelectorAll("body *")) {
      const r = n.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(n).position !== "fixed") {
        if (!n.closest("[data-marquee], .footer .road, .footer .scene")) wide.push(`${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}.${[...n.classList].join(".")} (${Math.round(r.left)}→${Math.round(r.right)})`);
      }
    }
  }
  return { scrollWidth: document.documentElement.scrollWidth, vw, wide: wide.slice(0, 12) };
});
if (overflow.scrollWidth > overflow.vw + 1) problems.push(`horizontal overflow: page is ${overflow.scrollWidth}px on a ${overflow.vw}px screen; widest: ${overflow.wide.join(", ")}`);

if (el) {
  const handle = await p.$(el);
  if (handle) {
    // an element taller than the screen is captured in strips: the fixed header and skip link would be painted over
    // its middle, so they step out of the picture
    await p.addStyleTag({ content: ".header, .skip { visibility: hidden !important; }" });
    await handle.screenshot({ path: out });
  } else problems.push(`no element ${el}`);
} else {
  await p.screenshot({ path: out, fullPage: flag("full") });
}
console.log(`${out}  (${page} @ ${W}×${H}${flag("reduced") ? ", reduced" : ""}${flag("nojs") ? ", no JS" : ""}, page height ${height}px)`);
console.log(problems.length ? problems.map((x) => `  ✗ ${x}`).join("\n") : "  ✓ no errors, no overflow");
await browser.close();
server.close();
