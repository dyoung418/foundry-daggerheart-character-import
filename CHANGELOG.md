# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semver; the release
workflow reads the version from the release tag.

## 0.3.0 — 2026-09-06

- Homebrew source import covers every builder category: ancestries, communities, transformations,
  items (loot), weapons, armor and consumables join classes, subclasses and domain cards. Weapon and
  armor features map to the system's own features (effects and actions built by the system); unknown
  ones are registered as custom features in the system's Homebrew settings with the builder's text.
- `effects.json` in a source becomes active effects on the features, cards and items it names (traits,
  Evasion, HP/Stress slots, thresholds, attack/Spellcast bonuses, extra loadout cards; `permanent`
  cards stay active in the vault). Parts the system cannot apply are listed in the import report.
- Mixed ancestries with a homebrew half compose correctly (feature names are stored on the item).
- Removing a source also removes the custom item features it registered (same checkbox as domains).
- Sample source `samples/homebrew/tinker` has one record of each category; `api.selfTest()` checks
  the derived numbers of a character built on them.

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
