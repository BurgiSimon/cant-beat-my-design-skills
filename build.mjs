#!/usr/bin/env node
/**
 * Zero-dependency static build for every site in this repo.
 *
 *   node build.mjs                  build into ./dist
 *   node build.mjs --out <dir>      build into another directory
 *   node build.mjs --serve [port]   build, serve on http://localhost:<port> (default 4321),
 *                                   rebuild on change and live-reload the browser
 *
 * What goes where:
 *   picker/      →  /             the picker: one card per site (picker/tools stays behind)
 *   src/         →  /mist/        the Mist site (its 404.html goes to the root: Pages has one per site)
 *   nelson-crm/  →  /nelson-crm/  the prebuilt Nelson CRM project, runtime files only
 *   asterpay/    →  /asterpay/    the AsterPay project, as written (no build step; its README and tools stay behind)
 *   vizen/       →  /vizen/       the Vizen project, the same way
 *   unorouter/   →  /unorouter/   the UnoRouter project, the same way
 *   offform/     →  /offform/     the OFFFORM project, the same way (its CREDITS stay behind too)
 * Mist used to live at the root, so each of its old page URLs gets a small redirect into /mist/.
 *
 * Mist pages live in src/pages/*.html and may include partials from src/partials with
 *   <!-- @include sections/pricing.html -->
 * CSS files in src/css are concatenated in filename order into css/styles.css.
 * src/js, src/assets and src/static are copied as-is (src/static → the root of Mist).
 *
 * Tokens replaced in pages and static text files:
 *   {{SITE_URL}}  absolute URL of the page's own site, without trailing slash (env SITE_URL, + /mist for Mist,
 *                 + /asterpay for AsterPay, + /vizen for Vizen, + /unorouter for UnoRouter, + /offform for OFFFORM)
 *   {{BASE}}      URL path that site is served under, with trailing slash (env BASE_PATH, + mist/ for Mist)
 *   {{VERSION}}   content hash of that site's CSS + JS, for cache-busting
 *   {{YEAR}}      current year
 */
import { promises as fs, watch } from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const PICKER = path.join(ROOT, "picker");
const PICKER_PRIVATE = new Set(["tools"]); // kept in the repo, not published
const MIST = "mist"; // the folder Mist is published under
const NELSON = path.join(ROOT, "nelson-crm");
const NELSON_PUBLIC = ["index.html", "recreation.html", "assets", "fonts", "vendor"];
const ASTERPAY = path.join(ROOT, "asterpay");
const ASTERPAY_PRIVATE = new Set(["README.md", "tools"]); // kept in the repo, not published
const VIZEN = path.join(ROOT, "vizen");
const VIZEN_PRIVATE = new Set(["README.md", "tools"]); // kept in the repo, not published
const UNOROUTER = path.join(ROOT, "unorouter");
const UNOROUTER_PRIVATE = new Set(["README.md", "tools"]); // kept in the repo, not published
const OFFFORM = path.join(ROOT, "offform");
const OFFFORM_PRIVATE = new Set(["README.md", "CREDITS.md", "tools"]); // kept in the repo, not published
// Sites with no build step, published as written under /<name>/ (their README and tools stay behind).
const PLAIN_SITES = [
  { dir: ASTERPAY, name: "asterpay", private: ASTERPAY_PRIVATE },
  { dir: VIZEN, name: "vizen", private: VIZEN_PRIVATE },
  { dir: UNOROUTER, name: "unorouter", private: UNOROUTER_PRIVATE },
  { dir: OFFFORM, name: "offform", private: OFFFORM_PRIVATE },
];

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

/** Conservative CSS minify: drop comments (keeps /*! banners) and indentation/blank lines.
 *  String contents are left untouched; whitespace inside values is never collapsed. */
function minifyCss(input) {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' || c === "'") {
      const start = i;
      for (i++; i < input.length && input[i] !== c; i++) if (input[i] === "\\") i++;
      out += input.slice(start, i + 1);
    } else if (c === "/" && input[i + 1] === "*") {
      const end = input.indexOf("*/", i + 2);
      const stop = end === -1 ? input.length : end + 2;
      if (input[i + 2] === "!") out += input.slice(i, stop);
      i = stop - 1;
    } else out += c;
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function replaceTokens(text, tokens) {
  return text.replace(/\{\{(SITE_URL|BASE|VERSION|YEAR)\}\}/g, (_, key) => tokens[key]);
}

const LIVE_RELOAD = `<script>(()=>{const s=new EventSource("/__livereload");s.onmessage=()=>location.reload();})();</script>`;

const hashOf = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 10);
const withLiveReload = (html) => (SERVE ? html.replace("</body>", `${LIVE_RELOAD}\n</body>`) : html);

async function build() {
  const started = Date.now();
  warnings.length = 0;
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  const YEAR = String(new Date().getFullYear());

  // ── The picker, at the root ──
  const pickerFiles = (await listFiles(PICKER)).filter((f) => !PICKER_PRIVATE.has(path.relative(PICKER, f).split(path.sep)[0]));
  const pickerCode = (
    await Promise.all(pickerFiles.filter((f) => /\.(css|js)$/.test(f)).map((f) => fs.readFile(f, "utf8")))
  ).join("\n");
  const pickerTokens = { SITE_URL, BASE, VERSION: hashOf(pickerCode), YEAR };
  for (const file of pickerFiles) {
    const dest = path.join(OUT, path.relative(PICKER, file));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (file.endsWith(".html")) await fs.writeFile(dest, withLiveReload(replaceTokens(await fs.readFile(file, "utf8"), pickerTokens)));
    else await fs.copyFile(file, dest);
  }

  // ── Mist, under /mist/ ──
  const MIST_OUT = path.join(OUT, MIST);
  const MIST_URL = `${SITE_URL}/${MIST}`;

  // CSS bundle
  const cssFiles = (await listFiles(path.join(SRC, "css"))).filter((f) => f.endsWith(".css"));
  const cssChunks = await Promise.all(
    cssFiles.map(async (f) => `/* ── ${path.basename(f)} ── */\n${(await fs.readFile(f, "utf8")).trim()}\n`)
  );
  const bundle = `/*! Mist — built ${new Date().toISOString().slice(0, 10)} */\n${cssChunks.join("\n")}`;
  const css = SERVE ? bundle : minifyCss(bundle);
  await fs.mkdir(path.join(MIST_OUT, "css"), { recursive: true });
  await fs.writeFile(path.join(MIST_OUT, "css", "styles.css"), css);

  // JS, assets, static
  const jsFiles = await listFiles(path.join(SRC, "js"));
  const jsSource = (await Promise.all(jsFiles.map((f) => fs.readFile(f, "utf8")))).join("\n");
  const tokens = { SITE_URL: MIST_URL, BASE: `${BASE}${MIST}/`, VERSION: hashOf(css + jsSource), YEAR };

  await copyDir(path.join(SRC, "js"), path.join(MIST_OUT, "js"));
  await copyDir(path.join(SRC, "assets"), path.join(MIST_OUT, "assets"));
  await copyDir(path.join(SRC, "static"), MIST_OUT, (text) => replaceTokens(text, tokens));

  // Pages. The 404 page answers for the whole site, so it goes to the root; its <base> points it back into Mist.
  const pages = (await listFiles(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));
  for (const page of pages) {
    const name = path.basename(page);
    const html = replaceTokens(await resolveIncludes(await fs.readFile(page, "utf8"), [page]), tokens);
    await fs.writeFile(path.join(name === "404.html" ? OUT : MIST_OUT, name), withLiveReload(html));
  }

  // Mist's old URLs at the root (the root is the picker now) move on to the same page in /mist/, query and hash
  // included (signup.html?plan=team).
  for (const name of pages.map((p) => path.basename(p)).filter((n) => n !== "index.html" && n !== "404.html")) {
    const to = `${MIST}/${name}`;
    await fs.writeFile(
      path.join(OUT, name),
      `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>Moved — Mist</title>\n` +
        `  <meta name="robots" content="noindex" />\n  <link rel="canonical" href="${MIST_URL}/${name}" />\n` +
        `  <script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>\n` +
        `  <meta http-equiv="refresh" content="0; url=${to}" />\n</head>\n` +
        `<body><p>This page has moved to <a href="${to}">${to}</a>.</p></body>\n</html>\n`
    );
  }

  // ── Nelson CRM, under /nelson-crm/ ──
  // A separate, prebuilt project (see nelson-crm/README.md) published as-is. Only its runtime files are copied;
  // its sources stay in the repo.
  for (const item of NELSON_PUBLIC) {
    const from = path.join(NELSON, item);
    if (!(await exists(from))) continue;
    const to = path.join(OUT, "nelson-crm", item);
    if ((await fs.stat(from)).isDirectory()) await copyDir(from, to);
    else {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }

  // ── AsterPay, Vizen, UnoRouter and OFFFORM, under /asterpay/, /vizen/, /unorouter/ and /offform/ ──
  // Plain files, published as they are; their pages get the tokens, with a version hash of their own CSS and JS.
  for (const site of PLAIN_SITES) {
    const files = (await listFiles(site.dir)).filter((f) => !site.private.has(path.relative(site.dir, f).split(path.sep)[0]));
    const code = (
      await Promise.all(files.filter((f) => /\.(css|js)$/.test(f) && !f.includes(`${path.sep}vendor${path.sep}`)).map((f) => fs.readFile(f, "utf8")))
    ).join("\n");
    const tokens = { SITE_URL: `${SITE_URL}/${site.name}`, BASE: `${BASE}${site.name}/`, VERSION: hashOf(code), YEAR };
    for (const file of files) {
      const dest = path.join(OUT, site.name, path.relative(site.dir, file));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      if (file.endsWith(".html")) await fs.writeFile(dest, withLiveReload(replaceTokens(await fs.readFile(file, "utf8"), tokens)));
      else if (TEXT_EXT.has(path.extname(file))) await fs.writeFile(dest, replaceTokens(await fs.readFile(file, "utf8"), tokens));
      else await fs.copyFile(file, dest);
    }
  }

  // Sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${SITE_URL}/`,
    ...pages
      .map((p) => path.basename(p))
      .filter((name) => name !== "404.html")
      .map((name) => (name === "index.html" ? `${MIST_URL}/` : `${MIST_URL}/${name}`)),
    `${SITE_URL}/nelson-crm/`,
    `${SITE_URL}/nelson-crm/recreation.html`,
    `${SITE_URL}/asterpay/`,
    `${SITE_URL}/vizen/`,
    `${SITE_URL}/unorouter/`,
    `${SITE_URL}/offform/`,
  ];
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;
  await fs.writeFile(path.join(OUT, "sitemap.xml"), sitemap);
  await fs.writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  await fs.writeFile(path.join(OUT, ".nojekyll"), "");

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  console.log(`✓ built the picker, ${pages.length} Mist pages, Nelson, AsterPay, Vizen, UnoRouter and OFFFORM → ${path.relative(ROOT, OUT) || OUT} in ${Date.now() - started}ms`);
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
    else if ((await exists(file)) && (await fs.stat(file)).isDirectory()) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); // as Pages does: /mist → /mist/
      return;
    }
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
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await build();
        for (const c of clients) c.write("data: reload\n\n");
      } catch (err) {
        console.error(err);
      }
    }, 120);
  };
  watch(SRC, { recursive: true }, rebuild);
  watch(PICKER, { recursive: true }, rebuild);
  for (const site of PLAIN_SITES) watch(site.dir, { recursive: true }, rebuild);
}

await build();
if (SERVE) serve();
