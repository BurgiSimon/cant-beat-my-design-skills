#!/usr/bin/env node
/**
 * Renders Vizen's pictures from the site itself, under reduced motion:
 *   assets/img/rider.jpg  1440 × 960, the rider alone as the hero's WebGL draws him: the page shows it until the
 *                         shader has compiled (and keeps it where there is no WebGL, or no script)
 *   assets/img/og.jpg     1200 × 630, the hero as it rests, for link previews
 *
 *   node vizen/tools/share.mjs
 *
 * Needs Playwright with Chromium (software WebGL is fine, only slow); the site itself does not. Not published
 * (build.mjs leaves tools/ behind).
 */
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IMG = path.join(ROOT, "vizen", "assets", "img");
const { chromium } = createRequire(import.meta.url)("playwright");

const out = await fs.mkdtemp(path.join(os.tmpdir(), "vizen-share-"));
execFileSync(process.execPath, [path.join(ROOT, "build.mjs"), "--out", out], { stdio: "inherit" });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  let file = path.join(out, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  let body;
  try { body = await fs.readFile(file); } catch { res.writeHead(404).end(); return; }   // (the poster, before it exists)
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/vizen/`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const shoot = async (viewport, file, css) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("has-gl"), null, { timeout: 180000 });
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(4000);   // the stills and a full-quality frame
  await page.screenshot({ path: path.join(IMG, file), type: "jpeg", quality: file === "rider.jpg" ? 84 : 82 });
  console.log(`  vizen/assets/img/${file}`);
  await page.close();
};
await shoot({ width: 1440, height: 960 }, "rider.jpg", ".nav, main, footer, .cursor { visibility: hidden !important; }");
await shoot({ width: 1200, height: 630 }, "og.jpg");
await browser.close();
server.close();
await fs.rm(out, { recursive: true, force: true });
