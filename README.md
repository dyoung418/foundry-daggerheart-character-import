# Daggerheart Character Import for Foundry VTT

A [Foundry Virtual Tabletop](https://foundryvtt.com/) module that imports characters from the
[Daggerheart Character Builder](https://github.com/dyoung418/daggerheart-character-builder)
(a fork of [vietts/daggerheart-character-builder](https://github.com/vietts/daggerheart-character-builder))
into a world running the official
[Foundryborne Daggerheart system](https://github.com/Foundryborne/daggerheart).

**Status: v0.2.0 released 2026-09-06.** Imports SRD characters at any level, including level-up history,
mixed ancestry, multiclass, vault/loadout, equipment, table state and portraits. Homebrew content is
reported and skipped. Planning record: `TODO.md`, `docs/`.

## Installation

In Foundry's **Add-on Modules** tab choose **Install Module** and paste this manifest URL:

```
https://github.com/dyoung418/foundry-daggerheart-character-import/releases/latest/download/module.json
```

Then enable the module in a world running the Daggerheart system.

## How to use it

1. In Foundry, open the Actors sidebar and click **Import from Builder**, or open a character sheet
   and choose **Import / update from builder file** from its control menu (⋮) to update that actor.
2. Pick a `.json` file saved by the builder's **Export** or **Backup & transfer** button
   (`daggerheart-characters-YYYY-MM-DD.json`), or paste its contents, and tick the characters to import.
3. The module creates (or updates) a Daggerheart `character` actor with class, subclass, ancestry,
   community, traits, level and level-up history, experiences, domain cards (loadout and vault),
   weapons, armor, potion, starting kit, portrait, biography and table state (marked HP/Stress/Armor,
   Hope, scars, conditions). Content is matched by name against the system's compendia; a report lists
   anything skipped.

Notes:
- Stats are derived by the system from the created items and the level-up record, exactly as if the
  levels had been taken on the sheet. With the world's level-up automation off, final totals are written
  instead and multiclass characters are imported without their second class.
- Importing a character again updates the actor created last time (matched by the builder's character id) rather
  than creating a duplicate; the items it created are replaced and the biography rebuilt. Foundry-side edits to
  those items are lost; other items and settings on the actor are kept.
- Homebrew content the compendia don't know is reported and skipped, unless its builder source has
  been imported (next section).

## Homebrew content

The builder loads extra content from source folders (`data/<source>/` with `classes.json`,
`subclasses.json`, `domain-cards.json`, `source.json`). Characters built on such content carry ids
like `void_class_blood_hunter` that no system compendium knows. To import them:

1. In the import dialog choose **Import a homebrew source…** (or run
   `game.modules.get("daggerheart-character-import").api.openHomebrew()`), as a GM.
2. Select the source folder's JSON files, plus any `card-art/` images named after the builder ids.
3. The module creates a world compendium `Builder homebrew: <source label>` with the classes (with
   their hope and class features and starting items), subclasses (with tier features), and domain
   cards; registers domains the system does not have (e.g. `blood`) in the system's **Homebrew**
   settings; and adds the compendium to this module's pack list.
4. Import the characters as usual. Content is matched by builder id first, then by name.

Re-importing a source after editing it in the builder replaces the same compendium documents (ids
are derived from the builder ids), so already-imported characters keep working. Feature text is
carried over as description; the system's automated actions and effects are not generated, so
homebrew features are read-and-apply-by-hand on the sheet. `api.removeHomebrewSource(id)` undoes an
import.

Console API: `game.modules.get("daggerheart-character-import").api` exposes `open()`, `importFile(json,
{ actor })`, `parseTransferFile`, `buildPlan`, `CompendiumMatcher`, `openHomebrew()`,
`importHomebrewSource(files)`, `removeHomebrewSource(id)` and `selfTest()` (imports the bundled samples
and the sample homebrew source, compares derived stats with `samples/expected-derived.json`, deletes
everything again).

## Requirements

- Foundry VTT v14
- Daggerheart system 2.9 or later

## Development

```
npm test                       # unit tests for scripts/lib (Node 24, no Foundry needed)
node tools/build-name-index.mjs   # regenerate data/names.json from the builder's SRD data
node tools/make-samples.mjs samples   # regenerate samples/ with the builder's own code
```

To run inside Foundry, symlink this folder to `<FoundryData>/Data/modules/daggerheart-character-import`
and enable the module in a Daggerheart world.

## Related

- Builder export format: `shared/transfer.js` in the builder repo (format `daggerheart-character-builder`, version 1)
- Prior art: [Pathmuncher](https://github.com/mrprimate/pathmuncher) (Pathbuilder → PF2e)

## License

MIT. See `LICENSE`.
