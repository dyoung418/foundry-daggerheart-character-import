---
name: feedback-autonomous-overnight-checkpoints
description: Danny runs long autonomous sessions overnight and wants progress committed and pushed to tracked files at least every 30 minutes
metadata:
  type: feedback
---

When Danny leaves a session running unattended (he said on 2026-09-05 he was going to sleep and
wanted work to continue), he wants: work independently, do not block on questions, and write
progress + remaining todos into tracked files (`TODO.md`, `docs/`) then commit and push at least
every 30 minutes.

**Why:** save points survive a crash, a token limit, or a dead session, and let the next session
resume cold from `TODO.md`.

**How to apply:** treat "commit + push" as part of finishing every research or implementation
step, not a separate chore; keep the top of `TODO.md` as a dated "where we are / what's next"
block; never end a turn with uncommitted planning work. Related: [[project-foundry-import-origin]].
