---
name: project-foundry-import-origin
description: Why the foundry-daggerheart-character-import repo exists, decisions Danny made at kickoff (public, MIT, tracked memory), and the planning-record convention
metadata:
  type: project
---

Started 2026-09-05. Goal: a Foundry VTT module that imports `.json` files exported by Danny's
Daggerheart character builder into the Foundryborne Daggerheart system, so his players can build on
the web app and play in Foundry. Kickoff decisions (2026-09-05): public GitHub repo under
`dyoung418`, MIT license, and Claude's memory directory for this project is a **symlink into the
repo's `memory/`** so memory is versioned with the planning record. `CLAUDE.md`, `TODO.md` and
`docs/*.md` are the project record and must stay committed. Pathmuncher (PF2e) was named as the
reference importer. The builder's transfer format is versioned (`version: 1`); if the builder's
format changes, the importer's normaliser must follow. See [[feedback-autonomous-overnight-checkpoints]].
