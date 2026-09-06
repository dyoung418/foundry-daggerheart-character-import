// Turns a normalized builder character plus a resolver into an ImportPlan: plain JSON describing
// the actor data and the embedded items to create, in order. Pure — no Foundry globals.
//
// Resolver contract (implemented by foundry/matcher.mjs, and by a fixture in tests):
//   lookup(type, name)        → { uuid, name, ...index fields } | null   (type = Foundry item type)
//   lookupById?(builderId)    → same shape | null  (items imported from a builder homebrew source)
//   nameOf(builderId)         → display name | null
//   featureNames(ancestryId)  → string[] (builder feature order)
//   newId()                   → 16-char id for experiences
import { parseId, typeOf, nameFromId, SENTINELS } from "./ids.mjs";
import { translateLevelUps, traitPickCounts, experiencePickCounts } from "./levelups.mjs";
import { composeAncestry } from "./heritage.mjs";

export const TRAITS = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
export const BASE_STRESS = 6;
export const SUBCLASS_STATE = { foundation: 1, specialization: 2, mastery: 3 };

/**
 * @param {object} ch  normalized builder character
 * @param {object} resolver
 * @param {object} [options]
 * @param {boolean} [options.levelupAuto=true]  the world's level-up automation setting
 * @param {boolean} [options.addStartingKit=true]  create the class's `inventory.take` loot items
 * @param {string} [options.moduleId]
 * @param {object} [options.fileMeta]  { version, exportedAt }
 * @returns {ImportPlan}
 */
export function buildPlan(ch, resolver, options = {}) {
  const opts = { levelupAuto: true, addStartingKit: true, moduleId: "daggerheart-character-import", fileMeta: {}, ...options };
  const report = [];
  const warn = (message) => report.push({ level: "warn", message });
  const info = (message) => report.push({ level: "info", message });
  const missing = [];

  const nameOf = (id) => resolver.nameOf(id) ?? nameFromId(id) ?? id;
  const find = (id, expectType = null) => {
    if (!id || SENTINELS.has(id)) return null;
    const type = expectType ?? typeOf(id);
    if (!type) { warn(`unrecognised id ${id}`); return null; }
    const name = nameOf(id);
    const hit = resolver.lookupById?.(id) ?? resolver.lookup(type, name);
    if (!hit) missing.push({ id, type, name });
    return hit;
  };

  // ---- class / subclass ----
  const cls = find(ch.classId, "class");
  const sub = find(ch.subclassId, "subclass");
  const fatal = [];
  if (!ch.classId || !cls) fatal.push(`class ${ch.classId ? nameOf(ch.classId) : "(none)"} not found`);
  if (!ch.subclassId || !sub) fatal.push(`subclass ${ch.subclassId ? nameOf(ch.subclassId) : "(none)"} not found`);
  if (cls && sub && sub.linkedClass && sub.linkedClass !== cls.uuid) warn(`subclass ${sub.name} is linked to a different class than ${cls.name}; the system will refuse it`);

  // ---- heritage ----
  const ancestry = composeAncestry(ch.heritage, {
    ancestry: (id) => find(id, "ancestry"),
    featureNames: (id) => resolver.featureNames(id) ?? [],
    warn,
  });
  if (!ancestry) fatal.push("ancestry not found");
  const community = find(ch.heritage.communityId, "community");
  if (ch.heritage.communityId && !community) fatal.push(`community ${nameOf(ch.heritage.communityId)} not found`);
  const transformation = find(ch.transformationId, "transformation");

  // ---- multiclass ----
  let multiclass = null;
  if (ch.multiclass?.classId) {
    if (!opts.levelupAuto) {
      warn(`multiclass ${nameOf(ch.multiclass.classId)} skipped: the system needs level-up automation on to add a second class without a dialog`);
    } else {
      const mcls = find(ch.multiclass.classId, "class");
      const msub = find(ch.multiclass.subclassId, "subclass");
      if (mcls && msub) multiclass = { class: mcls, subclass: msub, domain: String(ch.multiclass.domain ?? "").toLowerCase(), featureState: SUBCLASS_STATE[ch.multiclass.tier] ?? 1 };
      else warn(`multiclass ${nameOf(ch.multiclass.classId)} / ${nameOf(ch.multiclass.subclassId)} not found; skipped`);
    }
  }

  // ---- experiences ----
  const experienceIds = {};
  const expBumps = experiencePickCounts(ch);
  const experiences = {};
  ch.experiences.forEach((exp, i) => {
    const fid = resolver.newId();
    experienceIds[exp.id] = fid;
    const base = Number.isInteger(exp.baseModifier) ? exp.baseModifier : 2;
    const value = opts.levelupAuto && ch.levelUps.length ? base : base + (expBumps[exp.id] ?? 0);
    experiences[fid] = { name: exp.name || `Experience ${i + 1}`, value, core: true, description: "" };
  });
  // Clank's Purposeful Design: +1 to one Experience, stored by the builder as an effect choice
  // (`optionId` "one" plus the chosen experience; the builder applies nothing until both are set).
  for (const [key, answer] of Object.entries(ch.effectChoices ?? {})) {
    if (/purposeful design/i.test(key) && answer?.optionId && answer?.experienceIds?.[0] && experienceIds[answer.experienceIds[0]]) {
      experiences[experienceIds[answer.experienceIds[0]]].value += 1;
      info(`Purposeful Design: +1 applied to Experience "${experiences[experienceIds[answer.experienceIds[0]]].name}"`);
    }
  }

  // ---- numbers ----
  const hasHistory = ch.levelUps.length > 0;
  const deriveFromLevelups = opts.levelupAuto && (hasHistory || ch.level === 1);
  if (opts.levelupAuto && !hasHistory && ch.level > 1) warn(`level ${ch.level} but the file has no level-up history (old save); final stats written directly and the system's level-up record left empty`);
  const traitPicks = traitPickCounts(ch);
  const traits = {};
  for (const t of TRAITS) {
    const final = ch.traits[t] ?? 0;
    traits[t] = { value: deriveFromLevelups ? final - (traitPicks[t] ?? 0) : final, tierMarked: deriveFromLevelups ? false : ch.traitMarks[t] === true };
  }
  const actorSystem = {
    traits,
    proficiency: deriveFromLevelups ? 1 : ch.proficiency,
    evasion: deriveFromLevelups ? 0 : ch.evasionBonus,
    resources: {
      hitPoints: { value: ch.state.hp, max: deriveFromLevelups ? null : ch.hitPointSlotsBonus },
      stress: { value: ch.state.stress, max: deriveFromLevelups ? null : BASE_STRESS + ch.stressSlotsBonus },
      hope: { value: ch.state.hope, max: null },
    },
    scars: ch.state.scars,
    experiences,
    levelData: { level: { current: ch.level, changed: ch.level }, levelups: {} },
    biography: { characteristics: { pronouns: ch.pronouns } },
  };

  // ---- level-ups ----
  let levelups = {};
  if (deriveFromLevelups && hasHistory) {
    levelups = translateLevelUps(ch, {
      cardUuid: (id) => find(id, "domainCard")?.uuid ?? null,
      classUuid: (id) => find(id, "class")?.uuid ?? null,
      subclassUuid: (id) => find(id, "subclass")?.uuid ?? null,
      experienceIds,
      declaredOption: (tier, pick) => declaredOption(tier, pick, [cls, multiclass?.class].filter(Boolean)),
      warn,
    });
    if (!multiclass) {
      for (const lv of Object.values(levelups)) lv.selections = lv.selections.filter((s) => !s._multiclass);
    }
  }

  // ---- domain cards ----
  const vault = new Set(ch.domainVaultIds);
  const domainCards = [];
  for (const id of ch.domainCardIds) {
    const hit = find(id, "domainCard");
    if (!hit) continue;
    const granted = (cls?.domains ?? []).concat(multiclass ? [multiclass.domain] : []);
    if (hit.domain && granted.length && !granted.includes(hit.domain)) warn(`domain card ${hit.name} is from the ${hit.domain} domain, which ${cls?.name ?? "the class"} does not grant; the system will refuse it`);
    domainCards.push({ builderId: id, uuid: hit.uuid, name: hit.name, inVault: vault.has(id) });
  }
  const loadoutCount = domainCards.filter((c) => !c.inVault).length;
  if (loadoutCount > 5) warn(`${loadoutCount} cards in loadout; the system's default limit is 5 and will vault the rest`);

  // ---- equipment ----
  const equipment = { armor: null, weapons: [], consumables: [], loot: [] };
  const armor = find(ch.equipment.armorId, "armor");
  if (armor) equipment.armor = { uuid: armor.uuid, name: armor.name, current: ch.state.armor };
  else if (ch.state.armor) warn(`${ch.state.armor} armor slot(s) marked but no armor equipped`);
  const primary = find(ch.equipment.primaryWeaponId, "weapon");
  if (primary) equipment.weapons.push({ uuid: primary.uuid, name: primary.name, secondary: false });
  const secondary = find(ch.equipment.secondaryWeaponId, "weapon");
  if (secondary) equipment.weapons.push({ uuid: secondary.uuid, name: secondary.name, secondary: true });
  const potion = find(ch.equipment.potionChoice, "consumable");
  if (potion) equipment.consumables.push({ uuid: potion.uuid, name: potion.name, quantity: 1 });
  if (opts.addStartingKit && cls?.inventory?.take?.length) {
    for (const uuid of cls.inventory.take) if (uuid) equipment.loot.push({ uuid, quantity: 1 });
  }

  // ---- biography ----
  const paragraphs = (text) => String(text ?? "").split(/\n{2,}|\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => `<p>${escapeHtml(s)}</p>`).join("");
  const biography = {
    background: paragraphs(ch.background.description) + paragraphs(ch.background.answers),
    connections: paragraphs(ch.connectionsNotes) + (ch.state.notes ? `<h3>Session notes</h3>${paragraphs(ch.state.notes)}` : ""),
  };

  for (const m of missing) warn(`${m.type} "${m.name}" (${m.id}) not found in any compendium`);

  return {
    ok: fatal.length === 0,
    fatal,
    name: ch.name || "Unnamed (imported)",
    portrait: ch.portrait ?? null,
    actorSystem,
    biography,
    items: {
      class: cls ? { uuid: cls.uuid, name: cls.name } : null,
      subclass: sub ? { uuid: sub.uuid, name: sub.name, featureState: SUBCLASS_STATE[ch.subclassTier] ?? 1 } : null,
      ancestry,
      community: community ? { uuid: community.uuid, name: community.name } : null,
      transformation: transformation ? { uuid: transformation.uuid, name: transformation.name } : null,
      multiclass: multiclass ? { class: { uuid: multiclass.class.uuid, name: multiclass.class.name }, subclass: { uuid: multiclass.subclass.uuid, name: multiclass.subclass.name }, domain: multiclass.domain, featureState: multiclass.featureState } : null,
      domainCards,
      ...equipment,
    },
    levelups,
    levelupAuto: opts.levelupAuto,
    conditions: [...ch.state.conditions],
    experienceIds,
    flags: {
      [opts.moduleId]: {
        builder: { id: ch.id, updatedAt: ch.updatedAt, exportedAt: opts.fileMeta.exportedAt ?? null, version: opts.fileMeta.version ?? 1, importedAt: null,
          raw: { levelUps: ch.levelUps, baseline: ch.baseline ?? null, baselineLevel: ch.baselineLevel, advancementSlotsUsed: ch.advancementSlotsUsed, effectChoices: ch.effectChoices, creationDomainCardIds: ch.creationDomainCardIds, domainCardIds: ch.domainCardIds, domainVaultIds: ch.domainVaultIds } },
      },
    },
    report,
    missing,
  };
}

/**
 * A builder pick recorded against a class feature (`srd_2_0_class_brawler:Combo Strike`, label
 * "Increase your Combo Die by one step") → the class item's own level-up option for that tier
 * (`system.levelupOptionTiers[tier][key] = { type: 'dice', subType: 'comboDieIndex', label }`).
 * Matched by the builder's class id when it names one, then by label words, then by being the
 * only declared option in the tier.
 */
export function declaredOption(tier, pick, classes) {
  const wantedClass = String(pick.key ?? "").split(":")[0];
  const ordered = [...classes].sort((a, b) => (nameMatches(b, wantedClass) ? 1 : 0) - (nameMatches(a, wantedClass) ? 1 : 0));
  const words = String(pick.optionLabel ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
  for (const c of ordered) {
    const options = Object.entries(c.levelupOptionTiers?.[tier] ?? {});
    if (!options.length) continue;
    const scored = options.map(([optionKey, o]) => {
      const label = String(o.label ?? "").toLowerCase();
      const score = words.filter((w) => w.length > 3 && label.includes(w)).length;
      return { optionKey, type: o.type, subType: o.subType ?? null, score };
    });
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score > 0 || scored.length === 1) return { optionKey: scored[0].optionKey, type: scored[0].type, subType: scored[0].subType };
  }
  return null;
}
function nameMatches(entry, builderClassId) {
  const tail = builderClassId.replace(/^.*_class_/, "").replace(/_/g, " ");
  return !!tail && String(entry.name ?? "").toLowerCase() === tail;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Short human summary of a plan for the dialog. */
export function describePlan(plan) {
  const it = plan.items;
  const parts = [];
  if (it.class) parts.push(`${it.class.name}${it.subclass ? " / " + it.subclass.name : ""}`);
  if (it.multiclass) parts.push(`multiclass ${it.multiclass.class.name} / ${it.multiclass.subclass.name}`);
  if (it.ancestry) parts.push(it.ancestry.name);
  if (it.community) parts.push(it.community.name);
  parts.push(`${it.domainCards.length} domain cards`);
  parts.push(`${it.weapons.length} weapons${it.armor ? ", armor" : ""}`);
  return parts.join(" · ");
}
