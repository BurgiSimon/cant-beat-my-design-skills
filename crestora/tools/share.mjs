#!/usr/bin/env node
/**
 * Renders Crestora's pictures from a fresh build, each drawn as it rests (?still&reduced):
 *   assets/img/og.jpg      1200 × 630, the home page's first screen (the lanes, the headline) as a link preview shows it
 *   assets/img/poster.jpg  the footer's night alone (no type), 1996 × 1231: what shows there where there is no WebGL
 *
 *   node crestora/tools/share.mjs
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
const IMG = path.join(ROOT, "crestora", "assets", "img");
const { chromium } = createRequire(import.meta.url)("playwright");

const out = await fs.mkdtemp(path.join(os.tmpdir(), "crestora-share-"));
execFileSync(process.execPath, [path.join(ROOT, "build.mjs"), "--out", out], { stdio: "inherit" });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  let file = path.join(out, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  try { res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await fs.readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/crestora/?still&reduced`;

// The footer on its own: everything above it taken out before the first paint, so the night is laid out (and drawn)
// exactly as it would be alone on the screen (picker/tools/stills.mjs does the same for the picker's card).
const FOOTER_ONLY = "body > :not(.footer), .footer::before { display: none !important; }";

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const shoot = async (file, viewport, deviceScaleFactor, { css = "", ready }) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  if (css) await page.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); }), css);
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(ready, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(IMG, file), type: "jpeg", quality: 82 });
  await page.close();
  console.log(`  crestora/assets/img/${file}`);
};
// the hero, once its lanes are drawn (or its poster has stood in for them)
await shoot("og.jpg", { width: 1600, height: 840 }, 0.75, { ready: () => document.querySelector("#top.is-lit, #top.no-gl") });
await shoot("poster.jpg", { width: 1597, height: 985 }, 1.25, {
  css: `${FOOTER_ONLY} .stage > :not(.road), .hint { visibility: hidden !important; }`,
  ready: () => document.documentElement.classList.contains("is-drawn"),
});
await browser.close();
server.close();
await fs.rm(out, { recursive: true, force: true });
