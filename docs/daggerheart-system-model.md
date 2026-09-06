# Daggerheart system data model (what the importer writes)

Source: Foundryborne/daggerheart, branch `v14`, commit `cf0da27` (2026-09-03), version 2.9.2.
Cloned into scratch; not vendored. Paths below are relative to that checkout. Verified 2026-09-05.

**Version gap to note.** The local install at `~/foundrydata/Data/systems/daggerheart/` is 2.7.4
(world `daggerheart-test` was last opened with 2.7.3). Releases 2.8.0 (2026-08-27) and 2.9.x
(2026-09-01..03) added Transformations as an item type, the Hope & Fear content, feature-granted
custom resources (Favor, Focus), and a "refresh from compendium" action. The module should target
**2.9+** and the test world should be upgraded before any manual test.

## Documents the importer creates

One `Actor` of type `character`, plus embedded `Item`s of these types (`system.json` `documentTypes`):
`class`, `subclass`, `ancestry`, `community`, `domainCard`, `weapon`, `armor`, `consumable`,
`loot`, `feature`, `transformation`. `beastform` is out of scope.

### Actor `character` (`module/data/actor/character.mjs`)

| path | type | notes |
|---|---|---|
| `name`, `img` | | |
| `system.traits.{agility,strength,finesse,instinct,presence,knowledge}` | `{ value, tierMarked }` (`attributeField`, `module/data/fields/actorField.mjs`) | **base assigned value only**. If the world's `levelupAuto` automation setting is on, level-up trait picks are added on top in `prepareBaseData` (lines 640-660), so write creation traits here and put advancements in `levelData`. |
| `system.proficiency` | int, initial 1 | base; `+achievements.proficiency` per level-up when auto |
| `system.evasion` | int, initial 0 | **bonus only**; class evasion is added in `prepareBaseData` (line 631) and level-up evasion picks when auto |
| `system.resources.hitPoints` | `{ value, max }` | `value` = marked HP. `max` is a *bonus*: class `hitPoints` is added at line 699, level-up picks when auto. `null` max means default. |
| `system.resources.stress` | `{ value, max }` | base 6 (`module/config/resourceConfig.mjs:19-26`); `value` = marked stress |
| `system.resources.hope` | `{ value, max }` | value = current Hope; max comes from the Homebrew setting `maxHope` (6) minus `scars` (line 711) |
| `system.scars` | int | subtracts from hope max |
| `system.damageThresholds` | derived; do not write | armor base thresholds + level (lines 681-692); with no armor: `level` / `level*2` |
| `system.experiences` | `TypedObjectField` keyed by random id → `{ name, value, description, core }` | first two get `core: true` automatically in `_preUpdate` (line 752) |
| `system.gold` | `{ coins, handfuls, bags, chests }` | builder has no gold; leave default |
| `system.biography.background` | HTML | builder `background.description` + `background.answers` |
| `system.biography.connections` | HTML | builder `connectionsNotes` |
| `system.biography.characteristics.pronouns` | string | builder `pronouns` |
| `system.levelData.level.current` / `.changed` | int | set both to the builder level; `changed > current` means "level-up pending" (`module/data/levelData.mjs:66`) |
| `system.levelData.levelups[level]` | see below | one entry per level ≥ 2 |
| `system.companion` | Actor uuid or null | Beastbound rangers; out of scope for MVP |
| `system.rules`, `system.bonuses`, `system.armorScore` | `persisted: false` | derived; never write |

Everything else the sheet shows (class, subclass, ancestry, community, domains, domain cards,
armor, weapons, features) is **found by scanning embedded items** (getters at lines 313-460):
`class` = item of type `class` with `!isMulticlass`; `multiclass` = the one with `isMulticlass`;
`domainCards.loadout` = domainCard items with `!system.inVault`; `armor` = armor item with
`system.equipped`; `primaryWeapon` = weapon with `equipped && !secondary`; `secondaryWeapon` =
weapon with `equipped && secondary`.

### `levelData.levelups[level]` (`module/data/levelData.mjs`)

```js
{
  achievements: {
    experiences: { [expId]: { name, modifier } },   // new experience gained at 2/5/8
    domainCards: [{ uuid, itemUuid }],               // the free card of that level (compendium uuid, embedded item uuid)
    proficiency: 0 | 1                                // +1 at 2/5/8
  },
  selections: [{
    tier, level, optionKey, type, subType, checkboxNr, value, minCost, amount,
    data: [string], secondaryData: { [k]: string }, itemUuid, features: [{ onPartner, id }]
  }]
}
```

`type` ∈ `LevelOptionType` (`module/data/levelTier.mjs:203-262`): `trait` (data = two trait
keys), `hitPoint`/`stress`/`evasion`/`proficiency` (value 1), `experience` (data = two experience
ids, value 1), `domainCard` (data = [compendium uuid], itemUuid = embedded item), `subclass`
(secondaryData `{ isMulticlass: "true"|"false", featureState: "2"|"3" }`), `multiclass` (data =
[class compendium uuid], secondaryData `{ subclass, domain }`), `dice` (Brawler combo die).
Tier/option keys and checkbox counts come from the `LevelTiers` world setting, default at
`levelTier.mjs:264-500`: tier 2 = levels 2-4, tier 3 = 5-7, tier 4 = 8-10; `checkboxNr` is the
box within the option row (a real level-10 actor in the test world uses `1` for the first box, see
`samples/foundry/character-level10-ranger-system2.7.json`); `optionKey` is the row name (`trait`, `hitPoint`, …).

How the system itself applies a level-up: `DhActor.levelUp()` at `module/documents/actor.mjs:471-690`.
With `levelupAuto` **on** it creates the embedded domain-card / multiclass / subclass items, sets
`featureState` on the subclass item, writes new experiences, then stores `levelups` and bumps
`level.current`; stat effects (traits, HP, stress, evasion, proficiency) are *not* written to the
actor, they are re-derived from `levelups` in `prepareBaseData` every load. With it **off** the
selections are stored for the record and the user edits stats by hand.

**Decision for the importer:** write `levelData.levelups` in the system's shape (it is a
straightforward translation of the builder's `levelUps[].picks`), create the items ourselves, and
write base traits/experiences at creation values. That gives the same result as if the player had
used the sheet's own level-up dialog, and works whether `levelupAuto` is on (stats re-derived from
our `levelups`) or off (we also write the final values into `traits`/`evasion`/`resources.*.max`
— the two modes need different actor updates, so detect the setting at import time).

### Items

Compendium source JSON lives in `src/packs/<pack>/*.json` (one file per document, `_id` stable
across releases); the runtime packs are LevelDB built by `tools/pullYMLtoLDB.mjs`. Pack ids and
paths (`system.json`): `daggerheart.classes`, `.subclasses`, `.domains`, `.ancestries`,
`.communities`, `.weapons`, `.armors`, `.consumables`, `.loot`, `.transformations`,
`.beastforms`, `.adversaries`, `.environments`, `.journals`, `.rolltables`. Packs mix types:
`classes` holds 13 `class` + 36 `feature` + 29 `loot` + 29 untyped; `subclasses` holds 26
`subclass` + 134 `feature`; `domains` 210 `domainCard`; `ancestries` 24 + 48 features;
`communities` 15 + 15 features; `weapons` 345; `armors` 73; `consumables` 121; `loot` 121;
`transformations` 6 + 12 features.

**Name matching works.** Every SRD 2.0 record in the builder has an exact-name match (after
normalising curly quotes and case) in the system compendia: 13/13 classes, 26/26 subclasses,
24/24 ancestries, 15/15 communities, 210/210 domain cards, 315/315 weapons, 69/69 armors,
120/120 consumables, 6/6 transformations (`tools/name-match-report.json`, generated by the
script in `tools/`). So the primary key is `(type, normalised name)`; the builder's id tail
(`weapon_broadsword` → "Broadsword") is derivable but the builder's `data/*.json` gives the real
display name and should be used when available.

Granting: when an item with `system.features` (class, subclass, ancestry, community,
transformation) is created on an actor, `DHItem.createDocuments` → `prepareGrantedItems`
(`module/documents/item.mjs:88-149`) fetches every linked feature and creates it too, stamping
`system.granter = { id, type, multiclass, identifier }`. **The importer must not create features
by hand for those; just create the parent item from its compendium source.** Subclass features
are gated by `subclass.system.featureState` (1 = foundation, 2 = +specialization, 3 = +mastery),
checked in `character.mjs:isItemAvailable` (lines 479-505).

| type | key fields (`module/data/item/*.mjs`) | creation rules |
|---|---|---|
| `class` | `domains: [string]` (lowercase, `grace`), `hitPoints`, `evasion`, `features: [{type: hope|class, item: uuid}]`, `inventory.{take,choiceA,choiceB}`, `isMulticlass`, `levelupOptionTiers` | **create first, alone** — subclass and domainCard `_preCreate` check for it (`characterCreation.mjs:547`). `class.mjs:_preCreate` (line 40+) refuses a second non-multiclass class. |
| `subclass` | `spellcastingTrait`, `features: [{type: foundation|specialization|mastery, item}]`, `featureState` (1..3), `isMulticlass`, `linkedClass` (class compendium uuid) | `_preCreate` (`subclass.mjs:55-84`) requires the matching class item to be present (`sourceUuid === linkedClass`) and sets `isMulticlass` itself when the match is the multiclass. Set `featureState` from the builder's `subclassTier`. |
| `ancestry` | `features: [{type: primary, item}, {type: secondary, item}]`, `loreReference` | For a **mixed** ancestry the system creates *one* ancestry item named `"A/B"` whose features are A's primary and B's secondary (`characterCreation.mjs:507-523`). Map the builder's `chosenFeatures` onto primary/secondary by position in each ancestry's feature list. |
| `community` | `features: [uuid]` | straightforward |
| `domainCard` | `domain` (lowercase), `level`, `recallCost`, `type` (`ability|spell|grimoire`), `inVault`, `loadoutIgnore` | `_preCreate` (`domainCard.mjs:78-104`) refuses a card whose domain no class item grants, refuses duplicates by name, and **auto-vaults** when the loadout is full (Homebrew `maxLoadout`, default 5). Create loadout cards first with `inVault:false`, then vault cards with `inVault:true`. Multiclass domain must already be on the multiclass class item (`domains: [chosenDomain]`). |
| `weapon` | `tier`, `equipped`, `secondary`, `burden` (`oneHanded|twoHanded`), `attack.roll.trait`, `attack.range`, `attack.damage.main.value.{dice,bonus}` + `type: [physical|magical]` | compendium entry has all of this; set `equipped: true` and `secondary: true` for the secondary. `DhCharacter.unequipBeforeEquip` (`character.mjs:590-612`) shows the burden rules the sheet enforces; the importer sets flags directly. |
| `armor` | `tier`, `equipped`, `armor.{current,max}`, `baseThresholds.{major,severe}`, `armorFeatures` (effects such as Flexible +1 evasion are embedded ActiveEffects with `transfer: true`) | set `equipped: true`; `armor.current` = builder `state.armor` |
| `consumable` | `quantity`, `consumeOnUse`, `actions` | the potion |
| `loot` | `quantity` | class `inventory.take` items (e.g. "A romance novel") — optional |
| `feature` | `granter`, `featureForm`, `actorResources` | created by the system, not by us |
| `transformation` | `features: [...]` | like ancestry |

Stamp `_stats.compendiumSource = <uuid>` on every created item (see
`characterCreation.mjs:526-545` `createEmbeddedItemData`): it is what `refreshFromCompendium`
(2.9) and `subclass.linkedClass` matching rely on (`item.mjs:24-36` `refreshSourceUuid`,
`sourceUuid`).

### Conditions

`vulnerable`, `hidden`, `restrained` are status effects (`module/config/generalConfig.mjs:235`).
Apply with `actor.toggleStatusEffect(id, { active: true })` (`actor.mjs:745`). The system also
auto-applies Vulnerable when stress is full (`creature.mjs:48-77`), so don't double-apply.

## Foundry v14 APIs the module will use

- `Actor.create({ name, type: 'character', img, system: {...}, flags: {...} })`
- `actor.createEmbeddedDocuments('Item', [data])` — the system's `DHItem.createDocuments`
  override runs for embedded creates, so granting works.
- Compendium lookup: `game.packs.get('daggerheart.weapons').getIndex({ fields: ['system.tier'] })`
  then `pack.getDocument(id)` / `fromUuid('Compendium.daggerheart.weapons.Item.<id>')`; `doc.toObject()`
  for the embed data (this is what `characterCreation.mjs` does).
- `game.settings.get('daggerheart', 'Automation').levelupAuto` and `.Homebrew.maxLoadout` /
  `.maxHope` decide how stats are derived (`CONFIG.DH.SETTINGS.gameSettings.*`).
- `game.system.api` (`daggerheart.mjs:120`) exposes data models and applications; useful for
  validating our actor data against `game.system.api.data.actors.DhCharacter.schema`.
- `actor.importFromJSON` is Foundry's own, wrapped at `actor.mjs:1134` — it expects a full Foundry
  actor export, not a builder file, so it's no shortcut.

## Open questions to resolve during implementation

1. Does `createEmbeddedDocuments` with a class item trigger `class.mjs:_preCreate`'s actor update
   (line 75) that we'd rather control? Read lines 40-96 fully before coding.
2. `levelupAuto` off: confirm exactly which fields the sheet expects hand-edited (traits value,
   `resources.hitPoints.max`, `evasion`, `proficiency`) — mirror `prepareBaseData`.
3. Experience ids: the system keys experiences by random id and `levelups[].achievements.experiences`
   / `selections[].data` reference those ids. Mint ids once and use them in both places.
4. The mixed-ancestry "primary from A, secondary from B" rule vs the builder's free choice of one
   feature per ancestry: if the builder picked A's *secondary* and B's *primary*, the system item
   still gets one of each type. Check whether `featureSubTypes` matter beyond display.
