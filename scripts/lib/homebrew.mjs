// Turns a builder homebrew *source* (the `data/<source>/` folder of the character builder:
// source.json, classes.json, subclasses.json, domain-cards.json, ancestries.json, communities.json,
// transformations.json, items.json, weapons.json, armors.json, consumables.json, effects.json) into
// Foundry item data for a compendium pack, so that characters using that content import like SRD
// ones. Pure — no Foundry globals; the caller supplies the pack collection id and creates the
// documents.
//
// Ids are deterministic (hash of source id + builder id), so re-importing a source updates the same
// documents and actors that already reference them keep working.
import { parseId, nameFromId, normalizeName } from "./ids.mjs";

export const MODULE_ID = "daggerheart-character-import";

/** Domains the system ships (module/config/domainConfig.mjs, 2.9.2). Anything else is homebrew. */
export const SYSTEM_DOMAINS = ["arcana", "blade", "bone", "codex", "dread", "grace", "midnight", "sage", "splendor", "valor"];

const SYS = "systems/daggerheart/assets/icons/documents/items";
export const ICONS = {
  class: `${SYS}/laurel-crown.svg`,
  subclass: `${SYS}/laurels.svg`,
  feature: `${SYS}/stars-stack.svg`,
  domainCard: `${SYS}/card-play.svg`,
  ancestry: `${SYS}/family-tree.svg`,
  community: `${SYS}/village.svg`,
  transformation: `${SYS}/vampire-dracula.svg`,
  loot: `${SYS}/open-treasure-chest.svg`,
  consumable: `${SYS}/round-potion.svg`,
  weapon: `${SYS}/battered-axe.svg`,
  armor: `${SYS}/chest-armor.svg`,
  classItem: "icons/svg/item-bag.svg",
  homebrewDomain: "icons/svg/portal.svg",
  itemFeature: "icons/magic/life/cross-worn-green.webp",
};

/** The record categories of a source, in the builder's file order. */
export const CATEGORIES = ["classes", "subclasses", "ancestries", "communities", "transformations", "domainCards", "items", "weapons", "armors", "consumables"];
const FILE_TO_CATEGORY = {
  "classes.json": "classes", "subclasses.json": "subclasses", "ancestries.json": "ancestries", "communities.json": "communities",
  "transformations.json": "transformations", "domain-cards.json": "domainCards", "items.json": "items", "weapons.json": "weapons",
  "armors.json": "armors", "armor.json": "armors", "consumables.json": "consumables",
};
const CATEGORY_LABELS = {
  classes: ["class", "classes"], subclasses: ["subclass", "subclasses"], ancestries: ["ancestry", "ancestries"],
  communities: ["community", "communities"], transformations: ["transformation", "transformations"],
  domainCards: ["domain card", "domain cards"], items: ["item", "items"], weapons: ["weapon", "weapons"],
  armors: ["armor", "armor"], consumables: ["consumable", "consumables"],
};

/** Weapon and armor feature keys the system knows (module/config/itemConfig.mjs, 2.9.2). */
export const SYSTEM_WEAPON_FEATURES = ["accelerator", "aimed", "barrier", "bolstering", "bonded", "bouncing", "braced", "brave", "brutal", "burning", "catalytic", "charged", "concussive", "cumbersome", "deadly", "deflecting", "destructive", "devastating", "disturbing", "doubleDuty", "doubledUp", "draining", "dueling", "entangling", "eruptive", "ethereal", "extending", "focused", "followUp", "freezing", "grappling", "greedy", "healing", "heavy", "hooked", "hot", "incendiary", "invigorating", "inverted", "lifestealing", "lockedOn", "long", "lucky", "magnetic", "massive", "nonlethal", "omnipresent", "padded", "painful", "paired", "parry", "persuasive", "poisonous", "pompous", "powerful", "protective", "quick", "rebounding", "recursive", "reliable", "reloading", "retractable", "returning", "ricochet", "scary", "selfCorrecting", "serrated", "sharpwing", "sheltering", "startling", "stockpiled", "targeted", "timebending", "trusty", "venomous", "vitreous", "volleyed", "wallCrawling"];
export const SYSTEM_ARMOR_FEATURES = ["absorbing", "accursed", "aquatic", "attuned", "blessed", "bloodthirsty", "bulky", "burning", "channeling", "cumbersome", "difficult", "divine", "enchanted", "flexible", "fortified", "fortuneFavored", "ghostwalker", "gilded", "gliding", "heavy", "hopeful", "impenetrable", "lined", "magical", "magnificent", "mnemonic", "painful", "physical", "quiet", "quickStriding", "reinforced", "resilient", "resplendent", "selfHealing", "sharp", "shifting", "stellar", "timeslowing", "truthseeking", "veryheavy", "vigilant", "vitreous", "wallCrawling", "warded"];
/** Builder feature names whose system key is not just the name squashed. */
const FEATURE_ALIASES = { armor: { magic: "magical" }, weapon: {} };

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

/** Builder `features[]` (named or not) → HTML, each name as a bold heading. */
function featuresToHtml(features) {
  return (features ?? []).map((f) => {
    const head = f?.name ? `<p><strong>${escapeHtml(text(f.name))}</strong></p>` : "";
    return head + blocksToHtml(f?.description);
  }).join("");
}

/** "BLOOD HUNTER" → "Blood Hunter" (used for class names, which the builder keys in upper case). */
export function titleCase(s) {
  return String(s ?? "").toLowerCase().replace(/(^|[\s\-'’(/])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

const isObj = (r) => r && typeof r === "object" && !Array.isArray(r);
const looksLikeClass = (r) => isObj(r) && ("startingHitPoints" in r || "hopeFeature" in r || "classFeatures" in r);
const looksLikeSubclass = (r) => isObj(r) && ("foundation" in r || "specialization" in r || "mastery" in r);
const looksLikeCard = (r) => isObj(r) && "recallCost" in r && "domain" in r;
const looksLikeCommunity = (r) => isObj(r) && "personalities" in r;
const looksLikeTransformation = (r) => isObj(r) && "transformationQuestions" in r;
const looksLikeWeapon = (r) => isObj(r) && ("damage" in r || "burden" in r);
const looksLikeArmor = (r) => isObj(r) && ("baseScore" in r || "baseThresholds" in r || "baseMajorThreshold" in r);
const looksLikeLoot = (r) => isObj(r) && ("set" in r || "roll" in r) && !looksLikeWeapon(r) && !looksLikeArmor(r);
const looksLikeAncestry = (r) => isObj(r) && Array.isArray(r.features) && !looksLikeClass(r) && !looksLikeSubclass(r) && !looksLikeCard(r)
  && !looksLikeCommunity(r) && !looksLikeTransformation(r) && !looksLikeWeapon(r) && !looksLikeArmor(r) && !looksLikeLoot(r);

function kindOfArray(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  if (arr.every(looksLikeClass)) return "classes";
  if (arr.every(looksLikeSubclass)) return "subclasses";
  if (arr.every(looksLikeCard)) return "domainCards";
  if (arr.every(looksLikeCommunity)) return "communities";
  if (arr.every(looksLikeTransformation)) return "transformations";
  if (arr.every(looksLikeWeapon)) return "weapons";
  if (arr.every(looksLikeArmor)) return "armors";
  if (arr.every(looksLikeLoot)) return arr.every((r) => parseId(r.id)?.kind === "consumable") ? "consumables" : "items";
  if (arr.every(looksLikeAncestry)) return "ancestries";
  return null;
}

/** An effects.json: an object whose keys are builder ids (optionally `:discriminator`) and whose values are objects. */
function looksLikeEffects(data) {
  if (!isObj(data) || "label" in data || "files" in data) return false;
  const entries = Object.entries(data);
  return entries.length > 0 && entries.every(([k, v]) => isObj(v) && /^[a-z0-9_]+(:.+)?$/i.test(k));
}

export function emptySource() {
  const source = { id: null, label: null, effects: {} };
  for (const c of CATEGORIES) source[c] = [];
  return source;
}

/**
 * Parse the JSON files of one builder source.
 * @param {Array<{ name: string, text: string }>} files  any of the source's JSON files (recognised
 *   by name, then by shape); other JSON is reported and ignored. A single file holding
 *   `{ label, classes, subclasses, domainCards, … }` works too.
 * @returns {{ ok: boolean, error?: string, source?: HomebrewSource, ignored: string[] }}
 */
export function parseSourceFiles(files) {
  const source = emptySource();
  const ignored = [];
  const errors = [];
  for (const f of files ?? []) {
    let data;
    try { data = JSON.parse(f.text); } catch (err) { errors.push(`${f.name}: not JSON (${err.message})`); continue; }
    const base = String(f.name ?? "").split("/").pop().toLowerCase();
    if (base === "source.json" || (isObj(data) && Array.isArray(data.files) && "label" in data)) {
      source.label = text(data.label) || source.label;
      continue;
    }
    if (Array.isArray(data)) {
      const kind = FILE_TO_CATEGORY[base] ?? kindOfArray(data);
      if (!kind) { ignored.push(f.name); continue; }
      source[kind].push(...data);
      continue;
    }
    if (base === "effects.json" || looksLikeEffects(data)) {
      Object.assign(source.effects, data);
      continue;
    }
    if (isObj(data) && CATEGORIES.some((c) => Array.isArray(data[c]))) {
      source.label = text(data.label ?? data.source?.label) || source.label;
      source.id = data.id ?? data.source?.id ?? source.id;
      for (const c of CATEGORIES) if (Array.isArray(data[c])) source[c].push(...data[c]);
      if (isObj(data.effects)) Object.assign(source.effects, data.effects);
      continue;
    }
    ignored.push(f.name);
  }
  if (errors.length) return { ok: false, error: errors.join("; "), ignored };
  const records = CATEGORIES.flatMap((c) => source[c]);
  if (!records.length) return { ok: false, error: `no ${CATEGORIES.map((c) => CATEGORY_LABELS[c][1]).join(", ")} found`, ignored };
  // Loot and consumables are never referenced by a character, and their builder ids may lack a
  // kind segment (`homebrew_snack`), so any non-empty id will do there.
  const loose = new Set([...source.items, ...source.consumables]);
  const bad = records.filter((r) => !r?.id || typeof r.id !== "string" || (!loose.has(r) && !parseId(r.id)));
  if (bad.length) return { ok: false, error: `${bad.length} record(s) without a builder id (e.g. ${JSON.stringify(bad[0]?.id ?? bad[0]?.name ?? "?")})`, ignored };
  if (!source.id) {
    const counts = {};
    for (const r of records) { const p = parseId(r.id); if (!p) continue; const s = p.source || "local"; counts[s] = (counts[s] ?? 0) + 1; }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    source.id = best?.[0] ?? String(source.label ?? "homebrew").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") ?? "homebrew";
  }
  source.label ||= titleCase(source.id.replace(/_/g, " "));
  return { ok: true, source, ignored };
}

// ---------- weapon and armor feature keys ----------

const squash = (s) => normalizeName(String(s ?? "")).replace(/\s+/g, "");

/**
 * The system key for a builder weapon/armor feature name, or null when the system has no such
 * feature: "Double Duty" → doubleDuty, "Very Heavy" → veryheavy, "Magic" → magical.
 * @param {"weapon"|"armor"} kind
 * @param {Record<string,string>} [extra]  squashed label → key (from the running system's config)
 */
export function featureKey(kind, name, extra = {}) {
  const key = squash(name);
  if (!key) return null;
  const alias = FEATURE_ALIASES[kind]?.[key];
  if (alias) return alias;
  if (extra[key]) return extra[key];
  const known = kind === "weapon" ? SYSTEM_WEAPON_FEATURES : SYSTEM_ARMOR_FEATURES;
  return known.find((k) => k.toLowerCase() === key) ?? null;
}

// ---------- effects.json → ActiveEffect changes ----------

export const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
/** Builder stat key → actor path an ActiveEffect can add to. `armorScore` has none (derived from the armor item). */
export const EFFECT_KEYS = {
  evasion: "system.evasion",
  hitPointSlots: "system.resources.hitPoints.max",
  stressSlots: "system.resources.stress.max",
  majorThreshold: "system.damageThresholds.major",
  severeThreshold: "system.damageThresholds.severe",
  attack: "system.bonuses.roll.attack.bonus",
  spellcast: "system.bonuses.roll.spellcast.bonus",
  extraDomainCards: "system.bonuses.maxLoadout",
};
const TIERS = ["foundation", "specialization", "mastery"];

/**
 * One builder effects entry → `{ changes, notes }`: the numeric parts as system change rows, and a
 * note for every part the system cannot apply on its own.
 */
export function effectChanges(entry, label) {
  const changes = [];
  const notes = [];
  const add = (key, value) => {
    if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
      changes.push({ key, type: value < 0 ? "subtract" : "add", value: Math.abs(value), priority: null, phase: "initial" });
      return true;
    }
    if (isObj(value) && "equalTo" in value) { notes.push(`${label}: ${key.replace(/^system\./, "")} equal to ${value.equalTo} is not automated (the system has no scaling effect); apply by hand`); return true; }
    return false;
  };
  for (const [k, v] of Object.entries(entry ?? {})) {
    if (k === "traits" && isObj(v)) {
      for (const [t, n] of Object.entries(v)) {
        const trait = String(t).toLowerCase();
        if (!TRAITS.includes(trait)) { notes.push(`${label}: unknown trait ${t}`); continue; }
        if (!add(`system.traits.${trait}.value`, n)) notes.push(`${label}: trait ${trait} value ${JSON.stringify(n)} not understood`);
      }
    } else if (k in EFFECT_KEYS) {
      if (!add(EFFECT_KEYS[k], v)) notes.push(`${label}: ${k} value ${JSON.stringify(v)} not understood`);
    } else if (k === "armorScore") {
      notes.push(`${label}: +${v} Armor Score is not automated (the system derives Armor Score from the armor item); raise the armor's score by hand`);
    } else if (k === "excluded" && Array.isArray(v)) {
      for (const line of v) notes.push(`${label}: ${text(line)}`);
    } else if (k === "choice") {
      notes.push(`${label}: has a choice (${text(v?.prompt) || v?.kind || "?"}) the builder asks for; apply the chosen benefit by hand`);
    } else if (k === "base" || k === "track" || k === "when") {
      notes.push(`${label}: "${k}" is not automated`);
    } else if (k === "feature" || k === "permanent") {
      // consumed by the caller
    } else {
      notes.push(`${label}: "${k}" is not a known effect key`);
    }
  }
  return { changes, notes };
}

// ---------- building Foundry items ----------

const attribution = (label) => ({ source: label, page: null, artist: "" });
const lower = (s) => String(s ?? "").toLowerCase();
const RANGES = { melee: "melee", very_close: "veryClose", close: "close", far: "far", very_far: "veryFar" };

/**
 * @param {HomebrewSource} source
 * @param {object} options
 * @param {string} options.packCollection   e.g. `world.dhci-void`; uuids are `Compendium.<collection>.Item.<id>`
 * @param {string[]} [options.systemDomains]  ids the system already knows
 * @param {(className: string) => string|null} [options.classUuid]  uuid of a class not in this source (SRD)
 * @param {Record<string,string>} [options.art]  builder id (or `<subclassId>-<tier>`) → image path
 * @param {{weapon?: Record<string,string>, armor?: Record<string,string>}} [options.featureKeys]
 *   extra squashed-label → key maps for weapon/armor features the running system knows (homebrew ones)
 * @returns {{ items: object[], domains: Array<{id,label,src}>, names: Record<string,string>, warnings: string[],
 *   notes: string[], itemFeatures: Record<string, {field: string, values: string[]}>,
 *   customFeatures: { weapon: object[], armor: object[] }, counts: Record<string, number> }}
 */
export function buildHomebrewItems(input, options) {
  const source = { ...emptySource(), ...input };
  const { packCollection, systemDomains = SYSTEM_DOMAINS, classUuid = () => null, art = {}, featureKeys = {} } = options;
  if (!packCollection) throw new Error("packCollection is required");
  const uuidOf = (id) => `Compendium.${packCollection}.Item.${id}`;
  const idFor = (...parts) => stableId(`${source.id}:${parts.join(":")}`);
  // Only top-level records carry `builderId` (what the matcher indexes); the features and loot they
  // own point back with `parentId`.
  const flags = (builderId, kind, extra = {}) => ({ [MODULE_ID]: { homebrew: { sourceId: source.id, builderId, kind, ...extra } } });
  const childFlags = (parentId, kind) => ({ [MODULE_ID]: { homebrew: { sourceId: source.id, parentId, kind } } });
  const items = [];
  const names = {};
  const warnings = [];
  const notes = [];
  const domainIds = new Set();
  const label = source.label;
  const itemFeatures = {};
  const customFeatures = { weapon: [], armor: [] };
  // record id → { item, features: [{ name, item }], tiers: { foundation: [...] } } for effects.json
  const targets = {};
  let sort = 0;
  const push = (item) => { item.sort = (sort += 100000); item.folder = null; item.effects ??= []; items.push(item); return item; };
  const target = (builderId, item) => (targets[builderId] = { item, features: [], tiers: {} });

  const feature = (id, name, description, parentId, kind, img = ICONS.feature) => push({
    _id: id, name, type: "feature", img,
    system: { description, resource: null, actions: {}, attribution: attribution(label), gmNotes: "", granter: null, featureForm: "passive", actorResources: [] },
    flags: childFlags(parentId, kind),
  });
  /** Named features of an ancestry/community/transformation → feature items; returns their uuids. */
  const namedFeatures = (record, kind, fallback) => (record.features ?? []).map((f, i) => {
    const fid = idFor(record.id, "feature", i);
    const name = text(f.name) || `${fallback} Feature ${i + 1}`;
    const item = feature(fid, name, blocksToHtml(f.description), record.id, kind, art[`${record.id}-${i}`] ?? ICONS.feature);
    targets[record.id].features.push({ name, item });
    return uuidOf(fid);
  });

  // classes (features and starting loot first so their uuids exist)
  const classUuidByName = {};
  for (const c of source.classes) {
    const name = titleCase(text(c.name));
    const id = idFor(c.id);
    classUuidByName[String(text(c.name)).toUpperCase()] = uuidOf(id);
    names[c.id] = name;
    const t = target(c.id, null);
    const features = [];
    if (c.hopeFeature) {
      const fid = idFor(c.id, "hope");
      const fname = text(c.hopeFeature.name) || `${name} Hope Feature`;
      t.features.push({ name: fname, item: feature(fid, fname, blocksToHtml(c.hopeFeature.description), c.id, "classFeature") });
      features.push({ type: "hope", item: uuidOf(fid) });
    }
    (c.classFeatures ?? []).forEach((f, i) => {
      const fid = idFor(c.id, "feature", i);
      const fname = text(f.name) || `${name} Feature ${i + 1}`;
      t.features.push({ name: fname, item: feature(fid, fname, blocksToHtml(f.description), c.id, "classFeature") });
      features.push({ type: "class", item: uuidOf(fid) });
    });
    const take = (c.classItems ?? []).map((li, i) => {
      const lid = idFor(c.id, "item", i);
      push({ _id: lid, name: text(li), type: "loot", img: ICONS.classItem, system: { description: "", quantity: 1, actions: {}, attribution: attribution(label), gmNotes: "" }, flags: childFlags(c.id, "classItem") });
      return uuidOf(lid);
    });
    const domains = (c.domains ?? []).map(lower);
    domains.forEach((d) => domainIds.add(d));
    const three = (arr) => { const a = (arr ?? []).map(text).slice(0, 3); while (a.length < 3) a.push(""); return a; };
    t.item = push({
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
    const t = target(s.id, null);
    const className = String(text(s.class)).toUpperCase();
    const linkedClass = classUuidByName[className] ?? classUuid(titleCase(className)) ?? null;
    if (!linkedClass) warnings.push(`subclass ${name}: class ${titleCase(className)} not found in this source or the compendia; it will not attach to a class`);
    const features = [];
    for (const tier of TIERS) {
      t.tiers[tier] = [];
      (s[tier]?.features ?? []).forEach((f, i) => {
        const fid = idFor(s.id, tier, i);
        const fname = text(f.name) || `${name} ${titleCase(tier)} ${i + 1}`;
        const item = feature(fid, fname, blocksToHtml(f.description), s.id, "subclassFeature", art[`${s.id}-${tier}`] ?? ICONS.feature);
        t.tiers[tier].push({ name: fname, item });
        t.features.push({ name: fname, item });
        features.push({ type: tier, item: uuidOf(fid) });
      });
    }
    const trait = s.spellcastTrait ? lower(s.spellcastTrait) : null;
    t.item = push({
      _id: id, name, type: "subclass", img: art[`${s.id}-foundation`] ?? art[s.id] ?? ICONS.subclass,
      system: { description: blocksToHtml(s.description), spellcastingTrait: trait, features, featureState: 1, isMulticlass: false, linkedClass, attribution: attribution(label), gmNotes: "" },
      flags: flags(s.id, "subclass"),
    });
  }

  // ancestries: exactly one primary and one secondary feature (`system.features` is typed)
  for (const a of source.ancestries) {
    const name = text(a.name);
    const id = idFor(a.id);
    names[a.id] = name;
    target(a.id, null);
    const uuids = namedFeatures(a, "ancestryFeature", name);
    if (uuids.length > 2) warnings.push(`ancestry ${name} has ${uuids.length} features; the system holds a primary and a secondary, the rest are in the compendium but not on the ancestry`);
    if (uuids.length < 2) warnings.push(`ancestry ${name} has ${uuids.length} feature(s); the system expects a primary and a secondary`);
    const features = [];
    if (uuids[0]) features.push({ type: "primary", item: uuids[0] });
    if (uuids[1]) features.push({ type: "secondary", item: uuids[1] });
    targets[a.id].item = push({
      _id: id, name, type: "ancestry", img: art[a.id] ?? ICONS.ancestry,
      system: { description: blocksToHtml(a.description), features, loreReference: null, attribution: attribution(label), gmNotes: "" },
      flags: flags(a.id, "ancestry", { featureNames: (a.features ?? []).map((f, i) => text(f.name) || `${name} Feature ${i + 1}`) }),
    });
  }

  // communities: features are plain uuids; personalities become a closing paragraph
  for (const c of source.communities) {
    const name = text(c.name);
    const id = idFor(c.id);
    names[c.id] = name;
    target(c.id, null);
    const features = namedFeatures(c, "communityFeature", name);
    const personalities = (c.personalities ?? []).map(text).filter(Boolean);
    const description = blocksToHtml(c.description) + (personalities.length ? `<p><em>Personalities:</em> ${escapeHtml(personalities.join(", "))}.</p>` : "");
    targets[c.id].item = push({
      _id: id, name, type: "community", img: art[c.id] ?? ICONS.community,
      system: { description, features, loreReference: null, attribution: attribution(label), gmNotes: "" },
      flags: flags(c.id, "community"),
    });
  }

  // transformations
  for (const tr of source.transformations) {
    const name = text(tr.name);
    const id = idFor(tr.id);
    names[tr.id] = name;
    target(tr.id, null);
    const features = namedFeatures(tr, "transformationFeature", name);
    const questions = (tr.transformationQuestions ?? tr.questions ?? []).map(text).filter(Boolean);
    targets[tr.id].item = push({
      _id: id, name, type: "transformation", img: art[tr.id] ?? ICONS.transformation,
      system: {
        description: blocksToHtml(tr.description), features, loreReference: null,
        questions: questions.length ? `<ul>${questions.map((q) => `<li><p>${escapeHtml(q)}</p></li>`).join("")}</ul>` : "",
        attribution: attribution(label), gmNotes: "",
      },
      flags: flags(tr.id, "transformation"),
    });
  }

  // domain cards
  for (const c of source.domainCards) {
    const name = text(c.name);
    const id = idFor(c.id);
    names[c.id] = name;
    const domain = lower(c.domain);
    domainIds.add(domain);
    const type = lower(c.type ?? "ability");
    const description = featuresToHtml(c.features) || blocksToHtml(c.description);
    const img = art[c.id] ?? (systemDomains.includes(domain) ? `systems/daggerheart/assets/icons/domains/domain-card/${domain}.png` : ICONS.domainCard);
    target(c.id, push({
      _id: id, name, type: "domainCard", img,
      system: {
        description, domain, level: Number(c.level) || 1, recallCost: Number(c.recallCost) || 0,
        type: ["ability", "spell", "grimoire"].includes(type) ? type : "ability",
        actions: {}, resource: null, inVault: false, vaultActive: false, loadoutIgnore: false, domainTouched: null,
        attribution: attribution(label), gmNotes: "",
      },
      flags: flags(c.id, "domainCard"),
    }));
  }

  // loot (items.json) and consumables: text only
  const gearDescription = (r) => featuresToHtml(r.features) || blocksToHtml(r.description);
  for (const r of source.items) {
    const name = text(r.name) || nameFromId(r.id) || r.id;
    const id = idFor(r.id);
    names[r.id] = name;
    target(r.id, push({
      _id: id, name, type: "loot", img: art[r.id] ?? ICONS.loot,
      system: { description: gearDescription(r), quantity: 1, actions: {}, attribution: attribution(label), gmNotes: "" },
      flags: flags(r.id, "loot"),
    }));
  }
  for (const r of source.consumables) {
    const name = text(r.name) || nameFromId(r.id) || r.id;
    const id = idFor(r.id);
    names[r.id] = name;
    target(r.id, push({
      _id: id, name, type: "consumable", img: art[r.id] ?? ICONS.consumable,
      system: { description: gearDescription(r), quantity: 1, consumeOnUse: true, actions: {}, attribution: attribution(label), gmNotes: "" },
      flags: flags(r.id, "consumable"),
    }));
  }

  // weapon/armor features: system keys where the name matches, otherwise a custom feature the
  // caller registers in the system's Homebrew settings (its text lives there, so the sheet shows it)
  const seenCustom = { weapon: {}, armor: {} };
  const resolveFeatures = (kind, record, itemName) => {
    const values = [];
    for (const f of record.features ?? []) {
      const fname = text(f.name);
      if (!fname) { warnings.push(`${kind} ${itemName}: a feature without a name was skipped`); continue; }
      const key = featureKey(kind, fname, featureKeys[kind]);
      if (key) { values.push(key); continue; }
      const custom = `dhci-${source.id}-${squash(fname)}`.replace(/[^a-zA-Z0-9-]/g, "");
      if (!seenCustom[kind][custom]) {
        seenCustom[kind][custom] = true;
        customFeatures[kind].push({ key: custom, name: fname, img: ICONS.itemFeature, description: blocksToHtml(f.description), actions: {}, effects: [] });
      }
      values.push(custom);
    }
    return values;
  };

  // weapons
  for (const w of source.weapons) {
    const name = text(w.name) || nameFromId(w.id) || w.id;
    const id = idFor(w.id);
    names[w.id] = name;
    let trait = lower(w.trait) || "agility";
    if (trait === "spellcast") {
      notes.push(`weapon ${name}: uses the Spellcast trait; the system's weapons roll a named trait, set to Knowledge (change it on the item if the class casts with another)`);
      trait = "knowledge";
    } else if (!TRAITS.includes(trait)) { warnings.push(`weapon ${name}: unknown trait ${w.trait}; using Agility`); trait = "agility"; }
    const range = RANGES[lower(w.range)] ?? (warnings.push(`weapon ${name}: unknown range ${w.range}; using Melee`), "melee");
    const burden = lower(w.burden) === "two_handed" ? "twoHanded" : "oneHanded";
    const dice = lower(w.damage?.dice) || "d8";
    const bonus = Number(w.damage?.modifier ?? w.damage?.bonus) || null;
    const dmgType = lower(w.damage?.type) === "magical" || lower(w.damage?.type) === "magic" ? "magical" : "physical";
    const secondary = lower(w.type) === "secondary" || w.secondary === true;
    const values = resolveFeatures("weapon", w, name);
    if (values.length) itemFeatures[id] = { field: "weaponFeatures", values };
    target(w.id, push({
      _id: id, name, type: "weapon", img: art[w.id] ?? ICONS.weapon,
      system: {
        description: "", tier: Math.min(4, Math.max(1, Number(w.tier) || 1)), equipped: false, secondary, burden, weaponFeatures: [],
        attack: {
          _id: idFor(w.id, "attack"), name: "Attack", img: "icons/skills/melee/blood-slash-foam-red.webp", baseAction: true, chatDisplay: false,
          systemPath: "attack", type: "attack", actionType: "action", range, target: { type: "any", amount: 1 },
          roll: { trait, type: "attack", difficulty: null, bonus: null, advState: "neutral", useDefault: false },
          damage: { main: { value: { dice, bonus, multiplier: "prof", flatMultiplier: 1, custom: { enabled: false, formula: "" } }, type: [dmgType], applyTo: "hitPoints", resultBased: false, base: false, includeBase: false, direct: false, fullRestore: false }, resources: {} },
          cost: [], uses: { value: null, max: null, recovery: null, consumeOnSuccess: false }, effects: [], triggers: [], areas: [],
        },
        rules: { attack: { roll: { trait: null } } },
        resource: null, quantity: 1, actions: {}, attribution: attribution(label), gmNotes: "",
      },
      flags: flags(w.id, "weapon"),
    }));
  }

  // armor
  for (const a of source.armors) {
    const name = text(a.name) || nameFromId(a.id) || a.id;
    const id = idFor(a.id);
    names[a.id] = name;
    const values = resolveFeatures("armor", a, name);
    if (values.length) itemFeatures[id] = { field: "armorFeatures", values };
    target(a.id, push({
      _id: id, name, type: "armor", img: art[a.id] ?? ICONS.armor,
      system: {
        description: "", tier: Math.min(4, Math.max(1, Number(a.tier) || 1)), equipped: false,
        armor: { current: 0, max: Number(a.baseScore ?? a.armor?.max) || 0 },
        baseThresholds: { major: Number(a.baseMajorThreshold ?? a.baseThresholds?.major) || 0, severe: Number(a.baseSevereThreshold ?? a.baseThresholds?.severe) || 0 },
        armorFeatures: [], resource: null, quantity: 1, actions: {}, attribution: attribution(label), gmNotes: "",
      },
      flags: flags(a.id, "armor"),
    }));
  }

  // effects.json → one ActiveEffect on the feature/card/item the key names
  applyEffects(source, { targets, idFor, notes, warnings, featureKeys });

  const domains = [...domainIds].filter((d) => d && !systemDomains.includes(d)).sort()
    .map((d) => ({ id: d, label: titleCase(d.replace(/[_-]+/g, " ")), src: ICONS.homebrewDomain }));
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, source[c].length]));
  counts.effects = Object.keys(source.effects ?? {}).length;
  return { items, domains, names, warnings, notes, itemFeatures, customFeatures, counts };
}

/** Which key in `targets` a builder effects key refers to: exact id, then the id without its source prefix. */
function findTarget(targets, recordId) {
  if (targets[recordId]) return targets[recordId];
  const bare = parseId(recordId)?.bare;
  if (!bare) return null;
  const hit = Object.keys(targets).find((id) => parseId(id)?.bare === bare);
  return hit ? targets[hit] : null;
}

function applyEffects(source, { targets, idFor, notes, warnings, featureKeys }) {
  for (const [key, entry] of Object.entries(source.effects ?? {})) {
    if (!isObj(entry)) { warnings.push(`effects: ${key} is not an object`); continue; }
    const at = key.indexOf(":");
    const recordId = at > 0 ? key.slice(0, at) : key;
    const disc = at > 0 ? key.slice(at + 1) : null;
    const t = findTarget(targets, recordId);
    if (!t?.item) { warnings.push(`effects: ${key} names no record in this source`); continue; }
    const record = t.item;
    let host = record;
    let hostLabel = record.name;
    if (disc && TIERS.includes(lower(disc))) {
      const tierFeatures = t.tiers[lower(disc)] ?? [];
      const wanted = entry.feature ? tierFeatures.find((f) => sameName(f.name, entry.feature)) : tierFeatures[0];
      if (!wanted) { warnings.push(`effects: ${key} names ${entry.feature ? `feature ${entry.feature}` : "a feature"} the ${disc} tier of ${record.name} does not have`); continue; }
      host = wanted.item; hostLabel = `${record.name} / ${wanted.name}`;
    } else if (disc) {
      const wanted = t.features.find((f) => sameName(f.name, disc));
      if (wanted) { host = wanted.item; hostLabel = `${record.name} / ${wanted.name}`; }
      else if (record.type === "weapon" || record.type === "armor") {
        // Per-item weapon/armor features: the system's own feature carries the effect when it knows
        // the name; a custom one has none, so the effect goes on the item itself.
        if (featureKey(record.type, disc, featureKeys[record.type])) { notes.push(`effects: ${key} is covered by the system's ${disc} ${record.type} feature`); continue; }
        hostLabel = `${record.name} (${disc})`;
      } else { warnings.push(`effects: ${key} names a feature ${record.name} does not have`); continue; }
    }
    const { changes, notes: entryNotes } = effectChanges(entry, hostLabel);
    notes.push(...entryNotes);
    if (entry.permanent && record.type === "domainCard") {
      record.system.vaultActive = true;
      notes.push(`${hostLabel}: permanent bonus; the card is marked vault-active so its effect stays on when vaulted`);
    }
    if (!changes.length) continue;
    host.effects.push({
      _id: idFor(key, "effect"), name: host.name, type: "base", img: host.img, description: "", transfer: true, disabled: false,
      system: { changes, duration: { description: "" }, rangeDependence: null, stacking: null, targetDispositions: [] },
      duration: { value: null, units: "seconds", expiry: null, expired: false }, tint: "#ffffff", statuses: [], flags: {},
    });
  }
}

function sameName(a, b) {
  const x = squash(a), y = squash(b);
  return x === y || (x.length > 4 && y.length > 4 && (x.startsWith(y) || y.startsWith(x)));
}

/** "1 class · 2 subclasses · 3 domain cards" from a counts object (zero categories omitted). */
export function describeCounts(counts) {
  const parts = [];
  for (const c of CATEGORIES) {
    const n = counts?.[c] ?? 0;
    if (n) parts.push(`${n} ${CATEGORY_LABELS[c][n === 1 ? 0 : 1]}`);
  }
  if (counts?.effects) parts.push(`${counts.effects} effect${counts.effects === 1 ? "" : "s"}`);
  return parts.join(", ") || "nothing";
}

/** Human summary of a parsed source for the dialog. */
export function describeSource(source) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, source[c]?.length ?? 0]));
  counts.effects = Object.keys(source.effects ?? {}).length;
  return `${source.label} (${source.id}): ${describeCounts(counts)}`;
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
