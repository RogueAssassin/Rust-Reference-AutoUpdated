#!/usr/bin/env node
// Mirrors Carbon's Rust metadata into data/current, records what changed in
// data/changelog.json and keeps data/images.json (which host has each item picture) current.
// Nothing on disk is touched until every dataset has downloaded and validated.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATASETS, IMAGE_SOURCES, changelogEntry, diffDataset } from "../assets/shared.mjs";

const BASE = "https://api.carbonmod.gg/meta/rust/";
const USER_AGENT = "Rust-Reference-AutoUpdated/2.0 (+https://github.com/RogueAssassin/Rust-Reference-AutoUpdated)";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const CURRENT = join(DATA, "current");
const CHANGELOG_LIMIT = 150;
// A dataset losing more than half its records is far more likely a broken upstream
// response than a real game update. Set FORCE_SYNC=1 to accept it anyway.
const MAX_SHRINK = 0.5;

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

async function download(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= attempts) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

async function imageExists(source, shortName) {
  const url = IMAGE_SOURCES[source].replace("{shortname}", encodeURIComponent(shortName));
  try {
    const response = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    return response.ok;
  } catch {
    return null; // unknown: keep whatever we believed before
  }
}

/** Re-check pictures for new items and for items that had no Carbon picture last time. */
async function refreshImages(images, items, addedShortNames) {
  const known = new Set(items.map((item) => item.ShortName));
  const fallback = new Set(images.fallback.filter((name) => known.has(name)));
  const missing = new Set(images.missing.filter((name) => known.has(name)));
  const queue = [...new Set([...addedShortNames, ...fallback, ...missing])];
  const worker = async () => {
    for (let name; (name = queue.pop()) !== undefined; ) {
      const onCarbon = await imageExists("carbon", name);
      if (onCarbon === null) continue;
      if (onCarbon) { fallback.delete(name); missing.delete(name); continue; }
      const onFacepunch = await imageExists("facepunch", name);
      if (onFacepunch === null) continue;
      fallback.delete(name); missing.delete(name);
      (onFacepunch ? fallback : missing).add(name);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return { ...images, sources: IMAGE_SOURCES, fallback: [...fallback].sort(), missing: [...missing].sort() };
}

const now = new Date().toISOString();
const previousMeta = readJson(join(DATA, "metadata.json"), { datasets: {} });
mkdirSync(CURRENT, { recursive: true });

// 1. Download and validate everything before writing anything.
const fetched = {};
for (const name of DATASETS) {
  const raw = await download(`${BASE}${name}.json`);
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.length === 0) throw new Error(`${name}: expected a non-empty JSON array`);
  const previousCount = previousMeta.datasets?.[name]?.count ?? 0;
  if (records.length < previousCount * MAX_SHRINK && !process.env.FORCE_SYNC) {
    throw new Error(`${name}: ${records.length} records, down from ${previousCount}. Refusing to overwrite (set FORCE_SYNC=1 to accept).`);
  }
  fetched[name] = { records, text: JSON.stringify(records) + "\n" };
}

// 2. Write what changed and describe the change.
const changed = [];
const entries = [];
const datasets = {};
let addedItems = [];
for (const name of DATASETS) {
  const { records } = fetched[name];
  const path = join(CURRENT, `${name}.json`);
  const oldText = existsSync(path) ? readFileSync(path, "utf8") : null;
  const previous = previousMeta.datasets?.[name] ?? {};
  // Compare records, not bytes: upstream regularly reorders entities and prefabs without
  // changing them, and that should not produce a commit.
  const oldRecords = oldText === null ? null : JSON.parse(oldText);
  const diff = oldRecords ? diffDataset(name, oldRecords, records) : null;
  const text = oldRecords && !diff ? oldText : fetched[name].text;
  if (oldText !== text) {
    changed.push(name);
    if (diff) entries.push(changelogEntry(name, now, diff));
    if (diff && name === "items") addedItems = diff.added;
    writeFileSync(path, text);
  }
  datasets[name] = {
    count: records.length,
    bytes: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
    source: `${BASE}${name}.json`,
    changed: changed.includes(name),
    changed_at: changed.includes(name) ? now : previous.changed_at ?? previousMeta.updated_at ?? now,
  };
}

if (entries.length) {
  const changelog = readJson(join(DATA, "changelog.json"), []);
  writeJson(join(DATA, "changelog.json"), [...entries, ...changelog].slice(0, CHANGELOG_LIMIT));
}

const imagesPath = join(DATA, "images.json");
const images = readJson(imagesPath, { fallback: [], missing: [] });
if (changed.includes("items") || !existsSync(imagesPath) || process.env.RECHECK_IMAGES) {
  const all = fetched.items.records.map((item) => item.ShortName);
  const refreshed = await refreshImages(images, fetched.items.records, existsSync(imagesPath) ? addedItems : all);
  if (JSON.stringify(refreshed) !== JSON.stringify(images)) writeJson(imagesPath, refreshed);
}

// 3. metadata.json is only rewritten when data changed, so a quiet sync produces no commit.
if (changed.length || !previousMeta.schema) {
  writeJson(join(DATA, "metadata.json"), {
    schema: 2,
    updated_at: changed.length ? now : previousMeta.updated_at ?? now,
    source: "Carbon Rust metadata API",
    datasets,
    changed_datasets: changed,
  });
}

console.log(changed.length ? `Updated: ${changed.join(", ")}` : "No upstream changes.");
