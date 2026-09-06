---
name: feedback-verify-in-live-foundry
description: How Danny's Foundry module work gets verified — drive the live world through the Chrome tools and the module API, not just unit tests
metadata:
  type: feedback
---

For this module, the checks that caught real bugs were all in the live world: the dialog template
root-element error, biography growth on re-import, stale experiences/level records, the system's
loadout warnings, and the Brawler option mapping. None showed up in Node tests.

**Why:** the Daggerheart system's `_preCreate` hooks and derived-data pipeline decide what an import
means; only the running system can answer.

**How to apply:** after any change to `scripts/foundry/` or `scripts/app/`, reload the world tab
(`http://localhost:36000/game`) and run `game.modules.get("daggerheart-character-import").api.selfTest()`
via the Chrome JavaScript tool; read the console for errors. Danny keeps a `daggerheart-test` world for
this and is fine with test actors being created and deleted there, and with world settings being
toggled if they are restored. Start the server with `~/foundryvtt/foundryvtt_launch_script` in the
background; Danny must enter the admin password and launch the world himself. Related:
[[feedback-autonomous-overnight-checkpoints]].
