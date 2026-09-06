// Builds data/names.json: builder content id (bare, source prefix stripped) → display name,
// from the builder's SRD data folders. Run from this repo:
//   node tools/build-name-index.mjs [builder-data-dir ...]
// Defaults to ~/daggerheart-character-builder/data/srd_2_0 and srd_1_0. Later sources win.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { bareId, parseId } from "../scripts/lib/ids.mjs";

const FILES = ["classes", "subclasses", "ancestries", "communities", "transformations", "domain-cards", "weapons", "armors", "consumables"];
const dirs = process.argv.slice(2);
if (!dirs.length) {
  const base = join(homedir(), "daggerheart-character-builder", "data");
  dirs.push(join(base, "srd_1_0"), join(base, "srd_2_0"));
}

const names = {};
const extras = {}; // per-id details worth having offline: level/domain for cards, tier for gear
let count = 0;
for (const dir of dirs) {
  for (const file of FILES) {
    const path = join(dir, `${file}.json`);
    if (!existsSync(path)) continue;
    for (const rec of JSON.parse(readFileSync(path, "utf8"))) {
      const p = parseId(rec.id);
      if (!p) { console.warn("unparsable id", rec.id); continue; }
      const name = typeof rec.name === "string" ? titleCase(rec.name) : rec.name?.["en-US"];
      if (!name) { console.warn("no name", rec.id); continue; }
      names[p.bare] = name;
      const x = {};
      if (rec.level !== undefined) x.level = rec.level;
      if (rec.domain) x.domain = String(rec.domain).toLowerCase();
      if (rec.tier !== undefined) x.tier = rec.tier;
      if (rec.class) x.class = titleCase(rec.class);
      if (Array.isArray(rec.features) && ["ancestry", "transformation"].includes(p.kind)) x.features = rec.features.map((f) => f.name?.["en-US"]).filter(Boolean);
      if (Object.keys(x).length) extras[p.bare] = x;
      count++;
    }
  }
}
function titleCase(s) { return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }

const out = { _generated: new Date().toISOString(), _sources: dirs, names, extras };
writeFileSync(new URL("../data/names.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(names).length} names from ${count} records`);
