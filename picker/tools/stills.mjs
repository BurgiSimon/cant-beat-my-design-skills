#!/usr/bin/env node
/**
 * Renders the picker's pictures into picker/assets:
 *   stills/<site>-wide.jpg  1600×1000, for a screen held sideways
 *   stills/<site>-tall.jpg   900×1600, for a screen held upright
 *   og.jpg                  1200×630, the picker itself, for link previews
 *
 *   node picker/tools/stills.mjs                 every site's stills, then og.jpg
 *   node picker/tools/stills.mjs unorouter       only the named sites' stills (then og.jpg)
 *
 * A still is the site's hero art with no type on it: the card sets its own name over it. Mist's is its own hero,
 * built and photographed with the header and the copy hidden; Nelson's is cut from its hero picture around the eye;
 * AsterPay's is its hero's light, rings and phones, the tall one cut from a wide render around the phones; UnoRouter's
 * is its mark of coloured cells on the dot grid, in the shot's own colours.
 * Needs Playwright with Chromium (npm i -g playwright && npx playwright install chromium); the site itself does not.
 */
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = path.join(ROOT, "picker", "assets");
const { chromium } = createRequire(import.meta.url)("playwright");

const WIDE = { width: 1600, height: 1000 };
const TALL = { width: 900, height: 1600 };
const QUALITY = 80;

// A fresh build, served over http (fonts and module scripts do not load from file://).
const out = await fs.mkdtemp(path.join(os.tmpdir(), "picker-stills-"));
execFileSync(process.execPath, [path.join(ROOT, "build.mjs"), "--out", out], { stdio: "inherit" });
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const ONLY = new Set(process.argv.slice(2)); // site names to render; none means all
const server = http.createServer(async (req, res) => {
  let file = path.join(out, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (file.endsWith(path.sep)) file = path.join(file, "index.html");
  try {
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await fs.readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const site = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const shoot = async (viewport, file, go) => {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  const clip = await go(page, viewport); // a site may photograph a larger page and say which part to keep
  await page.screenshot({ path: path.join(ASSETS, file), type: "jpeg", quality: QUALITY, ...(clip && { clip }) });
  await page.close();
  console.log(`  ${file}`);
};

// Mist: its hero as the page opens, with the header and the copy taken off it.
const mist = async (page) => {
  await page.goto(`${site}/mist/`, { waitUntil: "load" });
  await page.addStyleTag({ content: ".skip-link, .site-header, .hero__content { visibility: hidden !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.closest(".hero")).map((i) => i.decode())));
};

// Nelson: its hero picture, cut around the eye in the torn paper.
const hero = `data:image/jpeg;base64,${(await fs.readFile(path.join(ROOT, "nelson-crm", "assets", "hero.jpg"))).toString("base64")}`;
const nelson = async (page) => {
  await page.setContent(`<body style="margin:0;height:100vh;background:url(${hero}) 49% 50% / cover no-repeat"></body>`);
  await page.evaluate(() => new Promise((ok) => { const i = new Image(); i.onload = ok; i.src = getComputedStyle(document.body).backgroundImage.slice(5, -2); }));
};

// AsterPay: its hero (the light is WebGL, drawn once under reduced motion) with the header, the copy and the floating
// figures taken off. Held upright, the composition is wider than it is tall, so the tall still is cut from a wide
// render, around the phones.
const asterpay = async (page, viewport) => {
  const tall = viewport.height > viewport.width;
  if (tall) await page.setViewportSize({ width: 2560, height: 1600 });
  await page.goto(`${site}/asterpay/`, { waitUntil: "load" });
  // the phones sit a little lower than on the page, so the card's name falls on their frames, not their figures
  await page.addStyleTag({ content: ".skip, .nav, .hero__content, .ticks, .tape { visibility: hidden !important; } .phones { transform: translateY(15%); }" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  return tall ? { x: 1280 - 450, y: 0, width: 900, height: 1600 } : undefined;
};

// UnoRouter: its hero's art alone, centred and larger, on the dot grid (under reduced motion it is the shot's frame).
const unorouter = async (page, viewport) => {
  const tall = viewport.height > viewport.width;
  await page.goto(`${site}/unorouter/`, { waitUntil: "load" });
  await page.addStyleTag({ content: `.skip, .nav, .hero__copy, .art__hint { display: none !important; }
    .hero { min-height: 100vh !important; padding: 0 !important; } .hero__inner { grid-template-columns: 1fr !important; }
    .hero__art { justify-self: center !important; margin: ${tall ? "-22vh" : "-8vh"} 0 0 !important; width: ${tall ? "74vw" : "42vw"} !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
};

await fs.mkdir(path.join(ASSETS, "stills"), { recursive: true });
console.log("stills:");
for (const [name, go] of Object.entries({ mist, nelson, asterpay, unorouter })) {
  if (ONLY.size && !ONLY.has(name)) continue;
  await shoot(WIDE, `stills/${name}-wide.jpg`, go);
  await shoot(TALL, `stills/${name}-tall.jpg`, go);
}

// The picker, now with its stills, as a link preview shows it.
await fs.cp(path.join(ASSETS, "stills"), path.join(out, "assets", "stills"), { recursive: true });
await shoot({ width: 1200, height: 630 }, "og.jpg", async (page) => {
  await page.goto(`${site}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
});

await browser.close();
server.close();
await fs.rm(out, { recursive: true, force: true });
