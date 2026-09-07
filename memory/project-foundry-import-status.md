---
name: project-foundry-import-status
description: State of the Daggerheart character importer as of 2026-09-06 evening (v0.3.0, every homebrew category) — what works, what Danny has tried, what is next; the resume point for the next session
metadata:
  type: project
---

As of 2026-09-06 02:20 the module (`~/foundry-daggerheart-character-import`, symlinked into
`~/foundrydata/Data/modules/daggerheart-character-import`) imports builder files end to end on
Foundry 14.367 / Daggerheart 2.9.2. Danny imported his real 17-character roster: 15 succeeded, the 2
with homebrew (`void_`) classes were refused as designed, and the three problems he hit (long-roster
dialog, loadout warnings, Brawler combo die) were fixed the same night and verified on his actors.
`v0.1.0` was released 2026-09-06 (re-cut once the same hour after a broken first build; see
[[feedback-release-workflow-research]]). Later that day the homebrew source import landed (builder
`data/<source>/` folder → `world.dhci-<source>` compendium; Danny's `void` source and its three
characters import cleanly, card art included), so the whole roster imports; `v0.2.0` shipped it the
same evening with a removal UI. On 2026-09-06 evening
the source import was extended to every builder category (ancestries, communities, transformations,
items, weapons, armor, consumables, `effects.json` → ActiveEffects; weapon/armor features via the
system's own feature keys or custom Homebrew `itemFeatures`), verified live with `api.selfTest()` (52
checks) and on Danny's `data/homebrew` source (Oddfolk +1 Instinct); shipped as `v0.3.0`. Danny logs
into Foundry himself (Gamemaster has a password); start the server with `--world=daggerheart-test` so
the admin password is not needed. **Next:** nothing requested; candidates in `TODO.md` (Beastbound
companion, renames UI, i18n, foundryvtt.com registration).
