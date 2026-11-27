#!/usr/bin/env node
/**
 * Renders OQURO's share image, assets/img/og.jpg (1200 × 630): its hero as it rests, under reduced motion (the 3D
 * garden drawn once).
 *
 *   node oquro/tools/share.mjs
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

const out = await fs.mkdtemp(path.join(os.tmpdir(), "oquro-share-"));
execFileSync(process.execPath, [path.join(ROOT, "build.mjs"), "--out", out], { stdio: "inherit" });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  let file = path.join(out, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  try { res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await fs.readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await page.goto(`http://127.0.0.1:${server.address().port}/oquro/`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => document.querySelector(".hero")?.classList.contains("has-gl"), null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(ROOT, "oquro", "assets", "img", "og.jpg"), type: "jpeg", quality: 82 });
console.log("  oquro/assets/img/og.jpg");
await browser.close();
server.close();
await fs.rm(out, { recursive: true, force: true });
