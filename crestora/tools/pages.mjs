#!/usr/bin/env node
/**
 * Assembles Crestora's pages from crestora/src into crestora/ (the published files are what this writes):
 *
 *   src/partials/head.html, header.html, footer.html   shared by every page
 *   src/pages/<path>.html                              each page's own <main>, with a header comment:
 *       <!--page
 *       title: Pricing — Crestora
 *       description: One sentence for search and link previews.
 *       modules: pricing faq          (optional: js/modules/<name>.js to load, run in this order)
 *       nav: product                  (optional: which header item is current)
 *       -->
 *   src/css/*.css                                      concatenated, in filename order, into css/site.css
 *
 *   node crestora/tools/pages.mjs            assemble once
 *   node crestora/tools/pages.mjs --watch    and again whenever src changes
 *
 * Tokens in partials and pages: {{ROOT}} (relative path from the page to the site root: "" or "../"), {{TITLE}},
 * {{DESCRIPTION}}, {{PATH}} (the page's path, e.g. "pricing.html"), {{PAGE}} (its name), {{MODULES}}, and
 * {{CURRENT:<key>}}, which becomes aria-current="page" on links whose key is the page's path or nav value.
 * {{SITE_URL}} and {{VERSION}} are left for build.mjs.
 */
import { promises as fs, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(SITE, "src");

async function list(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await list(full)));
    else if (!e.name.startsWith(".")) out.push(full);
  }
  return out.sort();
}

// atomic write: a reader (the dev server) never sees half a file
async function write(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, file);
}

function parse(source, file) {
  const m = source.match(/^\s*<!--page\s*\n([\s\S]*?)-->\s*\n?/);
  if (!m) throw new Error(`${file}: missing the <!--page ... --> header`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.title) throw new Error(`${file}: no title`);
  return { meta, body: source.slice(m[0].length) };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function assemble() {
  const started = Date.now();
  const [head, header, footer] = await Promise.all(["head", "header", "footer"].map((n) => fs.readFile(path.join(SRC, "partials", `${n}.html`), "utf8")));

  // css: one bundle
  const cssFiles = (await list(path.join(SRC, "css"))).filter((f) => f.endsWith(".css"));
  const css = (await Promise.all(cssFiles.map(async (f) => `/* ── ${path.basename(f)} ── */\n${(await fs.readFile(f, "utf8")).trim()}\n`))).join("\n");
  await write(path.join(SITE, "css", "site.css"), `/* Crestora — assembled from src/css by tools/pages.mjs; edit those, not this. */\n${css}`);

  const pages = (await list(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));
  for (const file of pages) {
    const rel = path.relative(path.join(SRC, "pages"), file).split(path.sep).join("/");
    const { meta, body } = parse(await fs.readFile(file, "utf8"), rel);
    const depth = rel.split("/").length - 1;
    const ROOT = "../".repeat(depth);
    const keys = new Set([rel, meta.nav].filter(Boolean));
    const fill = (text) =>
      text
        .replace(/\{\{CURRENT:([\w./#-]+)\}\}/g, (_, k) => (keys.has(k) ? ' aria-current="page"' : ""))
        .replace(/\{\{ROOT\}\}/g, ROOT)
        .replace(/\{\{TITLE\}\}/g, esc(meta.title))
        .replace(/\{\{DESCRIPTION\}\}/g, esc(meta.description || ""))
        .replace(/\{\{PATH\}\}/g, rel === "index.html" ? "" : rel)
        .replace(/\{\{PAGE\}\}/g, rel.replace(/\.html$/, "").replace(/\//g, "-"))
        .replace(/\{\{MODULES\}\}/g, esc(meta.modules || ""));
    const html =
      `<!doctype html>\n<!-- Assembled by tools/pages.mjs from src/pages/${rel}; edit that, not this. -->\n<html lang="en" class="no-js">\n<head>\n${fill(head).trim()}\n</head>\n` +
      `<body data-page="${fill("{{PAGE}}")}" data-modules="${esc(meta.modules || "")}">\n${fill(header).trim()}\n\n${fill(body).trim()}\n\n${fill(footer).trim()}\n</body>\n</html>\n`;
    await write(path.join(SITE, rel), html);
  }
  console.log(`✓ crestora: ${pages.length} pages, ${cssFiles.length} css files → css/site.css in ${Date.now() - started}ms`);
}

await assemble();
if (process.argv.includes("--watch")) {
  let t;
  watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => assemble().catch((e) => console.error(e.message)), 80); });
  console.log("  watching crestora/src …");
}
