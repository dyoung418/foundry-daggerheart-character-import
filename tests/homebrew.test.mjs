import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseSourceFiles, buildHomebrewItems, stableId, artKey, blocksToHtml, describeSource, MODULE_ID } from "../scripts/lib/homebrew.mjs";
import { parseTransferFile } from "../scripts/lib/normalize.mjs";
import { buildPlan } from "../scripts/lib/plan.mjs";
import { homebrewResolver } from "./helpers/homebrew-resolver.mjs";
import { sample } from "./helpers/fixture-resolver.mjs";

const dir = new URL("../samples/homebrew/tinker/", import.meta.url);
const files = readdirSync(dir).map((name) => ({ name, text: readFileSync(new URL(name, dir), "utf8") }));
const PACK = "world.dhci-tinker";
const uuid = (id) => `Compendium.${PACK}.Item.${id}`;

test("stableId: deterministic, 16 alphanumerics, distinct inputs differ", () => {
  assert.equal(stableId("tinker:tinker_class_tinker"), stableId("tinker:tinker_class_tinker"));
  assert.match(stableId("tinker:tinker_class_tinker"), /^[A-Za-z0-9]{16}$/);
  const ids = new Set(["a", "b", "ab", "ba", "tinker:x:feature:0", "tinker:x:feature:1"].map(stableId));
  assert.equal(ids.size, 6);
});

test("parseSourceFiles: the sample folder, by file name and by shape", () => {
  const r = parseSourceFiles(files);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.source.id, "tinker");
  assert.equal(r.source.label, "Tinker's Workshop (sample)");
  assert.deepEqual([r.source.classes.length, r.source.subclasses.length, r.source.domainCards.length], [1, 1, 3]);
  assert.match(describeSource(r.source), /1 class, 1 subclass, 3 domain cards/);
  // same content with unhelpful file names: recognised by shape
  const anon = parseSourceFiles(files.filter((f) => f.name !== "source.json").map((f, i) => ({ name: `file${i}.json`, text: f.text })));
  assert.equal(anon.ok, true);
  assert.equal(anon.source.id, "tinker");
  assert.equal(anon.source.label, "Tinker", "label falls back to the source id");
  assert.equal(anon.source.domainCards.length, 3);
  // a single combined object
  const combined = parseSourceFiles([{ name: "x.json", text: JSON.stringify({ label: "Combined", classes: r.source.classes, domainCards: r.source.domainCards }) }]);
  assert.equal(combined.ok, true);
  assert.equal(combined.source.classes.length, 1);
  // failures
  assert.equal(parseSourceFiles([{ name: "a.json", text: "{ nope" }]).ok, false);
  assert.match(parseSourceFiles([{ name: "a.json", text: "[]" }]).error, /no classes/);
  assert.match(parseSourceFiles([{ name: "classes.json", text: JSON.stringify([{ name: "X", startingHitPoints: 5 }]) }]).error, /without a builder id/);
  assert.deepEqual(parseSourceFiles([...files, { name: "notes.json", text: '{"hello": 1}' }]).ignored, ["notes.json"]);
});

test("buildHomebrewItems: features, loot, class, subclass, cards with stable cross-references", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const byName = Object.fromEntries(built.items.map((i) => [i.name, i]));
  const byId = Object.fromEntries(built.items.map((i) => [i._id, i]));
  assert.equal(built.items.length, 15, "1 hope + 2 class + 5 subclass features, 2 loot, 1 class, 1 subclass, 3 cards");
  assert.deepEqual(built.warnings, []);
  for (const item of built.items) {
    assert.match(item._id, /^[A-Za-z0-9]{16}$/);
    assert.equal(item.flags[MODULE_ID].homebrew.sourceId, "tinker");
    assert.equal(item.system.attribution.source, "Tinker's Workshop (sample)");
  }
  const cls = byName["Tinker"];
  assert.equal(cls.type, "class");
  assert.deepEqual(cls.system.domains, ["gears", "codex"]);
  assert.equal(cls.system.hitPoints, 6);
  assert.equal(cls.system.evasion, 11);
  assert.deepEqual(cls.system.features.map((f) => [f.type, byId[f.item.split(".").pop()]?.name]), [["hope", "Spare Parts"], ["class", "Jury-Rig"], ["class", "Field Repair"]]);
  assert.deepEqual(cls.system.inventory.take.map((u) => byId[u.split(".").pop()]?.type), ["loot", "loot"]);
  assert.equal(byName["A roll of well-worn tools"].type, "loot");
  assert.equal(cls.system.backgroundQuestions[0], "What did you build that you wish you hadn't?");
  assert.equal(cls.flags[MODULE_ID].homebrew.builderId, "tinker_class_tinker");
  assert.match(byName["Field Repair"].system.description, /<p>When you take a short rest.*<\/p><ul><li><p>Tier 1: one Armor Slot\.<\/p><\/li>/);
  assert.equal(byName["Spare Parts"].system.featureForm, "passive");
  assert.equal(byName["Spare Parts"].system.granter, null);

  const sub = byName["Clockwright"];
  assert.equal(sub.type, "subclass");
  assert.equal(sub.system.linkedClass, uuid(cls._id));
  assert.equal(sub.system.spellcastingTrait, "knowledge");
  assert.equal(sub.system.featureState, 1);
  assert.deepEqual(sub.system.features.map((f) => f.type), ["foundation", "foundation", "specialization", "mastery", "mastery"]);
  assert.equal(byId[sub.system.features[2].item.split(".").pop()].name, "Overwound");

  const card = byName["Gear Toss"];
  assert.equal(card.type, "domainCard");
  assert.deepEqual([card.system.domain, card.system.type, card.system.level, card.system.recallCost], ["gears", "spell", 1, 1]);
  assert.equal(card.img, "systems/daggerheart/assets/icons/documents/items/card-play.svg", "no system icon for a homebrew domain");
  assert.match(byName["Overclock"].system.description, /<ul><li><p>Your next attack/);
  assert.deepEqual(built.domains, [{ id: "gears", label: "Gears", src: "icons/svg/portal.svg" }], "codex is a system domain, gears is new");
  assert.equal(built.names["tinker_domain_card_steam_vent"], "Steam Vent");

  // deterministic: building again gives identical ids
  const again = buildHomebrewItems(source, { packCollection: PACK });
  assert.deepEqual(again.items.map((i) => i._id), built.items.map((i) => i._id));
  // a different source id gives different ids (two sources can define the same content)
  const other = buildHomebrewItems({ ...source, id: "other" }, { packCollection: PACK });
  assert.notEqual(other.items[0]._id, built.items[0]._id);
});

test("buildHomebrewItems: subclass of an SRD class links through the callback; card in a system domain gets its icon; art attaches", () => {
  const source = {
    id: "hb", label: "HB",
    classes: [],
    subclasses: [{ id: "hb_subclass_stormcaller", name: { "en-US": "Stormcaller" }, class: "BARD", spellcastTrait: "PRESENCE", foundation: { features: [{ name: { "en-US": "Thunderclap" }, description: [{ paragraph: { "en-US": "Boom." } }] }] } }],
    domainCards: [{ id: "hb_domain_card_quiet_word", name: { "en-US": "Quiet Word" }, domain: "GRACE", type: "ABILITY", level: 3, recallCost: 0, features: [{ description: [{ paragraph: { "en-US": "Shh." } }] }] }],
  };
  const art = { "hb_domain_card_quiet_word": "art/quiet.png", "hb_subclass_stormcaller-foundation": "art/storm-f.png" };
  const built = buildHomebrewItems(source, { packCollection: PACK, classUuid: (name) => name === "Bard" ? "Compendium.daggerheart.classes.Item.vegl3bFOq3pcFTWT" : null, art });
  const sub = built.items.find((i) => i.type === "subclass");
  assert.equal(sub.system.linkedClass, "Compendium.daggerheart.classes.Item.vegl3bFOq3pcFTWT");
  assert.equal(sub.img, "art/storm-f.png");
  assert.equal(built.items.find((i) => i.name === "Thunderclap").img, "art/storm-f.png");
  const card = built.items.find((i) => i.type === "domainCard");
  assert.equal(card.img, "art/quiet.png");
  assert.deepEqual(built.domains, []);
  const noArt = buildHomebrewItems(source, { packCollection: PACK, classUuid: () => null });
  assert.equal(noArt.items.find((i) => i.type === "domainCard").img, "systems/daggerheart/assets/icons/domains/domain-card/grace.png");
  assert.equal(noArt.items.find((i) => i.type === "subclass").system.linkedClass, null);
  assert.match(noArt.warnings[0], /Stormcaller: class Bard not found/);
});

test("artKey: card, subclass tier, and non-builder file names", () => {
  assert.equal(artKey("void_domain_card_blood_spike.png"), "void_domain_card_blood_spike");
  assert.equal(artKey("card-art/subclass/void_subclass_necromancy-mastery.png"), "void_subclass_necromancy-mastery");
  assert.equal(artKey("tinker_class_tinker.webp"), "tinker_class_tinker");
  assert.equal(artKey("portrait.png"), null);
  assert.equal(artKey(""), null);
});

test("blocksToHtml escapes and tolerates odd input", () => {
  assert.equal(blocksToHtml([{ paragraph: { "en-US": "<b>&" } }]), "<p>&lt;b&gt;&amp;</p>");
  assert.equal(blocksToHtml("plain"), "<p>plain</p>");
  assert.equal(blocksToHtml(null), "");
  assert.equal(blocksToHtml([{ note: { "en-US": "x" } }, null]), "<p>x</p>");
});

test("plan: a character on homebrew class, subclass and domain card resolves by builder id", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const ch = parseTransferFile(sample("homebrew-level1-tinker.json")).characters[0];
  const plan = buildPlan(ch, homebrewResolver(built, { packCollection: PACK }));
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.items.class.name, "Tinker");
  assert.equal(plan.items.class.uuid, uuid(built.items.find((i) => i.type === "class")._id));
  assert.equal(plan.items.subclass.name, "Clockwright");
  assert.deepEqual(plan.items.domainCards.map((c) => c.name), ["Gear Toss", "Book of Ava"]);
  assert.equal(plan.items.loot.length, 2, "class items become the starting kit");
  assert.equal(plan.report.filter((r) => r.level === "warn").length, 0, JSON.stringify(plan.report));
  // without the homebrew pack the same character fails on class and subclass, as before
  const bare = buildPlan(ch, homebrewResolver({ items: [] }));
  assert.equal(bare.ok, false);
  assert.match(bare.fatal[0], /class Tinker not found/);
});
