import { DATASETS, categoryName, rarityName, imageUrl, keyOf, usedInIndex } from "./shared.mjs";

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (value) => Number(value).toLocaleString();
const link = (tab, key) => `#${tab}/${encodeURIComponent(key)}`;
const REPO = "https://github.com/RogueAssassin/Rust-Reference-AutoUpdated";
const PAGE_SIZE = { list: 50, grid: 72 };

// ---------- data ----------

const cache = {};
function fetchJson(path, fallback) {
  return (cache[path] ??= fetch(path, { cache: "no-cache" }).then((response) => {
    if (response.ok) return response.json();
    if (fallback !== undefined) return fallback;
    throw new Error(`${path}: HTTP ${response.status}`);
  }));
}
const load = (dataset) => fetchJson(`data/current/${dataset}.json`);

let images = { fallback: [], missing: [] };
const lookup = { items: new Map(), blueprints: new Map(), usedIn: new Map(), skins: new Map(), itemByPrefab: new Map() };

/** Items and blueprints power the pictures and cross-links on every tab, so load them once. */
const core = (async () => {
  const [items, blueprints, imageMap] = await Promise.all([load("items"), load("blueprints"), fetchJson("data/images.json", images)]);
  images = imageMap;
  for (const item of items) {
    lookup.items.set(item.ShortName, item);
    const base = item.RedirectOf?.ShortName;
    if (base) lookup.skins.set(base, [...(lookup.skins.get(base) ?? []), item.ShortName]);
    for (const mod of [item.ItemMod_Deployable, item.ItemMod_Entity, item.ItemMod_EntityReference]) {
      if (mod?.ResourcePath && !lookup.itemByPrefab.has(mod.ResourcePath)) lookup.itemByPrefab.set(mod.ResourcePath, item);
    }
  }
  for (const bp of blueprints) lookup.blueprints.set(bp.Item.ShortName, bp);
  lookup.usedIn = usedInIndex(blueprints);
})();

// ---------- dataset definitions ----------

const select = (id, label, options) => ({ id, label, options });
const categoryOptions = (pick) => [
  ["", "Any category", () => true],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 16, 17]
    .map((n) => [String(n), categoryName(n), (r) => pick(r).Category === n])
    .sort((a, b) => a[1].localeCompare(b[1])),
];
const prefabView = (label, help) => ({
  label, help,
  title: (r) => r.Name,
  sub: (r) => r.Path,
  hay: (r) => [r.Name, r.Path, r.ID, ...(r.Components ?? [])],
  icon: (r) => lookup.itemByPrefab.get(r.Path)?.ShortName,
  pills: (r) => (lookup.itemByPrefab.has(r.Path) ? [["Item", "good"]] : []),
  filters: [select("link", "Link", [
    ["", "All records", () => true],
    ["item", "Linked to an item", (r) => lookup.itemByPrefab.has(r.Path)],
    ["components", "Has components", (r) => r.Components?.length > 0],
  ])],
});

const VIEWS = {
  items: {
    label: "Items", help: "Item definitions with pictures, IDs and crafting data.", grid: true,
    title: (r) => r.DisplayName || r.ShortName,
    sub: (r) => r.ShortName,
    hay: (r) => [r.DisplayName, r.ShortName, r.Id, r.Description, categoryName(r.Category)],
    icon: (r) => r.ShortName,
    pills: (r) => [[categoryName(r.Category)], ...(r.Hidden ? [["Hidden", "warn"]] : [])],
    filters: [
      select("show", "Show", [
        ["", "All items", () => true],
        ["visible", "Visible", (r) => !r.Hidden],
        ["hidden", "Hidden", (r) => r.Hidden],
        ["craftable", "Craftable", (r) => lookup.blueprints.has(r.ShortName)],
        ["deployable", "Deployable", (r) => r.ItemMod_Deployable],
        ["skins", "Skins", (r) => r.RedirectOf],
        ["dlc", "Steam DLC / store", (r) => r.SteamDlcItem || r.SteamStoreItem],
      ]),
      select("category", "Category", categoryOptions((r) => r)),
    ],
  },
  blueprints: {
    label: "Blueprints", help: "Crafting recipes, workbench levels and research costs.", grid: true,
    title: (r) => r.Item.DisplayName || r.Item.ShortName,
    sub: (r) => r.Item.ShortName,
    hay: (r) => [r.Item.DisplayName, r.Item.ShortName, r.Item.Id, ...r.Ingredients.map((g) => g.Item.DisplayName)],
    icon: (r) => r.Item.ShortName,
    pills: (r) => [[r.WorkbenchLevelRequired ? `Workbench ${r.WorkbenchLevelRequired}` : "No workbench", r.WorkbenchLevelRequired ? "" : "good"]],
    filters: [
      select("workbench", "Workbench", [
        ["", "Any workbench", () => true],
        ...[0, 1, 2, 3].map((n) => [String(n), n ? `Workbench level ${n}` : "No workbench", (r) => r.WorkbenchLevelRequired === n]),
      ]),
      select("category", "Category", categoryOptions((r) => r.Item)),
    ],
  },
  entities: prefabView("Entities", "Spawnable entity prefabs and their components."),
  prefabs: prefabView("Prefabs", "Every prefab path and ID known to the server."),
  convars: {
    label: "ConVars", help: "Server variables with types, defaults and permissions.",
    title: (r) => r.Name,
    sub: (r) => `${r.Type ?? "?"} · default ${r.DefaultValue ?? "none"}`,
    hay: (r) => [r.Name, r.Help, r.Type],
    pills: (r) => [...(r.ServerAdmin ? [["Admin", "good"]] : []), ...(r.Saved ? [["Saved"]] : [])],
    filters: [
      select("scope", "Scope", [
        ["", "All convars", () => true],
        ["admin", "Server admin", (r) => r.ServerAdmin],
        ["user", "Server user", (r) => r.ServerUser],
        ["saved", "Saved", (r) => r.Saved],
        ["server", "Server side", (r) => r.Serverside],
        ["client", "Client side", (r) => r.Clientside],
        ["help", "Has help text", (r) => r.Help],
      ]),
      select("type", "Type", [
        ["", "Any type", () => true],
        ...["bool", "int", "float", "string"].map((t) => [t, t, (r) => r.Type === t]),
      ]),
    ],
  },
  commands: {
    label: "Commands", help: "Console commands and where they can run.",
    title: (r) => r.Name,
    sub: (r) => r.Help || "No help text",
    hay: (r) => [r.Name, r.Help],
    pills: (r) => [...(r.Server ? [["Server", "good"]] : []), ...(r.Client ? [["Client"]] : []), ...(r.ServerUser ? [["User"]] : [])],
    filters: [select("scope", "Scope", [
      ["", "All commands", () => true],
      ["server", "Server", (r) => r.Server],
      ["client", "Client", (r) => r.Client],
      ["user", "Server user", (r) => r.ServerUser],
      ["help", "Has help text", (r) => r.Help],
    ])],
  },
};
const PAGES = { changes: "Changes", api: "API" };

// ---------- state ----------

const state = { tab: "items", key: null, q: "", filters: {}, sort: "auto", page: 1, view: "list" };
try { state.view = localStorage.getItem("view") === "grid" ? "grid" : "list"; } catch { /* storage unavailable */ }
let visible = []; // records on the current page, in order
const search = new WeakMap(); // record -> { title, sub, hay }

function describe(dataset, records) {
  const view = VIEWS[dataset];
  for (const record of records) {
    if (search.has(record)) continue;
    const title = String(view.title(record) ?? "");
    const sub = String(view.sub(record) ?? "");
    search.set(record, { title, sub, hay: view.hay(record).filter((v) => v != null).join("\n").toLowerCase(), titleLower: title.toLowerCase() });
  }
  return records;
}

function matches(dataset, records) {
  const view = VIEWS[dataset];
  const tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const query = tokens.join(" ");
  const predicates = view.filters
    .map((filter) => filter.options.find(([value]) => value === (state.filters[filter.id] ?? ""))?.[2])
    .filter(Boolean);
  const out = records.filter((record) => predicates.every((test) => test(record)) && tokens.every((token) => search.get(record).hay.includes(token)));
  const byName = (a, b) => search.get(a).titleLower.localeCompare(search.get(b).titleLower);
  const sort = state.sort === "auto" ? (query ? "match" : "name") : state.sort;
  if (sort === "match") {
    const rank = (record) => {
      const { titleLower } = search.get(record);
      const key = String(keyOf(dataset, record)).toLowerCase();
      if (titleLower === query || key === query) return 0;
      if (titleLower.startsWith(query) || key.startsWith(query)) return 1;
      if (titleLower.includes(query) || key.includes(query)) return 2;
      return 3;
    };
    const ranks = new Map(out.map((record) => [record, rank(record)]));
    out.sort((a, b) => ranks.get(a) - ranks.get(b) || byName(a, b));
  } else {
    out.sort(byName);
    if (sort === "name-desc") out.reverse();
  }
  return out;
}

// ---------- shared markup ----------

function icon(shortName, size = "", label = shortName) {
  const url = imageUrl(shortName, images);
  const letter = esc((label ?? "?").replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase() || "?");
  if (!url) return `<span class="icon ${size} empty" aria-hidden="true">${letter}</span>`;
  return `<img class="icon ${size}" src="${esc(url)}" alt="" loading="lazy" decoding="async" data-letter="${letter}">`;
}
// Image errors do not bubble, so catch them in the capture phase and swap in a placeholder.
document.addEventListener("error", (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains("icon")) return;
  const placeholder = document.createElement("span");
  placeholder.className = img.className + " empty";
  placeholder.textContent = img.dataset.letter;
  img.replaceWith(placeholder);
}, true);

const pill = ([text, tone = ""]) => `<span class="pill ${tone}">${esc(text)}</span>`;
const copyButton = (label, value, primary = false) => `<button type="button" class="action ${primary ? "primary" : ""}" data-copy="${esc(value)}">${esc(label)}</button>`;
const yesNo = (value) => (value ? '<span class="yes">Yes</span>' : '<span class="no">No</span>');
const panel = (title, body, wide = false) => `<div class="panel ${wide ? "wide" : ""}"><h3>${esc(title)}</h3>${body}</div>`;
// rows: [label, html, value-to-copy?]
const kv = (rows) => rows.filter(Boolean).map(([label, html, copy]) =>
  `<div class="kv"><span>${esc(label)}</span><b>${html}${copy != null ? `<button type="button" class="mini" data-copy="${esc(copy)}" title="Copy ${esc(label)}" aria-label="Copy ${esc(label)}">⧉</button>` : ""}</b></div>`).join("");
const text = (value) => esc(value);

function itemChip(shortName, amount) {
  const item = lookup.items.get(shortName);
  return `<a class="chip" href="${link("items", shortName)}">${icon(shortName)}<span><b>${esc(item?.DisplayName ?? shortName)}</b><small>${esc(shortName)}</small></span>${amount != null ? `<em>×${num(amount)}</em>` : ""}</a>`;
}
const chipGrid = (shortNames) => `<div class="chips">${shortNames.map((name) => itemChip(name)).join("")}</div>`;
function prefabLink(path) {
  return `<a href="${link("entities", path)}">${esc(path)}</a>`;
}
function duration(seconds) {
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
function rawPanel(record, sources) {
  return `<details class="panel wide raw"><summary>Raw JSON<span>${sources.map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`).join("")}</span></summary>
    <button type="button" class="action raw-copy" data-copy="${esc(JSON.stringify(record, null, 2))}">Copy JSON</button>
    <pre class="json">${esc(JSON.stringify(record, null, 2))}</pre></details>`;
}

// ---------- detail views ----------

function craftingPanel(bp) {
  const facts = [
    ["Workbench", bp.WorkbenchLevelRequired ? `Level ${bp.WorkbenchLevelRequired}` : "None"],
    ["Craft time", duration(bp.Time)],
    ["Yields", `×${num(bp.CraftAmount)}`],
    bp.ScrapRequired > 0 && ["Research", `${num(bp.ScrapRequired)} scrap`],
    bp.ScrapFromRecycle > 0 && ["Recycles to", `${num(bp.ScrapFromRecycle)} scrap`],
  ].filter(Boolean);
  const notes = [
    bp.NeedsSteamDLC && "Requires Steam DLC",
    bp.NeedsSteamItem && "Requires a Steam item",
    bp.RequireUnlockedItem && `Requires ${bp.RequireUnlockedItem.DisplayName} unlocked`,
    !bp.UserCraftable && "Not craftable by players",
  ].filter(Boolean);
  return panel("Crafting", `
    <div class="facts">${facts.map(([label, value]) => `<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div>
    ${notes.length ? `<p class="note">${notes.map(esc).join(" · ")}</p>` : ""}
    <div class="chips">${bp.Ingredients.map((g) => itemChip(g.Item.ShortName, g.Amount)).join("") || '<p class="note">No ingredients.</p>'}</div>`, true);
}

function itemDetail(item, fromTab) {
  const short = item.ShortName;
  const bp = lookup.blueprints.get(short);
  const usedIn = lookup.usedIn.get(short) ?? [];
  const skins = lookup.skins.get(short) ?? [];
  const url = imageUrl(short, images);
  const pills = [
    [categoryName(item.Category)],
    item.Rarity ? [rarityName(item.Rarity), `rarity-${item.Rarity}`] : null,
    item.Hidden ? ["Hidden", "warn"] : null,
    item.RedirectOf ? ["Skin"] : null,
    item.SteamDlcItem ? ["Steam DLC"] : null,
    bp ? ["Craftable", "good"] : null,
  ].filter(Boolean);

  const behaviour = [
    item.ItemMod_Deployable && ["Deploys", prefabLink(item.ItemMod_Deployable.ResourcePath), item.ItemMod_Deployable.ResourcePath],
    item.ItemMod_Entity && ["Held entity", prefabLink(item.ItemMod_Entity.ResourcePath), item.ItemMod_Entity.ResourcePath],
    item.ItemMod_EntityReference && ["Entity", prefabLink(item.ItemMod_EntityReference.ResourcePath), item.ItemMod_EntityReference.ResourcePath],
    item.ItemMod_Repair && ["Repair", text(`Loses ${Math.round(item.ItemMod_Repair.ConditionLost * 100)}% max condition · workbench ${item.ItemMod_Repair.WorkbenchLvlRequired}${item.ItemMod_Repair.CanUseRepairBench ? "" : " · no repair bench"}`)],
    item.ItemMod_Burnable && ["Fuel", `${text(item.ItemMod_Burnable.FuelAmount)} fuel${item.ItemMod_Burnable.ByproductItemShortName ? ` → <a href="${link("items", item.ItemMod_Burnable.ByproductItemShortName)}">${esc(item.ItemMod_Burnable.ByproductItemShortName)}</a> ×${text(item.ItemMod_Burnable.ByproductAmount)} (${Math.round(item.ItemMod_Burnable.ByproductChance * 100)}%)` : ""}`],
    item.ItemMod_FoodSpoiling && ["Spoils", `after ${text(item.ItemMod_FoodSpoiling.TotalSpoilTimeHours)}h → <a href="${link("items", item.ItemMod_FoodSpoiling.SpoilItemShortName)}">${esc(item.ItemMod_FoodSpoiling.SpoilItemShortName)}</a>`],
    item.ItemMod_Compostable && ["Compost", text(`${item.ItemMod_Compostable.TotalFertilizerProduced} fertilizer · bait value ${item.ItemMod_Compostable.BaitValue}`)],
  ];

  return `
    <div class="hero">
      ${url ? `<a class="hero-image" href="${esc(url)}" target="_blank" rel="noopener" title="Open full-size picture">${icon(short, "xl")}</a>` : `<span class="hero-image">${icon(short, "xl")}</span>`}
      <div class="hero-body">
        <h2>${esc(item.DisplayName || short)}</h2>
        <div class="sub"><code>${esc(short)}</code> · ID <code>${esc(item.Id)}</code></div>
        <div class="pills">${pills.map(pill).join("")}</div>
        ${item.Description ? `<p class="description">${esc(item.Description)}</p>` : ""}
        <div class="actions">
          ${copyButton("Copy shortname", short, true)}
          ${copyButton("Copy ID", item.Id)}
          ${copyButton("Copy give command", `inventory.give "${short}" 1`)}
          ${fromTab === "blueprints" ? `<a class="action" href="${link("items", short)}">Open in Items</a>` : ""}
        </div>
      </div>
    </div>
    <div class="detail-grid">
      ${bp ? craftingPanel(bp) : ""}
      ${panel("Overview", kv([
        ["Shortname", text(short), short],
        ["Item ID", text(item.Id), item.Id],
        ["Stack size", num(item.Stack)],
        ["Category", `${text(categoryName(item.Category))} <i>(${text(item.Category)})</i>`],
        ["Rarity", `${text(rarityName(item.Rarity))} <i>(${text(item.Rarity)})</i>`],
        ["Flags", text(item.Flags)],
        ["Hidden", yesNo(item.Hidden)],
        item.RedirectOf && ["Skin of", `<a href="${link("items", item.RedirectOf.ShortName)}">${esc(item.RedirectOf.DisplayName)}</a>`],
        item.SteamDlcItem && ["Steam DLC", text(`${item.SteamDlcItem.Name} (app ${item.SteamDlcItem.AppId})`)],
        item.SteamStoreItem && ["Steam item", text(`${item.SteamStoreItem.Name} (#${item.SteamStoreItem.Id})`)],
      ]))}
      ${panel("Behaviour", (kv(behaviour) || '<p class="note">No deployable, fuel or food data.</p>')
        + (item.ItemMods?.length ? `<div class="tags">${item.ItemMods.map((mod) => `<span>${esc(mod)}</span>`).join("")}</div>` : ""))}
      ${usedIn.length ? panel(`Used to craft (${usedIn.length})`, chipGrid(usedIn), true) : ""}
      ${skins.length ? panel(`Skins (${skins.length})`, chipGrid(skins), true) : ""}
      ${rawPanel(item, [["items.json", "data/current/items.json"], ["API record", `api/v1/items/${encodeURIComponent(short)}.json`]])}
    </div>`;
}

function prefabDetail(record, tab) {
  const item = lookup.itemByPrefab.get(record.Path);
  return `
    <div class="hero">
      ${item ? `<span class="hero-image">${icon(item.ShortName, "xl")}</span>` : ""}
      <div class="hero-body">
        <h2>${esc(record.Name)}</h2>
        <div class="sub"><code>${esc(record.Path)}</code></div>
        <div class="actions">
          ${copyButton("Copy path", record.Path, true)}
          ${copyButton("Copy ID", record.ID)}
          ${copyButton("Copy name", record.Name)}
        </div>
      </div>
    </div>
    <div class="detail-grid">
      ${panel("Overview", kv([
        ["Name", text(record.Name), record.Name],
        ["Prefab ID", text(record.ID), record.ID],
        ["Path", text(record.Path), record.Path],
        record.Type && ["Type", text(record.Type)],
      ]), !item)}
      ${item ? panel("Linked item", `<div class="chips single">${itemChip(item.ShortName)}</div>`) : ""}
      ${panel(`Components (${record.Components?.length ?? 0})`, record.Components?.length
        ? `<div class="tags">${record.Components.map((c) => `<span>${esc(c)}</span>`).join("")}</div>`
        : '<p class="note">No components listed.</p>', true)}
      ${rawPanel(record, [[`${tab}.json`, `data/current/${tab}.json`]])}
    </div>`;
}

function consoleDetail(record, tab) {
  const isConvar = tab === "convars";
  const flags = isConvar
    ? [["Server admin", record.ServerAdmin], ["Server user", record.ServerUser], ["Saved", record.Saved], ["Server side", record.Serverside], ["Client side", record.Clientside]]
    : [["Server", record.Server], ["Client", record.Client], ["Server user", record.ServerUser]];
  const withValue = `${record.Name} ${record.DefaultValue ?? ""}`.trim();
  return `
    <div class="hero">
      <div class="hero-body">
        <h2 class="mono">${esc(record.Name)}</h2>
        <div class="sub">${isConvar ? `ConVar · <code>${esc(record.Type ?? "unknown")}</code>` : "Console command"}</div>
        ${record.Help ? `<p class="description">${esc(record.Help)}</p>` : ""}
        <div class="actions">
          ${copyButton(isConvar ? "Copy convar" : "Copy command", record.Name, true)}
          ${isConvar && record.DefaultValue != null ? copyButton("Copy with default", withValue) : ""}
        </div>
      </div>
    </div>
    <div class="detail-grid">
      ${panel("Overview", kv([
        ["Name", text(record.Name), record.Name],
        isConvar && ["Type", text(record.Type ?? "unknown")],
        isConvar && ["Default", record.DefaultValue == null ? "<i>none</i>" : text(record.DefaultValue), record.DefaultValue],
        ["Help", record.Help ? text(record.Help) : "<i>none</i>"],
      ]))}
      ${panel("Scope", kv(flags.map(([label, value]) => [label, yesNo(value)])))}
      ${rawPanel(record, [[`${tab}.json`, `data/current/${tab}.json`]])}
    </div>`;
}

const welcome = (title, message) => `<div class="welcome"><span class="logo ghost">R</span><h2>${esc(title)}</h2><p>${esc(message)}</p></div>`;

async function renderDetail() {
  const { tab, key } = state;
  if (!VIEWS[tab]) return;
  document.body.classList.toggle("has-detail", key != null);
  document.querySelectorAll("#results .row").forEach((row) => row.classList.toggle("active", row.dataset.key === key));
  if (key == null) {
    $("#detail").innerHTML = welcome("Select a record", "Pick an entry from the list to see its details and copy server-ready values.");
    document.title = `${VIEWS[tab].label} · Rogue Rust Reference`;
    return;
  }
  const records = await load(tab);
  if (state.tab !== tab || state.key !== key) return;
  let record = records.find((r) => keyOf(tab, r) === key);
  if (!record && tab === "entities") {
    // Item prefab links point at entities; some of those paths only exist in the prefab list.
    if ((await load("prefabs")).some((r) => r.Path === key)) { location.replace(link("prefabs", key)); return; }
  }
  const back = '<a class="back" href="#' + tab + '">‹ Back to list</a>';
  if (!record) {
    $("#detail").innerHTML = back + welcome("Record not found", `"${key}" is not in the current ${tab} dataset. It may have been removed upstream.`);
    return;
  }
  const html = tab === "items" ? itemDetail(record, tab)
    : tab === "blueprints" ? itemDetail(lookup.items.get(key) ?? record.Item, tab)
    : tab === "entities" || tab === "prefabs" ? prefabDetail(record, tab)
    : consoleDetail(record, tab);
  $("#detail").innerHTML = back + html;
  $("#detail").scrollTop = 0;
  document.title = `${search.get(record)?.title ?? key} · Rogue Rust Reference`;
}

// ---------- list ----------

function renderFilters() {
  const view = VIEWS[state.tab];
  const sorts = [["auto", "Best match"], ["name", "Name A–Z"], ["name-desc", "Name Z–A"]];
  $("#filters").innerHTML = view.filters.map((filter) =>
    `<select data-filter="${filter.id}" aria-label="${esc(filter.label)}">${filter.options.map(([value, label]) =>
      `<option value="${esc(value)}" ${(state.filters[filter.id] ?? "") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`).join("")
    + `<select data-sort aria-label="Sort">${sorts.map(([value, label]) => `<option value="${value}" ${state.sort === value ? "selected" : ""}>${label}</option>`).join("")}</select>`;
}

async function renderList() {
  const tab = state.tab, view = VIEWS[tab];
  if (!view) return;
  $("#sectionTitle").textContent = view.label;
  $("#sectionHelp").textContent = view.help;
  $("#q").placeholder = `Search ${view.label.toLowerCase()}…`;
  $("#viewToggle").hidden = !view.grid;
  const mode = view.grid ? state.view : "list";
  document.querySelectorAll("#viewToggle button").forEach((b) => b.classList.toggle("active", b.dataset.view === mode));

  let records;
  try {
    if (!cache[`data/current/${tab}.json`]) $("#results").innerHTML = '<div class="empty-list">Loading…</div>';
    [records] = await Promise.all([load(tab), core]);
  } catch (error) {
    $("#results").innerHTML = `<div class="empty-list">Could not load this dataset.<br><small>${esc(error.message)}</small></div>`;
    return;
  }
  if (state.tab !== tab) return;
  const found = matches(tab, describe(tab, records));
  const size = PAGE_SIZE[mode];
  const pages = Math.max(1, Math.ceil(found.length / size));
  state.page = Math.min(Math.max(1, state.page), pages);
  const start = (state.page - 1) * size;
  visible = found.slice(start, start + size);

  $("#resultCount").textContent = found.length === records.length
    ? `${num(records.length)} ${view.label.toLowerCase()}`
    : `${num(found.length)} of ${num(records.length)} ${view.label.toLowerCase()}`;
  $("#pageInfo").textContent = found.length ? `${num(start + 1)}–${num(start + visible.length)} · page ${state.page} / ${pages}` : "0 results";
  $("#prev").disabled = state.page <= 1;
  $("#next").disabled = state.page >= pages;

  const results = $("#results");
  results.className = `results ${mode}`;
  results.innerHTML = visible.map((record) => {
    const key = keyOf(tab, record), { title, sub } = search.get(record);
    const picture = view.icon ? icon(view.icon(record) ?? null, mode === "grid" ? "lg" : "", title) : "";
    if (mode === "grid") {
      return `<a class="row tile ${key === state.key ? "active" : ""}" href="${link(tab, key)}" data-key="${esc(key)}" title="${esc(title)}">${picture}<b>${esc(title)}</b><small>${esc(sub)}</small></a>`;
    }
    return `<a class="row ${key === state.key ? "active" : ""}" href="${link(tab, key)}" data-key="${esc(key)}">${picture}<span class="row-text"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="pills">${(view.pills?.(record) ?? []).map(pill).join("")}</span></a>`;
  }).join("") || '<div class="empty-list">No matching records.<br><small>Try fewer words or clear the filters.</small></div>';
  results.scrollTop = 0;
}

// ---------- standalone pages ----------

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
function ago(iso) {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (minutes < 60) return format.format(-minutes, "minute");
  if (minutes < 60 * 48) return format.format(-Math.round(minutes / 60), "hour");
  return format.format(-Math.round(minutes / 1440), "day");
}

async function renderChanges() {
  const log = await fetchJson("data/changelog.json", []);
  const groups = new Map();
  for (const entry of log) groups.set(entry.at, [...(groups.get(entry.at) ?? []), entry]);
  const list = (label, tone, entry, keys, total) => {
    if (!total) return "";
    const more = total - keys.length;
    return `<div class="change-list"><h4 class="${tone}">${label} ${num(total)}</h4><div class="tags">${keys.map((k) => {
      const key = k.key ?? k;
      const fields = k.fields ? ` title="Changed: ${esc(k.fields.join(", "))}"` : "";
      return tone === "removed" ? `<span>${esc(key)}</span>` : `<a href="${link(entry.dataset, key)}"${fields}>${esc(key)}</a>`;
    }).join("")}${more > 0 ? `<span class="more">+${num(more)} more</span>` : ""}</div></div>`;
  };
  $("#page").innerHTML = `
    <div class="page-head"><h1>Changes</h1><p>What each synchronization added, removed or modified. Hover a changed record to see which fields moved.</p></div>
    ${[...groups].map(([at, entries]) => `
      <article class="change">
        <header><h2>${esc(when(at))}</h2><span>${esc(ago(at))}</span></header>
        ${entries.map((entry) => `
          <section>
            <h3><a href="#${entry.dataset}">${esc(VIEWS[entry.dataset]?.label ?? entry.dataset)}</a>
              <small>${num(entry.before)} → ${num(entry.after)} records</small></h3>
            ${list("Added", "added", entry, entry.added, entry.totals.added)}
            ${list("Removed", "removed", entry, entry.removed, entry.totals.removed)}
            ${list("Changed", "changed", entry, entry.changed, entry.totals.changed)}
          </section>`).join("")}
      </article>`).join("") || welcome("No changes recorded yet", "Entries appear here the next time upstream data changes.")}`;
}

async function renderApi() {
  const base = new URL(".", location.href).href;
  const meta = await fetchJson("data/metadata.json", {});
  const built = await fetch("api/v1/index.json", { method: "HEAD" }).then((r) => r.ok, () => false);
  const row = (path, description, example = path) => `
    <tr><td><code>${esc(path)}</code><small>${esc(description)}</small></td>
    <td class="nowrap"><a class="action" href="${esc(example)}" target="_blank" rel="noopener">Open</a> ${copyButton("Copy URL", base + example)}</td></tr>`;
  $("#page").innerHTML = `
    <div class="page-head"><h1>JSON API</h1>
      <p>Everything on this site is plain JSON served from GitHub Pages: no key, no rate limit of our own, CORS enabled. Base URL: <code>${esc(base)}</code></p></div>
    ${built ? "" : '<p class="note banner">The <code>api/v1</code> files are generated when the site is deployed, so they are not available in this local preview.</p>'}
    <div class="panel"><h3>Lookup endpoints</h3><table class="api">
      ${row("api/v1/index.json", "Endpoint directory, enum names and record counts.")}
      ${row("api/v1/items.json", "Compact item list: ID, shortname, name, category and picture URL.")}
      ${row("api/v1/items/{shortname}.json", "One item with picture, blueprint, items crafted from it and skins.", "api/v1/items/rifle.ak.json")}
      ${row("api/v1/items/by-id.json", "Item ID → shortname map.")}
      ${row("api/v1/blueprints.json", "Blueprints with ingredients as shortname references (about a fifth of the raw size).")}
    </table></div>
    <div class="panel"><h3>Raw datasets</h3><table class="api">
      ${DATASETS.map((name) => row(`data/current/${name}.json`, `${num(meta.datasets?.[name]?.count ?? 0)} records, unmodified from upstream. Last changed ${meta.datasets?.[name]?.changed_at ? when(meta.datasets[name].changed_at) : "unknown"}.`)).join("")}
      ${row("data/metadata.json", "Counts, SHA-256 hashes and change timestamps. Poll this to detect updates cheaply.")}
      ${row("data/changelog.json", "Records added, removed and changed by each sync.")}
      ${row("data/images.json", "Picture URL templates, plus the items that use the fallback host or have no picture.")}
    </table></div>
    <div class="panel"><h3>Example</h3><pre class="json">const item = await fetch("${esc(base)}api/v1/items/rifle.ak.json").then((r) => r.json());
console.log(item.DisplayName, item.Id, item.Image, item.Blueprint?.Ingredients);</pre></div>
    <p class="note">Source and update workflow: <a href="${REPO}" rel="noopener">${REPO.replace("https://", "")}</a></p>`;
}

// ---------- routing & events ----------

function renderTabs(meta) {
  $("#tabs").innerHTML = [
    ...Object.keys(VIEWS).map((name) =>
      `<a href="#${name}" data-tab="${name}"><b>${VIEWS[name].label}</b><small>${meta?.datasets?.[name] ? num(meta.datasets[name].count) : "—"}</small></a>`),
    ...Object.entries(PAGES).map(([name, label]) => `<a href="#${name}" data-tab="${name}" class="page-tab"><b>${label}</b></a>`),
  ].join("");
  markTab();
}
const markTab = () => document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === state.tab));

async function route() {
  const [rawTab, ...rest] = location.hash.slice(1).split("/");
  const tab = VIEWS[rawTab] || PAGES[rawTab] ? rawTab : "items";
  let key = null;
  try { key = rest.length ? decodeURIComponent(rest.join("/")) : null; } catch { /* malformed link: show the list */ }
  const tabChanged = tab !== state.tab;
  if (tabChanged) Object.assign(state, { q: "", filters: {}, sort: "auto", page: 1 });
  Object.assign(state, { tab, key });
  markTab();

  const isPage = Boolean(PAGES[tab]);
  $("#workspace").hidden = isPage;
  $("#page").hidden = !isPage;
  if (isPage) {
    document.body.classList.remove("has-detail");
    document.title = `${PAGES[tab]} · Rogue Rust Reference`;
    await (tab === "changes" ? renderChanges() : renderApi());
    return;
  }
  if (tabChanged || !$("#results").children.length) {
    $("#q").value = "";
    renderFilters();
    await renderList();
  }
  await core.catch(() => {});
  await renderDetail();
}

let typing;
$("#q").addEventListener("input", () => {
  clearTimeout(typing);
  typing = setTimeout(() => { state.q = $("#q").value.trim(); state.page = 1; renderList(); }, 90);
});
$("#filters").addEventListener("change", (event) => {
  if (event.target.dataset.filter) state.filters[event.target.dataset.filter] = event.target.value;
  else state.sort = event.target.value;
  state.page = 1;
  renderList();
});
$("#viewToggle").addEventListener("click", (event) => {
  const view = event.target.dataset.view;
  if (!view) return;
  state.view = view; state.page = 1;
  try { localStorage.setItem("view", view); } catch { /* storage unavailable */ }
  renderList();
});
$("#prev").addEventListener("click", () => { state.page--; renderList(); });
$("#next").addEventListener("click", () => { state.page++; renderList(); });

let toastTimer;
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const value = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(value);
    $("#toast").textContent = `Copied: ${value.length > 60 ? value.slice(0, 60) + "…" : value}`;
  } catch {
    $("#toast").textContent = "Copy failed. Your browser blocked clipboard access.";
  }
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 1600);
});

document.addEventListener("keydown", (event) => {
  const inField = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if (event.key === "/" && !inField) { event.preventDefault(); $("#q").focus(); $("#q").select(); return; }
  if (event.key === "Escape" && document.activeElement === $("#q")) { $("#q").value = ""; $("#q").dispatchEvent(new Event("input")); return; }
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && VIEWS[state.tab] && (document.activeElement === document.body || document.activeElement?.closest("#q, #results"))) {
    if (!visible.length) return;
    event.preventDefault();
    const index = visible.findIndex((record) => keyOf(state.tab, record) === state.key);
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    location.hash = link(state.tab, keyOf(state.tab, next));
    document.querySelector(`#results .row[data-key="${CSS.escape(keyOf(state.tab, next))}"]`)?.scrollIntoView({ block: "nearest" });
  }
});

window.addEventListener("hashchange", route);

(async () => {
  renderTabs(null);
  route();
  try {
    const meta = await fetchJson("data/metadata.json");
    renderTabs(meta);
    // checked_at is stamped at deploy time; a local checkout only knows the last change.
    const changed = meta.updated_at, checked = meta.checked_at ?? meta.updated_at;
    const stale = Boolean(meta.checked_at) && Date.now() - new Date(checked) > 36 * 3600 * 1000;
    $("#status").classList.toggle("stale", stale);
    $("#statusMain").textContent = `Data changed ${ago(changed)}`;
    $("#statusSub").textContent = meta.checked_at ? `${stale ? "Sync overdue · last" : "Last"} checked ${ago(checked)}` : when(changed);
    $("#status").title = `Last change: ${when(changed)}\nLast upstream check: ${when(checked)}`;
  } catch {
    $("#status").classList.add("stale");
    $("#statusMain").textContent = "Sync status unavailable";
  }
})();
