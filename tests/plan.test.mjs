import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransferFile } from "../scripts/lib/normalize.mjs";
import { buildPlan, describePlan } from "../scripts/lib/plan.mjs";
import { fixtureResolver, sample } from "./helpers/fixture-resolver.mjs";

const load = (file) => parseTransferFile(sample(file)).characters[0];
const CLASSES = "Compendium.daggerheart.classes.Item.";

test("level-1 bard: everything resolves, no warnings", () => {
  const plan = buildPlan(load("level1-bard.json"), fixtureResolver());
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.items.class.name, "Bard");
  assert.equal(plan.items.subclass.name, "Troubadour");
  assert.equal(plan.items.subclass.featureState, 1);
  assert.equal(plan.items.ancestry.name, "Clank");
  assert.equal(plan.items.ancestry.composed, false);
  assert.equal(plan.items.community.name, "Highborne");
  assert.deepEqual(plan.items.domainCards.map((c) => [c.name, c.inVault]), [["Deft Deceiver", false], ["Book of Ava", false]]);
  assert.deepEqual(plan.items.weapons.map((w) => [w.name, w.secondary]), [["Rapier", false], ["Shortsword", true]]);
  assert.equal(plan.items.armor.name, "Gambeson Armor");
  assert.equal(plan.items.consumables[0].name, "Minor Health Potion");
  assert.equal(plan.items.loot.length, 3, "class inventory.take: torch, rope, supplies");
  assert.deepEqual(plan.actorSystem.traits.presence, { value: 2, tierMarked: false });
  assert.equal(plan.actorSystem.levelData.level.current, 1);
  assert.deepEqual(plan.levelups, {});
  const exps = Object.values(plan.actorSystem.experiences);
  assert.deepEqual(exps.map((e) => [e.name, e.value]), [["Silver Tongue", 3], ["Court Etiquette", 2]], "Purposeful Design +1 on the first");
  assert.equal(plan.report.filter((r) => r.level === "warn").length, 0, JSON.stringify(plan.report));
  assert.match(describePlan(plan), /Bard \/ Troubadour · Clank · Highborne · 2 domain cards · 2 weapons, armor/);
  assert.equal(plan.biography.background.startsWith("<p>A court musician"), true);
  assert.equal(plan.flags["daggerheart-character-import"].builder.id, "char_lvl1bard");
});

test("level-5 ranger: mixed ancestry, multiclass, vault, level history", () => {
  const plan = buildPlan(load("level5-ranger-multiclass.json"), fixtureResolver({ ids: ["E1", "E2", "E3", "E4"] }));
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.items.ancestry.name, "Drakona/Elf");
  assert.equal(plan.items.ancestry.composed, true);
  assert.deepEqual(plan.items.ancestry.features.map((f) => f.type), ["primary", "secondary"]);
  assert.ok(plan.items.ancestry.features.every((f) => f.item?.startsWith("Compendium.daggerheart.ancestries.Item.")));
  assert.equal(plan.items.multiclass.class.name, "Druid");
  assert.equal(plan.items.multiclass.subclass.name, "Warden of the Elements");
  assert.equal(plan.items.multiclass.domain, "arcana");
  assert.equal(plan.items.domainCards.length, 7);
  assert.equal(plan.items.domainCards.filter((c) => c.inVault).length, 3);
  // creation traits = final minus level-up picks (level 2 raised agility and instinct by 1)
  assert.equal(plan.actorSystem.traits.agility.value, 2);
  assert.equal(plan.actorSystem.traits.instinct.value, 1);
  assert.equal(plan.actorSystem.proficiency, 1);
  assert.equal(plan.actorSystem.resources.hitPoints.max, null);
  assert.deepEqual(plan.actorSystem.resources.hope, { value: 4, max: null });
  assert.equal(plan.actorSystem.resources.hitPoints.value, 3);
  assert.equal(plan.actorSystem.scars, 1);
  assert.deepEqual(plan.conditions, ["vulnerable"]);
  assert.equal(plan.items.armor.current, 1);
  // experiences: base values, ids from the factory
  assert.deepEqual(plan.experienceIds, { exp_start1: "E1", exp_start2: "E2", exp_lv2: "E3", exp_lv5: "E4" });
  assert.equal(plan.actorSystem.experiences.E1.value, 2, "level-up bumps are in levelups, not the base value");
  // level history
  assert.deepEqual(Object.keys(plan.levelups), ["2", "3", "4", "5"]);
  const l2 = plan.levelups[2];
  assert.deepEqual(l2.achievements.experiences, { E3: { name: "Seen It Before", modifier: 2 } });
  assert.equal(l2.achievements.proficiency, 1);
  assert.equal(l2.achievements.domainCards[0]._cardId, "srd_2_0_domain_card_natures_tongue");
  assert.deepEqual(l2.selections.map((s) => [s.type, s.checkboxNr, s.data]), [["trait", 1, ["agility", "instinct"]], ["hitPoint", 1, []]]);
  const l4 = plan.levelups[4];
  assert.deepEqual(l4.selections[0].data, ["E1", "E3"]);
  assert.equal(l4.selections[1].type, "domainCard");
  assert.equal(l4.selections[1].secondaryData.limit, "4");
  assert.equal(l4.selections[1]._cardId, "srd_2_0_domain_card_ferocity");
  const l5 = plan.levelups[5];
  assert.equal(l5.selections[0].type, "multiclass");
  assert.equal(l5.selections[0].minCost, 2);
  assert.equal(l5.selections[0].tier, 3);
  assert.equal(l5.selections[0].data[0], CLASSES + "ZNwUTCyGCEcidZFv");
  assert.equal(l5.selections[0].secondaryData.domain, "arcana");
  assert.equal(l5.achievements.proficiency, 1);
  assert.equal(plan.report.filter((r) => r.level === "warn").length, 0, JSON.stringify(plan.report));
});

test("level-5 ranger with level-up automation off: totals written, multiclass skipped", () => {
  const plan = buildPlan(load("level5-ranger-multiclass.json"), fixtureResolver(), { levelupAuto: false });
  assert.equal(plan.ok, true);
  assert.equal(plan.items.multiclass, null);
  assert.equal(plan.actorSystem.traits.agility.value, 3);
  assert.equal(plan.actorSystem.proficiency, 3);
  assert.equal(plan.actorSystem.evasion, 1);
  assert.equal(plan.actorSystem.resources.hitPoints.max, 1);
  assert.equal(plan.actorSystem.resources.stress.max, 7);
  assert.equal(Object.values(plan.actorSystem.experiences)[0].value, 3);
  assert.deepEqual(plan.levelups, {});
  assert.ok(plan.report.some((r) => /multiclass .* skipped/.test(r.message)));
});

test("legacy srd_1_0 file resolves by name; missing history is reported", () => {
  const plan = buildPlan(load("legacy-pre-levels.json"), fixtureResolver());
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.items.class.name, "Guardian");
  assert.equal(plan.items.subclass.name, "Stalwart");
  assert.equal(plan.items.ancestry.name, "Dwarf");
  assert.equal(plan.items.weapons[1].name, "Round Shield");
  assert.equal(plan.actorSystem.traits.strength.value, 3, "no history: finals written");
  assert.equal(plan.actorSystem.resources.hitPoints.max, 1);
  assert.ok(plan.report.some((r) => /no level-up history/.test(r.message)));
});

test("unknown content is fatal for class, a warning for gear", () => {
  const ch = load("level1-bard.json");
  ch.equipment.primaryWeaponId = "void_weapon_sunfire_blade";
  const plan = buildPlan(ch, fixtureResolver());
  assert.equal(plan.ok, true);
  assert.equal(plan.items.weapons.length, 1);
  assert.deepEqual(plan.missing.map((m) => m.id), ["void_weapon_sunfire_blade"]);
  assert.ok(plan.report.some((r) => /Sunfire Blade.*not found/.test(r.message)));
  ch.classId = "void_class_nope";
  const bad = buildPlan(ch, fixtureResolver());
  assert.equal(bad.ok, false);
  assert.match(bad.fatal[0], /class Nope not found/);
});
