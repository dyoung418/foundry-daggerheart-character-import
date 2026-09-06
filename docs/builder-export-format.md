# Builder export format (what the importer reads)

Source of truth: `~/daggerheart-character-builder/shared/transfer.js`. Verified against the working
tree on 2026-09-05. Line numbers are from that checkout; re-check before trusting them.

## Envelope

`buildTransferFile()` at `shared/transfer.js:53-60`:

```json
{
  "format": "daggerheart-character-builder",
  "version": 1,
  "exportedAt": "2026-09-05T22:00:00.000Z",
  "characters": [ { ...character }, ... ]
}
```

- `format` is a constant (`TRANSFER_FORMAT`, `transfer.js:37`). The builder's own importer rejects
  anything else; ours should too.
- `version` is the schema version (`TRANSFER_VERSION = 1`, `transfer.js:38`). The builder refuses
  only a *higher* number and reads a missing one as 1 (`transfer.js:113-117`). Mirror that.
- `characters` is always a list, even for the per-character **Export** button
  (`characters.js:217` and the transfer modal's **Save to file** at `characters.js:1512` both call
  `downloadTransferFile`, `characters.js:1534-1536`).
- Filename: `daggerheart-characters-YYYY-MM-DD.json` (`transfer.js:67-69`). Two-space indent,
  trailing newline.

**Characters go in verbatim.** There is no allowlist and no id resolution (`transfer.js:16-24`):
the character object is exactly what the builder stores in `localStorage["dh-characters-v1"]`.
The file deliberately contains **no game data** — only ids into the builder's `data/` folders
(`transfer.js:8-14`). Everything an importer needs to *name* a thing must come from the Foundry
side (compendia) or from a copy of the builder's data.

## Character object

Constructor: `blankCharacter()` at `create.js:108-142`. Fields added on load by
`ensureLevelFields()` at `shared/advancement.js:442-497`. The importer's normalizer should mirror
`normalizeImported()` (`transfer.js:149-189`) followed by `ensureLevelFields()`.

### Identity and prose

| field | type | notes |
|---|---|---|
| `id` | string | `"char_" + 8 base36 chars` (`create.js:184`). Stable across exports; the natural key for "update existing actor" (store it in an actor flag). |
| `name`, `pronouns` | string | |
| `background` | `{ description, answers }` | free text |
| `connectionsNotes` | string | free text |
| `updatedAt` | ISO string or `null` | |
| `portrait` | optional data URL | `data:image/(webp|jpeg|png);base64,…`, ≤512px, ≤120 000 chars (`shared/portrait.js:8-26`). Deleted when absent. Foundry can store it as an uploaded file or leave it as a data URL in `img`. |

### Class and heritage (all ids)

| field | type | notes |
|---|---|---|
| `classId` | id or null | e.g. `srd_2_0_class_bard` |
| `subclassId` | id or null | e.g. `srd_2_0_subclass_troubadour` |
| `subclassTier` | `"foundation" \| "specialization" \| "mastery"` | **A tier implies the tiers below it** (`advancement.js:521-524`): a mastery character has all three subclass feature sets. |
| `multiclass` | null or `{ classId, subclassId, domain, level, tier }` | Derived by the level replay from the level that took it (`history.js:126-133`). `domain` is the uppercase enum name (`"ARCANA"`). `tier` is that subclass's own ladder. |
| `heritage.ancestryMode` | `"pure" \| "mixed"` | |
| `heritage.ancestryIds` | id[] | 1 for pure, 2 for mixed |
| `heritage.chosenFeatures` | `{ ancestryId, featureName }[]` | `featureName` is the English feature name. Pure: all of the ancestry's features (`create.js:540`). Mixed: one from each ancestry (`create.js:579`). |
| `heritage.communityId` | id or null | |
| `transformationId` | id or null | Optional; SRD has none of these (they're in the 2.0 data as `transformations.json`). Doesn't count against the loadout. |

### Traits and numbers

| field | type | notes |
|---|---|---|
| `traits` | `{ agility, strength, finesse, instinct, presence, knowledge }` | integers, **final values after level-up replay** (`history.js:177-201`); `null` on an unfinished draft |
| `traitMarks` | same keys, booleans | the "marked" tick that stops a trait being raised twice in a tier; cleared at levels 5 and 8 |
| `level` | 1..10 | clamped on import (`transfer.js:185-186`) |
| `proficiency` | integer | final value |
| `hitPointSlotsBonus`, `stressSlotsBonus`, `evasionBonus` | integer | **deltas over the class base**, not totals |

**Not stored:** HP max, Stress max, Evasion, Armor Score, damage thresholds, Spellcast trait,
attack modifiers. The builder recomputes them from class + armor + effects in
`derivedStats()` (`shared/derived-stats.js:436`) and flattens them for the sheet in
`deriveSheet()` (`shared/sheet-data.js:141`). Formulas:

- HP slots = `class.startingHitPoints + hitPointSlotsBonus + effectBonus` (`derived-stats.js:53`)
- Stress slots = `6 + stressSlotsBonus + effectBonus` (`derived-stats.js:57`, `BASE_STRESS_SLOTS` at `advancement.js:143`)
- Evasion = `class.startingEvasion + evasionBonus + effectBonus` (`derived-stats.js:61`) — note armor features (Gambeson +1, Chainmail -1) are effects, so the builder's Evasion already includes armor
- Thresholds = armor base thresholds + level (`damageThresholds`, `advancement.js:314`)
- Caps: HP 12, Stress 12, Armor Score 12 (`advancement.js:138-152`); Hope always 6 slots, starts at 2

`samples/expected-derived.json` holds the builder's computed values for the two sample characters.
**Decision for the importer:** rather than re-implement the builder's effect engine, let Foundry's
system derive HP/Stress/Evasion from the class/subclass/armor items it embeds, and write only the
stored *bonuses* (level-up advancements) into whatever the system uses for advancement tracking.
See `docs/mapping.md` once R2 has established what the system computes itself.

### Equipment

| field | notes |
|---|---|
| `equipment.primaryWeaponId` | weapon id, `null`, or the sentinel `"unarmed"` (`shared/gear.js:29`) |
| `equipment.secondaryWeaponId` | weapon id or `null` |
| `equipment.armorId` | armor id, `null`, or the sentinel `"unarmored"` (`shared/gear.js:23`) |
| `equipment.potionChoice` | consumable id (Minor Health / Minor Stamina Potion, `create.js:902-903`) |

There is **no gold and no inventory** beyond the potion. The class's `classItems` and the fixed
starting kit are prose only (`create.js:912`); the CSV export hard-codes `handfuls: 0`
(`shared/csv-export.js:450-472`). Old saves may carry a dead `weaponMode` string; ignore it.

### Domain cards

| field | notes |
|---|---|
| `domainCardIds` | every card owned, in acquisition order (including vaulted) |
| `domainVaultIds` | subset of the above that is in the vault. **Loadout = `domainCardIds` − `domainVaultIds`, max 5** (`activeDomainCardIds`, `advancement.js:501`; spill at `history.js:206-209`) |
| `creationDomainCardIds` | the cards chosen at creation; backfilled as the first two for old saves (`advancement.js:483`) |
| `creationCardsUnbaked` | sticky repair flag, internal to the builder; ignore |

### Experiences

`experiences: [{ id, name, modifier, baseModifier, sinceLevel }]`. `modifier` is final
(`baseModifier` + level-up bumps, `history.js:168-175`). Ids `exp_start1`/`exp_start2` are the
creation pair; `exp_lv2`/`exp_lv5`/`exp_lv8` style ids appear at the achievement levels. Names may
be empty strings on unfinished characters.

### Level history

The reason the file exists: the builder replays `baseline` + `levelUps` to derive the numbers.

- `baselineLevel` — where the recorded history starts (usually 1)
- `baseline` — snapshot at that level: `{ traits, traitMarks, proficiency, hitPointSlotsBonus, stressSlotsBonus, evasionBonus, subclassTier, multiclass, slotsUsed, domainCardIds }` (`captureBaseline`, `advancement.js:355-371`)
- `advancementSlotsUsed` — per option, per tier: `{ traits: {2,3,4}, hitPoint, stress, evasion, experience, domainCard, subclass, proficiency, multiclass }` (`blankSlotsUsed`, `advancement.js:171`). Legacy flat totals (`{ traits: 1 }`) are split by `splitFlatSlotTotals` on load.
- `levelUps[]` — one entry per level, shape from `currentEntry()` at `level-up.js:936-962`:

```json
{
  "level": 4,
  "picks": [
    { "key": "experience", "slotTier": 2, "experienceIds": ["exp_start1", "exp_lv2"] },
    { "key": "domainCard", "slotTier": 2, "cardId": "srd_2_0_domain_card_ferocity" }
  ],
  "mandatoryCardId": "srd_2_0_domain_card_conjure_swarm",
  "grantedCardIds": [],
  "exchange": null
}
```

Pick keys: `traits` (+`traits: [k1,k2]`), `hitPoint`, `stress`, `evasion`, `experience`
(+`experienceIds`), `proficiency`, `domainCard` (+`cardId`), `subclass` (+`target: "multiclass"`
when upgrading the second subclass), `multiclass` (+`classId`, `domain`, `subclassId`). Replay
semantics are `applyEntry` in `history.js:95-155`. `exchange: { outCardId, inCardId }` is the
once-per-level card swap; `grantedCardIds` are cards handed over by a feature (School of Knowledge).

The importer does **not** need to replay this to get the numbers — they are already on the
character. It matters for (a) the Foundry system's own level-up record if it keeps one, and
(b) round-tripping. Treat as read-mostly; keep a copy in an actor flag.

### Feature choices

`effectChoices: { [effectKey]: { optionId, optionIds: [], experienceIds: [] } }`
(`blankAnswer`, `shared/effects.js:821`). Keys look like `srd_2_0_ancestry_clank:Purposeful Design`
or `<cardId>` or `<subclassId>:foundation`. Only a handful of SRD features ask a question
(Clank's Purposeful Design → which Experience gets +1; Vitality; Master of the Craft).

### Table state (the play page)

`state`, default from `shared/table-state.js:25-27`:

```json
{ "hp": 3, "stress": 2, "hope": 4, "armor": 1, "scars": 1, "conditions": ["vulnerable"], "notes": "…" }
```

- `hp`, `stress`, `armor` count **marked** boxes (damage taken / stress taken / armor slots spent),
  not remaining. `hope` counts **filled** Hope (starts at 2, max 6).
- `scars` = Hope slots permanently crossed out (Avoid Death); they reduce the Hope maximum.
- `conditions` ⊆ `["vulnerable","hidden","restrained"]` (`table-state.js:169-173`).
- `notes` is free session text.

## Ids and how to match them

Every id is `<source>_<kind>_<snake_case_name>`: `srd_2_0_class_bard`,
`srd_2_0_domain_card_a_soldiers_bond`, `srd_2_0_weapon_broadsword`,
`srd_1_0_armor_chainmail_armor`. There are no slugs; the id suffix is the slug.

- The same content exists under both `srd_1_0_` and `srd_2_0_` prefixes, and homebrew sources use
  their own prefix. `shared/content-ids.js` strips the prefix: `bareId()` (line 37) gives
  `weapon_broadsword`; `bareForms()` (line 52) also peels renamed-folder prefixes.
  **Match on the bare form**, and fall back to a name match derived from the snake_case tail.
- Display names in the builder's data are `{ "en-US": "Broadsword" }`, except `classes.json`
  where `name` is a bare uppercase string (`"BARD"`, `content-sources.js:118-129`).
- Cross-references inside data use uppercase enum names (`class: "RANGER"`, `domains: ["BONE","SAGE"]`,
  `trait: "AGILITY"`, `range: "MELEE"`, `burden: "ONE_HANDED"`, `damage: {dice:"D8", type:"PHYSICAL"}`).
- Sentinels that resolve to no item: `"unarmed"`, `"unarmored"`.

Data files per source (`data/srd_2_0/`): `classes.json` (13), `subclasses.json` (26),
`ancestries.json` (24), `communities.json` (15), `transformations.json` (6),
`domain-cards.json` (210), `weapons.json` (315), `armors.json` (69), `consumables.json` (120).
`items.json` exists but the builder never loads it (`content-sources.js:31-41`).

## Legacy shapes the importer must tolerate

Anything `normalizeImported` + `ensureLevelFields` repairs, we must repair too:

- flat `advancementSlotsUsed` (`{ traits: 1 }`) instead of per-tier
- missing `creationDomainCardIds`, `levelUps`, `baseline`, `state`, `effectChoices`, `multiclass`
- `experiences[]` without `id`, `baseModifier` or `sinceLevel`
- `weaponMode` string present
- `srd_1_0_` ids throughout
- `heritage`, `traits`, `equipment` missing or non-objects (repaired to blanks)

`samples/legacy-pre-levels.json` is a hand-written example of this shape.

## Samples

Generated by `tools/make-samples.mjs`, which drives the builder's own modules (`ensureLevelFields`,
`writeLevelEntry`, `recomputeCharacter`, `serializeTransferFile`) so the bytes match what a player
uploads. Re-run with `node tools/make-samples.mjs samples` from this repo (it imports the builder by
absolute path).

| file | what it exercises |
|---|---|
| `samples/level1-bard.json` | fresh level 1: Bard/Troubadour, pure Clank, Highborne, two creation cards, an `effectChoices` answer, portrait absent |
| `samples/level5-ranger-multiclass.json` | level 5 with four `levelUps`, mixed ancestry, multiclass into Druid, 7 cards with 3 vaulted (two by loadout spill), experiences raised, table state with damage, scar and a condition |
| `samples/legacy-pre-levels.json` | old shape: flat slots, `weaponMode`, no `levelUps`/`state`, `srd_1_0_` ids, experiences without ids |
| `samples/roster.json` | the two current characters in one file (multi-character import) |
| `samples/expected-derived.json` | what the builder computes for the two current characters (HP, Stress, Evasion, Armor, thresholds, per-trait totals, weapons, features); the importer's tests can assert against these |
