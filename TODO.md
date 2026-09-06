# TODO

Live task list and resume point. Newest status at the top. Dates are absolute.

## Status — 2026-09-06 02:20 (session closed cleanly; resume from "Next")

Working module, verified on Danny's real 17-character roster in `daggerheart-test` (Foundry 14.367,
Daggerheart 2.9.2). `api.selfTest()` passes 33 checks; `npm test` passes 20. Working tree clean, all
pushed. Nothing released yet. The Foundry server started from this session may still be running on
port 36000 (`pgrep -f "foundryvtt/main.js"`); Danny's roster copy sits in the gitignored `scratch/`.

Cold-start reading order: `README.md` → `CLAUDE.md` → this file → `docs/architecture.md` →
`docs/mapping.md` → `docs/builder-export-format.md` and `docs/daggerheart-system-model.md` →
`docs/prior-art.md`. Samples in `samples/`, dev tools in `tools/`, fixtures in `tests/fixtures/`
(regenerate with `tools/build-test-fixture.py <clone>/src/packs` after a system update).

## Next

- [x] Danny used the file picker with his real export (2026-09-06)
- [ ] First release: tag `v0.1.0` (the release workflow zips and publishes) once a real export has been tried
- [ ] Phase 4 candidates, none started: homebrew stub items; Beastbound companion actor; renames UI; i18n
- [ ] After each Daggerheart system update: run `api.selfTest()` in a Daggerheart world

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
