# Daggerheart Character Import for Foundry VTT

A [Foundry Virtual Tabletop](https://foundryvtt.com/) module that imports characters from the
[Daggerheart Character Builder](https://github.com/dyoung418/daggerheart-character-builder)
(a fork of [vietts/daggerheart-character-builder](https://github.com/vietts/daggerheart-character-builder))
into a world running the official
[Foundryborne Daggerheart system](https://github.com/Foundryborne/daggerheart).

**Status: planning.** There is no installable module yet. This repository currently holds the
research and design record: see `docs/` for findings and `TODO.md` for the roadmap.

## What it will do

1. In Foundry, open the importer from the Actors sidebar.
2. Pick a `.json` file saved by the builder's **Export** or **Backup & transfer** button
   (`daggerheart-characters-YYYY-MM-DD.json`).
3. Choose which character(s) to import, and whether to create new actors or update existing ones.
4. The module creates a Daggerheart `character` actor with the right class, subclass, ancestry,
   community, traits, level, experiences, domain cards (loadout and vault), weapons, armor and
   table state (marked HP/Stress/Armor, Hope, scars, conditions), matching content against the
   system's compendia and reporting anything it could not match.

## Requirements (planned)

- Foundry VTT v14
- Daggerheart system 2.7 or later

## Related

- Builder export format: `shared/transfer.js` in the builder repo (format `daggerheart-character-builder`, version 1)
- Prior art: [Pathmuncher](https://github.com/mrprimate/pathmuncher) (Pathbuilder → PF2e)

## License

MIT. See `LICENSE`.
