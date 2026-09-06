// Compendium lookup for the plan builder: implements the resolver contract in lib/plan.mjs.
import { MODULE_ID, SETTINGS, debug } from "./constants.mjs";
import { normalizeName, bareId } from "../lib/ids.mjs";

export const DEFAULT_PACKS = [
  "daggerheart.classes", "daggerheart.subclasses", "daggerheart.ancestries", "daggerheart.communities",
  "daggerheart.domains", "daggerheart.weapons", "daggerheart.armors", "daggerheart.consumables",
  "daggerheart.loot", "daggerheart.transformations",
];
const INDEX_FIELDS = [
  "type", "system.domain", "system.level", "system.tier", "system.secondary", "system.features",
  "system.linkedClass", "system.spellcastingTrait", "system.domains", "system.hitPoints", "system.evasion",
  "system.inventory.take",
];

let namesCache = null;
async function loadNames() {
  if (namesCache) return namesCache;
  try {
    const res = await fetch(`modules/${MODULE_ID}/data/names.json`);
    namesCache = res.ok ? await res.json() : { names: {}, extras: {} };
  } catch {
    namesCache = { names: {}, extras: {} };
  }
  return namesCache;
}

export class CompendiumMatcher {
  constructor(packIds = null) {
    this.packIds = packIds ?? readPackSetting();
    this.index = {};   // type → normalized name → entry
    this.names = { names: {}, extras: {} };
    this.renames = {};
  }

  async load() {
    this.names = await loadNames();
    try {
      const res = await fetch(`modules/${MODULE_ID}/data/renames.json`);
      if (res.ok) this.renames = await res.json();
    } catch { /* optional */ }
    for (const id of this.packIds) {
      const pack = game.packs.get(id);
      if (!pack) { debug(`pack ${id} not found`); continue; }
      const entries = await pack.getIndex({ fields: INDEX_FIELDS });
      for (const e of entries) {
        if (!e.type || !e.name) continue;
        const sys = e.system ?? {};
        const entry = {
          uuid: e.uuid, name: e.name, type: e.type, pack: id,
          domain: sys.domain, level: sys.level, tier: sys.tier, secondary: sys.secondary,
          features: sys.features, linkedClass: sys.linkedClass, spellcastingTrait: sys.spellcastingTrait,
          domains: sys.domains, hitPoints: sys.hitPoints, evasion: sys.evasion,
          inventory: sys.inventory ? { take: sys.inventory.take ?? [] } : null,
        };
        const key = normalizeName(e.name);
        (this.index[e.type] ??= {})[key] ??= entry;   // first pack in the list wins
      }
    }
    debug("matcher loaded", Object.fromEntries(Object.entries(this.index).map(([t, m]) => [t, Object.keys(m).length])));
    return this;
  }

  lookup(type, name) {
    const byType = this.index[type];
    if (!byType) return null;
    const renamed = this.renames[`${type}|${name}`] ?? this.renames[name];
    return byType[normalizeName(renamed ?? name)] ?? byType[normalizeName(name)] ?? null;
  }

  nameOf(builderId) {
    return this.names.names?.[bareId(builderId)] ?? null;
  }

  featureNames(ancestryId) {
    return this.names.extras?.[bareId(ancestryId)]?.features ?? [];
  }

  newId() {
    return foundry.utils.randomID();
  }
}

export function readPackSetting() {
  try {
    const raw = game.settings.get(MODULE_ID, SETTINGS.packs);
    const list = String(raw ?? "").split(/[\s,]+/).filter(Boolean);
    return list.length ? list : DEFAULT_PACKS;
  } catch {
    return DEFAULT_PACKS;
  }
}
