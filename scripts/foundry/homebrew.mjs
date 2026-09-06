// Imports a builder homebrew source (its data folder's JSON files, plus optional card art) into a
// world compendium, registers any new domains with the system's Homebrew settings, and adds the
// pack to this module's search list, so characters using that content import like SRD ones.
import { MODULE_ID, SETTINGS, log, debug } from "./constants.mjs";
import { parseSourceFiles, buildHomebrewItems, artKey } from "../lib/homebrew.mjs";
import { CompendiumMatcher, readPackSetting } from "./matcher.mjs";
import { uploadFile } from "./portrait.mjs";

const SYSTEM_ID = "daggerheart";
const HOMEBREW_SETTING = "Homebrew";
const IMAGE_RE = /\.(png|webp|jpe?g|svg)$/i;

/** World compendium name for a source: `world.dhci-<source>`. */
export function homebrewPackName(sourceId) {
  return `dhci-${String(sourceId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

const CompendiumCollectionClass = () => foundry.documents?.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
const ItemClass = () => foundry.utils.getDocumentClass ? foundry.utils.getDocumentClass("Item") : getDocumentClass("Item");

/**
 * @param {Array<File|{name:string,text?:string,blob?:Blob}>} files  the source's JSON files and any card art
 * @param {object} [options]
 * @param {(step: string) => void} [options.progress]
 * @returns {Promise<{ pack, source, created: number, replaced: number, domainsAdded: string[], warnings: string[], names: object, ignored: string[] }>}
 */
export async function importHomebrewSource(files, { progress = () => {} } = {}) {
  if (!game.user.isGM) throw new Error("only a GM can import homebrew sources (they create compendia and change system settings)");
  const jsonFiles = [], imageFiles = [];
  for (const f of files ?? []) (IMAGE_RE.test(f.name) ? imageFiles : jsonFiles).push(f);
  const texts = await Promise.all(jsonFiles.map(async (f) => ({ name: f.name, text: typeof f.text === "string" ? f.text : await f.text() })));
  const parsed = parseSourceFiles(texts);
  if (!parsed.ok) throw new Error(parsed.error);
  const source = parsed.source;
  const warnings = [];

  // 1. the pack
  progress("pack");
  const name = homebrewPackName(source.id);
  const collection = `world.${name}`;
  let pack = game.packs.get(collection);
  if (!pack) {
    pack = await CompendiumCollectionClass().createCompendium({ label: `Builder homebrew: ${source.label}`, name, type: "Item" });
    if (!pack) throw new Error(`could not create compendium ${collection}`);
  }
  if (pack.locked) await pack.configure({ locked: false });

  // 2. card art
  progress("art");
  const art = {};
  for (const f of imageFiles) {
    const key = artKey(f.name);
    if (!key) { warnings.push(`image ${f.name} skipped: not named after a builder id`); continue; }
    const file = f instanceof File ? f : new File([f.blob], f.name.split("/").pop());
    const path = await uploadFile(`${MODULE_ID}/homebrew/${name}`, file);
    if (path) art[key] = path; else warnings.push(`image ${f.name} could not be uploaded`);
  }

  // 3. item data (SRD classes for subclasses of existing classes come from the compendia)
  const matcher = await new CompendiumMatcher().load();
  const systemDomains = Object.keys(CONFIG.DH?.DOMAIN?.domains ?? {});
  const built = buildHomebrewItems(source, {
    packCollection: collection,
    systemDomains: systemDomains.length ? systemDomains : undefined,
    classUuid: (className) => matcher.lookup("class", className)?.uuid ?? null,
    art,
  });
  warnings.push(...built.warnings);

  // 4. domains must exist before a domainCard with that domain can be created
  progress("domains");
  const domainsAdded = await registerDomains(built.domains);

  // 5. documents: same ids every time, so existing ones are replaced in place
  progress("items");
  await pack.getIndex();
  const toDelete = built.items.filter((i) => pack.index.has(i._id)).map((i) => i._id);
  if (toDelete.length) await ItemClass().deleteDocuments(toDelete, { pack: collection });
  const created = await ItemClass().createDocuments(built.items, { pack: collection, keepId: true });

  // 6. settings: search this pack, remember the source
  const packs = readPackSetting();
  if (!packs.includes(collection)) await game.settings.set(MODULE_ID, SETTINGS.packs, [...packs, collection].join(", "));
  const sources = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {});
  sources[source.id] = {
    pack: collection, label: source.label, importedAt: new Date().toISOString(),
    counts: { classes: source.classes.length, subclasses: source.subclasses.length, domainCards: source.domainCards.length, items: created.length },
    domains: [...new Set([...(sources[source.id]?.domains ?? []), ...domainsAdded])],
  };
  await game.settings.set(MODULE_ID, SETTINGS.homebrewSources, sources);

  const result = { pack, source, created: created.length, replaced: toDelete.length, domainsAdded, warnings, names: built.names, ignored: parsed.ignored };
  log(`homebrew source ${source.id} imported into ${collection}`, result);
  return result;
}

/** Add domains the system does not know to its Homebrew settings. Returns the ids added. */
async function registerDomains(domains) {
  if (!domains.length) return [];
  const setting = game.settings.get(SYSTEM_ID, HOMEBREW_SETTING);
  const data = typeof setting?.toObject === "function" ? setting.toObject() : foundry.utils.deepClone(setting ?? {});
  data.domains ??= {};
  const added = [];
  for (const d of domains) {
    if (data.domains[d.id] || CONFIG.DH?.DOMAIN?.domains?.[d.id]) continue;
    data.domains[d.id] = { id: d.id, label: d.label, src: d.src, description: "" };
    added.push(d.id);
  }
  if (added.length) await game.settings.set(SYSTEM_ID, HOMEBREW_SETTING, data);
  debug("homebrew domains", { added });
  return added;
}

/**
 * Undo an import: delete the source's documents (and the pack when empty), drop it from the pack
 * list and the remembered sources; optionally remove the domains that import added.
 */
export async function removeHomebrewSource(sourceId, { deleteDomains = false } = {}) {
  const sources = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {});
  const entry = sources[sourceId];
  const collection = entry?.pack ?? `world.${homebrewPackName(sourceId)}`;
  const pack = game.packs.get(collection);
  let deleted = 0;
  if (pack) {
    if (pack.locked) await pack.configure({ locked: false });
    const index = await pack.getIndex({ fields: [`flags.${MODULE_ID}.homebrew`] });
    const ids = index.filter((e) => e.flags?.[MODULE_ID]?.homebrew?.sourceId === sourceId).map((e) => e._id);
    if (ids.length) await ItemClass().deleteDocuments(ids, { pack: collection });
    deleted = ids.length;
    if (index.size - ids.length <= 0) await pack.deleteCompendium();
  }
  const packs = readPackSetting().filter((p) => p !== collection);
  await game.settings.set(MODULE_ID, SETTINGS.packs, packs.join(", "));
  if (deleteDomains && entry?.domains?.length) {
    const setting = game.settings.get(SYSTEM_ID, HOMEBREW_SETTING);
    const data = typeof setting?.toObject === "function" ? setting.toObject() : foundry.utils.deepClone(setting ?? {});
    for (const id of entry.domains) delete data.domains?.[id];
    await game.settings.set(SYSTEM_ID, HOMEBREW_SETTING, data);
  }
  delete sources[sourceId];
  await game.settings.set(MODULE_ID, SETTINGS.homebrewSources, sources);
  log(`homebrew source ${sourceId} removed (${deleted} documents)`);
  return { deleted, pack: collection };
}
