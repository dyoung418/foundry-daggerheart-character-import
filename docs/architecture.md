# Architecture and implementation plan

## Module identity

- id: `daggerheart-character-import` (folder name in Foundry's `modules/`), title
  "Daggerheart Character Import". Repo stays `foundry-daggerheart-character-import`.
- `module.json`: `compatibility { minimum: "14", verified: "14" }`,
  `relationships.systems: [{ id: "daggerheart", type: "system", compatibility: { minimum: "2.9.0" } }]`,
  one `esmodules` entry, one stylesheet, `lang/en.json`. Placeholders `VERSION`/`URL`/`MANIFEST`/
  `DOWNLOAD` filled by the release workflow (copied from `dannysmodule/.github/workflows/main.yaml`).
- Local dev: symlink `~/foundrydata/Data/modules/daggerheart-character-import` → this repo.

## Layout

```
module.json
scripts/
  main.mjs                 # hooks: init (settings), ready (sidebar + sheet buttons), API on game.modules.get(id).api
  app/
    import-dialog.mjs      # ApplicationV2 + HandlebarsApplicationMixin: file/paste, character picker, options, progress, report
    report-dialog.mjs
  lib/                     # PURE, no Foundry globals — testable under Node
    normalize.mjs          # builder file → validated character(s); mirrors transfer.js normalizeImported + ensureLevelFields
    ids.mjs                # bareId(), kindOf(), nameFromId(), normaliseName()
    plan.mjs               # character + resolver → ImportPlan { actorData, items[], levelups, state, report[] }
    levelups.mjs           # builder levelUps → system levelData.levelups (pure translation)
    heritage.mjs           # mixed-ancestry composition
  foundry/                 # thin, Foundry-dependent
    matcher.mjs            # compendium index loading + lookup (Pathmuncher's CompendiumMatcher shape)
    writer.mjs             # applies an ImportPlan: Actor.create, createEmbeddedDocuments in the required order, updates
    portrait.mjs           # data URL → FilePicker.upload
    settings.mjs           # pack list, portrait folder, log level
templates/*.hbs
styles/import.css
lang/en.json
data/
  names.json               # id → display name index generated from the builder's SRD data (decided 2026-09-06)
  renames.json             # builder name → compendium name overrides (empty)
tools/                     # dev scripts (already: make-samples.mjs, name-match.py)
tests/
  tests.mjs                # node --test; fixtures from samples/
samples/                   # builder exports + expected derived values + a reference system actor
docs/                      # this planning record
```

No bundler, no framework — plain ESM like the builder; the system itself is also plain ESM.
`lib/` never touches `game`, `CONFIG`, `foundry.*` or the DOM; it receives a *resolver* object
(`{ lookup(type, name) → { uuid, name, data } | null }`) so tests can pass a fake built from
`samples/` and the system's `src/packs/*.json`.

## Data flow

```
file → parseTransferFile()           (lib/normalize)  → { characters[], dropped, version }
     → pick character(s)              (dialog)
     → buildPlan(ch, resolver, opts)  (lib/plan)       → ImportPlan + report entries (unmatched, skipped, notes)
     → preview in dialog              (counts, misses; abort if class/subclass/ancestry missing)
     → applyPlan(plan, { actor? })    (foundry/writer) → creates or updates the actor, in the order in docs/mapping.md
     → report dialog
```

`ImportPlan` is plain JSON (uuids as strings), so it can be logged, diffed in tests, and reused
by an "update existing actor" path that computes what to delete first.

## UI entry points

1. **Actors sidebar header button** ("Import from Character Builder"): `Hooks.on('renderActorDirectory',
   (app, html) => …)` — `html` is an `HTMLElement` in v13+; inject into `.header-actions` the way the
   system's `ItemBrowser.injectSidebarButton` does (`module/applications/ui/itemBrowser.mjs:595-640`).
   Creates a new actor per selected character. GM / `ACTOR_CREATE` only.
2. **Character sheet header control** ("Import / update from builder file"):
   `Hooks.on('getHeaderControlsCharacterSheet', (sheet, controls) => controls.push({...}))`
   (ApplicationV2 dispatches `getHeaderControls<ClassName>` for the class and each parent,
   `client/applications/api/application.mjs:1722-1730`; the system's sheet class is
   `CharacterSheet`, `module/applications/sheets/actors/character.mjs:18`). Updates that actor.
   Verify the `.header-actions` selector against the rendered v14 sidebar in Phase 0.
3. **API**: `game.modules.get('daggerheart-character-import').api.importFile(json, options)` for
   macros and tests.

Dialog is `ApplicationV2` + `HandlebarsApplicationMixin`, styled with the system's `dh-style`
classes so it looks native (see `characterCreation.mjs:56-66` for `DEFAULT_OPTIONS`).

## Settings (world scope)

- `packs`: list of compendium ids to search, default the nine `daggerheart.*` item packs.
- `portraitFolder`: default `daggerheart-character-import/portraits`.
- `addStartingKit`: create the class `inventory.take` loot items (default on for level 1).
- `keepClassQuestions`: keep the background questions the system appends (default on).
- `logLevel`.

## Testing

- **Unit (Node, no Foundry):** `node --test tests/` over `lib/`. Fixtures: the four builder samples
  plus a fake resolver built from the system's `src/packs/*.json` (checked into `tests/fixtures/`
  as a trimmed name→uuid index generated by a tool, not the full pack). Assertions:
  - `normalize` repairs `legacy-pre-levels.json` to the same shape `transfer.js` produces (run the
    builder's own `normalizeImported` in the test via absolute import, as `tools/make-samples.mjs` does).
  - `levelups` translation of `level5-ranger-multiclass.json` produces the shapes in
    `samples/foundry/character-level10-ranger-system2.7.json` (field names, tiers, checkbox numbering).
  - `plan` item ordering and vault/loadout split match `docs/mapping.md`.
- **Integration (Foundry, manual then scripted):** in `daggerheart-test` (after upgrading the
  system to 2.9.x), import the samples and compare the sheet's derived HP/Stress/Evasion/thresholds
  with `samples/expected-derived.json`; check the console for system warnings from `_preCreate`
  hooks. Script it as a macro that calls the API and asserts, so it can be re-run after system
  updates. Consider the Chrome MCP tools for driving Foundry from this session.
- **Positive controls:** every "no misses" assertion pairs with a deliberately broken id that must
  appear in the report.

## Status (2026-09-06)

Phases 0–3 are built and verified in `daggerheart-test` on Daggerheart 2.9.2; see `TODO.md`. The layout
below is what exists, with `scripts/foundry/import.mjs` (pipeline + actor matching) and
`scripts/foundry/selftest.mjs` added. Not built: homebrew stub items, Beastbound companion, renames UI, i18n.

## Phased roadmap

**Phase 0 — scaffold (½ day).** module.json, main.mjs, empty dialog that opens from the sidebar,
symlink into Foundry, README install notes, release workflow, `npm test` running an empty suite.

**Phase 1 — MVP: one SRD character, Auto on (2–3 days).** `normalize`, `ids`, `matcher`,
`plan`, `writer` for: identity, class/subclass, pure and mixed ancestry, community, traits,
experiences, creation domain cards, equipment, table state, portrait. Level 1 only at first, then
`levelups` translation for levels 2–10 without multiclass. Report dialog. Tests for `lib/`.

**Phase 2 — the rest of the SRD (1–2 days).** Multiclass (Auto on), transformations, scars and
conditions, Purposeful Design experience bonus, starting kit option, Auto-off path writing totals,
legacy files without `levelUps`.

**Phase 3 — update existing actor (1 day).** Sheet header control, flag-based matching, delete and
recreate imported items, preserve Foundry-side edits.

**Phase 4 — homebrew and polish.** Extra packs setting, renames table UI, stub items for
unmatched content, companion actor for Beastbound, i18n, module listing on foundryvtt.com.

## Decisions taken in planning (revisit if wrong)

- Create parent items from compendium sources and let the system grant features; never write
  `feature` items directly (except Purposeful Design's bonus which is a number, not an item).
- Write `levelData.levelups` in the system's shape rather than only totals, so the sheet's own
  level-up view and cross-outs work after import.
- Match by `(type, normalised name)`; the builder's id tail is only a fallback for the name.
- Target system 2.9+; do not support 2.7 (transformations, `granter`, refresh all missing there).
