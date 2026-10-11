# Rust Reference AutoUpdated

A searchable GitHub Pages reference for Rust server metadata, mirrored automatically from Carbon's public metadata API, with item pictures and a static JSON API.

## What's on the site

- **Items** with pictures, IDs, stack sizes, crafting recipes, "used to craft" and skin cross-links.
- **Blueprints**, **Entities**, **Prefabs**, **ConVars** and **Commands**, each searchable and filterable.
- **Changes**: what every sync added, removed or modified.
- Shareable links for every record, for example `#items/rifle.ak`.

## JSON API

Everything is plain JSON served by GitHub Pages (CORS enabled, no key).

| Path | Contents |
| --- | --- |
| `api/v1/index.json` | Endpoint directory, enum names, record counts |
| `api/v1/items.json` | Compact item list with category names and picture URLs |
| `api/v1/items/{shortname}.json` | One item with picture, blueprint, items crafted from it and skins |
| `api/v1/items/by-id.json` | Item ID to shortname map |
| `api/v1/blueprints.json` | Blueprints with ingredients as shortname references |
| `data/current/{dataset}.json` | Unmodified upstream datasets (`items`, `blueprints`, `entities`, `prefabs`, `convars`, `commands`) |
| `data/metadata.json` | Counts, SHA-256 hashes and change timestamps per dataset |
| `data/changelog.json` | Records added, removed and changed by each sync |
| `data/images.json` | Picture URL templates and the items that need the fallback host or have no picture |

The `api/v1` files are generated at deploy time by `scripts/build.mjs` and are not committed.

## How updating works

The **Sync and deploy** workflow runs every six hours, on every push to `main`, and on demand. In one job it:

1. Runs `scripts/sync.mjs`, which downloads all six datasets, validates them, and only then writes anything. A dataset that shrinks by more than half is rejected as a broken upstream response.
2. Commits `data/` if records actually changed. Upstream reordering alone is ignored.
3. Runs `scripts/build.mjs` to generate `api/v1`.
4. Publishes the site.

Sync and deploy share one workflow because commits pushed by `GITHUB_TOKEN` do not trigger other workflows.

Older versions of each dataset are available through the git history of `data/current/`.

## Item pictures

Pictures are linked from Carbon's CDN, falling back to Facepunch's file host for items Carbon does not have. `data/images.json` records which items need the fallback and which have no picture; the sync re-checks those whenever the item list changes.

## Running locally

Any static file server works, for example `npx serve .`. The scripts need Node 22 or newer (the workflow uses Node 24 LTS) and have no dependencies:

```bash
node scripts/sync.mjs
node scripts/build.mjs
```

## GitHub Pages

In repository **Settings → Pages**, set **Source** to **GitHub Actions**.

## Upstream

Data source: Carbon Rust metadata API. Item pictures © Facepunch Studios. This repository is an independent reference and is not affiliated with Facepunch Studios or Carbon.
