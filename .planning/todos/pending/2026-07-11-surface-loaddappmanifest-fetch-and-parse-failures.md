---
created: 2026-07-11T22:31:56.740Z
title: Surface loadDappManifest fetch and parse failures
area: general
source: 01-REVIEW.md (WR-01)
files:
  - src/shell.ts:159-180
---

## Problem

`loadDappManifest` silently swallows manifest fetch/HTTP/JSON failures while its sibling
validation path emits `dx:error`. A dapp with a missing manifest field is loudly reported,
but one whose manifest 404s or contains corrupt JSON vanishes silently with no event.

This is the same class of silent-failure the Phase 1 diagnostics milestone set out to
eliminate — it was simply outside the declared scope of DIAG-01/02/03 (which targeted the
mount container, plugin storage, and post-injection load paths), so it did not gate Phase 1.
Left as-is, it's a documented gap in the "no silent failures" charter.

Surfaced by the Phase 1 code review — see
`.planning/phases/01-diagnostics-surface-silent-failures/01-REVIEW.md` (WR-01).

## Solution

Emit `dx:error` on manifest fetch/HTTP/parse failure in `loadDappManifest`, mirroring the
existing validation-failure emit. Pick a source string consistent with the D-02
colon-hierarchical taxonomy (e.g. `shell:manifest`). Add a regression test asserting the
event fires on a 404 / malformed-JSON manifest. TBD whether this folds into a later
diagnostics gap-closure pass or a standalone fix.
