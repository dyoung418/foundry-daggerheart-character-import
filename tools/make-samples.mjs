// Generates sample transfer files by driving the builder's own modules, so the output is the
// exact shape a player uploads. Run: node make-samples.mjs <outdir>
import { readFileSync, writeFileSync } from "node:fs";
const B = "/home/danny/daggerheart-character-builder/";
const { ensureLevelFields, blankSlotsUsed } = await import(B + "shared/advancement.js");
const { writeLevelEntry, recomputeCharacter } = await import(B + "shared/history.js");
const { serializeTransferFile } = await import(B + "shared/transfer.js");
const { mergeSources, CONTENT_FILES } = await import(B + "shared/content-sources.js");
const { derivedStats } = await import(B + "shared/derived-stats.js");
const { deriveSheet } = await import(B + "shared/sheet-data.js");

const records = {};
for (const file of Object.keys(CONTENT_FILES)) {
  try { records[file] = JSON.parse(readFileSync(`${B}data/srd_2_0/${file}.json`, "utf8")); } catch {}
}
const { db } = mergeSources([{ name: "srd_2_0", label: "SRD 2.0", records }]);

function blank(id) {
  return ensureLevelFields({
    id, name: "", pronouns: "", classId: null, subclassId: null,
    heritage: { ancestryMode: "pure", ancestryIds: [], chosenFeatures: [], communityId: null },
    traits: { agility: null, strength: null, finesse: null, instinct: null, presence: null, knowledge: null },
    equipment: { primaryWeaponId: null, secondaryWeaponId: null, armorId: null, potionChoice: null },
    transformationId: null, background: { description: "", answers: "" },
    experiences: [
      { id: "exp_start1", name: "", modifier: 2, baseModifier: 2, sinceLevel: 1 },
      { id: "exp_start2", name: "", modifier: 2, baseModifier: 2, sinceLevel: 1 },
    ],
    domainCardIds: [], creationDomainCardIds: [], connectionsNotes: "", level: 1, proficiency: 1,
    traitMarks: { agility: false, strength: false, finesse: false, instinct: false, presence: false, knowledge: false },
    hitPointSlotsBonus: 0, stressSlotsBonus: 0, evasionBonus: 0, subclassTier: "foundation",
    advancementSlotsUsed: blankSlotsUsed(), domainVaultIds: [], updatedAt: null,
  });
}

// ---- 1. Level 1 Bard ----
const bard = blank("char_lvl1bard");
Object.assign(bard, {
  name: "Lyra Quillwright", pronouns: "she/her",
  classId: "srd_2_0_class_bard", subclassId: "srd_2_0_subclass_troubadour",
  heritage: { ancestryMode: "pure", ancestryIds: ["srd_2_0_ancestry_clank"],
    chosenFeatures: [
      { ancestryId: "srd_2_0_ancestry_clank", featureName: "Purposeful Design" },
      { ancestryId: "srd_2_0_ancestry_clank", featureName: "Efficient" },
    ], communityId: "srd_2_0_community_highborne" },
  traits: { agility: 0, strength: -1, finesse: 1, instinct: 0, presence: 2, knowledge: 1 },
  equipment: { primaryWeaponId: "srd_2_0_weapon_rapier", secondaryWeaponId: "srd_2_0_weapon_shortsword",
    armorId: "srd_2_0_armor_gambeson_armor", potionChoice: "srd_2_0_consumable_minor_health_potion" },
  background: { description: "A court musician who fled after a song offended the wrong duke.",
    answers: "Who taught you your first song? A clockmaker who wound me every morning." },
  connectionsNotes: "Owes Thessaly a favour from the road.",
  domainCardIds: ["srd_2_0_domain_card_deft_deceiver", "srd_2_0_domain_card_book_of_ava"],
  creationDomainCardIds: ["srd_2_0_domain_card_deft_deceiver", "srd_2_0_domain_card_book_of_ava"],
  effectChoices: { "srd_2_0_ancestry_clank:Purposeful Design": { optionId: null, optionIds: [], experienceIds: ["exp_start1"] } },
  updatedAt: "2026-09-05T20:11:32.000Z",
  // A 48px placeholder portrait so the upload path is exercised.
  portrait: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAoklEQVR42u3YWwqAMAxE0VlJv7sI94/LUhD81L4SrjKQBRxKm2aiUiqqZJBBBhn0F9BeNxDo1FyFAN2aJSat1cybtFwzaVKEZsakIM2wSXGaMZNCNQMmRWt6TUrQdJmUo2k3KU3TaFKmpsWkZM2rSfmaZ9OnToh4h4ivjNiHiJ2a+JcRf3viPEScGIkzNTF1EHMZMbkSsz1x++GFlUEGGTReB9QA/AUhjhIZAAAAAElFTkSuQmCC",
});
bard.experiences[0].name = "Silver Tongue";
bard.experiences[1].name = "Court Etiquette";
bard.baseline = undefined; bard.baselineLevel = undefined; ensureLevelFields(bard);
bard.state = { hp: 0, stress: 0, hope: 2, armor: 0, scars: 0, conditions: [], notes: "" };

// ---- 2. Level 5 Ranger, mixed ancestry, multiclassed, vaulted card, table state ----
const ranger = blank("char_lvl5ranger");
Object.assign(ranger, {
  name: "Thessaly Vane", pronouns: "they/them",
  classId: "srd_2_0_class_ranger", subclassId: "srd_2_0_subclass_beastbound",
  heritage: { ancestryMode: "mixed", ancestryIds: ["srd_2_0_ancestry_drakona", "srd_2_0_ancestry_elf"],
    chosenFeatures: [
      { ancestryId: "srd_2_0_ancestry_drakona", featureName: "Scales" },
      { ancestryId: "srd_2_0_ancestry_elf", featureName: "Celestial Trance" },
    ], communityId: "srd_2_0_community_wanderborne" },
  traits: { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: -1, knowledge: 0 },
  equipment: { primaryWeaponId: "srd_2_0_weapon_longsword", secondaryWeaponId: null,
    armorId: "srd_2_0_armor_leather_armor", potionChoice: "srd_2_0_consumable_minor_stamina_potion" },
  background: { description: "Caravan scout with a wolf named Ashe.", answers: "" },
  domainCardIds: ["srd_2_0_domain_card_gifted_tracker", "srd_2_0_domain_card_deft_maneuvers"],
  creationDomainCardIds: ["srd_2_0_domain_card_gifted_tracker", "srd_2_0_domain_card_deft_maneuvers"],
  updatedAt: "2026-09-05T21:40:05.000Z",
});
ranger.experiences[0].name = "Caravan Scout";
ranger.experiences[1].name = "Wolf Whisperer";
ranger.baseline = undefined; ranger.baselineLevel = undefined; ensureLevelFields(ranger);
const lv = (level, picks, card, extra = {}) => ({ level, picks, mandatoryCardId: card, grantedCardIds: [], exchange: null, ...extra });
// Level 2: +traits, +experience achievement at 2 (new experience appended by the app first)
ranger.experiences.push({ id: "exp_lv2", name: "Seen It Before", modifier: 2, baseModifier: 2, sinceLevel: 2 });
ranger.level = 2; writeLevelEntry(ranger, lv(2, [{ key: "traits", slotTier: 2, traits: ["agility", "instinct"] }, { key: "hitPoint", slotTier: 2 }], "srd_2_0_domain_card_natures_tongue"));
ranger.level = 3; writeLevelEntry(ranger, lv(3, [{ key: "stress", slotTier: 2 }, { key: "evasion", slotTier: 2 }], "srd_2_0_domain_card_brace"));
ranger.level = 4; writeLevelEntry(ranger, lv(4, [{ key: "experience", slotTier: 2, experienceIds: ["exp_start1", "exp_lv2"] }, { key: "domainCard", slotTier: 2, cardId: "srd_2_0_domain_card_ferocity" }], "srd_2_0_domain_card_conjure_swarm"));
ranger.experiences.push({ id: "exp_lv5", name: "Old Roads", modifier: 2, baseModifier: 2, sinceLevel: 5 });
ranger.level = 5; writeLevelEntry(ranger, lv(5, [{ key: "multiclass", slotTier: 3, classId: "srd_2_0_class_druid", domain: "ARCANA", subclassId: "srd_2_0_subclass_warden_of_the_elements" }], "srd_2_0_domain_card_know_thy_enemy"));
recomputeCharacter(ranger);
ranger.domainVaultIds.push("srd_2_0_domain_card_natures_tongue");
recomputeCharacter(ranger);
ranger.state = { hp: 3, stress: 2, hope: 4, armor: 1, scars: 1, conditions: ["vulnerable"], notes: "Ashe is wounded; owes the innkeeper 3 handfuls." };

// ---- 3. Legacy pre-levels save, raw (NOT normalized): flat slots, weaponMode, no state/levelUps ----
const legacy = {
  id: "char_legacy3", name: "Old Save Orrin", pronouns: "he/him",
  classId: "srd_1_0_class_guardian", subclassId: "srd_1_0_subclass_stalwart",
  heritage: { ancestryMode: "pure", ancestryIds: ["srd_1_0_ancestry_dwarf"],
    chosenFeatures: [{ ancestryId: "srd_1_0_ancestry_dwarf", featureName: "Thick Skin" }, { ancestryId: "srd_1_0_ancestry_dwarf", featureName: "Increased Fortitude" }],
    communityId: "srd_1_0_community_ridgeborne" },
  traits: { agility: 0, strength: 3, finesse: 0, instinct: 1, presence: 1, knowledge: -1 },
  equipment: { primaryWeaponId: "srd_1_0_weapon_warhammer", secondaryWeaponId: "srd_1_0_weapon_round_shield", armorId: "srd_1_0_armor_chainmail_armor", potionChoice: "srd_1_0_consumable_minor_health_potion" },
  weaponMode: "primary-secondary",
  background: { description: "", answers: "" },
  experiences: [{ name: "Shield Wall", modifier: 3 }, { name: "Mountain Born", modifier: 2 }, { name: "Stubborn", modifier: 2 }],
  domainCardIds: ["srd_1_0_domain_card_get_back_up", "srd_1_0_domain_card_bare_bones", "srd_1_0_domain_card_whirlwind", "srd_1_0_domain_card_forceful_push"],
  connectionsNotes: "", level: 3, proficiency: 1,
  traitMarks: { agility: false, strength: true, finesse: false, instinct: true, presence: false, knowledge: false },
  hitPointSlotsBonus: 1, stressSlotsBonus: 0, evasionBonus: 0, subclassTier: "foundation",
  advancementSlotsUsed: { traits: 1, hitPoint: 1, stress: 0, evasion: 0, experience: 1, domainCard: 0, subclass: 0, proficiency: 0, multiclass: 0 },
  updatedAt: "2026-06-02T14:03:11.000Z",
};

const out = process.argv[2];
writeFileSync(`${out}/level1-bard.json`, serializeTransferFile([bard], new Date("2026-09-05T22:00:00Z")));
writeFileSync(`${out}/level5-ranger-multiclass.json`, serializeTransferFile([ranger], new Date("2026-09-05T22:00:00Z")));
writeFileSync(`${out}/legacy-pre-levels.json`, JSON.stringify({ format: "daggerheart-character-builder", version: 1, exportedAt: "2026-06-02T14:05:00.000Z", characters: [legacy] }, null, 2) + "\n");
writeFileSync(`${out}/roster.json`, serializeTransferFile([bard, ranger], new Date("2026-09-05T22:00:00Z")));

// Expected derived values, for the mapping doc and future tests.
const expected = {};
for (const ch of [bard, ranger]) {
  const sheet = deriveSheet(ch, db);
  const stats = derivedStats(ch, db);
  expected[ch.id] = { sheet, statsSummary: { hitPoints: stats.hitPoints?.total, stress: stats.stress?.total, evasion: stats.evasion?.total, armorScore: stats.armorScore?.total, thresholds: sheet.thresholds, proficiency: stats.proficiency?.total, traits: Object.fromEntries(Object.entries(stats.traits).map(([k, v]) => [k, v.total])) } };
}
writeFileSync(`${out}/expected-derived.json`, JSON.stringify(expected, null, 2) + "\n");
console.log("ok");
