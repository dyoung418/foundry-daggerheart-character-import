// Applies an ImportPlan to Foundry: creates (or updates) the actor and its embedded items in the
// order the system's hooks require. See docs/mapping.md "Order of operations".
import { MODULE_ID, SETTINGS, debug, log } from "./constants.mjs";
import { resolveItemUuids } from "../lib/levelups.mjs";
import { uploadPortrait } from "./portrait.mjs";

/**
 * @param {ImportPlan} plan
 * @param {object} [options]
 * @param {Actor} [options.actor]   existing actor to update; otherwise a new one is created
 * @param {(step: string) => void} [options.progress]
 * @returns {Promise<{ actor: Actor, report: Array<{level, message}> }>}
 */
export async function applyPlan(plan, { actor = null, progress = () => {} } = {}) {
  const report = [...plan.report];
  const warn = (message) => report.push({ level: "warn", message });
  const flagsOf = (extra = {}) => ({ [MODULE_ID]: { imported: true, ...extra } });

  // ---- 1. actor ----
  progress("actor");
  const flags = foundry.utils.deepClone(plan.flags);
  flags[MODULE_ID].builder.importedAt = new Date().toISOString();
  const img = plan.portrait ? await uploadPortrait(plan.portrait, plan.name) : null;
  if (plan.portrait && !img) warn("portrait could not be uploaded; default artwork kept");
  if (!actor) {
    const folder = await actorFolder();
    actor = await Actor.create({ name: plan.name, type: "character", ...(img ? { img } : {}), ...(folder ? { folder: folder.id } : {}), flags });
  } else {
    const previous = actor.items.filter((i) => i.getFlag(MODULE_ID, "imported"));
    if (previous.length) await actor.deleteEmbeddedDocuments("Item", previous.map((i) => i.id));
    // Keyed collections merge on update, so old experiences and level records must be deleted
    // explicitly. Biography is rebuilt: the class hook re-appends its questions and we re-append
    // the builder text.
    const deletions = {};
    for (const key of Object.keys(actor.system._source.experiences ?? {})) deletions[`system.experiences.-=${key}`] = null;
    for (const key of Object.keys(actor.system._source.levelData?.levelups ?? {})) deletions[`system.levelData.levelups.-=${key}`] = null;
    await actor.update({ name: plan.name, ...(img ? { img } : {}), flags, "system.biography.background": "", "system.biography.connections": "", ...deletions });
    report.push({ level: "info", message: "existing actor updated: previously imported items replaced, biography rebuilt from the file" });
  }
  // The system derives HP/evasion from the class item; write the base numbers first so
  // prepareData has sane inputs, but hold biography until the class has appended its questions.
  await actor.update({ system: foundry.utils.deepClone(plan.actorSystem) });

  const created = { cards: new Map(), multiclassClass: null };
  const fetchData = async (uuid, overrides = {}) => {
    const doc = await fromUuid(uuid);
    if (!doc) { warn(`compendium document ${uuid} disappeared`); return null; }
    const data = doc.toObject();
    delete data._id;
    data._stats = { ...(data._stats ?? {}), compendiumSource: uuid };
    data.flags = foundry.utils.mergeObject(data.flags ?? {}, flagsOf(overrides.flags ?? {}));
    delete overrides.flags;
    return foundry.utils.mergeObject(data, overrides);
  };
  const createItems = async (list) => {
    const data = (await Promise.all(list)).filter(Boolean);
    if (!data.length) return [];
    return actor.createEmbeddedDocuments("Item", data);
  };

  // ---- 2. class, alone ----
  progress("class");
  if (plan.items.class) {
    const [cls] = await createItems([fetchData(plan.items.class.uuid)]);
    if (!cls) throw new Error("class item was not created; the system refused it (see console)");
  }
  // Biography: the class hook has appended its questions; add the builder's text after them.
  const bio = actor.system.biography;
  await actor.update({
    "system.biography.background": joinHtml(bio.background, plan.biography.background),
    "system.biography.connections": joinHtml(bio.connections, plan.biography.connections),
  });

  // ---- 3. subclass, ancestry, community, transformation ----
  progress("heritage");
  const batch = [];
  if (plan.items.subclass) batch.push(fetchData(plan.items.subclass.uuid, { system: { featureState: plan.items.subclass.featureState } }));
  if (plan.items.ancestry) {
    const a = plan.items.ancestry;
    batch.push(fetchData(a.uuid, a.composed ? { name: a.name, system: { features: a.features } } : {}));
  }
  if (plan.items.community) batch.push(fetchData(plan.items.community.uuid));
  if (plan.items.transformation) batch.push(fetchData(plan.items.transformation.uuid));
  await createItems(batch);

  // ---- 4. multiclass ----
  if (plan.items.multiclass) {
    progress("multiclass");
    const mc = plan.items.multiclass;
    const clsDoc = await fromUuid(mc.class.uuid);
    const data = clsDoc.toObject();
    delete data._id;
    const [mcItem] = await createItems([Promise.resolve(foundry.utils.mergeObject(data, {
      _stats: { compendiumSource: mc.class.uuid },
      flags: flagsOf(),
      system: { isMulticlass: true, domains: [mc.domain], features: data.system.features.filter((f) => f.type !== "hope") },
    }))]);
    created.multiclassClass = mcItem ?? null;
    if (mcItem) await createItems([fetchData(mc.subclass.uuid, { system: { isMulticlass: true, featureState: mc.featureState } })]);
    else warn(`multiclass ${mc.class.name} was not created; its subclass skipped`);
  }

  // ---- 5. domain cards: loadout first, then vault ----
  progress("cards");
  const ordered = [...plan.items.domainCards.filter((c) => !c.inVault), ...plan.items.domainCards.filter((c) => c.inVault)];
  for (const card of ordered) {
    const [item] = await createItems([fetchData(card.uuid, { system: { inVault: card.inVault } })]);
    if (item) created.cards.set(card.builderId, item);
    else warn(`domain card ${card.name} was refused by the system (see console)`);
  }

  // ---- 6. equipment ----
  progress("equipment");
  const gear = [];
  if (plan.items.armor) gear.push(fetchData(plan.items.armor.uuid, { system: { equipped: true, armor: { current: plan.items.armor.current } } }));
  for (const w of plan.items.weapons) gear.push(fetchData(w.uuid, { system: { equipped: true, secondary: w.secondary } }));
  for (const c of plan.items.consumables) gear.push(fetchData(c.uuid, { system: { quantity: c.quantity } }));
  for (const l of plan.items.loot) gear.push(fetchData(l.uuid, { system: { quantity: l.quantity } }));
  await createItems(gear);

  // ---- 7. level history ----
  if (Object.keys(plan.levelups).length) {
    progress("levels");
    const levelups = resolveItemUuids(foundry.utils.deepClone(plan.levelups), {
      cardItemUuid: (id) => created.cards.get(id)?.uuid ?? null,
      multiclassItemUuid: () => created.multiclassClass?.uuid ?? null,
    });
    await actor.update({ "system.levelData.levelups": levelups });
  }

  // ---- 8. table state ----
  progress("state");
  await actor.update({
    "system.resources.hitPoints.value": plan.actorSystem.resources.hitPoints.value,
    "system.resources.stress.value": plan.actorSystem.resources.stress.value,
    "system.resources.hope.value": plan.actorSystem.resources.hope.value,
  });
  for (const id of plan.conditions) {
    if (!actor.statuses.has(id)) await actor.toggleStatusEffect(id, { active: true });
  }

  log(`imported ${actor.name}`, { actor, report });
  return { actor, report };
}

/** The Actors folder named in settings, created if missing; null when the setting is blank. */
async function actorFolder() {
  const name = (game.settings.get(MODULE_ID, SETTINGS.actorFolder) ?? "").trim();
  if (!name) return null;
  return game.folders.find((f) => f.type === "Actor" && f.name === name)
    ?? Folder.create({ name, type: "Actor" });
}

function joinHtml(existing, added) {
  const a = (existing ?? "").trim(), b = (added ?? "").trim();
  if (!b) return a;
  if (!a) return b;
  return `${a}<hr>${b}`;
}
