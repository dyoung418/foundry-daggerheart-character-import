---
name: feedback-release-workflow-research
description: Danny does not consider dannysmodule's release CI a best-practice reference; research current Foundry packaging guidance instead of copying it, and verify a release by downloading its manifest and zip
metadata:
  type: feedback
---

On 2026-09-06 Danny said "I'm not sure my dannysmodule represents the best practice for foundry
module workflows. You may want to research the most recent best practices there." The workflow copied
from it then shipped a broken first `v0.1.0` (unreplaced `VERSION` tokens) and needed a changelog action
that requires two tags.

**Why:** `dannysmodule` is a personal content module whose CI grew by accretion; the community
reference is the League of Foundry Developers module template plus the Foundry wiki's
"Package Releases and Version History" and "Package Development Best Practices" pages, and the
Package Release API for the foundryvtt.com listing.

**How to apply:** For anything release/packaging related, read the current League template and wiki
first, not `dannysmodule`. After any release, download `releases/latest/download/module.json` and the
zip it names and check version, download URL and contents; a green workflow is not verification
(see [[feedback-verify-in-live-foundry]]). Check `git fetch` / remote state before pushing, since Danny
may act in parallel from another terminal.
