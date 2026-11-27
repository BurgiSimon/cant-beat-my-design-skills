#!/usr/bin/env node
/**
 * Checks every assembled Crestora page: each local href and src must point to a file that exists, and each #fragment
 * to an id on the target page. Exits 1 on the first run with problems, listing them all.
 *
 *   node crestora/tools/links.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["src", "tools", "vendor", "node_modules"]);

async function pages(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pages(full)));
    else if (e.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const ids = new Map();
async function idsOf(file) {
  if (!ids.has(file)) {
    const html = await fs.readFile(file, "utf8");
    ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return ids.get(file);
}
const exists = (f) => fs.access(f).then(() => true, () => false);

const problems = [];
const files = await pages(SITE);
for (const file of files) {
  const html = await fs.readFile(file, "utf8");
  const rel = path.relative(SITE, file);
  for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const url = m[2];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:|blob:|\{\{)/.test(url)) continue;
    const [pathPart, hash = ""] = url.split("#");
    const clean = pathPart.split("?")[0];
    let target = clean ? path.resolve(path.dirname(file), clean) : file;
    if (clean.endsWith("/") || clean === "." || clean === "./") target = path.join(target, "index.html");
    if (!(await exists(target))) { problems.push(`${rel}: ${m[1]}="${url}" → no file ${path.relative(SITE, target)}`); continue; }
    if (hash && target.endsWith(".html") && !(await idsOf(target)).has(decodeURIComponent(hash))) problems.push(`${rel}: ${m[1]}="${url}" → no #${hash} in ${path.relative(SITE, target)}`);
  }
}
const unique = [...new Set(problems)];
problems.length = 0;
problems.push(...unique);
if (problems.length) {
  console.error(`✗ ${problems.length} broken link(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ links: ${files.length} pages, every local href, src and #id resolves`);
