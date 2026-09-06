---
name: project-foundry-import-status
description: State of the Daggerheart character importer as of 2026-09-06 — what works, what Danny has tried, what is next; the resume point for the next session
metadata:
  type: project
---

As of 2026-09-06 02:20 the module (`~/foundry-daggerheart-character-import`, symlinked into
`~/foundrydata/Data/modules/daggerheart-character-import`) imports builder files end to end on
Foundry 14.367 / Daggerheart 2.9.2. Danny imported his real 17-character roster: 15 succeeded, the 2
with homebrew (`void_`) classes were refused as designed, and the three problems he hit (long-roster
dialog, loadout warnings, Brawler combo die) were fixed the same night and verified on his actors.
Not yet done: a release tag (`v0.1.0` waits on Danny), homebrew stub items, Beastbound companion.
`TODO.md` has the exact list. `api.selfTest()` in a Daggerheart world is the regression check;
`npm test` covers the pure library (20 tests). See [[project-foundry-import-origin]] and
[[feedback-verify-in-live-foundry]].
