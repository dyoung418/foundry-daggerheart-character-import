// Pure helpers for the builder's content ids. No Foundry globals.
//
// A builder id is `<source>_<kind>_<snake_case_name>`, e.g. `srd_2_0_domain_card_a_soldiers_bond`
// or `void_weapon_sunfire_blade`. The source prefix is opaque (it can contain underscores and
// digits), so the kind is found by scanning for a known kind token.

export const KINDS = [
  // longest first so `domain_card` wins over nothing shorter; `subclass` before `class`
  "domain_card", "transformation", "consumable", "subclass", "ancestry", "community",
  "weapon", "armor", "class",
];

/** Foundry item type for each id kind. */
export const KIND_TO_TYPE = {
  domain_card: "domainCard", transformation: "transformation", consumable: "consumable",
  subclass: "subclass", ancestry: "ancestry", community: "community",
  weapon: "weapon", armor: "armor", class: "class",
};

export const SENTINELS = new Set(["unarmed", "unarmored"]);

/**
 * Split a builder id into its parts.
 * @param {string} id
 * @returns {{ source: string, kind: string, tail: string, bare: string } | null}
 */
export function parseId(id) {
  if (typeof id !== "string" || !id) return null;
  for (const kind of KINDS) {
    const at = id.indexOf(`_${kind}_`);
    if (at > 0) {
      const tail = id.slice(at + kind.length + 2);
      if (!tail) return null;
      return { source: id.slice(0, at), kind, tail, bare: `${kind}_${tail}` };
    }
    if (id.startsWith(`${kind}_`)) {
      return { source: "", kind, tail: id.slice(kind.length + 1), bare: id };
    }
  }
  return null;
}

/** The id without its source prefix: `srd_2_0_weapon_broadsword` → `weapon_broadsword`. */
export function bareId(id) {
  return parseId(id)?.bare ?? id;
}

/** Foundry item type for an id, or null. */
export function typeOf(id) {
  const p = parseId(id);
  return p ? KIND_TO_TYPE[p.kind] : null;
}

/** A display-name guess from the id tail: `a_soldiers_bond` → `A Soldiers Bond`. Only a fallback. */
export function nameFromId(id) {
  const p = parseId(id);
  if (!p) return null;
  return p.tail.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Comparison key for names: lowercase, accents and punctuation stripped, spaces collapsed. */
export function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/’/g, "'")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
