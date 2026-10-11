#!/usr/bin/env node
// Generates the derived, read-only JSON API under api/v1 from data/current.
// The output is not committed; the Pages workflow runs this right before publishing.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApi } from "./api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const files = buildApi({
  items: read("data/current/items.json"),
  blueprints: read("data/current/blueprints.json"),
  images: read("data/images.json"),
  metadata: read("data/metadata.json"),
  generatedAt: new Date().toISOString(),
});

rmSync(join(ROOT, "api"), { recursive: true, force: true });
for (const [path, value] of Object.entries(files)) {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(value) + "\n");
}

// Published copy only: lets the site show when upstream was last checked, without a commit.
const metadata = read("data/metadata.json");
metadata.checked_at = new Date().toISOString();
writeFileSync(join(ROOT, "data/metadata.json"), JSON.stringify(metadata, null, 2) + "\n");

// Published copy only: version the asset URLs so browsers never pair a new page with
// cached scripts or styles from the previous deploy.
const assets = ["assets/style.css", "assets/app.js", "assets/shared.mjs"];
const version = assets
  .reduce((hash, path) => hash.update(readFileSync(join(ROOT, path))), createHash("sha256"))
  .digest("hex")
  .slice(0, 10);
const stamp = (path, replacements) => {
  let source = readFileSync(join(ROOT, path), "utf8");
  for (const name of replacements) {
    if (!source.includes(name)) throw new Error(`${path}: expected a reference to ${name}`);
    source = source.replaceAll(name, `${name}?v=${version}`);
  }
  writeFileSync(join(ROOT, path), source);
};
stamp("index.html", ["assets/style.css", "assets/app.js"]);
stamp("assets/app.js", ["./shared.mjs"]);

console.log(`Wrote ${Object.keys(files).length} API files.`);
