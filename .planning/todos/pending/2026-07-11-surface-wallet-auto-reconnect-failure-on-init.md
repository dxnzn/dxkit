---
created: 2026-07-11T22:31:56.740Z
title: Surface wallet auto-reconnect failure on init
area: wallet
source: 01-REVIEW.md (WR-03)
resolves_phase: 3
files:
  - plugins/wallet/src/index.ts:260-266
---

## Problem

The wallet plugin's auto-reconnect on init swallows any failure with no diagnostic — the same
silent-`catch` pattern Phase 1 upgraded elsewhere in this very file, left inconsistent here
because it was outside DIAG-02's declared scope (storage read/write only).

The Phase 1 verifier flagged this as especially worth fixing because **Phase 3 already opens
the wallet plugin for SEC-02** (configurable storage key / storage isolation) — folding this
emit into that work avoids touching the file twice. Hence `resolves_phase: 3`: this todo will
surface during Phase 3 planning and auto-close when Phase 3 completes.

Surfaced by the Phase 1 code review — see
`.planning/phases/01-diagnostics-surface-silent-failures/01-REVIEW.md` (WR-03).

## Solution

In the init auto-reconnect catch block, emit `dx:error` (source consistent with the
`plugin:wallet:*` taxonomy, e.g. `plugin:wallet:reconnect`) instead of swallowing. Keep the
early-return-silent behavior only when reconnect is genuinely not applicable (no persisted
provider). Add a regression test. Bundle with the Phase 3 SEC-02 wallet changes.
