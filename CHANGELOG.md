# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semver; the release
workflow reads the version from the release tag.

## 0.2.0 — 2026-09-06

- Homebrew content: import a builder homebrew source (the `data/<source>/` folder's JSON files, plus
  card art) into a world compendium. Classes with their hope and class features and starting items,
  subclasses with tier features, and domain cards are created; domains the system does not know are
  registered in its Homebrew settings; the compendium is searched when importing characters, which are
  matched by builder id first, then by name. Re-importing a source updates the same documents.
- Homebrew dialog reachable from the import dialog and `api.openHomebrew()`, with a whole-folder picker,
  accumulating file picks, and removal of an imported source (refuses to drop a domain a card on an actor
  still uses).
- Release zip now includes `samples/`, so `api.selfTest()` works on an installed copy.
- Character re-import uses Foundry 14's `ForcedDeletion` operator instead of the deprecated `-=` syntax.

## 0.1.0 — 2026-09-06

First release. Requires Foundry VTT v14 and the Foundryborne Daggerheart system 2.9 or later.

- Import characters from Daggerheart Character Builder transfer files: class, subclass, ancestry (pure
  and mixed), community, transformation, multiclass, traits, experiences, level-up history, domain cards
  (loadout and vault), weapons, armor, potion, starting kit, portrait, biography, marked HP/Stress/Armor,
  Hope, scars, conditions.
- Actors sidebar button and character-sheet control; re-importing a character updates the actor created
  last time.
- Report dialog listing anything skipped (homebrew content is reported, not imported); `api.selfTest()`
  regression check.
