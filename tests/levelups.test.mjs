import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseTransferFile } from "../scripts/lib/normalize.mjs";
import { translateLevelUps, resolveItemUuids, tierOf } from "../scripts/lib/levelups.mjs";
import { fixtureResolver, sample } from "./helpers/fixture-resolver.mjs";

const EXPECTED = new URL("../samples/foundry/expected-levelups-level5-ranger.json", import.meta.url);

function translateRanger() {
  const ch = parseTransferFile(sample("level5-ranger-multiclass.json")).characters[0];
  const r = fixtureResolver();
  const experienceIds = Object.fromEntries(ch.experiences.map((e, i) => [e.id, `EXP${i + 1}`]));
  const warnings = [];
  const uuidOf = (type) => (id) => r.lookup(type, r.nameOf(id))?.uuid ?? null;
  const levelups = translateLevelUps(ch, { cardUuid: uuidOf("domainCard"), classUuid: uuidOf("class"), subclassUuid: uuidOf("subclass"), experienceIds, warn: (m) => warnings.push(m) });
  return { levelups, warnings };
}

test("tierOf follows the default level tiers", () => {
  assert.deepEqual([1, 2, 4, 5, 7, 8, 10].map(tierOf), [2, 2, 2, 3, 3, 4, 4]);
});

test("ranger level history matches the snapshot verified in Foundry", () => {
  const { levelups, warnings } = translateRanger();
  assert.deepEqual(warnings, []);
  if (process.env.UPDATE_SNAPSHOT) writeFileSync(EXPECTED, JSON.stringify({ _comment: "system.levelData.levelups produced by lib/levelups.mjs for samples/level5-ranger-multiclass.json, before embedded item uuids are resolved (_cardId/_multiclass markers). Imported into Daggerheart 2.9.2 on 2026-09-06 and rendered correctly in the sheet's level-up view. Regenerate with UPDATE_SNAPSHOT=1 npm test.", levelups }, null, 2) + "\n");
  const expected = JSON.parse(readFileSync(EXPECTED, "utf8")).levelups;
  assert.deepEqual(levelups, expected);
});

test("resolveItemUuids fills embedded uuids and strips markers", () => {
  const { levelups } = translateRanger();
  const out = resolveItemUuids(levelups, { cardItemUuid: (id) => `Actor.A.Item.${id.slice(-6)}`, multiclassItemUuid: () => "Actor.A.Item.MC" });
  assert.equal(out[2].achievements.domainCards[0].itemUuid, "Actor.A.Item.tongue");
  assert.equal(out[4].selections[1].itemUuid, "Actor.A.Item.rocity");
  assert.equal(out[5].selections[0].itemUuid, "Actor.A.Item.MC");
  assert.equal(JSON.stringify(out).includes("_cardId"), false);
  assert.equal(JSON.stringify(out).includes("_multiclass"), false);
});

test("a missing card is dropped from the record with a warning, boxes stay contiguous", () => {
  const ch = parseTransferFile(sample("level5-ranger-multiclass.json")).characters[0];
  ch.levelUps[2].picks[1].cardId = "void_domain_card_nope";
  const warnings = [];
  const r = fixtureResolver();
  const uuidOf = (type) => (id) => r.lookup(type, r.nameOf(id) ?? "x")?.uuid ?? null;
  const levelups = translateLevelUps(ch, { cardUuid: uuidOf("domainCard"), classUuid: uuidOf("class"), subclassUuid: uuidOf("subclass"), experienceIds: {}, warn: (m) => warnings.push(m) });
  assert.equal(levelups[4].selections.length, 1);
  assert.match(warnings[0], /void_domain_card_nope not found/);
});

test("a class-declared pick (Brawler combo die) maps to the class's own level-up option", async () => {
  const { buildPlan } = await import("../scripts/lib/plan.mjs");
  const ch = parseTransferFile(sample("level5-ranger-multiclass.json")).characters[0];
  ch.classId = "srd_2_0_class_brawler"; ch.subclassId = "srd_2_0_subclass_juggernaut"; ch.multiclass = null;
  ch.domainCardIds = []; ch.domainVaultIds = [];
  ch.levelUps = [{ level: 2, picks: [{ key: "srd_2_0_class_brawler:Combo Strike", slotTier: 2, optionLabel: "Increase your Combo Die by one step" }, { key: "hitPoint", slotTier: 2 }], mandatoryCardId: null, grantedCardIds: [], exchange: null }];
  ch.level = 2;
  const plan = buildPlan(ch, fixtureResolver());
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  const sel = plan.levelups[2].selections[0];
  assert.equal(sel.type, "dice");
  assert.equal(sel.subType, "comboDieIndex");
  assert.equal(sel.optionKey, "UXJXoQH2UH12UaWS");
  assert.equal(sel.checkboxNr, 1);
  assert.equal(plan.report.filter((r) => r.level === "warn").length, 0, JSON.stringify(plan.report));
});
