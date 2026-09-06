# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semver; the release
workflow reads the version from the release tag.

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
