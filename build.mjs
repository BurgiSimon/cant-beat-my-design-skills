#!/usr/bin/env node
/**
 * Mist — zero-dependency static site build.
 *
 *   node build.mjs                  build ./src into ./dist
 *   node build.mjs --out <dir>      build into another directory
 *   node build.mjs --serve [port]   build, serve on http://localhost:<port> (default 4321),
 *                                   rebuild on change and live-reload the browser
 *
 * Pages live in src/pages/*.html and may include partials from src/partials with
 *   <!-- @include sections/pricing.html -->
 * CSS files in src/css are concatenated in filename order into css/styles.css.
 * src/js, src/assets and src/static are copied as-is (src/static → site root).
 *
 * Tokens replaced in pages and static text files:
 *   {{SITE_URL}}  absolute site URL without trailing slash  (env SITE_URL)
 *   {{BASE}}      URL path the site is served under, with trailing slash (env BASE_PATH)
 *   {{VERSION}}   content hash of CSS + JS, for cache-busting
 *   {{YEAR}}      current year
 */
import { promises as fs, watch } from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const SERVE = flag("--serve");
const PORT = Number(option("--serve", process.env.PORT || 4321));
const OUT = path.resolve(ROOT, option("--out", "dist"));

const basePath = (process.env.BASE_PATH || "").replace(/\/+$/, "");
const BASE = `${basePath.startsWith("/") || basePath === "" ? "" : "/"}${basePath}/`;
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

const INCLUDE_RE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const TEXT_EXT = new Set([".html", ".txt", ".xml", ".webmanifest", ".json", ".svg"]);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  if (!(await exists(dir))) return [];
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (!entry.name.startsWith(".")) out.push(full);
  }
  return out.sort();
}

async function copyDir(from, to, transform) {
  for (const file of await listFiles(from)) {
    const dest = path.join(to, path.relative(from, file));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (transform && TEXT_EXT.has(path.extname(file))) {
      await fs.writeFile(dest, transform(await fs.readFile(file, "utf8")));
    } else {
      await fs.copyFile(file, dest);
    }
  }
}

const warnings = [];

async function resolveIncludes(html, stack) {
  const parts = [];
  let last = 0;
  for (const match of html.matchAll(INCLUDE_RE)) {
    parts.push(html.slice(last, match.index));
    last = match.index + match[0].length;
    const rel = match[1];
    const file = path.join(SRC, "partials", rel);
    if (stack.includes(file)) throw new Error(`Include cycle: ${[...stack, file].join(" → ")}`);
    if (!(await exists(file))) {
      warnings.push(`missing partial: ${rel}`);
      parts.push(`<!-- missing partial: ${rel} -->`);
      continue;
    }
    const content = await fs.readFile(file, "utf8");
    parts.push(await resolveIncludes(content.trimEnd(), [...stack, file]));
  }
  parts.push(html.slice(last));
  return parts.join("");
}

function replaceTokens(text, tokens) {
  return text.replace(/\{\{(SITE_URL|BASE|VERSION|YEAR)\}\}/g, (_, key) => tokens[key]);
}

const LIVE_RELOAD = `<script>(()=>{const s=new EventSource("/__livereload");s.onmessage=()=>location.reload();})();</script>`;

async function build() {
  const started = Date.now();
  warnings.length = 0;
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  // CSS bundle
  const cssFiles = (await listFiles(path.join(SRC, "css"))).filter((f) => f.endsWith(".css"));
  const cssChunks = await Promise.all(
    cssFiles.map(async (f) => `/* ── ${path.basename(f)} ── */\n${(await fs.readFile(f, "utf8")).trim()}\n`)
  );
  const css = `/*! Mist — built ${new Date().toISOString().slice(0, 10)} */\n${cssChunks.join("\n")}`;
  await fs.mkdir(path.join(OUT, "css"), { recursive: true });
  await fs.writeFile(path.join(OUT, "css", "styles.css"), css);

  // JS, assets, static
  const jsFiles = await listFiles(path.join(SRC, "js"));
  const jsSource = (await Promise.all(jsFiles.map((f) => fs.readFile(f, "utf8")))).join("\n");
  const VERSION = crypto.createHash("sha256").update(css + jsSource).digest("hex").slice(0, 10);
  const tokens = { SITE_URL, BASE, VERSION, YEAR: String(new Date().getFullYear()) };

  await copyDir(path.join(SRC, "js"), path.join(OUT, "js"));
  await copyDir(path.join(SRC, "assets"), path.join(OUT, "assets"));
  await copyDir(path.join(SRC, "static"), OUT, (text) => replaceTokens(text, tokens));

  // Pages
  const pages = (await listFiles(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));
  for (const page of pages) {
    let html = await resolveIncludes(await fs.readFile(page, "utf8"), [page]);
    html = replaceTokens(html, tokens);
    if (SERVE) html = html.replace("</body>", `${LIVE_RELOAD}\n</body>`);
    await fs.writeFile(path.join(OUT, path.basename(page)), html);
  }

  // Sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages
    .map((p) => path.basename(p))
    .filter((name) => name !== "404.html")
    .map((name) => (name === "index.html" ? `${SITE_URL}/` : `${SITE_URL}/${name}`));
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;
  await fs.writeFile(path.join(OUT, "sitemap.xml"), sitemap);
  await fs.writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  console.log(`✓ built ${pages.length} pages → ${path.relative(ROOT, OUT) || OUT} in ${Date.now() - started}ms`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function serve() {
  const clients = new Set();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__livereload") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    let file = path.join(OUT, decodeURIComponent(url.pathname));
    if (!file.startsWith(OUT)) return res.writeHead(403).end();
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    let status = 200;
    if (!(await exists(file))) {
      status = 404;
      file = path.join(OUT, "404.html");
    }
    res.writeHead(status, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await fs.readFile(file));
  });
  server.listen(PORT, () => console.log(`→ serving ${path.relative(ROOT, OUT)} on http://localhost:${PORT}`));

  let timer;
  watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await build();
        for (const c of clients) c.write("data: reload\n\n");
      } catch (err) {
        console.error(err);
      }
    }, 120);
  });
}

await build();
if (SERVE) serve();
