// Pure builder for the api/v1 files: takes parsed data, returns { "path": jsonValue }.
import {
  ITEM_CATEGORIES, RARITIES, categoryName, imageUrl, rarityName, slimBlueprint, usedInIndex,
} from "../assets/shared.mjs";

export function buildApi({ items, blueprints, images, metadata, generatedAt }) {
  const files = {};
  const blueprintOf = new Map(blueprints.map((bp) => [bp.Item.ShortName, slimBlueprint(bp)]));
  const usedIn = usedInIndex(blueprints);
  const skins = new Map();
  for (const item of items) {
    const base = item.RedirectOf?.ShortName;
    if (!base) continue;
    if (!skins.has(base)) skins.set(base, []);
    skins.get(base).push(item.ShortName);
  }

  files["api/v1/items.json"] = items.map((item) => ({
    Id: item.Id,
    ShortName: item.ShortName,
    DisplayName: item.DisplayName,
    Category: item.Category,
    CategoryName: categoryName(item.Category),
    Stack: item.Stack,
    Hidden: item.Hidden,
    Image: imageUrl(item.ShortName, images),
  }));

  files["api/v1/items/by-id.json"] = Object.fromEntries(items.map((item) => [item.Id, item.ShortName]));

  for (const item of items) {
    files[`api/v1/items/${item.ShortName}.json`] = {
      ...item,
      // The upstream record embeds the whole base item; a reference is enough here.
      RedirectOf: item.RedirectOf?.ShortName ?? null,
      CategoryName: categoryName(item.Category),
      RarityName: rarityName(item.Rarity),
      Image: imageUrl(item.ShortName, images),
      Blueprint: blueprintOf.get(item.ShortName) ?? null,
      UsedIn: usedIn.get(item.ShortName) ?? [],
      Skins: skins.get(item.ShortName) ?? [],
    };
  }

  files["api/v1/blueprints.json"] = [...blueprintOf.values()];

  files["api/v1/index.json"] = {
    name: "Rogue Rust Reference API",
    version: 1,
    generated_at: generatedAt,
    data_updated_at: metadata.updated_at,
    enums: { ItemCategory: ITEM_CATEGORIES, Rarity: RARITIES },
    endpoints: {
      "api/v1/items.json": "Compact item list with category names and image URLs.",
      "api/v1/items/{shortname}.json": "One item with its image, blueprint, the items crafted from it and its skins.",
      "api/v1/items/by-id.json": "Item ID to shortname lookup.",
      "api/v1/blueprints.json": "Blueprints with ingredients as shortname references.",
      "data/current/{dataset}.json": "Unmodified upstream datasets: items, blueprints, entities, prefabs, convars, commands.",
      "data/metadata.json": "Record counts, SHA-256 hashes and change timestamps per dataset.",
      "data/changelog.json": "Records added, removed and changed by each sync.",
      "data/images.json": "Image hosts and the items that need the fallback host or have no picture.",
    },
    counts: Object.fromEntries(Object.entries(metadata.datasets ?? {}).map(([name, d]) => [name, d.count])),
  };

  return files;
}
