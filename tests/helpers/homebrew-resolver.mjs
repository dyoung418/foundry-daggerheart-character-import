// A resolver that layers items built from a homebrew source over the compendium fixture, the way
// CompendiumMatcher does once the source's pack is in the packs setting.
import { normalizeName } from "../../scripts/lib/ids.mjs";
import { fixtureResolver } from "./fixture-resolver.mjs";

const MODULE_ID = "daggerheart-character-import";

export function homebrewResolver(built, options = {}) {
  const base = fixtureResolver(options);
  const byType = {};
  const byBuilderId = {};
  for (const item of built.items) {
    const sys = item.system;
    const entry = {
      uuid: `Compendium.${options.packCollection ?? "world.dhci-test"}.Item.${item._id}`, name: item.name, type: item.type,
      domain: sys.domain, level: sys.level, features: sys.features, linkedClass: sys.linkedClass,
      spellcastingTrait: sys.spellcastingTrait, domains: sys.domains, hitPoints: sys.hitPoints, evasion: sys.evasion,
      inventory: sys.inventory ? { take: sys.inventory.take ?? [] } : null, levelupOptionTiers: sys.levelupOptionTiers ?? null,
    };
    (byType[item.type] ??= {})[normalizeName(item.name)] ??= entry;
    const hb = item.flags?.[MODULE_ID]?.homebrew;
    if (hb?.builderId) byBuilderId[hb.builderId] ??= entry;
  }
  return {
    ...base,
    lookup: (type, name) => base.lookup(type, name) ?? byType[type]?.[normalizeName(name)] ?? null,
    lookupById: (id) => byBuilderId[id] ?? null,
    nameOf: (id) => base.nameOf(id) ?? byBuilderId[id]?.name ?? null,
  };
}
