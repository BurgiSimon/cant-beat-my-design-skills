#!/usr/bin/env node
/**
 * Photographs a Crestora page from the dev server (node build.mjs --serve 4321) and reports what's wrong with it:
 * console errors, page errors, failed requests, and anything wider than the screen.
 *
 *   node crestora/tools/shot.mjs <page> [options]
 *     <page>          e.g. pricing.html, blog/leave-the-light-on.html, index.html
 *     --w 1440 --h 900 --dpr 1     viewport (default 1440 × 900 @1)
 *     --full                       the whole page (scrolled through first, so every reveal has played)
 *     --el "#features"             just this element (scrolled to)
 *     --reduced                    with prefers-reduced-motion
 *     --wait 1200                  ms to wait after arriving (default 1200)
 *     --out shot.png               where to write (default /tmp/crestora-shot.png)
 *
 * Software WebGL is slow: pages with canvases take a few seconds. Needs Playwright (preinstalled here).
 */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const page = argv.find((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--")) || "index.html";
const W = +opt("w", 1440), H = +opt("h", 900), DPR = +opt("dpr", 1), WAIT = +opt("wait", 1200);
const out = opt("out", "/tmp/crestora-shot.png");
const el = opt("el", null);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, reducedMotion: flag("reduced") ? "reduce" : "no-preference", hasTouch: W < 800, isMobile: W < 800 });
const p = await ctx.newPage();
const problems = [];
p.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 400)}`); });
p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
p.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
p.on("requestfailed", (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText || ""}`));

await p.goto(`http://localhost:4321/crestora/${page}`, { waitUntil: "load" });
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
  if (handle) await handle.screenshot({ path: out }); else problems.push(`no element ${el}`);
} else {
  await p.screenshot({ path: out, fullPage: flag("full") });
}
console.log(`${out}  (${page} @ ${W}×${H}${flag("reduced") ? ", reduced" : ""}, page height ${height}px)`);
console.log(problems.length ? problems.map((x) => `  ✗ ${x}`).join("\n") : "  ✓ no errors, no overflow");
await browser.close();
