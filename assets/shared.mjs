// Logic shared by the website (assets/app.js) and the build scripts (scripts/*.mjs).
// Keep this file free of DOM and Node APIs so both sides can import it.

export const DATASETS = ["items", "blueprints", "entities", "prefabs", "convars", "commands"];

export const ITEM_CATEGORIES = {
  0: "Weapon", 1: "Construction", 2: "Items", 3: "Resources", 4: "Attire", 5: "Tool",
  6: "Medical", 7: "Food", 8: "Ammunition", 9: "Traps", 10: "Misc", 13: "Component",
  16: "Electrical", 17: "Fun",
};

export const RARITIES = { 0: "None", 1: "Common", 2: "Uncommon", 3: "Rare", 4: "Very Rare" };

export const IMAGE_SOURCES = {
  carbon: "https://cdn.carbonmod.gg/items/{shortname}.png",
  facepunch: "https://files.facepunch.com/rust/item/{shortname}_512.png",
};

export const categoryName = (n) => ITEM_CATEGORIES[n] ?? `Category ${n}`;
export const rarityName = (n) => RARITIES[n] ?? `Rarity ${n}`;

/**
 * Resolve the picture for an item shortname. `images` is data/images.json:
 * { fallback: [shortnames only on the Facepunch host], missing: [no picture anywhere] }.
 * Returns null when no picture is known to exist.
 */
export function imageUrl(shortName, images) {
  if (!shortName) return null;
  if (images?.missing?.includes(shortName)) return null;
  const source = images?.fallback?.includes(shortName) ? "facepunch" : "carbon";
  return IMAGE_SOURCES[source].replace("{shortname}", encodeURIComponent(shortName));
}

/** Stable identifier of a record inside its dataset (used for links and diffs). */
export function keyOf(dataset, record) {
  switch (dataset) {
    case "items": return record.ShortName;
    case "blueprints": return record.Item?.ShortName;
    case "entities":
    case "prefabs": return record.Path;
    default: return record.Name;
  }
}

/** Blueprint without the embedded copies of full item objects. */
export function slimBlueprint(bp) {
  return {
    Item: bp.Item.ShortName,
    ItemId: bp.Item.Id,
    CraftAmount: bp.CraftAmount,
    Time: bp.Time,
    WorkbenchLevelRequired: bp.WorkbenchLevelRequired,
    ScrapRequired: bp.ScrapRequired,
    ScrapFromRecycle: bp.ScrapFromRecycle,
    UserCraftable: bp.UserCraftable,
    Rarity: bp.Rarity,
    NeedsSteamDLC: bp.NeedsSteamDLC,
    NeedsSteamItem: bp.NeedsSteamItem,
    RequireUnlockedItem: bp.RequireUnlockedItem?.ShortName ?? null,
    Ingredients: (bp.Ingredients ?? []).map((g) => ({
      ShortName: g.Item.ShortName,
      Id: g.Item.Id,
      Amount: g.Amount,
    })),
  };
}

/** Map of ingredient shortname -> shortnames of the items crafted from it. */
export function usedInIndex(blueprints) {
  const index = new Map();
  for (const bp of blueprints) {
    for (const g of bp.Ingredients ?? []) {
      const key = g.Item.ShortName;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(bp.Item.ShortName);
    }
  }
  return index;
}

/**
 * Compare two versions of a dataset. Returns null when nothing but ordering changed,
 * otherwise { before, after, added, removed, changed: [{ key, fields }] }.
 */
export function diffDataset(dataset, before, after) {
  const index = (list) => {
    const map = new Map();
    list.forEach((record, i) => map.set(keyOf(dataset, record) ?? `#${i}`, record));
    return map;
  };
  const a = index(before), b = index(after);
  const added = [], removed = [], changed = [];
  for (const [key, record] of b) {
    if (!a.has(key)) { added.push(key); continue; }
    const old = a.get(key);
    if (JSON.stringify(old) === JSON.stringify(record)) continue;
    const fields = [...new Set([...Object.keys(old), ...Object.keys(record)])]
      .filter((f) => JSON.stringify(old[f]) !== JSON.stringify(record[f]));
    changed.push({ key, fields });
  }
  for (const key of a.keys()) if (!b.has(key)) removed.push(key);
  if (!added.length && !removed.length && !changed.length) return null;
  return { before: before.length, after: after.length, added, removed, changed };
}

/** Trim a diff so the changelog stays small; totals keep the real numbers. */
export function changelogEntry(dataset, at, diff, limit = 100) {
  return {
    at,
    dataset,
    before: diff.before,
    after: diff.after,
    totals: { added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length },
    added: diff.added.slice(0, limit),
    removed: diff.removed.slice(0, limit),
    changed: diff.changed.slice(0, limit),
  };
}
