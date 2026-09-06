// Turns a builder homebrew *source* (the `data/<source>/` folder of the character builder:
// classes.json, subclasses.json, domain-cards.json, source.json) into Foundry item data for a
// compendium pack, so that characters using that content import like SRD ones. Pure — no Foundry
// globals; the caller supplies the pack collection id and creates the documents.
//
// Ids are deterministic (hash of source id + builder id), so re-importing a source updates the same
// documents and actors that already reference them keep working.
import { parseId, nameFromId } from "./ids.mjs";

export const MODULE_ID = "daggerheart-character-import";

/** Domains the system ships (module/config/domainConfig.mjs, 2.9.2). Anything else is homebrew. */
export const SYSTEM_DOMAINS = ["arcana", "blade", "bone", "codex", "dread", "grace", "midnight", "sage", "splendor", "valor"];

export const ICONS = {
  class: "systems/daggerheart/assets/icons/documents/items/laurel-crown.svg",
  subclass: "systems/daggerheart/assets/icons/documents/items/laurels.svg",
  feature: "systems/daggerheart/assets/icons/documents/items/stars-stack.svg",
  domainCard: "systems/daggerheart/assets/icons/documents/items/card-play.svg",
  loot: "icons/svg/item-bag.svg",
  homebrewDomain: "icons/svg/portal.svg",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 16-character Foundry document id derived from a string; the same input always gives the same id. */
export function stableId(input) {
  // Two independent 32-bit hashes seed a xorshift stream; 16 draws from a 62-letter alphabet.
  let h1 = 0x811c9dc5, h2 = 5381;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 33) ^ c) >>> 0;
  }
  let x = h1 || 1, y = h2 || 2, out = "";
  for (let i = 0; i < 16; i++) {
    // xorshift64-ish on two 32-bit halves
    let t = x ^ (x << 11); t >>>= 0;
    x = y;
    y = (y ^ (y >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    out += ALPHABET[y % ALPHABET.length];
  }
  return out;
}

// ---------- reading the builder's files ----------

/** `{ "en-US": "Text" }` or a bare string → string. */
export function text(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return String(value["en-US"] ?? Object.values(value)[0] ?? "");
  return String(value);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Builder description blocks (`paragraph`, `list`) → HTML. */
export function blocksToHtml(blocks) {
  if (!Array.isArray(blocks)) return blocks ? `<p>${escapeHtml(text(blocks))}</p>` : "";
  return blocks.map((b) => {
    if (!b || typeof b !== "object") return "";
    if (b.paragraph != null) return `<p>${escapeHtml(text(b.paragraph))}</p>`;
    if (Array.isArray(b.list)) return `<ul>${b.list.map((li) => `<li><p>${escapeHtml(text(li))}</p></li>`).join("")}</ul>`;
    const [k, v] = Object.entries(b)[0] ?? [];
    return k ? `<p>${escapeHtml(text(v))}</p>` : "";
  }).join("");
}

/** "BLOOD HUNTER" → "Blood Hunter" (used for class names, which the builder keys in upper case). */
export function titleCase(s) {
  return String(s ?? "").toLowerCase().replace(/(^|[\s\-'’(/])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

const looksLikeClass = (r) => r && typeof r === "object" && ("startingHitPoints" in r || "hopeFeature" in r || "classFeatures" in r);
const looksLikeSubclass = (r) => r && typeof r === "object" && ("foundation" in r || "specialization" in r || "mastery" in r);
const looksLikeCard = (r) => r && typeof r === "object" && "recallCost" in r && "domain" in r;

function kindOfArray(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  if (arr.every(looksLikeClass)) return "classes";
  if (arr.every(looksLikeSubclass)) return "subclasses";
  if (arr.every(looksLikeCard)) return "domainCards";
  return null;
}

/**
 * Parse the JSON files of one builder source.
 * @param {Array<{ name: string, text: string }>} files  any of source.json, classes.json,
 *   subclasses.json, domain-cards.json (recognised by name, then by shape); other JSON is
 *   reported and ignored. A single file holding `{ label, classes, subclasses, domainCards }` works too.
 * @returns {{ ok: boolean, error?: string, source?: HomebrewSource, ignored: string[] }}
 */
export function parseSourceFiles(files) {
  const source = { id: null, label: null, classes: [], subclasses: [], domainCards: [] };
  const ignored = [];
  const errors = [];
  for (const f of files ?? []) {
    let data;
    try { data = JSON.parse(f.text); } catch (err) { errors.push(`${f.name}: not JSON (${err.message})`); continue; }
    const base = String(f.name ?? "").split("/").pop().toLowerCase();
    if (base === "source.json" || (data && !Array.isArray(data) && Array.isArray(data.files) && "label" in data)) {
      source.label = text(data.label) || source.label;
      continue;
    }
    if (Array.isArray(data)) {
      const kind = base === "classes.json" ? "classes" : base === "subclasses.json" ? "subclasses" : base === "domain-cards.json" ? "domainCards" : kindOfArray(data);
      if (!kind) { ignored.push(f.name); continue; }
      source[kind].push(...data);
      continue;
    }
    if (data && typeof data === "object" && (data.classes || data.subclasses || data.domainCards)) {
      source.label = text(data.label ?? data.source?.label) || source.label;
      source.id = data.id ?? data.source?.id ?? source.id;
      for (const k of ["classes", "subclasses", "domainCards"]) if (Array.isArray(data[k])) source[k].push(...data[k]);
      continue;
    }
    ignored.push(f.name);
  }
  if (errors.length) return { ok: false, error: errors.join("; "), ignored };
  const records = [...source.classes, ...source.subclasses, ...source.domainCards];
  if (!records.length) return { ok: false, error: "no classes, subclasses or domain cards found", ignored };
  const bad = records.filter((r) => !r?.id || !parseId(r.id));
  if (bad.length) return { ok: false, error: `${bad.length} record(s) without a builder id (e.g. ${JSON.stringify(bad[0]?.id ?? bad[0]?.name ?? "?")})`, ignored };
  if (!source.id) {
    const counts = {};
    for (const r of records) { const s = parseId(r.id).source || "local"; counts[s] = (counts[s] ?? 0) + 1; }
    source.id = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  source.label ||= titleCase(source.id.replace(/_/g, " "));
  return { ok: true, source, ignored };
}

// ---------- building Foundry items ----------

const attribution = (label) => ({ source: label, page: null, artist: "" });

/**
 * @param {HomebrewSource} source
 * @param {object} options
 * @param {string} options.packCollection   e.g. `world.dhci-void`; uuids are `Compendium.<collection>.Item.<id>`
 * @param {string[]} [options.systemDomains]  ids the system already knows
 * @param {(className: string) => string|null} [options.classUuid]  uuid of a class not in this source (SRD)
 * @param {Record<string,string>} [options.art]  builder id (or `<subclassId>-<tier>`) → image path
 * @returns {{ items: object[], domains: Array<{id,label,src}>, names: Record<string,string>, warnings: string[] }}
 */
export function buildHomebrewItems(source, options) {
  const { packCollection, systemDomains = SYSTEM_DOMAINS, classUuid = () => null, art = {} } = options;
  if (!packCollection) throw new Error("packCollection is required");
  const uuidOf = (id) => `Compendium.${packCollection}.Item.${id}`;
  const idFor = (...parts) => stableId(`${source.id}:${parts.join(":")}`);
  // Only class/subclass/domainCard records carry `builderId` (what the matcher indexes); the
  // features and loot they own point back with `parentId`.
  const flags = (builderId, kind) => ({ [MODULE_ID]: { homebrew: { sourceId: source.id, builderId, kind } } });
  const childFlags = (parentId, kind) => ({ [MODULE_ID]: { homebrew: { sourceId: source.id, parentId, kind } } });
  const items = [];
  const names = {};
  const warnings = [];
  const domainIds = new Set();
  const label = source.label;
  let sort = 0;
  const push = (item) => { item.sort = (sort += 100000); item.folder = null; item.effects ??= []; items.push(item); return item; };

  const feature = (id, name, description, parentId, kind, img = ICONS.feature) => push({
    _id: id, name, type: "feature", img,
    system: { description, resource: null, actions: {}, attribution: attribution(label), gmNotes: "", granter: null, featureForm: "passive", actorResources: [] },
    flags: childFlags(parentId, kind),
  });

  // classes (features and starting loot first so their uuids exist)
  const classUuidByName = {};
  for (const c of source.classes) {
    const name = titleCase(text(c.name));
    const id = idFor(c.id);
    classUuidByName[String(text(c.name)).toUpperCase()] = uuidOf(id);
    names[c.id] = name;
    const features = [];
    if (c.hopeFeature) {
      const fid = idFor(c.id, "hope");
      feature(fid, text(c.hopeFeature.name) || `${name} Hope Feature`, blocksToHtml(c.hopeFeature.description), c.id, "classFeature");
      features.push({ type: "hope", item: uuidOf(fid) });
    }
    (c.classFeatures ?? []).forEach((f, i) => {
      const fid = idFor(c.id, "feature", i);
      feature(fid, text(f.name) || `${name} Feature ${i + 1}`, blocksToHtml(f.description), c.id, "classFeature");
      features.push({ type: "class", item: uuidOf(fid) });
    });
    const take = (c.classItems ?? []).map((li, i) => {
      const lid = idFor(c.id, "item", i);
      push({ _id: lid, name: text(li), type: "loot", img: ICONS.loot, system: { description: "", quantity: 1, actions: {}, attribution: attribution(label), gmNotes: "" }, flags: childFlags(c.id, "classItem") });
      return uuidOf(lid);
    });
    const domains = (c.domains ?? []).map((d) => String(d).toLowerCase());
    domains.forEach((d) => domainIds.add(d));
    const three = (arr) => { const a = (arr ?? []).map(text).slice(0, 3); while (a.length < 3) a.push(""); return a; };
    push({
      _id: id, name, type: "class", img: art[c.id] ?? ICONS.class,
      system: {
        description: blocksToHtml(c.description), domains, classItems: [],
        hitPoints: Number(c.startingHitPoints) || 5, evasion: Number(c.startingEvasion) || 0,
        features, inventory: { take, choiceA: [], choiceB: [] },
        characterGuide: { suggestedTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 }, suggestedPrimaryWeapon: null, suggestedSecondaryWeapon: null, suggestedArmor: null },
        backgroundQuestions: three(c.backgroundQuestions), connections: three(c.connections),
        isMulticlass: false, levelupOptionTiers: { 2: {}, 3: {}, 4: {} },
        attribution: attribution(label), gmNotes: "",
      },
      flags: flags(c.id, "class"),
    });
  }

  // subclasses
  for (const s of source.subclasses) {
    const name = text(s.name);
    const id = idFor(s.id);
    names[s.id] = name;
    const className = String(text(s.class)).toUpperCase();
    const linkedClass = classUuidByName[className] ?? classUuid(titleCase(className)) ?? null;
    if (!linkedClass) warnings.push(`subclass ${name}: class ${titleCase(className)} not found in this source or the compendia; it will not attach to a class`);
    const features = [];
    for (const tier of ["foundation", "specialization", "mastery"]) {
      (s[tier]?.features ?? []).forEach((f, i) => {
        const fid = idFor(s.id, tier, i);
        feature(fid, text(f.name) || `${name} ${titleCase(tier)} ${i + 1}`, blocksToHtml(f.description), s.id, "subclassFeature", art[`${s.id}-${tier}`] ?? ICONS.feature);
        features.push({ type: tier, item: uuidOf(fid) });
      });
    }
    const trait = s.spellcastTrait ? String(s.spellcastTrait).toLowerCase() : null;
    push({
      _id: id, name, type: "subclass", img: art[`${s.id}-foundation`] ?? art[s.id] ?? ICONS.subclass,
      system: { description: blocksToHtml(s.description), spellcastingTrait: trait, features, featureState: 1, isMulticlass: false, linkedClass, attribution: attribution(label), gmNotes: "" },
      flags: flags(s.id, "subclass"),
    });
  }

  // domain cards
  for (const c of source.domainCards) {
    const name = text(c.name);
    const id = idFor(c.id);
    names[c.id] = name;
    const domain = String(c.domain ?? "").toLowerCase();
    domainIds.add(domain);
    const type = String(c.type ?? "ability").toLowerCase();
    const description = (c.features ?? []).map((f) => {
      const head = f.name ? `<p><strong>${escapeHtml(text(f.name))}</strong></p>` : "";
      return head + blocksToHtml(f.description);
    }).join("") || blocksToHtml(c.description);
    const img = art[c.id] ?? (systemDomains.includes(domain) ? `systems/daggerheart/assets/icons/domains/domain-card/${domain}.png` : ICONS.domainCard);
    push({
      _id: id, name, type: "domainCard", img,
      system: {
        description, domain, level: Number(c.level) || 1, recallCost: Number(c.recallCost) || 0,
        type: ["ability", "spell", "grimoire"].includes(type) ? type : "ability",
        actions: {}, resource: null, inVault: false, vaultActive: false, loadoutIgnore: false, domainTouched: null,
        attribution: attribution(label), gmNotes: "",
      },
      flags: flags(c.id, "domainCard"),
    });
  }

  const domains = [...domainIds].filter((d) => d && !systemDomains.includes(d)).sort()
    .map((d) => ({ id: d, label: titleCase(d.replace(/[_-]+/g, " ")), src: ICONS.homebrewDomain }));
  return { items, domains, names, warnings };
}

/** Human summary of a parsed source for the dialog. */
export function describeSource(source) {
  const n = (arr, word) => `${arr.length} ${word}${arr.length === 1 ? "" : "s"}`;
  return `${source.label} (${source.id}): ${n(source.classes, "class").replace("classs", "classes")}, ${n(source.subclasses, "subclass").replace("subclasss", "subclasses")}, ${n(source.domainCards, "domain card")}`;
}

/**
 * Which item an art file belongs to: `void_domain_card_blood_spike.png` → that card;
 * `void_subclass_necromancy-mastery.png` → the mastery tier of that subclass.
 * @returns {string|null} the key used in `options.art`
 */
export function artKey(fileName) {
  const base = String(fileName ?? "").split("/").pop().replace(/\.(png|webp|jpe?g|svg)$/i, "");
  if (!base) return null;
  const m = /^(.+)-(foundation|specialization|mastery)$/.exec(base);
  if (m && parseId(m[1])) return `${m[1]}-${m[2]}`;
  return parseId(base) ? base : null;
}

export { nameFromId };
