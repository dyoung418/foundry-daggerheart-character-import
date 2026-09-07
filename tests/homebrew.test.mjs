import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseSourceFiles, buildHomebrewItems, stableId, artKey, blocksToHtml, describeSource, describeCounts, featureKey, effectChanges, MODULE_ID } from "../scripts/lib/homebrew.mjs";
import { parseTransferFile } from "../scripts/lib/normalize.mjs";
import { buildPlan } from "../scripts/lib/plan.mjs";
import { composeAncestry } from "../scripts/lib/heritage.mjs";
import { homebrewResolver } from "./helpers/homebrew-resolver.mjs";
import { sample } from "./helpers/fixture-resolver.mjs";

const dir = new URL("../samples/homebrew/tinker/", import.meta.url);
const files = readdirSync(dir).map((name) => ({ name, text: readFileSync(new URL(name, dir), "utf8") }));
const PACK = "world.dhci-tinker";
const uuid = (id) => `Compendium.${PACK}.Item.${id}`;
const tail = (u) => u.split(".").pop();
const hb = (item) => item.flags[MODULE_ID].homebrew;

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
  const counts = (s) => [s.classes, s.subclasses, s.ancestries, s.communities, s.transformations, s.domainCards, s.items, s.weapons, s.armors, s.consumables].map((a) => a.length);
  assert.deepEqual(counts(r.source), [1, 1, 1, 1, 1, 3, 2, 3, 2, 1]);
  assert.equal(Object.keys(r.source.effects).length, 8);
  assert.equal(describeSource(r.source), "Tinker's Workshop (sample) (tinker): 1 class, 1 subclass, 1 ancestry, 1 community, 1 transformation, 3 domain cards, 2 items, 3 weapons, 2 armor, 1 consumable, 8 effects");
  // same content with unhelpful file names: recognised by shape
  const anon = parseSourceFiles(files.filter((f) => f.name !== "source.json").map((f, i) => ({ name: `file${i}.json`, text: f.text })));
  assert.equal(anon.ok, true, anon.error);
  assert.equal(anon.source.id, "tinker");
  assert.equal(anon.source.label, "Tinker", "label falls back to the source id");
  assert.deepEqual(counts(anon.source), counts(r.source), "every category recognised by shape");
  assert.equal(Object.keys(anon.source.effects).length, 8, "effects.json recognised by shape");
  // a single combined object
  const combined = parseSourceFiles([{ name: "x.json", text: JSON.stringify({ label: "Combined", classes: r.source.classes, domainCards: r.source.domainCards, weapons: r.source.weapons, effects: r.source.effects }) }]);
  assert.equal(combined.ok, true);
  assert.deepEqual([combined.source.classes.length, combined.source.weapons.length, Object.keys(combined.source.effects).length], [1, 3, 8]);
  // a source with only loot whose ids have no kind segment (Danny's data/homebrew items.json)
  const lootOnly = parseSourceFiles([{ name: "source.json", text: '{"label":"Homebrew","files":["items"]}' }, { name: "items.json", text: JSON.stringify([{ id: "homebrew_snack", name: { "en-US": "Premium Snack" }, set: "", roll: 1, features: [{ description: [{ paragraph: { "en-US": "Clear a Hit Point." } }] }] }]) }]);
  assert.equal(lootOnly.ok, true, lootOnly.error);
  assert.equal(lootOnly.source.id, "homebrew", "source id from the label when no id carries a kind");
  // failures
  assert.equal(parseSourceFiles([{ name: "a.json", text: "{ nope" }]).ok, false);
  assert.match(parseSourceFiles([{ name: "a.json", text: "[]" }]).error, /no classes, subclasses, ancestries, communities, transformations, domain cards, items, weapons, armor, consumables found/);
  assert.match(parseSourceFiles([{ name: "classes.json", text: JSON.stringify([{ name: "X", startingHitPoints: 5 }]) }]).error, /without a builder id/);
  assert.match(parseSourceFiles([{ name: "ancestries.json", text: JSON.stringify([{ id: "oddfolk", name: "Oddfolk", features: [] }]) }]).error, /without a builder id/, "ancestries need a real builder id");
  assert.deepEqual(parseSourceFiles([...files, { name: "notes.json", text: '{"hello": 1}' }]).ignored, ["notes.json"]);
});

test("buildHomebrewItems: features, loot, class, subclass, cards with stable cross-references", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const byName = Object.fromEntries(built.items.map((i) => [i.name, i]));
  const byId = Object.fromEntries(built.items.map((i) => [i._id, i]));
  assert.equal(built.items.length, 31, "15 (class path) + ancestry 3 + community 2 + transformation 3 + loot 2 + weapons 3 + armor 2 + consumable 1");
  assert.deepEqual(built.warnings, []);
  for (const item of built.items) {
    assert.match(item._id, /^[A-Za-z0-9]{16}$/);
    assert.equal(hb(item).sourceId, "tinker");
    assert.equal(item.system.attribution.source, "Tinker's Workshop (sample)");
  }
  const cls = byName["Tinker"];
  assert.equal(cls.type, "class");
  assert.deepEqual(cls.system.domains, ["gears", "codex"]);
  assert.equal(cls.system.hitPoints, 6);
  assert.equal(cls.system.evasion, 11);
  assert.deepEqual(cls.system.features.map((f) => [f.type, byId[tail(f.item)]?.name]), [["hope", "Spare Parts"], ["class", "Jury-Rig"], ["class", "Field Repair"]]);
  assert.deepEqual(cls.system.inventory.take.map((u) => byId[tail(u)]?.type), ["loot", "loot"]);
  assert.equal(byName["A roll of well-worn tools"].type, "loot");
  assert.equal(cls.system.backgroundQuestions[0], "What did you build that you wish you hadn't?");
  assert.equal(hb(cls).builderId, "tinker_class_tinker");
  assert.match(byName["Field Repair"].system.description, /<p>When you take a short rest.*<\/p><ul><li><p>Tier 1: one Armor Slot\.<\/p><\/li>/);
  assert.equal(byName["Spare Parts"].system.featureForm, "passive");
  assert.equal(byName["Spare Parts"].system.granter, null);

  const sub = byName["Clockwright"];
  assert.equal(sub.type, "subclass");
  assert.equal(sub.system.linkedClass, uuid(cls._id));
  assert.equal(sub.system.spellcastingTrait, "knowledge");
  assert.equal(sub.system.featureState, 1);
  assert.deepEqual(sub.system.features.map((f) => f.type), ["foundation", "foundation", "specialization", "mastery", "mastery"]);
  assert.equal(byId[tail(sub.system.features[2].item)].name, "Overwound");

  const card = byName["Gear Toss"];
  assert.equal(card.type, "domainCard");
  assert.deepEqual([card.system.domain, card.system.type, card.system.level, card.system.recallCost], ["gears", "spell", 1, 1]);
  assert.equal(card.img, "systems/daggerheart/assets/icons/documents/items/card-play.svg", "no system icon for a homebrew domain");
  assert.match(byName["Overclock"].system.description, /<ul><li><p>Your next attack/);
  assert.deepEqual(built.domains, [{ id: "gears", label: "Gears", src: "icons/svg/portal.svg" }], "codex is a system domain, gears is new");
  assert.equal(built.names["tinker_domain_card_steam_vent"], "Steam Vent");
  assert.deepEqual(built.counts, { classes: 1, subclasses: 1, ancestries: 1, communities: 1, transformations: 1, domainCards: 3, items: 2, weapons: 3, armors: 2, consumables: 1, effects: 8 });
  assert.equal(describeCounts(built.counts), describeSource(source).split(": ")[1]);

  // deterministic: building again gives identical ids
  const again = buildHomebrewItems(source, { packCollection: PACK });
  assert.deepEqual(again.items.map((i) => i._id), built.items.map((i) => i._id));
  // a different source id gives different ids (two sources can define the same content)
  const other = buildHomebrewItems({ ...source, id: "other" }, { packCollection: PACK });
  assert.notEqual(other.items[0]._id, built.items[0]._id);
});

test("buildHomebrewItems: ancestry, community, transformation with their features", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const byName = Object.fromEntries(built.items.map((i) => [i.name, i]));
  const byId = Object.fromEntries(built.items.map((i) => [i._id, i]));

  const anc = byName["Cogborn"];
  assert.equal(anc.type, "ancestry");
  assert.equal(anc.img, "systems/daggerheart/assets/icons/documents/items/family-tree.svg");
  assert.deepEqual(anc.system.features.map((f) => [f.type, byId[tail(f.item)]?.name]), [["primary", "Steady Gears"], ["secondary", "Oil-Slick"]]);
  assert.equal(anc.system.loreReference, null);
  assert.deepEqual(hb(anc), { sourceId: "tinker", builderId: "tinker_ancestry_cogborn", kind: "ancestry", featureNames: ["Steady Gears", "Oil-Slick"] });
  assert.deepEqual(hb(byName["Steady Gears"]), { sourceId: "tinker", parentId: "tinker_ancestry_cogborn", kind: "ancestryFeature" });

  const com = byName["Guildborne"];
  assert.equal(com.type, "community");
  assert.deepEqual(com.system.features.map((u) => byId[tail(u)]?.name), ["Union Card"], "community features are bare uuids");
  assert.match(com.system.description, /<p><em>Personalities:<\/em> meticulous, proud, thrifty\.<\/p>$/);

  const tr = byName["Clockwork Heart"];
  assert.equal(tr.type, "transformation");
  assert.deepEqual(tr.system.features.map((u) => byId[tail(u)]?.name), ["Ticking Resolve", "Wind-Down"]);
  assert.equal(tr.system.questions, "<ul><li><p>Who built your heart, and what did they ask in return?</p></li><li><p>What do you hear when the ticking stops?</p></li></ul>");

  // an ancestry with three features: first two are used, the rest is a warning
  const three = buildHomebrewItems({ id: "x", label: "X", ancestries: [{ id: "x_ancestry_many", name: "Many", features: [{ name: "A" }, { name: "B" }, { name: "C" }] }] }, { packCollection: PACK });
  assert.equal(three.items.find((i) => i.type === "ancestry").system.features.length, 2);
  assert.match(three.warnings[0], /Many has 3 features/);
});

test("buildHomebrewItems: weapons, armor, consumables, loot", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const byName = Object.fromEntries(built.items.map((i) => [i.name, i]));

  const hammer = byName["Wrench Hammer"];
  assert.equal(hammer.type, "weapon");
  const hs = hammer.system;
  assert.deepEqual([hs.tier, hs.secondary, hs.burden, hs.equipped, hs.quantity], [1, false, "oneHanded", false, 1]);
  assert.deepEqual([hs.attack.roll.trait, hs.attack.range, hs.attack.damage.main.value.dice, hs.attack.damage.main.value.bonus, hs.attack.damage.main.type], ["strength", "melee", "d8", null, ["physical"]]);
  assert.equal(hs.attack.type, "attack");
  assert.equal(hs.attack.systemPath, "attack");
  assert.match(hs.attack._id, /^[A-Za-z0-9]{16}$/);
  assert.deepEqual(hs.weaponFeatures, [], "features are applied by the caller through an update, so the system builds their effects");
  assert.deepEqual(built.itemFeatures[hammer._id], { field: "weaponFeatures", values: ["reliable"] });
  assert.equal(hb(hammer).builderId, "tinker_weapon_wrench_hammer");

  const dagger = byName["Spring Dagger"];
  assert.equal(dagger.system.secondary, true);
  assert.deepEqual(built.itemFeatures[dagger._id], { field: "weaponFeatures", values: ["dhci-tinker-coiled"] }, "an unknown feature becomes a custom one");
  assert.deepEqual(built.customFeatures.weapon.map((f) => [f.key, f.name, f.description]), [["dhci-tinker-coiled", "Coiled", "<p>Once per rest, mark a Stress to make this weapon&#39;s attack at Very Close range.</p>"]]);

  const rod = byName["Arc Rod"];
  const rs = rod.system;
  assert.deepEqual([rs.tier, rs.burden, rs.attack.roll.trait, rs.attack.range, rs.attack.damage.main.value.dice, rs.attack.damage.main.value.bonus, rs.attack.damage.main.type], [2, "twoHanded", "knowledge", "far", "d6", 1, ["magical"]]);
  assert.ok(built.notes.some((n) => /Arc Rod: uses the Spellcast trait/.test(n)), built.notes.join("\n"));
  assert.equal(built.itemFeatures[rod._id], undefined);

  const plate = byName["Brass Plate"];
  assert.equal(plate.type, "armor");
  assert.deepEqual([plate.system.tier, plate.system.armor, plate.system.baseThresholds, plate.system.armorFeatures], [1, { current: 0, max: 4 }, { major: 6, severe: 12 }, []]);
  assert.deepEqual(built.itemFeatures[plate._id], { field: "armorFeatures", values: ["flexible"] });
  assert.deepEqual(built.itemFeatures[byName["Gasket Weave"]._id], { field: "armorFeatures", values: ["dhci-tinker-greased"] });
  assert.deepEqual(built.customFeatures.armor.map((f) => f.key), ["dhci-tinker-greased"]);

  const flask = byName["Oil Flask"];
  assert.equal(flask.type, "consumable");
  assert.deepEqual([flask.system.consumeOnUse, flask.system.quantity], [true, 1]);
  assert.equal(flask.system.description, "<p>Clear a Stress the next time you wind a mechanism.</p>");
  const cog = byName["Spare Cog"];
  assert.equal(cog.type, "loot");
  assert.equal(cog.img, "systems/daggerheart/assets/icons/documents/items/open-treasure-chest.svg");
  assert.equal(hb(byName["Pocket Gizmo"]).builderId, "tinker_gizmo", "loot ids need no kind segment");
  assert.equal(built.names["tinker_gizmo"], "Pocket Gizmo");
});

test("featureKey: system names squash to keys, aliases, extras, unknown", () => {
  assert.equal(featureKey("weapon", "Reliable"), "reliable");
  assert.equal(featureKey("weapon", "Double Duty"), "doubleDuty");
  assert.equal(featureKey("weapon", "Follow-Up"), "followUp");
  assert.equal(featureKey("armor", "Very Heavy"), "veryheavy");
  assert.equal(featureKey("armor", "Fortune-Favored"), "fortuneFavored");
  assert.equal(featureKey("armor", "Magic"), "magical");
  assert.equal(featureKey("armor", "Greased"), null);
  assert.equal(featureKey("armor", "Greased", { greased: "dhci-x-greased" }), "dhci-x-greased");
});

test("effectChanges: stat keys, traits, negatives, and everything that becomes a note", () => {
  const r = effectChanges({ traits: { instinct: 1, Agility: -1 }, evasion: 1, hitPointSlots: 1, stressSlots: 2, majorThreshold: 3, severeThreshold: 4, attack: 1, spellcast: 1, extraDomainCards: 1 }, "X");
  assert.deepEqual(r.notes, []);
  assert.deepEqual(r.changes.map((c) => [c.key, c.type, c.value]), [
    ["system.traits.instinct.value", "add", 1], ["system.traits.agility.value", "subtract", 1], ["system.evasion", "add", 1],
    ["system.resources.hitPoints.max", "add", 1], ["system.resources.stress.max", "add", 2], ["system.damageThresholds.major", "add", 3],
    ["system.damageThresholds.severe", "add", 4], ["system.bonuses.roll.attack.bonus", "add", 1], ["system.bonuses.roll.spellcast.bonus", "add", 1],
    ["system.bonuses.maxLoadout", "add", 1],
  ]);
  assert.deepEqual(r.changes[0], { key: "system.traits.instinct.value", type: "add", value: 1, priority: null, phase: "initial" });
  const n = effectChanges({ armorScore: 1, majorThreshold: { equalTo: "proficiency" }, excluded: ["why"], choice: { prompt: "Pick one", kind: "benefit" }, when: true, feature: "F", permanent: true, bogus: 1, evasion: "x", traits: { luck: 1 } }, "Y");
  assert.deepEqual(n.changes, []);
  assert.deepEqual(n.notes, [
    "Y: +1 Armor Score is not automated (the system derives Armor Score from the armor item); raise the armor's score by hand",
    "Y: damageThresholds.major equal to proficiency is not automated (the system has no scaling effect); apply by hand",
    "Y: why",
    "Y: has a choice (Pick one) the builder asks for; apply the chosen benefit by hand",
    'Y: "when" is not automated',
    'Y: "bogus" is not a known effect key',
    'Y: evasion value "x" not understood',
    "Y: unknown trait luck",
  ]);
});

test("buildHomebrewItems: effects.json lands on the right feature, card or item", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const byName = Object.fromEntries(built.items.map((i) => [i.name, i]));
  const effectOf = (item) => item.effects.map((e) => [e.name, e.transfer, e.type, e.system.changes.map((c) => [c.key, c.type, c.value])]);
  assert.deepEqual(effectOf(byName["Steady Gears"]), [["Steady Gears", true, "base", [["system.traits.instinct.value", "add", 1]]]]);
  assert.deepEqual(effectOf(byName["Oil-Slick"]), [], "excluded only");
  assert.deepEqual(effectOf(byName["Ticking Resolve"]), [["Ticking Resolve", true, "base", [["system.resources.stress.max", "add", 1]]]]);
  assert.deepEqual(effectOf(byName["Precision Tools"]), [["Precision Tools", true, "base", [["system.resources.hitPoints.max", "add", 1]]]], "tier key with `feature` picks the named tier feature");
  assert.deepEqual(effectOf(byName["Wind-Up Companion"]), []);
  assert.deepEqual(effectOf(byName["Jury-Rig"]), [["Jury-Rig", true, "base", [["system.bonuses.roll.attack.bonus", "add", 1]]]]);
  assert.deepEqual(effectOf(byName["Gear Toss"]), [["Gear Toss", true, "base", [["system.evasion", "add", 1]]]]);
  assert.equal(byName["Gear Toss"].system.vaultActive, true, "permanent → the card stays active when vaulted");
  assert.equal(byName["Overclock"].system.vaultActive, false);
  assert.deepEqual(effectOf(byName["Steam Vent"]), [], "equalTo is a note, not an effect");
  assert.deepEqual(effectOf(byName["Brass Plate"]), [], "Flexible is the system's own armor feature");
  assert.match(byName["Steady Gears"].effects[0]._id, /^[A-Za-z0-9]{16}$/);
  assert.deepEqual(built.warnings, []);
  assert.deepEqual(built.notes.filter((n) => !/Arc Rod/.test(n)), [
    "Cogborn / Oil-Slick: Oil-Slick costs a Hope and happens in play, so it isn't counted here",
    "Gear Toss: permanent bonus; the card is marked vault-active so its effect stays on when vaulted",
    "Steam Vent: damageThresholds.major equal to proficiency is not automated (the system has no scaling effect); apply by hand",
    "effects: tinker_armor_brass_plate:Flexible is covered by the system's Flexible armor feature",
  ]);
  // keys without the source prefix, unknown records and unknown features
  const loose = buildHomebrewItems({ ...source, effects: { "ancestry_cogborn:Steady Gears": { evasion: 2 }, "tinker_ancestry_cogborn:Nope": { evasion: 1 }, "tinker_nothing": { evasion: 1 }, "tinker_armor_gasket_weave:Greased": { evasion: 1 } } }, { packCollection: PACK });
  const lb = Object.fromEntries(loose.items.map((i) => [i.name, i]));
  assert.deepEqual(effectOf(lb["Steady Gears"]), [["Steady Gears", true, "base", [["system.evasion", "add", 2]]]], "bare key matched");
  assert.deepEqual(effectOf(lb["Gasket Weave"]), [["Gasket Weave", true, "base", [["system.evasion", "add", 1]]]], "custom armor feature effect goes on the armor");
  assert.deepEqual(loose.warnings, ["effects: tinker_ancestry_cogborn:Nope names a feature Cogborn does not have", "effects: tinker_nothing names no record in this source"]);
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

test("plan: a character on homebrew class, subclass, heritage, gear and domain card resolves by builder id", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const ch = parseTransferFile(sample("homebrew-level1-tinker.json")).characters[0];
  const plan = buildPlan(ch, homebrewResolver(built, { packCollection: PACK }));
  assert.equal(plan.ok, true, JSON.stringify(plan.fatal));
  assert.deepEqual(plan.missing, []);
  const byType = (t) => built.items.find((i) => i.type === t);
  assert.equal(plan.items.class.name, "Tinker");
  assert.equal(plan.items.class.uuid, uuid(byType("class")._id));
  assert.equal(plan.items.subclass.name, "Clockwright");
  assert.deepEqual([plan.items.ancestry.name, plan.items.ancestry.uuid], ["Cogborn", uuid(byType("ancestry")._id)]);
  assert.deepEqual([plan.items.community.name, plan.items.community.uuid], ["Guildborne", uuid(byType("community")._id)]);
  assert.deepEqual([plan.items.transformation.name, plan.items.transformation.uuid], ["Clockwork Heart", uuid(byType("transformation")._id)]);
  assert.deepEqual(plan.items.domainCards.map((c) => c.name), ["Gear Toss", "Book of Ava"]);
  assert.deepEqual(plan.items.weapons.map((w) => [w.name, w.secondary]), [["Wrench Hammer", false], ["Spring Dagger", true]]);
  assert.equal(plan.items.armor.name, "Brass Plate");
  assert.deepEqual(plan.items.consumables.map((c) => c.name), ["Oil Flask"]);
  assert.equal(plan.items.loot.length, 2, "class items become the starting kit");
  assert.equal(plan.report.filter((r) => r.level === "warn").length, 0, JSON.stringify(plan.report));
  // without the homebrew pack the same character fails on class and subclass, as before
  const bare = buildPlan(ch, homebrewResolver({ items: [] }));
  assert.equal(bare.ok, false);
  assert.match(bare.fatal[0], /class Tinker not found/);
});

test("heritage: a mixed ancestry with a homebrew half uses the feature names stored on the item", () => {
  const { source } = parseSourceFiles(files);
  const built = buildHomebrewItems(source, { packCollection: PACK });
  const resolver = homebrewResolver(built, { packCollection: PACK });
  assert.deepEqual(resolver.featureNames("tinker_ancestry_cogborn"), ["Steady Gears", "Oil-Slick"]);
  const heritage = { ancestryMode: "mixed", ancestryIds: ["srd_2_0_ancestry_clank", "tinker_ancestry_cogborn"], chosenFeatures: [{ ancestryId: "srd_2_0_ancestry_clank", featureName: "Purposeful Design" }, { ancestryId: "tinker_ancestry_cogborn", featureName: "Oil-Slick" }] };
  const warnings = [];
  const composed = composeAncestry(heritage, { ancestry: (id) => resolver.lookupById(id) ?? resolver.lookup("ancestry", resolver.nameOf(id)), featureNames: resolver.featureNames, warn: (m) => warnings.push(m) });
  assert.deepEqual(warnings, []);
  assert.equal(composed.name, "Clank/Cogborn");
  assert.equal(composed.features[1].item, resolver.lookupById("tinker_ancestry_cogborn").features[1].item, "Cogborn's secondary feature (Oil-Slick)");
});
