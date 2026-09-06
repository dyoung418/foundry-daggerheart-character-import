# Mapping: builder export → Daggerheart actor

Field-by-field translation. Left side is the builder character object
(`docs/builder-export-format.md`); right side is the system actor/items
(`docs/daggerheart-system-model.md`). "Auto" refers to the world setting
`game.settings.get('daggerheart','Automation').levelupAuto` (default **true**,
`module/data/settings/Automation.mjs:30-34`).

## Order of operations (one character)

1. **Normalise** the builder character (`normalizeImported` + `ensureLevelFields` equivalents), and
   resolve every id to a compendium document via the matcher. Collect misses; stop before writing
   anything if the class, subclass, or any ancestry/community is missing (everything else can be
   skipped with a warning).
2. **Create the actor** with name, img (see Portrait), `system.biography.characteristics.pronouns`,
   `system.levelData.level = { current: level, changed: level }`, `system.experiences` (minted ids),
   `system.traits` (base values, see Traits), `system.scars`, `system.gold` default, and the module
   flag `flags.<module-id>.builder = { id, exportedAt, version, updatedAt }` for re-import.
   Do **not** write biography text yet (step 3 appends to it).
3. **Class first, alone**: `createEmbeddedDocuments('Item', [classData])`. Its `_preCreate`
   (`class.mjs:99-142`) appends the class's background questions to `system.biography` and grants
   the hope + class features. Now write `system.biography.background/connections` with the
   builder's text (overwriting the questions, or appending under them — Danny's call; default:
   questions kept, builder text appended).
4. **Subclass** (`featureState` from `subclassTier`), **ancestry** (one item; mixed → composed name
   and features, see Heritage), **community**, **transformation**: one `createEmbeddedDocuments`
   call. Features are granted automatically.
5. **Multiclass** (level ≥ 5 only): class item with `system.isMulticlass: true`,
   `system.domains: [domain]`, `features` minus the `hope` entry (mirrors `actor.mjs:583-595`); then
   its subclass with `isMulticlass: true`. With Auto **off**, `class.mjs:_preCreate` opens a
   `MulticlassChoiceDialog` for any second class — unavoidable from outside; document it, or import
   multiclass only when Auto is on (MVP choice).
6. **Domain cards**: loadout cards first (`inVault: false`), then vault cards (`inVault: true`).
   Each card's `_preCreate` (`domainCard.mjs:78-104`) checks the domain is granted by a class item,
   rejects duplicates, and auto-vaults past the loadout limit.
7. **Equipment**: armor (`equipped: true`, `armor.current` = `state.armor`), primary weapon
   (`equipped: true, secondary: false`), secondary weapon (`equipped: true, secondary: true`),
   potion consumable. Optionally the class `inventory.take` loot (torch, rope, supplies).
8. **Level-ups**: update `system.levelData.levelups` (see Level history). With Auto **on** that is
   all; the sheet derives traits/HP/stress/evasion/proficiency from it. With Auto **off**, also
   write the *totals* into `system.traits.*.value`, `system.resources.hitPoints.max`,
   `system.resources.stress.max`, `system.evasion`, `system.proficiency`, and the raised experience
   values.
9. **Table state**: `resources.hitPoints.value = state.hp`, `resources.stress.value = state.stress`,
   `resources.hope.value = state.hope`, conditions via `toggleStatusEffect`.
10. **Report** what was skipped or unmatched.

## Identity

| builder | system | notes |
|---|---|---|
| `name` | `name` | empty → "Unnamed (imported)" |
| `pronouns` | `system.biography.characteristics.pronouns` | |
| `background.description` + `background.answers` | `system.biography.background` (HTML) | paragraphs → `<p>`; escape HTML |
| `connectionsNotes` | `system.biography.connections` (HTML) | |
| `state.notes` | append to `system.biography.connections` under a "Session notes" heading, or a journal | no dedicated field |
| `portrait` (data URL) | `img` | Foundry's `FilePathField` does not accept base64 for actors (`common/data/fields.mjs:3630`). Decode and upload with `foundry.applications.apps.FilePicker.implementation.upload('data', 'daggerheart-character-import/portraits', file)` (needs `FILES_UPLOAD`), then set `img` to the returned path. Else keep the system default icon. |
| `id`, `updatedAt` | `flags.<module>.builder.{id,updatedAt}` | re-import key |

## Class, subclass, heritage

| builder | system | notes |
|---|---|---|
| `classId` | embedded `class` item from `daggerheart.classes` by name | name from builder data (`"BARD"` → `Bard`) |
| `subclassId`, `subclassTier` | embedded `subclass` item; `system.featureState` = 1/2/3 for foundation/specialization/mastery | subclass `linkedClass` must equal the class item's `sourceUuid`, so both must come from the same compendium |
| `multiclass.{classId,subclassId,domain,tier}` | second `class` (`isMulticlass`, `domains:[domain]`) + second `subclass` (`isMulticlass`, `featureState` from `tier`) | domain lowercased (`"ARCANA"` → `arcana`) |
| `heritage.ancestryIds[0]` (pure) | `ancestry` item as-is | |
| `heritage.ancestryIds[0..1]` (mixed) + `chosenFeatures` | one `ancestry` item named `"A/B"`, `system.features = [{type:'primary', item: <A or B feature uuid>}, {type:'secondary', item: <the other>}]` | The system's own creator takes A's primary and B's secondary (`characterCreation.mjs:507-523`). Builder feature order equals the system's (primary, secondary) for all 24 SRD ancestries (checked 2026-09-05, one spelling drift: Firbolg "Unshakeable"/"Unshakable"), so map `chosenFeatures` by **position** in each ancestry's feature list, not by name. If the builder chose two primaries or two secondaries, still emit one of each `type` so the sheet renders; note it in the report. |
| `heritage.communityId` | `community` item | |
| `transformationId` | `transformation` item | 2.8+ only |

## Traits, level, numbers

| builder | system (Auto on) | system (Auto off) |
|---|---|---|
| `traits.*` (final) | `system.traits.*.value` = final − (number of level-up `traits` picks naming that trait) — i.e. the **creation** value; replay from `baseline.traits` if present, else subtract | final value |
| `traitMarks.*` | ignore; derived from `levelups` (`character.mjs:648`) | `system.traits.*.tierMarked` |
| `level` | `system.levelData.level.{current,changed}` | same |
| `proficiency` (final) | leave at 1; achievements add +1 at 2/5/8 | final |
| `hitPointSlotsBonus` | leave `resources.hitPoints.max = null`; picks add | `resources.hitPoints.max` = class HP + bonus (+ effect bonus the system already applies from features: check double-count) |
| `stressSlotsBonus` | leave null | `resources.stress.max` = 6 + bonus |
| `evasionBonus` | leave 0 | `system.evasion` = bonus (class evasion and armor effects are added by the system) |
| `experiences[].modifier` (final) | `system.experiences[id].value` = `baseModifier`; level-up `experience` picks add | final |
| `state.scars` | `system.scars` | same |

Assertion for tests: after import with Auto on, the sheet's derived HP/Stress/Evasion/thresholds
must equal `samples/expected-derived.json` for the sample characters (armor features included).

## Experiences

Builder `experiences[{id,name,baseModifier,sinceLevel}]` → `system.experiences` keyed by
`foundry.utils.randomID()`; keep a map builderId → foundryId for the level-up translation.
`core: true` on the first two (the system does that itself on first update). Experiences with
`sinceLevel > 1` are *also* listed in `levelups[sinceLevel].achievements.experiences[foundryId]
= { name, modifier: 2 }`; the system's `levelUp` writes those to `system.experiences` too, so we
write them in both places up front.

## Domain cards

| builder | system |
|---|---|
| `domainCardIds − domainVaultIds` (≤5) | `domainCard` items, `inVault: false` |
| `domainVaultIds` | `domainCard` items, `inVault: true` |
| `creationDomainCardIds` | nothing on the item; recorded via `levelups` absence (creation cards are the ones not referenced by any level entry) |
| card at `levelUps[n].mandatoryCardId` | `levelups[n].achievements.domainCards = [{ uuid: <compendium uuid>, itemUuid: <embedded uuid> }]` |
| card in `levelUps[n].picks[key=domainCard].cardId` | `levelups[n].selections[]` of `type: 'domainCard'`, `data: [<compendium uuid>]`, `itemUuid` |
| `grantedCardIds`, `exchange` | create the resulting cards; an exchanged-out card is simply not created. Note in report. |

`itemUuid` values require the embedded items to exist first, so create cards (step 6) before
writing `levelups` (step 8), then fill the uuids in.

## Level history → `system.levelData.levelups`

For each builder `levelUps[]` entry (level L, tier T = 2 for 2-4, 3 for 5-7, 4 for 8-10):

```
achievements: {
  experiences: L ∈ {2,5,8} ? { [newExpFoundryId]: { name, modifier: 2 } } : {},
  domainCards:  mandatoryCardId ? [{ uuid, itemUuid }] : [],
  proficiency:  L ∈ {2,5,8} ? 1 : 0
}
selections: picks.map(pick → {
  tier: T, level: L, optionKey: <system option key>, type: <system type>, subType: null,
  checkboxNr: <running count of boxes used in that option row within tier T, starting at 1>,
  value, minCost, amount: <from LevelTiers option defaults>, data, secondaryData, itemUuid: null, features: []
})
```

| builder pick | system `type` / `optionKey` | `data` / `secondaryData` / `value` |
|---|---|---|
| `traits: [a,b]` | `trait` | `data: [a,b]`, `amount: 2`, `value: null` |
| `hitPoint` | `hitPoint` | `value: 1` |
| `stress` | `stress` | `value: 1` |
| `evasion` | `evasion` | `value: 1` |
| `experience: experienceIds` | `experience` | `data: [foundryId1, foundryId2]`, `value: 1`, `amount: 2` |
| `proficiency` | `proficiency` | `value: 1`, `minCost: 2` (2 boxes) |
| `domainCard: cardId` | `domainCard` | `data: [compendium uuid]`, `secondaryData: { limit: String(cap) }`, `itemUuid` |
| `subclass` (own) | `subclass` | `secondaryData: { isMulticlass: 'false', featureState: '2' or '3' }` |
| `subclass`, `target: multiclass` | `subclass` | `secondaryData: { isMulticlass: 'true', featureState }` |
| `multiclass: {classId, domain, subclassId}` | `multiclass` | `data: [class compendium uuid]`, `secondaryData: { subclass: <subclass compendium uuid>, domain }`, `itemUuid: <embedded multiclass class item uuid>`, `minCost: 2` |
| `optionLabel` (source-declared row) | not representable | report and drop |

`slotTier` in the builder can differ from the level's own tier (a tier-2 slot spent at level 6);
the system's `tier` field is the level's tier, and the `checkboxNr` bookkeeping is what enforces
the cross-outs, so use the level's tier and count boxes per (tier, optionKey).

Keep the raw builder `levelUps`, `baseline`, `advancementSlotsUsed`, `effectChoices` and
`creationDomainCardIds` verbatim under `flags.<module>.builder.raw` — cheap, and makes a future
"export back to the builder" possible.

## Equipment

| builder | system |
|---|---|
| `equipment.primaryWeaponId` | `weapon` item, `equipped: true, secondary: false`; `"unarmed"`/null → nothing (the actor has a built-in unarmed attack) |
| `equipment.secondaryWeaponId` | `weapon` item, `equipped: true, secondary: true` (compendium secondaries already carry `secondary: true`) |
| `equipment.armorId` | `armor` item, `equipped: true`, `armor.current = state.armor`; `"unarmored"`/null → nothing |
| `equipment.potionChoice` | `consumable` item, `quantity: 1` |
| class `inventory.take` (Torch, 50ft of Rope, Basic Supplies) | optional `loot` items; the builder treats them as prose. Default: add at level 1, skip otherwise? Simpler: always add, behind an option. |
| gold | builder has none; leave the system default (`Homebrew.currency` initial amounts) |

## Table state

| builder `state` | system |
|---|---|
| `hp` (marked) | `system.resources.hitPoints.value` |
| `stress` (marked) | `system.resources.stress.value` (if ≥ max, the system auto-applies Vulnerable) |
| `hope` (filled) | `system.resources.hope.value` |
| `armor` (marked) | equipped armor item `system.armor.current` |
| `scars` | `system.scars` |
| `conditions[]` | `actor.toggleStatusEffect(id, { active: true })` for each |
| `notes` | biography (see Identity) |

## Feature choices (`effectChoices`)

Only a few SRD features ask a question. Clank's *Purposeful Design* (+1 to a chosen Experience)
has no data representation in the system beyond the feature text; apply it as `+1` to that
experience's `value` and mention it in the report. Others (Vitality, Master of the Craft):
document as "not automated" for MVP.

## Matching strategy

1. Build an index per system type once per import: `pack.getIndex({ fields: ['type', 'system.tier'] })`
   for the packs listed in a module setting (default: the nine `daggerheart.*` item packs; users can
   add homebrew packs). Key = `type + '|' + normalise(name)`.
2. For each builder id: derive the type from the id's kind segment (`class`, `subclass`,
   `ancestry`, `community`, `domain_card`, `weapon`, `armor`, `consumable`, `transformation`);
   get the display name from the builder's data if the module ships a copy, else from the id tail
   (`snake_case` → Title Case, apostrophes lost: "A Soldiers Bond" ≠ "A Soldier's Bond", so
   normalise both sides by stripping non-alphanumerics).
3. Look up `type|name`; on a miss, try the override table (`data/renames.json`, initially empty);
   on a miss, fuzzy (Levenshtein ≤ 2) with a warning; else record in the report.
4. Prefer world items over compendium items when both match? No — compendium only, unless a setting
   says otherwise (world copies drift).

**Do we ship the builder's SRD data?** Shipping `data/srd_2_0/*.json` (≈550 KB) gives exact
display names and lets the importer show a preview (class, cards, weapons) *before* touching
Foundry, and lets it fill `secondaryData.limit` and validate levels. It is SRD content under the
DPCGL like the builder's own copy. Recommendation: ship a **name-only index** generated from the
builder's data (`tools/build-name-index.mjs` → `data/names.json`, id → display name, ~40 KB),
not the full records. Open question for Danny (in TODO).

## Hard problems, ranked

1. **Auto on vs off** doubles the write paths. MVP: support Auto on fully; with Auto off, write
   totals and skip `levelups` translation (state the limitation in the report).
2. **Multiclass with Auto off** opens a system dialog mid-import. MVP: require Auto on for
   multiclass characters.
3. **Homebrew content** (`void_` ids, `sources.local.json`): no compendium match. MVP: report and
   skip; later: create stub items (feature/loot with description text) if the module ships the
   builder's records for that source, or let the user pick from a compendium browser.
4. **Beastbound companion**: separate `companion` actor linked via `system.companion`. Out of scope
   for MVP; report.
5. **Re-import / update**: match by `flags.<module>.builder.id`; delete previously imported items
   (those with `flags.<module>.imported: true`) and recreate; keep Foundry-side changes to
   biography and gold. Pathmuncher's `#removeDocumentsToBeUpdated` pattern.
6. **Legacy builder files** (`srd_1_0_` ids, flat slots, no `levelUps`): names still match; without
   `levelUps` we cannot build `levelups`, so fall back to writing totals as if Auto were off, and
   set `levelData.levelups = {}`. Report it.
7. **`secondaryData.limit`** for domain-card picks: the system fills it from the tier cap
   (`characterLevelup.mjs:103-115`); compute as `min(halfLevelCap, tierCap)` per the builder's
   `extraCardLevelCap` (`advancement.js:97`).
