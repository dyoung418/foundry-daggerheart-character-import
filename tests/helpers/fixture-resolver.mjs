// A resolver built from tests/fixtures/compendium-index.json (system src/packs) and data/names.json.
import { readFileSync } from "node:fs";
import { normalizeName, bareId } from "../../scripts/lib/ids.mjs";

const index = JSON.parse(readFileSync(new URL("../fixtures/compendium-index.json", import.meta.url), "utf8")).index;
const names = JSON.parse(readFileSync(new URL("../../data/names.json", import.meta.url), "utf8"));

export function fixtureResolver({ ids = null } = {}) {
  let n = 0;
  return {
    lookup: (type, name) => index[type]?.[normalizeName(name)] ?? null,
    nameOf: (id) => names.names[bareId(id)] ?? null,
    featureNames: (id) => names.extras[bareId(id)]?.features ?? [],
    newId: () => (ids ? ids[n++] : `id${String(++n).padStart(14, "0")}`),
  };
}
export const sample = (name) => readFileSync(new URL(`../../samples/${name}`, import.meta.url), "utf8");
