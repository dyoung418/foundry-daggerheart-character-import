# TODO

Live task list and resume point. Newest status at the top. Dates are absolute.

## Status — 2026-09-06 00:20

R1, R2, R3 done. Headline findings: (1) every SRD 2.0 record in the builder has an exact-name match
in the system compendia, so name matching is the primary key; (2) the system grants features
automatically when a class/subclass/ancestry/community item is created on an actor, so the importer
creates parent items from compendium sources and does not build features by hand; (3) level-ups are
stored on the actor as `system.levelData.levelups` in a shape that maps 1:1 from the builder's
`levelUps[].picks`, and the world's `levelupAuto` setting decides whether stats are re-derived from
them or must be written as totals. Local system install is 2.7.4; target 2.9+ and upgrade the test world.
Starting R4 (mapping).

## In progress

- [ ] R4 Field-by-field mapping → `docs/mapping.md`

## Next

- [ ] R5 Architecture, test strategy, phased roadmap → `docs/architecture.md`; rewrite this file as the roadmap
- [ ] Ask Danny: does the builder ever export homebrew (`void`) content ids in practice, and should the importer ship a copy of the builder's SRD data for name resolution, or rely on compendia only?

## Done

- [x] 2026-09-06 R2 `docs/daggerheart-system-model.md`; R3 `docs/prior-art.md`; `tools/name-match.py` + report

- [x] 2026-09-05 R1 `docs/builder-export-format.md`, `samples/*.json`, `tools/make-samples.mjs`
- [x] 2026-09-05 git init, CLAUDE.md, README.md, TODO.md, LICENSE (MIT), `.gitignore`, memory symlink
- [x] 2026-09-05 GitHub repo `dyoung418/foundry-daggerheart-character-import` (public) as `origin`
