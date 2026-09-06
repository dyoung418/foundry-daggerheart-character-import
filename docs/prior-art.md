# Prior art: Pathmuncher (and what to take from it)

Pathmuncher 1.6.1 is installed locally (`~/foundrydata/Data/modules/pathmuncher/`, dist only);
source cloned from github.com/mrprimate/pathmuncher (`eb1eef4`, 2026-06-27) into scratch.
It imports Pathbuilder 2e JSON into PF2e actors. The domain is far more complex than ours (rule
elements, choice sets, runes, spellcasting) — 3,322 lines in `src/app/Pathmuncher.js` — so the
value is in the *shape*, not the code.

## Structure worth copying

- **Entry point on the character sheet, not the sidebar.** `src/hooks/sheets.js` hooks
  `render<SheetClass>` for every registered character sheet and injects a header button; only
  owners with `ACTOR_CREATE` see it. Import therefore targets an *existing* actor (create a blank
  one first), which sidesteps "where does the new actor go" and makes re-import natural.
  For us: also add a sidebar/Actors-directory button that creates the actor *and* imports, since a
  builder file can hold a whole roster.
- **Options dialog with per-category checkboxes**, persisted as actor flags
  (`PathmuncherImporter.js:60-80`, `utils.setFlags`) so a re-import remembers choices. Two input
  modes: fetch by id, or paste JSON. Ours: file picker + paste, plus a character selector when the
  file holds several.
- **Two-phase pipeline:** `processCharacter()` resolves everything into an in-memory `result`
  (actor update + arrays of item data per category) and records misses in `this.bad`; then
  `updateActor()` applies it (`Pathmuncher.js:2960-3200`). Pure resolution is testable without a
  live actor. Keep that split.
- **CompendiumMatcher** (`src/app/CompendiumMatcher.js`): loads pack indexes once with the fields
  it needs (`getIndex({ fields })`), matches by exact name first, then by slug; a rename map
  (`Seasoning`) handles known naming drift between source and compendium. Pack lists are a
  setting (`CORE_COMPENDIUM_MAPPINGS`, overridable via a `CompendiumSelector` menu) so homebrew
  packs can be added without code.
- **Post-import report** (`postImportCheck`, line 3201): a dialog listing everything that could not
  be matched, grouped by category, and a notification either way.
- **Update semantics:** `#removeDocumentsToBeUpdated` deletes the previously imported items of the
  categories being re-imported before creating fresh ones, keyed by flags on the items.
- **Module plumbing:** `module-template.json` with `relationships.systems` pinning the system
  version range; settings registered in `init`, sheet buttons in `ready`; a log-level setting.

## What not to copy

- The temp-actor dance (`#generateTempActor`) exists to evaluate PF2e rule elements; Daggerheart
  grants features on item creation (`DHItem.prepareGrantedItems`), so we don't need it.
- The giant rename tables (`src/data/*.js`): our name match is 100% today; keep a small override
  table but don't pre-populate it.
- FormApplication (v1). Use `ApplicationV2` + `HandlebarsApplicationMixin` as the Daggerheart
  system does.

## D&D Beyond importer

`ddb-importer` is also installed but is a different scale (proxy service, licensing gates).
Not worth mining beyond confirming the same sheet-button + options-dialog + report pattern.
