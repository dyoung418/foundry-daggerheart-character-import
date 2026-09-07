// Imports a builder homebrew source (its data folder's JSON files, plus optional card art) into a
// world compendium, registers any new domains and custom weapon/armor features with the system's
// Homebrew settings, and adds the pack to this module's search list, so characters using that
// content import like SRD ones.
import { MODULE_ID, SETTINGS, log, debug } from "./constants.mjs";
import { parseSourceFiles, buildHomebrewItems, artKey } from "../lib/homebrew.mjs";
import { normalizeName } from "../lib/ids.mjs";
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

/** Squashed localized label → key, for the weapon/armor features the running system knows (SRD and homebrew). */
function featureLabelMap(all) {
  const map = {};
  for (const [key, f] of Object.entries(all ?? {})) {
    const label = game.i18n.localize(f.label ?? f.name ?? "");
    const k = normalizeName(label).replace(/\s+/g, "");
    if (k) map[k] ??= key;
  }
  return map;
}

/**
 * @param {Array<File|{name:string,text?:string,blob?:Blob}>} files  the source's JSON files and any card art
 * @param {object} [options]
 * @param {(step: string) => void} [options.progress]
 * @returns {Promise<{ pack, source, created: number, replaced: number, domainsAdded: string[], featuresAdded: string[],
 *   warnings: string[], notes: string[], names: object, ignored: string[], counts: object }>}
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

  // 3. item data (SRD classes for subclasses of existing classes come from the compendia; weapon and
  //    armor feature names are matched against the system's localized labels)
  const matcher = await new CompendiumMatcher().load();
  const systemDomains = Object.keys(CONFIG.DH?.DOMAIN?.domains ?? {});
  const built = buildHomebrewItems(source, {
    packCollection: collection,
    systemDomains: systemDomains.length ? systemDomains : undefined,
    classUuid: (className) => matcher.lookup("class", className)?.uuid ?? null,
    art,
    featureKeys: { weapon: featureLabelMap(CONFIG.DH?.ITEM?.allWeaponFeatures?.()), armor: featureLabelMap(CONFIG.DH?.ITEM?.allArmorFeatures?.()) },
  });
  warnings.push(...built.warnings);

  // 4. domains must exist before a domainCard with that domain can be created; custom weapon/armor
  //    features before an item refers to them
  progress("domains");
  const { domainsAdded, featuresAdded } = await registerHomebrew(built.domains, built.customFeatures);

  // 5. documents: same ids every time, so existing ones are replaced in place
  progress("items");
  await pack.getIndex();
  const toDelete = built.items.filter((i) => pack.index.has(i._id)).map((i) => i._id);
  if (toDelete.length) await ItemClass().deleteDocuments(toDelete, { pack: collection });
  const created = await ItemClass().createDocuments(built.items, { pack: collection, keepId: true });

  // 6. weapon/armor features go on by update: the system's `_preUpdate` is what creates the
  //    feature's effects and actions on the item
  const featureUpdates = Object.entries(built.itemFeatures);
  if (featureUpdates.length) progress("features");
  for (const [id, { field, values }] of featureUpdates) {
    const doc = created.find((d) => d.id === id) ?? await pack.getDocument(id);
    if (!doc) { warnings.push(`item ${id} not found after creation; its features ${values.join(", ")} not applied`); continue; }
    try {
      await doc.update({ [`system.${field}`]: values.map((value) => ({ value, effectIds: [], actionIds: [] })) });
    } catch (err) {
      console.error(err);
      warnings.push(`${doc.name}: features ${values.join(", ")} could not be applied: ${err.message}`);
    }
  }

  // 7. settings: search this pack, remember the source
  const packs = readPackSetting();
  if (!packs.includes(collection)) await game.settings.set(MODULE_ID, SETTINGS.packs, [...packs, collection].join(", "));
  const sources = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {});
  const previous = sources[source.id] ?? {};
  sources[source.id] = {
    pack: collection, label: source.label, importedAt: new Date().toISOString(),
    counts: { ...built.counts, documents: created.length },
    domains: [...new Set([...(previous.domains ?? []), ...domainsAdded])],
    itemFeatures: [...new Set([...(previous.itemFeatures ?? []), ...featuresAdded])],
  };
  await game.settings.set(MODULE_ID, SETTINGS.homebrewSources, sources);

  const result = { pack, source, created: created.length, replaced: toDelete.length, domainsAdded, featuresAdded, warnings, notes: built.notes, names: built.names, ignored: parsed.ignored, counts: built.counts };
  log(`homebrew source ${source.id} imported into ${collection}`, result);
  return result;
}

/**
 * Add domains the system does not know, and this source's custom weapon/armor features, to the
 * system's Homebrew settings in one write (each write re-validates every actor).
 * @returns {Promise<{ domainsAdded: string[], featuresAdded: string[] }>}  feature entries are `weapon:<key>` / `armor:<key>`
 */
async function registerHomebrew(domains, customFeatures) {
  const setting = game.settings.get(SYSTEM_ID, HOMEBREW_SETTING);
  const data = typeof setting?.toObject === "function" ? setting.toObject() : foundry.utils.deepClone(setting ?? {});
  data.domains ??= {};
  data.itemFeatures ??= {};
  const domainsAdded = [];
  for (const d of domains) {
    if (data.domains[d.id] || CONFIG.DH?.DOMAIN?.domains?.[d.id]) continue;
    data.domains[d.id] = { id: d.id, label: d.label, src: d.src, description: "" };
    domainsAdded.push(d.id);
  }
  const featuresAdded = [];
  let featuresChanged = false;
  for (const kind of ["weapon", "armor"]) {
    const field = `${kind}Features`;
    data.itemFeatures[field] ??= {};
    for (const f of customFeatures?.[kind] ?? []) {
      const entry = { name: f.name, img: f.img, description: f.description, actions: {}, effects: [] };
      const current = data.itemFeatures[field][f.key];
      if (!current || current.name !== entry.name || current.description !== entry.description) { data.itemFeatures[field][f.key] = current ? { ...current, ...entry } : entry; featuresChanged = true; }
      featuresAdded.push(`${kind}:${f.key}`);
    }
  }
  if (domainsAdded.length || featuresChanged) await game.settings.set(SYSTEM_ID, HOMEBREW_SETTING, data);
  debug("homebrew registered", { domainsAdded, featuresAdded });
  return { domainsAdded, featuresAdded };
}

/**
 * Undo an import: delete the source's documents (and the pack when empty), drop it from the pack
 * list and the remembered sources; optionally remove the domains and custom weapon/armor features
 * that import added.
 */
export async function removeHomebrewSource(sourceId, { deleteDomains = false } = {}) {
  const sources = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.homebrewSources) ?? {});
  const entry = sources[sourceId];
  const collection = entry?.pack ?? `world.${homebrewPackName(sourceId)}`;
  const warnings = [];

  // 1. the documents, and the pack once empty
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

  // 2. this module's bookkeeping, before touching system settings so a failure there cannot leave a
  //    dangling entry
  await game.settings.set(MODULE_ID, SETTINGS.packs, readPackSetting().filter((p) => p !== collection).join(", "));
  delete sources[sourceId];
  await game.settings.set(MODULE_ID, SETTINGS.homebrewSources, sources);

  // 3. optionally the domains and item features that import added (the system re-renders actors on
  //    change; a failure there is reported, not fatal)
  const domains = entry?.domains ?? [];
  const features = entry?.itemFeatures ?? [];
  if (deleteDomains && (domains.length || features.length)) {
    // A domain still used by a card on an actor cannot go: the card would fail validation and the
    // system's actor refresh throws. Keep the domain and say who uses it. (A missing item feature
    // is harmless: the sheet just stops listing it.)
    const inUse = domains.length ? game.actors.filter((a) => a.items.some((i) => i.type === "domainCard" && domains.includes(i.system.domain))).map((a) => a.name) : [];
    if (inUse.length) warnings.push(`domains ${domains.join(", ")} kept: cards on ${inUse.join(", ")} still use them`);
    try {
      const setting = game.settings.get(SYSTEM_ID, HOMEBREW_SETTING);
      const data = typeof setting?.toObject === "function" ? setting.toObject() : foundry.utils.deepClone(setting ?? {});
      if (!inUse.length) for (const id of domains) delete data.domains?.[id];
      for (const f of features) {
        const [kind, key] = f.split(":");
        delete data.itemFeatures?.[`${kind}Features`]?.[key];
      }
      await game.settings.set(SYSTEM_ID, HOMEBREW_SETTING, data);
    } catch (err) {
      console.error(err);
      warnings.push(`the system's Homebrew settings could not be updated: ${err.message}`);
    }
  }
  log(`homebrew source ${sourceId} removed (${deleted} documents)`, { warnings });
  return { deleted, pack: collection, warnings };
}
