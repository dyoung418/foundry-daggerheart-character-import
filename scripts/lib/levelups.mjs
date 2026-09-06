// Builder levelUps → the system's `system.levelData.levelups`. Pure.
//
// Embedded-item uuids are not known until the writer has created the items, so card references
// are left as `_cardId` / `_multiclass` markers that `resolveItemUuids()` replaces afterwards.

export const TIER_CARD_CAP = { 2: 4, 3: 7, 4: 10 };
export const ACHIEVEMENT_LEVELS = [2, 5, 8];

export function tierOf(level) {
  return level <= 4 ? 2 : level <= 7 ? 3 : 4;
}

const PICK_KEY = { traits: "trait" };
const VALUE_ONE = new Set(["hitPoint", "stress", "evasion", "proficiency", "experience"]);
const COST_TWO = new Set(["proficiency", "multiclass"]);

/**
 * @param {object} ch          normalized builder character
 * @param {object} ctx
 * @param {(builderId: string) => string|null} ctx.cardUuid   compendium uuid for a domain card id
 * @param {(builderId: string) => string|null} ctx.classUuid  compendium uuid for a class id
 * @param {(builderId: string) => string|null} ctx.subclassUuid
 * @param {Record<string,string>} ctx.experienceIds  builder experience id → foundry id
 * @param {(tier: number, pick: object) => { optionKey, type, subType } | null} [ctx.declaredOption]
 *        the class's own level-up option (system `levelupOptionTiers`) that a builder pick with a
 *        `<classId>:<feature>` key and an `optionLabel` stands for
 * @param {(msg: string) => void} [ctx.warn]
 * @returns {Record<string, object>} levelups keyed by level
 */
export function translateLevelUps(ch, ctx) {
  const warn = ctx.warn ?? (() => {});
  const boxes = {};
  const levelups = {};
  let ownTier = 1;
  let multiTier = 1;
  const entries = [...(ch.levelUps ?? [])].sort((a, b) => a.level - b.level);
  for (const e of entries) {
    const L = e.level, T = tierOf(L);
    const achievements = { experiences: {}, domainCards: [], proficiency: ACHIEVEMENT_LEVELS.includes(L) ? 1 : 0 };
    for (const x of ch.experiences ?? []) {
      if (x.sinceLevel === L && ctx.experienceIds[x.id]) achievements.experiences[ctx.experienceIds[x.id]] = { name: x.name, modifier: x.baseModifier ?? 2 };
    }
    if (e.mandatoryCardId) {
      const uuid = ctx.cardUuid(e.mandatoryCardId);
      if (uuid) achievements.domainCards.push({ uuid, itemUuid: null, _cardId: e.mandatoryCardId });
      else warn(`level ${L}: domain card ${e.mandatoryCardId} not found; dropped from level record`);
    }
    const selections = [];
    for (const p of e.picks ?? []) {
      let key = PICK_KEY[p.key] ?? p.key;
      let declared = null;
      if (p.optionLabel || p.key.includes(":")) {
        declared = ctx.declaredOption?.(T, p) ?? null;
        if (!declared) { warn(`level ${L}: class advancement "${p.optionLabel ?? p.key}" has no matching option on the class in the compendium; skipped`); continue; }
        key = declared.optionKey;
      }
      const boxKey = `${T}|${key}`;
      boxes[boxKey] = (boxes[boxKey] ?? 0) + 1;
      const sel = {
        tier: T, level: L, optionKey: key, type: declared?.type ?? key, subType: declared?.subType ?? null,
        checkboxNr: boxes[boxKey],
        value: VALUE_ONE.has(key) ? 1 : null,
        minCost: COST_TWO.has(key) ? 2 : 1,
        amount: key === "trait" || key === "experience" ? 2 : key === "domainCard" ? 1 : null,
        data: [], secondaryData: {}, itemUuid: null, features: [],
      };
      if (declared) { selections.push(sel); continue; }
      switch (key) {
        case "trait":
          sel.data = [...(p.traits ?? [])];
          break;
        case "experience":
          sel.data = (p.experienceIds ?? []).map((id) => ctx.experienceIds[id]).filter(Boolean);
          break;
        case "domainCard": {
          const uuid = p.cardId ? ctx.cardUuid(p.cardId) : null;
          if (!uuid) { warn(`level ${L}: domain card ${p.cardId} not found; advancement dropped`); boxes[boxKey]--; continue; }
          sel.data = [uuid];
          sel.secondaryData = { limit: String(TIER_CARD_CAP[T]) };
          sel._cardId = p.cardId;
          break;
        }
        case "subclass": {
          const isMulti = p.target === "multiclass";
          if (isMulti) multiTier = Math.min(3, multiTier + 1); else ownTier = Math.min(3, ownTier + 1);
          sel.secondaryData = { isMulticlass: isMulti ? "true" : "false", featureState: String(isMulti ? multiTier : ownTier) };
          break;
        }
        case "multiclass": {
          const cu = p.classId ? ctx.classUuid(p.classId) : null;
          const su = p.subclassId ? ctx.subclassUuid(p.subclassId) : null;
          if (!cu || !su) { warn(`level ${L}: multiclass ${p.classId}/${p.subclassId} not found; advancement dropped`); boxes[boxKey]--; continue; }
          sel.data = [cu];
          sel.secondaryData = { subclass: su, domain: String(p.domain ?? "").toLowerCase() };
          sel._multiclass = true;
          break;
        }
        case "hitPoint": case "stress": case "evasion": case "proficiency":
          break;
        default:
          warn(`level ${L}: unknown advancement "${p.key}"; skipped`);
          boxes[boxKey]--;
          continue;
      }
      selections.push(sel);
    }
    if (e.exchange) warn(`level ${L}: card exchange ${e.exchange.outCardId} → ${e.exchange.inCardId} is reflected in the card list but has no level record in the system`);
    levelups[L] = { achievements, selections };
  }
  return levelups;
}

/**
 * Replace `_cardId` / `_multiclass` markers with embedded item uuids.
 * @param {Record<string, object>} levelups   from translateLevelUps (mutated and returned)
 * @param {{ cardItemUuid: (builderId: string) => string|null, multiclassItemUuid: () => string|null }} lookup
 */
export function resolveItemUuids(levelups, lookup) {
  for (const lv of Object.values(levelups)) {
    for (const c of lv.achievements.domainCards) {
      c.itemUuid = lookup.cardItemUuid(c._cardId) ?? null;
      delete c._cardId;
    }
    lv.achievements.domainCards = lv.achievements.domainCards.filter((c) => c.itemUuid);
    for (const s of lv.selections) {
      if (s._cardId !== undefined) { s.itemUuid = lookup.cardItemUuid(s._cardId) ?? null; delete s._cardId; }
      if (s._multiclass) { s.itemUuid = lookup.multiclassItemUuid() ?? null; delete s._multiclass; }
    }
  }
  return levelups;
}

/** Number of level-up trait picks per trait, for deriving creation values from final ones. */
export function traitPickCounts(ch) {
  const counts = {};
  for (const e of ch.levelUps ?? []) for (const p of e.picks ?? []) if (p.key === "traits") for (const t of p.traits ?? []) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

/** Number of level-up experience bumps per builder experience id. */
export function experiencePickCounts(ch) {
  const counts = {};
  for (const e of ch.levelUps ?? []) for (const p of e.picks ?? []) if (p.key === "experience") for (const id of p.experienceIds ?? []) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}
