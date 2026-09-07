# TODO

Live task list and resume point. Newest status at the top. Dates are absolute.

## Status — 2026-09-06 evening (v0.3.0: every homebrew category, verified live)

**Resume here.** Every builder category now imports from a homebrew source: ancestries, communities,
transformations, items (loot), weapons, armor, consumables and `effects.json`, on top of classes,
subclasses and domain cards. Verified live in `daggerheart-test` (Foundry 14.367, Daggerheart 2.9.2):
`api.selfTest()` passes 52 checks (31 tinker documents; weapon/armor features applied by the system's
`_preUpdate` with their effects; custom features `dhci-tinker-coiled`/`-greased` registered in the
system's Homebrew `itemFeatures`; the tinker character derives HP 7, Stress 7, Evasion 13, Instinct 1,
attack bonus 1 from effects.json). Danny's real `data/homebrew` source (Oddfolk, Premium Snack, two
effects) imported as `world.dhci-homebrew` with 4 documents and one report note; a bard on Oddfolk got
Instinct 1 from the Inscrutable effect. That source is still in the test world. `npm test` passes 33.
`v0.3.0` cut from this state (see Release history). The Foundry server was started with
`--world=daggerheart-test` so the join page skips the admin password; Gamemaster has a password and Danny
logged in himself.

Known cosmetic: the dialog's "imported" date is the UTC day. Not automated by design (reported as
notes): `equalTo` scaling, `choice`, `excluded`, `armorScore`, actions on features/cards.

Earlier context: Danny tried importing his second builder source, `~/daggerheart-character-builder/data/homebrew/`
(`source.json`, `ancestries.json` with one ancestry "Oddfolk", `items.json` with one item, `effects.json`),
and got "no classes, subclasses or domain cards found": the source import only handles classes, subclasses
and domain cards. Danny wants **every builder category** imported: ancestries, communities, transformations,
items, weapons, armor, consumables (and the declarative `effects.json`). No code for this exists yet; the
research below is done and verified against the system source (clone of `v14` at
`/tmp/claude-1000/…/scratchpad/dh`, 2.9.2 — re-clone into scratch if gone).

Design notes for the next session (all read from `module/data/item/*.mjs` and `src/packs/*/*.json`):
- **ancestry**: `system.features = [{type:"primary", item}, {type:"secondary", item}]` from the builder's
  `features[0]`/`[1]` (warn on more than two), `loreReference: null`, default img
  `systems/daggerheart/assets/icons/documents/items/family-tree.svg`. Store the builder feature names in the
  item's homebrew flag (`featureNames`) and let `matcher.featureNames(id)` fall back to it so mixed-ancestry
  composition (`lib/heritage.mjs`) works for homebrew ancestries. Builder fields: `id, name, description, features`.
- **community**: `system.features = [uuid, …]` (plain uuid strings, not `{type,item}`), `loreReference: null`,
  img `…/items/village.svg`. Builder fields add `personalities` (drop or append to description).
- **transformation**: like ancestry/community with `features` — check `module/data/item/transformation.mjs`
  for the link shape before writing (not read yet).
- **items.json** (downtime/loot items: `id, name, set, roll, features[].description`) → `loot` items, img
  `…/items/open-treasure-chest.svg`; ids may lack a kind segment (`homebrew_snack`), so accept any id for loot.
  Characters never reference these, so they matter only for dragging from the compendium.
- **weapons / armor / consumables**: builder schema in `docs/builder-export-format.md` (uppercase enums:
  `trait: "AGILITY"`, `range: "MELEE"`, `burden: "ONE_HANDED"`, `damage: {dice:"D8", type:"PHYSICAL"}`);
  system fields in `docs/daggerheart-system-model.md` (weapon: `tier, burden oneHanded|twoHanded,
  attack.roll.trait, attack.range, attack.damage.main.value.{dice,bonus}, type [physical|magical]`; armor:
  `tier, armor.{current,max}, baseThresholds.{major,severe}`; consumable: `quantity, consumeOnUse`). Read
  `weapon.mjs`, `armor.mjs`, `consumable.mjs` and one pack JSON each before mapping. Characters *do*
  reference these (`equipment.*Id`), so matching by builder id matters.
- **effects.json** (builder declarative effects; keys `"<recordId>:<FeatureName>"`, `"<recordId>:<tier>"` with
  `feature`, or `"<recordId>"` for cards; values: `traits.{trait}: n`, stat keys `evasion, hitPointSlots,
  stressSlots, majorThreshold, severeThreshold, armorScore, attack, spellcast, extraDomainCards`, `{equalTo}`
  scaling, `permanent`, `choice`, `excluded`) → one embedded ActiveEffect on the target feature/card with
  `transfer: true`, `type: "base"`, `system.changes: [{key, type:"add", value, priority:null, phase:"initial"}]`
  (shape copied from `src/packs/subclasses/feature_Unrelenting_*.json`). Confirmed change keys in the packs:
  `system.traits.<trait>.value`, `system.evasion`, `system.resources.hitPoints.max`,
  `system.resources.stress.max`, `system.damageThresholds.major|severe`, `system.proficiency`,
  `system.bonuses.roll.attack.bonus`, `system.bonuses.roll.spellcast.bonus`, `system.bonuses.maxLoadout`
  (= extraDomainCards). `armorScore` is derived from the armor item in `prepareBaseData` — no key; report as
  not automated. `equalTo`, `choice`, `excluded` → report lines, not effects.
- `parseSourceFiles`: recognise the new files by name and by shape (ancestry: `features` without
  `domain`/`class`; community: `personalities`; items: `set`/`roll`; weapons: `damage`/`burden`; armor:
  `baseThresholds`/`baseScore`; effects: object keyed by ids); error text must list all categories.
- Update `describeSource`, the sample source `samples/homebrew/tinker` (add one of each category and an
  `effects.json`; the sample character should use the homebrew ancestry, community, weapon, armor), the Node
  tests (item counts change from 15), the self-test (`homebrew items` check and derived numbers), README,
  `docs/mapping.md`. Then re-run in `daggerheart-test`: Danny's `data/homebrew` source (Oddfolk +1 Instinct
  effect) and `api.selfTest()`; cut `v0.3.0`.


Working module, verified on Danny's real 17-character roster in `daggerheart-test` (Foundry 14.367,
Daggerheart 2.9.2). `npm test` passes 27; `api.selfTest()` passes 44 checks (the last 11 exercise the
homebrew path). **`v0.2.0` is published** (manifest and zip verified by download; the zip now carries
`samples/` so `api.selfTest()` works on an installed copy). `v0.1.0` was the first release earlier the same
day. **Homebrew source import** landed between the two: Danny imported his `void` source (2 classes, 5 subclasses, 21 Blood
cards → `world.dhci-void`, 69 documents) through the new dialog, and BloodHunter (level 8, Blood
Hunter/Order of the Mutant + Warlock multiclass), MultiMaggy (Warrior + Blood Hunter multiclass) and
Summoner Sam then imported with no warnings — the whole roster now imports. Card art verified live too:
picking the whole `data/void` folder uploaded 36 images to `daggerheart-character-import/homebrew/dhci-void`
and every card, subclass and tier feature carries its image; a character re-import refreshes the art on
existing actors. The Foundry server is running
on port 36000 (check with `ss -ltn | grep 36000`). Danny's roster copy sits in the gitignored `scratch/`.

Release history worth knowing: `v0.3.0` (2026-09-06, every homebrew category) was cut with `gh release create
--generate-notes --notes-file`; the Release workflow built it in 10 s and the manifest (`0.3.0`) and zip
(61 files, samples included) were verified by download. the first `v0.1.0` build (old workflow copied from `dannysmodule`) shipped
literal `VERSION`/`DOWNLOAD` strings because the replace-tokens action only matches `#{NAME}#`; it was
deleted and re-cut the same hour on the new `Release` workflow (League template + manifest check +
optional foundryvtt.com Package Release API step). The `v0.0.0` tag on the initial commit was only
needed by the removed changelog action and can be deleted. Package is not registered on foundryvtt.com.

## Next

- [x] Danny used the file picker with his real export (2026-09-06)
- [x] First release `v0.1.0` published 2026-09-06 and verified by downloading the manifest and zip
- [ ] Decide whether to register the package on foundryvtt.com (then add the `FOUNDRY_PACKAGE_RELEASE_TOKEN` secret; the workflow step is already there)
- [x] Homebrew: import a builder source folder into a world compendium (2026-09-06; see "Phase 4" below)
- [x] `v0.2.0` released 2026-09-06 (homebrew source import and removal; samples in the zip)
- [x] UI for removing an imported homebrew source: trash control per entry in the homebrew dialog, confirm
      dialog lists what goes and which actors use the content, optional removal of the domains the import
      added — refused (with a warning) while a card on an actor still uses one, because dropping the domain
      makes the system's actor refresh throw on that card (Danny, 2026-09-06; verified live on the Tinker sample)
- [x] Homebrew source import for all builder categories — ancestries, communities, transformations,
      items, weapons, armor, consumables, effects.json (2026-09-06; verified on Danny's `data/homebrew`;
      `v0.3.0`)
- [ ] Phase 4 candidates, none started: Beastbound companion actor; renames UI; i18n
- [ ] After each Daggerheart system update: run `api.selfTest()` in a Daggerheart world

## Phase 4 — homebrew (2026-09-06)

- [x] `scripts/lib/homebrew.mjs`: source files → Foundry item data (class + hope/class `feature`s + `loot` for
      class items, subclass + tier features with `linkedClass`, domain cards), deterministic ids
      `stableId("<source>:<builderId>[:part]")`, `flags.<module>.homebrew.{sourceId,builderId,kind}`
- [x] `scripts/foundry/homebrew.mjs`: pack `world.dhci-<source>` (created via `CompendiumCollection.createCompendium`),
      unknown domains added to the system's `Homebrew.domains` setting before cards are created, pack appended to
      the packs setting, `homebrewSources` setting; `removeHomebrewSource` undoes it
- [x] `scripts/app/homebrew-dialog.mjs`: multi-file picker (picks accumulate; clear), linked from the import dialog
- [x] matcher indexes builder ids from flags; plan tries `lookupById` before names
- [x] sample source `samples/homebrew/tinker` + `samples/homebrew-level1-tinker.json`; 7 Node tests; self-test section
- [x] Verified live on Danny's `void` source and his three void characters (see Status)

## Phase 2–3 (2026-09-06)

- [x] Danny's real 17-character export: 15 import; 2 homebrew (`void_`) classes refused as designed
- [x] Fixes from that run: dialog and report scroll with long rosters; vault cards no longer trigger the system's
      "loadout max reached" warning; class-declared level-up options (Brawler combo die) map to the class's own
      `levelupOptionTiers` entry — verified on Cranston (17 cards) and Bruiser (combo die d6)

- [x] Importing a known builder character updates its existing actor (flag match); dialog says "updates <name>"
- [x] Re-import three times into the same actor: item, experience and level-record counts stable
- [x] Actor folder setting (blank by default); folder created on demand
- [x] Transformation import spot-checked (Demigod + its two features granted)

## Decisions from Danny (2026-09-06)

- Ship a **name-only index** `data/names.json` generated from the builder's SRD data.
- Biography: **keep** the class questions the system appends, **append** the builder's text.
- Local Foundry is now **14.367**, Daggerheart **2.9.2**; `daggerheart-test` opened with both.
- Module id **`daggerheart-character-import`**, title "Daggerheart Character Import".
- MVP: multiclass import only when `levelupAuto` is on; reported as skipped otherwise.
- Homebrew (`void_`) content is **not in use** for exports today; homebrew import is a later phase.

## Phase 0 — scaffold (2026-09-06)

- [x] `module.json`, `scripts/main.mjs`, ApplicationV2 dialog (`scripts/app/import-dialog.mjs`) opened from
      the Actors sidebar button and a character-sheet header control; reads a file or pasted JSON and lists
      the characters; Import shows a not-implemented notice
- [x] `scripts/lib/ids.mjs`, `scripts/lib/normalize.mjs` with tests (`npm test`, 10 passing)
- [x] Symlink `~/foundrydata/Data/modules/daggerheart-character-import` → repo
- [x] `.github/workflows/main.yaml` (release zip on published release) and `tests.yml`
- [x] `tools/build-name-index.mjs` → `data/names.json` (807 names from srd_1_0 + srd_2_0)
- [x] Loaded in `daggerheart-test` (Foundry 14.367, system 2.9.2): module enables with no console errors, sidebar button
      appears, dialog lists both characters from `samples/roster.json`, Import shows the not-implemented notice, the
      character-sheet header control appears in the sheet's control menu and opens the dialog targeting that actor

## Phase 1 — MVP (2026-09-06)

- [x] `lib/normalize.mjs` + tests against `samples/legacy-pre-levels.json`
- [x] `lib/ids.mjs`, `foundry/matcher.mjs` (pack list setting, `data/renames.json` overrides)
- [x] `lib/plan.mjs`, `lib/levelups.mjs`, `lib/heritage.mjs` with tests on a compendium fixture (`tests/fixtures/`)
- [x] `foundry/writer.mjs`, `foundry/import.mjs`, report dialog, dialog wired, API `importFile`
- [x] Bard and ranger samples imported in `daggerheart-test`; derived stats equal `samples/expected-derived.json`
- [x] Re-import into an existing actor: no duplicate items, biography rebuilt (one `<hr>`), portrait re-uploaded
- [x] Legacy sample import (srd_1_0 ids, no history): resolves by name, one warning about the missing history
- [x] Portrait upload to `daggerheart-character-import/portraits/` (folder created on demand)
- [x] Dialog end-to-end via paste → Import → report dialog listing both characters (file picker not scriptable; check by hand)
- [x] Level-up automation **off** path: totals written (same derived numbers), multiclass skipped with a report line
- [x] `tests/levelups.test.mjs` snapshot against `samples/foundry/expected-levelups-level5-ranger.json` (rendered correctly in the sheet's level-up view)
- [x] `api.selfTest()`: imports the three samples, 33 checks against `samples/expected-derived.json`, all passing on 2.9.2

## Done

- [x] 2026-09-05 R5 `docs/architecture.md`; TODO rewritten as roadmap
- [x] 2026-09-05 R4 `docs/mapping.md`; reference actor `samples/foundry/`; first memory files
- [x] 2026-09-05 R2 `docs/daggerheart-system-model.md`; R3 `docs/prior-art.md`; `tools/name-match.py` + report
- [x] 2026-09-05 R1 `docs/builder-export-format.md`, `samples/*.json`, `tools/make-samples.mjs`
- [x] 2026-09-05 git init, CLAUDE.md, README.md, TODO.md, LICENSE (MIT), `.gitignore`, memory symlink
- [x] 2026-09-05 GitHub repo `dyoung418/foundry-daggerheart-character-import` (public) as `origin`
