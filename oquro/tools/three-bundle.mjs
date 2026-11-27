#!/usr/bin/env node
/**
 * Builds vendor/three.min.js: three.js cut down to what OQURO uses.
 *
 *   node oquro/tools/three-bundle.mjs
 *
 * The site's modules import three as a namespace (`import * as THREE from '../vendor/three.min.js'`), so the names
 * they use are every `THREE.Name` in js/. This script collects them, has esbuild bundle just those out of three's
 * ES build (tree-shaken, minified) and writes the result with three's licence banner.
 *
 * Needs esbuild and three@0.187.0 where Node can resolve them, e.g. run once in this folder:
 *   npm i --no-save esbuild three@0.187.0
 * Not published (build.mjs leaves tools/ behind).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "..");
const require = createRequire(path.join(process.cwd(), "noop.js"));
const esbuild = require("esbuild");
const threeEntry = require.resolve("three");
const { readFileSync } = await import("node:fs");
const version = JSON.parse(readFileSync(path.join(path.dirname(threeEntry), "..", "package.json"), "utf8")).version;

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}

const names = new Set();
for (const file of await walk(path.join(SITE, "js"))) {
  for (const m of (await fs.readFile(file, "utf8")).matchAll(/\bTHREE\.(\w+)\b/g)) names.add(m[1]);
}
const list = [...names].sort();
const entry = `export { ${list.join(", ")} } from "three";\n`; // three's ES build, so esbuild can shake it

const result = await esbuild.build({
  stdin: { contents: entry, resolveDir: SITE, loader: "js" },
  nodePaths: [path.resolve(threeEntry, "../../..")],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  legalComments: "none",
  write: false,
});
const banner = `/**\n * three.js r${version.split(".")[1]} (${version}), cut down to: ${list.join(", ")}\n * @license Copyright 2010-2025 Three.js Authors. SPDX-License-Identifier: MIT\n */\n`;
const out = path.join(SITE, "vendor", "three.min.js");
await fs.writeFile(out, banner + result.outputFiles[0].text);
console.log(`✓ vendor/three.min.js: ${list.length} exports, ${(result.outputFiles[0].text.length / 1024).toFixed(0)} KB`);
