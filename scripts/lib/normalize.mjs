// Reading a builder transfer file. Mirrors shared/transfer.js in the builder (parseTransferFile,
// normalizeImported) closely enough that the same files are accepted and rejected. Pure.

export const TRANSFER_FORMAT = "daggerheart-character-builder";
export const TRANSFER_VERSION = 1;
export const MAX_LEVEL = 10;

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v));

/**
 * @param {string} text  file contents
 * @returns {{ ok: true, version: number, exportedAt: string|null, characters: object[], dropped: number }
 *        | { ok: false, error: string }}
 */
export function parseTransferFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "not JSON" };
  }
  if (!isObject(parsed) || parsed.format !== TRANSFER_FORMAT) {
    return { ok: false, error: `not a character-builder file (format: ${isObject(parsed) ? parsed.format : typeof parsed})` };
  }
  if (typeof parsed.version === "number" && parsed.version > TRANSFER_VERSION) {
    return { ok: false, error: `file version ${parsed.version} is newer than supported version ${TRANSFER_VERSION}` };
  }
  if (!Array.isArray(parsed.characters) || parsed.characters.length === 0) {
    return { ok: false, error: "no characters in file" };
  }
  const kept = parsed.characters.filter(looksLikeCharacter).map((ch) => normalizeCharacter(copy(ch)));
  if (kept.length === 0) return { ok: false, error: "nothing in the file looked like a character" };
  return {
    ok: true,
    version: typeof parsed.version === "number" ? parsed.version : TRANSFER_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
    characters: kept,
    dropped: parsed.characters.length - kept.length,
  };
}

export function looksLikeCharacter(ch) {
  return isObject(ch) && ("classId" in ch || "name" in ch || "heritage" in ch);
}

const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
const SLOT_KEYS = ["traits", "hitPoint", "stress", "evasion", "experience", "domainCard", "subclass", "proficiency", "multiclass"];

/** Repairs the shapes the importer dereferences. Same rules as the builder's normalizeImported + ensureLevelFields. */
export function normalizeCharacter(ch) {
  if (typeof ch.id !== "string") ch.id = "";
  if (typeof ch.name !== "string") ch.name = "";
  if (typeof ch.pronouns !== "string") ch.pronouns = "";
  if (typeof ch.connectionsNotes !== "string") ch.connectionsNotes = "";
  if (!isObject(ch.background)) ch.background = { description: "", answers: "" };
  if (typeof ch.background.description !== "string") ch.background.description = "";
  if (typeof ch.background.answers !== "string") ch.background.answers = "";

  if (!isObject(ch.heritage)) ch.heritage = { ancestryMode: "pure", ancestryIds: [], chosenFeatures: [], communityId: null };
  if (!Array.isArray(ch.heritage.ancestryIds)) ch.heritage.ancestryIds = [];
  if (!Array.isArray(ch.heritage.chosenFeatures)) ch.heritage.chosenFeatures = [];
  if (ch.heritage.ancestryMode !== "mixed") ch.heritage.ancestryMode = "pure";
  if (ch.heritage.communityId === undefined) ch.heritage.communityId = null;
  if (ch.classId === undefined) ch.classId = null;
  if (ch.subclassId === undefined) ch.subclassId = null;
  if (ch.transformationId === undefined) ch.transformationId = null;
  if (ch.multiclass !== undefined && !isObject(ch.multiclass)) ch.multiclass = null;
  if (ch.multiclass === undefined) ch.multiclass = null;
  if (ch.multiclass && !ch.multiclass.tier) ch.multiclass.tier = "foundation";

  if (!isObject(ch.traits)) ch.traits = {};
  for (const t of TRAITS) if (!Number.isInteger(ch.traits[t])) ch.traits[t] = ch.traits[t] === null ? null : (Number.isFinite(Number(ch.traits[t])) && ch.traits[t] !== undefined ? Math.trunc(Number(ch.traits[t])) : null);
  if (!isObject(ch.traitMarks)) ch.traitMarks = {};
  for (const t of TRAITS) ch.traitMarks[t] = ch.traitMarks[t] === true;

  if (!isObject(ch.equipment)) ch.equipment = {};
  for (const k of ["primaryWeaponId", "secondaryWeaponId", "armorId", "potionChoice"]) {
    if (typeof ch.equipment[k] !== "string" || !ch.equipment[k]) ch.equipment[k] = null;
  }
  delete ch.weaponMode;

  if (!Array.isArray(ch.experiences)) ch.experiences = [];
  ch.experiences = ch.experiences.filter(isObject);
  ch.experiences.forEach((exp, i) => {
    if (typeof exp.name !== "string") exp.name = "";
    if (!Number.isInteger(exp.modifier)) exp.modifier = 2;
    if (!Number.isInteger(exp.baseModifier)) exp.baseModifier = exp.modifier;
    if (!exp.id) exp.id = `exp_${i + 1}`;
  });

  if (!Array.isArray(ch.domainCardIds)) ch.domainCardIds = [];
  if (!Array.isArray(ch.domainVaultIds)) ch.domainVaultIds = [];
  ch.domainCardIds = ch.domainCardIds.filter((x) => typeof x === "string");
  ch.domainVaultIds = ch.domainVaultIds.filter((x) => typeof x === "string" && ch.domainCardIds.includes(x));

  const level = Math.floor(Number(ch.level));
  ch.level = Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(1, level)) : 1;
  if (!Number.isInteger(ch.proficiency)) ch.proficiency = 1;
  for (const k of ["hitPointSlotsBonus", "stressSlotsBonus", "evasionBonus"]) if (!Number.isInteger(ch[k])) ch[k] = 0;
  if (!["foundation", "specialization", "mastery"].includes(ch.subclassTier)) ch.subclassTier = "foundation";

  if (!isObject(ch.advancementSlotsUsed)) ch.advancementSlotsUsed = {};
  ch.advancementSlotsUsed = perTierSlots(ch.advancementSlotsUsed);
  if (!Array.isArray(ch.creationDomainCardIds)) ch.creationDomainCardIds = ch.domainCardIds.slice(0, 2);
  if (!Array.isArray(ch.levelUps)) ch.levelUps = [];
  ch.levelUps = ch.levelUps.filter((e) => isObject(e) && Number.isInteger(e.level));
  for (const e of ch.levelUps) {
    if (!Array.isArray(e.picks)) e.picks = [];
    e.picks = e.picks.filter((p) => isObject(p) && typeof p.key === "string");
    if (e.mandatoryCardId === undefined) e.mandatoryCardId = null;
    if (!Array.isArray(e.grantedCardIds)) e.grantedCardIds = [];
    if (!isObject(e.exchange) || !e.exchange.outCardId || !e.exchange.inCardId) e.exchange = null;
  }
  if (!Number.isInteger(ch.baselineLevel)) ch.baselineLevel = ch.levelUps.length ? Math.min(ch.level, ...ch.levelUps.map((e) => e.level)) - 1 : ch.level;
  if (!isObject(ch.effectChoices)) ch.effectChoices = {};
  for (const exp of ch.experiences) if (!Number.isInteger(exp.sinceLevel)) exp.sinceLevel = ch.baselineLevel;

  if (!isObject(ch.state)) ch.state = {};
  const s = ch.state;
  for (const k of ["hp", "stress", "armor", "scars"]) if (!Number.isInteger(s[k]) || s[k] < 0) s[k] = 0;
  if (!Number.isInteger(s.hope) || s.hope < 0) s.hope = 2;
  if (!Array.isArray(s.conditions)) s.conditions = [];
  s.conditions = s.conditions.filter((c) => ["vulnerable", "hidden", "restrained"].includes(c));
  if (typeof s.notes !== "string") s.notes = "";

  if (typeof ch.portrait !== "string" || !/^data:image\/(webp|jpeg|png);base64,/.test(ch.portrait) || ch.portrait.length > 120000) delete ch.portrait;
  if (typeof ch.updatedAt !== "string") ch.updatedAt = null;
  return ch;
}

/** Legacy flat totals `{ traits: 4 }` → per-tier `{ traits: { 2: 4, 3: 0, 4: 0 } }` (same guess as the builder: all in tier 2). */
export function perTierSlots(used) {
  const out = {};
  for (const key of SLOT_KEYS) {
    const v = used[key];
    if (isObject(v)) out[key] = { 2: int(v[2]), 3: int(v[3]), 4: int(v[4]) };
    else out[key] = { 2: int(v), 3: 0, 4: 0 };
  }
  return out;
}
const int = (v) => (Number.isInteger(v) && v > 0 ? v : 0);

/** One-line description for the picker: "Bard / Troubadour · Clank · Highborne". */
export function summarize(ch, names = (id) => id) {
  const parts = [];
  if (ch.classId) parts.push([names(ch.classId), ch.subclassId ? names(ch.subclassId) : null].filter(Boolean).join(" / "));
  if (ch.heritage.ancestryIds.length) parts.push(ch.heritage.ancestryIds.map(names).join("/"));
  if (ch.heritage.communityId) parts.push(names(ch.heritage.communityId));
  return parts.join(" · ");
}
