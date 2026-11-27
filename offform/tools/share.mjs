#!/usr/bin/env node
/**
 * Renders OFFFORM's share image, assets/img/og.jpg (1200 × 630): the hero, set again for a link preview's frame (both
 * photographs over the rule, the ring, the collection number, and the headline on one line under them).
 *
 *   node offform/tools/share.mjs
 *
 * Needs Playwright with Chromium; the site itself does not. Not published (build.mjs leaves tools/ behind).
 */
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(import.meta.url)("playwright");

const out = await fs.mkdtemp(path.join(os.tmpdir(), "offform-share-"));
execFileSync(process.execPath, [path.join(ROOT, "build.mjs"), "--out", out], { stdio: "inherit" });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  let file = path.join(out, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  try { res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await fs.readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await page.goto(`http://127.0.0.1:${server.address().port}/offform/?reduced`, { waitUntil: "load" });
await page.evaluate(() => {
  document.body.innerHTML = `
  <div class="og">
    <img class="og__a" src="assets/img/hero-sprint.webp" alt="" />
    <img class="og__b" src="assets/img/hero-stand.webp" alt="" />
    <i class="og__fade"></i>
    <svg class="og__ring" viewBox="0 0 1200 630"><circle cx="600" cy="400" r="430" /><path d="M600 0V630M40 400H1160" /></svg>
    <p class="og__tag label">Offform research dept.</p>
    <p class="og__tag og__tag--r label">Collection 06 — Autumn / Winter 2026</p>
    <p class="og__num">(OF)— 06</p>
    <p class="og__meta label">Performance / Lifestyle / No fixed form</p>
    <h1 class="og__title">Not made to stand still.</h1>
    <p class="og__logo">OFFFORM</p>
  </div>`;
  const css = document.createElement("style");
  css.textContent = `
    html, body { margin: 0; overflow: hidden; background: #fe4b1f; }
    .og { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #fff; background: #fe4b1f; }
    .og img { position: absolute; top: 0; height: 430px; width: 600px; object-fit: cover; }
    .og__a { left: 0; object-position: 50% 30%; } .og__b { left: 600px; object-position: 50% 15%; }
    .og__fade { position: absolute; left: 0; right: 0; top: 300px; height: 130px; background: linear-gradient(rgb(254 75 31 / 0), #fe4b1f 90%); }
    .og__ring { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: rgb(255 226 210 / 0.55); stroke-width: 1; }
    .og .label { position: absolute; margin: 0; top: 26px; left: 40px; font: 400 11px/1.5 "JetBrains Mono"; letter-spacing: 0.05em; text-transform: uppercase; }
    .og__tag--r { left: auto !important; right: 40px; }
    .og__num { position: absolute; right: 40px; top: 228px; margin: 0; font: 200 150px/1 "Barlow Condensed"; letter-spacing: -0.012em; }
    .og__meta { top: 416px !important; }
    .og__title { position: absolute; left: 36px; bottom: 34px; margin: 0; font: 600 120px/0.82 "Barlow Condensed"; letter-spacing: -0.012em; text-transform: uppercase; white-space: nowrap; }
    .og__logo { position: absolute; right: 40px; top: 412px; margin: 0; font: 700 26px/1 "Barlow Condensed"; letter-spacing: -0.01em; }
  `;
  document.head.append(css);
  return Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]);
});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(ROOT, "offform", "assets", "img", "og.jpg"), type: "jpeg", quality: 84 });
console.log("  offform/assets/img/og.jpg");
await browser.close();
server.close();
await fs.rm(out, { recursive: true, force: true });
