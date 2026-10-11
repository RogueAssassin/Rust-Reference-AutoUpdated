#!/usr/bin/env node
// Generates the derived, read-only JSON API under api/v1 from data/current.
// The output is not committed; the Pages workflow runs this right before publishing.
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

console.log(`Wrote ${Object.keys(files).length} API files.`);
