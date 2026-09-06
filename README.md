# Daggerheart Character Import for Foundry VTT

A [Foundry Virtual Tabletop](https://foundryvtt.com/) module that imports characters from the
[Daggerheart Character Builder](https://github.com/dyoung418/daggerheart-character-builder)
(a fork of [vietts/daggerheart-character-builder](https://github.com/vietts/daggerheart-character-builder))
into a world running the official
[Foundryborne Daggerheart system](https://github.com/Foundryborne/daggerheart).

**Status: working, pre-release.** Imports SRD characters at any level, including level-up history,
mixed ancestry, multiclass, vault/loadout, equipment, table state and portraits. Not yet published as a
release; install by cloning (see Development). Planning record: `TODO.md`, `docs/`.

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
- Re-importing into an existing actor replaces the items it created last time and rebuilds the biography.
- Homebrew content the compendia don't know is reported and skipped.

Console API: `game.modules.get("daggerheart-character-import").api` exposes `open()`, `importFile(json,
{ actor })`, `parseTransferFile`, `buildPlan`, `CompendiumMatcher` and `selfTest()` (imports the bundled
samples, compares derived stats with `samples/expected-derived.json`, deletes them again).

## Requirements (planned)

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
