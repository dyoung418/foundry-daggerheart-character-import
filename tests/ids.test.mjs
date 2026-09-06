import { test } from "node:test";
import assert from "node:assert/strict";
import { parseId, bareId, typeOf, nameFromId, normalizeName } from "../scripts/lib/ids.mjs";

test("parseId splits source, kind and tail", () => {
  assert.deepEqual(parseId("srd_2_0_domain_card_a_soldiers_bond"), { source: "srd_2_0", kind: "domain_card", tail: "a_soldiers_bond", bare: "domain_card_a_soldiers_bond" });
  assert.deepEqual(parseId("srd_1_0_subclass_stalwart"), { source: "srd_1_0", kind: "subclass", tail: "stalwart", bare: "subclass_stalwart" });
  assert.equal(parseId("srd_2_0_class_bard").kind, "class");
  assert.equal(parseId("void_weapon_sunfire_blade").source, "void");
  assert.equal(parseId("weapon_broadsword").source, "");
});

test("parseId rejects sentinels and junk", () => {
  assert.equal(parseId("unarmed"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId(null), null);
  assert.equal(bareId("unarmored"), "unarmored");
});

test("typeOf maps kinds to Foundry item types", () => {
  assert.equal(typeOf("srd_2_0_domain_card_vitality"), "domainCard");
  assert.equal(typeOf("srd_2_0_armor_gambeson_armor"), "armor");
  assert.equal(typeOf("srd_2_0_transformation_demigod"), "transformation");
  assert.equal(typeOf("unarmed"), null);
});

test("nameFromId and normalizeName agree modulo punctuation", () => {
  assert.equal(nameFromId("srd_2_0_domain_card_a_soldiers_bond"), "A Soldiers Bond");
  assert.equal(normalizeName("A Soldier’s Bond"), "a soldier s bond");
  assert.notEqual(normalizeName(nameFromId("srd_2_0_domain_card_a_soldiers_bond")), normalizeName("A Soldier’s Bond"));
  assert.equal(normalizeName("Gambeson Armor"), normalizeName(nameFromId("srd_2_0_armor_gambeson_armor")));
});
