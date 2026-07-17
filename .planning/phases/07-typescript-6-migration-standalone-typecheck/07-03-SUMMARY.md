---
phase: 07-typescript-6-migration-standalone-typecheck
plan: 03
subsystem: infra
tags: [makefile, tsc, typecheck, ci, tooling]

# Dependency graph
requires:
  - phase: 07-01
    provides: root tsconfig.typecheck.json
  - phase: 07-02
    provides: plugins/{auth,wallet,theme,settings}/tsconfig.typecheck.json
provides:
  - "Standalone `make typecheck` target covering root + all 4 plugins"
  - "`make test`/`make test-watch` now run lint -> typecheck -> vitest"
  - "Green pre-bump baseline: `make typecheck` and `make test` both exit 0 on TypeScript 5.8.3"
affects: [07-04, phase-09-guardrails]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "typecheck target mirrors verify-outputs' root-then-PLUGIN_BUILD_ORDER loop shape"

key-files:
  created: []
  modified:
    - Makefile

key-decisions:
  - "typecheck kept as a standalone Makefile target (not folded into test) so Phase 9's deprecation gate can call `make typecheck` directly"
  - "lint -> typecheck -> vitest ordering chosen because lint is fastest and should fail first"
  - "No ci.yml edit needed — CI already invokes `make test`, which now transitively runs typecheck"

patterns-established:
  - "Any future per-package Makefile check should reuse $(PLUGIN_BUILD_ORDER) rather than hand-rolling a second package list (D-05)"

requirements-completed: [TS6-03]

coverage:
  - id: D1
    description: "Standalone `make typecheck` target added, running `tsc --noEmit -p tsconfig.typecheck.json` for root + all 4 plugins via PLUGIN_BUILD_ORDER"
    requirement: "TS6-03"
    verification:
      - kind: other
        ref: "make typecheck (manual run, this session) — exits 0, all 5 packages checked"
        status: pass
    human_judgment: false
  - id: D2
    description: "`make test`/`make test-watch` gain typecheck as a prerequisite (lint -> typecheck -> vitest); make test exits 0 with 321 vitest specs passing"
    requirement: "TS6-03"
    verification:
      - kind: unit
        ref: "make test (manual run, this session) — 12 test files, 321 tests passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "typecheck target actually checks (not a no-op) — confirmed by introducing a temporary type error in src/utils.ts and observing make typecheck fail non-zero, then reverting"
    requirement: "TS6-03"
    verification:
      - kind: other
        ref: "manual negative-check: TS2322 error surfaced, make exit code 2, reverted cleanly (git diff clean)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-17
status: complete
---

# Phase 07 Plan 03: Standalone Make Typecheck Target Summary

**Added a standalone `make typecheck` target (tsc --noEmit across root + 4 plugins) and wired it as a `make test`/`test-watch` prerequisite ahead of vitest, giving CI the TS6-03 baseline check with zero ci.yml edits.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-17T15:17:00Z (approx.)
- **Completed:** 2026-07-17T15:23:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `typecheck` target to `Makefile`, structurally identical to the existing `verify-outputs` target: runs `npx tsc --noEmit -p tsconfig.typecheck.json` at root, then loops `$(PLUGIN_BUILD_ORDER)` (settings, wallet, auth, theme) running the same command per plugin directory.
- Changed `test` and `test-watch` prerequisites from `lint` to `lint typecheck`, establishing the ordering lint -> typecheck -> vitest (D-06).
- Added `typecheck` to the `.PHONY` line.
- Verified `make typecheck` exits 0 across all 5 packages and `make test` exits 0 with 321 vitest specs passing, on the currently-resolved TypeScript 5.8.3 — the committed pre-bump baseline for the TS6 migration (07-04).
- Proved the gate is not a no-op: temporarily introduced a type error in `src/utils.ts`, confirmed `make typecheck` failed with exit code 2 and `TS2322`, then reverted the file to a clean state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the make typecheck target and wire it into make test** - `c56049f` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `Makefile` - New `typecheck` target (root + PLUGIN_BUILD_ORDER loop, tsc --noEmit); `test`/`test-watch` prereq changed to `lint typecheck`; `.PHONY` updated.

## Decisions Made
- Kept `typecheck` a standalone target rather than folding it into `test`, so Phase 9's scoped deprecation gate (GATE-01) can invoke `make typecheck` directly without depending on vitest also running.
- No `ci.yml` edit required — CI already runs `make test`, which now transitively runs typecheck with no workflow changes.
- Ordering chosen as lint -> typecheck -> vitest per CONTEXT.md's noted discretion (lint is the fastest check, so it fails fastest).

## Deviations from Plan

None - plan executed exactly as written. The `tsc --noEmit` command, target shape, prerequisite change, and `.PHONY` edit all matched 07-PATTERNS.md's verified pattern exactly; no adjustments were needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The standalone `make typecheck` target is green on TypeScript 5.8.3, giving 07-04 (the `typescript@^6.0.0` bump) a committed, bisectable pre-bump baseline to diff against.
- Phase 9's deprecation gate (GATE-01) has a stable, standalone `make typecheck` attach point ready to use.
- No blockers.

---
*Phase: 07-typescript-6-migration-standalone-typecheck*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: Makefile
- FOUND: c56049f (commit exists in git log)
- FOUND: typecheck target (Makefile:97)
