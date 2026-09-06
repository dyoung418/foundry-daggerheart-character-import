import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTransferFile, perTierSlots, summarize } from "../scripts/lib/normalize.mjs";

const sample = (name) => readFileSync(new URL(`../samples/${name}`, import.meta.url), "utf8");

test("rejects non-builder files", () => {
  assert.equal(parseTransferFile("not json").ok, false);
  assert.equal(parseTransferFile('{"format":"other","characters":[{}]}').ok, false);
  assert.equal(parseTransferFile('{"format":"daggerheart-character-builder","version":2,"characters":[{"name":"x"}]}').ok, false);
  assert.equal(parseTransferFile('{"format":"daggerheart-character-builder","version":1,"characters":[]}').ok, false);
});

test("reads the roster sample and keeps every character", () => {
  const r = parseTransferFile(sample("roster.json"));
  assert.equal(r.ok, true);
  assert.equal(r.characters.length, 2);
  assert.equal(r.dropped, 0);
  assert.equal(r.version, 1);
  assert.equal(r.characters[1].level, 5);
  assert.equal(r.characters[1].multiclass.classId, "srd_2_0_class_druid");
});

test("repairs the legacy pre-levels sample", () => {
  const r = parseTransferFile(sample("legacy-pre-levels.json"));
  assert.equal(r.ok, true);
  const ch = r.characters[0];
  assert.deepEqual(ch.advancementSlotsUsed.traits, { 2: 1, 3: 0, 4: 0 });
  assert.equal("weaponMode" in ch, false);
  assert.deepEqual(ch.levelUps, []);
  assert.deepEqual(ch.state, { hp: 0, stress: 0, hope: 2, armor: 0, scars: 0, conditions: [], notes: "" });
  assert.ok(ch.experiences.every((e) => e.id && Number.isInteger(e.baseModifier) && Number.isInteger(e.sinceLevel)));
  assert.deepEqual(ch.creationDomainCardIds, ch.domainCardIds.slice(0, 2));
  assert.equal(ch.multiclass, null);
});

test("junk entries are dropped and counted; level is clamped", () => {
  const r = parseTransferFile(JSON.stringify({ format: "daggerheart-character-builder", version: 1, characters: [null, 5, { name: "Z", level: 42, state: "x", traits: "no" }] }));
  assert.equal(r.ok, true);
  assert.equal(r.dropped, 2);
  assert.equal(r.characters[0].level, 10);
  assert.equal(r.characters[0].state.hope, 2);
  assert.equal(r.characters[0].traits.agility, null);
});

test("perTierSlots accepts both shapes", () => {
  assert.deepEqual(perTierSlots({ traits: 2 }).traits, { 2: 2, 3: 0, 4: 0 });
  assert.deepEqual(perTierSlots({ traits: { 2: 1, 3: 2 } }).traits, { 2: 1, 3: 2, 4: 0 });
  assert.deepEqual(perTierSlots({}).multiclass, { 2: 0, 3: 0, 4: 0 });
});

test("summarize names the class, subclass, ancestry and community", () => {
  const r = parseTransferFile(sample("level1-bard.json"));
  const names = { srd_2_0_class_bard: "Bard", srd_2_0_subclass_troubadour: "Troubadour", srd_2_0_ancestry_clank: "Clank", srd_2_0_community_highborne: "Highborne" };
  assert.equal(summarize(r.characters[0], (id) => names[id] ?? id), "Bard / Troubadour · Clank · Highborne");
});
