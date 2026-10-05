# Rust Reference AutoUpdated

A searchable GitHub Pages reference for Rust server metadata, automatically mirrored from Carbon's public metadata API.

## Datasets

- Blueprints
- Items
- Entities
- Prefabs
- ConVars
- Commands

Current machine-readable files are published under `data/current/<dataset>.json`. Synchronization metadata and SHA-256 hashes are stored in `data/metadata.json`.

## Updating

The **Update Rust metadata** workflow runs every six hours and can also be started manually. Downloads are parsed and validated before current files are replaced. When a dataset changes, the previous copy is retained under `data/history/<timestamp>/`.

## GitHub Pages

In repository **Settings → Pages**, set **Source** to **GitHub Actions**. The **Deploy GitHub Pages** workflow publishes the repository as the static site.

## Upstream

Data source: Carbon Rust metadata API. This repository is an independent reference/mirror and is not affiliated with Facepunch Studios or Carbon.
